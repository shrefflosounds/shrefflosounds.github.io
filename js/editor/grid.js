// Sidehop Snap-to-Grid Level Editor & Enhanced Interaction System

import { CrateBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';
import { sounds } from '../audio/sound.js';

export class GridEditor {
  constructor(canvas, camera, tileSize = 40) {
    this.canvas = canvas;
    this.camera = camera;
    this.tileSize = tileSize;
    this.currentTool = 'place'; // 'place', 'select', 'pan', 'erase'
    this.previousTool = 'place';
    this.selectedPaletteItem = 'crate';
    this.hoverGrid = { x: 0, y: 0 };
    this.isMouseDown = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isSpacePan = false;
    this.selectedEntity = null;

    // Drag-to-move entity in Select mode
    this.isDraggingEntity = false;
    this.dragOffset = { x: 0, y: 0 };

    // Callbacks for UI
    this.onSelectEntity = null; // (entity, screenPos) => {}
    this.onDeselect = null;
    this.onEntityMoved = null;

    this.bindCanvasEvents();
  }

  setPaletteItem(item) {
    this.selectedPaletteItem = item;
    this.currentTool = 'place';
    this.updateCursor();
    sounds.playClick();
  }

  setTool(tool) {
    this.currentTool = tool;
    this.updateCursor();
    sounds.playClick();
  }

  updateCursor() {
    if (this.isPanning || (this.isMouseDown && this.currentTool === 'pan')) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.currentTool === 'pan' || this.isSpacePan) {
      this.canvas.style.cursor = 'grab';
    } else if (this.currentTool === 'erase') {
      this.canvas.style.cursor = 'crosshair';
    } else if (this.currentTool === 'select') {
      this.canvas.style.cursor = 'default';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  bindCanvasEvents() {
    // Two-finger trackpad scroll or mouse wheel pans the map smoothly
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Handle both wheel and trackpad panning
      const dx = e.deltaX;
      const dy = e.deltaY;
      this.camera.pan(dx, dy);
      if (this.selectedEntity && this.onSelectEntity) {
        this.notifyEntitySelected(this.selectedEntity);
      }
    }, { passive: false });
  }

  notifyEntitySelected(entity) {
    const screenCenter = this.camera.worldToScreen(entity.x + entity.width / 2, entity.y);
    if (this.onSelectEntity) {
      this.onSelectEntity(entity, screenCenter);
    }
  }

  handleMouseDown(e, entities, player) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Pan with Right-click, Middle-click, Alt-click, Pan Tool, or Spacebar held
    if (e.button === 1 || e.button === 2 || e.altKey || this.currentTool === 'pan' || this.isSpacePan) {
      this.isPanning = true;
      this.panStart = { x: mouseX, y: mouseY };
      this.updateCursor();
      return;
    }

    this.isMouseDown = true;
    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    const gridX = Math.floor(worldPos.x / this.tileSize) * this.tileSize;
    const gridY = Math.floor(worldPos.y / this.tileSize) * this.tileSize;

    if (this.currentTool === 'erase') {
      this.eraseAt(gridX, gridY, entities);
    } else if (this.currentTool === 'place') {
      this.placeAt(gridX, gridY, entities, player);
    } else if (this.currentTool === 'select') {
      // Check if clicking currently selected entity to drag it
      if (this.selectedEntity && this.isPointInside(worldPos.x, worldPos.y, this.selectedEntity)) {
        this.isDraggingEntity = true;
        this.dragOffset = {
          x: worldPos.x - this.selectedEntity.x,
          y: worldPos.y - this.selectedEntity.y
        };
      } else {
        this.selectAt(worldPos.x, worldPos.y, entities, player, mouseX, mouseY);
        if (this.selectedEntity) {
          this.isDraggingEntity = true;
          this.dragOffset = {
            x: worldPos.x - this.selectedEntity.x,
            y: worldPos.y - this.selectedEntity.y
          };
        }
      }
    }
  }

  isPointInside(x, y, entity) {
    return (
      x >= entity.x &&
      x <= entity.x + entity.width &&
      y >= entity.y &&
      y <= entity.y + entity.height
    );
  }

  handleMouseMove(e, entities, player) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (this.isPanning) {
      const dx = this.panStart.x - mouseX;
      const dy = this.panStart.y - mouseY;
      this.camera.pan(dx, dy);
      this.panStart = { x: mouseX, y: mouseY };
      if (this.selectedEntity) {
        this.notifyEntitySelected(this.selectedEntity);
      }
      return;
    }

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    this.hoverGrid.x = Math.floor(worldPos.x / this.tileSize) * this.tileSize;
    this.hoverGrid.y = Math.floor(worldPos.y / this.tileSize) * this.tileSize;

    // Drag-moving selected entity
    if (this.isMouseDown && this.isDraggingEntity && this.selectedEntity) {
      const newX = Math.round((worldPos.x - this.dragOffset.x) / this.tileSize) * this.tileSize;
      const newY = Math.round((worldPos.y - this.dragOffset.y) / this.tileSize) * this.tileSize;

      if (this.selectedEntity.type === 'player') {
        player.setSpawn(newX, newY);
      } else {
        this.selectedEntity.x = newX;
        this.selectedEntity.y = newY;
        if (this.selectedEntity.startX !== undefined) {
          this.selectedEntity.startX = newX;
          this.selectedEntity.startY = newY;
        }
      }
      this.notifyEntitySelected(this.selectedEntity);
      return;
    }

    if (this.isMouseDown) {
      if (this.currentTool === 'place' && this.selectedPaletteItem === 'crate') {
        // Continuous brush painting for solid blocks
        this.placeAt(this.hoverGrid.x, this.hoverGrid.y, entities, player);
      } else if (this.currentTool === 'erase') {
        this.eraseAt(this.hoverGrid.x, this.hoverGrid.y, entities);
      }
    }
  }

  handleMouseUp() {
    this.isMouseDown = false;
    this.isPanning = false;
    if (this.isDraggingEntity) {
      this.isDraggingEntity = false;
      if (this.onEntityMoved) this.onEntityMoved();
    }
    this.updateCursor();
  }

  placeAt(x, y, entities, player) {
    // Avoid duplicate stacking in exact same grid coordinate
    const existing = entities.find(ent => ent.x === x && ent.y === y && ent.type !== 'player');
    if (existing) return;

    let newEnt = null;
    switch (this.selectedPaletteItem) {
      case 'player':
        player.setSpawn(x, y);
        sounds.playClick();
        return;
      case 'crate':
        newEnt = new CrateBlock(x, y, this.tileSize, this.tileSize);
        break;
      case 'springboard':
        newEnt = new Springboard(x, y, this.tileSize, this.tileSize);
        break;
      case 'hazard':
        newEnt = new HazardSpikes(x, y, this.tileSize, this.tileSize);
        break;
      case 'enemy':
        newEnt = new EnemyWalker(x, y, this.tileSize, this.tileSize);
        break;
      case 'moving_platform':
        newEnt = new MovingPlatform(x, y, this.tileSize * 2, 24);
        break;
      case 'collectible':
        newEnt = new Collectible(x + 4, y + 4, 32, 32);
        break;
      case 'goal':
        newEnt = new GoalFlag(x, y - 40, 48, 80);
        break;
    }

    if (newEnt) {
      entities.push(newEnt);
      sounds.playLand();
      if (this.onEntityMoved) this.onEntityMoved();
    }
  }

  eraseAt(x, y, entities) {
    const idx = entities.findIndex(ent => {
      return (
        x < ent.x + ent.width &&
        x + this.tileSize > ent.x &&
        y < ent.y + ent.height &&
        y + this.tileSize > ent.y &&
        ent.type !== 'player'
      );
    });

    if (idx !== -1) {
      entities.splice(idx, 1);
      sounds.playPaintSquish();
      if (this.selectedEntity === entities[idx]) {
        this.selectedEntity = null;
        if (this.onDeselect) this.onDeselect();
      }
      if (this.onEntityMoved) this.onEntityMoved();
    }
  }

  selectAt(worldX, worldY, entities, player, screenX, screenY) {
    // Check player first
    if (this.isPointInside(worldX, worldY, player)) {
      this.selectedEntity = player;
      this.notifyEntitySelected(player);
      sounds.playClick();
      return;
    }

    // Check other entities in reverse order (topmost first)
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];
      if (this.isPointInside(worldX, worldY, ent)) {
        this.selectedEntity = ent;
        this.notifyEntitySelected(ent);
        sounds.playClick();
        return;
      }
    }

    // Clicked empty space: deselect
    this.selectedEntity = null;
    if (this.onDeselect) this.onDeselect();
  }

  // Draw Grid Lines and Hover Ghost in Edit Mode
  draw(ctx) {
    // 1. Grid Lines
    ctx.save();
    ctx.strokeStyle = 'rgba(18, 18, 18, 0.08)';
    ctx.lineWidth = 1;

    const startX = Math.floor(this.camera.x / this.tileSize) * this.tileSize;
    const endX = this.camera.x + this.camera.viewportWidth;
    const startY = Math.floor(this.camera.y / this.tileSize) * this.tileSize;
    const endY = this.camera.y + this.camera.viewportHeight;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += this.tileSize) {
      const sx = x - this.camera.x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.camera.viewportHeight);
    }
    for (let y = startY; y <= endY; y += this.tileSize) {
      const sy = y - this.camera.y;
      ctx.moveTo(0, sy);
      ctx.lineTo(this.camera.viewportWidth, sy);
    }
    ctx.stroke();

    // 2. Hover Ghost Preview
    if (this.currentTool === 'place') {
      const ghostScreen = this.camera.worldToScreen(this.hoverGrid.x, this.hoverGrid.y);
      ctx.save();
      ctx.translate(ghostScreen.x, ghostScreen.y);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(0, 0, this.tileSize, this.tileSize);
      ctx.strokeRect(0, 0, this.tileSize, this.tileSize);
      ctx.restore();
    } else if (this.currentTool === 'erase') {
      const ghostScreen = this.camera.worldToScreen(this.hoverGrid.x, this.hoverGrid.y);
      ctx.save();
      ctx.translate(ghostScreen.x, ghostScreen.y);
      ctx.fillStyle = 'rgba(255, 59, 48, 0.25)';
      ctx.strokeStyle = '#FF3B30';
      ctx.lineWidth = 2;
      ctx.fillRect(0, 0, this.tileSize, this.tileSize);
      ctx.strokeRect(0, 0, this.tileSize, this.tileSize);
      ctx.restore();
    }

    // 3. Selection Box on Selected Entity with Animated Pulse
    if (this.selectedEntity) {
      const entScreen = this.camera.worldToScreen(this.selectedEntity.x, this.selectedEntity.y);
      ctx.save();
      ctx.translate(entScreen.x, entScreen.y);
      ctx.strokeStyle = '#00E5FF'; // Cyber cyan
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-4, -4, this.selectedEntity.width + 8, this.selectedEntity.height + 8);

      // Corner handles
      ctx.fillStyle = '#FFE600';
      ctx.setLineDash([]);
      const s = 6;
      ctx.fillRect(-6, -6, s, s);
      ctx.fillRect(this.selectedEntity.width, -6, s, s);
      ctx.fillRect(-6, this.selectedEntity.height, s, s);
      ctx.fillRect(this.selectedEntity.width, this.selectedEntity.height, s, s);
      ctx.restore();
    }

    ctx.restore();
  }
}
