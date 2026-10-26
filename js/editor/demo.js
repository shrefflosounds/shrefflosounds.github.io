// Sidehop Built-in Interactive Feature Tour & Automation Demo
// Drives all major and minor features safely without modifying or damaging user work.

import { sounds } from '../audio/sound.js';
import { SolidBlock, EnemyWalker, Collectible, Springboard } from '../engine/entities.js?v=20261026_04';

export class SidehopDemo {
  constructor(app) {
    this.app = app;
    this.isActive = false;
    this.isPaused = false;
    this.currentStep = 0;
    this.timers = [];
    this.userBackup = null;
    this.bannerEl = null;
    this.cursorEl = null;
    this.demoEntities = [];

    this.steps = [
      {
        id: 'welcome',
        title: '🌟 Welcome to Sidehop',
        desc: 'Build, paint, tune, and play 2D platformers right in your browser. Welcome to this quick tour of every major feature',
        duration: 3800
      },
      {
        id: 'blocks',
        title: '🧱 Components, Types & Blocks',
        desc: 'Choose from 13 block styles: Solid blocks, angled slopes, moving platforms, etc.',
        duration: 5200
      },
      {
        id: 'items',
        title: '⭐ Powerups, Weapons & Enemies',
        desc: 'Place Coins, Hearts, Guns, and other fun things',
        duration: 4800
      },
      {
        id: 'tuning',
        title: '🎛️ Real-Time Physics Tuning',
        desc: 'Tune Running, Jumping, Gravity, Weight, Bounciness, and more component attributes',
        duration: 4600
      },
      {
        id: 'art',
        title: '🎨 Art Studio',
        desc: 'Draw characters, blocks, or import any photo or GIF into your creation',
        duration: 4800
      },
      {
        id: 'backgrounds',
        title: '🌄 Themes',
        desc: 'Transform visuals with themes like: Tundra, Neon, Chrome, and more',
        duration: 4200
      },
      {
        id: 'playtest',
        title: '🎮 Realtime Edit and Play',
        desc: 'Seamlessly switch from Play Mode to Edit Mode for quick edits and playtests',
        duration: 6500
      },
      {
        id: 'recording',
        title: '🎥 Video Recording & .sidehop Sharing',
        desc: 'Screen Capture with one click, or export easily shareable ".sidehop" files or standalone html',
        duration: 4000
      }
    ];

    // Listen for Escape key to exit demo anytime
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.stop(true);
      }
    });
  }

  // Backup complete user workspace state
  saveUserState() {
    const app = this.app;
    this.userBackup = {
      entitiesData: app.entities.map(ent => ({
        id: ent.id,
        type: ent.type,
        x: ent.x,
        y: ent.y,
        width: ent.width,
        height: ent.height,
        variant: ent.variant,
        content: ent.content,
        bounciness: ent.bounciness,
        friction: ent.friction,
        isOneWay: ent.isOneWay,
        speed: ent.speed,
        jumpForce: ent.jumpForce,
        gravityScale: ent.gravityScale,
        maxHearts: ent.maxHearts,
        hearts: ent.hearts,
        doubleJumpAllowed: ent.doubleJumpAllowed,
        patrolRange: ent.patrolRange,
        stompable: ent.stompable,
        distance: ent.distance,
        axis: ent.axis,
        customVisual: ent.customVisual
      })),
      player: {
        x: app.player.x,
        y: app.player.y,
        speed: app.player.speed,
        jumpForce: app.player.jumpForce,
        gravityScale: app.player.gravityScale,
        maxHearts: app.player.maxHearts,
        hearts: app.player.hearts,
        doubleJumpAllowed: app.player.doubleJumpAllowed,
        customVisual: app.player.customVisual
      },
      background: {
        theme: app.background.theme,
        customImage: app.background.customImage
      },
      camera: {
        x: app.camera.x,
        y: app.camera.y,
        zoom: app.camera.zoom
      },
      mode: app.mode,
      score: app.score,
      coins: app.coins,
      ammo: app.ammo,
      gunPickedUpInLevel: app.gunPickedUpInLevel,
      undoStack: [...app.history.undoStack],
      redoStack: [...app.history.redoStack]
    };
  }

  // Restore user workspace state without losing any edits
  restoreUserState() {
    if (!this.userBackup) return;
    const app = this.app;
    const b = this.userBackup;

    // Reset mode
    if (app.mode !== b.mode) {
      if (b.mode === 'edit' && app.mode === 'play') {
        app.toggleMode();
      } else if (b.mode === 'play' && app.mode === 'edit') {
        app.toggleMode();
      }
    }

    // Reconstruct entities
    app.entities = [];
    for (const d of b.entitiesData) {
      let ent = null;
      if (d.type === 'crate') {
        ent = new SolidBlock(d.x, d.y, d.width, d.height, d.variant, d.content);
        if (d.bounciness !== undefined) ent.bounciness = d.bounciness;
        if (d.friction !== undefined) ent.friction = d.friction;
      } else if (d.type === 'enemy') {
        ent = new EnemyWalker(d.x, d.y, d.width, d.height, d.variant);
        if (d.speed !== undefined) ent.speed = d.speed;
        if (d.patrolRange !== undefined) ent.patrolRange = d.patrolRange;
        if (d.stompable !== undefined) ent.stompable = d.stompable;
      } else if (d.type === 'collectible') {
        ent = new Collectible(d.x, d.y, d.width, d.height, d.variant);
      } else if (d.type === 'springboard') {
        ent = new Springboard(d.x, d.y, d.width, d.height, d.variant);
      } else if (window.MovingPlatform && d.type === 'moving_platform') {
        ent = new window.MovingPlatform(d.x, d.y, d.width, d.height);
      } else if (window.HazardSpikes && d.type === 'hazard') {
        ent = new window.HazardSpikes(d.x, d.y, d.width, d.height);
      } else if (window.GoalFlag && d.type === 'goal') {
        ent = new window.GoalFlag(d.x, d.y, d.width, d.height);
      }

      if (ent) {
        if (d.customVisual) ent.setCustomVisual(d.customVisual);
        app.entities.push(ent);
      }
    }

    // Restore player
    app.player.x = b.player.x;
    app.player.y = b.player.y;
    app.player.vx = 0;
    app.player.vy = 0;
    app.player.speed = b.player.speed;
    app.player.jumpForce = b.player.jumpForce;
    app.player.gravityScale = b.player.gravityScale;
    app.player.maxHearts = b.player.maxHearts;
    app.player.hearts = b.player.hearts;
    app.player.doubleJumpAllowed = b.player.doubleJumpAllowed;
    app.player.setCustomVisual(b.player.customVisual);

    // Restore background & camera
    app.applyBackground(b.background);
    app.camera.x = b.camera.x;
    app.camera.y = b.camera.y;
    app.camera.zoom = b.camera.zoom;

    // Restore score & inventory
    app.score = b.score;
    app.coins = b.coins;
    app.ammo = b.ammo;
    app.gunPickedUpInLevel = b.gunPickedUpInLevel;
    if (app.updateScoreUI) app.updateScoreUI();

    // Restore history
    app.history.undoStack = b.undoStack;
    app.history.redoStack = b.redoStack;
    if (app.history.updateButtons) app.history.updateButtons();
    else if (app.history.notifyChange) app.history.notifyChange();

    // Deselect all
    app.editor.selectedEntity = null;
    app.editor.selectedEntities = [];
    app.updateActionToolbar();

    if (SolidBlock.updateTerrainMap) {
      SolidBlock.updateTerrainMap(app.entities);
    }
  }

  schedule(fn, delay) {
    const id = setTimeout(() => {
      if (this.isActive) fn();
    }, delay);
    this.timers.push(id);
    return id;
  }

  clearTimers() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers = [];
  }

  start() {
    if (this.isActive) return;

    // Close any active dialogs
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    document.querySelectorAll('.neo-modal-overlay.active').forEach(m => m.classList.remove('active'));

    this.saveUserState();
    this.isActive = true;
    this.isPaused = false;
    this.app.isDemoActive = true;
    this.currentStep = 0;

    // Ensure we start in Edit Mode
    if (this.app.mode === 'play') {
      this.app.toggleMode();
    }

    this.createUI();
    if (sounds.playFanfare) sounds.playFanfare();
    else if (sounds.playVictory) sounds.playVictory();
    this.app.showToast('🎬 Sidehop Interactive Tour Started!');

    this.runStep(0);
  }

  stop(restore = true) {
    if (!this.isActive) return;
    this.clearTimers();

    if (this.bannerEl) {
      this.bannerEl.remove();
      this.bannerEl = null;
    }
    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }

    if (restore) {
      this.restoreUserState();
    }

    this.isActive = false;
    this.app.isDemoActive = false;
    sounds.playClick();
    this.app.showToast('✨ Tour Finished! Canvas restored to your workspace.');
  }

  createUI() {
    // Top floating demo control bar
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'demo-tour-banner';
    this.bannerEl.innerHTML = `
      <div class="demo-banner-left">
        <span class="demo-badge">🎬 SIDEHOP DEMO</span>
        <span class="demo-step-counter" id="demo-step-counter">STEP 1 OF 8</span>
        <span class="demo-step-title" id="demo-step-title">Welcome to Sidehop</span>
      </div>
      <div class="demo-banner-center" id="demo-step-desc">
        Watch as we drive all major features of Sidehop automatically!
      </div>
      <div class="demo-banner-actions">
        <button id="demo-prev-btn" class="demo-btn-sm" title="Previous step">⏮️</button>
        <button id="demo-next-btn" class="demo-btn-sm" title="Next step">⏭️ Next</button>
        <button id="demo-exit-btn" class="demo-btn-sm demo-exit" title="Exit Tour (Escape)">Stop Demo ✕</button>
      </div>
    `;
    document.body.appendChild(this.bannerEl);

    document.getElementById('demo-prev-btn')?.addEventListener('click', () => this.prevStep());
    document.getElementById('demo-next-btn')?.addEventListener('click', () => this.nextStep());
    document.getElementById('demo-exit-btn')?.addEventListener('click', () => this.stop(true));

    // Animated Ghost Pointer
    this.cursorEl = document.createElement('div');
    this.cursorEl.className = 'demo-ghost-cursor';
    this.cursorEl.innerHTML = `
      <div class="cursor-pointer">👆</div>
      <div class="cursor-ripple"></div>
    `;
    document.body.appendChild(this.cursorEl);
    this.moveCursor(window.innerWidth / 2, window.innerHeight / 2);
  }

  moveCursor(targetX, targetY, callback) {
    if (!this.cursorEl) return;
    this.cursorEl.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    if (callback) {
      this.schedule(callback, 500);
    }
  }

  clickAt(targetX, targetY, callback) {
    this.moveCursor(targetX, targetY, () => {
      if (!this.cursorEl) return;
      this.cursorEl.classList.add('clicking');
      sounds.playClick();
      this.schedule(() => {
        if (this.cursorEl) this.cursorEl.classList.remove('clicking');
        if (callback) callback();
      }, 200);
    });
  }

  updateBanner(step) {
    const counter = document.getElementById('demo-step-counter');
    const title = document.getElementById('demo-step-title');
    const desc = document.getElementById('demo-step-desc');
    if (counter) counter.textContent = `STEP ${this.currentStep + 1} OF ${this.steps.length}`;
    if (title) title.textContent = step.title;
    if (desc) desc.textContent = step.desc;
  }

  nextStep() {
    this.clearTimers();
    if (this.currentStep < this.steps.length - 1) {
      this.runStep(this.currentStep + 1);
    } else {
      this.stop(true);
    }
  }

  prevStep() {
    this.clearTimers();
    if (this.currentStep > 0) {
      this.runStep(this.currentStep - 1);
    }
  }

  runStep(index) {
    this.currentStep = index;
    const step = this.steps[index];
    if (!step) return;

    this.updateBanner(step);

    switch (step.id) {
      case 'welcome':
        this.stepWelcome();
        break;
      case 'blocks':
        this.stepBlocks();
        break;
      case 'items':
        this.stepItems();
        break;
      case 'tuning':
        this.stepTuning();
        break;
      case 'art':
        this.stepArtStudio();
        break;
      case 'backgrounds':
        this.stepBackgrounds();
        break;
      case 'playtest':
        this.stepPlaytest();
        break;
      case 'recording':
        this.stepRecording();
        break;
    }
  }

  // --- STEP 1: WELCOME & STAGE PANNING ---
  stepWelcome() {
    const app = this.app;
    // Setup clean demonstration stage
    app.entities = [];
    app.player.x = 80;
    app.player.y = 432;
    app.player.vx = 0;
    app.player.vy = 0;
    app.camera.x = 0;
    app.camera.y = 0;

    // Build base landing runway
    const T = 40;
    for (let x = 0; x <= 640; x += T) {
      app.entities.push(new SolidBlock(x, 480, T, T, 'solid'));
      app.entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }
    SolidBlock.updateTerrainMap(app.entities);

    // Pan camera across the stage
    let panProgress = 0;
    const panInterval = setInterval(() => {
      if (!this.isActive || this.currentStep !== 0) {
        clearInterval(panInterval);
        return;
      }
      panProgress += 0.05;
      app.camera.x = Math.sin(panProgress) * 60;
    }, 40);

    this.schedule(() => {
      clearInterval(panInterval);
      app.camera.x = 0;
      this.nextStep();
    }, this.steps[0].duration);
  }

  // --- STEP 2: BLOCKS, SLOPES, & QUESTION BLOCKS ---
  stepBlocks() {
    const app = this.app;
    const T = 40;

    // Highlight block tool button
    const blockBtn = document.querySelector('[data-item="block"]');
    if (blockBtn) {
      const rect = blockBtn.getBoundingClientRect();
      this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
        // Build 45° Slope Up and Down hill
        app.entities.push(new SolidBlock(200, 480, T, T, 'slope_up'));
        app.entities.push(new SolidBlock(240, 440, T, T, 'solid'));
        app.entities.push(new SolidBlock(280, 480, T, T, 'slope_down'));

        // Row of Slippery Ice Blocks
        app.entities.push(new SolidBlock(360, 400, T, T, 'ice'));
        app.entities.push(new SolidBlock(400, 400, T, T, 'ice'));
        app.entities.push(new SolidBlock(440, 400, T, T, 'ice'));

        // Mystery Question Block overhead with Pistol Powerup
        app.entities.push(new SolidBlock(400, 280, T, T, 'mystery', 'powerup'));

        // Super Bouncy Note Block
        app.entities.push(new SolidBlock(520, 440, T, T, 'note'));

        SolidBlock.updateTerrainMap(app.entities);
        sounds.playPop();
      });
    }

    this.schedule(() => this.nextStep(), this.steps[1].duration);
  }

  // --- STEP 3: ITEMS, WEAPONS & HAZARDS ---
  stepItems() {
    const app = this.app;
    const T = 40;

    const coinBtn = document.querySelector('[data-item="collectible"]');
    if (coinBtn) {
      const rect = coinBtn.getBoundingClientRect();
      this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
        // Collectibles on stage
        app.entities.push(new Collectible(364, 360, 32, 32, 'coin'));
        app.entities.push(new Collectible(444, 360, 32, 32, 'star'));

        // Springboard for high jumps
        app.entities.push(new Springboard(320, 440, T, T, 'spring'));

        // Patrolling Potato Walker enemy
        app.entities.push(new EnemyWalker(480, 440, T, T, 'walker'));

        sounds.playCollect();
      });
    }

    this.schedule(() => this.nextStep(), this.steps[2].duration);
  }

  // --- STEP 4: REAL-TIME PARAMETER TUNING ---
  stepTuning() {
    const app = this.app;
    // Select Player to tune
    app.editor.selectedEntity = app.player;
    app.updateActionToolbar();

    const tuneBtn = document.getElementById('action-tune-btn');
    if (tuneBtn) {
      const rect = tuneBtn.getBoundingClientRect();
      this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
        app.inspector.open(app.player);

        // Animate speed slider
        const slider = document.querySelector('.neo-slider');
        if (slider) {
          slider.value = 450;
          slider.dispatchEvent(new Event('input'));
        }

        this.schedule(() => {
          app.inspector.close();
        }, 2200);
      });
    }

    this.schedule(() => this.nextStep(), this.steps[3].duration);
  }

  // --- STEP 5: KID PIX ART STUDIO & SQUARE BLOCK SHAPE PRESERVATION ---
  stepArtStudio() {
    const app = this.app;
    // Find a block to paint
    const targetBlock = app.entities.find(e => e.type === 'crate' && e.variant === 'solid');
    if (targetBlock) {
      app.editor.selectedEntity = targetBlock;
      app.updateActionToolbar();

      const paintBtn = document.getElementById('action-paint-btn');
      if (paintBtn) {
        const rect = paintBtn.getBoundingClientRect();
        this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
          app.artStudio.openForEntity(targetBlock);

          // Stamp a star onto the block
          this.schedule(() => {
            app.artStudio.currentTool = 'stamp';
            app.artStudio.currentStamp = 'star';
            app.artStudio.currentColor = '#00E5FF';
            app.artStudio.drawStamp(110, 110);
            sounds.playPaintSquish();

            // Apply to entity and close
            this.schedule(() => {
              app.artStudio.apply();
            }, 1200);
          }, 800);
        });
      }
    }

    this.schedule(() => this.nextStep(), this.steps[4].duration);
  }

  // --- STEP 6: ATMOSPHERIC BACKGROUNDS ---
  stepBackgrounds() {
    const app = this.app;
    const bgBtn = document.getElementById('bg-modal-btn');
    if (bgBtn) {
      const rect = bgBtn.getBoundingClientRect();
      this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
        app.applyBackground({ theme: 'sunset' });
        sounds.playClick();

        this.schedule(() => {
          app.applyBackground({ theme: 'midnight' });
          sounds.playClick();
        }, 1200);

        this.schedule(() => {
          app.applyBackground({ theme: 'grid' });
          sounds.playClick();
        }, 2400);

        this.schedule(() => {
          app.applyBackground({ theme: 'sky' });
          sounds.playClick();
        }, 3400);
      });
    }

    this.schedule(() => this.nextStep(), this.steps[5].duration);
  }

  // --- STEP 7: LIVE PLAYTEST WITH COMBAT, JUMPING & GOAL ---
  stepPlaytest() {
    const app = this.app;
    // Add Goal Flag at the end
    app.entities.push(new (window.GoalFlag || SolidBlock)(600, 400, 48, 80));

    // Click PLAY TEST button
    const playBtn = document.getElementById('mode-toggle-btn');
    if (playBtn) {
      const rect = playBtn.getBoundingClientRect();
      this.clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
        if (app.mode === 'edit') {
          app.toggleMode();
        }

        // Simulate arcade hero controls
        // 1. Run right
        app.player.vx = app.player.speed;
        app.player.facing = 1;

        // 2. Jump onto spring
        this.schedule(() => {
          app.player.vy = -app.player.jumpForce;
          sounds.playJump();
        }, 700);

        // 3. Collect coin & hit question block
        this.schedule(() => {
          app.player.vy = -350;
        }, 1800);

        // 4. Equip pistol & shoot blaster shot
        this.schedule(() => {
          app.ammo = 15;
          app.gunPickedUpInLevel = true;
          app.firePistol();
        }, 2800);

        // 5. Reach goal flag
        this.schedule(() => {
          app.player.x = 600;
          app.triggerVictory();
        }, 4400);
      });
    }

    this.schedule(() => this.nextStep(), this.steps[6].duration);
  }

  // --- STEP 8: VIDEO RECORDING & WRAP-UP ---
  stepRecording() {
    // Highlight REC button and .sidehop file sharing
    const recBtn = document.getElementById('rec-btn');
    if (recBtn) {
      const rect = recBtn.getBoundingClientRect();
      this.moveCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    this.schedule(() => {
      this.stop(true);
    }, this.steps[7].duration);
  }
}
