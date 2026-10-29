// Sidehop Interactive Feature & Options Pointer Tour
// Blatantly points out every feature, explains what it does, and shows all of its options non-destructively.

import { sounds } from '../audio/sound.js?v=20261028_205041';

export class SidehopDemo {
  constructor(app) {
    this.app = app;
    this.isActive = false;
    this.isPaused = false;
    this.currentStep = 0;
    this.timers = [];
    this.bannerEl = null;
    this.cursorEl = null;
    this.ringEl = null;
    this.calloutEl = null;

    this.steps = [
      {
        id: 'tools',
        badge: 'FEATURE 1 OF 10 • TOOLS',
        title: '🛠️ Workbench Cursor Tools',
        targetSelector: '#tool-drawer .palette-grid:first-of-type',
        pointerSelector: '[data-tool="select"]',
        what: 'Controls how your mouse interacts with the level canvas in Edit Mode.',
        options: [
          '<strong>👆 Select (Key 1):</strong> Click any block, enemy, or character to drag-move it or open its quick action bar.',
          '<strong>⬚ Box Select (Key 5 / Shift+Drag):</strong> Drag a selection box around multiple items to move or delete them together.',
          '<strong>🖌️ Place (Key 2):</strong> Click or drag across the grid to stamp the currently active component.',
          '<strong>✋ Pan (Key 3 / Hold Space+Drag):</strong> Grab and scroll around your level map.',
          '<strong>🧹 Eraser (Key 4):</strong> Click or drag over placed items to remove them.'
        ],
        duration: 6500,
        onEnter: () => {
          this.app.closeComponentFlyout?.();
          this.closeAllModals();
        }
      },
      {
        id: 'blocks',
        badge: 'FEATURE 2 OF 10 • TERRAIN & BLOCKS',
        title: '🧱 Blocks, Slopes & Interactive Tiles',
        targetSelector: '[data-palette="block"]',
        pointerSelector: '[data-triangle="block"]',
        what: 'Builds your level terrain. Click the ▾ corner arrow on the Block tile to pick from 4 categories of blocks and 45° slopes!',
        options: [
          '<strong>🧱 Ground & Slopes:</strong> Standard Ground plus 45° Floor Slopes (◢ ◣) and Ceiling Slopes (◤ ◥) that auto-blend seamlessly.',
          '<strong>🪨 Castle Stone:</strong> Heavy masonry blocks and matching 45° Stone Floor & Ceiling Slopes.',
          '<strong>🧊 Slippery Ice:</strong> Low-friction sliding ice blocks and 45° Ice Slopes.',
          '<strong>✨ Special Blocks:</strong> ❓ Mystery Block (spawns Coin, Heart, or Gun), ♪ Musical Note Block (plays scale + super bounce), 🍩 Donut Lift (shakes & drops), 🪵 Semi-Solid, ☁️ Cloud, 🪨 Half Slab, ❇️ Mega Block, and ♻️ Pipe.'
        ],
        duration: 7500,
        onEnter: () => {
          this.closeAllModals();
          const triBtn = document.querySelector('[data-triangle="block"]');
          if (triBtn && this.app.openComponentFlyout) {
            this.app.activeFlyoutItem = null;
            this.app.openComponentFlyout('block', triBtn);
          }
        }
      },
      {
        id: 'springs_platforms',
        badge: 'FEATURE 3 OF 10 • MOVEMENT & HAZARDS',
        title: '🚀 Springs, Moving Platforms & Spikes',
        targetSelector: '[data-palette="springboard"]',
        pointerSelector: '[data-triangle="springboard"]',
        what: 'Adds vertical launch pads, moving bridges, and spike hazards to create platforming challenges.',
        options: [
          '<strong>🚀 Standard Spring:</strong> Bounces the player upward (hold W / Up / Space while bouncing for 25% extra launch height!).',
          '<strong>💥 Mega Trampoline:</strong> Launches the player high into the sky (click ▾ on Spring to switch).',
          '<strong>↔️ Moving Platform:</strong> Glides back and forth — tune its Axis (Horizontal / Vertical), Speed, and Distance.',
          '<strong>⚠️ Hazard Spikes:</strong> Deals 1 heart of damage with knockback when touched.'
        ],
        duration: 6800,
        onEnter: () => {
          this.closeAllModals();
          const triBtn = document.querySelector('[data-triangle="springboard"]');
          if (triBtn && this.app.openComponentFlyout) {
            this.app.activeFlyoutItem = null;
            this.app.openComponentFlyout('springboard', triBtn);
          }
        }
      },
      {
        id: 'enemies',
        badge: 'FEATURE 4 OF 10 • ENEMIES',
        title: '👾 Patrolling Enemy Types',
        targetSelector: '[data-palette="enemy"]',
        pointerSelector: '[data-triangle="enemy"]',
        what: 'Places AI enemies that patrol your level. Click the ▾ corner arrow on Enemy to switch between 3 distinct enemy behaviors.',
        options: [
          '<strong>🧌 Walker:</strong> Patrols left and right along the ground — jump on its head to stomp it!',
          '<strong>🪽 Flyer (Winged Hopper):</strong> Flutters and hops through the air — stompable from above.',
          '<strong>🦔 Spiker (Armored):</strong> Covered in sharp spines — cannot be stomped! Shoot it with the Gun powerup.',
          '<strong>🎛️ Tunable AI:</strong> Select any enemy on the canvas to tune its Patrol Speed, Patrol Distance, and Stompable toggle.'
        ],
        duration: 6800,
        onEnter: () => {
          this.closeAllModals();
          const triBtn = document.querySelector('[data-triangle="enemy"]');
          if (triBtn && this.app.openComponentFlyout) {
            this.app.activeFlyoutItem = null;
            this.app.openComponentFlyout('enemy', triBtn);
          }
        }
      },
      {
        id: 'collectibles',
        badge: 'FEATURE 5 OF 10 • ITEMS & WEAPONS',
        title: '🪙 Collectibles, Health & Gun Powerup',
        targetSelector: '[data-palette="collectible"]',
        pointerSelector: '[data-triangle="collectible"]',
        what: 'Rewards exploration, heals damage, and arms the player with a blaster pistol. Click ▾ on Coin/Item to see all 5 pickups.',
        options: [
          '<strong>💰 Gold Coin (+100 PTS) & ⭐ Star Gem (+500 PTS):</strong> Score pickups floating in the air.',
          '<strong>❤️ Heart Pickup:</strong> Restores +1 depleted heart of player health.',
          '<strong>🔫 Gun Powerup:</strong> Equips the player with a blaster pistol (+15 rounds). Press <strong>F</strong> or <strong>X</strong> in Play Mode to shoot enemies!',
          '<strong>📦 Ammunition Box:</strong> Reloads +15 extra blaster rounds.'
        ],
        duration: 6800,
        onEnter: () => {
          this.closeAllModals();
          const triBtn = document.querySelector('[data-triangle="collectible"]');
          if (triBtn && this.app.openComponentFlyout) {
            this.app.activeFlyoutItem = null;
            this.app.openComponentFlyout('collectible', triBtn);
          }
        }
      },
      {
        id: 'selection_tuning',
        badge: 'FEATURE 6 OF 10 • INSPECTOR & TUNING',
        title: '🎛️ Selection Action Bar & Physics Tuning',
        targetSelector: '#entity-action-card',
        pointerSelector: '#action-tune-btn',
        what: 'Clicking any object on the canvas opens this floating Action Bar to Duplicate, Copy, Paint, Tune Physics, or Switch Variants.',
        options: [
          '<strong>📑 Duplicate (⌘D) & 📋 Copy (⌘C):</strong> Quickly clone any configured block, enemy, or platform.',
          '<strong>🎨 Paint Art:</strong> Open the Art Studio for the selected item to recolor it or draw custom art.',
          '<strong>🎛️ Tune Physics:</strong> Adjust Player Speed, Jump Force, Gravity, Max Hearts, & Double Jump — or Block Bounciness, Friction, and Mystery Block contents!',
          '<strong>🗑️ Delete (Backspace):</strong> Remove the selected component.'
        ],
        duration: 7200,
        onEnter: () => {
          this.app.closeComponentFlyout?.();
          this.closeAllModals();
          this.app.camera.recenter(this.app.player.x, this.app.player.y);
          this.app.editor.selectedEntity = this.app.player;
          this.app.updateActionCard(this.app.player);
        }
      },
      {
        id: 'character_art',
        badge: 'FEATURE 7 OF 10 • ART STUDIO',
        title: '🐰 Character & Block Art Studio',
        targetSelector: '#character-edit-btn',
        pointerSelector: '#character-edit-btn',
        what: 'Customize your hero sprite or any block with built-in drawing tools, component tint colors, or imported images/GIFs.',
        options: [
          '<strong>🖌️ Drawing Tools:</strong> Freehand Brush, Translucent Marker, Precision Eraser, and 6 Brush Sizes.',
          '<strong>⭐ Fun Stamps:</strong> Stamp Stars, Hearts, Cartoon Eyes, Lightning Bolts, Smiles, Crowns, Flames, and Skulls.',
          '<strong>🎨 Component Color Tint:</strong> Recolor the starter artwork of any block, character, or flag with one click.',
          '<strong>🖼️ Import Photo or Animated GIF:</strong> Upload any PNG, JPG, WebP, or animated GIF directly onto your character or block!'
        ],
        duration: 7000,
        onEnter: () => {
          this.app.closeComponentFlyout?.();
          this.closeAllModals();
        }
      },
      {
        id: 'themes_backgrounds',
        badge: 'FEATURE 8 OF 10 • THEMES & BACKGROUNDS',
        title: '🎨 9 World Themes & Sky Backgrounds',
        targetSelector: '#theme-selector-btn',
        pointerSelector: '#theme-selector-btn',
        what: 'Transform your entire game aesthetic — restyling the workbench UI, animated parallax sky, and block surface textures.',
        options: [
          '<strong>🌱 Light & Classic Themes:</strong> Sunny Meadows (Grass), Snowy Tundra, Cyber Chrome, 8-Bit Arcade, Lush Jungle, and Mixed Media Collage.',
          '<strong>🌙 Dark High-Contrast Themes:</strong> Starlit Night, Neon Over Black, and Atlantis Underwater.',
          '<strong>🌄 Background Button:</strong> Choose sky presets (Sunny Sky, Warm Sunset, Midnight Stars, Blueprint Grid), draw a custom backdrop, or upload an image.'
        ],
        duration: 7000,
        onEnter: () => {
          this.app.closeComponentFlyout?.();
          this.closeAllModals();
        }
      },
      {
        id: 'play_fill_rec',
        badge: 'FEATURE 9 OF 10 • PLAY, FILL & RECORD',
        title: '▶ Play Test, Fullscreen Fill & Video Recorder',
        targetSelector: '#mode-toggle-btn',
        pointerSelector: '#mode-toggle-btn',
        what: 'Instantly test your level, expand the stage to fill your screen, or record a gameplay video clip.',
        options: [
          '<strong>▶ PLAY TEST (Spacebar):</strong> Switch between Edit Mode and live Play Mode (WASD / Arrows to move & jump, F / X to shoot).',
          '<strong>⤢ FILL:</strong> Expands the canvas frame to fill your entire browser window.',
          '<strong>● REC:</strong> Records a live .webm video clip of your gameplay with synthesized audio ready to download.',
          '<strong>🔊 Sound & ↩ Undo / ↪ Redo:</strong> Toggle retro synth sound effects or step backward/forward through edits.'
        ],
        duration: 7000,
        onEnter: () => {
          this.app.closeComponentFlyout?.();
          this.closeAllModals();
        }
      },
      {
        id: 'save_export',
        badge: 'FEATURE 10 OF 10 • SAVE & SHARE',
        title: '🌐 Save .sidehop & Export Standalone HTML Game',
        targetSelector: '#export-html-btn',
        pointerSelector: '#export-html-btn',
        what: 'Your work auto-saves in your browser, and you can export portable files or a complete standalone web game anytime.',
        options: [
          '<strong>💾 .sidehop:</strong> Saves your level (including custom art & physics) as a compact .sidehop file.',
          '<strong>📂 Import (or Drag & Drop):</strong> Load any .sidehop file right back into the editor.',
          '<strong>🌐 Save HTML:</strong> Exports a single, self-contained .html game file that anyone can play offline in any browser with zero setup!',
          '<strong>🔄 Reset:</strong> Restores the default Starter World layout.'
        ],
        duration: 7000,
        onEnter: () => {
          this.app.closeComponentFlyout?.();
          this.closeAllModals();
        }
      }
    ];

    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.stop();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevStep();
      }
    });

    window.addEventListener('resize', () => {
      if (this.isActive) {
        this.positionSpotlightAndCallout(this.steps[this.currentStep]);
      }
    });
  }

  closeAllModals() {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    document.querySelectorAll('.neo-modal-overlay.active').forEach(m => m.classList.remove('active'));
    const card = document.getElementById('entity-action-card');
    if (card) card.classList.remove('active');
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
    if (this.isActive) {
      this.stop();
      return;
    }

    // Ensure we are in Edit Mode so all workbench controls are visible
    if (this.app.mode === 'play') {
      this.app.toggleMode();
    }

    this.closeAllModals();
    this.app.closeComponentFlyout?.();

    this.isActive = true;
    this.isPaused = false;
    this.app.isDemoActive = true;
    this.currentStep = 0;

    this.createUI();
    sounds.playClick();
    this.app.showToast('🎬 Feature Guide Started! Use Next/Prev or Arrow Keys.');

    this.runStep(0);
  }

  stop() {
    if (!this.isActive) return;
    this.clearTimers();

    this.app.closeComponentFlyout?.();
    this.closeAllModals();
    this.app.editor.selectedEntity = null;
    this.app.editor.selectedEntities = [];

    if (this.bannerEl) {
      this.bannerEl.remove();
      this.bannerEl = null;
    }
    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
    if (this.ringEl) {
      this.ringEl.remove();
      this.ringEl = null;
    }
    if (this.calloutEl) {
      this.calloutEl.remove();
      this.calloutEl = null;
    }

    this.isActive = false;
    this.app.isDemoActive = false;
    sounds.playClick();
    this.app.showToast('✨ Feature Guide Closed');
  }

  createUI() {
    // 1. Top floating control banner
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'demo-tour-banner';
    this.bannerEl.innerHTML = `
      <div class="demo-banner-left">
        <span class="demo-badge">🎬 FEATURE GUIDE</span>
        <span class="demo-step-counter" id="demo-step-counter">1 / ${this.steps.length}</span>
        <span class="demo-step-title" id="demo-step-title"></span>
      </div>
      <div class="demo-banner-center" id="demo-step-desc"></div>
      <div class="demo-banner-actions">
        <button id="demo-prev-btn" class="demo-btn-sm" title="Previous Feature (←)">← Prev</button>
        <button id="demo-pause-btn" class="demo-btn-sm" title="Pause / Resume Auto-Advance">⏸ Pause</button>
        <button id="demo-next-btn" class="demo-btn-sm" title="Next Feature (→)">Next →</button>
        <button id="demo-exit-btn" class="demo-btn-sm demo-exit" title="Exit Guide (Esc)">Done ✕</button>
      </div>
    `;
    this.bannerEl.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(this.bannerEl);

    document.getElementById('demo-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevStep();
    });
    document.getElementById('demo-pause-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePause();
    });
    document.getElementById('demo-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextStep();
    });
    document.getElementById('demo-exit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stop();
    });

    // 2. Spotlight highlight ring around target element
    this.ringEl = document.createElement('div');
    this.ringEl.className = 'demo-spotlight-ring';
    document.body.appendChild(this.ringEl);

    // 3. Blatant Feature Callout Card anchored near the target
    this.calloutEl = document.createElement('div');
    this.calloutEl.className = 'demo-callout-card';
    this.calloutEl.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(this.calloutEl);

    // 4. Animated Ghost Pointer
    this.cursorEl = document.createElement('div');
    this.cursorEl.className = 'demo-ghost-cursor';
    this.cursorEl.innerHTML = `
      <div class="cursor-pointer">👆</div>
      <div class="cursor-ripple"></div>
    `;
    document.body.appendChild(this.cursorEl);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseBtn = document.getElementById('demo-pause-btn');
    const cardPauseBtn = document.getElementById('demo-card-pause-btn');
    const label = this.isPaused ? '▶ Auto' : '⏸ Pause';
    if (pauseBtn) pauseBtn.textContent = label;
    if (cardPauseBtn) cardPauseBtn.textContent = label;

    if (this.isPaused) {
      this.clearTimers();
    } else {
      const step = this.steps[this.currentStep];
      if (step) {
        this.schedule(() => this.nextStep(), step.duration || 6500);
      }
    }
    sounds.playClick();
  }

  nextStep() {
    this.clearTimers();
    if (this.currentStep < this.steps.length - 1) {
      this.runStep(this.currentStep + 1);
    } else {
      this.stop();
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

    this.clearTimers();
    sounds.playClick();

    if (typeof step.onEnter === 'function') {
      step.onEnter();
    }

    // Update top banner
    const counter = document.getElementById('demo-step-counter');
    const title = document.getElementById('demo-step-title');
    const desc = document.getElementById('demo-step-desc');
    if (counter) counter.textContent = `${index + 1} / ${this.steps.length}`;
    if (title) title.textContent = step.title;
    if (desc) desc.textContent = step.what;

    // Render Callout Card contents
    this.renderCalloutCard(step, index);

    // Position Spotlight Ring, Callout Card, and Ghost Pointer after DOM updates
    requestAnimationFrame(() => {
      this.positionSpotlightAndCallout(step);
    });

    if (!this.isPaused) {
      this.schedule(() => this.nextStep(), step.duration || 6500);
    }
  }

  renderCalloutCard(step, index) {
    if (!this.calloutEl) return;

    const optionsHtml = (step.options || [])
      .map(opt => `<div class="demo-option-row"><span>•</span><div>${opt}</div></div>`)
      .join('');

    const dotsHtml = this.steps
      .map((s, i) => `<button class="demo-step-dot ${i === index ? 'active' : ''}" data-step="${i}" title="${s.title}"></button>`)
      .join('');

    const pauseLabel = this.isPaused ? '▶ Auto' : '⏸ Pause';
    const nextLabel = index === this.steps.length - 1 ? 'Finish ✓' : 'Next →';

    this.calloutEl.innerHTML = `
      <div class="demo-callout-header">
        <span class="demo-callout-badge">${step.badge}</span>
        <button id="demo-card-close-btn" class="demo-btn-sm demo-exit" style="padding: 2px 7px; font-size: 11px;">✕</button>
      </div>
      <h3 class="demo-callout-title">${step.title}</h3>
      <p class="demo-callout-what">${step.what}</p>
      <div class="demo-callout-options-label">Options &amp; Controls:</div>
      <div class="demo-callout-options-list">
        ${optionsHtml}
      </div>
      <div class="demo-callout-footer">
        <div class="demo-step-dots">
          ${dotsHtml}
        </div>
        <div class="demo-callout-nav">
          <button id="demo-card-prev-btn" class="demo-btn-sm" ${index === 0 ? 'disabled style="opacity:0.4;cursor:default;"' : ''}>←</button>
          <button id="demo-card-pause-btn" class="demo-btn-sm">${pauseLabel}</button>
          <button id="demo-card-next-btn" class="demo-btn-sm" style="background:#FFE600;">${nextLabel}</button>
        </div>
      </div>
    `;

    this.calloutEl.querySelector('#demo-card-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stop();
    });
    this.calloutEl.querySelector('#demo-card-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (index > 0) this.prevStep();
    });
    this.calloutEl.querySelector('#demo-card-pause-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePause();
    });
    this.calloutEl.querySelector('#demo-card-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextStep();
    });
    this.calloutEl.querySelectorAll('.demo-step-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = parseInt(dot.getAttribute('data-step'), 10);
        if (!isNaN(targetIdx)) {
          this.runStep(targetIdx);
        }
      });
    });
  }

  positionSpotlightAndCallout(step) {
    if (!step || !this.ringEl || !this.calloutEl) return;

    const targetEl = document.querySelector(step.targetSelector);
    const pointerEl = document.querySelector(step.pointerSelector || step.targetSelector) || targetEl;

    if (!targetEl) {
      this.ringEl.style.display = 'none';
      this.calloutEl.style.top = '110px';
      this.calloutEl.style.left = `${Math.max(16, (window.innerWidth - 400) / 2)}px`;
      return;
    }

    // Ensure header button is scrolled into view if inside horizontal header bar
    if (targetEl.closest('.header-controls')) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    const rect = targetEl.getBoundingClientRect();
    const pad = 6;

    // 1. Position Spotlight Ring around targetEl
    this.ringEl.style.display = 'block';
    this.ringEl.style.top = `${Math.max(4, rect.top - pad)}px`;
    this.ringEl.style.left = `${Math.max(4, rect.left - pad)}px`;
    this.ringEl.style.width = `${rect.width + pad * 2}px`;
    this.ringEl.style.height = `${rect.height + pad * 2}px`;

    // 2. Position Ghost Cursor pointing directly at pointerEl
    if (pointerEl && this.cursorEl) {
      const pRect = pointerEl.getBoundingClientRect();
      const cx = pRect.left + pRect.width * 0.55;
      const cy = pRect.top + pRect.height * 0.65;
      this.cursorEl.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      this.cursorEl.classList.add('clicking');
      setTimeout(() => {
        if (this.cursorEl) this.cursorEl.classList.remove('clicking');
      }, 350);
    }

    // 3. Position Callout Card smartly next to the target (avoiding any open flyout menu)
    const cardRect = this.calloutEl.getBoundingClientRect();
    const cardW = cardRect.width || 400;
    const cardH = cardRect.height || 310;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const flyout = document.getElementById('component-flyout-menu');
    const flyoutVisible = flyout && flyout.style.display !== 'none';
    const flyoutRect = flyoutVisible ? flyout.getBoundingClientRect() : null;

    let left = rect.right + 20;
    let top = rect.top;

    // If component flyout is open next to left drawer, place callout card to the right of the flyout
    if (flyoutRect && flyoutRect.width > 0) {
      left = flyoutRect.right + 18;
      top = Math.max(72, flyoutRect.top);
    }
    // If target is in top header bar, place callout card below the header bar
    else if (rect.top < 70) {
      top = rect.bottom + 16;
      left = Math.min(Math.max(16, rect.left - 40), vw - cardW - 16);
    }
    // If target is floating action card on canvas, place callout card to its right or below
    else if (step.targetSelector === '#entity-action-card') {
      if (rect.right + cardW + 24 < vw) {
        left = rect.right + 18;
        top = Math.max(72, rect.top - 10);
      } else {
        left = Math.max(16, rect.left - cardW - 18);
        top = Math.max(72, rect.top - 10);
      }
    }

    // Clamp inside viewport bounds (below bottom banner / header)
    if (left + cardW > vw - 16) {
      left = Math.max(16, vw - cardW - 16);
    }
    if (top + cardH > vh - 76) {
      top = Math.max(68, vh - cardH - 76);
    }
    if (top < 68) {
      top = 68;
    }

    this.calloutEl.style.left = `${Math.round(left)}px`;
    this.calloutEl.style.top = `${Math.round(top)}px`;
  }
}
