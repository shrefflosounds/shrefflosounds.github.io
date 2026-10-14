// Sidehop Snap-to-Grid Level Editor & Interaction System

import { CrateBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';
import { sounds } from '../audio/sound.js';

export class GridEditor {
  constructor(canvas, camera, tileSize = 40) {
    this.canvas = canvas;
    this.camera = camera;
    this.tileSize = tileSize;
    this.currentTool = 'place'; // 'place', 'select', 'erase', 'pan'
    this.selectedPaletteItem = 'crate'; // 'crate', 'springboard', 'hazard', 'enemy', 'moving_platform', 'collectible', 'goal'
    this.hoverGrid = { x: 0, y: 0 };
    this.isMouseDown = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.selectedEntity = null;

    // Callbacks for UI
    this.onSelectEntity = null; // (entity, screenPos) => {}
    this.onDeselect = null;
  }

  setPaletteItem(item) {
    this.selectedPaletteItem = item;
    this.currentTool = 'place';
    sounds.playClick();
  }

  setTool(tool) {
    this.currentTool = tool;
    sounds.playClick();
  }

  handleMouseDown(e, entities, player) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Right-click or middle-click or Alt-click pans
    if (e.button === 1 || e.button === 2 || e.altKey) {
      this.isPanning = true;
      this.panStart = { x: mouseX, y: mouseY };
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
      this.selectAt(worldPos.x, worldPos.y, entities, player, mouseX, mouseY);
    }
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
      return;
    }

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    this.hoverGrid.x = Math.floor(worldPos.x / this.tileSize) * this.tileSize;
    this.hoverGrid.y = Math.floor(worldPos.y / this.tileSize) * this.tileSize;

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
      if (this.onDeselect) this.onDeselect();
    }
  }

  selectAt(worldX, worldY, entities, player, screenX, screenY) {
    // Check player first
    if (
      worldX >= player.x && worldX <= player.x + player.width &&
      worldY >= player.y && worldY <= player.y + player.height
    ) {
      this.selectedEntity = player;
      if (this.onSelectEntity) this.onSelectEntity(player, { x: screenX, y: screenY });
      sounds.playClick();
      return;
    }

    // Check other entities in reverse order (topmost first)
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];
      if (
        worldX >= ent.x && worldX <= ent.x + ent.width &&
        worldY >= ent.y && worldY <= ent.y + ent.height
      ) {
        this.selectedEntity = ent;
        if (this.onSelectEntity) this.onSelectEntity(ent, { x: screenX, y: screenY });
        sounds.playClick();
        return;
      }
    }

    // Clicked empty space
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

    // 3. Selection Box on Selected Entity
    if (this.selectedEntity) {
      const entScreen = this.camera.worldToScreen(this.selectedEntity.x, this.selectedEntity.y);
      ctx.save();
      ctx.translate(entScreen.x, entScreen.y);
      ctx.strokeStyle = '#FFE600'; // Canary Pop Yellow outline
      ctx.lineWidth = 3;
      ctx.strokeRect(-4, -4, this.selectedEntity.width + 8, this.selectedEntity.height + 8);
      ctx.restore();
    }

    ctx.restore();
  }
}
