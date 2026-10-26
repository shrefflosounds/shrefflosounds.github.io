/**
 * Standalone Offline Single-File HTML Game Generator for Sidehop.
 * Generates a completely self-contained .html file containing the user's level,
 * custom drawn / imported assets, sound synthesizer, physics, and gameplay engine.
 * Requires ZERO internet connection, ZERO external CSS/JS, and NO editor UI.
 */

export function generateStandaloneGameHtml(levelData, customTitle) {
  const title = customTitle || levelData.name || 'Sidehop Game';
  const cleanTitle = title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const serializedJson = JSON.stringify(levelData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${cleanTitle} — Sidehop</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }

    body, html {
      width: 100%;
      height: 100%;
      background: #090D16;
      color: #121212;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    #game-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      max-width: 1280px;
      max-height: 720px;
      display: flex;
      flex-direction: column;
      background: #121212;
      border: 3px solid #121212;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    }

    /* Top Arcade Game HUD */
    #game-header {
      height: 48px;
      background: #FFE600;
      border-bottom: 3px solid #121212;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      font-weight: 800;
      z-index: 10;
      flex-shrink: 0;
    }

    .hud-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .hud-title {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #121212;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hud-stat-pill {
      background: #FFFFFF;
      border: 2px solid #121212;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 2px 2px 0 #121212;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .hud-hearts {
      display: flex;
      gap: 3px;
      font-size: 14px;
    }

    .hud-btn {
      background: #FFFFFF;
      border: 2px solid #121212;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 2px 2px 0 #121212;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .hud-btn:hover {
      background: #F4F4F5;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #121212;
    }

    .hud-btn:active {
      transform: translate(1px, 1px);
      box-shadow: 1px 1px 0 #121212;
    }

    .hud-btn-primary {
      background: #00E5FF;
    }
    .hud-btn-primary:hover {
      background: #33EBFF;
    }

    /* Canvas Stage Container */
    #canvas-container {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #game-canvas {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: pixelated;
    }

    /* Overlays (Victory & Game Over) */
    .game-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 20px;
    }

    .game-overlay.active {
      display: flex;
    }

    .overlay-card {
      background: #FFFFFF;
      border: 4px solid #121212;
      border-radius: 14px;
      padding: 28px 36px;
      text-align: center;
      box-shadow: 8px 8px 0 #121212;
      max-width: 420px;
      width: 90%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      animation: popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
      0% { transform: scale(0.85); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .overlay-title {
      font-size: 28px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }

    .victory-title {
      color: #059669;
    }

    .gameover-title {
      color: #DC2626;
    }

    .overlay-stats {
      font-size: 16px;
      font-weight: 700;
      color: #4B5563;
    }

    .overlay-action-btn {
      background: #FFE600;
      border: 3px solid #121212;
      border-radius: 8px;
      padding: 12px 26px;
      font-size: 16px;
      font-weight: 900;
      color: #121212;
      cursor: pointer;
      box-shadow: 4px 4px 0 #121212;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .overlay-action-btn:hover {
      background: #FFED4A;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #121212;
    }

    .overlay-action-btn:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0 #121212;
    }

    /* Mobile / Touch On-Screen Controls */
    #touch-controls {
      display: none;
      position: absolute;
      bottom: 16px;
      left: 0;
      right: 0;
      padding: 0 20px;
      justify-content: space-between;
      align-items: flex-end;
      z-index: 25;
      pointer-events: none;
    }

    @media (hover: none) and (pointer: coarse) {
      #touch-controls {
        display: flex;
      }
    }

    .touch-btn-group {
      display: flex;
      gap: 12px;
      pointer-events: auto;
    }

    .touch-btn {
      width: 58px;
      height: 58px;
      background: rgba(255, 255, 255, 0.85);
      border: 3px solid #121212;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 900;
      box-shadow: 3px 3px 0 #121212;
      touch-action: manipulation;
      user-select: none;
    }

    .touch-btn:active {
      background: #FFE600;
      transform: scale(0.92);
      box-shadow: 1px 1px 0 #121212;
    }

    .touch-btn-action {
      background: #00E5FF;
      width: 64px;
      height: 64px;
    }

    /* Fullscreen mode */
    :fullscreen #game-wrapper, :-webkit-full-screen #game-wrapper {
      max-width: 100vw;
      max-height: 100vh;
      border: none;
      box-shadow: none;
    }
  </style>
</head>
<body>

  <div id="game-wrapper">
    <!-- Top HUD Bar -->
    <header id="game-header">
      <div class="hud-section">
        <span class="hud-title">🎮 ${cleanTitle}</span>
        <div class="hud-stat-pill" title="Health">
          <div id="hud-hearts-container" class="hud-hearts">❤️❤️❤️❤️</div>
        </div>
        <div class="hud-stat-pill" title="Score">
          ⭐ <span id="hud-score-val">0</span>
        </div>
        <div id="hud-coin-pill" class="hud-stat-pill" style="display: none;" title="Coins">
          🪙 <span id="hud-coin-val">0</span>
        </div>
      </div>

      <div class="hud-section">
        <button id="restart-btn" class="hud-btn" title="Restart Level (R)">
          🔄 <span>Restart</span>
        </button>
        <button id="sound-btn" class="hud-btn" title="Toggle Sound (M)">
          🔊
        </button>
        <button id="fullscreen-btn" class="hud-btn hud-btn-primary" title="Fullscreen (F)">
          ⤢
        </button>
      </div>
    </header>

    <!-- Canvas Stage -->
    <div id="canvas-container">
      <canvas id="game-canvas" width="960" height="540"></canvas>

      <!-- Victory Celebration Overlay -->
      <div id="victory-overlay" class="game-overlay">
        <div class="overlay-card">
          <h2 class="overlay-title victory-title">🎉 LEVEL CLEAR!</h2>
          <p id="victory-score-text" class="overlay-stats">Score: 0 PTS</p>
          <button id="victory-replay-btn" class="overlay-action-btn">
            ▶ Play Again [Space]
          </button>
        </div>
      </div>

      <!-- Game Over Overlay -->
      <div id="gameover-overlay" class="game-overlay">
        <div class="overlay-card">
          <h2 class="overlay-title gameover-title">💀 GAME OVER</h2>
          <p class="overlay-stats">Don't give up! Try again.</p>
          <button id="gameover-retry-btn" class="overlay-action-btn">
            🔄 Try Again [Space]
          </button>
        </div>
      </div>

      <!-- Touch D-Pad & Action Buttons (Mobile / Tablet) -->
      <div id="touch-controls">
        <div class="touch-btn-group">
          <button id="touch-left" class="touch-btn">◀</button>
          <button id="touch-right" class="touch-btn">▶</button>
        </div>
        <div class="touch-btn-group">
          <button id="touch-shoot" class="touch-btn" style="display: none;">🔫</button>
          <button id="touch-jump" class="touch-btn touch-btn-action">⬆️</button>
        </div>
      </div>
    </div>
  </div>

  <script id="embedded-level-data" type="application/json">
${serializedJson}
  </script>

  <script>
  "use strict";

  // --- Procedural Sound Synthesis Engine (Zero Audio Files Needed) ---
  class StandaloneSoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.masterGain = null;
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.4;
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
      }
    }

    ensureContext() {
      try {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return !!(this.ctx && this.masterGain);
      } catch (e) {
        return false;
      }
    }

    setMuted(muted) {
      this.muted = muted;
      try {
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.setValueAtTime(muted ? 0 : 0.4, this.ctx.currentTime);
        }
      } catch (e) {}
    }

    playJump() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.16);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    playSpring() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(780, t + 0.28);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.28);
    }

    playLand() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }

    playCoin() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, t); // B5
      osc1.frequency.setValueAtTime(1318.51, t + 0.08); // E6
      gain1.gain.setValueAtTime(0.3, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.35);
    }

    playStomp() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }

    playHurt() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.linearRampToValueAtTime(80, t + 0.22);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.22);
    }

    playShoot() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.14);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
    }

    playVictory() {
      if (!this.ensureContext()) return;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      const t = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);
        gain.gain.setValueAtTime(0.35, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.4);
      });
    }

    playClick() {
      if (!this.ensureContext()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.03);
    }
  }

  const sounds = new StandaloneSoundEngine();

  // --- Camera Engine ---
  class StandaloneCamera {
    constructor(canvasWidth, canvasHeight) {
      this.x = 0;
      this.y = 0;
      this.width = canvasWidth;
      this.height = canvasHeight;
      this.target = null;
      this.zoom = 1.0;
    }

    setTarget(entity) {
      this.target = entity;
    }

    update(dt) {
      if (!this.target) return;
      const targetCenterX = this.target.x + this.target.width / 2;
      const targetCenterY = this.target.y + this.target.height / 2;
      const lookAhead = (this.target.facing === 'left' ? -40 : 40);
      const desiredX = targetCenterX - (this.width / 2) + lookAhead;
      const desiredY = targetCenterY - (this.height / 2) - 20;

      const lerpSpeed = Math.min(1.0, 7.5 * dt);
      this.x += (desiredX - this.x) * lerpSpeed;
      this.y += (desiredY - this.y) * lerpSpeed;
      if (this.y > 600) this.y = 600;
    }
  }

  // --- Physics Collision Engine ---
  class StandalonePhysics {
    constructor() {
      this.gravity = 1480;
    }

    checkOverlap(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      );
    }

    updateEntity(entity, solids, dt) {
      const gScale = entity.gravityScale !== undefined ? entity.gravityScale : 1.0;
      entity.vy += this.gravity * gScale * dt;
      if (entity.vy > 950) entity.vy = 950;

      entity.x += entity.vx * dt;
      for (const s of solids) {
        if (!s.active && s.active !== undefined) continue;
        if (s.variant === 'cloud') continue; // One-way clouds don't block horizontal
        if (s.variant === 'slope') continue;
        if (this.checkOverlap(entity, s)) {
          if (entity.vx > 0) {
            entity.x = s.x - entity.width;
            entity.vx = 0;
          } else if (entity.vx < 0) {
            entity.x = s.x + s.width;
            entity.vx = 0;
          }
        }
      }

      entity.y += entity.vy * dt;
      entity.grounded = false;

      for (const s of solids) {
        if (!s.active && s.active !== undefined) continue;
        if (s.variant === 'slope') {
          this.handleSlope(entity, s);
          continue;
        }

        if (s.variant === 'cloud') {
          // Semi-solid one-way platform
          const prevY = entity.y - entity.vy * dt;
          if (entity.vy >= 0 && prevY + entity.height <= s.y + 12 && this.checkOverlap(entity, s)) {
            entity.y = s.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = s;
          }
          continue;
        }

        if (this.checkOverlap(entity, s)) {
          if (entity.vy > 0) {
            entity.y = s.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = s;
          } else if (entity.vy < 0) {
            entity.y = s.y + s.height;
            entity.vy = 0;
            if (s.bump) s.bump(entity);
          }
        }
      }
    }

    handleSlope(entity, slope) {
      if (entity.x + entity.width <= slope.x || entity.x >= slope.x + slope.width) return;
      const relX = Math.max(0, Math.min(slope.width, (entity.x + entity.width / 2) - slope.x));
      const t = relX / slope.width;

      let surfaceY = slope.y + slope.height;
      if (slope.orientation === 'up-right' || !slope.orientation) {
        surfaceY = slope.y + slope.height - (t * slope.height);
      } else if (slope.orientation === 'up-left') {
        surfaceY = slope.y + (t * slope.height);
      } else if (slope.orientation === 'ceiling-right') {
        surfaceY = slope.y + (t * slope.height);
      } else if (slope.orientation === 'ceiling-left') {
        surfaceY = slope.y + slope.height - (t * slope.height);
      }

      const entityBottom = entity.y + entity.height;
      if (entityBottom >= surfaceY - 8 && entity.y <= slope.y + slope.height) {
        entity.y = surfaceY - entity.height;
        if (entity.vy > 0) entity.vy = 0;
        entity.grounded = true;
        entity.standingOnSolid = slope;
      }
    }
  }

  // --- Game Entity Models ---
  class Player {
    constructor(x, y) {
      this.x = x || 100;
      this.y = y || 300;
      this.spawnX = this.x;
      this.spawnY = this.y;
      this.width = 32;
      this.height = 36;
      this.type = 'player';
      this.vx = 0;
      this.vy = 0;
      this.speed = 280;
      this.jumpForce = 580;
      this.gravityScale = 1.0;
      this.grounded = false;
      this.facing = 'right';
      this.hasGun = false;
      this.shootCooldown = 0;
      this.maxHearts = 4;
      this.hearts = 4;
      this.invulnerableTimer = 0;
      this.customVisual = null;
      this.customImageElement = null;
    }

    setCustomVisual(dataUrl) {
      this.customVisual = dataUrl;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { this.customImageElement = img; };
      } else {
        this.customImageElement = null;
      }
    }

    respawn() {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.hearts = this.maxHearts;
      this.invulnerableTimer = 0;
      this.hasGun = false;
    }

    takeDamage(amount = 1) {
      if (this.invulnerableTimer > 0) return false;
      this.hearts -= amount;
      this.invulnerableTimer = 1.2;
      this.vy = -340;
      return true;
    }

    handleInput(keys, dt) {
      let moveDir = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) moveDir -= 1;
      if (keys['ArrowRight'] || keys['KeyD']) moveDir += 1;

      if (moveDir !== 0) {
        this.vx = moveDir * this.speed;
        this.facing = moveDir > 0 ? 'right' : 'left';
      } else {
        this.vx *= Math.pow(0.001, dt);
        if (Math.abs(this.vx) < 5) this.vx = 0;
      }

      if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && this.grounded) {
        this.vy = -this.jumpForce;
        this.grounded = false;
        sounds.playJump();
      }

      if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;

      if ((keys['KeyX'] || keys['KeyF'] || keys['KeyE']) && this.hasGun && this.shootCooldown <= 0) {
        this.shootCooldown = 0.28;
        const bVx = this.facing === 'left' ? -620 : 620;
        const bX = this.facing === 'left' ? this.x - 10 : this.x + this.width + 2;
        return new Bullet(bX, this.y + 12, bVx);
      }
      return null;
    }

    render(ctx) {
      ctx.save();
      if (this.invulnerableTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      if (this.customImageElement && this.customImageElement.complete) {
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        if (this.facing === 'left') ctx.scale(-1, 1);
        ctx.drawImage(this.customImageElement, -this.width / 2, -this.height / 2, this.width, this.height);
      } else {
        // Built-in Rabbit Hero Sprite
        ctx.translate(this.x, this.y);
        if (this.facing === 'left') {
          ctx.translate(this.width, 0);
          ctx.scale(-1, 1);
        }

        // Body
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;

        // Ears
        ctx.beginPath();
        ctx.ellipse(10, 4, 4, 10, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(22, 3, 4, 11, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Ear pink inners
        ctx.fillStyle = '#FDA4AF';
        ctx.beginPath();
        ctx.ellipse(10, 5, 2, 7, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(22, 4, 2, 8, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Torso & head
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(4, 10, 24, 24, 8);
        ctx.fill();
        ctx.stroke();

        // Eye & cheek
        ctx.fillStyle = '#121212';
        ctx.fillRect(19, 16, 4, 5);
        ctx.fillStyle = '#FDA4AF';
        ctx.beginPath();
        ctx.arc(17, 24, 3, 0, Math.PI * 2);
        ctx.fill();

        // Gun equipped visual
        if (this.hasGun) {
          ctx.fillStyle = '#00E5FF';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 2;
          ctx.fillRect(22, 20, 10, 5);
          ctx.strokeRect(22, 20, 10, 5);
        }
      }
      ctx.restore();
    }
  }

  class SolidBlock {
    constructor(x, y, w, h, variant = 'solid', content = null) {
      this.x = x;
      this.y = y;
      this.width = w || 40;
      this.height = h || 40;
      this.type = 'block';
      this.variant = variant;
      this.material = 'turf';
      this.content = content;
      this.isUsed = false;
      this.orientation = 'up-right';
      this.customVisual = null;
      this.customImageElement = null;
    }

    setCustomVisual(dataUrl) {
      this.customVisual = dataUrl;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { this.customImageElement = img; };
      }
    }

    bump(player) {
      if (this.variant === 'mystery' && !this.isUsed) {
        this.isUsed = true;
        sounds.playCoin();
        if (this.content === 'gun') player.hasGun = true;
      }
    }

    render(ctx, theme) {
      ctx.save();
      if (this.customImageElement && this.customImageElement.complete) {
        ctx.drawImage(this.customImageElement, this.x, this.y, this.width, this.height);
        ctx.restore();
        return;
      }

      if (this.variant === 'slope') {
        ctx.beginPath();
        if (this.orientation === 'up-right') {
          ctx.moveTo(this.x, this.y + this.height);
          ctx.lineTo(this.x + this.width, this.y);
          ctx.lineTo(this.x + this.width, this.y + this.height);
        } else if (this.orientation === 'up-left') {
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + this.width, this.y + this.height);
          ctx.lineTo(this.x, this.y + this.height);
        }
        ctx.closePath();
        ctx.fillStyle = '#65A30D';
        ctx.fill();
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (this.variant === 'mystery') {
        ctx.fillStyle = this.isUsed ? '#94A3B8' : '#F59E0B';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#121212';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.isUsed ? '—' : '?', this.x + this.width / 2, this.y + this.height / 2);
        ctx.restore();
        return;
      }

      if (this.variant === 'cloud') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 12);
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Standard Theme Turf / Rock
      let topColor = '#22C55E';
      let dirtColor = '#78350F';
      if (theme === 'snowy') { topColor = '#E0F2FE'; dirtColor = '#334155'; }
      else if (theme === 'night') { topColor = '#4338CA'; dirtColor = '#1E1B4B'; }
      else if (theme === 'chrome') { topColor = '#E2E8F0'; dirtColor = '#475569'; }
      else if (theme === '8-bit') { topColor = '#00D800'; dirtColor = '#D82800'; }
      else if (theme === 'neon') { topColor = '#00E5FF'; dirtColor = '#121212'; }
      else if (theme === 'atlantis') { topColor = '#0284C7'; dirtColor = '#0F172A'; }
      else if (theme === 'jungle') { topColor = '#15803D'; dirtColor = '#2D1B00'; }

      ctx.fillStyle = dirtColor;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = topColor;
      ctx.fillRect(this.x, this.y, this.width, 10);
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      ctx.restore();
    }
  }

  class Hazard {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.width = w || 40;
      this.height = h || 40;
      this.type = 'hazard';
      this.customVisual = null;
      this.customImageElement = null;
    }

    setCustomVisual(dataUrl) {
      this.customVisual = dataUrl;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { this.customImageElement = img; };
      }
    }

    render(ctx) {
      ctx.save();
      if (this.customImageElement && this.customImageElement.complete) {
        ctx.drawImage(this.customImageElement, this.x, this.y, this.width, this.height);
        ctx.restore();
        return;
      }
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2.5;
      const count = Math.max(1, Math.floor(this.width / 14));
      const segW = this.width / count;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + this.height);
      for (let i = 0; i < count; i++) {
        ctx.lineTo(this.x + i * segW + segW / 2, this.y);
        ctx.lineTo(this.x + (i + 1) * segW, this.y + this.height);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  class Enemy {
    constructor(x, y, variant = 'walker') {
      this.x = x;
      this.y = y;
      this.width = 34;
      this.height = 34;
      this.type = 'enemy';
      this.variant = variant;
      this.vx = -65;
      this.vy = 0;
      this.active = true;
      this.isSquashed = false;
      this.stompable = variant !== 'spiky';
      this.customVisual = null;
      this.customImageElement = null;
    }

    setCustomVisual(dataUrl) {
      this.customVisual = dataUrl;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { this.customImageElement = img; };
      }
    }

    update(dt, solids) {
      if (!this.active || this.isSquashed) return;
      this.vy += 1200 * dt;
      this.x += this.vx * dt;

      for (const s of solids) {
        if (s.variant === 'slope') continue;
        if (this.x < s.x + s.width && this.x + this.width > s.x && this.y < s.y + s.height && this.y + this.height > s.y) {
          if (this.vx > 0) {
            this.x = s.x - this.width;
            this.vx = -Math.abs(this.vx);
          } else {
            this.x = s.x + s.width;
            this.vx = Math.abs(this.vx);
          }
        }
      }

      this.y += this.vy * dt;
      for (const s of solids) {
        if (this.x < s.x + s.width && this.x + this.width > s.x && this.y < s.y + s.height && this.y + this.height > s.y) {
          if (this.vy > 0) {
            this.y = s.y - this.height;
            this.vy = 0;
          }
        }
      }
    }

    stomp() {
      this.isSquashed = true;
      this.active = false;
      sounds.playStomp();
    }

    render(ctx) {
      if (!this.active) return;
      ctx.save();
      if (this.customImageElement && this.customImageElement.complete) {
        ctx.drawImage(this.customImageElement, this.x, this.y, this.width, this.height);
        ctx.restore();
        return;
      }

      // Default Monster Sprite
      ctx.fillStyle = this.variant === 'spiky' ? '#7C3AED' : '#DC2626';
      ctx.beginPath();
      ctx.roundRect(this.x, this.y, this.width, this.height, 8);
      ctx.fill();
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(this.x + 6, this.y + 8, 6, 8);
      ctx.fillRect(this.x + 22, this.y + 8, 6, 8);
      ctx.fillStyle = '#121212';
      ctx.fillRect(this.x + (this.vx > 0 ? 8 : 6), this.y + 11, 4, 5);
      ctx.fillRect(this.x + (this.vx > 0 ? 24 : 22), this.y + 11, 4, 5);

      if (this.variant === 'spiky') {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y);
        ctx.lineTo(this.x + 17, this.y - 10);
        ctx.lineTo(this.x + 24, this.y);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class Springboard {
    constructor(x, y, variant = 'spring') {
      this.x = x;
      this.y = y;
      this.width = 40;
      this.height = 36;
      this.type = 'springboard';
      this.variant = variant;
      this.launchForce = variant === 'mega' ? 950 : 750;
      this.compressTimer = 0;
      this.customVisual = null;
      this.customImageElement = null;
    }

    setCustomVisual(dataUrl) {
      this.customVisual = dataUrl;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { this.customImageElement = img; };
      }
    }

    trigger() {
      this.compressTimer = 0.22;
      sounds.playSpring();
    }

    update(dt) {
      if (this.compressTimer > 0) this.compressTimer -= dt;
    }

    render(ctx) {
      ctx.save();
      const compress = this.compressTimer > 0 ? 10 : 0;
      ctx.fillStyle = this.variant === 'mega' ? '#EC4899' : '#00E5FF';
      ctx.beginPath();
      ctx.roundRect(this.x + 4, this.y + compress + 8, this.width - 8, this.height - compress - 8, 4);
      ctx.fill();
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Top pad
      ctx.fillStyle = '#FFE600';
      ctx.fillRect(this.x, this.y + compress, this.width, 8);
      ctx.strokeRect(this.x, this.y + compress, this.width, 8);
      ctx.restore();
    }
  }

  class Collectible {
    constructor(x, y, variant = 'coin') {
      this.x = x;
      this.y = y;
      this.width = 30;
      this.height = 30;
      this.type = 'collectible';
      this.variant = variant;
      this.collected = false;
      this.customVisual = null;
      this.customImageElement = null;
    }

    setCustomVisual(dataUrl) {
      this.customVisual = dataUrl;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { this.customImageElement = img; };
      }
    }

    collect(player) {
      if (this.collected) return;
      this.collected = true;
      sounds.playCoin();
      if (this.variant === 'heart') {
        player.hearts = Math.min(player.maxHearts, player.hearts + 1);
      } else if (this.variant === 'gun') {
        player.hasGun = true;
      }
    }

    render(ctx) {
      if (this.collected) return;
      ctx.save();
      const bob = Math.sin(performance.now() * 0.005) * 4;
      const cy = this.y + bob;

      if (this.variant === 'star') {
        ctx.fillStyle = '#FFE600';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(this.x + 15 + Math.cos((18 + i * 72) * Math.PI / 180) * 14, cy + 15 - Math.sin((18 + i * 72) * Math.PI / 180) * 14);
          ctx.lineTo(this.x + 15 + Math.cos((54 + i * 72) * Math.PI / 180) * 7, cy + 15 - Math.sin((54 + i * 72) * Math.PI / 180) * 7);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.variant === 'heart') {
        ctx.fillStyle = '#EF4444';
        ctx.font = '22px sans-serif';
        ctx.fillText('❤️', this.x, cy + 22);
      } else if (this.variant === 'gun') {
        ctx.fillStyle = '#00E5FF';
        ctx.font = '22px sans-serif';
        ctx.fillText('🔫', this.x, cy + 22);
      } else {
        // Coin
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x + 15, cy + 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(this.x + 15, cy + 15, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class Goal {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 36;
      this.height = 140;
      this.type = 'goal';
    }

    render(ctx) {
      ctx.save();
      // Pole
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2.5;
      ctx.fillRect(this.x + 6, this.y, 8, this.height);
      ctx.strokeRect(this.x + 6, this.y, 8, this.height);

      // Flag
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(this.x + 14, this.y + 6);
      ctx.lineTo(this.x + 44, this.y + 22);
      ctx.lineTo(this.x + 14, this.y + 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Finial
      ctx.fillStyle = '#FFE600';
      ctx.beginPath();
      ctx.arc(this.x + 10, this.y + 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  class Bullet {
    constructor(x, y, vx) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.width = 10;
      this.height = 10;
      this.active = true;
      this.life = 1.6;
    }

    update(dt, solids) {
      this.x += this.vx * dt;
      this.life -= dt;
      if (this.life <= 0) this.active = false;
      for (const s of solids) {
        if (s.variant === 'slope') continue;
        if (this.x < s.x + s.width && this.x + this.width > s.x && this.y < s.y + s.height && this.y + this.height > s.y) {
          this.active = false;
          break;
        }
      }
    }

    render(ctx) {
      ctx.save();
      ctx.fillStyle = '#00E5FF';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + 5, this.y + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- Main Standalone Game Controller ---
  class StandaloneGame {
    constructor(levelData) {
      this.data = levelData;
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.camera = new StandaloneCamera(this.canvas.width, this.canvas.height);
      this.physics = new StandalonePhysics();

      this.theme = levelData.theme || 'grass';
      this.background = levelData.background || { theme: this.theme };
      this.customBgImage = null;
      if (this.background.customImage) {
        const bgImg = new Image();
        bgImg.src = this.background.customImage;
        bgImg.onload = () => { this.customBgImage = bgImg; };
      }

      this.score = 0;
      this.coins = 0;
      this.isLevelWon = false;
      this.isGameOver = false;

      this.keys = {};
      this.confetti = [];
      this.bullets = [];

      // Particle caches
      this.snowflakes = Array.from({ length: 48 }, () => ({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        radius: Math.random() * 2.2 + 1.0,
        speed: Math.random() * 0.8 + 0.6,
        drift: Math.random() * 0.6 - 0.3
      }));

      this.bubbles = Array.from({ length: 45 }, () => ({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        radius: Math.random() * 3.5 + 1.8,
        speed: Math.random() * 0.9 + 0.7,
        wobbleSpeed: Math.random() * 0.003 + 0.002,
        wobbleAmp: Math.random() * 16 + 8,
        baseX: Math.random() * 2000
      }));

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

      this.initEntities();
      this.bindInputs();
      this.updateHud();

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.gameLoop(t));
    }

    initEntities() {
      const pData = this.data.player || {};
      this.player = new Player(pData.spawnX || 100, pData.spawnY || 300);
      if (pData.speed) this.player.speed = pData.speed;
      if (pData.jumpForce) this.player.jumpForce = pData.jumpForce;
      if (pData.maxHearts) this.player.maxHearts = pData.maxHearts;
      this.player.hearts = this.player.maxHearts;
      if (pData.customVisual) this.player.setCustomVisual(pData.customVisual);

      this.camera.setTarget(this.player);

      this.entities = [];
      const rawEntities = this.data.entities || [];
      for (const d of rawEntities) {
        if (!d) continue;
        let ent = null;
        if (d.type === 'block' || d.type === 'crate') {
          ent = new SolidBlock(d.x, d.y, d.width, d.height, d.variant || 'solid', d.content);
          if (d.orientation) ent.orientation = d.orientation;
        } else if (d.type === 'hazard') {
          ent = new Hazard(d.x, d.y, d.width, d.height);
        } else if (d.type === 'enemy') {
          ent = new Enemy(d.x, d.y, d.variant || 'walker');
        } else if (d.type === 'springboard') {
          ent = new Springboard(d.x, d.y, d.variant || 'spring');
        } else if (d.type === 'collectible') {
          ent = new Collectible(d.x, d.y, d.variant || 'coin');
        } else if (d.type === 'goal') {
          ent = new Goal(d.x, d.y);
        }
        if (ent) {
          if (d.customVisual) ent.setCustomVisual(d.customVisual);
          this.entities.push(ent);
        }
      }
    }

    restart() {
      this.isLevelWon = false;
      this.isGameOver = false;
      document.getElementById('victory-overlay').classList.remove('active');
      document.getElementById('gameover-overlay').classList.remove('active');
      this.score = 0;
      this.coins = 0;
      this.bullets = [];
      this.confetti = [];
      this.initEntities();
      this.updateHud();
      sounds.playClick();
    }

    bindInputs() {
      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        sounds.ensureContext();
        if (e.code === 'KeyR') {
          this.restart();
        } else if (e.code === 'KeyM') {
          sounds.setMuted(!sounds.muted);
          document.getElementById('sound-btn').textContent = sounds.muted ? '🔇' : '🔊';
        } else if (e.code === 'KeyF') {
          this.toggleFullscreen();
        } else if (e.code === 'Space' && (this.isLevelWon || this.isGameOver)) {
          this.restart();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      // HUD Button Events
      document.getElementById('restart-btn').addEventListener('click', () => this.restart());
      document.getElementById('sound-btn').addEventListener('click', () => {
        sounds.setMuted(!sounds.muted);
        document.getElementById('sound-btn').textContent = sounds.muted ? '🔇' : '🔊';
      });
      document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
      document.getElementById('victory-replay-btn').addEventListener('click', () => this.restart());
      document.getElementById('gameover-retry-btn').addEventListener('click', () => this.restart());

      // Touch Buttons Events
      const bindTouch = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const press = (ev) => {
          ev.preventDefault();
          this.keys[keyName] = true;
          sounds.ensureContext();
        };
        const release = (ev) => {
          ev.preventDefault();
          this.keys[keyName] = false;
        };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
      };

      bindTouch('touch-left', 'ArrowLeft');
      bindTouch('touch-right', 'ArrowRight');
      bindTouch('touch-jump', 'Space');
      bindTouch('touch-shoot', 'KeyX');
    }

    toggleFullscreen() {
      const elem = document.getElementById('game-wrapper');
      if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }

    updateHud() {
      const heartsContainer = document.getElementById('hud-hearts-container');
      if (heartsContainer) {
        let str = '';
        for (let i = 0; i < this.player.maxHearts; i++) {
          str += i < this.player.hearts ? '❤️' : '🖤';
        }
        heartsContainer.textContent = str;
      }
      const scoreVal = document.getElementById('hud-score-val');
      if (scoreVal) scoreVal.textContent = this.score;

      const touchShoot = document.getElementById('touch-shoot');
      if (touchShoot) {
        touchShoot.style.display = this.player.hasGun ? 'flex' : 'none';
      }
    }

    update(dt) {
      if (this.isLevelWon || this.isGameOver) return;

      const bullet = this.player.handleInput(this.keys, dt);
      if (bullet) {
        this.bullets.push(bullet);
        sounds.playShoot();
      }

      const solids = this.entities.filter(e => e.type === 'block' || e.type === 'springboard');
      this.physics.updateEntity(this.player, solids, dt);

      // Check Fall into Abyss
      if (this.player.y > 900) {
        this.isGameOver = true;
        sounds.playHurt();
        document.getElementById('gameover-overlay').classList.add('active');
        return;
      }

      // Bullets vs Enemies
      for (const b of this.bullets) {
        b.update(dt, solids);
        if (!b.active) continue;
        for (const ent of this.entities) {
          if (ent.type === 'enemy' && ent.active && !ent.isSquashed && this.physics.checkOverlap(b, ent)) {
            b.active = false;
            ent.stomp();
            this.score += 150;
            break;
          }
        }
      }
      this.bullets = this.bullets.filter(b => b.active);

      // Entity Updates & Player Overlaps
      for (const ent of this.entities) {
        if (!ent.active && ent.active !== undefined) continue;

        if (ent.type === 'enemy') {
          ent.update(dt, solids);
          if (ent.active && !ent.isSquashed && this.physics.checkOverlap(this.player, ent)) {
            const isFalling = this.player.vy > 0;
            const isAbove = this.player.y + this.player.height - 10 <= ent.y + ent.height * 0.7;
            if (ent.stompable && isFalling && isAbove) {
              ent.stomp();
              this.player.vy = -420;
              this.score += 100;
            } else {
              if (this.player.takeDamage(1)) {
                sounds.playHurt();
                if (this.player.hearts <= 0) {
                  this.isGameOver = true;
                  document.getElementById('gameover-overlay').classList.add('active');
                }
              }
            }
          }
        } else if (ent.type === 'hazard') {
          if (this.physics.checkOverlap(this.player, ent)) {
            if (this.player.takeDamage(1)) {
              sounds.playHurt();
              if (this.player.hearts <= 0) {
                this.isGameOver = true;
                document.getElementById('gameover-overlay').classList.add('active');
              }
            }
          }
        } else if (ent.type === 'springboard') {
          ent.update(dt);
          const isOverlapping = this.physics.checkOverlap(this.player, ent);
          if (isOverlapping && this.player.y < ent.y + 10 && this.player.vy >= 0) {
            const jumpBonus = (this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) ? 1.25 : 1.0;
            this.player.vy = -ent.launchForce * jumpBonus;
            this.player.grounded = false;
            ent.trigger();
          }
        } else if (ent.type === 'collectible') {
          if (!ent.collected && this.physics.checkOverlap(this.player, ent)) {
            ent.collect(this.player);
            this.score += (ent.variant === 'star' ? 250 : 50);
          }
        } else if (ent.type === 'goal') {
          if (this.physics.checkOverlap(this.player, ent)) {
            this.triggerVictory();
          }
        }
      }

      this.camera.update(dt);
      this.updateHud();

      // Confetti physics
      if (this.confetti.length > 0) {
        for (let i = this.confetti.length - 1; i >= 0; i--) {
          const p = this.confetti[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2;
          p.life -= dt;
          if (p.life <= 0) this.confetti.splice(i, 1);
        }
      }
    }

    triggerVictory() {
      this.isLevelWon = true;
      sounds.playVictory();
      document.getElementById('victory-score-text').textContent = \`Final Score: \${this.score} PTS\`;
      document.getElementById('victory-overlay').classList.add('active');

      const colors = ['#00E5FF', '#FFE600', '#FF3388', '#00E676', '#B388FF'];
      for (let i = 0; i < 90; i++) {
        this.confetti.push({
          x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
          y: this.canvas.height / 2,
          vx: (Math.random() - 0.5) * 16,
          vy: -Math.random() * 12 - 4,
          size: Math.random() * 8 + 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 3.0
        });
      }
    }

    // --- Background Themes Rendering ---
    renderBackground(w, h) {
      if (this.customBgImage && this.customBgImage.complete) {
        this.ctx.drawImage(this.customBgImage, 0, 0, w, h);
        return;
      }

      const time = performance.now() * 0.001;

      switch (this.theme) {
        case 'atlantis': {
          const oceanGrad = this.ctx.createLinearGradient(0, 0, 0, h);
          oceanGrad.addColorStop(0, '#02182B');
          oceanGrad.addColorStop(0.5, '#052F4E');
          oceanGrad.addColorStop(1, '#021424');
          this.ctx.fillStyle = oceanGrad;
          this.ctx.fillRect(0, 0, w, h);

          // Caustic sunbeams
          for (let i = 0; i < 4; i++) {
            const bx = (w * 0.2) + i * (w * 0.22) + Math.sin(time + i * 1.5) * 25;
            const bGrad = this.ctx.createLinearGradient(bx, 0, bx - 100, h);
            bGrad.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
            bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = bGrad;
            this.ctx.beginPath();
            this.ctx.moveTo(bx - 30, 0);
            this.ctx.lineTo(bx + 30, 0);
            this.ctx.lineTo(bx - 70, h);
            this.ctx.lineTo(bx - 140, h);
            this.ctx.fill();
          }

          // Bubbles
          this.bubbles.forEach(b => {
            b.y -= b.speed;
            if (b.y < -15) b.y = h + 15;
            const drawX = ((b.baseX - this.camera.x * 0.08) % w + w) % w;
            this.ctx.fillStyle = 'rgba(125, 211, 252, 0.25)';
            this.ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(drawX, b.y, b.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
          });
          break;
        }

        case 'snowy': {
          const grad = this.ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#7DD3FC');
          grad.addColorStop(0.7, '#E0F2FE');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);

          // Snowflakes
          this.snowflakes.forEach(s => {
            s.y += s.speed;
            s.x += s.drift;
            if (s.y > h + 10) s.y = -10;
            const drawX = ((s.x - this.camera.x * 0.1) % w + w) % w;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(drawX, s.y, s.radius, 0, Math.PI * 2);
            this.ctx.fill();
          });
          break;
        }

        case 'night': {
          const grad = this.ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#040814');
          grad.addColorStop(0.6, '#0B132B');
          grad.addColorStop(1, '#1C2541');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);

          // Moon
          this.ctx.fillStyle = '#FDE68A';
          this.ctx.beginPath();
          this.ctx.arc(w - 120, 80, 34, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = '#050917';
          this.ctx.beginPath();
          this.ctx.arc(w - 132, 74, 30, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        }

        case 'chrome': {
          // Upgraded Animated Sci-Fi Industrial Chrome Theme
          const grad = this.ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#070A10');
          grad.addColorStop(0.3, '#131C2E');
          grad.addColorStop(0.55, '#24334A');
          grad.addColorStop(0.72, '#64748B');
          grad.addColorStop(0.75, '#CBD5E1'); // Specular horizon flare
          grad.addColorStop(1, '#0B111E');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);

          const horizon = h * 0.72;

          // Volumetric Holographic Laser Pillars
          for (let i = 0; i < 4; i++) {
            const lx = ((i * 260 + Math.sin(time * 0.8 + i) * 20 - this.camera.x * 0.05) % w + w) % w;
            const lGrad = this.ctx.createLinearGradient(lx, 0, lx, horizon);
            lGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            lGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.06)');
            lGrad.addColorStop(1, 'rgba(56, 189, 248, 0.22)');
            this.ctx.fillStyle = lGrad;
            this.ctx.fillRect(lx - 12, 0, 24, horizon);
          }

          // Distant Megastructures & Blinking Beacon Lights
          this.ctx.fillStyle = '#1A2333';
          const loopW = 800;
          const off = (this.camera.x * 0.04) % loopW;
          for (let x = -100; x < w + 200; x += 160) {
            const tx = x - off;
            this.ctx.fillRect(tx, horizon - 110, 36, 110);
            this.ctx.fillRect(tx + 48, horizon - 75, 48, 75);
            // Red warning beacon
            const beaconOn = Math.sin(time * 4 + x) > 0;
            this.ctx.fillStyle = beaconOn ? '#EF4444' : '#450A0A';
            this.ctx.beginPath();
            this.ctx.arc(tx + 18, horizon - 113, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#1A2333';
          }

          // Rotating Chrome Industrial Gears (Midground)
          const gearOff = (this.camera.x * 0.08) % 600;
          [160, 480].forEach((gx, idx) => {
            const drawGx = ((gx - gearOff) % (w + 200) + (w + 200)) % (w + 200) - 100;
            const drawGy = horizon - 50;
            const rot = (time * 0.3) * (idx % 2 === 0 ? 1 : -1);
            this.ctx.save();
            this.ctx.translate(drawGx, drawGy);
            this.ctx.rotate(rot);
            this.ctx.strokeStyle = '#334155';
            this.ctx.lineWidth = 6;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 38, 0, Math.PI * 2);
            this.ctx.stroke();
            // Teeth
            for (let a = 0; a < 8; a++) {
              const ang = a * (Math.PI / 4);
              this.ctx.fillStyle = '#475569';
              this.ctx.fillRect(Math.cos(ang) * 36 - 4, Math.sin(ang) * 36 - 4, 8, 8);
            }
            this.ctx.restore();
          });

          // Moving Specular Horizon Sheen
          const gleamX = ((time * 160) % (w + 400)) - 200;
          const gleamGrad = this.ctx.createRadialGradient(gleamX, horizon, 0, gleamX, horizon, 140);
          gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
          gleamGrad.addColorStop(0.4, 'rgba(203, 213, 225, 0.3)');
          gleamGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');
          this.ctx.fillStyle = gleamGrad;
          this.ctx.fillRect(0, horizon - 10, w, 20);

          // Animated Chrome Sparks & Starburst Gleams
          this.chromeSparks.forEach(p => {
            p.y -= p.speed;
            if (p.y < 0) p.y = horizon;
            const drawPx = ((p.x - this.camera.x * 0.09) % w + w) % w;
            const twinkle = (Math.sin(time * 5 + p.twinklePhase) + 1) * 0.5;
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = 0.4 + twinkle * 0.6;
            if (p.isStarburst) {
              const sz = p.size * (1 + twinkle * 0.8);
              this.ctx.fillRect(drawPx - sz, p.y - 0.8, sz * 2, 1.6);
              this.ctx.fillRect(drawPx - 0.8, p.y - sz, 1.6, sz * 2);
            } else {
              this.ctx.beginPath();
              this.ctx.arc(drawPx, p.y, p.size, 0, Math.PI * 2);
              this.ctx.fill();
            }
            this.ctx.globalAlpha = 1.0;
          });
          break;
        }

        case 'jungle': {
          // Upgraded Animated Lush Tropical Jungle Theme
          const grad = this.ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#02140A');
          grad.addColorStop(0.35, '#064E3B');
          grad.addColorStop(0.65, '#0F766E');
          grad.addColorStop(0.80, '#34D399');
          grad.addColorStop(1, '#062816');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);

          // Volumetric Animated Golden God Rays (Filtered through canopy)
          for (let i = 0; i < 5; i++) {
            const rx = (w * 0.15) + i * (w * 0.2) + Math.sin(time * 0.8 + i * 1.4) * 35;
            const rGrad = this.ctx.createLinearGradient(rx, 0, rx + 140, h);
            rGrad.addColorStop(0, 'rgba(253, 224, 71, 0.16)');
            rGrad.addColorStop(0.6, 'rgba(253, 224, 71, 0.05)');
            rGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = rGrad;
            this.ctx.beginPath();
            this.ctx.moveTo(rx - 35, 0);
            this.ctx.lineTo(rx + 45, 0);
            this.ctx.lineTo(rx + 180, h);
            this.ctx.lineTo(rx + 70, h);
            this.ctx.fill();
          }

          // Distant Ancient Mayan Temple Pyramid Silhouette (Slow parallax)
          const horizon = h * 0.74;
          const pyrOff = (this.camera.x * 0.04) % 1000;
          const pyrX = ((540 - pyrOff) % (w + 300) + (w + 300)) % (w + 300) - 150;
          this.ctx.fillStyle = '#062F22';
          // Stepped tiers
          this.ctx.fillRect(pyrX - 70, horizon - 28, 140, 28);
          this.ctx.fillRect(pyrX - 50, horizon - 52, 100, 24);
          this.ctx.fillRect(pyrX - 32, horizon - 72, 64, 20);
          this.ctx.fillRect(pyrX - 14, horizon - 88, 28, 16);

          // Midground Giant Banyan Trunks & Canopy
          this.ctx.fillStyle = '#07331F';
          const jLoop = 900;
          const jOff = (this.camera.x * 0.1) % jLoop;
          for (let x = -100; x < w + 200; x += 150) {
            const tx = x - jOff;
            this.ctx.fillRect(tx + 24, horizon - 120, 14, 120);
            this.ctx.beginPath();
            this.ctx.arc(tx + 31, horizon - 120, 52, Math.PI * 0.85, Math.PI * 2.15);
            this.ctx.fill();

            // Dynamic Swaying Vines (Lianas)
            const sway = Math.sin(time * 2.0 + x * 0.02) * 16;
            this.ctx.strokeStyle = '#07331F';
            this.ctx.lineWidth = 3.5;
            this.ctx.beginPath();
            this.ctx.moveTo(tx + 12, horizon - 110);
            this.ctx.quadraticCurveTo(tx + 6 + sway * 0.6, horizon - 50, tx + 14 + sway, horizon - 10);
            this.ctx.stroke();
          }

          // Glowing Bioluminescent Fireflies Particle System
          this.jungleFireflies.forEach(f => {
            f.y -= f.speed;
            if (f.y < 0) f.y = h;
            const fx = ((f.baseX + Math.sin(time * 2 + f.wobbleSpeed * 1000) * f.wobbleAmp - this.camera.x * 0.08) % w + w) % w;
            const glow = (Math.sin(time * 4 + f.glowPhase) + 1) * 0.5;

            // Halo
            const halo = this.ctx.createRadialGradient(fx, f.y, 0, fx, f.y, f.radius * 3.5);
            halo.addColorStop(0, f.color);
            halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = halo;
            this.ctx.globalAlpha = 0.25 + glow * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(fx, f.y, f.radius * 3.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Core
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.8;
            this.ctx.beginPath();
            this.ctx.arc(fx, f.y, f.radius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
          });
          break;
        }

        case 'neon': {
          this.ctx.fillStyle = '#030305';
          this.ctx.fillRect(0, 0, w, h);
          const horizon = h * 0.68;
          this.ctx.strokeStyle = '#00E5FF';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(0, horizon);
          this.ctx.lineTo(w, horizon);
          this.ctx.stroke();
          break;
        }

        case '8-bit': {
          this.ctx.fillStyle = '#5C94FC';
          this.ctx.fillRect(0, 0, w, h);
          break;
        }

        case 'mixed': {
          const grad = this.ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#FAF4E8');
          grad.addColorStop(1, '#E9D2AC');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);
          break;
        }

        case 'grass':
        default: {
          const grad = this.ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#60A5FA');
          grad.addColorStop(1, '#DBEAFE');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);

          // Simple Parallax Hills
          this.ctx.fillStyle = '#86EFAC';
          const loop1 = 800;
          const off1 = (this.camera.x * 0.08) % loop1;
          this.ctx.beginPath();
          this.ctx.moveTo(0, h);
          for (let x = -200; x < w + 300; x += 250) {
            this.ctx.quadraticCurveTo(x - off1 + 125, h * 0.72, x - off1 + 250, h);
          }
          this.ctx.fill();
          break;
        }
      }
    }

    render() {
      const w = this.canvas.width;
      const h = this.canvas.height;
      this.ctx.clearRect(0, 0, w, h);

      // 1. Background
      this.renderBackground(w, h);

      // 2. World Space
      this.ctx.save();
      this.ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

      // Entities
      for (const ent of this.entities) {
        if (ent.render) ent.render(this.ctx, this.theme);
      }

      // Bullets
      for (const b of this.bullets) {
        b.render(this.ctx);
      }

      // Player
      this.player.render(this.ctx);

      this.ctx.restore();

      // 3. Screen Space Overlays / Confetti
      for (const p of this.confetti) {
        this.ctx.save();
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
        this.ctx.restore();
      }
    }

    gameLoop(now) {
      const dt = Math.min(0.06, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.update(dt);
      this.render();

      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  // Auto-launch standalone game once DOM is loaded
  window.addEventListener('DOMContentLoaded', () => {
    try {
      const levelPayload = JSON.parse(document.getElementById('embedded-level-data').textContent);
      new StandaloneGame(levelPayload);
    } catch (err) {
      console.error('Failed to initialize standalone game:', err);
    }
  });
  </script>
</body>
</html>`;
}
