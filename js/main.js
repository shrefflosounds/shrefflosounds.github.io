// Sidehop Master Application Coordinator — Enhanced Custom Backgrounds, Asset Library & Undo/Redo

import { Player, Bullet, SolidBlock, Collectible } from './engine/entities.js?v=20261031_134910';
import { PhysicsEngine } from './engine/physics.js?v=20261031_134910';
import { Camera } from './engine/camera.js?v=20261031_134910';
import { GridEditor } from './editor/grid.js?v=20261031_134910';
import { ArtStudio } from './editor/paint.js?v=20261031_134910';
import { Inspector } from './editor/inspector.js?v=20261031_134910';
import { VideoRecorder } from './recorder/recorder.js?v=20261031_134910';
import { LevelStorage } from './storage/storage.js?v=20261031_134910';
import { HistoryManager } from './editor/history.js?v=20261031_134910';
import { sounds } from './audio/sound.js?v=20261031_134910';
import { SidehopFile } from './storage/sidehop-format.js?v=20261031_134910';
import { SidehopDemo } from './editor/demo.js?v=20261031_134910';

class SidehopApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.mode = 'edit'; // 'edit' or 'play'
    this.isDemoActive = false;

    this.physics = new PhysicsEngine(40);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.player = new Player(80, 400);
    this.entities = [];
    this.bullets = [];
    this.keys = {};
    this.score = 0;
    this.isLevelWon = false;

    // Background State
    this.background = {
      theme: 'sky', // 'sky', 'sunset', 'night', 'paper', 'mint', 'cyber', 'custom'
      customImage: null,
      customImageElement: null
    };

    // World & UI Theme State
    const validThemes = ['grass', 'snowy', 'night', 'chrome', '8-bit', 'jungle', 'neon', 'atlantis', 'uncanny', 'mixed'];
    let initialTheme = 'grass';
    try {
      const savedTheme = localStorage.getItem('sidehop_theme');
      if (savedTheme && validThemes.includes(savedTheme)) {
        initialTheme = savedTheme === 'mixed' ? 'uncanny' : savedTheme;
      }
    } catch (e) {}
    this.currentTheme = initialTheme;
    window.__SIDEHOP_THEME__ = this.currentTheme;

    // Snowflakes particle cache for snowy theme
    this.snowflakes = Array.from({ length: 48 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      radius: Math.random() * 2.2 + 1.0,
      speed: Math.random() * 0.8 + 0.6,
      drift: Math.random() * 0.6 - 0.3
    }));

    // Bubbles particle cache for atlantis underwater theme
    this.bubbles = Array.from({ length: 45 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      radius: Math.random() * 3.5 + 1.8,
      speed: Math.random() * 0.9 + 0.7,
      wobbleSpeed: Math.random() * 0.003 + 0.002,
      wobbleAmp: Math.random() * 16 + 8,
      baseX: Math.random() * 2000
    }));

    // Chrome sparks & specular glints cache for chrome theme
    this.chromeSparks = Array.from({ length: 42 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      size: Math.random() * 2.5 + 1.2,
      speed: Math.random() * 0.8 + 0.4,
      twinkleSpeed: Math.random() * 0.005 + 0.002,
      twinklePhase: Math.random() * Math.PI * 2,
      isStarburst: Math.random() > 0.45,
      color: ['#FFFFFF', '#E2E8F0', '#38BDF8', '#F59E0B'][Math.floor(Math.random() * 4)]
    }));

    // Bioluminescent fireflies & forest spores cache for jungle theme
    this.jungleFireflies = Array.from({ length: 45 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      baseX: Math.random() * 2000,
      radius: Math.random() * 2.8 + 1.2,
      speed: Math.random() * 0.4 + 0.2,
      wobbleSpeed: Math.random() * 0.0025 + 0.0015,
      wobbleAmp: Math.random() * 22 + 10,
      glowSpeed: Math.random() * 0.004 + 0.002,
      glowPhase: Math.random() * Math.PI * 2,
      color: ['#4ADE80', '#FBBF24', '#A3E635', '#34D399'][Math.floor(Math.random() * 4)]
    }));

    // Subsystems
    this.editor = new GridEditor(this.canvas, this.camera, 40);
    this.artStudio = new ArtStudio(
      document.getElementById('art-studio-modal'),
      document.getElementById('paint-canvas')
    );
    this.inspector = new Inspector(document.getElementById('inspector-modal'));
    this.recorder = new VideoRecorder(this.canvas);
    this.history = new HistoryManager(50);
    this.demo = new SidehopDemo(this);

    // Component Flyout State & Stored Type Selections
    this.activeFlyoutItem = null;
    this.activeFlyoutSubmenu = { block: 'turf' };
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

    // Track if gun was acquired during this level attempt
    this.gunPickedUpInLevel = false;

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

    this.initStageFrame();
    this.updateCanvasDimensions();
    this.initLevel();
    this.bindUI();
    this.setTheme(this.currentTheme, false);
    this.bindEvents();
    this.initFrameResize();
    this.initDragAndDrop();

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
      SolidBlock.updateTerrainMap(this.entities);
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
    SolidBlock.updateTerrainMap(this.entities);
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
    SolidBlock.updateTerrainMap(this.entities);
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
    this.contextMenuTargetEntity = clickedEnt;
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

    const deselectBtn = document.getElementById('ctx-deselect-item-btn');
    const deselectLabel = document.getElementById('ctx-deselect-item-label');
    if (deselectBtn) {
      if (isMulti && clickedEnt && this.editor.selectedEntities.includes(clickedEnt)) {
        deselectBtn.style.display = 'flex';
        const typeName = clickedEnt.type === 'player' ? 'Player Spawn' : (clickedEnt.variant ? `${clickedEnt.variant} ${clickedEnt.type}` : clickedEnt.type);
        if (deselectLabel) deselectLabel.textContent = `Remove ${typeName.toUpperCase()} from Group`;
      } else {
        deselectBtn.style.display = 'none';
      }
    }

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
    this.contextMenuTargetEntity = null;
  }

  // --- Stretched Frame Mode (Fit Screen Minus Header) ---
  toggleFrameStretch() {
    this.setFrameStretched(!this.isFrameStretched);
  }

  setFrameStretched(stretched) {
    this.isFrameStretched = stretched;
    const workbench = document.querySelector('.workbench-container');
    const stretchIcon = document.getElementById('stretch-frame-icon');
    const stageStretchBtn = document.getElementById('stage-stretch-btn');

    if (this.isFrameStretched) {
      if (workbench) workbench.classList.add('frame-stretched');
      this.updateCanvasDimensions();

      if (stretchIcon) stretchIcon.textContent = '⛶';
      if (stageStretchBtn) {
        stageStretchBtn.querySelector('span').textContent = '⛶';
        stageStretchBtn.title = 'Return to standard frame';
      }
      sounds.playClick();
      this.showToast('⛶ Fullscreen Frame Active');
    } else {
      if (workbench) workbench.classList.remove('frame-stretched');
      this.updateCanvasDimensions();

      if (stretchIcon) stretchIcon.textContent = '⛶';
      if (stageStretchBtn) {
        stageStretchBtn.querySelector('span').textContent = '⛶';
        stageStretchBtn.title = 'Toggle Fullscreen / Fill Screen';
      }
      sounds.playClick();
      this.showToast('⛶ Standard Frame Restored');
    }
  }

  getStageBounds() {
    const workbench = document.querySelector('.workbench-container');
    const sidebarCol = document.getElementById('left-sidebar-column') || document.getElementById('tool-drawer');
    const toolDrawer = document.getElementById('tool-drawer');
    const wbW = workbench ? workbench.clientWidth : window.innerWidth;
    const wbH = workbench ? workbench.clientHeight : (window.innerHeight - 56);
    const drawerVisible = toolDrawer && !toolDrawer.classList.contains('minimized');
    const sidebarRight = sidebarCol ? (sidebarCol.offsetLeft + sidebarCol.offsetWidth) : 188;
    const minLeft = drawerVisible ? (sidebarRight + 18) : 16;
    const minTop = 14;
    const maxRight = Math.max(minLeft + 480, wbW - 24);
    const maxBottom = Math.max(minTop + 320, wbH - 20);
    return { minLeft, minTop, maxRight, maxBottom, availW: maxRight - minLeft, availH: maxBottom - minTop };
  }

  setTheme(themeName, isUserAction = false) {
    if (themeName === 'mixed') themeName = 'uncanny';
    const validThemes = ['grass', 'snowy', 'night', 'chrome', '8-bit', 'jungle', 'neon', 'atlantis', 'uncanny'];
    if (!validThemes.includes(themeName)) themeName = 'grass';
    this.currentTheme = themeName;
    window.__SIDEHOP_THEME__ = themeName;
    document.body.setAttribute('data-theme', themeName);

    try {
      localStorage.setItem('sidehop_theme', themeName);
    } catch (e) {}

    // Update active state in theme-modal cards
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.theme === themeName);
    });

    // Update theme icon/label on header button
    const themeLabel = document.getElementById('theme-label');
    const themeIcon = document.getElementById('theme-icon');
    const themeIcons = {
      'grass': '🌿',
      'snowy': '❄️',
      'night': '🌙',
      'chrome': '⚙️',
      '8-bit': '🕹️',
      'jungle': '🌴',
      'neon': '⚡',
      'atlantis': '🌊',
      'uncanny': '👁️'
    };
    const themeDisplayNames = {
      'grass': 'Meadows',
      'snowy': 'Tundra',
      'night': 'Nightlife',
      'chrome': 'Chrome',
      '8-bit': '8-Bit',
      'jungle': 'Jungle',
      'neon': 'Neon over Black',
      'atlantis': 'Atlantis Underwater',
      'uncanny': '3D'
    };
    const themeToastNames = {
      'grass': 'Meadows',
      'snowy': 'Tundra',
      'night': 'Nightlife',
      'chrome': 'Chrome',
      '8-bit': '8-Bit',
      'jungle': 'Jungle',
      'neon': 'Neon over Black',
      'atlantis': 'Atlantis Underwater',
      'uncanny': '3D'
    };
    if (themeIcon) themeIcon.textContent = themeIcons[themeName] || '🎨';
    if (themeLabel) themeLabel.textContent = `${themeDisplayNames[themeName] || 'Theme'} ▾`;

    // Save with level
    LevelStorage.autoSave(this.player, this.entities, this.background);
    if (isUserAction) {
      this.showToast(`🎨 Theme: ${themeToastNames[themeName] || themeDisplayNames[themeName] || themeName}`);
    }
  }

  initStageFrame() {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    const { minLeft, minTop, availW, availH } = this.getStageBounds();
    // Default to 92% of the available stage area so it's expansive while keeping resize handles comfortably in frame
    const initW = Math.max(480, Math.round(availW * 0.92));
    const initH = Math.max(320, Math.round(availH * 0.92));
    const initLeft = Math.round(minLeft + (availW - initW) / 2);
    const initTop = Math.round(minTop + (availH - initH) / 2);
    this.applyFrameRect(initLeft, initTop, initW, initH);
  }

  applyFrameRect(left, top, width, height) {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    this.frameRect = { left, top, width, height };
    wrapper.style.left = `${Math.round(left)}px`;
    wrapper.style.top = `${Math.round(top)}px`;
    wrapper.style.width = `${Math.round(width)}px`;
    wrapper.style.height = `${Math.round(height)}px`;
  }

  initFrameResize() {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    const handles = wrapper.querySelectorAll('[data-resize]');

    handles.forEach(handle => {
      // Double-click any corner/edge handle to toggle between 100% full stage and default 88% frame
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { minLeft, minTop, maxRight, maxBottom, availW, availH } = this.getStageBounds();
        const cur = this.frameRect || { left: wrapper.offsetLeft, top: wrapper.offsetTop, width: wrapper.offsetWidth, height: wrapper.offsetHeight };
        const isMaximized = Math.abs(cur.width - availW) < 12 && Math.abs(cur.height - availH) < 12;

        if (!isMaximized) {
          this.savedPreMaxRect = { ...cur };
          const dLeft = minLeft - cur.left;
          const dTop = minTop - cur.top;
          this.applyFrameRect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
          this.canvas.width = maxRight - minLeft;
          this.canvas.height = maxBottom - minTop;
          this.camera.viewportWidth = this.canvas.width;
          this.camera.viewportHeight = this.canvas.height;
          this.camera.pan(dLeft, dTop);
          this.showToast('⤢ Stage Maximized');
        } else {
          const restore = this.savedPreMaxRect || {
            left: Math.round(minLeft + availW * 0.06),
            top: Math.round(minTop + availH * 0.06),
            width: Math.round(availW * 0.88),
            height: Math.round(availH * 0.88)
          };
          const dLeft = restore.left - cur.left;
          const dTop = restore.top - cur.top;
          this.applyFrameRect(restore.left, restore.top, restore.width, restore.height);
          this.canvas.width = restore.width;
          this.canvas.height = restore.height;
          this.camera.viewportWidth = this.canvas.width;
          this.camera.viewportHeight = this.canvas.height;
          this.camera.pan(dLeft, dTop);
          this.showToast('⤡ Frame Restored');
        }
        sounds.playClick();
      });

      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || this.isFrameStretched) return;
        e.preventDefault();
        e.stopPropagation();

        const dir = handle.getAttribute('data-resize') || 'se';
        handle.classList.add('dragging');

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const cur = this.frameRect || {
          left: wrapper.offsetLeft,
          top: wrapper.offsetTop,
          width: wrapper.offsetWidth,
          height: wrapper.offsetHeight
        };
        const startLeft = cur.left;
        const startTop = cur.top;
        const startRight = cur.left + cur.width;
        const startBottom = cur.top + cur.height;
        const startCamX = this.camera.x;
        const startCamY = this.camera.y;
        const minW = 480;
        const minH = 320;

        const onMove = (moveEvent) => {
          const dx = moveEvent.clientX - startMouseX;
          const dy = moveEvent.clientY - startMouseY;
          const { minLeft, minTop, maxRight, maxBottom } = this.getStageBounds();

          let newLeft = startLeft;
          let newRight = startRight;
          let newTop = startTop;
          let newBottom = startBottom;

          if (dir.includes('w')) {
            newLeft = Math.max(minLeft, Math.min(startRight - minW, startLeft + dx));
          }
          if (dir.includes('e')) {
            newRight = Math.min(maxRight, Math.max(startLeft + minW, startRight + dx));
          }
          if (dir.includes('n')) {
            newTop = Math.max(minTop, Math.min(startBottom - minH, startTop + dy));
          }
          if (dir.includes('s')) {
            newBottom = Math.min(maxBottom, Math.max(startTop + minH, startBottom + dy));
          }

          const newW = Math.round(newRight - newLeft);
          const newH = Math.round(newBottom - newTop);
          this.applyFrameRect(newLeft, newTop, newW, newH);

          this.canvas.width = newW;
          this.canvas.height = newH;
          this.camera.viewportWidth = newW;
          this.camera.viewportHeight = newH;
          // Shift camera by top-left delta so the world stays anchored on screen while the dragged corner opens up the view
          this.camera.x = startCamX + (newLeft - startLeft);
          this.camera.y = startCamY + (newTop - startTop);
          this.camera.clamp();

          if (this.editor.selectedEntity) {
            this.updateActionCard(this.editor.selectedEntity);
          }
        };

        const onUp = () => {
          handle.classList.remove('dragging');
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });
  }

  updateStretchedDimensions() {
    this.updateCanvasDimensions(true);
  }

  updateCanvasDimensions(force = false) {
    if (!force && this.recorder && this.recorder.isRecording) return;
    if (this.isFrameStretched) {
      const header = document.querySelector('.neo-header');
      const headerH = header ? header.offsetHeight : 56;
      const w = window.innerWidth & ~1;
      const h = (window.innerHeight - headerH) & ~1;

      if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.camera.resize(w, h);
      }
      return;
    }

    const wrapper = this.canvas.parentElement;
    if (wrapper) {
      const w = wrapper.clientWidth & ~1;
      const h = wrapper.clientHeight & ~1;
      if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.camera.resize(w, h);
      }
    }
  }

  initLevel() {
    // 1. Check for standalone embedded level data payload
    const embeddedScript = document.getElementById('sidehop-embedded-level');
    if (embeddedScript && embeddedScript.textContent && embeddedScript.textContent.trim()) {
      try {
        const payload = JSON.parse(embeddedScript.textContent);
        if (payload.theme) {
          this.setTheme(payload.theme);
        }
        if (payload.level) {
          const bg = LevelStorage.deserialize(payload.level, this.player, this.entities);
          if (bg) this.applyBackground(bg);
          this.camera.recenter(this.player.spawnX, this.player.spawnY);
          if (payload.autoPlay) {
            setTimeout(() => {
              if (this.mode !== 'play') this.toggleMode();
            }, 100);
          }
          return;
        }
      } catch (err) {
        console.warn('Error booting embedded standalone level:', err);
      }
    }

    const loadedBg = LevelStorage.autoLoad(this.player, this.entities);
    if (!loadedBg || this.entities.length === 0) {
      this.loadStarterWorld();
    } else {
      this.applyBackground(loadedBg);
      this.camera.recenter(this.player.spawnX, this.player.spawnY);
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
    this.background.theme = bg.customImage ? 'custom' : (bg.theme || this.currentTheme || 'grass');
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
    this.updateBackgroundModalUI();
  }

  updateBackgroundModalUI() {
    const previewImg = document.getElementById('bg-preview-img');
    const placeholder = document.getElementById('bg-preview-placeholder');
    const statusBadge = document.getElementById('bg-status-badge');
    const clearBtn = document.getElementById('bg-clear-custom-btn');
    const exportBtn = document.getElementById('bg-export-sidehop-btn');

    if (this.background.customImage) {
      if (previewImg) {
        previewImg.src = this.background.customImage;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (statusBadge) {
        statusBadge.textContent = 'Custom Active';
        statusBadge.style.background = '#86EFAC';
        statusBadge.style.color = '#14532D';
      }
      if (clearBtn) clearBtn.style.display = 'inline-flex';
      if (exportBtn) exportBtn.style.display = 'inline-flex';
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<span>Using active World Theme (<strong>${(this.currentTheme || 'grass').toUpperCase()}</strong>).<br>No custom background active.</span>`;
      }
      if (statusBadge) {
        statusBadge.textContent = `Theme: ${(this.currentTheme || 'grass').toUpperCase()}`;
        statusBadge.style.background = '#E2E8F0';
        statusBadge.style.color = '#1E293B';
      }
      if (clearBtn) clearBtn.style.display = 'none';
      if (exportBtn) exportBtn.style.display = 'none';
    }
  }

  renderBackground() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.background.customImageElement) {
      this.ctx.drawImage(this.background.customImageElement, 0, 0, w, h);
      return;
    }

    const theme = this.currentTheme || 'grass';

    switch (theme) {
      case 'atlantis': {
        this.drawAtlantisBackground(w, h);
        break;
      }
      case 'uncanny':
      case 'mixed': {
        this.drawUncanny3DBackground(w, h);
        break;
      }
      case 'snowy': {
        this.drawSnowyBackground(w, h);
        break;
      }
      case 'night': {
        this.drawNightBackground(w, h);
        break;
      }
      case 'chrome': {
        this.drawChromeBackground(w, h);
        break;
      }
      case '8-bit': {
        this.draw8BitBackground(w, h);
        break;
      }
      case 'jungle': {
        this.drawJungleBackground(w, h);
        break;
      }
      case 'neon': {
        this.drawNeonBackground(w, h);
        break;
      }
      case 'grass':
      default: {
        this.drawMeadowsBackground(w, h);
        break;
      }
    }
  }

  drawAtlantisBackground(w, h) {
    this.ctx.save();
    const camYShift = Math.max(-90, Math.min(90, -(this.camera.y || 0) * 0.14));

    // 1. Abyssal deep ocean gradient (surface twilight to deep ocean abyss)
    const oceanGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#02182B');
    oceanGrad.addColorStop(0.35, '#052F4E');
    oceanGrad.addColorStop(0.7, '#07486E');
    oceanGrad.addColorStop(1, '#021424');
    this.ctx.fillStyle = oceanGrad;
    this.ctx.fillRect(0, 0, w, h);

    // 2. Volumetric sunlight caustics / light beams angled down from surface
    const time = performance.now() * 0.0008;
    const beamCount = 5;
    for (let i = 0; i < beamCount; i++) {
      const beamX = (w * 0.15) + i * (w * 0.20) + Math.sin(time + i * 1.5) * 28;
      const beamGrad = this.ctx.createLinearGradient(beamX, 0, beamX - 120, h);
      beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.06)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = beamGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(beamX - 30, 0);
      this.ctx.lineTo(beamX + 35, 0);
      this.ctx.lineTo(beamX - 70, h);
      this.ctx.lineTo(beamX - 160, h);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // 3. Distant Atlantean submerged ruins & sunken temple pillars (slow parallax)
    const horizon = h * 0.72 + camYShift * 0.6;
    this.ctx.fillStyle = '#032338';
    const ruinsLoop = 1200;
    const ruinsOff = ((this.camera.x * 0.05) % ruinsLoop + ruinsLoop) % ruinsLoop;

    // Distant seabed silhouette extending well below bottom of canvas
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    for (let x = -200; x <= w + 250; x += 140) {
      const rx = x - (ruinsOff % 140);
      const ry = horizon + Math.sin((x + ruinsOff) * 0.008) * 22;
      this.ctx.lineTo(rx, ry);
    }
    this.ctx.lineTo(w + 250, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Ancient Atlantean pillars & pediments
    [120, 340, 560, 840, 1020].forEach((colX, idx) => {
      const px = ((colX - ruinsOff) % ruinsLoop + ruinsLoop) % ruinsLoop - 100;
      const pBaseY = horizon + Math.sin(colX * 0.008) * 20 + 18;
      const pH = 78 + (idx % 3) * 26;
      this.ctx.fillRect(px, pBaseY - pH, 16, pH + 40);
      this.ctx.fillRect(px - 4, pBaseY - pH - 6, 24, 7);
      this.ctx.fillRect(px - 3, pBaseY - 5, 22, 6);
      if (idx % 2 === 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(px - 14, pBaseY - pH - 6);
        this.ctx.lineTo(px + 8, pBaseY - pH - 24);
        this.ctx.lineTo(px + 30, pBaseY - pH - 6);
        this.ctx.closePath();
        this.ctx.fill();
      }
    });

    // 4. Closer coral reef & swaying sea-kelp silhouette (faster parallax, anchored to h + 160)
    const reefGrad = this.ctx.createLinearGradient(0, horizon, 0, h + 80);
    reefGrad.addColorStop(0, '#063B61');
    reefGrad.addColorStop(1, '#021B30');
    this.ctx.fillStyle = reefGrad;
    const reefLoop = 900;
    const reefOff = ((this.camera.x * 0.12) % reefLoop + reefLoop) % reefLoop;
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    for (let x = -200; x <= w + 240; x += 110) {
      const kx = x - (reefOff % 110);
      const ky = horizon + 24 + Math.cos((x + reefOff) * 0.012) * 24;
      this.ctx.lineTo(kx, ky);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Swaying kelp fronds & bioluminescent reef polyps
    this.ctx.strokeStyle = '#084C7D';
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = 'round';
    for (let k = -150; k <= w + 180; k += 85) {
      const kelpX = k - (reefOff % 85);
      const worldK = k + reefOff;
      const kelpBaseY = horizon + 34 + Math.cos(worldK * 0.012) * 22;
      const kelpHeight = 82 + Math.sin(worldK * 0.02) * 35;
      const sway = Math.sin(time * 1.8 + worldK * 0.03) * 18;
      this.ctx.beginPath();
      this.ctx.moveTo(kelpX, kelpBaseY + 35);
      this.ctx.quadraticCurveTo(kelpX + sway * 0.5, kelpBaseY - kelpHeight * 0.5, kelpX + sway, kelpBaseY - kelpHeight);
      this.ctx.stroke();

      // Glowing cyan/coral bioluminescent tip
      this.ctx.fillStyle = (Math.abs(Math.round(worldK / 85)) % 2 === 0) ? 'rgba(56, 189, 248, 0.55)' : 'rgba(244, 114, 182, 0.5)';
      this.ctx.beginPath();
      this.ctx.arc(kelpX + sway, kelpBaseY - kelpHeight, 3.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 5. Rising translucent air bubbles with wobble
    this.bubbles.forEach(b => {
      b.y -= b.speed;
      b.x = b.baseX + Math.sin(performance.now() * b.wobbleSpeed) * b.wobbleAmp - (this.camera.x * 0.08);
      if (b.y < -15) {
        b.y = h + 15;
        b.baseX = Math.random() * (w + 400);
      }
      const drawX = ((b.x % (w + 200)) + (w + 200)) % (w + 200) - 100;

      this.ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
      this.ctx.strokeStyle = 'rgba(224, 242, 254, 0.75)';
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.arc(drawX, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.beginPath();
      this.ctx.arc(drawX - b.radius * 0.35, b.y - b.radius * 0.35, Math.max(0.8, b.radius * 0.28), 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  getLifelikeCloudSprite(variant = 0) {
    if (!this._lifelikeCloudCache) this._lifelikeCloudCache = {};
    if (this._lifelikeCloudCache[variant]) return this._lifelikeCloudCache[variant];

    const cw = 260;
    const ch = 130;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d');

    const puffSets = [
      [ [68, 76, 36], [104, 54, 46], [148, 58, 42], [186, 76, 32], [126, 78, 38], [88, 82, 32], [160, 82, 32] ],
      [ [62, 78, 32], [96, 60, 40], [138, 50, 48], [178, 70, 36], [118, 78, 38], [156, 80, 32] ]
    ];
    const puffs = puffSets[variant % puffSets.length];

    // 1. Soft atmospheric drop shadow underneath cloud base
    const baseShadow = g.createRadialGradient(128, 96, 10, 128, 96, 95);
    baseShadow.addColorStop(0, 'rgba(22, 54, 98, 0.30)');
    baseShadow.addColorStop(0.65, 'rgba(30, 68, 118, 0.14)');
    baseShadow.addColorStop(1, 'rgba(30, 68, 118, 0)');
    g.fillStyle = baseShadow;
    g.beginPath();
    g.ellipse(128, 96, 92, 20, 0, 0, Math.PI * 2);
    g.fill();

    // 2. Ambient-occluded cool lavender-slate under-volume
    puffs.forEach(([px, py, pr]) => {
      const aoGrad = g.createRadialGradient(px, py + pr * 0.22, pr * 0.05, px, py + 4, pr * 1.06);
      aoGrad.addColorStop(0, '#CBD5E1');
      aoGrad.addColorStop(0.58, '#94A3B8');
      aoGrad.addColorStop(0.85, 'rgba(148, 163, 184, 0.55)');
      aoGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
      g.fillStyle = aoGrad;
      g.beginPath();
      g.arc(px, py + 4, pr * 1.06, 0, Math.PI * 2);
      g.fill();
    });

    // 3. Seamless volumetric cloud body (soft feathered radial puffs without dark rims!)
    puffs.forEach(([px, py, pr]) => {
      const bodyGrad = g.createRadialGradient(px - pr * 0.22, py - pr * 0.28, pr * 0.08, px, py, pr * 1.04);
      bodyGrad.addColorStop(0, '#FFFFFF');
      bodyGrad.addColorStop(0.55, '#F8FAFC');
      bodyGrad.addColorStop(0.82, 'rgba(241, 245, 249, 0.88)');
      bodyGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      g.fillStyle = bodyGrad;
      g.beginPath();
      g.arc(px, py, pr * 1.04, 0, Math.PI * 2);
      g.fill();
    });

    // 4. Top-left warm ivory sun-kissed rim highlights (subsurface scattering)
    puffs.forEach(([px, py, pr]) => {
      const sunGrad = g.createRadialGradient(px - pr * 0.32, py - pr * 0.36, 2, px - pr * 0.18, py - pr * 0.22, pr * 0.72);
      sunGrad.addColorStop(0, 'rgba(255, 255, 250, 0.96)');
      sunGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
      sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      g.fillStyle = sunGrad;
      g.beginPath();
      g.arc(px - pr * 0.12, py - pr * 0.14, pr * 0.72, 0, Math.PI * 2);
      g.fill();
    });

    this._lifelikeCloudCache[variant] = c;
    return c;
  }

  drawUncanny3DBackground(w, h) {
    this.ctx.save();
    const animTime = performance.now() * 0.001;
    // Vertical camera parallax clamped so jumping high NEVER exposes the bottom
    const camYShift = Math.max(-75, Math.min(75, -(this.camera.y || 0) * 0.15));

    // Layer 0: Deep Atmospheric Twilight Obsidian-to-Amber Studio Diorama Horizon (Distinct, non-Mario aesthetic!)
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0F172A');     // Deep slate obsidian zenith
    skyGrad.addColorStop(0.35, '#1E293B');   // Moody indigo
    skyGrad.addColorStop(0.62, '#334155');   // Rich dusk slate
    skyGrad.addColorStop(0.82, '#64748B');   // Luminous twilight transition
    skyGrad.addColorStop(0.94, '#D97706');   // Warm amber dusk glow
    skyGrad.addColorStop(1, '#92400E');      // Rich burnt amber-terracotta rim
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    // Subtle atmospheric studio key light (warm amber-rose glow on upper-left)
    const keyGlow = this.ctx.createRadialGradient(w * 0.20, h * 0.18, 12, w * 0.20, h * 0.18, Math.max(w, h) * 0.70);
    keyGlow.addColorStop(0, 'rgba(254, 215, 170, 0.28)');
    keyGlow.addColorStop(0.40, 'rgba(251, 146, 60, 0.12)');
    keyGlow.addColorStop(0.80, 'rgba(147, 51, 234, 0.05)');
    keyGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = keyGlow;
    this.ctx.fillRect(0, 0, w, h);

    // Layer 1: Stylized Volumetric Diorama Clouds with warm ambient rim underglow (No CAD grid in play mode!)
    const cloudDefs = [
      { baseCol: 70, y: 36, scale: 1.05, speed: 0.05, variant: 0 },
      { baseCol: 430, y: 84, scale: 0.86, speed: 0.08, variant: 1 },
      { baseCol: 790, y: 28, scale: 1.18, speed: 0.04, variant: 0 },
      { baseCol: 1150, y: 92, scale: 0.94, speed: 0.07, variant: 1 }
    ];
    const cloudLoop = 1440;
    cloudDefs.forEach((c, idx) => {
      let cx = (c.baseCol - this.camera.x * c.speed + animTime * 3.0 * (idx % 2 === 0 ? 1 : 0.75)) % cloudLoop;
      if (cx < -280) cx += cloudLoop;
      const cy = c.y + camYShift * 0.25;
      const sprite = this.getLifelikeCloudSprite(c.variant);
      this.ctx.drawImage(sprite, cx, cy, sprite.width * c.scale, sprite.height * c.scale);
    });

    const horizon = h * 0.64 + camYShift * 0.55;

    // Layer 2: Distant Monolithic Basalt & Crystalline Strata Ridges (0.04x parallax)
    const distGrad = this.ctx.createLinearGradient(0, horizon - 120, 0, h + 100);
    distGrad.addColorStop(0, '#475569');
    distGrad.addColorStop(0.35, '#334155');
    distGrad.addColorStop(0.70, '#1E293B');
    distGrad.addColorStop(1, '#0F172A');
    this.ctx.fillStyle = distGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(-100, h + 220);
    for (let sx = -60; sx <= w + 60; sx += 20) {
      const wx = sx + this.camera.x * 0.04;
      // Sculpted angular geometric mountain strata
      const y = horizon - 52
        - Math.sin(wx * 0.005) * 44
        - Math.cos(wx * 0.014) * 22
        + Math.sin(wx * 0.032) * 8;
      this.ctx.lineTo(sx, y);
    }
    this.ctx.lineTo(w + 100, h + 220);
    this.ctx.closePath();
    this.ctx.fill();

    // Layer 3: Midground Terraced Mineral Strata & Sculpted Stepped Mesas (0.08x parallax)
    const hillLoop1 = 1040;
    const hillOff1 = ((this.camera.x * 0.08) % hillLoop1 + hillLoop1) % hillLoop1;
    for (let x = -360; x < w + 460; x += 260) {
      const hx = x - (hillOff1 % 260);
      const hillIndex = Math.round((x + hillOff1 - (hillOff1 % 260)) / 260);
      const domeW = 240;
      const crestY = horizon - 32 + Math.sin(hillIndex * 1.7) * 20;

      // Soft ambient occlusion shadow
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      this.ctx.beginPath();
      this.ctx.moveTo(hx - domeW, h + 220);
      this.ctx.lineTo(hx - domeW, crestY + 130);
      this.ctx.bezierCurveTo(hx - domeW * 0.55, crestY - 14, hx + domeW * 0.55, crestY - 14, hx + domeW + 14, crestY + 130);
      this.ctx.lineTo(hx + domeW + 14, h + 220);
      this.ctx.closePath();
      this.ctx.fill();

      // Rich 3D mineral graphite & warm bronze strata
      const hillGrad1 = this.ctx.createRadialGradient(
        hx - domeW * 0.26,
        crestY + 34,
        16,
        hx + 20,
        crestY + 170,
        domeW * 1.35
      );
      hillGrad1.addColorStop(0, '#64748B');
      hillGrad1.addColorStop(0.30, '#475569');
      hillGrad1.addColorStop(0.65, '#334155');
      hillGrad1.addColorStop(0.90, '#1E293B');
      hillGrad1.addColorStop(1, '#0F172A');
      this.ctx.fillStyle = hillGrad1;

      this.ctx.beginPath();
      this.ctx.moveTo(hx - domeW, h + 220);
      this.ctx.lineTo(hx - domeW, crestY + 135);
      this.ctx.bezierCurveTo(hx - domeW * 0.55, crestY - 8, hx + domeW * 0.55, crestY - 8, hx + domeW, crestY + 135);
      this.ctx.lineTo(hx + domeW, h + 220);
      this.ctx.closePath();
      this.ctx.fill();

      // Sleek warm bronze rim specular along crest
      this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(hx - domeW * 0.65, crestY + 45);
      this.ctx.quadraticCurveTo(hx, crestY - 8, hx + domeW * 0.65, crestY + 45);
      this.ctx.stroke();
    }

    // Layer 4: Foreground Tactile Sculptural Terraces & Geometric Diorama Plateaus (0.13x parallax)
    const hillLoop2 = 880;
    const hillOff2 = ((this.camera.x * 0.13) % hillLoop2 + hillLoop2) % hillLoop2;
    for (let x = -320; x < w + 420; x += 220) {
      const hx = x - (hillOff2 % 220);
      const hillIndex = Math.round((x + hillOff2 - (hillOff2 % 220)) / 220);
      const domeW = 205;
      const crestY = horizon + 16 + Math.cos(hillIndex * 2.1) * 16;

      // Deep cast shadow
      this.ctx.fillStyle = 'rgba(10, 15, 28, 0.52)';
      this.ctx.beginPath();
      this.ctx.moveTo(hx - domeW, h + 220);
      this.ctx.lineTo(hx - domeW, crestY + 135);
      this.ctx.bezierCurveTo(hx - domeW * 0.52, crestY - 12, hx + domeW * 0.52, crestY - 12, hx + domeW + 12, crestY + 135);
      this.ctx.lineTo(hx + domeW + 12, h + 220);
      this.ctx.closePath();
      this.ctx.fill();

      // Tactile slate-terracotta volumetric diorama plateaus
      const hillGrad2 = this.ctx.createRadialGradient(
        hx - domeW * 0.25,
        crestY + 32,
        12,
        hx + 18,
        crestY + 165,
        domeW * 1.32
      );
      hillGrad2.addColorStop(0, '#94A3B8');
      hillGrad2.addColorStop(0.25, '#64748B');
      hillGrad2.addColorStop(0.58, '#334155');
      hillGrad2.addColorStop(0.85, '#1E293B');
      hillGrad2.addColorStop(1, '#0F172A');
      this.ctx.fillStyle = hillGrad2;

      this.ctx.beginPath();
      this.ctx.moveTo(hx - domeW, h + 220);
      this.ctx.lineTo(hx - domeW, crestY + 140);
      this.ctx.bezierCurveTo(hx - domeW * 0.52, crestY - 6, hx + domeW * 0.52, crestY - 6, hx + domeW, crestY + 140);
      this.ctx.lineTo(hx + domeW, h + 220);
      this.ctx.closePath();
      this.ctx.fill();

      // Atmospheric specular rim highlight along sunlit edge
      const rimGrad = this.ctx.createLinearGradient(hx - domeW * 0.7, crestY, hx + domeW * 0.2, crestY + 80);
      rimGrad.addColorStop(0, 'rgba(254, 215, 170, 0.50)');
      rimGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.25)');
      rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.strokeStyle = rimGrad;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(hx - domeW * 0.82, crestY + 95);
      this.ctx.quadraticCurveTo(hx - domeW * 0.25, crestY + 6, hx + domeW * 0.28, crestY + 26);
      this.ctx.stroke();

      // Atmospheric ambient floating light motes / celestial diorama particles (warm gold & cool cyan)
      for (let f = 0; f < 5; f++) {
        const seed = Math.abs(hillIndex * 37 + f * 19);
        const normX = -0.60 + (f / 4) * 1.20;
        const fx = hx + normX * (domeW * 0.80);
        const floatY = (animTime * 14 + seed * 23) % 90;
        const fy = crestY + 30 + ((seed % 7) * 9) - floatY;
        if (fy > crestY - 60 && fy < h) {
          const isGold = (seed % 2 === 0);
          const r = 2.4 + (seed % 3) * 1.0;
          this.ctx.fillStyle = isGold ? 'rgba(251, 191, 36, 0.85)' : 'rgba(56, 189, 248, 0.85)';
          this.ctx.beginPath();
          this.ctx.arc(fx, fy, r, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    this.ctx.restore();
  }

  drawMixedMediaBackground(w, h) {
    this.drawUncanny3DBackground(w, h);
  }

  drawSnowyBackground(w, h) {
    this.ctx.save();
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#7FB0DF');
    grad.addColorStop(0.50, '#C5DDF2');
    grad.addColorStop(0.82, '#E2EFFA');
    grad.addColorStop(1, '#B8D0E8');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    this.drawSnowyMountains(w, h);
    this.drawSnowflakes(w, h);
    this.ctx.restore();
  }

  drawNightBackground(w, h) {
    this.ctx.save();
    const camYShift = Math.max(-80, Math.min(80, -(this.camera.y || 0) * 0.14));
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#040814');
    grad.addColorStop(0.55, '#0B132B');
    grad.addColorStop(1, '#1C2541');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    this.drawStars(w, h);
    this.drawCrescentMoon(w, h);

    // Layer 1: Distant nocturnal mountain range
    const horizon = h * 0.72 + camYShift * 0.5;
    this.ctx.fillStyle = '#0D1730';
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    const loop1 = 900;
    const off1 = ((this.camera.x * 0.05) % loop1 + loop1) % loop1;
    for (let x = -200; x <= w + 240; x += 150) {
      const hx = x - (off1 % 150);
      const hy = horizon - 55 + Math.sin((x + off1) * 0.009) * 34;
      this.ctx.lineTo(hx, hy);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Layer 2: Closer midnight ridge silhouette extending well below h
    this.ctx.fillStyle = '#070B18';
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    const loop2 = 800;
    const off2 = ((this.camera.x * 0.09) % loop2 + loop2) % loop2;
    for (let x = -200; x <= w + 240; x += 160) {
      const hx = x - (off2 % 160);
      const hy = horizon - 18 + Math.cos((x + off2) * 0.012) * 28;
      this.ctx.lineTo(hx, hy);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawChromeBackground(w, h) {
    this.ctx.save();
    const time = performance.now() * 0.001;
    const camYShift = Math.max(-75, Math.min(75, -(this.camera.y || 0) * 0.12));
    const horizon = h * 0.68 + camYShift * 0.5;

    // 1. Titanium brushed steel sky gradient above horizon
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#070A10');
    skyGrad.addColorStop(0.38, '#131C2E');
    skyGrad.addColorStop(0.75, '#24334A');
    skyGrad.addColorStop(0.95, '#64748B');
    skyGrad.addColorStop(1, '#E2E8F0');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, Math.max(0, horizon));

    // Metallic floor gradient below horizon extending all the way to h
    const floorGrad = this.ctx.createLinearGradient(0, horizon, 0, h);
    floorGrad.addColorStop(0, '#334155');
    floorGrad.addColorStop(0.18, '#1E293B');
    floorGrad.addColorStop(0.55, '#0F172A');
    floorGrad.addColorStop(1, '#070B14');
    this.ctx.fillStyle = floorGrad;
    this.ctx.fillRect(0, Math.max(0, horizon), w, h - Math.max(0, horizon) + 40);

    // 2. Sweeping Animated Volumetric Cyber Searchlights across the night sky
    const searchlights = [-0.25, 0.35, -0.15];
    searchlights.forEach((baseAngle, sIdx) => {
      const sweep = Math.sin(time * 0.6 + sIdx * 2.1) * 0.45;
      const angle = baseAngle + sweep;
      const originX = (w * 0.25) + sIdx * (w * 0.3) - (this.camera.x * 0.03);
      this.ctx.save();
      this.ctx.translate(originX, horizon);
      this.ctx.rotate(angle);
      const beamGrad = this.ctx.createLinearGradient(0, 0, 0, -h * 1.2);
      beamGrad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
      beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = beamGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(-10, 0);
      this.ctx.lineTo(-70, -h * 1.2);
      this.ctx.lineTo(70, -h * 1.2);
      this.ctx.lineTo(10, 0);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    });

    // 3. Floating 3D Chrome Gyroscopic Rings in Upper Sky (Liquid Mercury Gyroscope)
    const gyroX = ((w * 0.78 - (this.camera.x * 0.03)) % (w + 200) + (w + 200)) % (w + 200) - 100;
    const gyroY = h * 0.24 + camYShift * 0.25;
    this.ctx.save();
    this.ctx.translate(gyroX, gyroY);
    this.ctx.rotate(time * 0.4);
    const ringGrad1 = this.ctx.createLinearGradient(-45, -45, 45, 45);
    ringGrad1.addColorStop(0, '#FFFFFF');
    ringGrad1.addColorStop(0.3, '#64748B');
    ringGrad1.addColorStop(0.6, '#F8FAFC');
    ringGrad1.addColorStop(1, '#1E293B');
    this.ctx.strokeStyle = ringGrad1;
    this.ctx.lineWidth = 4.5;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 48, 22, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.rotate(-time * 0.85);
    const ringGrad2 = this.ctx.createLinearGradient(-30, 30, 30, -30);
    ringGrad2.addColorStop(0, '#38BDF8');
    ringGrad2.addColorStop(0.5, '#FFFFFF');
    ringGrad2.addColorStop(1, '#0F172A');
    this.ctx.strokeStyle = ringGrad2;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 32, 14, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    const sphereGrad = this.ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
    sphereGrad.addColorStop(0, '#FFFFFF');
    sphereGrad.addColorStop(0.4, '#CBD5E1');
    sphereGrad.addColorStop(0.85, '#334155');
    sphereGrad.addColorStop(1, '#0F172A');
    this.ctx.fillStyle = sphereGrad;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 13, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // 4. Distant Industrial Megastructures with Blinking Beacon Lights
    this.ctx.fillStyle = '#1A2333';
    const structLoop = 900;
    const structOff = ((this.camera.x * 0.04) % structLoop + structLoop) % structLoop;
    for (let x = -160; x < w + 300; x += 160) {
      const tx = x - (structOff % 160);
      const worldX = x + structOff;
      const tH = 95 + Math.sin(worldX * 0.01) * 35;
      this.ctx.fillRect(tx, horizon - tH, 38, tH);
      this.ctx.fillRect(tx + 46, horizon - (tH * 0.7), 54, tH * 0.7);

      const beaconOn = Math.sin(time * 4.5 + worldX * 0.05) > 0;
      this.ctx.fillStyle = beaconOn ? '#EF4444' : '#450A0A';
      this.ctx.beginPath();
      this.ctx.arc(tx + 19, horizon - tH - 4, 3, 0, Math.PI * 2);
      this.ctx.fill();

      const beaconCyan = Math.cos(time * 3.5 + worldX * 0.08) > 0;
      this.ctx.fillStyle = beaconCyan ? '#00E5FF' : '#083344';
      this.ctx.beginPath();
      this.ctx.arc(tx + 73, horizon - (tH * 0.7) - 4, 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#1A2333';
    }

    // 5. Midground Heavy Industrial Chrome Cogwheels & Truss Girders
    const gearLoop = 700;
    const gearOff = ((this.camera.x * 0.08) % gearLoop + gearLoop) % gearLoop;
    [180, 520].forEach((gx, idx) => {
      const drawGx = ((gx - gearOff) % (w + 200) + (w + 200)) % (w + 200) - 100;
      const drawGy = horizon - 55;
      const rot = (time * 0.35) * (idx % 2 === 0 ? 1 : -1);

      this.ctx.save();
      this.ctx.translate(drawGx, drawGy);
      this.ctx.rotate(rot);

      this.ctx.strokeStyle = '#334155';
      this.ctx.lineWidth = 7;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 42, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 44, 0, Math.PI);
      this.ctx.stroke();

      const teeth = 8;
      for (let t = 0; t < teeth; t++) {
        const ang = t * (Math.PI * 2 / teeth);
        this.ctx.fillStyle = '#475569';
        this.ctx.fillRect(Math.cos(ang) * 40 - 5, Math.sin(ang) * 40 - 5, 10, 10);
      }

      this.ctx.fillStyle = '#1E293B';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 16, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#64748B';
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      this.ctx.restore();
    });

    // 6. Polished Chrome Horizon Line with Moving Specular Sheen
    const sheenX = ((time * 180) % (w + 400)) - 200;
    const sheenGrad = this.ctx.createRadialGradient(sheenX, horizon, 0, sheenX, horizon, 150);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    sheenGrad.addColorStop(0.35, 'rgba(203, 213, 225, 0.35)');
    sheenGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');
    this.ctx.fillStyle = sheenGrad;
    this.ctx.fillRect(0, horizon - 12, w, 24);

    this.ctx.strokeStyle = '#CBD5E1';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizon);
    this.ctx.lineTo(w, horizon);
    this.ctx.stroke();

    // 7. Perspective Cybernetic Metallic Deck Plane (horizontal + longitudinal lines down to h)
    const groundLines = 10;
    for (let i = 1; i <= groundLines; i++) {
      const t = Math.pow(i / groundLines, 2.0);
      const gy = horizon + t * (h - horizon);
      this.ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 + t * 0.35})`;
      this.ctx.lineWidth = 1 + t * 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, gy);
      this.ctx.lineTo(w, gy);
      this.ctx.stroke();
    }

    // 8. Animated Chrome Sparks & Starburst Gleams
    if (this.chromeSparks) {
      this.chromeSparks.forEach(p => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = horizon + Math.random() * 40;
          p.x = Math.random() * 2000;
        }
        const drawPx = ((p.x - this.camera.x * 0.09) % (w + 100) + (w + 100)) % (w + 100) - 50;
        const twinkle = (Math.sin(time * 5 + p.twinklePhase) + 1) * 0.5;

        this.ctx.save();
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = 0.35 + twinkle * 0.65;

        if (p.isStarburst) {
          const sz = p.size * (1 + twinkle * 0.9);
          this.ctx.fillRect(drawPx - sz, p.y - 1, sz * 2, 2);
          this.ctx.fillRect(drawPx - 1, p.y - sz, 2, sz * 2);
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.fillRect(drawPx - 1.5, p.y - 1.5, 3, 3);
        } else {
          this.ctx.beginPath();
          this.ctx.arc(drawPx, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();
      });
    }

    this.ctx.restore();
  }

  drawMeadowsBackground(w, h) {
    this.ctx.save();
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3B82F6');
    grad.addColorStop(0.55, '#93C5FD');
    grad.addColorStop(0.85, '#BAE6FD');
    grad.addColorStop(1, '#86EFAC');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    this.drawParallaxClouds(w, h);
    this.drawParallaxHills(w, h);
    this.ctx.restore();
  }

  drawSnowyMountains(w, h) {
    this.ctx.save();
    const camYShift = Math.max(-80, Math.min(80, -(this.camera.y || 0) * 0.14));
    const horizon = h * 0.70 + camYShift * 0.5;

    // Layer 1: Distant pale mountains anchored to h + 160
    this.ctx.fillStyle = '#C1D5E8';
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    const loopW1 = 1200;
    const off1 = ((this.camera.x * 0.05) % loopW1 + loopW1) % loopW1;
    for (let x = -200; x <= w + 240; x += 180) {
      const peakX = x - (off1 % 180);
      const worldX = x + off1 - (off1 % 180);
      const peakH = 95 + Math.sin(worldX * 0.02) * 40;
      this.ctx.lineTo(peakX, horizon - peakH);
      this.ctx.lineTo(peakX + 90, horizon - 10);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Layer 2: Closer sharp mountain range with white snow caps anchored to h + 160
    this.ctx.fillStyle = '#8FA9C4';
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    const loopW2 = 1000;
    const off2 = ((this.camera.x * 0.12) % loopW2 + loopW2) % loopW2;
    const peaks = [];
    for (let x = -200; x <= w + 240; x += 160) {
      const peakX = x - (off2 % 160);
      const worldX = x + off2 - (off2 % 160);
      const peakH = 130 + Math.cos(worldX * 0.015) * 50;
      peaks.push({ x: peakX, topY: horizon - peakH });
      this.ctx.lineTo(peakX, horizon - peakH);
      this.ctx.lineTo(peakX + 80, horizon + 6);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Snow caps
    this.ctx.fillStyle = '#FFFFFF';
    peaks.forEach(p => {
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.topY);
      this.ctx.lineTo(p.x - 24, p.topY + 36);
      this.ctx.lineTo(p.x - 8, p.topY + 28);
      this.ctx.lineTo(p.x + 8, p.topY + 34);
      this.ctx.lineTo(p.x + 24, p.topY + 36);
      this.ctx.closePath();
      this.ctx.fill();
    });

    // Layer 3: Rolling foreground snow drifts extending to h + 160
    const driftGrad = this.ctx.createLinearGradient(0, horizon + 10, 0, h + 80);
    driftGrad.addColorStop(0, '#E2EEF8');
    driftGrad.addColorStop(1, '#B8CFE6');
    this.ctx.fillStyle = driftGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    const off3 = ((this.camera.x * 0.16) % 800 + 800) % 800;
    for (let x = -200; x <= w + 240; x += 200) {
      const dx = x - (off3 % 200);
      this.ctx.quadraticCurveTo(dx + 100, horizon + 8, dx + 200, horizon + 36);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawSnowflakes(w, h) {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.snowflakes.forEach(s => {
      s.y += s.speed;
      s.x += s.drift + Math.sin(performance.now() * 0.0015 + s.radius) * 0.4;
      if (s.y > h) s.y = -6;
      if (s.x > w + 20) s.x = -20;
      if (s.x < -20) s.x = w + 20;

      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.restore();
  }

  drawCrescentMoon(w, h) {
    this.ctx.save();
    const moonX = Math.max(70, w - 120);
    const moonY = 85;
    const radius = 28;

    const glow = this.ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 60);
    glow.addColorStop(0, 'rgba(254, 243, 199, 0.35)');
    glow.addColorStop(1, 'rgba(254, 243, 199, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(moonX, moonY, 60, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#FEF3C7';
    this.ctx.beginPath();
    this.ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#080E20';
    this.ctx.beginPath();
    this.ctx.arc(moonX - 9, moonY - 6, radius - 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawChromeGrid(w, h) {
    this.ctx.save();
    const horizon = h * 0.62;

    const bldOff = (this.camera.x * 0.05) % 400;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = -200; x < w + 400; x += 80) {
      this.ctx.fillRect(x - bldOff, 0, 78, horizon);
    }

    this.ctx.strokeStyle = '#94A3B8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizon);
    this.ctx.lineTo(w, horizon);
    this.ctx.stroke();

    const numFloorLines = 14;
    for (let i = 1; i <= numFloorLines; i++) {
      const t = Math.pow(i / numFloorLines, 2);
      const y = horizon + t * (h - horizon);
      this.ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 + t * 0.28})`;
      this.ctx.lineWidth = 1 + t * 1.2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawNeonBackground(w, h) {
    this.ctx.save();
    const camYShift = Math.max(-75, Math.min(75, -(this.camera.y || 0) * 0.12));

    // Pure deep black background void
    this.ctx.fillStyle = '#030305';
    this.ctx.fillRect(0, 0, w, h);

    const horizon = h * 0.65 + camYShift * 0.45;

    // Glowing horizontal light bar at horizon
    const glowGrad = this.ctx.createLinearGradient(0, horizon - 32, 0, horizon + 32);
    glowGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
    glowGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.26)');
    glowGrad.addColorStop(0.7, 'rgba(255, 0, 127, 0.22)');
    glowGrad.addColorStop(1, 'rgba(255, 0, 127, 0)');
    this.ctx.fillStyle = glowGrad;
    this.ctx.fillRect(0, horizon - 32, w, 64);

    // Crisp neon laser horizon line
    const lineGrad = this.ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, '#00E5FF');
    lineGrad.addColorStop(0.5, '#FF007F');
    lineGrad.addColorStop(1, '#00FF66');
    this.ctx.strokeStyle = lineGrad;
    this.ctx.lineWidth = 2.0;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizon);
    this.ctx.lineTo(w, horizon);
    this.ctx.stroke();

    // Sleek geometric neon vector ground lines receding to horizon
    const groundLines = 9;
    for (let i = 1; i <= groundLines; i++) {
      const t = Math.pow(i / groundLines, 2.1);
      const gy = horizon + t * (h - horizon);
      this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.09 + t * 0.28})`;
      this.ctx.lineWidth = 1 + t * 1.2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, gy);
      this.ctx.lineTo(w, gy);
      this.ctx.stroke();
    }

    // Floating vibrant neon stardust particles
    const neonColors = ['#00E5FF', '#FF007F', '#00FF66', '#FFE600'];
    const pOffX = (this.camera.x * 0.08);
    for (let i = 0; i < 48; i++) {
      const seedX = (i * 137.5) % 1200;
      const seedY = (i * 73.1) % (h * 0.9);
      const px = ((seedX - pOffX) % w + w) % w;
      const py = seedY;
      const size = 1.5 + (i % 3);
      const color = neonColors[i % neonColors.length];

      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.25;
      this.ctx.beginPath();
      this.ctx.arc(px, py, size * 2.2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.globalAlpha = 0.9;
      this.ctx.beginPath();
      this.ctx.arc(px, py, size * 0.7, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  draw8BitBackground(w, h) {
    this.ctx.save();
    const camYShift = Math.max(-75, Math.min(75, -(this.camera.y || 0) * 0.14));

    // Classic NES Cornflower Sky Fill (so white canvas background never shows through!)
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#5C94FC');
    skyGrad.addColorStop(0.75, '#78A8FE');
    skyGrad.addColorStop(1, '#00A800');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    // 8-bit stepped pixel clouds
    this.ctx.fillStyle = '#FFFFFF';
    const cloudLoop = 800;
    const off = ((this.camera.x * 0.1) % cloudLoop + cloudLoop) % cloudLoop;
    [100, 360, 620].forEach((cx, idx) => {
      for (let rep = -cloudLoop; rep <= w + cloudLoop; rep += cloudLoop) {
        const x = cx - off + rep;
        if (x < -100 || x > w + 100) continue;
        const y = 60 + idx * 35 + camYShift * 0.25;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + 4, y + 16, 64, 16);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(x, y + 12, 64, 16);
        this.ctx.fillRect(x + 10, y + 4, 44, 16);
        this.ctx.fillRect(x + 20, y, 24, 8);
      }
    });

    // 8-bit rolling green hills extending all the way down to h + 180 (never cutting off!)
    const hillHorizon = h * 0.72 + camYShift * 0.5;
    const hillLoop = 600;
    const hOff = ((this.camera.x * 0.15) % hillLoop + hillLoop) % hillLoop;

    // Distant darker 8-bit bushes/hills
    this.ctx.fillStyle = '#007800';
    this.ctx.fillRect(0, hillHorizon + 28, w, h - hillHorizon + 160);

    for (let x = -300; x < w + 400; x += 300) {
      const hx = x - (hOff % 300);
      const centerX = hx + 150;
      const domeR = 160;
      const domeY = hillHorizon + 50;

      this.ctx.fillStyle = '#00A800';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - domeR, h + 180);
      this.ctx.lineTo(centerX - domeR, domeY);
      this.ctx.arc(centerX, domeY, domeR, Math.PI, 0, false);
      this.ctx.lineTo(centerX + domeR, h + 180);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Retro dither dots on hill face
      this.ctx.fillStyle = '#000000';
      for (let dotY = hillHorizon - 25; dotY < hillHorizon + 35; dotY += 14) {
        this.ctx.fillRect(centerX - 10 + Math.sin(dotY) * 18, dotY, 4, 4);
      }
    }

    this.ctx.restore();
  }

  drawJungleBackground(w, h) {
    this.ctx.save();
    const time = performance.now() * 0.001;
    const camYShift = Math.max(-75, Math.min(75, -(this.camera.y || 0) * 0.14));

    // 1. Primeval rainforest canopy dusk & emerald mist gradient
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#02140A');
    grad.addColorStop(0.35, '#064E3B');
    grad.addColorStop(0.65, '#0F766E');
    grad.addColorStop(0.80, '#34D399');
    grad.addColorStop(1, '#042212');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // 2. Volumetric Animated Golden God Rays
    for (let i = 0; i < 5; i++) {
      const rx = (w * 0.12) + i * (w * 0.21) + Math.sin(time * 0.8 + i * 1.4) * 35;
      const rGrad = this.ctx.createLinearGradient(rx, 0, rx + 160, h);
      rGrad.addColorStop(0, 'rgba(253, 224, 71, 0.17)');
      rGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.06)');
      rGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = rGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(rx - 40, 0);
      this.ctx.lineTo(rx + 50, 0);
      this.ctx.lineTo(rx + 200, h);
      this.ctx.lineTo(rx + 80, h);
      this.ctx.closePath();
      this.ctx.fill();
    }

    const horizon = h * 0.72 + camYShift * 0.5;

    // 3. Distant Ancient Mayan Temple Pyramid Silhouette
    const pyrLoop = 1100;
    const pyrOff = ((this.camera.x * 0.04) % pyrLoop + pyrLoop) % pyrLoop;
    const pyrX = ((560 - pyrOff) % (w + 400) + (w + 400)) % (w + 400) - 200;
    this.ctx.fillStyle = '#062F22';
    this.ctx.fillRect(pyrX - 75, horizon - 32, 150, 60);
    this.ctx.fillRect(pyrX - 54, horizon - 58, 108, 26);
    this.ctx.fillRect(pyrX - 35, horizon - 80, 70, 22);
    this.ctx.fillRect(pyrX - 16, horizon - 96, 32, 16);

    this.ctx.fillStyle = '#083D2D';
    this.ctx.fillRect(pyrX - 8, horizon - 96, 16, 116);

    // 4. Distant Jungle Ridge Silhouettes & Cascading Waterfall anchored to h + 160
    this.ctx.fillStyle = '#083E2C';
    const ridgeLoop = 800;
    const ridgeOff = ((this.camera.x * 0.06) % ridgeLoop + ridgeLoop) % ridgeLoop;
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    for (let x = -200; x <= w + 240; x += 160) {
      const rx = x - (ridgeOff % 160);
      const ry = horizon - 20 + Math.sin((x + ridgeOff) * 0.015) * 22;
      this.ctx.lineTo(rx, ry);
    }
    this.ctx.lineTo(w + 240, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Cascading distant waterfall flowing between ridges
    const wfX = ((320 - ridgeOff) % (w + 400) + (w + 400)) % (w + 400) - 100;
    const wfGrad = this.ctx.createLinearGradient(wfX, horizon - 15, wfX, horizon + 65);
    wfGrad.addColorStop(0, '#A7F3D0');
    wfGrad.addColorStop(0.5, '#6EE7B7');
    wfGrad.addColorStop(1, '#059669');
    this.ctx.fillStyle = wfGrad;
    this.ctx.fillRect(wfX - 6, horizon - 15, 12, 80);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const streamY = ((time * 80) % 20);
    this.ctx.fillRect(wfX - 4, horizon - 10 + streamY, 8, 4);
    this.ctx.fillRect(wfX - 3, horizon + 10 + streamY, 6, 5);

    this.ctx.fillStyle = 'rgba(209, 250, 229, 0.4)';
    this.ctx.beginPath();
    this.ctx.arc(wfX, horizon + 60, 16 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
    this.ctx.fill();

    // 5. Midground Lush Banyan Tree Trunks & Swaying Jungle Vines
    this.ctx.fillStyle = '#07331F';
    const jLoop = 900;
    const jOff = ((this.camera.x * 0.11) % jLoop + jLoop) % jLoop;
    for (let x = -150; x < w + 250; x += 150) {
      const tx = x - (jOff % 150);
      this.ctx.fillRect(tx + 24, horizon - 130, 16, 190);
      this.ctx.beginPath();
      this.ctx.arc(tx + 32, horizon - 130, 56, Math.PI * 0.82, Math.PI * 2.18);
      this.ctx.fill();

      const sway = Math.sin(time * 1.8 + x * 0.02) * 18;
      this.ctx.strokeStyle = '#052919';
      this.ctx.lineWidth = 3.5;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(tx + 14, horizon - 120);
      this.ctx.quadraticCurveTo(tx + 6 + sway * 0.5, horizon - 60, tx + 16 + sway, horizon - 15);
      this.ctx.stroke();

      const sway2 = Math.cos(time * 2.2 + x * 0.03) * 14;
      this.ctx.beginPath();
      this.ctx.moveTo(tx + 50, horizon - 115);
      this.ctx.quadraticCurveTo(tx + 60 + sway2 * 0.6, horizon - 55, tx + 48 + sway2, horizon - 20);
      this.ctx.stroke();
    }

    // 6. Overhead Canopy Vignette
    this.ctx.fillStyle = '#031F11';
    for (let x = -100; x < w + 200; x += 180) {
      const ox = ((x - this.camera.x * 0.14) % (w + 200) + (w + 200)) % (w + 200) - 100;
      this.ctx.beginPath();
      this.ctx.arc(ox, -20, 65, 0, Math.PI);
      this.ctx.fill();
    }

    // 7. Bioluminescent Glowing Fireflies & Forest Spores
    if (this.jungleFireflies) {
      this.jungleFireflies.forEach(f => {
        f.y -= f.speed;
        if (f.y < 0) {
          f.y = h;
          f.baseX = Math.random() * 2000;
        }
        const fx = ((f.baseX + Math.sin(time * 2 + f.wobbleSpeed * 1000) * f.wobbleAmp - this.camera.x * 0.08) % (w + 100) + (w + 100)) % (w + 100) - 50;
        const glow = (Math.sin(time * 4 + f.glowPhase) + 1) * 0.5;

        this.ctx.save();
        const halo = this.ctx.createRadialGradient(fx, f.y, 0, fx, f.y, f.radius * 3.8);
        halo.addColorStop(0, f.color);
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = halo;
        this.ctx.globalAlpha = 0.28 + glow * 0.55;
        this.ctx.beginPath();
        this.ctx.arc(fx, f.y, f.radius * 3.8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.globalAlpha = 0.85;
        this.ctx.beginPath();
        this.ctx.arc(fx, f.y, Math.max(1.0, f.radius * 0.55), 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });
    }

    // 8. Low-Lying Rolling Jungle Mist extending all the way below h
    const mistLoop = 800;
    const mistOff = (((time * 25) + (this.camera.x * 0.15)) % mistLoop + mistLoop) % mistLoop;
    this.ctx.fillStyle = 'rgba(209, 250, 229, 0.18)';
    for (let mx = -200; mx < w + 300; mx += 140) {
      const px = mx - (mistOff % 140);
      this.ctx.beginPath();
      this.ctx.moveTo(px - 5, h + 120);
      this.ctx.lineTo(px - 5, h + 5);
      this.ctx.arc(px + 60, h + 5, 65, Math.PI, 0);
      this.ctx.lineTo(px + 125, h + 120);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // 9. Fluttering Tropical Butterflies
    [ [180, horizon - 80, '#FFD166'], [540, horizon - 120, '#00E5FF'], [820, horizon - 60, '#FF3388'] ].forEach(([bx, by, col], idx) => {
      const bX = ((bx + Math.sin(time * 1.5 + idx * 2) * 50 - this.camera.x * 0.1) % (w + 200) + (w + 200)) % (w + 200) - 100;
      const bY = by + Math.cos(time * 2 + idx) * 20;
      const flap = Math.abs(Math.sin(time * 8 + idx * 3));
      this.ctx.save();
      this.ctx.translate(bX, bY);
      this.ctx.fillStyle = col;
      this.ctx.beginPath();
      this.ctx.ellipse(-3 * flap, 0, 4 * flap, 3, -0.4, 0, Math.PI * 2);
      this.ctx.ellipse(3 * flap, 0, 4 * flap, 3, 0.4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    this.ctx.restore();
  }

  drawParallaxHills(w, h) {
    this.ctx.save();
    const camYShift = Math.max(-75, Math.min(75, -(this.camera.y || 0) * 0.14));
    const horizon = h * 0.74 + camYShift * 0.5;

    // Layer 1: Distant pastel meadow ridge extending down to h + 160
    this.ctx.fillStyle = '#86EFAC';
    this.ctx.beginPath();
    this.ctx.moveTo(-250, h + 160);
    const loop1 = 750;
    const off1 = ((this.camera.x * 0.08) % loop1 + loop1) % loop1;
    let firstX1 = -250 - (off1 % 250);
    this.ctx.lineTo(firstX1, horizon);
    for (let x = firstX1; x < w + 350; x += 250) {
      this.ctx.quadraticCurveTo(x + 125, horizon - 65, x + 250, horizon);
    }
    this.ctx.lineTo(w + 350, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Layer 2: Closer vibrant emerald meadow hills extending down to h + 160
    const hillGrad = this.ctx.createLinearGradient(0, horizon - 30, 0, h + 80);
    hillGrad.addColorStop(0, '#4ADE80');
    hillGrad.addColorStop(0.45, '#22C55E');
    hillGrad.addColorStop(1, '#15803D');
    this.ctx.fillStyle = hillGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(-200, h + 160);
    const loop2 = 600;
    const off2 = ((this.camera.x * 0.16) % loop2 + loop2) % loop2;
    let firstX2 = -200 - (off2 % 200);
    this.ctx.lineTo(firstX2, horizon + 18);
    for (let x = firstX2; x < w + 300; x += 200) {
      this.ctx.quadraticCurveTo(x + 100, horizon - 38, x + 200, horizon + 18);
    }
    this.ctx.lineTo(w + 300, h + 160);
    this.ctx.closePath();
    this.ctx.fill();

    // Colorful meadow wildflower dots on the closer hills
    const flowerColors = ['#FBBF24', '#F43F5E', '#FFFFFF', '#A855F7'];
    for (let x = -180; x < w + 240; x += 90) {
      const fx = x - (off2 % 90);
      const worldIdx = Math.round((x + off2 - (off2 % 90)) / 90);
      const fy = horizon + 8 + Math.sin(worldIdx * 1.7) * 12;
      const color = flowerColors[Math.abs(worldIdx) % flowerColors.length];
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(fx, fy, 2.8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
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
    const numStars = 48;
    const pOffX = (this.camera.x * 0.04);
    for (let i = 0; i < numStars; i++) {
      const seedX = ((i * 137.5 - pOffX) % w + w) % w;
      const seedY = (i * 89.3) % (h * 0.72);
      const twinkle = Math.sin(performance.now() * 0.003 + i) > 0.3 ? 2.5 : 1.5;
      this.ctx.fillStyle = (i % 5 === 0) ? '#FEF08A' : (i % 7 === 0) ? '#BAE6FD' : '#FFFFFF';
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

      const hint = document.getElementById('action-group-hint');
      if (hint) hint.style.display = 'inline';

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

    const hint = document.getElementById('action-group-hint');
    if (hint) hint.style.display = 'none';

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
        { id: 'solid', label: '🟩 Solid' },
        { id: 'slope_up', label: '◢ Slope Up' },
        { id: 'slope_down', label: '◣ Slope Down' },
        { id: 'stone', label: '🪨 Stone' },
        { id: 'stone_slope_up', label: '🪨◢ Stone Slope Up' },
        { id: 'stone_slope_down', label: '🪨◣ Stone Slope Down' },
        { id: 'ice', label: '🧊 Ice' },
        { id: 'ice_slope_up', label: '🧊◢ Ice Slope Up' },
        { id: 'ice_slope_down', label: '🧊◣ Ice Slope Down' },
        { id: 'semisolid', label: '🪵 Semi-Solid' },
        { id: 'slab', label: '🪨 Half Slab' },
        { id: 'mega', label: '❇️ Mega Block' },
        { id: 'pipe', label: '♻️ Pipe' },
        { id: 'donut', label: '🍩 Donut Lift' },
        { id: 'note', label: '🎵 Note Block' },
        { id: 'mystery', label: '❓ Mystery' },
        { id: 'cloud', label: '☁️ Cloud' }
      ];

      const variantDefs = {
        block: blockVariants,
        crate: blockVariants,
        enemy: [
          { id: 'walker', label: '🧌 Walker' },
          { id: 'winged', label: '🪽 Flyer' },
          { id: 'spiky', label: '🦔 Spiker' }
        ],
        collectible: [
          { id: 'star', label: '⭐ Star' },
          { id: 'coin', label: '💰 Coin' },
          { id: 'heart', label: '❤️ Heart' },
          { id: 'pistol', label: '🔫 Pistol' },
          { id: 'ammo', label: '📦 Ammo' }
        ],
        springboard: [
          { id: 'spring', label: '🌀 Spring' },
          { id: 'mega', label: '🚀 Mega Spring' }
        ]
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

  updateScoreUI() {
    // Score is rendered in real-time in drawHud() every frame
  }

  updateActionToolbar() {
    this.updateActionCard(this.editor?.selectedEntity);
  }

  firePistol() {
    if (this.player) {
      const b = this.player.shoot();
      if (b) {
        this.bullets.push(b);
        sounds.playShoot();
      }
    }
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

  // --- Mario-Style Mystery Question Block [?] Hit Handler ---
  handleMysteryBlockHit(block) {
    try {
      let kind = block.content || 'auto';

      if (kind === 'auto') {
        // Mario-style item selection:
        if (this.player.hearts < (this.player.maxHearts || 4) && Math.random() < 0.45) {
          kind = 'heart';
        } else if (!this.player.hasPistol || this.player.ammo <= 5) {
          kind = 'powerup';
        } else {
          const roll = Math.random();
          if (roll < 0.4) kind = 'coin';
          else if (roll < 0.7) kind = 'powerup';
          else kind = 'heart';
        }
      }

      // Resolve powerup: Gun vs. Ammunition
      // After picking up gun for first time, refills appear as ammunition!
      let variant = 'coin';
      if (kind === 'powerup' || kind === 'gun' || kind === 'pistol' || kind === 'ammo') {
        variant = this.gunPickedUpInLevel ? 'ammo' : 'pistol';
      } else if (kind === 'heart') {
        variant = 'heart';
      } else if (kind === 'star') {
        variant = 'star';
      } else {
        variant = 'coin';
      }

      if (variant === 'coin') {
        // Mario pop-up coin
        sounds.playCollect();
        this.score += 100;
        this.spawnCoinBounceParticle(block.x + block.width / 2, block.y);
        this.showToast('🪙 +100 PTS');
      } else {
        // Health Heart, Pistol Gun, or Ammunition Box emerges from top of block
        const itemW = 32;
        const itemH = 32;
        const itemX = block.x + (block.width - itemW) / 2;
        const targetY = block.y - itemH - 4;
        const item = new Collectible(itemX, block.y, itemW, itemH, variant);
        item.targetY = targetY;
        item.emerging = true;
        item.emergeVy = -190;
        item.isSpawnedDrop = true; // Mark as in-game drop from play session
        sounds.playGunPickup();
        this.entities.push(item);

        const label = variant === 'pistol'
          ? '🔫 Gun Powerup'
          : variant === 'ammo'
            ? '📦 Ammunition Box'
            : '❤️ Health Heart';
        this.showToast(`✨ ${label}`);
      }
    } catch (err) {
      console.error('handleMysteryBlockHit error:', err);
      try {
        sounds.playCollect();
        this.score += 100;
      } catch (e) {}
    }
  }

  spawnCoinBounceParticle(x, y) {
    for (let i = 0; i < 8; i++) {
      this.confetti.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - 10,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 8 - 4,
        size: Math.random() * 5 + 3,
        color: '#FFD700',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.3,
        life: 0.6
      });
    }
  }

  // Musical Note floating particles when bouncing on a Note Block
  spawnMusicNoteParticle(x, y) {
    const symbols = ['♪', '♫', '♬', '♩'];
    const colors = ['#FF2A85', '#00E5FF', '#FFE600', '#00E676', '#B388FF'];
    const count = 3;
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 10,
        vx: (Math.random() - 0.5) * 3.5,
        vy: -Math.random() * 4.5 - 3,
        char: symbols[Math.floor(Math.random() * symbols.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 18,
        rotation: (Math.random() - 0.5) * 0.4,
        vRot: (Math.random() - 0.5) * 0.1,
        life: 0.95
      });
    }
  }

  // --- Drag & Drop .sidehop File Integration ---
  initDragAndDrop() {
    const overlay = document.getElementById('drag-drop-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (overlay) overlay.style.display = 'flex';
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (overlay) overlay.style.display = 'flex';
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlay) overlay.style.display = 'none';
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (overlay) overlay.style.display = 'none';

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        this.handleUniversalSidehopImport(file);
      }
    });
  }

  handleUniversalSidehopImport(file) {
    if (!file) return;
    LevelStorage.importLevel(file, this.player, this.entities, (result) => {
      if (!result) return;

      if (result.kind === 'level' || result.level) {
        this.currentLevelName = result.levelName || 'Custom Level';
        if (result.theme || result.background?.worldTheme) {
          this.setTheme(result.theme || result.background.worldTheme);
        }
        if (result.background) this.applyBackground(result.background);
        this.camera.recenter(this.player.spawnX, this.player.spawnY);
        this.history.pushState(this.player, this.entities, this.background);
        LevelStorage.autoSave(this.player, this.entities, this.background);
        sounds.playCollect();
        const badge = result.sourceFormat === 'html' ? '(.html Game)' : '(.sidehop Project)';
        this.showToast(`🎮 Loaded: ${this.currentLevelName} ${badge}`);
      } else if (result.kind === 'asset') {
        sounds.playCollect();
        this.showToast(`🎨 Imported Asset: ${result.asset.name} (.sidehop)`);
        // If an entity is selected, apply it immediately
        if (this.editor.selectedEntity) {
          this.editor.selectedEntity.setCustomVisual(result.asset.dataUrl);
          LevelStorage.autoSave(this.player, this.entities, this.background);
        }
      } else if (result.kind === 'bundle') {
        sounds.playCollect();
        this.showToast(`📦 Imported ${result.assets?.length || 0} Assets (.sidehop)`);
      }
    });
  }

  // Definitions of Mario Maker-style component types / variants with intuitive submenus
  getVariantDefs() {
    const turfVariants = [
      { id: 'solid', icon: '🟩', name: 'Solid Ground', desc: 'Standard solid block platform', shortName: 'Solid' },
      { id: 'slope_up', icon: '◢', name: 'Turf Slope Up (45°)', desc: 'Walkable turf incline hill slant ↗', shortName: 'Slope Up' },
      { id: 'slope_down', icon: '◣', name: 'Turf Slope Down (45°)', desc: 'Walkable turf decline hill slant ↘', shortName: 'Slope Down' },
      { id: 'slope_ceil_up', icon: '◤', name: 'Turf Inverted Slope Up (45°)', desc: 'Upside-down slant / smooth underside ↗', shortName: 'Ceil Up' },
      { id: 'slope_ceil_down', icon: '◥', name: 'Turf Inverted Slope Down (45°)', desc: 'Upside-down slant / smooth underside ↘', shortName: 'Ceil Down' }
    ];

    const stoneVariants = [
      { id: 'stone', icon: '🪨', name: 'Stone Block', desc: 'Chiseled fortress stone masonry', shortName: 'Stone' },
      { id: 'stone_slope_up', icon: '🪨◢', name: 'Stone Slope Up (45°)', desc: 'Chiseled stone incline slant ↗', shortName: 'Stone Up' },
      { id: 'stone_slope_down', icon: '🪨◣', name: 'Stone Slope Down (45°)', desc: 'Chiseled stone decline slant ↘', shortName: 'Stone Down' },
      { id: 'stone_slope_ceil_up', icon: '🪨◤', name: 'Stone Inverted Slope Up (45°)', desc: 'Chiseled stone ceiling slant ↗', shortName: 'Stone Ceil Up' },
      { id: 'stone_slope_ceil_down', icon: '🪨◥', name: 'Stone Inverted Slope Down (45°)', desc: 'Chiseled stone ceiling slant ↘', shortName: 'Stone Ceil Down' }
    ];

    const iceVariants = [
      { id: 'ice', icon: '🧊', name: 'Sliding Block', desc: 'Low-friction slippery ice surface', shortName: 'Ice' },
      { id: 'ice_slope_up', icon: '🧊◢', name: 'Ice Slope Up (45°)', desc: 'Low-friction ice incline slant ↗', shortName: 'Ice Up' },
      { id: 'ice_slope_down', icon: '🧊◣', name: 'Ice Slope Down (45°)', desc: 'Low-friction ice decline slant ↘', shortName: 'Ice Down' },
      { id: 'ice_slope_ceil_up', icon: '🧊◤', name: 'Ice Inverted Slope Up (45°)', desc: 'Low-friction ice ceiling slant ↗', shortName: 'Ice Ceil Up' },
      { id: 'ice_slope_ceil_down', icon: '🧊◥', name: 'Ice Inverted Slope Down (45°)', desc: 'Low-friction ice ceiling slant ↘', shortName: 'Ice Ceil Down' }
    ];

    const specialVariants = [
      { id: 'semisolid', icon: '🪵', name: 'Jump-thru Platform', desc: 'Jump through from below, stand on top', shortName: 'Semi-Solid' },
      { id: 'donut', icon: '🍩', name: 'Donut Drop', desc: 'Drops and falls when stood upon', shortName: 'Donut Lift' },
      { id: 'note', icon: '🎵', name: 'Note Block', desc: 'Super bouncy musical trampoline block', shortName: 'Note Block' },
      { id: 'mystery', icon: '❓', name: 'Mystery Block', desc: 'Breakable surprise block [?]', shortName: 'Mystery' },
      { id: 'cloud', icon: '☁️', name: 'Cloud Platform', desc: 'Soft floating cloud block', shortName: 'Cloud' },
      { id: 'slab', icon: '🪨', name: 'Half-Block (40x20)', desc: 'Half-height stepping stone block', shortName: 'Half Slab' },
      { id: 'mega', icon: '❇️', name: 'Mega Block (80x80)', desc: 'Giant 2x2 fortress block', shortName: 'Mega Block' },
      { id: 'pipe', icon: '♻️', name: 'Warp Pipe (40x80)', desc: 'Tall iconic 2-tile pipe column', shortName: 'Pipe' }
    ];

    return {
      block: {
        title: 'BLOCK & SLOPE TYPES',
        submenus: [
          { id: 'turf', name: 'Ground', icon: '🟩', variants: turfVariants },
          { id: 'stone', name: 'Stone', icon: '🪨', variants: stoneVariants },
          { id: 'ice', name: 'Ice', icon: '🧊', variants: iceVariants },
          { id: 'special', name: 'Special', icon: '✨', variants: specialVariants }
        ],
        variants: [
          ...turfVariants,
          ...stoneVariants,
          ...iceVariants,
          ...specialVariants
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
          { id: 'walker', icon: '🧌', name: 'Walker', desc: 'Patrols back and forth on ground', shortName: 'Enemy' },
          { id: 'winged', icon: '🪽', name: 'Flyer', desc: 'Hops & flutters airborne', shortName: 'Winged' },
          { id: 'spiky', icon: '🦔', name: 'Spiker', desc: "Hazardous spines - can't stomp", shortName: 'Spiky' }
        ]
      },
      collectible: {
        title: 'COLLECTIBLE TYPES',
        variants: [
          { id: 'star', icon: '⭐', name: 'Star Gem', desc: 'Bright glowing star token (+500 pts)', shortName: 'Star' },
          { id: 'coin', icon: '💰', name: 'Gold Coin', desc: 'Shiny spinning coin token (+100 pts)', shortName: 'Coin' },
          { id: 'heart', icon: '❤️', name: 'Heart', desc: 'Restores +1 heart of player health', shortName: 'Heart' },
          { id: 'pistol', icon: '🔫', name: 'Gun', desc: 'Sidearm blaster weapon (+15 Ammo)', shortName: 'Pistol' },
          { id: 'ammo', icon: '📦', name: 'Ammunition', desc: 'Ammo reload (+15 rounds)', shortName: 'Ammo' }
        ]
      }
    };
  }

  // Open the corner triangle flyout popup menu for a component
  openComponentFlyout(item, anchorEl) {
    const flyout = document.getElementById('component-flyout-menu');
    const titleEl = document.getElementById('flyout-title');
    const submenusBar = document.getElementById('flyout-submenus-bar');
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
    const currentVariant = this.activeComponentVariants[item] || defs.variants[0].id;

    const renderOptionsForList = (variantList) => {
      optionsList.innerHTML = '';
      variantList.forEach(v => {
        const btn = document.createElement('button');
        btn.className = `flyout-option-btn ${this.activeComponentVariants[item] === v.id ? 'active' : ''}`;
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
      optionsList.scrollTop = 0;
    };

    if (defs.submenus && defs.submenus.length > 0) {
      if (submenusBar) {
        submenusBar.style.display = 'flex';
        submenusBar.innerHTML = '';

        // Auto-detect which submenu contains current active variant if not explicitly set
        let activeSubId = this.activeFlyoutSubmenu[item];
        if (!activeSubId || !defs.submenus.some(s => s.id === activeSubId)) {
          const found = defs.submenus.find(s => s.variants.some(v => v.id === currentVariant));
          activeSubId = found ? found.id : defs.submenus[0].id;
          this.activeFlyoutSubmenu[item] = activeSubId;
        }

        defs.submenus.forEach(sub => {
          const tabBtn = document.createElement('button');
          tabBtn.className = `flyout-tab-btn ${sub.id === activeSubId ? 'active' : ''}`;
          tabBtn.innerHTML = `<span>${sub.icon}</span><span>${sub.name}</span>`;
          tabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.activeFlyoutSubmenu[item] = sub.id;
            submenusBar.querySelectorAll('.flyout-tab-btn').forEach(tb => tb.classList.remove('active'));
            tabBtn.classList.add('active');
            renderOptionsForList(sub.variants);
            sounds.playClick();
          });
          submenusBar.appendChild(tabBtn);
        });

        const currentSub = defs.submenus.find(s => s.id === activeSubId) || defs.submenus[0];
        renderOptionsForList(currentSub.variants);
      }
    } else {
      if (submenusBar) {
        submenusBar.style.display = 'none';
        submenusBar.innerHTML = '';
      }
      renderOptionsForList(defs.variants);
    }

    // Mark active state on triangle button
    document.querySelectorAll('.palette-triangle-btn').forEach(tb => {
      tb.classList.toggle('active', tb.getAttribute('data-triangle') === item);
    });

    // Show flyout to position and constrain
    flyout.style.display = 'flex';

    // Position flyout directly adjacent to the anchor element (just outside the drawer)
    const rect = anchorEl.getBoundingClientRect();
    const left = rect.right + 10;

    // Clamp cleanly within viewport so full menu is visible and scrollable
    const targetMaxH = Math.min(480, window.innerHeight - 32);
    let top = rect.top - 10;
    if (top + targetMaxH > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - targetMaxH - 16);
    }
    if (top < 16) top = 16;

    const availableH = window.innerHeight - top - 16;
    flyout.style.left = `${left}px`;
    flyout.style.top = `${top}px`;
    flyout.style.maxHeight = `${availableH}px`;

    // Ensure mouse wheel scrolling stays smooth within flyout
    if (!this._flyoutWheelBound) {
      flyout.addEventListener('wheel', (e) => {
        e.stopPropagation();
      }, { passive: true });
      this._flyoutWheelBound = true;
    }

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

    // Keep active submenu synced to chosen variant
    const defs = this.getVariantDefs()[item];
    if (defs?.submenus) {
      const match = defs.submenus.find(s => s.variants.some(v => v.id === variantId));
      if (match) this.activeFlyoutSubmenu[item] = match.id;
    }

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

    // Demo Mode Button (Interactive Feature Tour)
    document.getElementById('demo-btn')?.addEventListener('click', () => {
      window.closeHeaderDrawers?.();
      this.demo.start();
    });

    // Theme Selector Modal Controls
    const themeModal = document.getElementById('theme-modal');
    document.getElementById('theme-selector-btn')?.addEventListener('click', () => {
      if (themeModal) {
        themeModal.showModal();
        sounds.playClick();
      }
    });
    document.getElementById('theme-close-btn')?.addEventListener('click', () => {
      if (themeModal) themeModal.close();
      sounds.playClick();
    });
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const selectedTheme = card.dataset.theme;
        if (selectedTheme) {
          this.setTheme(selectedTheme, true);
          sounds.playLand();
          if (themeModal) themeModal.close();
        }
      });
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

    // Character Edit Button (Header shortcut)
    document.getElementById('character-edit-btn')?.addEventListener('click', () => {
      this.artStudio.openForEntity(this.player, () => {
        LevelStorage.autoSave(this.player, this.entities, this.background);
      });
    });

    // 4. Background Customizer Modal Controls
    const bgModal = document.getElementById('background-modal');
    document.getElementById('bg-modal-btn').addEventListener('click', () => {
      this.updateBackgroundModalUI();
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

    // Make a drawing button (opens Art Studio in background mode)
    document.getElementById('bg-draw-btn')?.addEventListener('click', () => {
      bgModal.classList.remove('active');
      this.artStudio.openForBackground(this.background, (dataUrl) => {
        if (dataUrl) {
          this.background.theme = 'custom';
          this.background.customImage = dataUrl;
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => {
            this.background.customImageElement = img;
          };
          sounds.playPaintSquish();
        } else {
          this.background.theme = this.currentTheme || 'grass';
          this.background.customImage = null;
          this.background.customImageElement = null;
        }
        this.updateBackgroundModalUI();
        LevelStorage.autoSave(this.player, this.entities, this.background);
      });
    });

    const bgUploadInput = document.getElementById('bg-image-upload');
    bgUploadInput?.addEventListener('change', (e) => {
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
          this.updateBackgroundModalUI();
          sounds.playPaintSquish();
          LevelStorage.autoSave(this.player, this.entities, this.background);
        };
        reader.readAsDataURL(file);
        bgUploadInput.value = '';
      }
    });

    // Clear Custom Art Background button
    document.getElementById('bg-clear-custom-btn')?.addEventListener('click', () => {
      this.background.theme = this.currentTheme || 'grass';
      this.background.customImage = null;
      this.background.customImageElement = null;
      this.updateBackgroundModalUI();
      sounds.playClick();
      LevelStorage.autoSave(this.player, this.entities, this.background);
    });

    // Background .sidehop Export Button
    document.getElementById('bg-export-sidehop-btn')?.addEventListener('click', () => {
      let dataUrl = this.background.customImage;
      if (!dataUrl) {
        const prevW = this.canvas.width;
        const prevH = this.canvas.height;
        this.canvas.width = 960;
        this.canvas.height = 540;
        this.renderBackground();
        dataUrl = this.canvas.toDataURL('image/png');
        this.canvas.width = prevW;
        this.canvas.height = prevH;
      }
      const title = `${(this.background.theme || this.currentTheme).toUpperCase()} Background`;
      const pkg = SidehopFile.createAssetPackage({
        name: title,
        category: 'background',
        targetType: 'background',
        dataUrl: dataUrl,
        width: 960,
        height: 540
      }, {
        title: title,
        description: 'Level background exported from Sidehop'
      });
      SidehopFile.download(`${this.background.theme || this.currentTheme}-background.sidehop`, pkg);
      sounds.playCollect();
      this.showToast('💾 Exported Background (.sidehop)');
    });

    const bgSidehopUpload = document.getElementById('bg-sidehop-upload');
    bgSidehopUpload?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = SidehopFile.parse(ev.target.result);
            const asset = parsed.asset || (parsed.kind === 'asset' ? parsed.asset : null);
            const dataUrl = asset?.dataUrl || parsed.dataUrl;
            if (dataUrl) {
              this.background.theme = 'custom';
              this.background.customImage = dataUrl;
              const img = new Image();
              img.src = dataUrl;
              img.onload = () => {
                this.background.customImageElement = img;
              };
              this.updateBackgroundModalUI();
              LevelStorage.autoSave(this.player, this.entities, this.background);
              sounds.playCollect();
              this.showToast('🌄 Loaded .sidehop Background');
            }
          } catch (err) {
            console.warn('Background import error:', err);
          }
        };
        reader.readAsText(file);
        bgSidehopUpload.value = '';
      }
    });

    // Clear Art Studio Canvas button
    document.getElementById('paint-clear-canvas-btn')?.addEventListener('click', () => {
      this.artStudio.clearCanvas();
      sounds.playPaintSquish();
    });

    // 5. Presets & .sidehop Level Management
    document.getElementById('load-preset-btn').addEventListener('click', () => {
      this.loadStarterWorld();
      sounds.playLand();
      this.showToast('🔄 World Reset to Default');
    });

    document.getElementById('export-level-btn')?.addEventListener('click', () => {
      window.closeHeaderDrawers?.();
      LevelStorage.exportLevel(this.player, this.entities, this.background, this.currentLevelName);
      sounds.playCollect();
      this.showToast('💾 Editable Project Exported (.sidehop)');
    });

    document.getElementById('export-html-btn')?.addEventListener('click', async () => {
      window.closeHeaderDrawers?.();
      const defaultName = (this.currentLevelName && this.currentLevelName !== 'Starter World')
        ? this.currentLevelName
        : 'My Sidehop Game';
      const enteredName = window.prompt('Enter a level / game name for your HTML file:', defaultName);
      if (enteredName === null) return;
      const gameTitle = enteredName.trim() || defaultName;
      this.currentLevelName = gameTitle;
      sounds.playCollect();
      this.showToast(`🌐 Exporting "${gameTitle}.html"...`);
      await LevelStorage.exportStandaloneHtml(this.player, this.entities, this.background, this.currentTheme, gameTitle);
      this.showToast(`✅ Saved "${gameTitle}.html"`);
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-level-btn')?.addEventListener('click', () => {
      if (importInput) {
        importInput.accept = '.sidehop,.html,.htm,.json';
        importInput.click();
      }
    });
    document.getElementById('import-sidehop-btn')?.addEventListener('click', () => {
      window.closeHeaderDrawers?.();
      if (importInput) {
        importInput.accept = '.sidehop,.json';
        importInput.click();
      }
    });
    document.getElementById('import-html-btn')?.addEventListener('click', () => {
      window.closeHeaderDrawers?.();
      if (importInput) {
        importInput.accept = '.html,.htm';
        importInput.click();
      }
    });

    importInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleUniversalSidehopImport(e.target.files[0]);
        importInput.value = '';
        importInput.accept = '.sidehop,.html,.htm,.json';
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
      SolidBlock.updateTerrainMap(this.entities);
      LevelStorage.autoSave(this.player, this.entities, this.background);
      if (this.editor.selectedEntity) {
        this.updateActionCard(this.editor.selectedEntity);
      }
    };

    const actionCloseBtn = document.getElementById('action-close-btn');
    if (actionCloseBtn) {
      actionCloseBtn.addEventListener('click', () => {
        this.editor.selectedEntity = null;
        this.editor.selectedEntities = [];
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
    document.getElementById('ctx-deselect-item-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = this.contextMenuTargetEntity;
      this.closeContextMenu();
      if (target) {
        this.editor.deselectEntity(target);
        if (this.editor.selectedEntities.length > 0) {
          this.updateActionCard(this.editor.selectedEntity);
        } else {
          document.getElementById('entity-action-card')?.classList.remove('active');
        }
      }
    });

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

    // Import .sidehop asset onto painting canvas
    const paintAssetInput = document.getElementById('paint-asset-upload');
    paintAssetInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.artStudio.importAssetFile(e.target.files[0], (asset) => {
          this.showToast(`🎨 Loaded ${asset?.name || 'asset'} into canvas!`);
        });
        paintAssetInput.value = '';
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
      this.resetPlaySession();
      sounds.playClick();
    });

    document.getElementById('victory-edit-btn').addEventListener('click', () => {
      document.getElementById('victory-overlay').classList.remove('active');
      this.isLevelWon = false;
      this.setMode('edit');
    });

    document.getElementById('victory-clip-btn').addEventListener('click', () => {
      this.recorder.openReplayOrRecord();
    });
  }

  resetPlaySession() {
    if (this.playModeSnapshot) {
      LevelStorage.deserialize(this.playModeSnapshot, this.player, this.entities);
    } else {
      for (const ent of this.entities) {
        if (ent.variant === 'mystery') ent.isUsed = false;
        if (ent.type === 'collectible') {
          ent.collected = false;
          ent.active = true;
        }
      }
      this.entities = this.entities.filter(e => !e.isSpawnedDrop);
    }
    this.score = 0;
    this.bullets = [];
    this.gunPickedUpInLevel = false;
    this.player.respawn();
    this.player.hearts = this.player.maxHearts || 4;
    this.player.invulnerableTimer = 0;
    if (this.recorder && this.mode === 'play') {
      this.recorder.startAutoReplay();
    }
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
      // 1. Take snapshot of level right before play begins to ensure clean reset
      this.playModeSnapshot = LevelStorage.serialize(this.player, this.entities, this.background);
      LevelStorage.autoSave(this.player, this.entities, this.background);

      modeBtn.classList.remove('neo-btn-primary');
      modeBtn.classList.add('neo-btn-pink');
      modeIcon.textContent = '✏️';
      modeText.textContent = 'EDIT LEVEL';
      toolDrawer.classList.add('minimized');
      actionCard.classList.remove('active');
      if (navControls) navControls.classList.add('hidden');

      this.score = 0;
      this.isLevelWon = false;
      this.bullets = [];
      this.gunPickedUpInLevel = false;
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;
      document.getElementById('victory-overlay').classList.remove('active');
      // Reset mystery blocks and collectibles for play session
      for (const ent of this.entities) {
        if (ent.variant === 'mystery') ent.isUsed = false;
        if (ent.type === 'collectible') {
          ent.collected = false;
          ent.active = true;
        }
      }

      // Show Stretch Frame buttons in Play Mode
      const stretchHeaderBtn = document.getElementById('stretch-frame-btn');
      if (stretchHeaderBtn) stretchHeaderBtn.style.display = 'inline-flex';
      const stageStretchBtn = document.getElementById('stage-stretch-btn');
      if (stageStretchBtn) stageStretchBtn.style.display = 'flex';

      // Sync canvas dimensions for Play Mode layout and begin background replay capture
      this.updateCanvasDimensions(true);
      if (this.recorder) {
        this.recorder.startAutoReplay();
      }
    } else {
      if (this.recorder) {
        this.recorder.cancelAutoReplay();
      }
      // Restore clean level snapshot from before play began, resetting drops, coins, and enemies
      if (this.playModeSnapshot) {
        LevelStorage.deserialize(this.playModeSnapshot, this.player, this.entities);
        this.playModeSnapshot = null;
      }
      this.entities = this.entities.filter(e => !e.isSpawnedDrop);

      modeBtn.classList.add('neo-btn-primary');
      modeBtn.classList.remove('neo-btn-pink');
      modeIcon.textContent = '▶';
      modeText.textContent = 'PLAY TEST';
      toolDrawer.classList.remove('minimized');
      if (navControls) navControls.classList.remove('hidden');
      this.player.respawn();
      this.bullets = [];
      this.gunPickedUpInLevel = false;
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;
      for (const ent of this.entities) {
        if (ent.variant === 'mystery') ent.isUsed = false;
      }

      // Keep Stretch Frame buttons visible in Edit Mode so the user can edit in full-screen
      const stretchHeaderBtn = document.getElementById('stretch-frame-btn');
      if (stretchHeaderBtn) stretchHeaderBtn.style.display = 'inline-flex';
      const stageStretchBtn = document.getElementById('stage-stretch-btn');
      if (stageStretchBtn) stageStretchBtn.style.display = 'flex';
      this.updateCanvasDimensions(true);
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

      // Escape dismisses context menu, flyouts, header drawers, and deselects entity
      if (e.code === 'Escape' || e.key === 'Escape') {
        this.closeContextMenu();
        this.closeComponentFlyout();
        window.closeHeaderDrawers?.();
        if (this.mode === 'edit') {
          this.editor.selectedEntity = null;
          document.getElementById('entity-action-card')?.classList.remove('active');
        }
      }

      // Number keys switch tools in edit mode: 1=Select/Move (also pans), 2=Place, 3=Erase, 4/5=Box Select
      if (this.mode === 'edit') {
        const toolMap = { Digit1: 'select', Digit2: 'place', Digit3: 'erase', Digit4: 'boxselect', Digit5: 'boxselect' };
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

    // Mouse Canvas Inputs for Edit Mode & Play Shooting
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'edit') {
        this.closeContextMenu();
        this.editor.handleMouseDown(e, this.entities, this.player);
      } else if (this.mode === 'play' && e.button === 0 && !this.isLevelWon) {
        if (this.player.hasPistol && this.player.shootCooldown <= 0) {
          const bullet = this.player.shoot();
          if (bullet) {
            this.bullets.push(bullet);
            sounds.playShoot();
          }
        }
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
      if (!this.isFrameStretched) {
        this.initStageFrame();
      }
      this.updateCanvasDimensions();
    });
  }

  update(dt) {
    if (this.mode === 'play' && !this.isLevelWon) {
      // 1. Update Player Input & Movement
      const firedBullet = this.player.handleInput(this.keys, dt);
      if (firedBullet) {
        this.bullets.push(firedBullet);
        sounds.playShoot();
      }

      // Collect solid collision objects (Blocks, Moving Platforms, and Springs)
      const solids = this.entities.filter(ent => ent.type === 'crate' || ent.type === 'block' || ent.type === 'moving_platform' || ent.type === 'springboard');
      for (const s of solids) {
        if (s.update && (s.bumpTimer > 0 || s.variant === 'donut')) {
          s.update(dt);
        }
      }
      this.physics.updateEntity(this.player, solids, dt);

      // 1b. Update Bullets & Bullet-Enemy Collisions
      if (this.bullets && this.bullets.length > 0) {
        for (const bullet of this.bullets) {
          bullet.update(dt, solids);
          if (!bullet.active) continue;

          for (const ent of this.entities) {
            if (!ent.active || ent.type !== 'enemy' || ent.isSquashed) continue;
            if (this.physics.checkOverlap(bullet, ent)) {
              bullet.active = false;
              ent.stomp(); // Defeats enemy (including armored spiky!)
              this.score += (ent.variant === 'spiky' ? 200 : (ent.variant === 'winged' ? 150 : 100));
              this.spawnHurtParticles(ent.x + ent.width / 2, ent.y + ent.height / 2);
              break;
            }
          }
        }
        this.bullets = this.bullets.filter(b => b.active);
      }

      // 2. Check Entity Interactions
      for (const ent of this.entities) {
        if (!ent.active) continue;
        try {

          // Springs / Trampolines (Standard & Mega)
          if (ent.type === 'springboard') {
            ent.update(dt);
            const playerBottom = this.player.y + this.player.height;
            const hOverlap = (this.player.x + this.player.width > ent.x + 3) && (this.player.x < ent.x + ent.width - 3);
            const vOnTop = (playerBottom >= ent.y - 6) && (this.player.y < ent.y + ent.height * 0.7);
            const isOverlapping = this.physics.checkOverlap(this.player, ent);

            if (hOverlap && (isOverlapping || vOnTop)) {
              // Trigger if player is above/on top of spring, and spring isn't currently in bounce lockout
              if (this.player.y < ent.y + ent.height * 0.6 && (ent.compressTimer <= 0.08 || this.player.vy >= 0)) {
                const isHoldingJump = !!(this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']);
                const jumpMult = isHoldingJump ? 1.25 : 1.0;
                const boost = ent.launchForce * jumpMult;

                this.player.vy = -boost;
                this.player.y = ent.y - this.player.height - 2;
                this.player.grounded = false;
                this.player.isJumping = false;
                this.player.standingOnSolid = null;
                this.player.coyoteTimer = 0;
                ent.trigger();

                this.player.stretchFactor = 0.38;
                this.player.stretchTime = 0.25;
              }
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
                  this.resetPlaySession();
                }
              }
            }
          }

          // Enemies (Walker, Winged Hopper, Armored Spiky)
          else if (ent.type === 'enemy') {
            // Only simulate full enemy physics when within active range of player or camera
            const inActiveRange = Math.abs(ent.x - this.player.x) < 1600 ||
              (ent.x + ent.width >= this.camera.x - 400 && ent.x <= this.camera.x + this.canvas.width + 400);
            if (!inActiveRange) continue;

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
                    this.resetPlaySession();
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

          // Collectibles (Coin, Star Gem, Heart, Pistol Powerup, Ammunition)
          else if (ent.type === 'collectible') {
            ent.update(dt);
            if (this.physics.checkOverlap(this.player, ent)) {
              ent.collect();
              const isAmmo = (ent.variant === 'ammo' || (ent.variant === 'pistol' && this.gunPickedUpInLevel));
              if (ent.variant === 'pistol' && !this.gunPickedUpInLevel) {
                this.player.hasPistol = true;
                this.player.ammo = (this.player.ammo || 0) + 15;
                this.gunPickedUpInLevel = true;
                this.score += 300;
                this.showToast('🔫 Gun! (+15 Ammo) [F/X to Shoot]');
              } else if (isAmmo) {
                this.player.hasPistol = true;
                this.player.ammo = (this.player.ammo || 0) + 15;
                this.gunPickedUpInLevel = true;
                this.score += 200;
                this.showToast('📦 Ammo Reloaded! (+15 Rounds) [F/X to Shoot]');
              } else if (ent.variant === 'heart') {
                this.player.hearts = Math.min(this.player.maxHearts, this.player.hearts + 1);
                this.score += 200;
                this.showToast('❤️ +1 Heart');
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
        } catch (entErr) {
          console.error('Entity interaction error:', ent?.type, entErr);
        }
      }

      // 3. Fall out of world
      if (this.player.y > 1000) {
        sounds.playHurt();
        this.resetPlaySession();
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

      const editViewLeft = this.camera.x - 160;
      const editViewRight = this.camera.x + this.canvas.width + 160;
      for (const ent of this.entities) {
        if (ent.x + ent.width < editViewLeft || ent.x > editViewRight) continue;
        if (ent.update && (ent.type === 'springboard' || ent.type === 'collectible' || ent.type === 'goal' || ent.bumpTimer > 0)) {
          ent.update(dt);
        }
      }
    } else if (this.mode === 'play' && this.isLevelWon) {
      // Keep ambient stage animations alive during the Victory celebration
      const viewLeft = this.camera.x - 160;
      const viewRight = this.camera.x + this.canvas.width + 160;
      for (const ent of this.entities) {
        if (!ent.active || ent.x + ent.width < viewLeft || ent.x > viewRight) continue;
        if (ent.update && (ent.type === 'springboard' || ent.type === 'collectible' || ent.type === 'goal' || ent.bumpTimer > 0)) {
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
    if (this.recorder) {
      this.recorder.finalizeReplayOnVictory();
    }

    this.confetti = [];
    const colors = ['#00E5FF', '#FFE600', '#FF3388', '#00E676', '#B388FF'];
    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: this.canvas.height / 2,
        isScreen: true,
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

  spawnPistolLostParticles(x, y) {
    for (let i = 0; i < 14; i++) {
      this.confetti.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 6 + 4,
        color: i % 2 === 0 ? '#FFEE58' : '#FF6D00',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.4,
        life: 1.1
      });
    }
  }

  render() {
    const now = performance.now();
    if (!this._lastDimCheck || now - this._lastDimCheck > 400) {
      this._lastDimCheck = now;
      this.updateCanvasDimensions();
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update terrain spatial map for seamless autotiling & neighbor detection
    SolidBlock.updateTerrainMap(this.entities);

    // 1. Draw Active Background Atmosphere / Custom Art
    this.renderBackground();

    // 2. Draw World Entities (with Viewport Culling for smooth 60fps performance)
    this.ctx.save();
    try {
      this.ctx.translate(-this.camera.x, -this.camera.y);

      const viewLeft = this.camera.x - 140;
      const viewRight = this.camera.x + this.canvas.width + 140;
      const viewTop = this.camera.y - 140;
      const viewBottom = this.camera.y + this.canvas.height + 140;

      for (const ent of this.entities) {
        if (!ent.active) continue;
        if (
          ent.x + ent.width < viewLeft ||
          ent.x > viewRight ||
          ent.y + ent.height < viewTop ||
          ent.y > viewBottom
        ) {
          continue;
        }
        try {
          ent.draw(this.ctx);
        } catch (entErr) {
          console.warn('Entity draw error in render loop:', entErr);
        }
      }

      if (this.bullets && this.bullets.length > 0) {
        for (const b of this.bullets) {
          try {
            b.draw(this.ctx);
          } catch (bErr) {
            console.warn('Bullet draw error in render loop:', bErr);
          }
        }
      }

      try {
        this.player.draw(this.ctx);
      } catch (pErr) {
        console.warn('Player draw error in render loop:', pErr);
      }
    } finally {
      this.ctx.restore();
    }

    // 3. In Edit Mode, draw grid lines and hover ghost
    if (this.mode === 'edit') {
      this.editor.draw(this.ctx);
    }

    // 4. Draw HUD in Play Mode (Score & 4 Hearts)
    if (this.mode === 'play') {
      this.drawPlayHUD();
    }

    // 5. Draw Confetti & Particle Effects
    if (this.confetti.length > 0) {
      this.ctx.save();
      for (const p of this.confetti) {
        this.ctx.save();
        const drawX = p.isScreen ? p.x : (p.x - this.camera.x);
        const drawY = p.isScreen ? p.y : (p.y - this.camera.y);
        this.ctx.translate(drawX, drawY);
        this.ctx.rotate(p.rotation);
        if (p.char) {
          this.ctx.font = `bold ${Math.round(p.size)}px "Fredoka", sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillStyle = p.color;
          this.ctx.fillText(p.char, 0, 0);
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        this.ctx.restore();
      }
      this.ctx.restore();
    }

    if (this.recorder && this.recorder.isRecording) {
      this.recorder.captureFrame();
    }
  }

  // --- Neo-Brutalist Play HUD (Score, Hearts & Ammo) ---
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

    // Neo-Brutalist Ammo Card (Visible when Pistol is equipped)
    if (this.player.hasPistol && this.player.ammo > 0) {
      const ammoX = hudX + hudW + 12;
      const ammoY = hudY;
      const ammoW = 145;
      const ammoH = hudH;

      // Hard drop-shadow
      this.ctx.fillStyle = '#121212';
      this.ctx.beginPath();
      this.ctx.roundRect(ammoX + 4, ammoY + 4, ammoW, ammoH, 12);
      this.ctx.fill();

      // Bright yellow foreground pill with thick black border
      this.ctx.fillStyle = '#FFEE58';
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.roundRect(ammoX, ammoY, ammoW, ammoH, 12);
      this.ctx.fill();
      this.ctx.stroke();

      // Ammo label & count
      this.ctx.font = '700 11px "Fredoka", sans-serif';
      this.ctx.fillStyle = '#777777';
      this.ctx.fillText('AMMO', ammoX + 16, ammoY + 19);

      this.ctx.font = '900 16px "Fredoka", sans-serif';
      this.ctx.fillStyle = '#121212';
      this.ctx.fillText(`${this.player.ammo} ROUNDS`, ammoX + 16, ammoY + 39);
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

    try {
      this.update(dt);
    } catch (updateErr) {
      console.error('gameLoop update error:', updateErr);
    }

    try {
      this.render();
    } catch (renderErr) {
      console.error('gameLoop render error:', renderErr);
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Mobile Device Detection & Advisory
function initMobileCheck() {
  const blocker = document.getElementById('mobile-blocker');
  if (!blocker) return;

  function evaluateDevice() {
    // Check if this is an actual mobile handheld phone or tablet device
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
    const isCoarseTouchOnly = window.matchMedia && window.matchMedia('(pointer: coarse) and (hover: none)').matches;
    const hasTouchPoints = navigator.maxTouchPoints && navigator.maxTouchPoints > 1;

    // Desktop computers have fine mouse/trackpad pointer and hover capabilities.
    // When dragged inward to make smaller on desktop, it should NEVER trigger the mobile blocker!
    const isDesktopPointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    const isTrueMobile = (isMobileUA || (isCoarseTouchOnly && hasTouchPoints)) && (!isDesktopPointer || !hasHover) && window.innerWidth <= 820;

    if (isTrueMobile) {
      blocker.classList.add('is-mobile-device');
      blocker.style.display = 'flex';
    } else {
      blocker.classList.remove('is-mobile-device');
      blocker.style.display = 'none';
    }
  }

  window.addEventListener('resize', evaluateDevice);
  window.addEventListener('orientationchange', evaluateDevice);
  evaluateDevice();

  const dismissBtn = document.getElementById('mobile-blocker-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      blocker.classList.remove('is-mobile-device');
      blocker.style.display = 'none';
    });
  }
}

// Start Sidehop!
function startApp() {
  if (window.sidehop) return;
  initMobileCheck();
  window.sidehop = new SidehopApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

