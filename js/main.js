// Sidehop Master Application Coordinator — Enhanced Custom Backgrounds, Asset Library & Undo/Redo

import { Player, Bullet, SolidBlock, Collectible } from './engine/entities.js';
import { PhysicsEngine } from './engine/physics.js?v=2';
import { Camera } from './engine/camera.js';
import { GridEditor } from './editor/grid.js';
import { ArtStudio } from './editor/paint.js';
import { Inspector } from './editor/inspector.js';
import { VideoRecorder } from './recorder/recorder.js';
import { LevelStorage } from './storage/storage.js';
import { HistoryManager } from './editor/history.js';
import { sounds } from './audio/sound.js';
import { SidehopFile } from './storage/sidehop-format.js';
import { SidehopDemo } from './editor/demo.js';

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
    this.currentTheme = 'grass'; // 'grass', 'snowy', 'night', 'chrome', '8-bit', 'jungle'
    window.__SIDEHOP_THEME__ = this.currentTheme;

    // Snowflakes particle cache for snowy theme
    this.snowflakes = Array.from({ length: 48 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      radius: Math.random() * 2.2 + 1.0,
      speed: Math.random() * 0.8 + 0.6,
      drift: Math.random() * 0.6 - 0.3
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
    const stretchText = document.getElementById('stretch-frame-text');
    const stageStretchBtn = document.getElementById('stage-stretch-btn');

    if (this.isFrameStretched) {
      if (workbench) workbench.classList.add('frame-stretched');
      this.updateCanvasDimensions();

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
      this.updateCanvasDimensions();

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

  getStageBounds() {
    const workbench = document.querySelector('.workbench-container');
    const toolDrawer = document.getElementById('tool-drawer');
    const wbW = workbench ? workbench.clientWidth : window.innerWidth;
    const wbH = workbench ? workbench.clientHeight : (window.innerHeight - 56);
    const drawerVisible = toolDrawer && !toolDrawer.classList.contains('minimized');
    const minLeft = drawerVisible ? (toolDrawer.offsetLeft + toolDrawer.offsetWidth + 18) : 16;
    const minTop = 14;
    const maxRight = Math.max(minLeft + 480, wbW - 24);
    const maxBottom = Math.max(minTop + 320, wbH - 20);
    return { minLeft, minTop, maxRight, maxBottom, availW: maxRight - minLeft, availH: maxBottom - minTop };
  }

  setTheme(themeName) {
    const validThemes = ['grass', 'snowy', 'night', 'chrome', '8-bit', 'jungle'];
    if (!validThemes.includes(themeName)) themeName = 'grass';
    this.currentTheme = themeName;
    window.__SIDEHOP_THEME__ = themeName;
    document.body.setAttribute('data-theme', themeName);

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
      'jungle': '🌴'
    };
    const themeNames = {
      'grass': 'Grass Plains',
      'snowy': 'Snowy Peaks',
      'night': 'Night Horizon',
      'chrome': 'Chrome Future',
      '8-bit': '8-Bit Arcade',
      'jungle': 'Jungle Canopy'
    };
    if (themeIcon) themeIcon.textContent = themeIcons[themeName] || '🎨';
    if (themeLabel) themeLabel.textContent = `${themeNames[themeName] || 'Theme'} ▾`;

    // Save with level
    LevelStorage.autoSave(this.player, this.entities, this.background);
    this.showToast(`🎨 Theme: ${themeNames[themeName] || themeName}`);
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
    this.updateCanvasDimensions();
  }

  updateCanvasDimensions() {
    if (this.recorder && this.recorder.isRecording) return;
    if (this.isFrameStretched) {
      const header = document.querySelector('.neo-header');
      const headerH = header ? header.offsetHeight : 56;
      const w = window.innerWidth;
      const h = window.innerHeight - headerH;

      if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.camera.resize(w, h);
      }
      return;
    }

    const wrapper = this.canvas.parentElement;
    if (wrapper) {
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
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

    const theme = this.currentTheme || 'grass';

    switch (theme) {
      case 'snowy': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#B8DCF5');
        grad.addColorStop(0.55, '#DCEBF8');
        grad.addColorStop(1, '#EEF5FC');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.drawSnowyMountains(w, h);
        this.drawSnowflakes(w, h);
        break;
      }
      case 'night': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#060B19');
        grad.addColorStop(0.6, '#0E1733');
        grad.addColorStop(1, '#1E294B');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.drawStars(w, h);
        this.drawCrescentMoon(w, h);
        break;
      }
      case 'chrome': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#11151E');
        grad.addColorStop(0.55, '#202736');
        grad.addColorStop(1, '#333D4F');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.drawChromeGrid(w, h);
        break;
      }
      case '8-bit': {
        this.ctx.fillStyle = '#5C94FC';
        this.ctx.fillRect(0, 0, w, h);
        this.draw8BitBackground(w, h);
        break;
      }
      case 'jungle': {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0F2C1B');
        grad.addColorStop(0.55, '#19492E');
        grad.addColorStop(1, '#2D6B47');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.drawJungleBackground(w, h);
        break;
      }
      case 'grass':
      default: {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#70C5FF');
        grad.addColorStop(1, '#E0F4FF');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        this.drawParallaxClouds(w, h);
        this.drawParallaxHills(w, h);
        break;
      }
    }
  }

  drawSnowyMountains(w, h) {
    this.ctx.save();
    const horizon = h * 0.72;
    // Layer 1: Distant pale mountains
    this.ctx.fillStyle = '#C1D5E8';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h);
    const loopW1 = 1200;
    const off1 = (this.camera.x * 0.05) % loopW1;
    for (let x = -200; x <= w + 200; x += 180) {
      const peakX = x - off1;
      const peakH = 90 + Math.sin(x * 0.02) * 40;
      this.ctx.lineTo(peakX, horizon - peakH);
      this.ctx.lineTo(peakX + 90, horizon);
    }
    this.ctx.lineTo(w, h);
    this.ctx.closePath();
    this.ctx.fill();

    // Layer 2: Closer sharp mountain range with white snow caps
    this.ctx.fillStyle = '#8FA9C4';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h);
    const loopW2 = 1000;
    const off2 = (this.camera.x * 0.12) % loopW2;
    const peaks = [];
    for (let x = -200; x <= w + 200; x += 160) {
      const peakX = x - off2;
      const peakH = 130 + Math.cos(x * 0.015) * 50;
      peaks.push({ x: peakX, topY: horizon - peakH });
      this.ctx.lineTo(peakX, horizon - peakH);
      this.ctx.lineTo(peakX + 80, horizon);
    }
    this.ctx.lineTo(w, h);
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

    // Outer glow
    const glow = this.ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 60);
    glow.addColorStop(0, 'rgba(254, 243, 199, 0.35)');
    glow.addColorStop(1, 'rgba(254, 243, 199, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(moonX, moonY, 60, 0, Math.PI * 2);
    this.ctx.fill();

    // Moon body
    this.ctx.fillStyle = '#FEF3C7';
    this.ctx.beginPath();
    this.ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Cutout to make crescent
    this.ctx.fillStyle = '#080E20';
    this.ctx.beginPath();
    this.ctx.arc(moonX - 9, moonY - 6, radius - 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawChromeGrid(w, h) {
    this.ctx.save();
    const horizon = h * 0.62;

    // Distant cyber skyline
    this.ctx.fillStyle = '#1A2130';
    const bldOff = (this.camera.x * 0.06) % 600;
    for (let x = -100; x < w + 200; x += 45) {
      const bh = 40 + ((x * 37) % 70);
      this.ctx.fillRect(x - bldOff, horizon - bh, 36, bh);
      // Red/cyan beacon dot
      this.ctx.fillStyle = (x % 90 === 0) ? '#00E5FF' : '#FF3366';
      this.ctx.fillRect(x - bldOff + 16, horizon - bh - 2, 3, 3);
      this.ctx.fillStyle = '#1A2130';
    }

    // Horizon neon glow line
    this.ctx.strokeStyle = '#38BDF8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizon);
    this.ctx.lineTo(w, horizon);
    this.ctx.stroke();

    // Perspective floor grid lines
    const numFloorLines = 14;
    for (let i = 1; i <= numFloorLines; i++) {
      const t = Math.pow(i / numFloorLines, 2);
      const y = horizon + t * (h - horizon);
      this.ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 + t * 0.35})`;
      this.ctx.lineWidth = 1 + t * 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    // Vertical vanishing lines
    const centerX = w * 0.5 - (this.camera.x * 0.1) % 40;
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    this.ctx.lineWidth = 1.2;
    for (let x = -w * 0.5; x <= w * 1.5; x += 60) {
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, horizon);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  draw8BitBackground(w, h) {
    this.ctx.save();
    // 8-bit stepped pixel clouds
    this.ctx.fillStyle = '#FFFFFF';
    const cloudLoop = 800;
    const off = (this.camera.x * 0.1) % cloudLoop;
    [100, 360, 620].forEach((cx, idx) => {
      const x = ((cx - off) % cloudLoop + cloudLoop) % cloudLoop;
      const y = 60 + idx * 35;
      this.ctx.fillRect(x, y + 12, 64, 16);
      this.ctx.fillRect(x + 10, y + 4, 44, 16);
      this.ctx.fillRect(x + 20, y, 24, 8);
    });

    // 8-bit rolling green hills at bottom
    const hillHorizon = h * 0.78;
    this.ctx.fillStyle = '#00A800';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    const hillLoop = 600;
    const hOff = (this.camera.x * 0.15) % hillLoop;
    for (let x = -200; x < w + 300; x += 300) {
      const hx = x - hOff;
      this.ctx.beginPath();
      this.ctx.arc(hx + 150, hillHorizon + 80, 160, Math.PI, 0, false);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawJungleBackground(w, h) {
    this.ctx.save();
    // Sunbeams angled across canopy
    const sunbeamGrad = this.ctx.createLinearGradient(0, 0, w * 0.8, h);
    sunbeamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.12)');
    sunbeamGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.04)');
    sunbeamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = sunbeamGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.1, 0);
    this.ctx.lineTo(w * 0.35, 0);
    this.ctx.lineTo(w * 0.75, h);
    this.ctx.lineTo(w * 0.45, h);
    this.ctx.closePath();
    this.ctx.fill();

    // Jungle canopy silhouette layers
    this.ctx.fillStyle = '#0E2818';
    const loopW = 900;
    const off = (this.camera.x * 0.1) % loopW;
    for (let x = -100; x < w + 200; x += 140) {
      const tx = x - off;
      this.ctx.fillRect(tx + 28, h * 0.35, 8, h * 0.65);
      this.ctx.beginPath();
      this.ctx.arc(tx + 32, h * 0.35, 45, Math.PI * 0.9, Math.PI * 2.1);
      this.ctx.fill();
      this.ctx.strokeStyle = '#0E2818';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(tx + 15, h * 0.36);
      this.ctx.quadraticCurveTo(tx + 8, h * 0.5, tx + 18, h * 0.6);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawParallaxHills(w, h) {
    this.ctx.save();
    const horizon = h * 0.82;
    // Distant hill layer
    this.ctx.fillStyle = '#A3E635';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h);
    const loop1 = 800;
    const off1 = (this.camera.x * 0.08) % loop1;
    for (let x = -200; x < w + 300; x += 250) {
      const hx = x - off1;
      this.ctx.quadraticCurveTo(hx + 125, horizon - 55, hx + 250, horizon);
    }
    this.ctx.lineTo(w, h);
    this.ctx.closePath();
    this.ctx.fill();

    // Closer hill layer
    this.ctx.fillStyle = '#4ADE80';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h);
    const loop2 = 600;
    const off2 = (this.camera.x * 0.16) % loop2;
    for (let x = -200; x < w + 300; x += 200) {
      const hx = x - off2;
      this.ctx.quadraticCurveTo(hx + 100, horizon - 35, hx + 200, horizon + 15);
    }
    this.ctx.lineTo(w, h);
    this.ctx.closePath();
    this.ctx.fill();

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
        collectible: [{ id: 'star', label: '⭐ Star' }, { id: 'coin', label: '🪙 Coin' }, { id: 'heart', label: '❤️ Heart' }, { id: 'pistol', label: '🔫 Pistol' }],
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
        this.showToast('🪙 +100 PTS!');
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
        sounds.playGunPickup();
        this.entities.push(item);

        const label = variant === 'pistol'
          ? '🔫 Gun Powerup!'
          : variant === 'ammo'
            ? '📦 Ammunition Box!'
            : '❤️ Health Heart!';
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
        if (result.background) this.applyBackground(result.background);
        this.history.pushState(this.player, this.entities, this.background);
        LevelStorage.autoSave(this.player, this.entities, this.background);
        sounds.playCollect();
        this.showToast(`🎮 Loaded Level: ${result.levelName || 'Custom Level'} (.sidehop)`);
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
          { id: 'star', icon: '⭐', name: 'Star Gem', desc: 'Bright glowing star token (+500 pts)', shortName: 'Star' },
          { id: 'coin', icon: '🪙', name: 'Gold Coin', desc: 'Shiny spinning coin token (+100 pts)', shortName: 'Coin' },
          { id: 'heart', icon: '❤️', name: 'Health Heart', desc: 'Restores +1 heart of player health', shortName: 'Heart' },
          { id: 'pistol', icon: '🔫', name: 'Pistol Gun', desc: 'Sidearm blaster weapon (+15 Ammo)', shortName: 'Pistol' },
          { id: 'ammo', icon: '📦', name: 'Ammunition Box', desc: 'Ammo reload (+15 rounds)', shortName: 'Ammo' }
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

    // Reset scroll to top
    optionsList.scrollTop = 0;

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
          this.setTheme(selectedTheme);
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
      const title = `${this.background.theme.toUpperCase()} Background`;
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
      SidehopFile.download(`${this.background.theme}-background.sidehop`, pkg);
      sounds.playCollect();
      this.showToast('💾 Exported Background (.sidehop)!');
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
              bgThemeCards.forEach(c => c.classList.remove('active'));
              const customStatus = document.getElementById('bg-custom-status');
              if (customStatus) customStatus.style.display = 'block';
              LevelStorage.autoSave(this.player, this.entities, this.background);
              sounds.playCollect();
              this.showToast('🌄 Loaded .sidehop Background!');
            }
          } catch (err) {
            console.warn('Background import error:', err);
          }
        };
        reader.readAsText(file);
      }
    });

    // 5. Presets & .sidehop Level Management
    document.getElementById('load-preset-btn').addEventListener('click', () => {
      this.loadStarterWorld();
      sounds.playLand();
      this.showToast('🔄 World Reset to Default!');
    });

    document.getElementById('export-level-btn').addEventListener('click', () => {
      LevelStorage.exportLevel(this.player, this.entities, this.background);
      sounds.playCollect();
      this.showToast('💾 Level Exported (.sidehop)!');
    });

    document.getElementById('export-html-btn')?.addEventListener('click', async () => {
      sounds.playCollect();
      this.showToast('🌐 Generating Standalone HTML Web Game...');
      await LevelStorage.exportStandaloneHtml(this.player, this.entities, this.background, this.currentTheme, 'Sidehop Game');
      this.showToast('✅ Downloaded Standalone HTML Web Game!');
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-level-btn').addEventListener('click', () => {
      importInput.click();
    });

    importInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleUniversalSidehopImport(e.target.files[0]);
        importInput.value = '';
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
      this.gunPickedUpInLevel = false;
      this.player.respawn();
      this.player.hearts = this.player.maxHearts || 4;
      this.player.invulnerableTimer = 0;
      for (const ent of this.entities) {
        if (ent.variant === 'mystery') ent.isUsed = false;
        if (ent.type === 'collectible') {
          ent.collected = false;
          ent.active = true;
        }
      }
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
        if (s.update && (s.type === 'crate' || s.type === 'block')) s.update(dt);
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
            const hadPistol = this.player.hasPistol;
            if (this.player.takeDamage(1, knockDir)) {
              sounds.playHurt();
              this.spawnHurtParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
              if (hadPistol) {
                this.spawnPistolLostParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                this.showToast('💥 Lost Pistol Powerup!');
              }
              if (this.player.hearts <= 0) {
                this.player.respawn();
                this.bullets = [];
                this.gunPickedUpInLevel = false;
                for (const e of this.entities) {
                  if (e.variant === 'mystery') e.isUsed = false;
                }
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
              // Hurt player on collision (depletes 1 heart with i-frames & knockback, loses gun powerup)
              const knockDir = (this.player.x + this.player.width / 2 < ent.x + ent.width / 2) ? -1 : 1;
              const hadPistol = this.player.hasPistol;
              if (this.player.takeDamage(1, knockDir)) {
                sounds.playHurt();
                this.spawnHurtParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                if (hadPistol) {
                  this.spawnPistolLostParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                  this.showToast('💥 Lost Pistol Powerup!');
                }
                if (this.player.hearts <= 0) {
                  this.player.respawn();
                  this.bullets = [];
                  this.gunPickedUpInLevel = false;
                  for (const e of this.entities) {
                    if (e.variant === 'mystery') e.isUsed = false;
                  }
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
              this.showToast('🔫 Pistol Acquired! (+15 Ammo) [F/X to Shoot]');
            } else if (isAmmo) {
              this.player.hasPistol = true;
              this.player.ammo = (this.player.ammo || 0) + 15;
              this.gunPickedUpInLevel = true;
              this.score += 200;
              this.showToast('📦 Ammo Reloaded! (+15 Rounds) [F/X to Shoot]');
            } else if (ent.variant === 'heart') {
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
        this.bullets = [];
        this.gunPickedUpInLevel = false;
        for (const e of this.entities) {
          if (e.variant === 'mystery') e.isUsed = false;
        }
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
    this.updateCanvasDimensions();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update terrain spatial map for seamless autotiling & neighbor detection
    SolidBlock.updateTerrainMap(this.entities);

    // 1. Draw Active Background Atmosphere / Custom Art
    this.renderBackground();

    // 2. Draw World Entities
    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);

    for (const ent of this.entities) {
      ent.draw(this.ctx);
    }

    if (this.bullets && this.bullets.length > 0) {
      for (const b of this.bullets) {
        b.draw(this.ctx);
      }
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

    // 5. Draw Confetti & Particle Effects
    if (this.confetti.length > 0) {
      this.ctx.save();
      for (const p of this.confetti) {
        this.ctx.save();
        const drawX = p.isScreen ? p.x : (p.x - this.camera.x);
        const drawY = p.isScreen ? p.y : (p.y - this.camera.y);
        this.ctx.translate(drawX, drawY);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
      }
      this.ctx.restore();
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

      // Gun icon & Ammo Count
      this.ctx.font = '900 16px "Fredoka", sans-serif';
      this.ctx.fillStyle = '#121212';
      this.ctx.fillText(`🔫 ${this.player.ammo} RDS`, ammoX + 12, ammoY + 28);

      // Key prompt
      this.ctx.font = '700 10px "Fredoka", sans-serif';
      this.ctx.fillStyle = '#555555';
      this.ctx.fillText('[F / X / Click]', ammoX + 14, ammoY + 42);
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
      this.render();
    } catch (err) {
      console.error('gameLoop update/render error:', err);
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

