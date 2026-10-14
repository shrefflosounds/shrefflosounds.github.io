// Sidehop Master Application Coordinator — Enhanced Frame-Safe Interaction & Pan Controls

import { Player } from './engine/entities.js';
import { PhysicsEngine } from './engine/physics.js';
import { Camera } from './engine/camera.js';
import { GridEditor } from './editor/grid.js';
import { ArtStudio } from './editor/paint.js';
import { Inspector } from './editor/inspector.js';
import { VideoRecorder } from './recorder/recorder.js';
import { LevelStorage } from './storage/storage.js';
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

    // Subsystems
    this.editor = new GridEditor(this.canvas, this.camera, 40);
    this.artStudio = new ArtStudio(
      document.getElementById('art-studio-modal'),
      document.getElementById('paint-canvas')
    );
    this.inspector = new Inspector(document.getElementById('inspector-modal'));
    this.recorder = new VideoRecorder(this.canvas);

    // Track Spacebar tap vs hold
    this.spacePressTime = 0;
    this.didPanDuringSpace = false;

    // Confetti particles for victory
    this.confetti = [];

    this.lastTime = performance.now();

    this.initLevel();
    this.bindUI();
    this.bindEvents();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initLevel() {
    const loaded = LevelStorage.autoLoad(this.player, this.entities);
    if (!loaded || this.entities.length === 0) {
      this.loadCratePreset();
    }
  }

  loadCratePreset() {
    const preset = LevelStorage.getPresetCrateChallenge();
    this.player.setSpawn(preset.playerSpawn.x, preset.playerSpawn.y);
    this.entities = preset.entities;
    this.camera.recenter(this.player.spawnX, this.player.spawnY);
    if (this.editor.selectedEntity) {
      this.updateActionCard(this.editor.selectedEntity);
    }
  }

  // --- Frame-Safe Clamped Action Card Positioning ---
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
        crate: '📦 CRATE BLOCK',
        springboard: '🌀 SPRING BOUNCER',
        hazard: '⚠️ SPIKE HAZARD',
        enemy: '👾 ENEMY WALKER',
        moving_platform: '🛹 MOVING PLATFORM',
        collectible: '⭐ STAR TOKEN',
        goal: '🏁 GOAL FINISH'
      };
      badge.textContent = typeIcons[ent.type] || `📦 ${ent.type.toUpperCase()}`;
    }

    actionCard.classList.add('active');

    // Measure card dimensions
    const cardW = actionCard.offsetWidth || 300;
    const cardH = actionCard.offsetHeight || 75;
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

    // If near top of canvas (or off-screen top), flip cleanly below the entity
    if (top < 14) {
      top = entBottom.y + 12;
    }

    // Strict vertical clamping inside canvas frame (14px from top and bottom)
    top = Math.max(14, Math.min(canvasH - cardH - 14, top));

    actionCard.style.left = `${left}px`;
    actionCard.style.top = `${top}px`;
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

    // 3. Audio & Music Buttons
    const soundBtn = document.getElementById('sound-toggle-btn');
    soundBtn.addEventListener('click', () => {
      sounds.setMuted(!sounds.muted);
      soundBtn.querySelector('span').textContent = sounds.muted ? '🔇' : '🔊';
      sounds.playClick();
    });

    const bgmBtn = document.getElementById('bgm-toggle-btn');
    bgmBtn.addEventListener('click', () => {
      const playing = sounds.toggleBgm();
      bgmBtn.style.backgroundColor = playing ? 'var(--mint-green)' : 'var(--bg-panel)';
      sounds.playClick();
    });

    // 4. Presets and Level Management
    document.getElementById('load-preset-btn').addEventListener('click', () => {
      this.loadCratePreset();
      sounds.playLand();
    });

    document.getElementById('export-level-btn').addEventListener('click', () => {
      LevelStorage.exportLevel(this.player, this.entities);
      sounds.playCollect();
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-level-btn').addEventListener('click', () => {
      importInput.click();
    });

    importInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        LevelStorage.importLevel(e.target.files[0], this.player, this.entities, (ok) => {
          if (ok) sounds.playCollect();
        });
      }
    });

    // 5. Tool Drawer Palette Clicks
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
        this.editor.setPaletteItem(btn.getAttribute('data-palette'));

        // Switch to place tool automatically
        toolButtons.forEach(b => b.classList.remove('active'));
        const placeBtn = document.querySelector('[data-tool="place"]');
        if (placeBtn) placeBtn.classList.add('active');
      });
    });

    // 6. Entity Floating Action Card
    const actionCard = document.getElementById('entity-action-card');
    this.editor.onSelectEntity = (ent) => {
      this.updateActionCard(ent);
    };

    this.editor.onDeselect = () => {
      actionCard.classList.remove('active');
    };

    this.editor.onEntityMoved = () => {
      LevelStorage.autoSave(this.player, this.entities);
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
          LevelStorage.autoSave(this.player, this.entities);
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
          this.entities.splice(idx, 1);
          this.editor.selectedEntity = null;
          actionCard.classList.remove('active');
          sounds.playPaintSquish();
          LevelStorage.autoSave(this.player, this.entities);
        }
      }
    });

    // 7. On-Screen Navigation Controls (Edit Mode)
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

    // 8. Art Studio Modal Controls
    document.getElementById('close-art-studio').addEventListener('click', () => this.artStudio.close());
    document.getElementById('paint-apply-btn').addEventListener('click', () => {
      this.artStudio.apply();
      LevelStorage.autoSave(this.player, this.entities);
    });
    document.getElementById('paint-reset-btn').addEventListener('click', () => {
      this.artStudio.resetDefault();
      LevelStorage.autoSave(this.player, this.entities);
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

    // 9. Inspector Modal Controls
    document.getElementById('inspector-done-btn').addEventListener('click', () => {
      this.inspector.close();
      LevelStorage.autoSave(this.player, this.entities);
    });

    // 10. Victory Overlay Controls
    document.getElementById('victory-restart-btn').addEventListener('click', () => {
      document.getElementById('victory-overlay').classList.remove('active');
      this.isLevelWon = false;
      this.player.respawn();
      sounds.playClick();
    });

    document.getElementById('victory-edit-btn').addEventListener('click', () => {
      document.getElementById('victory-overlay').classList.remove('active');
      this.isLevelWon = false;
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
      document.getElementById('victory-overlay').classList.remove('active');
      LevelStorage.autoSave(this.player, this.entities);
    } else {
      modeBtn.classList.add('neo-btn-primary');
      modeBtn.classList.remove('neo-btn-pink');
      modeIcon.textContent = '▶';
      modeText.textContent = 'PLAY TEST';
      toolDrawer.classList.remove('minimized');
      if (navControls) navControls.classList.remove('hidden');
      this.player.respawn();
    }
  }

  bindEvents() {
    // Keyboard Inputs
    window.addEventListener('keydown', (e) => {
      // Don't capture when typing in text inputs or sliders
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
        } else {
          // In play mode, space is jump (handled in player)
        }
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
            this.entities.splice(idx, 1);
            this.editor.selectedEntity = null;
            document.getElementById('entity-action-card').classList.remove('active');
            sounds.playPaintSquish();
            LevelStorage.autoSave(this.player, this.entities);
          }
        }
      }

      // Escape deselects
      if (e.code === 'Escape' && this.mode === 'edit') {
        this.editor.selectedEntity = null;
        document.getElementById('entity-action-card').classList.remove('active');
      }

      // Number keys switch tools in edit mode: 1=Place, 2=Select, 3=Pan, 4=Erase
      if (this.mode === 'edit') {
        const toolMap = { Digit1: 'place', Digit2: 'select', Digit3: 'pan', Digit4: 'erase' };
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
        // If Space was tapped quickly without dragging, toggle mode
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

      // Collect solid collision objects (Crates and Moving Platforms)
      const solids = this.entities.filter(ent => ent.type === 'crate' || ent.type === 'moving_platform');
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
            sounds.playHurt();
            this.player.respawn();
          }
        }

        // Enemies
        else if (ent.type === 'enemy') {
          ent.update(dt, solids);
          if (this.physics.checkOverlap(this.player, ent)) {
            // Check if jumping from above to stomp
            if (ent.stompable && this.player.vy > 0 && this.player.y + this.player.height - 12 < ent.y + ent.height / 2) {
              ent.stomp();
              this.player.vy = -450; // little bounce hop
              this.score += 50;
            } else {
              sounds.playHurt();
              this.player.respawn();
            }
          }
        }

        // Moving Platforms
        else if (ent.type === 'moving_platform') {
          ent.update(dt);
          // If standing on moving platform, carry player along
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

        // Collectibles
        else if (ent.type === 'collectible') {
          ent.update(dt);
          if (this.physics.checkOverlap(this.player, ent)) {
            ent.collect();
            this.score += 100;
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

      // Animate springs, collectibles, and goal flags subtly in edit mode
      for (const ent of this.entities) {
        if (ent.update && (ent.type === 'springboard' || ent.type === 'collectible' || ent.type === 'goal')) {
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

    // Spawn 90 colorful confetti pieces
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

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Warm Drafting Paper / Canvas Background
    this.ctx.fillStyle = '#FAF8F5';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    // Offset world by camera coordinates
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw Entities
    for (const ent of this.entities) {
      ent.draw(this.ctx);
    }

    // Draw Player
    this.player.draw(this.ctx);

    this.ctx.restore();

    // In Edit Mode, draw grid lines and hover ghost
    if (this.mode === 'edit') {
      this.editor.draw(this.ctx);
    }

    // Draw HUD in Play Mode (Score & Status)
    if (this.mode === 'play') {
      this.ctx.save();
      this.ctx.font = '700 20px "Fredoka", sans-serif';
      this.ctx.fillStyle = '#121212';
      this.ctx.fillText(`SCORE: ${this.score}`, 24, 38);
      this.ctx.restore();
    }

    // Draw Confetti
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
