// Sidehop Master Application Coordinator — Enhanced Custom Backgrounds, Asset Library & Undo/Redo

import { Player } from './engine/entities.js';
import { PhysicsEngine } from './engine/physics.js';
import { Camera } from './engine/camera.js';
import { GridEditor } from './editor/grid.js';
import { ArtStudio } from './editor/paint.js';
import { Inspector } from './editor/inspector.js';
import { VideoRecorder } from './recorder/recorder.js';
import { LevelStorage } from './storage/storage.js';
import { HistoryManager } from './editor/history.js';
import { sounds } from './audio/sound.js';

class SidehopApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.mode = 'edit'; // 'edit' or 'play'

    this.physics = new PhysicsEngine(40);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.player = new Player(80, 400);
    this.entities = [];
    this.keys = {};
    this.score = 0;
    this.isLevelWon = false;

    // Background State
    this.background = {
      theme: 'sky', // 'sky', 'sunset', 'night', 'paper', 'mint', 'cyber', 'custom'
      customImage: null,
      customImageElement: null
    };

    // Subsystems
    this.editor = new GridEditor(this.canvas, this.camera, 40);
    this.artStudio = new ArtStudio(
      document.getElementById('art-studio-modal'),
      document.getElementById('paint-canvas')
    );
    this.inspector = new Inspector(document.getElementById('inspector-modal'));
    this.recorder = new VideoRecorder(this.canvas);
    this.history = new HistoryManager(50);

    // Component Flyout State & Stored Type Selections
    this.activeFlyoutItem = null;
    this.activeComponentVariants = {
      block: 'solid',
      springboard: 'spring',
      enemy: 'walker',
      collectible: 'star'
    };

    // Clipboard System for Copy/Paste/Cut/Duplicate
    this.clipboardEntity = null;
    this.clipboardGroup = [];

    // Context Menu State
    this.contextMenuGrid = null;

    // Stretched Frame Play Mode State
    this.isFrameStretched = false;

    // Track Spacebar tap vs hold
    this.spacePressTime = 0;
    this.didPanDuringSpace = false;

    // Confetti particles for victory
    this.confetti = [];

    this.lastTime = performance.now();

    // Wire History State Change to Header Undo/Redo Buttons
    this.history.onStateChange = (canUndo, canRedo) => {
      const uBtn = document.getElementById('undo-btn');
      const rBtn = document.getElementById('redo-btn');
      if (uBtn) uBtn.disabled = !canUndo;
      if (rBtn) rBtn.disabled = !canRedo;
    };

    // Auto-record snapshot on editor modifications
    this.editor.onHistorySnapshotNeeded = () => {
      this.history.pushState(this.player, this.entities, this.background);
    };

    this.initLevel();
    this.bindUI();
    this.bindEvents();

    // Initial snapshot for Undo stack
    this.history.pushState(this.player, this.entities, this.background);

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  // --- Quick Undo & Redo ---
  undo() {
    if (this.mode !== 'edit') return;
    const restored = this.history.undo(this.player, this.entities, (bg) => {
      if (bg) this.applyBackground(bg);
    });
    if (restored) {
      if (this.editor.selectedEntity) {
        this.editor.selectedEntity = null;
        const card = document.getElementById('entity-action-card');
        if (card) card.classList.remove('active');
      }
      LevelStorage.autoSave(this.player, this.entities, this.background);
      sounds.playClick();
      this.showToast('↩ Undo');
    }
  }

  redo() {
    if (this.mode !== 'edit') return;
    const restored = this.history.redo(this.player, this.entities, (bg) => {
      if (bg) this.applyBackground(bg);
    });
    if (restored) {
      if (this.editor.selectedEntity) {
        this.editor.selectedEntity = null;
        const card = document.getElementById('entity-action-card');
        if (card) card.classList.remove('active');
      }
      LevelStorage.autoSave(this.player, this.entities, this.background);
      sounds.playClick();
      this.showToast('↪ Redo');
    }
  }

  // --- Copy, Cut, Paste & Duplicate System ---
  copy() {
    if (this.mode !== 'edit') return;
    if (this.editor.selectedEntities.length > 1) {
      this.clipboardGroup = this.editor.selectedEntities.map(e => LevelStorage.serializeEntity(e));
      this.clipboardEntity = this.clipboardGroup[0];
      sounds.playClick();
      this.showToast(`📋 Copied ${this.clipboardGroup.length} components`);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(JSON.stringify({ sidehopGroup: this.clipboardGroup }));
        }
      } catch (_) {}
      return;
    }

    const target = this.editor.selectedEntity;
    if (!target) {
      this.showToast('Select a component to copy');
      return;
    }

    this.clipboardEntity = LevelStorage.serializeEntity(target);
    this.clipboardGroup = [this.clipboardEntity];
    sounds.playClick();

    const name = target.type === 'player'
      ? 'Spawn Point'
      : (target.variant ? `${target.variant} ${target.type}` : target.type);
    this.showToast(`📋 Copied ${name}`);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify({ sidehopEntity: this.clipboardEntity }));
      }
    } catch (_) {}
  }

  cut() {
    if (this.mode !== 'edit') return;
    if (this.editor.selectedEntities.length > 1) {
      this.copy();
      this.history.pushState(this.player, this.entities, this.background);
      let cutCount = 0;
      for (const target of [...this.editor.selectedEntities]) {
        if (target === this.player || target.type === 'player') continue;
        const idx = this.entities.indexOf(target);
        if (idx !== -1) {
          this.entities.splice(idx, 1);
          cutCount++;
        }
      }
      this.editor.selectedEntities = [];
      const card = document.getElementById('entity-action-card');
      if (card) card.classList.remove('active');
      sounds.playPaintSquish();
      LevelStorage.autoSave(this.player, this.entities, this.background);
      this.showToast(`✂️ Cut ${cutCount} components`);
      return;
    }

    const target = this.editor.selectedEntity;
    if (!target) {
      this.showToast('Select a component to cut');
      return;
    }

    if (target === this.player || target.type === 'player') {
      this.showToast('⚠️ Player spawn cannot be cut');
      return;
    }

    this.copy();

    const idx = this.entities.indexOf(target);
    if (idx !== -1) {
      this.history.pushState(this.player, this.entities, this.background);
      this.entities.splice(idx, 1);
      this.editor.selectedEntity = null;
      const card = document.getElementById('entity-action-card');
      if (card) card.classList.remove('active');
      sounds.playPaintSquish();
      LevelStorage.autoSave(this.player, this.entities, this.background);
      this.showToast(`✂️ Cut ${target.type}`);
    }
  }

  paste(customX = null, customY = null) {
    if (this.mode !== 'edit') return;
    if (!this.clipboardEntity && (!this.clipboardGroup || this.clipboardGroup.length === 0)) {
      this.showToast('Clipboard empty (Use ⌘C to copy)');
      return;
    }

    let pasteX = customX;
    let pasteY = customY;

    if (pasteX === null || pasteY === null) {
      if (this.editor.isMouseOverCanvas && this.editor.hoverGrid) {
        pasteX = this.editor.hoverGrid.x;
        pasteY = this.editor.hoverGrid.y;
      } else {
        pasteX = this.editor.cursorGrid.x;
        pasteY = this.editor.cursorGrid.y;
      }
    }

    // Align placement spot to pasted entity
    this.editor.cursorGrid.x = pasteX;
    this.editor.cursorGrid.y = pasteY;

    // Multi-entity group paste!
    if (this.clipboardGroup && this.clipboardGroup.length > 1) {
      this.history.pushState(this.player, this.entities, this.background);
      const minX = Math.min(...this.clipboardGroup.map(e => e.x));
      const minY = Math.min(...this.clipboardGroup.map(e => e.y));
      const newGroup = [];

      for (const item of this.clipboardGroup) {
        const targetX = pasteX + (item.x - minX);
        const targetY = pasteY + (item.y - minY);

        if (item.type === 'player') {
          this.player.setSpawn(targetX, targetY);
          newGroup.push(this.player);
        } else {
          const newEnt = LevelStorage.cloneEntity(item, targetX, targetY);
          if (newEnt) {
            this.entities.push(newEnt);
            newGroup.push(newEnt);
          }
        }
      }

      this.editor.selectedEntities = newGroup;
      this.updateActionCard(this.editor.selectedEntity);
      sounds.playLand();
      LevelStorage.autoSave(this.player, this.entities, this.background);
      this.showToast(`📋 Pasted ${newGroup.length} components`);
      return;
    }

    if (this.clipboardEntity.type === 'player') {
      this.history.pushState(this.player, this.entities, this.background);
      this.player.setSpawn(pasteX, pasteY);
      this.editor.selectedEntity = this.player;
      this.updateActionCard(this.player);
      sounds.playLand();
      LevelStorage.autoSave(this.player, this.entities, this.background);
      this.showToast('📋 Pasted Player Spawn');
      return;
    }

    const newEnt = LevelStorage.cloneEntity(this.clipboardEntity, pasteX, pasteY);
    if (!newEnt) return;

    this.history.pushState(this.player, this.entities, this.background);
    this.entities.push(newEnt);
    this.editor.selectedEntity = newEnt;
    this.updateActionCard(newEnt);

    sounds.playLand();
    LevelStorage.autoSave(this.player, this.entities, this.background);

    const name = newEnt.variant ? `${newEnt.variant} ${newEnt.type}` : newEnt.type;
    this.showToast(`📋 Pasted ${name}`);
  }

  duplicate() {
    if (this.mode !== 'edit') return;
    if (this.editor.selectedEntities.length > 1) {
      this.history.pushState(this.player, this.entities, this.background);
      const newGroup = [];
      for (const target of this.editor.selectedEntities) {
        if (target === this.player || target.type === 'player') continue;
        const newEnt = LevelStorage.cloneEntity(target, target.x + this.editor.tileSize, target.y);
        if (newEnt) {
          this.entities.push(newEnt);
          newGroup.push(newEnt);
        }
      }
      if (newGroup.length > 0) {
        this.editor.selectedEntities = newGroup;
        this.updateActionCard(this.editor.selectedEntity);
        sounds.playLand();
        LevelStorage.autoSave(this.player, this.entities, this.background);
        this.showToast(`📑 Duplicated ${newGroup.length} components`);
      }
      return;
    }

    const target = this.editor.selectedEntity;
    if (!target) {
      this.showToast('Select a component to duplicate');
      return;
    }

    if (target === this.player || target.type === 'player') {
      this.showToast('⚠️ Only one player spawn can exist');
      return;
    }

    let newX = target.x + this.editor.tileSize;
    let newY = target.y;

    const isOccupied = this.entities.some(e => Math.abs(e.x - newX) < 10 && Math.abs(e.y - newY) < 10);
    if (isOccupied) {
      newX = target.x + this.editor.tileSize;
      newY = target.y + this.editor.tileSize;
    }

    const newEnt = LevelStorage.cloneEntity(target, newX, newY);
    if (!newEnt) return;

    this.history.pushState(this.player, this.entities, this.background);
    this.entities.push(newEnt);
    this.editor.selectedEntity = newEnt;
    this.editor.cursorGrid.x = newX;
    this.editor.cursorGrid.y = newY;
    this.updateActionCard(newEnt);

    sounds.playLand();
    LevelStorage.autoSave(this.player, this.entities, this.background);

    const name = newEnt.variant ? `${newEnt.variant} ${newEnt.type}` : newEnt.type;
    this.showToast(`📑 Duplicated ${name}`);
  }

  // --- Neo-brutalist Context Menu ---
  openContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.mode !== 'edit') return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    const gridX = Math.floor(worldPos.x / this.editor.tileSize) * this.editor.tileSize;
    const gridY = Math.floor(worldPos.y / this.editor.tileSize) * this.editor.tileSize;

    this.contextMenuGrid = { x: gridX, y: gridY };
    this.editor.cursorGrid.x = gridX;
    this.editor.cursorGrid.y = gridY;

    const menuEl = document.getElementById('editor-context-menu');
    const titleEl = document.getElementById('context-menu-title');
    const coordsEl = document.getElementById('context-menu-coords');
    if (!menuEl) return;

    // Detect if right-clicked directly on an entity
    const clickedEnt = this.editor.findEntityAt(worldPos.x, worldPos.y, this.entities, this.player);
    if (clickedEnt) {
      if (this.editor.selectedEntities && this.editor.selectedEntities.length > 1 && this.editor.selectedEntities.includes(clickedEnt)) {
        if (titleEl) titleEl.textContent = `SELECTION (${this.editor.selectedEntities.length} ITEMS)`;
      } else {
        this.editor.selectedEntity = clickedEnt;
        this.updateActionCard(clickedEnt);
        const name = clickedEnt.type === 'player'
          ? 'PLAYER SPAWN'
          : (clickedEnt.variant ? `${clickedEnt.variant.toUpperCase()} ${clickedEnt.type.toUpperCase()}` : clickedEnt.type.toUpperCase());
        if (titleEl) titleEl.textContent = name;
      }
    } else {
      if (this.editor.selectedEntities && this.editor.selectedEntities.length > 1) {
        if (titleEl) titleEl.textContent = `SELECTION (${this.editor.selectedEntities.length} ITEMS)`;
      } else {
        if (titleEl) titleEl.textContent = 'STAGE OPTIONS';
        if (this.editor.selectedEntity) {
          this.editor.selectedEntity = null;
          document.getElementById('entity-action-card')?.classList.remove('active');
        }
      }
    }

    if (coordsEl) {
      coordsEl.textContent = `[${gridX}, ${gridY}]`;
    }

    // Enable/disable actions
    const isMulti = this.editor.selectedEntities && this.editor.selectedEntities.length > 1;
    const hasSelection = Boolean(this.editor.selectedEntity) || isMulti;
    const isPlayer = !isMulti && (this.editor.selectedEntity === this.player || this.editor.selectedEntity?.type === 'player');
    const hasClipboard = Boolean(this.clipboardEntity) || (this.clipboardGroup && this.clipboardGroup.length > 0);

    const copyBtn = document.getElementById('ctx-copy-btn');
    const pasteBtn = document.getElementById('ctx-paste-btn');
    const duplicateBtn = document.getElementById('ctx-duplicate-btn');
    const cutBtn = document.getElementById('ctx-cut-btn');
    const paintBtn = document.getElementById('ctx-paint-btn');
    const tuneBtn = document.getElementById('ctx-tune-btn');
    const deleteBtn = document.getElementById('ctx-delete-btn');
    const placeBtn = document.getElementById('ctx-place-btn');
    const placeIcon = document.getElementById('ctx-place-icon');
    const placeLabel = document.getElementById('ctx-place-label');

    if (copyBtn) {
      copyBtn.disabled = !hasSelection;
      const lbl = copyBtn.querySelector('.ctx-item-label');
      if (lbl) lbl.textContent = isMulti ? `Copy All (${this.editor.selectedEntities.length})` : 'Copy';
    }
    if (pasteBtn) {
      pasteBtn.disabled = !hasClipboard;
      const lbl = pasteBtn.querySelector('.ctx-item-label');
      const count = this.clipboardGroup && this.clipboardGroup.length > 1 ? ` (${this.clipboardGroup.length})` : '';
      if (lbl) lbl.textContent = `Paste Here${count}`;
    }
    if (duplicateBtn) {
      duplicateBtn.disabled = !hasSelection || isPlayer;
      const lbl = duplicateBtn.querySelector('.ctx-item-label');
      if (lbl) lbl.textContent = isMulti ? `Duplicate All (${this.editor.selectedEntities.length})` : 'Duplicate';
    }
    if (cutBtn) {
      cutBtn.disabled = !hasSelection || isPlayer;
      const lbl = cutBtn.querySelector('.ctx-item-label');
      if (lbl) lbl.textContent = isMulti ? `Cut All (${this.editor.selectedEntities.length})` : 'Cut';
    }
    if (paintBtn) paintBtn.disabled = !hasSelection || isMulti;
    if (tuneBtn) tuneBtn.disabled = !hasSelection || isMulti;
    if (deleteBtn) {
      deleteBtn.disabled = !hasSelection || isPlayer;
      const lbl = deleteBtn.querySelector('.ctx-item-label');
      if (lbl) lbl.textContent = isMulti ? `Delete All (${this.editor.selectedEntities.length})` : 'Delete';
    }

    if (placeBtn && placeLabel) {
      const pItem = this.editor.selectedPaletteItem || 'block';
      const pVariant = this.editor.selectedPaletteVariant || '';
      const pName = pVariant && pVariant !== 'solid' && pVariant !== 'walker' && pVariant !== 'spring' && pVariant !== 'star'
        ? `${pVariant.charAt(0).toUpperCase() + pVariant.slice(1)} ${pItem.charAt(0).toUpperCase() + pItem.slice(1)}`
        : (pItem.charAt(0).toUpperCase() + pItem.slice(1));
      placeLabel.textContent = `Place ${pName}`;

      const iconEl = document.getElementById(`palette-icon-${pItem}`);
      if (placeIcon && iconEl) {
        placeIcon.textContent = iconEl.textContent;
      }
    }

    // Position menu near cursor clamped within screen
    const menuW = 215;
    const menuH = 320;
    let posX = e.clientX + 4;
    let posY = e.clientY + 4;

    if (posX + menuW > window.innerWidth) {
      posX = e.clientX - menuW - 4;
    }
    if (posY + menuH > window.innerHeight) {
      posY = Math.max(10, window.innerHeight - menuH - 12);
    }

    menuEl.style.left = `${Math.max(10, posX)}px`;
    menuEl.style.top = `${Math.max(10, posY)}px`;
    menuEl.style.display = 'flex';
    sounds.playClick();
  }

  closeContextMenu() {
    const menuEl = document.getElementById('editor-context-menu');
    if (menuEl) menuEl.style.display = 'none';
    this.contextMenuGrid = null;
  }

  // --- Stretched Frame Mode (Fit Screen Minus Header) ---
  toggleFrameStretch() {
    this.setFrameStretched(!this.isFrameStretched);
  }

  setFrameStretched(stretched) {
    this.isFrameStretched = stretched;
    const workbench = document.querySelector('.workbench-container');
    const stretchIcon = document.getElementById('stretch-frame-icon');
    const stretchText = document.getElementById('stretch-frame-text');
    const stageStretchBtn = document.getElementById('stage-stretch-btn');

    if (this.isFrameStretched) {
      if (workbench) workbench.classList.add('frame-stretched');
      this.updateStretchedDimensions();

      if (stretchIcon) stretchIcon.textContent = '⤡';
      if (stretchText) stretchText.textContent = 'STANDARD FRAME';
      if (stageStretchBtn) {
        stageStretchBtn.querySelector('span').textContent = '⤡';
        stageStretchBtn.title = 'Return to standard frame';
      }
      sounds.playClick();
      this.showToast('⤢ Frame Stretched to Screen');
    } else {
      if (workbench) workbench.classList.remove('frame-stretched');
      this.canvas.width = 960;
      this.canvas.height = 540;
      this.camera.resize(960, 540);

      if (stretchIcon) stretchIcon.textContent = '⤢';
      if (stretchText) stretchText.textContent = 'STRETCH FRAME';
      if (stageStretchBtn) {
        stageStretchBtn.querySelector('span').textContent = '⤢';
        stageStretchBtn.title = 'Stretch frame to fit screen minus header';
      }
      sounds.playClick();
      this.showToast('⤡ Standard Frame Restored');
    }
  }

  updateStretchedDimensions() {
    if (!this.isFrameStretched) return;
    const header = document.querySelector('.neo-header');
    const headerH = header ? header.offsetHeight : 56;
    const w = window.innerWidth;
    const h = window.innerHeight - headerH;

    if (w > 0 && h > 0) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.camera.resize(w, h);
    }
  }

  initLevel() {
    const loadedBg = LevelStorage.autoLoad(this.player, this.entities);
    if (!loadedBg || this.entities.length === 0) {
      this.loadStarterWorld();
    } else {
      this.applyBackground(loadedBg);
    }
  }

  loadStarterWorld() {
    const preset = LevelStorage.getStarterWorld();
    this.player.setSpawn(preset.playerSpawn.x, preset.playerSpawn.y);
    this.entities = preset.entities;
    this.applyBackground(preset.background);
    this.camera.recenter(this.player.spawnX, this.player.spawnY);
    if (this.editor.selectedEntity) {
      this.updateActionCard(this.editor.selectedEntity);
    }
    LevelStorage.autoSave(this.player, this.entities, this.background);
  }

  // --- Background Application & Rendering ---
  applyBackground(bg) {
    if (!bg) return;
    this.background.theme = bg.theme || 'sky';
    this.background.customImage = bg.customImage || null;
    if (this.background.customImage) {
      const img = new Image();
      img.src = this.background.customImage;
      img.onload = () => {
        this.background.customImageElement = img;
      };
    } else {
      this.background.customImageElement = null;
    }

    const themeCards = document.querySelectorAll('.bg-theme-card');
    themeCards.forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-bg-theme') === this.background.theme);
    });

    const customStatus = document.getElementById('bg-custom-status');
    if (customStatus) {
      customStatus.style.display = this.background.customImage ? 'block' : 'none';
    }
  }

  renderBackground() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.background.theme === 'custom' && this.background.customImageElement) {
      this.ctx.drawImage(this.background.customImageElement, 0, 0, w, h);
      return;
    }

    switch (this.background.theme) {
      case 'sky': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#70C5FF');
        grad.addColorStop(1, '#E0F4FF');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        this.drawParallaxClouds(w, h);
        break;
      }
      case 'sunset': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#FF5252');
        grad.addColorStop(0.55, '#FF7A59');
        grad.addColorStop(1, '#FFD166');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        // Distant warm sun
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        this.ctx.beginPath();
        const sunX = (w * 0.75 - this.camera.x * 0.06) % (w + 200);
        this.ctx.arc(sunX < -100 ? sunX + w + 200 : sunX, h * 0.45, 60, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        break;
      }
      case 'night': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#1E1B4B');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        this.drawStars(w, h);
        break;
      }
      case 'paper': {
        this.ctx.fillStyle = '#FAF8F5';
        this.ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'mint': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#6EE7B7');
        grad.addColorStop(1, '#D1FAE5');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'cyber': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#1E0836');
        grad.addColorStop(1, '#4A154B');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        break;
      }
      default: {
        this.ctx.fillStyle = '#FAF8F5';
        this.ctx.fillRect(0, 0, w, h);
      }
    }
  }

  drawParallaxClouds(w, h) {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';

    const cloudDefs = [
      { baseCol: 100, y: 80, scale: 1.0, speed: 0.12 },
      { baseCol: 420, y: 130, scale: 0.8, speed: 0.18 },
      { baseCol: 760, y: 70, scale: 1.2, speed: 0.10 },
      { baseCol: 1100, y: 150, scale: 0.9, speed: 0.15 }
    ];

    cloudDefs.forEach(c => {
      const loopWidth = 1400;
      let x = (c.baseCol - this.camera.x * c.speed) % loopWidth;
      if (x < -200) x += loopWidth;

      this.ctx.save();
      this.ctx.translate(x, c.y);
      this.ctx.scale(c.scale, c.scale);
      this.ctx.beginPath();
      this.ctx.arc(40, 30, 24, 0, Math.PI * 2);
      this.ctx.arc(65, 20, 30, 0, Math.PI * 2);
      this.ctx.arc(95, 25, 26, 0, Math.PI * 2);
      this.ctx.arc(120, 35, 20, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    this.ctx.restore();
  }

  drawStars(w, h) {
    this.ctx.save();
    this.ctx.fillStyle = '#FFFFFF';
    const numStars = 40;
    for (let i = 0; i < numStars; i++) {
      const seedX = (i * 137.5) % w;
      const seedY = (i * 89.3) % (h * 0.7);
      const twinkle = Math.sin(performance.now() * 0.003 + i) > 0.3 ? 2.5 : 1.5;
      this.ctx.beginPath();
      this.ctx.arc(seedX, seedY, twinkle, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  // --- Frame-Safe Clamped Action Card Positioning & Variant Selection ---
  updateActionCard(ent) {
    const actionCard = document.getElementById('entity-action-card');
    if (!actionCard) return;

    if (this.mode !== 'edit') {
      actionCard.classList.remove('active');
      return;
    }

    // Check if multi-selection group is active
    if (this.editor.selectedEntities && this.editor.selectedEntities.length > 1) {
      const count = this.editor.selectedEntities.length;
      const badge = document.getElementById('action-entity-badge');
      if (badge) badge.textContent = `📦 GROUP (${count} SELECTED)`;

      const dupBtn = document.getElementById('action-duplicate-btn');
      if (dupBtn) dupBtn.style.display = 'inline-flex';
      const delBtn = document.getElementById('action-delete-btn');
      if (delBtn) delBtn.style.display = 'inline-flex';

      const variantPicker = document.getElementById('action-variant-picker');
      if (variantPicker) variantPicker.style.display = 'none';

      actionCard.classList.add('active');

      const cardW = actionCard.offsetWidth || 300;
      const cardH = actionCard.offsetHeight || 80;
      const rect = this.canvas.getBoundingClientRect();
      const scaleCssX = rect.width > 0 ? rect.width / this.canvas.width : 1;
      const scaleCssY = rect.height > 0 ? rect.height / this.canvas.height : 1;
      const canvasCssW = rect.width > 0 ? rect.width : this.canvas.width;
      const canvasCssH = rect.height > 0 ? rect.height : this.canvas.height;

      const minX = Math.min(...this.editor.selectedEntities.map(e => e.x));
      const maxX = Math.max(...this.editor.selectedEntities.map(e => e.x + (e.width || 40)));
      const minY = Math.min(...this.editor.selectedEntities.map(e => e.y));

      const groupCenter = this.camera.worldToScreen((minX + maxX) / 2, minY);
      const cssGroupX = groupCenter.x * scaleCssX;
      const cssGroupY = groupCenter.y * scaleCssY;

      let left = cssGroupX - cardW / 2;
      left = Math.max(10, Math.min(canvasCssW - cardW - 10, left));

      let top = cssGroupY - cardH - 12;
      if (top < 10) top = cssGroupY + 24;
      top = Math.max(10, Math.min(canvasCssH - cardH - 10, top));

      actionCard.style.left = `${left}px`;
      actionCard.style.top = `${top}px`;
      return;
    }

    if (!ent) {
      actionCard.classList.remove('active');
      return;
    }

    const badge = document.getElementById('action-entity-badge');
    if (badge) {
      const typeIcons = {
        player: '🐰 PLAYER SPAWN',
        crate: '🧱 SOLID BLOCK',
        block: '🧱 SOLID BLOCK',
        springboard: '🌀 SPRING BOUNCER',
        hazard: '⚠️ SPIKE HAZARD',
        enemy: '👾 ENEMY WALKER',
        moving_platform: '🛹 MOVING PLATFORM',
        collectible: '⭐ STAR / COIN',
        goal: '🏁 GOAL FINISH'
      };
      badge.textContent = typeIcons[ent.type] || `📦 ${ent.type.toUpperCase()}`;
    }

    const isPlayer = (ent.type === 'player');
    const dupBtn = document.getElementById('action-duplicate-btn');
    if (dupBtn) dupBtn.style.display = isPlayer ? 'none' : 'inline-flex';
    const delBtn = document.getElementById('action-delete-btn');
    if (delBtn) delBtn.style.display = isPlayer ? 'none' : 'inline-flex';

    // Render Mario Maker-style component variant pills in action card
    const variantPicker = document.getElementById('action-variant-picker');
    if (variantPicker) {
      variantPicker.innerHTML = '';
      const blockVariants = [
        { id: 'solid', label: '🧱 Solid' },
        { id: 'slope_up', label: '◢ Slope Up' },
        { id: 'slope_down', label: '◣ Slope Down' },
        { id: 'semisolid', label: '🪵 Semi-Solid' },
        { id: 'slab', label: '🪨 Slab' },
        { id: 'mega', label: '🏰 Mega 2x2' },
        { id: 'pipe', label: '🧪 Pipe' },
        { id: 'donut', label: '🍩 Donut' },
        { id: 'note', label: '🎵 Note' },
        { id: 'mystery', label: '❓ Mystery' },
        { id: 'cloud', label: '☁️ Cloud' },
        { id: 'ice', label: '🧊 Ice' },
        { id: 'stone', label: '🏛️ Stone' }
      ];

      const variantDefs = {
        block: blockVariants,
        crate: blockVariants,
        enemy: [{ id: 'walker', label: '🥔 Walker' }, { id: 'winged', label: '🪽 Winged' }, { id: 'spiky', label: '🦔 Spiky' }],
        collectible: [{ id: 'star', label: '⭐ Star' }, { id: 'coin', label: '🪙 Coin' }, { id: 'heart', label: '❤️ Heart' }],
        springboard: [{ id: 'spring', label: '🌀 Standard' }, { id: 'mega', label: '🚀 Mega' }]
      };

      const options = variantDefs[ent.type];
      if (options) {
        options.forEach(opt => {
          const pill = document.createElement('button');
          pill.className = `action-variant-pill ${(ent.variant || 'solid') === opt.id ? 'active' : ''}`;
          pill.textContent = opt.label;
          pill.addEventListener('click', () => {
            this.history.pushState(this.player, this.entities, this.background);
            if (ent.setVariant) ent.setVariant(opt.id);
            else ent.variant = opt.id;
            LevelStorage.autoSave(this.player, this.entities, this.background);
            sounds.playClick();
            this.updateActionCard(ent);
          });
          variantPicker.appendChild(pill);
        });
        variantPicker.style.display = 'flex';
      } else {
        variantPicker.style.display = 'none';
      }
    }

    actionCard.classList.add('active');

    // Measure card dimensions
    const cardW = actionCard.offsetWidth || 300;
    const cardH = actionCard.offsetHeight || 80;
    const rect = this.canvas.getBoundingClientRect();
    const scaleCssX = rect.width > 0 ? rect.width / this.canvas.width : 1;
    const scaleCssY = rect.height > 0 ? rect.height / this.canvas.height : 1;
    const canvasCssW = rect.width > 0 ? rect.width : this.canvas.width;
    const canvasCssH = rect.height > 0 ? rect.height : this.canvas.height;

    // Calculate world entity center and bounds transformed to screen space
    const entCenter = this.camera.worldToScreen(ent.x + (ent.width || 40) / 2, ent.y);
    const entBottom = this.camera.worldToScreen(ent.x + (ent.width || 40) / 2, ent.y + (ent.height || 40));

    const cssEntX = entCenter.x * scaleCssX;
    const cssEntTopY = entCenter.y * scaleCssY;
    const cssEntBottomY = entBottom.y * scaleCssY;

    // Horizontal centering with strict frame padding (10px from left and right borders)
    let left = cssEntX - cardW / 2;
    left = Math.max(10, Math.min(canvasCssW - cardW - 10, left));

    // Vertical placement: default above entity
    let top = cssEntTopY - cardH - 12;

    // If near top of canvas, flip cleanly below the entity
    if (top < 10) {
      top = cssEntBottomY + 12;
    }

    // Strict vertical clamping inside canvas frame (10px from top and bottom)
    top = Math.max(10, Math.min(canvasCssH - cardH - 10, top));

    actionCard.style.left = `${left}px`;
    actionCard.style.top = `${top}px`;
  }

  // Toast Notification Popup
  showToast(message) {
    const existing = document.querySelector('.sidehop-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'sidehop-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  // Definitions of Mario Maker-style component types / variants
  getVariantDefs() {
    return {
      block: {
        title: 'BLOCK & SLOPE TYPES',
        variants: [
          { id: 'solid', icon: '🧱', name: 'Solid Ground', desc: 'Standard solid block platform', shortName: 'Solid' },
          { id: 'slope_up', icon: '◢', name: 'Slope Up (45°)', desc: 'Walkable incline hill slant', shortName: 'Slope Up' },
          { id: 'slope_down', icon: '◣', name: 'Slope Down (45°)', desc: 'Walkable decline hill slant', shortName: 'Slope Down' },
          { id: 'semisolid', icon: '🪵', name: 'Semi-Solid Platform', desc: 'Jump through from below, stand on top', shortName: 'Semi-Solid' },
          { id: 'slab', icon: '🪨', name: 'Half Slab (40x20)', desc: 'Half-height stepping stone block', shortName: 'Half Slab' },
          { id: 'mega', icon: '🏰', name: 'Mega Block (80x80)', desc: 'Giant 2x2 fortress block', shortName: 'Mega Block' },
          { id: 'pipe', icon: '🧪', name: 'Warp Pipe (40x80)', desc: 'Tall iconic 2-tile pipe column', shortName: 'Pipe' },
          { id: 'donut', icon: '🍩', name: 'Donut Lift', desc: 'Drops and falls when stood upon', shortName: 'Donut Lift' },
          { id: 'note', icon: '🎵', name: 'Note Block ♪', desc: 'Super bouncy musical trampoline block', shortName: 'Note Block' },
          { id: 'mystery', icon: '❓', name: 'Mystery Block', desc: 'Breakable surprise block [?]', shortName: 'Mystery' },
          { id: 'ice', icon: '🧊', name: 'Ice Block', desc: 'Low-friction slippery surface', shortName: 'Ice' },
          { id: 'cloud', icon: '☁️', name: 'Cloud Platform', desc: 'Soft floating cloud block', shortName: 'Cloud' },
          { id: 'stone', icon: '🏛️', name: 'Castle Stone', desc: 'Chiseled fortress stone masonry', shortName: 'Stone' }
        ]
      },
      springboard: {
        title: 'SPRING TYPES',
        variants: [
          { id: 'spring', icon: '🌀', name: 'Standard Spring', desc: 'Bounces player high upward', shortName: 'Spring' },
          { id: 'mega', icon: '🚀', name: 'Mega Trampoline', desc: 'Super high vertical booster', shortName: 'Mega Spring' }
        ]
      },
      enemy: {
        title: 'ENEMY TYPES',
        variants: [
          { id: 'walker', icon: '🥔', name: 'Potato Walker', desc: 'Patrols back and forth on ground', shortName: 'Enemy' },
          { id: 'winged', icon: '🪽', name: 'Winged Hopper', desc: 'Hops & flutters airborne', shortName: 'Winged' },
          { id: 'spiky', icon: '🦔', name: 'Armored Spiky', desc: 'Hazardous spines - cannot stomp!', shortName: 'Spiky' }
        ]
      },
      collectible: {
        title: 'COLLECTIBLE TYPES',
        variants: [
          { id: 'star', icon: '⭐', name: 'Star Gem', desc: 'Bright glowing star token (+100 pts)', shortName: 'Star' },
          { id: 'coin', icon: '🪙', name: 'Gold Coin', desc: 'Shiny spinning coin token (+50 pts)', shortName: 'Coin' },
          { id: 'heart', icon: '❤️', name: 'Health Heart', desc: 'Restores +1 heart of player health', shortName: 'Heart' }
        ]
      }
    };
  }

  // Open the corner triangle flyout popup menu for a component
  openComponentFlyout(item, anchorEl) {
    const flyout = document.getElementById('component-flyout-menu');
    const titleEl = document.getElementById('flyout-title');
    const optionsList = document.getElementById('flyout-options-list');
    if (!flyout || !titleEl || !optionsList) return;

    const defs = this.getVariantDefs()[item];
    if (!defs) return;

    // If already open for this exact item, toggle off
    if (this.activeFlyoutItem === item && flyout.style.display !== 'none') {
      this.closeComponentFlyout();
      return;
    }

    this.activeFlyoutItem = item;
    titleEl.textContent = defs.title;
    optionsList.innerHTML = '';

    const currentVariant = this.activeComponentVariants[item] || defs.variants[0].id;

    defs.variants.forEach(v => {
      const btn = document.createElement('button');
      btn.className = `flyout-option-btn ${currentVariant === v.id ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="flyout-option-icon">${v.icon}</span>
        <div class="flyout-option-text">
          <span class="flyout-option-name">${v.name}</span>
          <span class="flyout-option-desc">${v.desc}</span>
        </div>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectComponentVariant(item, v.id, v.icon, v.shortName);
      });
      optionsList.appendChild(btn);
    });

    // Mark active state on triangle button
    document.querySelectorAll('.palette-triangle-btn').forEach(tb => {
      tb.classList.toggle('active', tb.getAttribute('data-triangle') === item);
    });

    // Position flyout directly adjacent to the anchor element (just outside the drawer)
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top - 10;

    // Clamp within viewport
    const menuHeight = 240;
    if (top + menuHeight > window.innerHeight) {
      top = Math.max(12, window.innerHeight - menuHeight - 12);
    }
    if (top < 12) top = 12;

    flyout.style.left = `${left}px`;
    flyout.style.top = `${top}px`;
    flyout.style.display = 'flex';
    sounds.playClick();
  }

  // Close component flyout popup
  closeComponentFlyout() {
    const flyout = document.getElementById('component-flyout-menu');
    if (flyout) flyout.style.display = 'none';
    this.activeFlyoutItem = null;
    document.querySelectorAll('.palette-triangle-btn').forEach(tb => {
      tb.classList.remove('active');
    });
  }

  // Select variant from flyout
  selectComponentVariant(item, variantId, icon, shortName) {
    this.activeComponentVariants[item] = variantId;
    this.editor.setPaletteItem(item, variantId);

    // Update palette button label and icon
    const iconEl = document.getElementById(`palette-icon-${item}`);
    if (iconEl && icon) iconEl.textContent = icon;
    const nameEl = document.getElementById(`palette-name-${item}`);
    if (nameEl && shortName) nameEl.textContent = shortName;

    // Highlight active palette button in drawer
    document.querySelectorAll('.palette-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-palette') === item);
    });

    // Switch to place tool
    document.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tool') === 'place');
    });
    this.editor.setTool('place');

    this.closeComponentFlyout();
    sounds.playClick();
    this.showToast(`Selected ${shortName || variantId}!`);
  }

  bindUI() {
    // 1. Mode Toggle Button (PLAY / EDIT)
    const modeBtn = document.getElementById('mode-toggle-btn');
    modeBtn.addEventListener('click', () => {
      this.toggleMode();
    });

    // Stretch Frame Buttons (Header and Floating Stage Button)
    document.getElementById('stretch-frame-btn')?.addEventListener('click', () => {
      this.toggleFrameStretch();
    });
    document.getElementById('stage-stretch-btn')?.addEventListener('click', () => {
      this.toggleFrameStretch();
    });

    // 2. REC Button
    const recBtn = document.getElementById('rec-btn');
    recBtn.addEventListener('click', () => {
      const active = this.recorder.toggleRecording();
      if (active) {
        recBtn.classList.add('active');
      } else {
        recBtn.classList.remove('active');
      }
    });

    // 3. Audio Sound Effects Button
    const soundBtn = document.getElementById('sound-toggle-btn');
    soundBtn?.addEventListener('click', () => {
      sounds.setMuted(!sounds.muted);
      soundBtn.querySelector('span').textContent = sounds.muted ? '🔇' : '🔊';
      sounds.playClick();
    });

    // 4. Background Customizer Modal Controls
    const bgModal = document.getElementById('background-modal');
    document.getElementById('bg-modal-btn').addEventListener('click', () => {
      bgModal.classList.add('active');
      sounds.playClick();
    });
    document.getElementById('close-bg-modal').addEventListener('click', () => {
      bgModal.classList.remove('active');
      sounds.playClick();
    });
    document.getElementById('bg-done-btn').addEventListener('click', () => {
      bgModal.classList.remove('active');
      LevelStorage.autoSave(this.player, this.entities, this.background);
      sounds.playClick();
    });

    const bgThemeCards = document.querySelectorAll('.bg-theme-card');
    bgThemeCards.forEach(card => {
      card.addEventListener('click', () => {
        bgThemeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.background.theme = card.getAttribute('data-bg-theme');
        this.background.customImage = null;
        this.background.customImageElement = null;
        const customStatus = document.getElementById('bg-custom-status');
        if (customStatus) customStatus.style.display = 'none';
        sounds.playClick();
        LevelStorage.autoSave(this.player, this.entities, this.background);
      });
    });

    const bgUploadInput = document.getElementById('bg-image-upload');
    bgUploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.background.theme = 'custom';
          this.background.customImage = ev.target.result;
          const img = new Image();
          img.src = ev.target.result;
          img.onload = () => {
            this.background.customImageElement = img;
          };
          bgThemeCards.forEach(c => c.classList.remove('active'));
          const customStatus = document.getElementById('bg-custom-status');
          if (customStatus) customStatus.style.display = 'block';
          sounds.playPaintSquish();
          LevelStorage.autoSave(this.player, this.entities, this.background);
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('bg-reset-default').addEventListener('click', () => {
      this.background.theme = 'sky';
      this.background.customImage = null;
      this.background.customImageElement = null;
      bgThemeCards.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-bg-theme') === 'sky');
      });
      const customStatus = document.getElementById('bg-custom-status');
      if (customStatus) customStatus.style.display = 'none';
      sounds.playClick();
      LevelStorage.autoSave(this.player, this.entities, this.background);
    });

    // 5. Presets and Level Management
    document.getElementById('load-preset-btn').addEventListener('click', () => {
      this.loadStarterWorld();
      sounds.playLand();
      this.showToast('🔄 World Reset to Default!');
    });

    document.getElementById('export-level-btn').addEventListener('click', () => {
      LevelStorage.exportLevel(this.player, this.entities, this.background);
      sounds.playCollect();
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-level-btn').addEventListener('click', () => {
      importInput.click();
    });

    importInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        LevelStorage.importLevel(e.target.files[0], this.player, this.entities, (bg) => {
          if (bg) this.applyBackground(bg);
          sounds.playCollect();
        });
      }
    });

    // 6. Tool Drawer Palette Clicks
    const toolButtons = document.querySelectorAll('[data-tool]');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.editor.setTool(btn.getAttribute('data-tool'));
      });
    });

    const paletteButtons = document.querySelectorAll('[data-palette]');
    paletteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        paletteButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const item = btn.getAttribute('data-palette');
        const activeVariant = this.activeComponentVariants[item] || null;
        this.editor.setPaletteItem(item, activeVariant);

        // Switch to place tool automatically when selecting a component
        toolButtons.forEach(b => b.classList.remove('active'));
        const placeBtn = document.querySelector('[data-tool="place"]');
        if (placeBtn) placeBtn.classList.add('active');
        this.editor.setTool('place');
      });
    });

    // Triangle corner buttons for component type flyout popups (Mario Maker style)
    const triangleButtons = document.querySelectorAll('.palette-triangle-btn');
    triangleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.getAttribute('data-triangle');
        this.openComponentFlyout(item, btn);
      });
    });

    // Flyout close button
    document.getElementById('flyout-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeComponentFlyout();
      sounds.playClick();
    });

    // Dismiss flyout when clicking anywhere outside
    window.addEventListener('click', (e) => {
      const flyout = document.getElementById('component-flyout-menu');
      if (flyout && flyout.style.display !== 'none') {
        if (!flyout.contains(e.target) && !e.target.closest('.palette-triangle-btn')) {
          this.closeComponentFlyout();
        }
      }
    });

    // Dismiss flyout on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeComponentFlyout();
      }
    });

    // Undo / Redo Header Buttons
    document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
    document.getElementById('redo-btn')?.addEventListener('click', () => this.redo());

    // 7. Entity Floating Action Card
    const actionCard = document.getElementById('entity-action-card');
    this.editor.onSelectEntity = (ent) => {
      this.updateActionCard(ent);
    };

    this.editor.onDeselect = () => {
      actionCard.classList.remove('active');
    };

    this.editor.onEntityMoved = () => {
      LevelStorage.autoSave(this.player, this.entities, this.background);
      if (this.editor.selectedEntity) {
        this.updateActionCard(this.editor.selectedEntity);
      }
    };

    const actionCloseBtn = document.getElementById('action-close-btn');
    if (actionCloseBtn) {
      actionCloseBtn.addEventListener('click', () => {
        this.editor.selectedEntity = null;
        actionCard.classList.remove('active');
        sounds.playClick();
      });
    }

    document.getElementById('action-duplicate-btn')?.addEventListener('click', () => {
      this.duplicate();
    });

    document.getElementById('action-copy-btn')?.addEventListener('click', () => {
      this.copy();
    });

    document.getElementById('action-paint-btn').addEventListener('click', () => {
      if (this.editor.selectedEntity) {
        this.artStudio.openForEntity(this.editor.selectedEntity, () => {
          LevelStorage.autoSave(this.player, this.entities, this.background);
        });
      }
    });

    document.getElementById('action-tune-btn').addEventListener('click', () => {
      if (this.editor.selectedEntity) {
        this.inspector.open(this.editor.selectedEntity);
      }
    });

    document.getElementById('action-delete-btn').addEventListener('click', () => {
      if (this.editor.selectedEntities && this.editor.selectedEntities.length > 1) {
        this.history.pushState(this.player, this.entities, this.background);
        let delCount = 0;
        for (const target of [...this.editor.selectedEntities]) {
          if (target === this.player || target.type === 'player') continue;
          const idx = this.entities.indexOf(target);
          if (idx !== -1) {
            this.entities.splice(idx, 1);
            delCount++;
          }
        }
        this.editor.selectedEntities = [];
        actionCard.classList.remove('active');
        sounds.playPaintSquish();
        LevelStorage.autoSave(this.player, this.entities, this.background);
        this.showToast(`🗑️ Deleted ${delCount} components`);
        return;
      }
      if (this.editor.selectedEntity && this.editor.selectedEntity !== this.player) {
        const idx = this.entities.indexOf(this.editor.selectedEntity);
        if (idx !== -1) {
          this.history.pushState(this.player, this.entities, this.background);
          this.entities.splice(idx, 1);
          this.editor.selectedEntity = null;
          actionCard.classList.remove('active');
          sounds.playPaintSquish();
          LevelStorage.autoSave(this.player, this.entities, this.background);
        }
      }
    });

    // Context Menu Action Listeners
    document.getElementById('ctx-copy-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeContextMenu();
      this.copy();
    });

    document.getElementById('ctx-paste-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const pos = this.contextMenuGrid;
      this.closeContextMenu();
      if (pos) {
        this.paste(pos.x, pos.y);
      } else {
        this.paste();
      }
    });

    document.getElementById('ctx-duplicate-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeContextMenu();
      this.duplicate();
    });

    document.getElementById('ctx-cut-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeContextMenu();
      this.cut();
    });

    document.getElementById('ctx-place-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const pos = this.contextMenuGrid;
      this.closeContextMenu();
      if (pos) {
        this.editor.placeAt(pos.x, pos.y, this.entities, this.player);
      }
    });

    document.getElementById('ctx-paint-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeContextMenu();
      if (this.editor.selectedEntity) {
        this.artStudio.openForEntity(this.editor.selectedEntity, () => {
          LevelStorage.autoSave(this.player, this.entities, this.background);
        });
      }
    });

    document.getElementById('ctx-tune-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeContextMenu();
      if (this.editor.selectedEntity) {
        this.inspector.open(this.editor.selectedEntity);
      }
    });

    document.getElementById('ctx-delete-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeContextMenu();
      if (this.editor.selectedEntities && this.editor.selectedEntities.length > 1) {
        this.history.pushState(this.player, this.entities, this.background);
        let delCount = 0;
        for (const target of [...this.editor.selectedEntities]) {
          if (target === this.player || target.type === 'player') continue;
          const idx = this.entities.indexOf(target);
          if (idx !== -1) {
            this.entities.splice(idx, 1);
            delCount++;
          }
        }
        this.editor.selectedEntities = [];
        document.getElementById('entity-action-card')?.classList.remove('active');
        sounds.playPaintSquish();
        LevelStorage.autoSave(this.player, this.entities, this.background);
        this.showToast(`🗑️ Deleted ${delCount} components`);
        return;
      }
      if (this.editor.selectedEntity && this.editor.selectedEntity !== this.player) {
        const idx = this.entities.indexOf(this.editor.selectedEntity);
        if (idx !== -1) {
          this.history.pushState(this.player, this.entities, this.background);
          this.entities.splice(idx, 1);
          this.editor.selectedEntity = null;
          document.getElementById('entity-action-card')?.classList.remove('active');
          sounds.playPaintSquish();
          LevelStorage.autoSave(this.player, this.entities, this.background);
        }
      }
    });

    // Dismiss context menu when clicking outside
    window.addEventListener('click', (e) => {
      const menuEl = document.getElementById('editor-context-menu');
      if (menuEl && menuEl.style.display !== 'none') {
        if (!menuEl.contains(e.target)) {
          this.closeContextMenu();
        }
      }
    });

    // Dismiss context menu on scroll
    window.addEventListener('scroll', () => this.closeContextMenu(), { passive: true });

    // 8. On-Screen Navigation Controls (Edit Mode)
    const panStep = 120;
    document.getElementById('nav-pan-up').addEventListener('click', () => {
      this.camera.pan(0, -panStep);
      if (this.editor.selectedEntity) this.updateActionCard(this.editor.selectedEntity);
      sounds.playClick();
    });
    document.getElementById('nav-pan-down').addEventListener('click', () => {
      this.camera.pan(0, panStep);
      if (this.editor.selectedEntity) this.updateActionCard(this.editor.selectedEntity);
      sounds.playClick();
    });
    document.getElementById('nav-pan-left').addEventListener('click', () => {
      this.camera.pan(-panStep, 0);
      if (this.editor.selectedEntity) this.updateActionCard(this.editor.selectedEntity);
      sounds.playClick();
    });
    document.getElementById('nav-pan-right').addEventListener('click', () => {
      this.camera.pan(panStep, 0);
      if (this.editor.selectedEntity) this.updateActionCard(this.editor.selectedEntity);
      sounds.playClick();
    });
    document.getElementById('nav-recenter').addEventListener('click', () => {
      this.camera.recenter(this.player.spawnX, this.player.spawnY);
      if (this.editor.selectedEntity) this.updateActionCard(this.editor.selectedEntity);
      sounds.playBounce();
    });

    // 9. Art Studio Modal Controls
    document.getElementById('close-art-studio').addEventListener('click', () => this.artStudio.close());
    document.getElementById('paint-apply-btn').addEventListener('click', () => {
      this.artStudio.apply();
      LevelStorage.autoSave(this.player, this.entities, this.background);
    });
    document.getElementById('paint-reset-btn').addEventListener('click', () => {
      this.artStudio.resetDefault();
      LevelStorage.autoSave(this.player, this.entities, this.background);
    });

    const paintToolBtns = document.querySelectorAll('.paint-tool-btn');
    paintToolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        paintToolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.artStudio.currentTool = btn.getAttribute('data-tool');
        sounds.playClick();
      });
    });

    const colorSwatches = document.querySelectorAll('.color-swatch');
    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        colorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.artStudio.currentColor = swatch.getAttribute('data-color');
        sounds.playClick();
      });
    });

    document.getElementById('paint-brush-size').addEventListener('input', (e) => {
      this.artStudio.brushSize = parseInt(e.target.value, 10);
    });

    const uploadInput = document.getElementById('paint-image-upload');
    uploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.artStudio.handleFileUpload(e.target.files[0]);
      }
    });

    // 10. Inspector Modal Controls
    document.getElementById('inspector-done-btn').addEventListener('click', () => {
      this.inspector.close();
      LevelStorage.autoSave(this.player, this.entities, this.background);
    });

    // 11. Victory Overlay Controls
    document.getElementById('victory-restart-btn').addEventListener('click', () => {
      document.getElementById('victory-overlay').classList.remove('active');
      this.isLevelWon = false;
      this.player.respawn();
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;
      sounds.playClick();
    });

    document.getElementById('victory-edit-btn').addEventListener('click', () => {
      document.getElementById('victory-overlay').classList.remove('active');
      this.isLevelWon = false;
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;
      this.setMode('edit');
    });

    document.getElementById('victory-clip-btn').addEventListener('click', () => {
      this.recorder.startRecording();
      setTimeout(() => {
        this.recorder.stopRecording();
      }, 3000);
    });
  }

  toggleMode() {
    this.setMode(this.mode === 'edit' ? 'play' : 'edit');
  }

  setMode(newMode) {
    this.mode = newMode;
    const modeBtn = document.getElementById('mode-toggle-btn');
    const modeIcon = document.getElementById('mode-icon');
    const modeText = document.getElementById('mode-text');
    const toolDrawer = document.getElementById('tool-drawer');
    const actionCard = document.getElementById('entity-action-card');
    const navControls = document.getElementById('canvas-nav-controls');

    sounds.playClick();

    if (this.mode === 'play') {
      modeBtn.classList.remove('neo-btn-primary');
      modeBtn.classList.add('neo-btn-pink');
      modeIcon.textContent = '✏️';
      modeText.textContent = 'EDIT LEVEL';
      toolDrawer.classList.add('minimized');
      actionCard.classList.remove('active');
      if (navControls) navControls.classList.add('hidden');

      this.score = 0;
      this.isLevelWon = false;
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;
      document.getElementById('victory-overlay').classList.remove('active');
      LevelStorage.autoSave(this.player, this.entities, this.background);

      // Show Stretch Frame buttons in Play Mode
      const stretchHeaderBtn = document.getElementById('stretch-frame-btn');
      if (stretchHeaderBtn) stretchHeaderBtn.style.display = 'inline-flex';
      const stageStretchBtn = document.getElementById('stage-stretch-btn');
      if (stageStretchBtn) stageStretchBtn.style.display = 'flex';
    } else {
      modeBtn.classList.add('neo-btn-primary');
      modeBtn.classList.remove('neo-btn-pink');
      modeIcon.textContent = '▶';
      modeText.textContent = 'PLAY TEST';
      toolDrawer.classList.remove('minimized');
      if (navControls) navControls.classList.remove('hidden');
      this.player.respawn();
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;

      // Hide Stretch Frame buttons and restore standard frame in Edit Mode
      const stretchHeaderBtn = document.getElementById('stretch-frame-btn');
      if (stretchHeaderBtn) stretchHeaderBtn.style.display = 'none';
      const stageStretchBtn = document.getElementById('stage-stretch-btn');
      if (stageStretchBtn) stageStretchBtn.style.display = 'none';
      if (this.isFrameStretched) {
        this.setFrameStretched(false);
      }
    }
  }

  bindEvents() {
    // Keyboard Inputs
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;

      this.keys[e.code] = true;

      // Spacebar Handling: Tap to toggle play/edit, hold to pan in edit mode
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.mode === 'edit') {
          if (!this.editor.isSpacePan) {
            this.editor.isSpacePan = true;
            this.editor.updateCursor();
            this.spacePressTime = performance.now();
            this.didPanDuringSpace = false;
          }
        }
      }

      // Undo / Redo Shortcuts: Cmd+Z, Ctrl+Z, Cmd+Shift+Z, Ctrl+Y
      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }

      // Copy Shortcut: Cmd+C / Ctrl+C
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyC') {
        e.preventDefault();
        this.copy();
        return;
      }

      // Cut Shortcut: Cmd+X / Ctrl+X
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyX') {
        e.preventDefault();
        this.cut();
        return;
      }

      // Paste Shortcut: Cmd+V / Ctrl+V
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyV') {
        e.preventDefault();
        this.paste();
        return;
      }

      // Duplicate Shortcut: Cmd+D / Ctrl+D
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyD') {
        e.preventDefault();
        this.duplicate();
        return;
      }

      // 'R' toggles recording
      if (e.code === 'KeyR') {
        this.recorder.toggleRecording();
      }

      // 'P' toggles mode directly
      if (e.code === 'KeyP') {
        this.toggleMode();
      }

      // Edit Mode: Arrow keys control discrete placement spot tile-by-tile for quick building!
      if (this.mode === 'edit' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        const step = this.editor.tileSize; // 40px
        if (e.code === 'ArrowLeft') this.editor.cursorGrid.x -= step;
        else if (e.code === 'ArrowRight') this.editor.cursorGrid.x += step;
        else if (e.code === 'ArrowUp') this.editor.cursorGrid.y -= step;
        else if (e.code === 'ArrowDown') this.editor.cursorGrid.y += step;

        sounds.playClick();

        // Shift + Arrow: Quick-build path of components while walking
        if (e.shiftKey) {
          if (this.editor.currentTool === 'erase') {
            this.editor.eraseAt(this.editor.cursorGrid.x, this.editor.cursorGrid.y, this.entities);
          } else {
            this.editor.placeAt(this.editor.cursorGrid.x, this.editor.cursorGrid.y, this.entities, this.player);
          }
        }

        // Auto-scroll camera smoothly when cursor nears the viewport bounds
        const curScreen = this.camera.worldToScreen(this.editor.cursorGrid.x, this.editor.cursorGrid.y);
        const margin = 80;
        if (curScreen.x < margin) {
          this.camera.pan(curScreen.x - margin, 0);
        } else if (curScreen.x + this.editor.tileSize > this.canvas.width - margin) {
          this.camera.pan((curScreen.x + this.editor.tileSize) - (this.canvas.width - margin), 0);
        }
        if (curScreen.y < margin) {
          this.camera.pan(0, curScreen.y - margin);
        } else if (curScreen.y + this.editor.tileSize > this.canvas.height - margin) {
          this.camera.pan(0, (curScreen.y + this.editor.tileSize) - (this.canvas.height - margin));
        }

        if (this.editor.selectedEntity) {
          this.updateActionCard(this.editor.selectedEntity);
        }
        return;
      }

      // Enter / NumpadEnter: Place component at keyboard placement spot in edit mode
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.mode === 'edit') {
        e.preventDefault();
        if (this.editor.currentTool === 'erase') {
          this.editor.eraseAt(this.editor.cursorGrid.x, this.editor.cursorGrid.y, this.entities);
        } else {
          this.editor.placeAt(this.editor.cursorGrid.x, this.editor.cursorGrid.y, this.entities, this.player);
        }
        return;
      }

      // Delete or Backspace deletes selected entity or group, or erases entity at placement spot in edit mode
      if ((e.code === 'Delete' || e.code === 'Backspace') && this.mode === 'edit') {
        if (this.editor.selectedEntities && this.editor.selectedEntities.length > 1) {
          this.history.pushState(this.player, this.entities, this.background);
          let delCount = 0;
          for (const target of [...this.editor.selectedEntities]) {
            if (target === this.player || target.type === 'player') continue;
            const idx = this.entities.indexOf(target);
            if (idx !== -1) {
              this.entities.splice(idx, 1);
              delCount++;
            }
          }
          this.editor.selectedEntities = [];
          document.getElementById('entity-action-card')?.classList.remove('active');
          sounds.playPaintSquish();
          LevelStorage.autoSave(this.player, this.entities, this.background);
          this.showToast(`🗑️ Deleted ${delCount} components`);
        } else if (this.editor.selectedEntity && this.editor.selectedEntity !== this.player) {
          const idx = this.entities.indexOf(this.editor.selectedEntity);
          if (idx !== -1) {
            this.history.pushState(this.player, this.entities, this.background);
            this.entities.splice(idx, 1);
            this.editor.selectedEntity = null;
            document.getElementById('entity-action-card')?.classList.remove('active');
            sounds.playPaintSquish();
            LevelStorage.autoSave(this.player, this.entities, this.background);
          }
        } else {
          // Erase entity at current placement spot
          this.editor.eraseAt(this.editor.cursorGrid.x, this.editor.cursorGrid.y, this.entities);
        }
      }

      // Escape dismisses context menu, flyouts, and deselects entity
      if (e.code === 'Escape' || e.key === 'Escape') {
        this.closeContextMenu();
        this.closeComponentFlyout();
        if (this.mode === 'edit') {
          this.editor.selectedEntity = null;
          document.getElementById('entity-action-card')?.classList.remove('active');
        }
      }

      // Number keys switch tools in edit mode: 1=Select, 2=Place, 3=Pan, 4=Erase, 5=Box Select
      if (this.mode === 'edit') {
        const toolMap = { Digit1: 'select', Digit2: 'place', Digit3: 'pan', Digit4: 'erase', Digit5: 'boxselect' };
        if (toolMap[e.code]) {
          const tool = toolMap[e.code];
          const btn = document.querySelector(`[data-tool="${tool}"]`);
          if (btn) btn.click();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'Space' && this.mode === 'edit') {
        this.editor.isSpacePan = false;
        this.editor.updateCursor();
        if (!this.didPanDuringSpace && (performance.now() - this.spacePressTime < 350)) {
          this.toggleMode();
        }
      }
    });

    // Mouse Canvas Inputs for Edit Mode
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'edit') {
        this.closeContextMenu();
        this.editor.handleMouseDown(e, this.entities, this.player);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mode === 'edit') {
        if (this.editor.isPanning) {
          this.didPanDuringSpace = true;
        }
        this.editor.handleMouseMove(e, this.entities, this.player);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.mode === 'edit') {
        this.editor.handleMouseUp();
      }
    });

    // Right-click opens neo-brutalist context menu in Edit Mode
    this.canvas.addEventListener('contextmenu', (e) => {
      if (this.mode === 'edit') {
        this.openContextMenu(e);
      } else {
        e.preventDefault();
      }
    });
    window.addEventListener('resize', () => {
      if (this.isFrameStretched && this.mode === 'play') {
        this.updateStretchedDimensions();
      }
    });
  }

  update(dt) {
    if (this.mode === 'play' && !this.isLevelWon) {
      // 1. Update Player Input & Movement
      this.player.handleInput(this.keys, dt);

      // Collect solid collision objects (Blocks and Moving Platforms)
      const solids = this.entities.filter(ent => ent.type === 'crate' || ent.type === 'block' || ent.type === 'moving_platform');
      for (const s of solids) {
        if (s.update && (s.type === 'crate' || s.type === 'block')) s.update(dt);
      }
      this.physics.updateEntity(this.player, solids, dt);

      // 2. Check Entity Interactions
      for (const ent of this.entities) {
        if (!ent.active) continue;

        // Springs
        if (ent.type === 'springboard') {
          ent.update(dt);
          if (this.physics.checkOverlap(this.player, ent) && this.player.vy > 0) {
            this.player.vy = -ent.launchForce;
            ent.trigger();
          }
        }

        // Hazards (Spikes / Pits)
        else if (ent.type === 'hazard') {
          if (this.physics.checkOverlap(this.player, ent)) {
            const knockDir = (this.player.x + this.player.width / 2 < ent.x + ent.width / 2) ? -1 : 1;
            if (this.player.takeDamage(1, knockDir)) {
              sounds.playHurt();
              this.spawnHurtParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
              if (this.player.hearts <= 0) {
                this.player.respawn();
              }
            }
          }
        }

        // Enemies (Walker, Winged Hopper, Armored Spiky)
        else if (ent.type === 'enemy') {
          ent.update(dt, solids);
          // If dying or inactive, skip player collision check so rebounding doesn't trigger damage
          if (!ent.active || ent.isSquashed) continue;

          if (this.physics.checkOverlap(this.player, ent)) {
            const isFalling = this.player.vy > 0;
            const isAbove = (this.player.y + this.player.height - 10 <= ent.y + ent.height * 0.7);

            if (ent.stompable && isFalling && isAbove) {
              ent.stomp();
              this.player.vy = -500;
              this.player.y = ent.y - this.player.height - 2;
              this.score += (ent.variant === 'winged' ? 150 : 100);
            } else {
              // Hurt player on collision (depletes 1 heart with i-frames & knockback)
              const knockDir = (this.player.x + this.player.width / 2 < ent.x + ent.width / 2) ? -1 : 1;
              if (this.player.takeDamage(1, knockDir)) {
                sounds.playHurt();
                this.spawnHurtParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                if (this.player.hearts <= 0) {
                  this.player.respawn();
                }
              }
            }
          }
        }

        // Moving Platforms
        else if (ent.type === 'moving_platform') {
          ent.update(dt);
          if (
            this.player.grounded &&
            this.player.y + this.player.height >= ent.y - 2 &&
            this.player.y + this.player.height <= ent.y + 10 &&
            this.player.x + this.player.width > ent.x &&
            this.player.x < ent.x + ent.width
          ) {
            this.player.x += ent.dx;
            this.player.y += ent.dy;
          }
        }

        // Collectibles (Coin, Star Gem, Heart)
        else if (ent.type === 'collectible') {
          ent.update(dt);
          if (this.physics.checkOverlap(this.player, ent)) {
            ent.collect();
            if (ent.variant === 'heart') {
              this.player.hearts = Math.min(this.player.maxHearts, this.player.hearts + 1);
              this.score += 200;
              this.showToast('❤️ +1 Heart!');
            } else if (ent.variant === 'star') {
              this.score += 500;
            } else {
              this.score += 100;
            }
          }
        }

        // Goal Flag / Victory
        else if (ent.type === 'goal') {
          ent.update(dt);
          if (this.physics.checkOverlap(this.player, ent)) {
            this.triggerVictory();
          }
        }
      }

      // 3. Fall out of world
      if (this.player.y > 1000) {
        sounds.playHurt();
        this.player.respawn();
      }

      // Camera follow in Play Mode
      this.camera.follow(this.player, dt);

    } else if (this.mode === 'edit') {
      // In Edit Mode, allow keyboard WASD smooth camera panning
      const panSpeed = 450 * dt;
      let panned = false;
      if (this.keys['KeyA']) {
        this.camera.pan(-panSpeed, 0);
        panned = true;
      }
      if (this.keys['KeyD']) {
        this.camera.pan(panSpeed, 0);
        panned = true;
      }
      if (this.keys['KeyW']) {
        this.camera.pan(0, -panSpeed);
        panned = true;
      }
      if (this.keys['KeyS']) {
        this.camera.pan(0, panSpeed);
        panned = true;
      }

      if (panned && this.editor.selectedEntity) {
        this.updateActionCard(this.editor.selectedEntity);
      }

      for (const ent of this.entities) {
        if (ent.update && (ent.type === 'springboard' || ent.type === 'collectible' || ent.type === 'goal' || ent.type === 'crate' || ent.type === 'block')) {
          ent.update(dt);
        }
      }
    }

    // Update Confetti
    if (this.confetti.length > 0) {
      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const p = this.confetti[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.rotation += p.vRot;
        p.life -= dt;
        if (p.life <= 0) {
          this.confetti.splice(i, 1);
        }
      }
    }
  }

  triggerVictory() {
    this.isLevelWon = true;
    sounds.playVictory();
    document.getElementById('victory-stats').textContent = `Total Score: ${this.score} PTS`;
    document.getElementById('victory-overlay').classList.add('active');

    this.confetti = [];
    const colors = ['#00E5FF', '#FFE600', '#FF3388', '#00E676', '#B388FF'];
    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: this.canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2,
        life: 2.5
      });
    }
  }

  spawnHurtParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      this.confetti.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 8 - 3,
        size: Math.random() * 6 + 4,
        color: '#FF2D55',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.3,
        life: 0.9
      });
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Active Background Atmosphere / Custom Art
    this.renderBackground();

    // 2. Draw World Entities
    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);

    for (const ent of this.entities) {
      ent.draw(this.ctx);
    }

    this.player.draw(this.ctx);

    this.ctx.restore();

    // 3. In Edit Mode, draw grid lines and hover ghost
    if (this.mode === 'edit') {
      this.editor.draw(this.ctx);
    }

    // 4. Draw HUD in Play Mode (Score & 4 Hearts)
    if (this.mode === 'play') {
      this.drawPlayHUD();
    }

    // 5. Draw Confetti
    if (this.confetti.length > 0) {
      this.ctx.save();
      for (const p of this.confetti) {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
      }
      this.ctx.restore();
    }
  }

  // --- Neo-Brutalist Play HUD (Score & 4 Hearts) ---
  drawPlayHUD() {
    this.ctx.save();

    // Top Neo-Brutalist HUD Card (Score & 4 Hearts)
    const hudW = 270;
    const hudH = 50;
    const hudX = 20;
    const hudY = 20;

    // Hard drop-shadow
    this.ctx.fillStyle = '#121212';
    this.ctx.beginPath();
    this.ctx.roundRect(hudX + 4, hudY + 4, hudW, hudH, 12);
    this.ctx.fill();

    // White foreground pill with thick black border
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#121212';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.roundRect(hudX, hudY, hudW, hudH, 12);
    this.ctx.fill();
    this.ctx.stroke();

    // Score on the left
    this.ctx.font = '700 11px "Fredoka", sans-serif';
    this.ctx.fillStyle = '#777777';
    this.ctx.fillText('SCORE', hudX + 16, hudY + 19);

    this.ctx.font = '900 18px "Fredoka", sans-serif';
    this.ctx.fillStyle = '#121212';
    this.ctx.fillText(`${this.score}`, hudX + 16, hudY + 39);

    // Subtle vertical separator
    this.ctx.strokeStyle = '#E0E0E0';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(hudX + 88, hudY + 10);
    this.ctx.lineTo(hudX + 88, hudY + 40);
    this.ctx.stroke();

    // 4 Hearts on the right
    const heartStartX = hudX + 112;
    const heartY = hudY + 25;
    const heartSpacing = 36;
    const maxH = this.player.maxHearts || 4;
    const currentH = this.player.hearts;

    for (let i = 0; i < maxH; i++) {
      const isFilled = i < currentH;
      const isLow = (currentH === 1);
      this.drawHeartIcon(heartStartX + i * heartSpacing, heartY, isFilled, isLow);
    }

    this.ctx.restore();
  }

  drawHeartIcon(cx, cy, isFilled, isLowHealth = false) {
    this.ctx.save();
    this.ctx.translate(cx, cy);

    if (isFilled && isLowHealth) {
      // Rapid pulse animation on critical 1-heart health
      const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.14;
      this.ctx.scale(pulse, pulse);
    }

    this.ctx.beginPath();
    this.ctx.moveTo(0, -3);
    this.ctx.bezierCurveTo(-4, -11, -12, -6, -12, 1);
    this.ctx.bezierCurveTo(-12, 7, -5, 10, 0, 14);
    this.ctx.bezierCurveTo(5, 10, 12, 7, 12, 1);
    this.ctx.bezierCurveTo(12, -6, 4, -11, 0, -3);
    this.ctx.closePath();

    if (isFilled) {
      this.ctx.fillStyle = '#FF2D55'; // Candy Crimson Red
      this.ctx.fill();
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      // Specular highlight gleam
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.beginPath();
      this.ctx.arc(-4, -3, 2.2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Empty / depleted heart
      this.ctx.fillStyle = 'rgba(230, 230, 230, 0.7)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#A0A0A0';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Broken / crossed heart crack
      this.ctx.strokeStyle = '#A0A0A0';
      this.ctx.lineWidth = 1.8;
      this.ctx.beginPath();
      this.ctx.moveTo(-3, -2);
      this.ctx.lineTo(1, 3);
      this.ctx.lineTo(-2, 7);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Start Sidehop!
window.addEventListener('DOMContentLoaded', () => {
  window.sidehop = new SidehopApp();
});
