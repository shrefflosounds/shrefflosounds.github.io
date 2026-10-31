// Sidehop Snap-to-Grid Level Editor & Enhanced Interaction System

import { CrateBlock, SolidBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js?v=20261031_134910';
import { sounds } from '../audio/sound.js?v=20261031_134910';

export class GridEditor {
  constructor(canvas, camera, tileSize = 40) {
    this.canvas = canvas;
    this.camera = camera;
    this.tileSize = tileSize;
    this.currentTool = 'select'; // Default is now SELECT per user request
    this.previousTool = 'select';
    this.selectedPaletteItem = 'block';
    this.selectedPaletteVariant = 'solid'; // Variant support (e.g. mystery, cloud, ice)
    this.hoverGrid = { x: 0, y: 0 };
    this.cursorGrid = { x: 120, y: 360 }; // Keyboard building placement spot
    this.isMouseOverCanvas = false;
    this.isMouseDown = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isSpacePan = false;

    // Multi-Selection & Marquee Box Selection State
    this.selectedEntities = [];
    this.isBoxSelecting = false;
    this.boxStart = { x: 0, y: 0 };
    this.boxCurrent = { x: 0, y: 0 };
    this.dragStartWorld = { x: 0, y: 0 };
    this.groupDragOffsets = [];
    this.initialBoxSelection = [];
    this.boxModifier = null;
    this.hoveredEntity = null;
    this.hoveredRemoveBadgeEntity = null;
    this.lastClickedEntity = null;

    // Drag-to-move entity in Select mode
    this.isDraggingEntity = false;
    this.dragOffset = { x: 0, y: 0 };
    this.didDragMove = false;

    // Callbacks for UI & History
    this.onSelectEntity = null; // (entity, screenPos) => {}
    this.onDeselect = null;
    this.onEntityMoved = null;
    this.onHistorySnapshotNeeded = null;

    this.bindCanvasEvents();
  }

  get selectedEntity() {
    return this.selectedEntities.length > 0 ? this.selectedEntities[this.selectedEntities.length - 1] : null;
  }

  set selectedEntity(ent) {
    if (!ent) {
      this.selectedEntities = [];
    } else {
      if (!this.selectedEntities.includes(ent)) {
        this.selectedEntities = [ent];
      }
    }
  }

  deselectEntity(entity) {
    if (!entity) return;
    const idx = this.selectedEntities.indexOf(entity);
    if (idx !== -1) {
      this.selectedEntities.splice(idx, 1);
      sounds.playClick();
      if (this.selectedEntities.length > 0) {
        this.notifyEntitySelected(this.selectedEntity);
      } else {
        if (this.onDeselect) this.onDeselect();
      }
    }
  }

  checkRemoveBadgeClicked(worldX, worldY) {
    if (this.selectedEntities.length <= 1) return null;
    for (const ent of this.selectedEntities) {
      const bx = ent.x + ent.width;
      const by = ent.y;
      if (Math.hypot(worldX - bx, worldY - by) <= 12) {
        return ent;
      }
    }
    return null;
  }

  setPaletteItem(item, variant = null) {
    this.selectedPaletteItem = item;
    if (variant) {
      this.selectedPaletteVariant = variant;
    } else {
      // Default variant for this item
      if (item === 'block' || item === 'crate') this.selectedPaletteVariant = 'solid';
      else if (item === 'enemy') this.selectedPaletteVariant = 'walker';
      else if (item === 'collectible') this.selectedPaletteVariant = 'coin';
      else if (item === 'springboard') this.selectedPaletteVariant = 'spring';
    }
    this.currentTool = 'place';
    this.updateCursor();
    sounds.playClick();
  }

  setPaletteVariant(variant) {
    this.selectedPaletteVariant = variant;
    this.currentTool = 'place';
    this.updateCursor();
    sounds.playClick();
  }

  setTool(tool) {
    this.currentTool = tool;
    this.updateCursor();
    sounds.playClick();
  }

  updateCursor(e) {
    if (this.isPanning || (this.isMouseDown && this.currentTool === 'pan')) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.currentTool === 'pan' || this.isSpacePan) {
      this.canvas.style.cursor = 'grab';
    } else if (this.hoveredRemoveBadgeEntity) {
      this.canvas.style.cursor = 'pointer';
    } else if (this.hoveredEntity && this.selectedEntities.includes(this.hoveredEntity) && (e?.shiftKey || e?.altKey || e?.ctrlKey || e?.metaKey)) {
      this.canvas.style.cursor = 'pointer';
    } else if (this.currentTool === 'boxselect' || this.isBoxSelecting) {
      this.canvas.style.cursor = 'crosshair';
    } else if (this.currentTool === 'erase') {
      this.canvas.style.cursor = 'crosshair';
    } else if (this.currentTool === 'select') {
      this.canvas.style.cursor = this.hoveredEntity ? 'pointer' : 'default';
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

    this.canvas.addEventListener('mouseenter', () => {
      this.isMouseOverCanvas = true;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isMouseOverCanvas = false;
    });
  }

  notifyEntitySelected(entity) {
    if (!entity && this.selectedEntities.length === 0) return;
    const target = entity || this.selectedEntity;
    if (!target) return;

    // If multiple entities are selected, calculate screen center of entire group
    let screenCenter;
    if (this.selectedEntities.length > 1) {
      const minX = Math.min(...this.selectedEntities.map(e => e.x));
      const maxX = Math.max(...this.selectedEntities.map(e => e.x + e.width));
      const minY = Math.min(...this.selectedEntities.map(e => e.y));
      screenCenter = this.camera.worldToScreen((minX + maxX) / 2, minY);
    } else {
      screenCenter = this.camera.worldToScreen(target.x + target.width / 2, target.y);
    }

    if (this.onSelectEntity) {
      this.onSelectEntity(target, screenCenter);
    }
  }

  handleMouseDown(e, entities, player) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    const clickedEntity = this.findEntityAt(worldPos.x, worldPos.y, entities, player);
    const hasModifier = Boolean(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey);

    // Pan with Middle-click, Pan Tool, Spacebar held, or Alt-click on empty canvas
    if (e.button === 1 || this.currentTool === 'pan' || this.isSpacePan || (e.altKey && !clickedEntity)) {
      this.isPanning = true;
      this.panStart = { x: mouseX, y: mouseY };
      this.updateCursor(e);
      return;
    }

    // Right-click: reserved for Context Menu (handled via contextmenu event)
    if (e.button === 2) {
      return;
    }

    this.isMouseDown = true;
    const gridX = Math.floor(worldPos.x / this.tileSize) * this.tileSize;
    const gridY = Math.floor(worldPos.y / this.tileSize) * this.tileSize;

    // Align keyboard placement spot to clicked cell
    this.cursorGrid.x = gridX;
    this.cursorGrid.y = gridY;

    if (this.currentTool === 'erase') {
      this.eraseAt(gridX, gridY, entities);
    } else if (this.currentTool === 'place') {
      this.placeAt(gridX, gridY, entities, player);
    } else if (this.currentTool === 'select' || this.currentTool === 'boxselect') {
      // 1. Direct click on individual entity's "✕" remove badge in a multi-selection
      const badgeEntity = this.checkRemoveBadgeClicked(worldPos.x, worldPos.y);
      if (badgeEntity) {
        this.deselectEntity(badgeEntity);
        return;
      }

      // 2. Modifier-click (Shift, Cmd, Ctrl, Alt) on an entity:
      // Toggles inclusion — immediately deselects it from group without deselecting others!
      if (clickedEntity && hasModifier) {
        const idx = this.selectedEntities.indexOf(clickedEntity);
        if (idx !== -1) {
          this.deselectEntity(clickedEntity);
        } else {
          this.selectedEntities.push(clickedEntity);
          this.notifyEntitySelected(this.selectedEntity);
          sounds.playClick();
        }
        return;
      }

      // 3. Marquee Box Selection mode
      // Activated in 'boxselect' tool, OR in 'select' tool when dragging empty space with modifier
      if (this.currentTool === 'boxselect' || (this.currentTool === 'select' && hasModifier && !clickedEntity)) {
        this.isBoxSelecting = true;
        this.boxStart = { x: worldPos.x, y: worldPos.y };
        this.boxCurrent = { x: worldPos.x, y: worldPos.y };
        this.initialBoxSelection = [...this.selectedEntities];
        this.boxModifier = {
          shift: Boolean(e.shiftKey),
          ctrl: Boolean(e.ctrlKey || e.metaKey),
          alt: Boolean(e.altKey)
        };
        if (!hasModifier) {
          this.selectedEntities = [];
        }
        this.updateCursor(e);
        return;
      }

      // 4. In 'select' tool without modifier keys:
      if (clickedEntity) {
        this.lastClickedEntity = clickedEntity;
        if (this.selectedEntities.includes(clickedEntity)) {
          // Drag the group together if mouse moves
          this.isDraggingEntity = true;
          this.didDragMove = false;
          this.dragStartWorld = { x: worldPos.x, y: worldPos.y };
          this.groupDragOffsets = this.selectedEntities.map(ent => ({
            entity: ent,
            origX: ent.x,
            origY: ent.y
          }));
          this.notifyEntitySelected(clickedEntity);
        } else {
          // Single select this clicked entity
          this.selectedEntities = [clickedEntity];
          this.isDraggingEntity = true;
          this.didDragMove = false;
          this.dragStartWorld = { x: worldPos.x, y: worldPos.y };
          this.groupDragOffsets = [{
            entity: clickedEntity,
            origX: clickedEntity.x,
            origY: clickedEntity.y
          }];
          this.notifyEntitySelected(clickedEntity);
          sounds.playClick();
        }
      } else {
        // Left-click on empty space: pan the stage and deselect
        this.isPanning = true;
        this.panStart = { x: mouseX, y: mouseY };
        this.didDragMove = false;
        if (this.selectedEntities.length > 0) {
          this.selectedEntities = [];
          if (this.onDeselect) this.onDeselect();
        }
        this.updateCursor(e);
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

  findEntityAt(x, y, entities, player) {
    if (player && this.isPointInside(x, y, player)) {
      return player;
    }
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];
      if (this.isPointInside(x, y, ent)) {
        return ent;
      }
    }
    return null;
  }

  handleMouseMove(e, entities, player) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

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

    this.hoveredEntity = this.findEntityAt(worldPos.x, worldPos.y, entities, player);
    this.hoveredRemoveBadgeEntity = this.checkRemoveBadgeClicked(worldPos.x, worldPos.y);
    this.updateCursor(e);

    // Sync keyboard building placement spot if mouse moves without panning or dragging
    if (!this.isPanning && !this.isDraggingEntity && !this.isMouseDown && !this.isBoxSelecting) {
      this.cursorGrid.x = this.hoverGrid.x;
      this.cursorGrid.y = this.hoverGrid.y;
    }

    // Updating Marquee Selection Box
    if (this.isBoxSelecting) {
      this.boxCurrent = { x: worldPos.x, y: worldPos.y };
      const minX = Math.min(this.boxStart.x, this.boxCurrent.x);
      const maxX = Math.max(this.boxStart.x, this.boxCurrent.x);
      const minY = Math.min(this.boxStart.y, this.boxCurrent.y);
      const maxY = Math.max(this.boxStart.y, this.boxCurrent.y);

      const inBox = entities.filter(ent => {
        return (
          ent.x < maxX &&
          ent.x + ent.width > minX &&
          ent.y < maxY &&
          ent.y + ent.height > minY
        );
      });
      if (player && player.x < maxX && player.x + player.width > minX && player.y < maxY && player.y + player.height > minY) {
        inBox.push(player);
      }

      if (this.boxModifier && this.boxModifier.alt) {
        // Alt-drag = Subtract from current selection!
        const boxSet = new Set(inBox);
        this.selectedEntities = (this.initialBoxSelection || []).filter(item => !boxSet.has(item));
      } else if (this.boxModifier && (this.boxModifier.shift || this.boxModifier.ctrl)) {
        // Shift/Ctrl-drag = Union / Add to selection!
        const combined = new Set([...(this.initialBoxSelection || []), ...inBox]);
        this.selectedEntities = Array.from(combined);
      } else {
        this.selectedEntities = inBox;
      }

      if (this.selectedEntities.length > 0) {
        this.notifyEntitySelected(this.selectedEntity);
      } else {
        if (this.onDeselect) this.onDeselect();
      }
      return;
    }

    // Drag-moving selected entity / multi-selection group
    if (this.isMouseDown && this.isDraggingEntity && this.selectedEntities.length > 0) {
      this.didDragMove = true;
      const deltaX = Math.round((worldPos.x - this.dragStartWorld.x) / this.tileSize) * this.tileSize;
      const deltaY = Math.round((worldPos.y - this.dragStartWorld.y) / this.tileSize) * this.tileSize;

      for (const item of this.groupDragOffsets) {
        const ent = item.entity;
        // Snap to grid increments (40px, or 20px for slab heights)
        const isSlab = ent.variant === 'slab';
        const targetX = Math.round((item.origX + deltaX) / this.tileSize) * this.tileSize;
        const targetY = isSlab
          ? Math.round((item.origY + deltaY) / 20) * 20
          : Math.round((item.origY + deltaY) / this.tileSize) * this.tileSize;

        if (ent.type === 'player') {
          player.setSpawn(targetX, targetY);
        } else {
          ent.x = targetX;
          ent.y = targetY;
          if (ent.startX !== undefined) {
            ent.startX = targetX;
            ent.startY = targetY;
          }
        }
      }
      this.notifyEntitySelected(this.selectedEntity);
      return;
    }

    if (this.isMouseDown) {
      if (
        this.currentTool === 'place' &&
        (this.selectedPaletteItem === 'crate' ||
          this.selectedPaletteItem === 'block' ||
          this.selectedPaletteItem === 'hazard' ||
          this.selectedPaletteItem === 'collectible')
      ) {
        // Continuous brush painting for blocks, spikes, and collectibles
        this.placeAt(this.hoverGrid.x, this.hoverGrid.y, entities, player);
      } else if (this.currentTool === 'erase') {
        this.eraseAt(this.hoverGrid.x, this.hoverGrid.y, entities);
      }
    }
  }

  handleMouseUp() {
    this.isMouseDown = false;
    this.isPanning = false;

    if (this.isBoxSelecting) {
      this.isBoxSelecting = false;
      if (this.selectedEntities.length > 0) {
        sounds.playCollect();
        this.notifyEntitySelected(this.selectedEntity);
      }
    }

    if (this.isDraggingEntity) {
      this.isDraggingEntity = false;
      if (this.didDragMove) {
        this.didDragMove = false;
        if (this.onHistorySnapshotNeeded) this.onHistorySnapshotNeeded();
      }
      if (this.onEntityMoved) this.onEntityMoved();
    }
    this.updateCursor();
  }

  placeAt(x, y, entities, player) {
    if (this.selectedPaletteItem === 'player') {
      player.setSpawn(x, y);
      sounds.playClick();
      if (this.onHistorySnapshotNeeded) this.onHistorySnapshotNeeded();
      return;
    }

    let w = this.tileSize;
    let h = this.tileSize;
    if (this.selectedPaletteItem === 'block' || this.selectedPaletteItem === 'crate') {
      if (this.selectedPaletteVariant === 'mega') { w = 80; h = 80; }
      else if (this.selectedPaletteVariant === 'slab') { w = 40; h = 20; }
      else if (this.selectedPaletteVariant === 'pipe') { w = 40; h = 80; }
    } else if (this.selectedPaletteItem === 'moving_platform') {
      w = this.tileSize * 2; h = 24;
    } else if (this.selectedPaletteItem === 'goal') {
      w = 48; h = 80;
    }

    // Avoid duplicate stacking or overlapping in the target footprint
    const existing = entities.find(ent => {
      if (ent.type === 'player') return false;
      return (
        x < ent.x + ent.width &&
        x + w > ent.x &&
        y < ent.y + ent.height &&
        y + h > ent.y
      );
    });
    if (existing) return;

    let newEnt = null;
    switch (this.selectedPaletteItem) {
      case 'block':
      case 'crate':
        newEnt = new CrateBlock(x, y, w, h, this.selectedPaletteVariant || 'solid');
        break;
      case 'springboard':
        newEnt = new Springboard(x, y, this.tileSize, this.tileSize, this.selectedPaletteVariant || 'spring');
        break;
      case 'hazard':
        newEnt = new HazardSpikes(x, y, this.tileSize, this.tileSize);
        break;
      case 'enemy':
        newEnt = new EnemyWalker(x, y, this.tileSize, this.tileSize, this.selectedPaletteVariant || 'walker');
        break;
      case 'moving_platform':
        newEnt = new MovingPlatform(x, y, this.tileSize * 2, 24);
        break;
      case 'collectible':
        newEnt = new Collectible(x + 4, y + 4, 32, 32, this.selectedPaletteVariant || 'coin');
        break;
      case 'goal':
        newEnt = new GoalFlag(x, y - 40, 48, 80);
        break;
    }

    if (newEnt) {
      entities.push(newEnt);
      if (SolidBlock.updateTerrainMap) SolidBlock.updateTerrainMap(entities);
      sounds.playLand();
      if (this.onEntityMoved) this.onEntityMoved();
      if (this.onHistorySnapshotNeeded) this.onHistorySnapshotNeeded();
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
      const removed = entities[idx];
      entities.splice(idx, 1);
      if (SolidBlock.updateTerrainMap) SolidBlock.updateTerrainMap(entities);
      sounds.playPaintSquish();
      if (this.selectedEntities && this.selectedEntities.includes(removed)) {
        this.selectedEntities = this.selectedEntities.filter(e => e !== removed);
        if (this.selectedEntities.length === 0 && this.onDeselect) {
          this.onDeselect();
        }
      }
      if (this.onEntityMoved) this.onEntityMoved();
      if (this.onHistorySnapshotNeeded) this.onHistorySnapshotNeeded();
    }
  }

  selectAt(worldX, worldY, entities, player) {
    const clicked = this.findEntityAt(worldX, worldY, entities, player);
    if (clicked) {
      this.selectedEntity = clicked;
      this.notifyEntitySelected(clicked);
      sounds.playClick();
    } else {
      this.selectedEntity = null;
      if (this.onDeselect) this.onDeselect();
    }
  }

  // Draw Grid Lines, Hover Ghost, and Keyboard Placement Cursor in Edit Mode
  draw(ctx) {
    // 1. Theme-Aware Minor & Major Grid Lines (40px minor, 200px major)
    ctx.save();
    const theme = (typeof document !== 'undefined' && document.body)
      ? (document.body.getAttribute('data-theme') || 'default')
      : 'default';
    const isLightBg = (theme === 'default' || theme === 'snowy' || theme === 'chrome');
    const minorColor = isLightBg ? 'rgba(18, 18, 18, 0.08)' : 'rgba(255, 255, 255, 0.10)';
    const majorColor = isLightBg ? 'rgba(18, 18, 18, 0.18)' : 'rgba(255, 255, 255, 0.22)';

    const startX = Math.floor(this.camera.x / this.tileSize) * this.tileSize;
    const endX = this.camera.x + this.camera.viewportWidth;
    const startY = Math.floor(this.camera.y / this.tileSize) * this.tileSize;
    const endY = this.camera.y + this.camera.viewportHeight;

    // Minor 40px grid
    ctx.strokeStyle = minorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += this.tileSize) {
      if (x % (this.tileSize * 5) === 0) continue;
      const sx = Math.round(x - this.camera.x) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.camera.viewportHeight);
    }
    for (let y = startY; y <= endY; y += this.tileSize) {
      if (y % (this.tileSize * 5) === 0) continue;
      const sy = Math.round(y - this.camera.y) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(this.camera.viewportWidth, sy);
    }
    ctx.stroke();

    // Major 200px (5-tile) architectural grid
    ctx.strokeStyle = majorColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += this.tileSize) {
      if (x % (this.tileSize * 5) !== 0) continue;
      const sx = Math.round(x - this.camera.x) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.camera.viewportHeight);
    }
    for (let y = startY; y <= endY; y += this.tileSize) {
      if (y % (this.tileSize * 5) !== 0) continue;
      const sy = Math.round(y - this.camera.y) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(this.camera.viewportWidth, sy);
    }
    ctx.stroke();

    // 2. Hover Ghost Preview
    if (this.currentTool === 'place') {
      let gx = this.hoverGrid.x;
      let gy = this.hoverGrid.y;
      let gw = this.tileSize;
      let gh = this.tileSize;
      if (this.selectedPaletteItem === 'block' || this.selectedPaletteItem === 'crate') {
        if (this.selectedPaletteVariant === 'mega') { gw = 80; gh = 80; }
        else if (this.selectedPaletteVariant === 'slab') { gw = 40; gh = 20; }
        else if (this.selectedPaletteVariant === 'pipe') { gw = 40; gh = 80; }
      } else if (this.selectedPaletteItem === 'moving_platform') {
        gw = this.tileSize * 2;
        gh = 24;
      } else if (this.selectedPaletteItem === 'goal') {
        gw = 48;
        gh = 80;
        gy -= 40;
      } else if (this.selectedPaletteItem === 'collectible') {
        gx += 4;
        gy += 4;
        gw = 32;
        gh = 32;
      }
      const ghostScreen = this.camera.worldToScreen(gx, gy);
      ctx.save();
      ctx.translate(ghostScreen.x, ghostScreen.y);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      const v = this.selectedPaletteVariant || '';
      if (v.includes('slope_ceil_up')) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(gw, 0);
        ctx.lineTo(0, gh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (v.includes('slope_ceil_down')) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(gw, 0);
        ctx.lineTo(gw, gh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (v.includes('slope_up')) {
        ctx.beginPath();
        ctx.moveTo(0, gh);
        ctx.lineTo(gw, 0);
        ctx.lineTo(gw, gh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (v.includes('slope_down')) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(gw, gh);
        ctx.lineTo(0, gh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(0, 0, gw, gh);
        ctx.strokeRect(0, 0, gw, gh);
      }
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

    // 3. Selection Boxes on Selected Entities with Multi-Selection & Group Frame
    if (this.selectedEntities.length > 0) {
      // Individual component outlines
      for (const ent of this.selectedEntities) {
        const entScreen = this.camera.worldToScreen(ent.x, ent.y);
        const isHovered = (this.hoveredEntity === ent || this.hoveredRemoveBadgeEntity === ent);
        ctx.save();
        ctx.translate(entScreen.x, entScreen.y);
        ctx.strokeStyle = (isHovered && this.selectedEntities.length > 1) ? '#FF5252' : '#00E5FF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(-3, -3, ent.width + 6, ent.height + 6);

        // Corner handles
        ctx.fillStyle = '#FFE600';
        ctx.setLineDash([]);
        const s = 5;
        ctx.fillRect(-5, -5, s, s);
        ctx.fillRect(-5, ent.height, s, s);
        ctx.fillRect(ent.width, ent.height, s, s);

        // If part of multi-selection, render a clickable "✕" deselect badge at top-right
        if (this.selectedEntities.length > 1) {
          const isBadgeHovered = (this.hoveredRemoveBadgeEntity === ent);
          ctx.beginPath();
          ctx.arc(ent.width, 0, 7.5, 0, Math.PI * 2);
          ctx.fillStyle = isBadgeHovered ? '#FF3B30' : (isHovered ? '#FF9800' : '#FFE600');
          ctx.fill();
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = isBadgeHovered ? '#FFFFFF' : '#121212';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕', ent.width, 0);
        } else {
          ctx.fillRect(ent.width, -5, s, s);
        }

        ctx.restore();
      }

      // Group bounding box if multiple items selected
      if (this.selectedEntities.length > 1) {
        const minX = Math.min(...this.selectedEntities.map(e => e.x));
        const maxX = Math.max(...this.selectedEntities.map(e => e.x + e.width));
        const minY = Math.min(...this.selectedEntities.map(e => e.y));
        const maxY = Math.max(...this.selectedEntities.map(e => e.y + e.height));
        const groupScreen = this.camera.worldToScreen(minX, minY);
        const gw = maxX - minX;
        const gh = maxY - minY;

        ctx.save();
        ctx.translate(groupScreen.x, groupScreen.y);
        ctx.strokeStyle = '#FFE600'; // Canary yellow group border
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(-6, -6, gw + 12, gh + 12);

        // Group badge pill at top-left
        ctx.setLineDash([]);
        ctx.fillStyle = '#FFE600';
        ctx.fillRect(-6, -24, 115, 18);
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2;
        ctx.strokeRect(-6, -24, 115, 18);
        ctx.font = '800 11px "Fredoka", sans-serif';
        ctx.fillStyle = '#121212';
        ctx.fillText(`📦 ${this.selectedEntities.length} SELECTED`, 0, -10);

        ctx.restore();
      }
    }

    // 4. Marquee Drag-Selection Box
    if (this.isBoxSelecting) {
      const minX = Math.min(this.boxStart.x, this.boxCurrent.x);
      const maxX = Math.max(this.boxStart.x, this.boxCurrent.x);
      const minY = Math.min(this.boxStart.y, this.boxCurrent.y);
      const maxY = Math.max(this.boxStart.y, this.boxCurrent.y);
      const boxScreen = this.camera.worldToScreen(minX, minY);
      const bw = maxX - minX;
      const bh = maxY - minY;

      ctx.save();
      ctx.translate(boxScreen.x, boxScreen.y);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.fillRect(0, 0, bw, bh);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(0, 0, bw, bh);

      // Pill badge with count
      if (this.selectedEntities.length > 0) {
        ctx.setLineDash([]);
        ctx.fillStyle = '#FFE600';
        ctx.fillRect(4, 4, 85, 18);
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(4, 4, 85, 18);
        ctx.font = '800 10px "Fredoka", sans-serif';
        ctx.fillStyle = '#121212';
        ctx.fillText(`⬚ ${this.selectedEntities.length} ITEMS`, 10, 16);
      }
      ctx.restore();
    }

    // 4. Keyboard Building Placement Spot Cursor (at this.cursorGrid)
    const cursorScreen = this.camera.worldToScreen(this.cursorGrid.x, this.cursorGrid.y);
    if (
      cursorScreen.x + this.tileSize >= -20 &&
      cursorScreen.x <= this.camera.viewportWidth + 20 &&
      cursorScreen.y + this.tileSize >= -20 &&
      cursorScreen.y <= this.camera.viewportHeight + 20
    ) {
      ctx.save();
      ctx.translate(cursorScreen.x, cursorScreen.y);
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);

      // Neo-brutalist corner brackets [ ]
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      const arm = 9;
      const w = this.tileSize;
      const h = this.tileSize;

      ctx.beginPath();
      // Top-left
      ctx.moveTo(0, arm); ctx.lineTo(0, 0); ctx.lineTo(arm, 0);
      // Top-right
      ctx.moveTo(w - arm, 0); ctx.lineTo(w, 0); ctx.lineTo(w, arm);
      // Bottom-left
      ctx.moveTo(0, h - arm); ctx.lineTo(0, h); ctx.lineTo(arm, h);
      // Bottom-right
      ctx.moveTo(w - arm, h); ctx.lineTo(w, h); ctx.lineTo(w, h - arm);
      ctx.stroke();

      // Subtle center dot indicator
      ctx.fillStyle = `rgba(255, 230, 0, ${0.35 + 0.35 * pulse})`;
      ctx.fillRect(w / 2 - 2, h / 2 - 2, 4, 4);

      ctx.restore();
    }

    ctx.restore();
  }
}
