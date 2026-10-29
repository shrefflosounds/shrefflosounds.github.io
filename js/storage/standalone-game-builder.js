// Sidehop Standalone Single-File HTML Game Generator
// Produces a 100% self-contained, offline-playable HTML5 game featuring the exact Sidehop engine,
// physics, entity classes, autotiling, slopes, custom sprites, custom backgrounds, audio, and theme.

import { SoundEngine } from '../audio/sound.js?v=20261028_213755';
import { Camera } from '../engine/camera.js?v=20261028_213755';
import { PhysicsEngine } from '../engine/physics.js?v=20261028_213755';
import {
  Entity,
  Player,
  SolidBlock,
  Springboard,
  HazardSpikes,
  EnemyWalker,
  MovingPlatform,
  Bullet,
  Collectible,
  GoalFlag
} from '../engine/entities.js?v=20261028_213755';

function escapeHtml(str) {
  return String(str || 'Sidehop Game')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateStandaloneGameHtml(levelData, title = 'Sidehop Game') {
  const safeTitle = escapeHtml(title);
  const theme = levelData.theme || levelData.background?.worldTheme || 'grass';

  // Package in standard Sidehop envelope so the .html file can also be re-imported into Sidehop
  const embeddedPackage = {
    format: 'sidehop',
    version: 1,
    kind: 'level',
    theme: theme,
    meta: {
      title: title,
      creator: "John O'Brien",
      createdAt: new Date().toISOString(),
      app: 'Sidehop',
      description: 'Standalone playable HTML game & editable Sidehop level'
    },
    level: {
      version: levelData.version || 2,
      name: title,
      theme: theme,
      background: levelData.background || { theme: theme, customImage: null },
      player: levelData.player,
      entities: levelData.entities || []
    }
  };

  const safeJson = JSON.stringify(embeddedPackage).replace(/<\/script/gi, '<\\/script');

  // Extract the exact runtime engine classes so physics, rendering, custom art, slopes, and autotiling match 100%
  const engineClassesSource = [
    (SoundEngine || window.SoundEngine).toString(),
    (Camera || window.Camera).toString(),
    (PhysicsEngine || window.PhysicsEngine).toString(),
    (Entity || window.Entity).toString(),
    (Player || window.Player).toString(),
    (SolidBlock || window.SolidBlock).toString(),
    (Springboard || window.Springboard).toString(),
    (HazardSpikes || window.HazardSpikes).toString(),
    (EnemyWalker || window.EnemyWalker).toString(),
    (MovingPlatform || window.MovingPlatform).toString(),
    (Bullet || window.Bullet).toString(),
    (Collectible || window.Collectible).toString(),
    (GoalFlag || window.GoalFlag).toString()
  ].join('\n\n');

  const appProto = (typeof window !== 'undefined' && window.sidehop) ? Object.getPrototypeOf(window.sidehop) : null;
  const bgMethodNames = [
    'getLifelikeCloudSprite',
    'drawAtlantisBackground',
    'drawUncanny3DBackground',
    'drawMixedMediaBackground',
    'drawSnowyBackground',
    'drawSnowyMountains',
    'drawSnowflakes',
    'drawNightBackground',
    'drawCrescentMoon',
    'drawStars',
    'drawChromeBackground',
    'drawChromeGrid',
    'drawNeonBackground',
    'draw8BitBackground',
    'drawJungleBackground',
    'drawMeadowsBackground',
    'drawParallaxHills',
    'drawParallaxClouds'
  ];
  const exactBgOverrides = appProto
    ? bgMethodNames
        .filter(name => typeof appProto[name] === 'function')
        .map(name => {
          const fnSrc = appProto[name].toString();
          const bodySrc = fnSrc.startsWith('function') ? fnSrc : ('function ' + fnSrc);
          return `StandaloneSidehopApp.prototype.${name} = ${bodySrc};`;
        })
        .join('\n\n')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${safeTitle} — Sidehop Game</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-cream: #F6F4EB;
      --bg-panel: #FFFFFF;
      --header-bg: #EAE6D7;
      --ink-black: #121212;
      --border-color: #121212;
      --shadow-color: #121212;
      --text-muted: #555555;
      --border-subtle: #DDDDDD;
      --canary-yellow: #FFE600;
      --cyber-cyan: #00E5FF;
      --bubblegum-pink: #FF3388;
      --mint-green: #00E676;
      --hazard-red: #FF2A55;
      --accent-sun: #F5CE42;
      --accent-sky: #7AC1E4;
      --accent-rose: #E56B6F;
      --accent-mint: #52B788;
      --border-thick: 2px solid var(--border-color);
      --shadow-hard: 3px 3px 0px var(--shadow-color);
      --shadow-hover: 4px 4px 0px var(--shadow-color);
      --shadow-active: 1px 1px 0px var(--shadow-color);
    }

    body[data-theme="snowy"] {
      --bg-cream: #EBF3FA;
      --bg-panel: #F8FBFF;
      --header-bg: #DCE8F5;
      --ink-black: #1B2838;
      --border-color: #1B2838;
      --shadow-color: #1B2838;
      --accent-sun: #7CC6FE;
      --accent-sky: #A3D5FF;
      --accent-rose: #FF758F;
      --accent-mint: #48CAE4;
    }

    body[data-theme="night"] {
      --bg-cream: #0B0F19;
      --bg-panel: #161F33;
      --header-bg: #080B12;
      --ink-black: #F1F5F9;
      --border-color: #38BDF8;
      --shadow-color: #020617;
      --border-thick: 2px solid #38BDF8;
      --shadow-hard: 3px 3px 0px #020617;
      --accent-sun: #FACC15;
      --accent-sky: #38BDF8;
      --accent-rose: #F43F5E;
      --accent-mint: #2DD4BF;
    }

    body[data-theme="chrome"] {
      --bg-cream: #D8DEE9;
      --bg-panel: #ECEFF4;
      --header-bg: #C8D0DF;
      --ink-black: #1E242B;
      --border-color: #2E3440;
      --shadow-color: #2E3440;
      --accent-sun: #88C0D0;
      --accent-sky: #81A1C1;
      --accent-rose: #BF616A;
      --accent-mint: #A3BE8C;
    }

    body[data-theme="8-bit"] {
      --bg-cream: #5C94FC;
      --bg-panel: #FCF8EC;
      --header-bg: #000000;
      --ink-black: #000000;
      --border-color: #000000;
      --shadow-color: #000000;
      --accent-sun: #F8B800;
      --accent-sky: #3CBCFC;
      --accent-rose: #F83800;
      --accent-mint: #00A800;
    }

    body[data-theme="jungle"] {
      --bg-cream: #E8F0E8;
      --bg-panel: #F6FAF5;
      --header-bg: #DCE8DC;
      --ink-black: #1B3828;
      --border-color: #1B3828;
      --shadow-color: #1B3828;
      --accent-sun: #52B788;
      --accent-sky: #74C69D;
      --accent-rose: #E76F51;
      --accent-mint: #2D6A4F;
    }

    body[data-theme="neon"] {
      --bg-cream: #030305;
      --bg-panel: #0A0A12;
      --header-bg: #050508;
      --ink-black: #FFFFFF;
      --border-color: #00E5FF;
      --shadow-color: #FF007F;
      --border-thick: 2px solid #00E5FF;
      --shadow-hard: 3px 3px 0px #FF007F;
      --accent-sun: #FFE600;
      --accent-sky: #00E5FF;
      --accent-rose: #FF007F;
      --accent-mint: #00FF66;
    }

    body[data-theme="atlantis"] {
      --bg-cream: #041B2D;
      --bg-panel: #072B47;
      --header-bg: #031524;
      --ink-black: #E0F2FE;
      --border-color: #38BDF8;
      --shadow-color: #020D17;
      --border-thick: 2px solid #38BDF8;
      --shadow-hard: 3px 3px 0px #020D17;
      --accent-sun: #38BDF8;
      --accent-sky: #0284C7;
      --accent-rose: #F43F5E;
      --accent-mint: #2DD4BF;
    }

    body[data-theme="uncanny"],
    body[data-theme="mixed"] {
      --bg-cream: #DDE5EE;
      --bg-panel: #F1F5F9;
      --header-bg: #CBD5E1;
      --ink-black: #0F172A;
      --border-color: #1E293B;
      --shadow-color: #334155;
      --accent-sun: #FBBF24;
      --accent-sky: #38BDF8;
      --accent-rose: #E11D48;
      --accent-mint: #10B981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }

    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: var(--bg-cream);
      color: var(--ink-black);
      font-family: 'Fredoka', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
    }

    .neo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 52px;
      max-height: 52px;
      padding: 6px 16px;
      background-color: var(--header-bg);
      border-bottom: var(--border-thick);
      z-index: 100;
      gap: 12px;
      flex-shrink: 0;
    }

    body[data-theme="8-bit"] .neo-header .logo-title {
      color: #FFFFFF;
    }

    .logo-group {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .logo-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--canary-yellow);
      border: 2px solid #121212;
      box-shadow: 2px 2px 0 #121212;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .logo-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--ink-black);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .controls-hint {
      font-size: 12px;
      font-weight: 700;
      opacity: 0.78;
      color: var(--ink-black);
      white-space: nowrap;
    }

    body[data-theme="8-bit"] .controls-hint {
      color: #E2E8F0;
    }

    @media (max-width: 760px) {
      .controls-hint { display: none; }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .unboxed-symbol-btn {
      background: transparent;
      border: none;
      box-shadow: none;
      color: var(--ink-black);
      font-size: 20px;
      line-height: 1;
      padding: 4px 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.12s ease;
    }

    body[data-theme="8-bit"] .unboxed-symbol-btn {
      color: #FFFFFF;
    }

    .unboxed-symbol-btn:hover {
      transform: scale(1.18);
    }

    .neo-btn {
      font-family: inherit;
      font-size: 12px;
      font-weight: 800;
      padding: 5px 11px;
      border-radius: 8px;
      border: var(--border-thick);
      box-shadow: var(--shadow-hard);
      background-color: var(--accent-sun);
      color: #121212;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: transform 0.08s ease, box-shadow 0.08s ease;
    }

    .neo-btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-hover);
    }

    .neo-btn:active {
      transform: translate(2px, 2px);
      box-shadow: var(--shadow-active);
    }

    .stage-container {
      flex: 1;
      width: 100vw;
      height: calc(100vh - 52px);
      position: relative;
      overflow: hidden;
      background: #000;
    }

    #game-canvas {
      display: block;
      width: 100%;
      height: 100%;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    body[data-theme="uncanny"] #game-canvas {
      image-rendering: auto;
      image-rendering: smooth;
    }

    /* VICTORY OVERLAY */
    .victory-overlay {
      position: absolute;
      inset: 0;
      background: rgba(18, 18, 18, 0.72);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }

    .victory-overlay.active {
      display: flex;
    }

    .victory-card {
      background: var(--bg-panel);
      border: 3px solid var(--border-color);
      border-radius: 18px;
      box-shadow: 6px 6px 0 var(--shadow-color);
      padding: 28px 34px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      animation: popIn 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
      from { transform: scale(0.85); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .victory-title {
      font-size: 30px;
      font-weight: 900;
      color: var(--ink-black);
      margin-bottom: 8px;
    }

    .victory-stats {
      font-size: 18px;
      font-weight: 700;
      color: var(--ink-black);
      margin-bottom: 20px;
      opacity: 0.9;
    }

    .victory-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    /* TOAST */
    .sidehop-toast {
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      background: #FFE600;
      color: #121212;
      border: 2.5px solid #121212;
      border-radius: 10px;
      box-shadow: 3px 3px 0 #121212;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 800;
      z-index: 9999;
      pointer-events: none;
    }
  </style>
</head>
<body data-theme="${escapeHtml(theme)}">
  <header class="neo-header">
    <div class="logo-group">
      <div class="logo-badge">🐰</div>
      <h1 class="logo-title">${safeTitle}</h1>
    </div>
    <div class="controls-hint">
      Move: <strong>WASD / Arrows</strong> &bull; Jump: <strong>Space / W / ↑</strong> &bull; Shoot: <strong>F / X / Click</strong> &bull; Restart: <strong>R</strong>
    </div>
    <div class="header-actions">
      <button id="sound-toggle-btn" class="unboxed-symbol-btn" title="Mute / Unmute Sound (M)">
        <span id="sound-icon">🔊</span>
      </button>
      <button id="fullscreen-btn" class="unboxed-symbol-btn" title="Fullscreen">
        <span id="fullscreen-icon">⛶</span>
      </button>
      <button id="restart-btn" class="neo-btn" title="Restart Level (R)">
        <span>🔄 Restart</span>
      </button>
    </div>
  </header>

  <main class="stage-container" id="stage-container">
    <canvas id="game-canvas" width="960" height="540"></canvas>

    <div id="victory-overlay" class="victory-overlay">
      <div class="victory-card">
        <div class="victory-title">🏆 LEVEL CLEAR!</div>
        <p id="victory-stats" class="victory-stats">Score: 0</p>
        <div class="victory-actions">
          <button id="victory-restart-btn" class="neo-btn" style="font-size: 15px; padding: 10px 20px;">
            <span>🔄 Play Again</span>
          </button>
        </div>
      </div>
    </div>
  </main>

  <!-- Embedded Sidehop Level Data (Can also be re-imported into Sidehop Studio!) -->
  <script id="embedded-level-data" type="application/json">${safeJson}<\/script>

  <script>
    "use strict";

    // Safe Canvas roundRect polyfill
    if (typeof CanvasRenderingContext2D !== 'undefined') {
      const nativeRoundRect = CanvasRenderingContext2D.prototype.roundRect;
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        const width = Math.max(0, w || 0);
        const height = Math.max(0, h || 0);
        const rVal = Array.isArray(radii) ? (radii[0] || 0) : (typeof radii === 'number' ? radii : 0);
        const r = Math.min(width / 2, height / 2, Math.max(0, rVal));
        if (nativeRoundRect) {
          try {
            return nativeRoundRect.call(this, x, y, width, height, r);
          } catch (_) {}
        }
        this.moveTo(x + r, y);
        this.lineTo(x + width - r, y);
        this.quadraticCurveTo(x + width, y, x + width, y + r);
        this.lineTo(x + width, y + height - r);
        this.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        this.lineTo(x + r, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        return this;
      };
    }

    ${engineClassesSource}

    const sounds = new SoundEngine();
    window.sounds = sounds;
    window.SoundEngine = SoundEngine;
    window.Camera = Camera;
    window.PhysicsEngine = PhysicsEngine;
    window.Entity = Entity;
    window.Player = Player;
    window.SolidBlock = SolidBlock;
    window.Springboard = Springboard;
    window.HazardSpikes = HazardSpikes;
    window.EnemyWalker = EnemyWalker;
    window.MovingPlatform = MovingPlatform;
    window.Bullet = Bullet;
    window.Collectible = Collectible;
    window.GoalFlag = GoalFlag;

    class StandaloneSidehopApp {
      constructor(pkg) {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mode = 'play';
        this.pkg = pkg;
        this.levelData = pkg.level || pkg;
        this.currentTheme = pkg.theme || this.levelData.theme || this.levelData.background?.worldTheme || 'grass';
        window.__SIDEHOP_THEME__ = this.currentTheme;
        document.body.setAttribute('data-theme', this.currentTheme);

        this.physics = new PhysicsEngine();
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        this.player = new Player(120, 360);
        this.entities = [];
        this.bullets = [];
        this.confetti = [];
        this.keys = {};
        this.score = 0;
        this.isLevelWon = false;
        this.gunPickedUpInLevel = false;

        this.background = {
          theme: this.currentTheme,
          customImage: null,
          customImageElement: null
        };

        this.snowflakes = Array.from({ length: 65 }, () => ({
          x: Math.random() * 1400,
          y: Math.random() * 600,
          radius: Math.random() * 2.8 + 1.2,
          speed: Math.random() * 0.8 + 0.4,
          drift: (Math.random() - 0.5) * 0.5
        }));

        this.bubbles = Array.from({ length: 45 }, () => ({
          x: Math.random() * 1400,
          y: Math.random() * 600,
          baseX: Math.random() * 1400,
          radius: Math.random() * 4.5 + 1.8,
          speed: Math.random() * 0.9 + 0.35,
          wobbleSpeed: Math.random() * 0.003 + 0.001,
          wobbleAmp: Math.random() * 12 + 4
        }));

        this.chromeSparks = Array.from({ length: 42 }, () => ({
          x: Math.random() * 1600,
          y: Math.random() * 600,
          size: Math.random() * 2.5 + 1.0,
          speed: Math.random() * 0.4 + 0.15,
          twinklePhase: Math.random() * Math.PI * 2,
          isStarburst: Math.random() > 0.65,
          color: Math.random() > 0.5 ? '#00E5FF' : '#FFFFFF'
        }));

        this.jungleFireflies = Array.from({ length: 50 }, () => ({
          x: Math.random() * 1600,
          y: Math.random() * 600,
          baseX: Math.random() * 1600,
          radius: Math.random() * 2.6 + 1.2,
          speed: Math.random() * 0.45 + 0.15,
          wobbleSpeed: Math.random() * 0.0025 + 0.001,
          wobbleAmp: Math.random() * 18 + 6,
          glowPhase: Math.random() * Math.PI * 2,
          color: Math.random() > 0.3 ? '#FDE047' : '#A7F3D0'
        }));

        this.updateCanvasDimensions();
        this.loadFromSnapshot(this.levelData);
        this.camera.recenter(this.player.spawnX, this.player.spawnY);
        this.bindEvents();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
      }

      createEntityFromData(d) {
        if (!d || !d.type) return null;
        let ent = null;
        switch (d.type) {
          case 'crate':
          case 'block':
            ent = new SolidBlock(d.x, d.y, d.width, d.height, d.variant || 'solid', d.content || null);
            if (d.material) ent.material = d.material;
            if (d.bounciness !== undefined) ent.bounciness = d.bounciness;
            if (d.friction !== undefined) ent.friction = d.friction;
            if (d.content) ent.content = d.content;
            break;
          case 'springboard':
            ent = new Springboard(d.x, d.y, d.width, d.height, d.variant || 'spring');
            if (d.launchForce !== undefined) ent.launchForce = d.launchForce;
            break;
          case 'hazard':
            ent = new HazardSpikes(d.x, d.y, d.width, d.height);
            break;
          case 'enemy':
            ent = new EnemyWalker(d.x, d.y, d.width, d.height, d.variant || 'walker');
            if (d.speed !== undefined) ent.speed = d.speed;
            if (d.patrolRange !== undefined) ent.patrolRange = d.patrolRange;
            if (d.stompable !== undefined) ent.stompable = d.stompable;
            break;
          case 'moving_platform':
            ent = new MovingPlatform(d.x, d.y, d.width, d.height);
            if (d.speed !== undefined) ent.speed = d.speed;
            if (d.distance !== undefined) ent.distance = d.distance;
            if (d.axis !== undefined) ent.axis = d.axis;
            break;
          case 'collectible':
            ent = new Collectible(d.x, d.y, d.width, d.height, d.variant || 'coin');
            break;
          case 'goal':
            ent = new GoalFlag(d.x, d.y, d.width, d.height);
            break;
        }
        if (ent) {
          if (d.color) ent.setColor(d.color);
          if (d.customVisual) ent.setCustomVisual(d.customVisual);
        }
        return ent;
      }

      loadFromSnapshot(data) {
        if (!data) return;
        if (data.player) {
          this.player.setSpawn(
            data.player.spawnX !== undefined ? data.player.spawnX : 120,
            data.player.spawnY !== undefined ? data.player.spawnY : 360
          );
          if (data.player.width) this.player.width = data.player.width;
          if (data.player.height) this.player.height = data.player.height;
          if (data.player.speed) this.player.speed = data.player.speed;
          if (data.player.jumpForce) this.player.jumpForce = data.player.jumpForce;
          if (data.player.gravityScale !== undefined) this.player.gravityScale = data.player.gravityScale;
          if (data.player.maxHearts !== undefined) {
            this.player.maxHearts = data.player.maxHearts;
            this.player.hearts = data.player.maxHearts;
          }
          if (data.player.doubleJumpAllowed !== undefined) {
            this.player.doubleJumpAllowed = data.player.doubleJumpAllowed;
            this.player.hasDoubleJump = data.player.doubleJumpAllowed;
          }
          if (data.player.color) this.player.setColor(data.player.color);
          if (data.player.customVisual) this.player.setCustomVisual(data.player.customVisual);
        }

        this.entities.length = 0;
        if (Array.isArray(data.entities)) {
          data.entities.forEach(d => {
            const ent = this.createEntityFromData(d);
            if (ent) this.entities.push(ent);
          });
        }

        if (data.background) {
          this.applyBackground(data.background);
        }
      }

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
      }

      updateCanvasDimensions() {
        const stage = document.getElementById('stage-container');
        if (!stage) return;
        const w = stage.clientWidth & ~1;
        const h = stage.clientHeight & ~1;
        if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
          this.canvas.width = w;
          this.canvas.height = h;
          this.camera.resize(w, h);
        }
      }

      resetPlaySession() {
        this.loadFromSnapshot(this.levelData);
        this.score = 0;
        this.bullets = [];
        this.gunPickedUpInLevel = false;
        this.isLevelWon = false;
        this.player.respawn();
        this.player.hearts = this.player.maxHearts || 4;
        this.player.invulnerableTimer = 0;
        this.camera.recenter(this.player.spawnX, this.player.spawnY);
        document.getElementById('victory-overlay')?.classList.remove('active');
      }

      showToast(message) {
        const existing = document.querySelector('.sidehop-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'sidehop-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2200);
      }

      handleMysteryBlockHit(block) {
        try {
          let kind = block.content || 'auto';
          if (kind === 'auto') {
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
            sounds.playCollect();
            this.score += 100;
            this.spawnCoinBounceParticle(block.x + block.width / 2, block.y);
            this.showToast('🪙 +100 PTS');
          } else {
            const itemW = 32;
            const itemH = 32;
            const itemX = block.x + (block.width - itemW) / 2;
            const targetY = block.y - itemH - 4;
            const item = new Collectible(itemX, block.y, itemW, itemH, variant);
            item.targetY = targetY;
            item.emerging = true;
            item.emergeVy = -190;
            item.isSpawnedDrop = true;
            sounds.playGunPickup();
            this.entities.push(item);

            const label = variant === 'pistol'
              ? '🔫 Gun Powerup'
              : variant === 'ammo'
                ? '📦 Ammunition Box'
                : '❤️ Health Heart';
            this.showToast('✨ ' + label);
          }
        } catch (err) {
          console.error('handleMysteryBlockHit error:', err);
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

      spawnMusicNoteParticle(x, y) {
        const symbols = ['♪', '♫', '♬', '♩'];
        const colors = ['#FF2A85', '#00E5FF', '#FFE600', '#00E676', '#B388FF'];
        for (let i = 0; i < 3; i++) {
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

      triggerVictory() {
        this.isLevelWon = true;
        sounds.playVictory();
        const statsEl = document.getElementById('victory-stats');
        if (statsEl) statsEl.textContent = 'Total Score: ' + this.score + ' PTS';
        document.getElementById('victory-overlay')?.classList.add('active');

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

      bindEvents() {
        window.addEventListener('keydown', (e) => {
          this.keys[e.code] = true;
          if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
          }
          if (e.code === 'KeyR') {
            this.resetPlaySession();
            sounds.playClick();
          }
          if (e.code === 'KeyM') {
            sounds.setMuted(!sounds.muted);
            const icon = document.getElementById('sound-icon');
            if (icon) icon.textContent = sounds.muted ? '🔇' : '🔊';
            sounds.playClick();
          }
        });

        window.addEventListener('keyup', (e) => {
          this.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousedown', (e) => {
          if (e.button === 0 && !this.isLevelWon) {
            if (this.player.hasPistol && this.player.shootCooldown <= 0) {
              const bullet = this.player.shoot();
              if (bullet) {
                this.bullets.push(bullet);
                sounds.playShoot();
              }
            }
          }
        });

        document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
          sounds.setMuted(!sounds.muted);
          const icon = document.getElementById('sound-icon');
          if (icon) icon.textContent = sounds.muted ? '🔇' : '🔊';
          sounds.playClick();
        });

        document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
          sounds.playClick();
        });

        document.getElementById('restart-btn')?.addEventListener('click', () => {
          this.resetPlaySession();
          sounds.playClick();
        });

        document.getElementById('victory-restart-btn')?.addEventListener('click', () => {
          this.resetPlaySession();
          sounds.playClick();
        });

        window.addEventListener('resize', () => {
          this.updateCanvasDimensions();
        });
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
          case 'atlantis': this.drawAtlantisBackground(w, h); break;
          case 'uncanny':
          case 'mixed': this.drawUncanny3DBackground(w, h); break;
          case 'snowy': this.drawSnowyBackground(w, h); break;
          case 'night': this.drawNightBackground(w, h); break;
          case 'chrome': this.drawChromeBackground(w, h); break;
          case '8-bit': this.draw8BitBackground(w, h); break;
          case 'jungle': this.drawJungleBackground(w, h); break;
          case 'neon': this.drawNeonBackground(w, h); break;
          case 'grass':
          default:
            this.drawMeadowsBackground(w, h);
            break;
        }
      }

      drawAtlantisBackground(w, h) {
        this.ctx.save();
        const oceanGrad = this.ctx.createLinearGradient(0, 0, 0, h);
        oceanGrad.addColorStop(0, '#02182B');
        oceanGrad.addColorStop(0.35, '#052F4E');
        oceanGrad.addColorStop(0.7, '#07486E');
        oceanGrad.addColorStop(1, '#021424');
        this.ctx.fillStyle = oceanGrad;
        this.ctx.fillRect(0, 0, w, h);

        const time = performance.now() * 0.0008;
        for (let i = 0; i < 4; i++) {
          const beamX = (w * 0.2) + i * (w * 0.22) + Math.sin(time + i * 1.5) * 25;
          const beamGrad = this.ctx.createLinearGradient(beamX, 0, beamX - 120, h);
          beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
          beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
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

        const horizon = h * 0.74;
        this.ctx.fillStyle = '#032338';
        const ruinsLoop = 1200;
        const ruinsOff = (this.camera.x * 0.05) % ruinsLoop;
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        for (let x = -200; x <= w + 200; x += 150) {
          this.ctx.lineTo(x - ruinsOff, horizon + Math.sin(x * 0.008) * 20);
        }
        this.ctx.lineTo(w, h);
        this.ctx.closePath();
        this.ctx.fill();

        [120, 340, 560, 840, 1020].forEach((colX, idx) => {
          const px = ((colX - ruinsOff) % ruinsLoop + ruinsLoop) % ruinsLoop - 100;
          const pBaseY = horizon + Math.sin(colX * 0.008) * 20;
          const pH = 70 + (idx % 3) * 25;
          this.ctx.fillRect(px, pBaseY - pH, 16, pH);
          this.ctx.fillRect(px - 4, pBaseY - pH - 6, 24, 7);
          this.ctx.fillRect(px - 3, pBaseY - 5, 22, 6);
        });

        this.ctx.fillStyle = '#053658';
        const reefLoop = 900;
        const reefOff = (this.camera.x * 0.12) % reefLoop;
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        for (let x = -200; x <= w + 200; x += 120) {
          this.ctx.lineTo(x - reefOff, horizon + 25 + Math.cos(x * 0.012) * 25);
        }
        this.ctx.lineTo(w, h);
        this.ctx.closePath();
        this.ctx.fill();

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
        });
        this.ctx.restore();
      }

      drawUncanny3DBackground(w, h) {
        this.ctx.save();
        const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, '#1E5FA8');
        skyGrad.addColorStop(0.38, '#4F94D4');
        skyGrad.addColorStop(0.72, '#9BC8EE');
        skyGrad.addColorStop(1, '#D4E9F9');
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, w, h);

        const gridSize = 40;
        const gridOffX = -(this.camera.x * 0.18) % gridSize;
        const gridOffY = -(this.camera.y * 0.18) % gridSize;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        this.ctx.lineWidth = 1.1;
        this.ctx.beginPath();
        for (let x = gridOffX; x < w; x += gridSize) {
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, h);
        }
        for (let y = gridOffY; y < h; y += gridSize) {
          this.ctx.moveTo(0, y);
          this.ctx.lineTo(w, y);
        }
        this.ctx.stroke();

        const horizon = h * 0.76;
        const hillOff1 = (this.camera.x * 0.06) % 960;
        for (let x = -320; x < w + 420; x += 280) {
          const hx = x - hillOff1;
          const domeR = 230;
          const domeY = horizon + 125;
          const hillGrad1 = this.ctx.createRadialGradient(hx - 55, domeY - domeR * 0.85, 18, hx, domeY, domeR);
          hillGrad1.addColorStop(0, '#74C655');
          hillGrad1.addColorStop(0.5, '#3E8E2E');
          hillGrad1.addColorStop(1, '#113411');
          this.ctx.fillStyle = hillGrad1;
          this.ctx.beginPath();
          this.ctx.arc(hx, domeY, domeR, Math.PI, 0, false);
          this.ctx.closePath();
          this.ctx.fill();
        }
        this.ctx.restore();
      }

      drawMixedMediaBackground(w, h) {
        this.drawUncanny3DBackground(w, h);
      }

      drawSnowyBackground(w, h) {
        this.ctx.save();
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#94BDE4');
        grad.addColorStop(0.55, '#D5E6F5');
        grad.addColorStop(1, '#EEF5FC');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        this.drawSnowyMountains(w, h);
        this.drawSnowflakes(w, h);
        this.ctx.restore();
      }

      drawSnowyMountains(w, h) {
        this.ctx.save();
        const horizon = h * 0.72;
        this.ctx.fillStyle = '#C1D5E8';
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        const off1 = (this.camera.x * 0.05) % 1200;
        for (let x = -200; x <= w + 200; x += 180) {
          const peakX = x - off1;
          const peakH = 90 + Math.sin(x * 0.02) * 40;
          this.ctx.lineTo(peakX, horizon - peakH);
          this.ctx.lineTo(peakX + 90, horizon);
        }
        this.ctx.lineTo(w, h);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = '#8FA9C4';
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        const off2 = (this.camera.x * 0.12) % 1000;
        for (let x = -200; x <= w + 200; x += 160) {
          const peakX = x - off2;
          const peakH = 130 + Math.cos(x * 0.015) * 50;
          this.ctx.lineTo(peakX, horizon - peakH);
          this.ctx.lineTo(peakX + 80, horizon);
        }
        this.ctx.lineTo(w, h);
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

      drawNightBackground(w, h) {
        this.ctx.save();
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#040814');
        grad.addColorStop(0.55, '#0B132B');
        grad.addColorStop(1, '#1C2541');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        this.drawStars(w, h);
        this.drawCrescentMoon(w, h);
        const horizon = h * 0.78;
        this.ctx.fillStyle = '#070B18';
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        const off = (this.camera.x * 0.08) % 800;
        for (let x = -200; x <= w + 200; x += 180) {
          this.ctx.lineTo(x - off, horizon - 35 + Math.sin(x * 0.012) * 30);
        }
        this.ctx.lineTo(w, h);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      }

      drawCrescentMoon(w, h) {
        this.ctx.save();
        const moonX = Math.max(70, w - 120);
        const moonY = 85;
        const radius = 28;
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

      drawStars(w, h) {
        this.ctx.save();
        const pOffX = (this.camera.x * 0.04);
        for (let i = 0; i < 48; i++) {
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

      drawChromeBackground(w, h) {
        this.ctx.save();
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#070A10');
        grad.addColorStop(0.28, '#131C2E');
        grad.addColorStop(0.55, '#24334A');
        grad.addColorStop(0.70, '#64748B');
        grad.addColorStop(0.72, '#E2E8F0');
        grad.addColorStop(1, '#0B111E');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        const horizon = h * 0.70;
        for (let i = 1; i <= 10; i++) {
          const t = Math.pow(i / 10, 2.2);
          const gy = horizon + t * (h - horizon);
          this.ctx.strokeStyle = 'rgba(148, 163, 184, ' + (0.1 + t * 0.35) + ')';
          this.ctx.lineWidth = 1 + t * 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(0, gy);
          this.ctx.lineTo(w, gy);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      drawNeonBackground(w, h) {
        this.ctx.save();
        this.ctx.fillStyle = '#030305';
        this.ctx.fillRect(0, 0, w, h);
        const horizon = h * 0.65;
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
        for (let i = 1; i <= 8; i++) {
          const t = Math.pow(i / 8, 2.2);
          const gy = horizon + t * (h - horizon);
          this.ctx.strokeStyle = 'rgba(0, 229, 255, ' + (0.08 + t * 0.25) + ')';
          this.ctx.lineWidth = 1 + t * 1.2;
          this.ctx.beginPath();
          this.ctx.moveTo(0, gy);
          this.ctx.lineTo(w, gy);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      draw8BitBackground(w, h) {
        this.ctx.save();
        this.ctx.fillStyle = '#5C94FC';
        this.ctx.fillRect(0, 0, w, h);
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
        const hillHorizon = h * 0.78;
        this.ctx.fillStyle = '#00A800';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        const hOff = (this.camera.x * 0.15) % 600;
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
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#02140A');
        grad.addColorStop(0.35, '#064E3B');
        grad.addColorStop(0.65, '#0F766E');
        grad.addColorStop(0.80, '#34D399');
        grad.addColorStop(1, '#062816');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        const horizon = h * 0.74;
        this.ctx.fillStyle = '#083E2C';
        const ridgeOff = (this.camera.x * 0.06) % 800;
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        for (let x = -200; x <= w + 200; x += 160) {
          this.ctx.lineTo(x - ridgeOff, horizon - 20 + Math.sin(x * 0.015) * 22);
        }
        this.ctx.lineTo(w, h);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      }

      drawMeadowsBackground(w, h) {
        this.ctx.save();
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#60A5FA');
        grad.addColorStop(1, '#DBEAFE');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        this.drawParallaxClouds(w, h);
        this.drawParallaxHills(w, h);
        this.ctx.restore();
      }

      drawParallaxHills(w, h) {
        this.ctx.save();
        const horizon = h * 0.82;
        this.ctx.fillStyle = '#86EFAC';
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        const off1 = (this.camera.x * 0.08) % 800;
        for (let x = -200; x < w + 300; x += 250) {
          const hx = x - off1;
          this.ctx.quadraticCurveTo(hx + 125, horizon - 55, hx + 250, horizon);
        }
        this.ctx.lineTo(w, h);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = '#22C55E';
        this.ctx.beginPath();
        this.ctx.moveTo(0, h);
        const off2 = (this.camera.x * 0.16) % 600;
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

      update(dt) {
        if (!this.isLevelWon) {
          const firedBullet = this.player.handleInput(this.keys, dt);
          if (firedBullet) {
            this.bullets.push(firedBullet);
            sounds.playShoot();
          }

          const solids = this.entities.filter(ent =>
            ent.type === 'crate' || ent.type === 'block' || ent.type === 'moving_platform' || ent.type === 'springboard'
          );
          for (const s of solids) {
            if (s.update && (s.bumpTimer > 0 || s.variant === 'donut')) {
              s.update(dt);
            }
          }
          this.physics.updateEntity(this.player, solids, dt);

          if (this.bullets && this.bullets.length > 0) {
            for (const bullet of this.bullets) {
              bullet.update(dt, solids);
              if (!bullet.active) continue;
              for (const ent of this.entities) {
                if (!ent.active || ent.type !== 'enemy' || ent.isSquashed) continue;
                if (this.physics.checkOverlap(bullet, ent)) {
                  bullet.active = false;
                  ent.stomp();
                  this.score += (ent.variant === 'spiky' ? 200 : (ent.variant === 'winged' ? 150 : 100));
                  this.spawnHurtParticles(ent.x + ent.width / 2, ent.y + ent.height / 2);
                  break;
                }
              }
            }
            this.bullets = this.bullets.filter(b => b.active);
          }

          for (const ent of this.entities) {
            if (!ent.active) continue;
            if (ent.type === 'springboard') {
              ent.update(dt);
              const playerBottom = this.player.y + this.player.height;
              const hOverlap = (this.player.x + this.player.width > ent.x + 3) && (this.player.x < ent.x + ent.width - 3);
              const vOnTop = (playerBottom >= ent.y - 6) && (this.player.y < ent.y + ent.height * 0.7);
              const isOverlapping = this.physics.checkOverlap(this.player, ent);
              if (hOverlap && (isOverlapping || vOnTop)) {
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
            } else if (ent.type === 'hazard') {
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
            } else if (ent.type === 'enemy') {
              const inActiveRange = Math.abs(ent.x - this.player.x) < 1600 ||
                (ent.x + ent.width >= this.camera.x - 400 && ent.x <= this.camera.x + this.canvas.width + 400);
              if (!inActiveRange) continue;
              ent.update(dt, solids);
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
            } else if (ent.type === 'moving_platform') {
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
            } else if (ent.type === 'collectible') {
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
                  this.showToast('📦 Ammo Reloaded! (+15 Rounds)');
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
            } else if (ent.type === 'goal') {
              ent.update(dt);
              if (this.physics.checkOverlap(this.player, ent)) {
                this.triggerVictory();
              }
            }
          }

          if (this.player.y > 1000) {
            sounds.playHurt();
            this.resetPlaySession();
          }

          this.camera.follow(this.player, dt);
        } else {
          const viewLeft = this.camera.x - 160;
          const viewRight = this.camera.x + this.canvas.width + 160;
          for (const ent of this.entities) {
            if (!ent.active || ent.x + ent.width < viewLeft || ent.x > viewRight) continue;
            if (ent.update && (ent.type === 'springboard' || ent.type === 'collectible' || ent.type === 'goal' || ent.bumpTimer > 0)) {
              ent.update(dt);
            }
          }
        }

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

      render() {
        this.updateCanvasDimensions();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        SolidBlock.updateTerrainMap(this.entities);
        this.renderBackground();

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
            ent.draw(this.ctx);
          }

          for (const b of this.bullets) {
            b.draw(this.ctx);
          }

          this.player.draw(this.ctx);
        } finally {
          this.ctx.restore();
        }

        this.drawPlayHUD();

        if (this.confetti.length > 0) {
          this.ctx.save();
          for (const p of this.confetti) {
            this.ctx.save();
            const drawX = p.isScreen ? p.x : (p.x - this.camera.x);
            const drawY = p.isScreen ? p.y : (p.y - this.camera.y);
            this.ctx.translate(drawX, drawY);
            this.ctx.rotate(p.rotation);
            if (p.char) {
              this.ctx.font = 'bold ' + Math.round(p.size) + 'px "Fredoka", sans-serif';
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
      }

      drawPlayHUD() {
        this.ctx.save();
        const hudW = 270;
        const hudH = 50;
        const hudX = 20;
        const hudY = 20;

        this.ctx.fillStyle = '#121212';
        this.ctx.beginPath();
        this.ctx.roundRect(hudX + 4, hudY + 4, hudW, hudH, 12);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#121212';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.roundRect(hudX, hudY, hudW, hudH, 12);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.font = '700 11px "Fredoka", sans-serif';
        this.ctx.fillStyle = '#777777';
        this.ctx.fillText('SCORE', hudX + 16, hudY + 19);

        this.ctx.font = '900 18px "Fredoka", sans-serif';
        this.ctx.fillStyle = '#121212';
        this.ctx.fillText(String(this.score), hudX + 16, hudY + 39);

        this.ctx.strokeStyle = '#E0E0E0';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(hudX + 88, hudY + 10);
        this.ctx.lineTo(hudX + 88, hudY + 40);
        this.ctx.stroke();

        const heartStartX = hudX + 112;
        const heartY = hudY + 25;
        const heartSpacing = 36;
        const maxH = this.player.maxHearts || 4;
        const currentH = this.player.hearts;

        for (let i = 0; i < maxH; i++) {
          this.drawHeartIcon(heartStartX + i * heartSpacing, heartY, i < currentH, currentH === 1);
        }

        if (this.player.hasPistol && this.player.ammo > 0) {
          const ammoX = hudX + hudW + 12;
          const ammoY = hudY;
          const ammoW = 145;
          const ammoH = hudH;

          this.ctx.fillStyle = '#121212';
          this.ctx.beginPath();
          this.ctx.roundRect(ammoX + 4, ammoY + 4, ammoW, ammoH, 12);
          this.ctx.fill();

          this.ctx.fillStyle = '#FFEE58';
          this.ctx.strokeStyle = '#121212';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.roundRect(ammoX, ammoY, ammoW, ammoH, 12);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.font = '700 11px "Fredoka", sans-serif';
          this.ctx.fillStyle = '#777777';
          this.ctx.fillText('AMMO', ammoX + 16, ammoY + 19);

          this.ctx.font = '900 16px "Fredoka", sans-serif';
          this.ctx.fillStyle = '#121212';
          this.ctx.fillText(this.player.ammo + ' ROUNDS', ammoX + 16, ammoY + 39);
        }
        this.ctx.restore();
      }

      drawHeartIcon(cx, cy, isFilled, isLowHealth = false) {
        this.ctx.save();
        this.ctx.translate(cx, cy);
        if (isFilled && isLowHealth) {
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
          this.ctx.fillStyle = '#FF2D55';
          this.ctx.fill();
          this.ctx.strokeStyle = '#121212';
          this.ctx.lineWidth = 2.5;
          this.ctx.stroke();
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          this.ctx.beginPath();
          this.ctx.arc(-4, -3, 2.2, 0, Math.PI * 2);
          this.ctx.fill();
        } else {
          this.ctx.fillStyle = 'rgba(230, 230, 230, 0.7)';
          this.ctx.fill();
          this.ctx.strokeStyle = '#A0A0A0';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      gameLoop(currentTime) {
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        try {
          this.update(dt);
        } catch (err) {
          console.error('Update error:', err);
        }
        try {
          this.render();
        } catch (err) {
          console.error('Render error:', err);
        }
        requestAnimationFrame((t) => this.gameLoop(t));
      }
    }

    ${exactBgOverrides}

    const rawJson = document.getElementById('embedded-level-data').textContent;
    const pkgData = JSON.parse(rawJson);
    window.sidehop = new StandaloneSidehopApp(pkgData);
  <\/script>
</body>
</html>`;
}

if (typeof window !== 'undefined') {
  window.generateStandaloneGameHtml = generateStandaloneGameHtml;
}
