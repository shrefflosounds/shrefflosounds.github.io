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

    if (!ent || this.mode !== 'edit') {
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

    // Render Mario Maker-style component variant pills in action card
    const variantPicker = document.getElementById('action-variant-picker');
    if (variantPicker) {
      variantPicker.innerHTML = '';
      const variantDefs = {
        block: [{ id: 'solid', label: '🧱 Solid' }, { id: 'mystery', label: '❓ Mystery' }, { id: 'cloud', label: '☁️ Cloud' }, { id: 'ice', label: '🧊 Ice' }],
        crate: [{ id: 'solid', label: '🧱 Solid' }, { id: 'mystery', label: '❓ Mystery' }, { id: 'cloud', label: '☁️ Cloud' }, { id: 'ice', label: '🧊 Ice' }],
        enemy: [{ id: 'walker', label: '🥔 Walker' }, { id: 'winged', label: '🪽 Winged' }, { id: 'spiky', label: '🦔 Spiky' }],
        collectible: [{ id: 'coin', label: '🪙 Coin' }, { id: 'star', label: '⭐ Star' }, { id: 'heart', label: '❤️ Heart' }],
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
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    // Calculate world entity center and bounds transformed to screen space
    const entCenter = this.camera.worldToScreen(ent.x + ent.width / 2, ent.y);
    const entBottom = this.camera.worldToScreen(ent.x + ent.width / 2, ent.y + ent.height);

    // Horizontal centering with strict frame padding (14px from left and right borders)
    let left = entCenter.x - cardW / 2;
    left = Math.max(14, Math.min(canvasW - cardW - 14, left));

    // Vertical placement: default above entity
    let top = entCenter.y - cardH - 12;

    // If near top of canvas, flip cleanly below the entity
    if (top < 14) {
      top = entBottom.y + 12;
    }

    // Strict vertical clamping inside canvas frame (14px from top and bottom)
    top = Math.max(14, Math.min(canvasH - cardH - 14, top));

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
        title: 'BLOCK TYPES',
        variants: [
          { id: 'solid', icon: '🧱', name: 'Solid Ground', desc: 'Standard solid block platform', shortName: 'Block' },
          { id: 'mystery', icon: '❓', name: 'Mystery Block', desc: 'Breakable surprise block [?]', shortName: 'Mystery' },
          { id: 'cloud', icon: '☁️', name: 'Cloud Platform', desc: 'Soft floating cloud block', shortName: 'Cloud' },
          { id: 'ice', icon: '🧊', name: 'Ice Block', desc: 'Low-friction slippery surface', shortName: 'Ice' }
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

      // 'R' toggles recording
      if (e.code === 'KeyR') {
        this.recorder.toggleRecording();
      }

      // 'P' toggles mode directly
      if (e.code === 'KeyP') {
        this.toggleMode();
      }

      // Delete or Backspace deletes selected entity in edit mode
      if ((e.code === 'Delete' || e.code === 'Backspace') && this.mode === 'edit') {
        if (this.editor.selectedEntity && this.editor.selectedEntity !== this.player) {
          const idx = this.entities.indexOf(this.editor.selectedEntity);
          if (idx !== -1) {
            this.history.pushState(this.player, this.entities, this.background);
            this.entities.splice(idx, 1);
            this.editor.selectedEntity = null;
            document.getElementById('entity-action-card').classList.remove('active');
            sounds.playPaintSquish();
            LevelStorage.autoSave(this.player, this.entities, this.background);
          }
        }
      }

      // Escape deselects
      if (e.code === 'Escape' && this.mode === 'edit') {
        this.editor.selectedEntity = null;
        document.getElementById('entity-action-card').classList.remove('active');
      }

      // Number keys switch tools in edit mode: 1=Select, 2=Place, 3=Pan, 4=Erase
      if (this.mode === 'edit') {
        const toolMap = { Digit1: 'select', Digit2: 'place', Digit3: 'pan', Digit4: 'erase' };
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

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
      // In Edit Mode, allow keyboard WASD / Arrow panning
      const panSpeed = 450 * dt;
      let panned = false;
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
        this.camera.pan(-panSpeed, 0);
        panned = true;
      }
      if (this.keys['ArrowRight'] || this.keys['KeyD']) {
        this.camera.pan(panSpeed, 0);
        panned = true;
      }
      if (this.keys['ArrowUp'] || this.keys['KeyW']) {
        this.camera.pan(0, -panSpeed);
        panned = true;
      }
      if (this.keys['ArrowDown'] || this.keys['KeyS']) {
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
