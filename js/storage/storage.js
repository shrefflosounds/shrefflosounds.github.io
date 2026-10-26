// Sidehop Level Persistence & Preset Levels Engine

import { SolidBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';
import { SidehopFile } from './sidehop-format.js';
import { PersonalAssetLibrary } from './asset-library.js';

const LEVEL_STORAGE_KEY = 'sidehop_saved_level_v6';

export class LevelStorage {
  // Serialize active level to JSON-compatible object
  static serialize(player, entities, background = { theme: 'sky', customImage: null }) {
    const activeTheme = (typeof window !== 'undefined' && window.sidehop?.currentTheme) || 'grass';
    return {
      version: 2,
      name: 'My Sidehop Level',
      theme: activeTheme,
      background: background,
      player: {
        spawnX: player.spawnX,
        spawnY: player.spawnY,
        speed: player.speed,
        jumpForce: player.jumpForce,
        gravityScale: player.gravityScale,
        maxHearts: player.maxHearts || 4,
        doubleJumpAllowed: player.doubleJumpAllowed,
        customVisual: player.customVisual
      },
      entities: entities.map(ent => LevelStorage.serializeEntity(ent))
    };
  }

  // Serialize single entity to JSON-friendly descriptor
  static serializeEntity(ent) {
    if (!ent) return null;
    return {
      type: ent.type,
      variant: ent.variant,
      content: ent.content || null,
      x: ent.x,
      y: ent.y,
      width: ent.width,
      height: ent.height,
      customVisual: ent.customVisual || null,
      bounciness: ent.bounciness,
      friction: ent.friction,
      launchForce: ent.launchForce,
      speed: ent.speed,
      patrolRange: ent.patrolRange,
      stompable: ent.stompable,
      distance: ent.distance,
      axis: ent.axis
    };
  }

  // Create single entity instance from descriptor
  static createEntityFromData(d) {
    if (!d || !d.type) return null;
    let ent = null;
    switch (d.type) {
      case 'crate':
      case 'block':
        ent = new SolidBlock(d.x, d.y, d.width, d.height, d.variant || 'solid', d.content || null);
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

    if (ent && d.customVisual) {
      ent.setCustomVisual(d.customVisual);
    }
    return ent;
  }

  // Clone an entity with an optional new coordinate
  static cloneEntity(ent, targetX, targetY) {
    if (!ent) return null;
    const data = this.serializeEntity(ent);
    if (targetX !== undefined) data.x = targetX;
    if (targetY !== undefined) data.y = targetY;
    return this.createEntityFromData(data);
  }

  // Restore entities from data object
  static deserialize(data, player, entities) {
    if (!data) return null;

    // Restore player
    if (data.player) {
      player.setSpawn(data.player.spawnX || 120, data.player.spawnY || 360);
      if (data.player.speed) player.speed = data.player.speed;
      if (data.player.jumpForce) player.jumpForce = data.player.jumpForce;
      if (data.player.gravityScale !== undefined) player.gravityScale = data.player.gravityScale;
      if (data.player.maxHearts !== undefined) {
        player.maxHearts = data.player.maxHearts;
        player.hearts = player.maxHearts;
      }
      if (data.player.doubleJumpAllowed !== undefined) {
        player.doubleJumpAllowed = data.player.doubleJumpAllowed;
        player.hasDoubleJump = data.player.doubleJumpAllowed;
      }
      if (data.player.customVisual) player.setCustomVisual(data.player.customVisual);
    }

    // Clear and restore entities
    entities.length = 0;
    if (Array.isArray(data.entities)) {
      data.entities.forEach(d => {
        const ent = LevelStorage.createEntityFromData(d);
        if (ent) entities.push(ent);
      });
    }

    const bg = data.background || { theme: 'sky', customImage: null };
    if (data.theme) {
      bg.worldTheme = data.theme;
      if (typeof window !== 'undefined' && window.sidehop && window.sidehop.setTheme) {
        window.sidehop.setTheme(data.theme);
      }
    }
    return bg;
  }

  // LocalStorage Auto-save
  static autoSave(player, entities, background) {
    // Never overwrite user's work while built-in interactive demo is running
    if (typeof window !== 'undefined' && window.sidehop && window.sidehop.isDemoActive) {
      return;
    }
    try {
      const data = this.serialize(player, entities, background);
      localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // LocalStorage Auto-load
  static autoLoad(player, entities) {
    try {
      const raw = localStorage.getItem(LEVEL_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return this.deserialize(data, player, entities);
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
    return null;
  }

  // Download Level as .sidehop package file
  static exportLevel(player, entities, background, customTitle) {
    const data = this.serialize(player, entities, background);
    const title = customTitle || data.name || 'Sidehop Level';
    const pkg = SidehopFile.createLevelPackage(data, {
      title: title,
      description: 'Platformer level created with Sidehop'
    });
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sidehop-level';
    SidehopFile.download(`${slug}-${Date.now()}.sidehop`, pkg);
    return pkg;
  }

  // Export Level as a Standalone Playable Single-File HTML Game
  static async exportStandaloneHtml(player, entities, background, theme = 'grass', customTitle) {
    const data = this.serialize(player, entities, background);
    data.theme = theme;
    const title = customTitle || data.name || 'Sidehop Level';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sidehop-game';

    let htmlTemplate = '';
    try {
      const resp = await fetch('index.standalone.html');
      if (resp.ok) {
        htmlTemplate = await resp.text();
      }
    } catch (_) {}

    if (!htmlTemplate) {
      try {
        const resp2 = await fetch('index.html');
        if (resp2.ok) {
          htmlTemplate = await resp2.text();
        }
      } catch (_) {}
    }

    if (!htmlTemplate) {
      alert('Could not fetch standalone HTML template. Exporting as .sidehop package instead.');
      this.exportLevel(player, entities, background, customTitle);
      return;
    }

    // Embed level payload with autoPlay flag so it plays immediately on open
    const payload = JSON.stringify({
      version: 2,
      levelName: title,
      theme: theme,
      autoPlay: true,
      level: data
    });

    const scriptTag = `<script id="sidehop-embedded-level" type="application/json">\n${payload}\n</script>`;

    let resultHtml = htmlTemplate.replace(/<title>.*?<\/title>/i, `<title>${title} — Sidehop Game</title>`);

    if (resultHtml.includes('<!-- EMBEDDED_LEVEL_HOOK -->')) {
      resultHtml = resultHtml.replace('<!-- EMBEDDED_LEVEL_HOOK -->', scriptTag);
    } else {
      resultHtml = resultHtml.replace('</body>', `${scriptTag}\n</body>`);
    }

    const blob = new Blob([resultHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // Import any .sidehop package (or legacy JSON level)
  static importLevel(file, player, entities, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = SidehopFile.parse(e.target.result);

        if (parsed.kind === 'level' || parsed.level) {
          const levelData = parsed.level || parsed;
          const bg = this.deserialize(levelData, player, entities);
          if (callback) {
            callback({
              kind: 'level',
              background: bg,
              meta: parsed.meta,
              levelName: parsed.meta?.title || levelData?.name || 'Sidehop Level'
            });
          }
        } else if (parsed.kind === 'asset') {
          // Save to Personal Assets library
          const saved = PersonalAssetLibrary.save(parsed.asset);
          if (callback) {
            callback({
              kind: 'asset',
              asset: saved,
              meta: parsed.meta
            });
          }
        } else if (parsed.kind === 'bundle') {
          // Save all bundled assets
          let savedAssets = [];
          if (Array.isArray(parsed.assets)) {
            savedAssets = parsed.assets.map(a => PersonalAssetLibrary.save(a));
          }
          let bg = null;
          if (parsed.level) {
            bg = this.deserialize(parsed.level, player, entities);
          }
          if (callback) {
            callback({
              kind: 'bundle',
              background: bg,
              level: parsed.level,
              assets: savedAssets,
              meta: parsed.meta
            });
          }
        } else {
          alert('This file does not contain a Sidehop level or asset.');
        }
      } catch (err) {
        console.error('Sidehop file import error:', err);
        alert('Invalid Sidehop file (.sidehop or .json): ' + (err.message || 'Parse error'));
      }
    };
    reader.readAsText(file);
  }

  // Default Preset 1: World 1-1 "Sidehop Meadow (Grand Expanded Edition)"
  static getStarterWorld() {
    const entities = [];
    const T = 40;

    // Helper: Add double-layer solid ground strip
    const addGround = (startX, endX, topY = 480, variant = 'solid') => {
      for (let x = startX; x < endX; x += T) {
        entities.push(new SolidBlock(x, topY, T, T, variant));
        entities.push(new SolidBlock(x, topY + T, T, T, variant));
      }
    };

    // -------------------------------------------------------------
    // SECTION 1: TUTORIAL RUNWAY & MYSTERY BLOCKS (x: 0 -> 480)
    // -------------------------------------------------------------
    addGround(0, 480, 480, 'solid');

    // Overhead Mario-style Mystery & Solid Blocks
    entities.push(new SolidBlock(200, 320, T, T, 'solid'));
    // Question block [?] containing the Pistol Gun Powerup!
    entities.push(new SolidBlock(240, 320, T, T, 'mystery', 'powerup'));
    entities.push(new SolidBlock(280, 320, T, T, 'solid'));
    // Question block [?] containing Coin!
    entities.push(new SolidBlock(320, 320, T, T, 'mystery', 'coin'));
    entities.push(new SolidBlock(360, 320, T, T, 'solid'));

    // Coins under and above blocks
    entities.push(new Collectible(244, 430, 32, 32, 'coin'));
    entities.push(new Collectible(324, 430, 32, 32, 'coin'));

    // Patrolling Potato Walker (Shoot with Pistol or Stomp!)
    const enemy1 = new EnemyWalker(380, 440, T, T, 'walker');
    enemy1.patrolRange = 90;
    entities.push(enemy1);

    // -------------------------------------------------------------
    // SECTION 2: SMOOTH SLOPES & WARP PIPE PLATEAU (x: 480 -> 1000)
    // -------------------------------------------------------------
    // Incline hill slant (surface rises smoothly from 480 to 440)
    entities.push(new SolidBlock(480, 440, T, T, 'slope_up'));
    entities.push(new SolidBlock(480, 480, T, T, 'solid'));
    entities.push(new SolidBlock(480, 520, T, T, 'solid'));

    // Elevated Plateau (y: 440)
    for (let x = 520; x < 800; x += T) {
      entities.push(new SolidBlock(x, 440, T, T, 'solid'));
      entities.push(new SolidBlock(x, 480, T, T, 'solid'));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Mystery Block with Health Heart on the plateau!
    entities.push(new SolidBlock(560, 320, T, T, 'mystery', 'heart'));

    // Iconic Tall Warp Pipe (40x80) on the plateau
    entities.push(new SolidBlock(640, 360, 40, 80, 'pipe'));
    entities.push(new Collectible(644, 310, 32, 32, 'coin'));

    // Winged Hopper on the elevated ground
    const enemy2 = new EnemyWalker(720, 400, T, T, 'winged');
    enemy2.patrolRange = 60;
    entities.push(enemy2);

    // Decline hill slant (surface descends smoothly from 440 to 480)
    entities.push(new SolidBlock(800, 440, T, T, 'slope_down'));
    entities.push(new SolidBlock(800, 480, T, T, 'solid'));
    entities.push(new SolidBlock(800, 520, T, T, 'solid'));

    // Valley ground
    addGround(840, 1000, 480, 'solid');
    entities.push(new Collectible(884, 430, 32, 32, 'coin'));
    entities.push(new Collectible(944, 430, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 3: NOTE BLOCK, HALF SLABS & SKY CLOUD ISLAND (x: 1000 -> 1520)
    // -------------------------------------------------------------
    // Spike Pit with solid foundation floor (x: 1040 -> 1280)
    for (let x = 1040; x < 1280; x += T) {
      entities.push(new HazardSpikes(x, 480, T, T));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Musical Note Block super trampoline right at edge of the pit (resting on ground at 480)
    entities.push(new SolidBlock(1000, 440, T, T, 'note'));

    // Stepping Half Slabs over the hazard
    entities.push(new SolidBlock(1100, 420, 40, 20, 'slab'));
    entities.push(new Collectible(1104, 370, 32, 32, 'coin'));

    entities.push(new SolidBlock(1200, 420, 40, 20, 'slab'));
    entities.push(new Collectible(1204, 370, 32, 32, 'coin'));

    // High Sky Cloud Island (accessible via Note Block bounce!)
    for (let x = 1080; x <= 1280; x += T) {
      entities.push(new SolidBlock(x, 220, T, T, 'cloud'));
    }
    // Secret 500-pt Star Gem on the cloud!
    entities.push(new Collectible(1160, 170, 32, 32, 'star'));

    // Landing Ground
    addGround(1280, 1520, 480, 'solid');
    const enemy3 = new EnemyWalker(1360, 440, T, T, 'walker');
    enemy3.patrolRange = 70;
    entities.push(enemy3);
    entities.push(new Collectible(1444, 430, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 4: DONUT BRIDGE & SLIPPERY ICE CHASM (x: 1520 -> 2160)
    // -------------------------------------------------------------
    // Donut Lift Bridge with middle resting stone pier over chasm
    entities.push(new SolidBlock(1520, 480, T, T, 'donut'));
    entities.push(new Collectible(1524, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1560, 480, T, T, 'donut'));
    entities.push(new Collectible(1564, 430, 32, 32, 'coin'));

    // Solid resting stone pier
    entities.push(new SolidBlock(1600, 480, T, T, 'stone'));
    entities.push(new SolidBlock(1600, 520, T, T, 'stone'));

    entities.push(new SolidBlock(1640, 480, T, T, 'donut'));
    entities.push(new Collectible(1644, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1680, 480, T, T, 'donut'));
    entities.push(new Collectible(1684, 430, 32, 32, 'coin'));

    // Slippery Ice Plateau (x: 1720 -> 2160)
    for (let x = 1720; x < 2160; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'ice'));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Armored Spiky Enemy on the ice (Cannot stomp! Must shoot with gun or leap over!)
    const enemySpiky1 = new EnemyWalker(1880, 440, T, T, 'spiky');
    enemySpiky1.patrolRange = 70;
    entities.push(enemySpiky1);

    // Upper Bypass Route: Cloud & Mystery Block bridge (y: 340)
    // If the player already picked up the gun, this mystery block dispenses AMMUNITION!
    entities.push(new SolidBlock(1800, 340, T, T, 'mystery', 'powerup'));
    entities.push(new SolidBlock(1840, 340, T, T, 'cloud'));
    entities.push(new SolidBlock(1880, 340, T, T, 'cloud'));
    entities.push(new SolidBlock(1920, 340, T, T, 'mystery', 'coin'));
    entities.push(new Collectible(1844, 290, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 5: DUAL MOVING LIFTS ACROSS THE ABYSS (x: 2160 -> 2840)
    // -------------------------------------------------------------
    // Deep Chasm (x: 2160 -> 2840)
    // Vertical moving elevator platform (cycles smoothly between y: 335 and 445)
    const vertPlat = new MovingPlatform(2220, 390, 80, 24);
    vertPlat.axis = 'vertical';
    vertPlat.distance = 55;
    vertPlat.speed = 50;
    entities.push(vertPlat);

    // High Semisolid Platform in the middle (jump through from below)
    entities.push(new SolidBlock(2360, 320, T, T, 'semisolid'));
    entities.push(new SolidBlock(2400, 320, T, T, 'semisolid'));
    entities.push(new SolidBlock(2440, 320, T, T, 'semisolid'));
    entities.push(new Collectible(2404, 270, 32, 32, 'star')); // Hidden Star!

    // Winged Hopper airborne over the abyss
    const enemyWinged2 = new EnemyWalker(2400, 240, T, T, 'winged');
    enemyWinged2.patrolRange = 50;
    entities.push(enemyWinged2);

    // Horizontal moving ferry platform (cycles smoothly between x: 2510 and 2650 at y: 420)
    const horizPlat = new MovingPlatform(2580, 420, 80, 24);
    horizPlat.axis = 'horizontal';
    horizPlat.distance = 70;
    horizPlat.speed = 60;
    entities.push(horizPlat);

    // Landing Fortress Pier (x: 2700 -> 2840)
    for (let x = 2700; x < 2840; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'stone'));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // -------------------------------------------------------------
    // SECTION 6: CITADEL GATEWAY & MEGA TRAMPOLINE (x: 2840 -> 3520)
    // -------------------------------------------------------------
    for (let x = 2840; x < 3320; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'stone'));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // Mystery Block with Heart (health restore)
    entities.push(new SolidBlock(2920, 340, T, T, 'mystery', 'heart'));

    // 2x2 Mega Blocks forming fortress tower
    entities.push(new SolidBlock(3000, 400, 80, 80, 'mega'));
    entities.push(new Collectible(3024, 340, 32, 32, 'coin'));

    // Warp Pipe on fortress
    entities.push(new SolidBlock(3140, 400, 40, 80, 'pipe'));
    entities.push(new Collectible(3144, 350, 32, 32, 'coin'));

    // Armored Guard patrolling
    const enemySpiky2 = new EnemyWalker(3220, 440, T, T, 'spiky');
    enemySpiky2.patrolRange = 40;
    entities.push(enemySpiky2);

    // Mega Trampoline launcher: launches player high over the moat
    entities.push(new Springboard(3280, 440, T, T, 'mega'));

    // Spiked Moat (x: 3320 -> 3520)
    for (let x = 3320; x < 3520; x += T) {
      entities.push(new HazardSpikes(x, 480, T, T));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // -------------------------------------------------------------
    // SECTION 7: THE TWIN PEAKS & CANYON CROSSING (x: 3520 -> 4320)
    // -------------------------------------------------------------
    // Peak 1 Incline (rises from 480 to 400)
    entities.push(new SolidBlock(3520, 440, T, T, 'slope_up'));
    entities.push(new SolidBlock(3520, 480, T, T, 'stone'));
    entities.push(new SolidBlock(3520, 520, T, T, 'stone'));
    entities.push(new SolidBlock(3560, 400, T, T, 'slope_up'));
    entities.push(new SolidBlock(3560, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3560, 480, T, T, 'stone'));
    entities.push(new SolidBlock(3560, 520, T, T, 'stone'));

    // Peak 1 Crest (y: 400)
    entities.push(new SolidBlock(3600, 400, T, T, 'stone'));
    entities.push(new SolidBlock(3600, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3600, 480, T, T, 'stone'));
    entities.push(new SolidBlock(3600, 520, T, T, 'stone'));

    // High Mystery Block over Peak 1 (Sprouts Ammunition refill!)
    entities.push(new SolidBlock(3600, 280, T, T, 'mystery', 'powerup'));

    // Canyon Gap with Falling Donut Lifts & Moving Platform
    entities.push(new SolidBlock(3680, 420, T, T, 'donut'));
    entities.push(new Collectible(3684, 370, 32, 32, 'coin'));

    // Fast Vertical Ferry across the canyon
    const canyonPlat = new MovingPlatform(3780, 380, 80, 24);
    canyonPlat.axis = 'vertical';
    canyonPlat.distance = 60;
    canyonPlat.speed = 65;
    entities.push(canyonPlat);

    // Winged Hopper guarding the gap
    const enemyWinged3 = new EnemyWalker(3780, 240, T, T, 'winged');
    enemyWinged3.patrolRange = 60;
    entities.push(enemyWinged3);

    entities.push(new SolidBlock(3900, 420, T, T, 'donut'));
    entities.push(new Collectible(3904, 370, 32, 32, 'coin'));

    // Peak 2 Crest & Decline (x: 3960 -> 4320)
    for (let x = 3960; x < 4120; x += T) {
      entities.push(new SolidBlock(x, 400, T, T, 'stone'));
      entities.push(new SolidBlock(x, 440, T, T, 'stone'));
      entities.push(new SolidBlock(x, 480, T, T, 'stone'));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }
    const enemyWalker2 = new EnemyWalker(4020, 360, T, T, 'walker');
    enemyWalker2.patrolRange = 50;
    entities.push(enemyWalker2);

    entities.push(new SolidBlock(4120, 400, T, T, 'slope_down'));
    entities.push(new SolidBlock(4120, 440, T, T, 'stone'));
    entities.push(new SolidBlock(4120, 480, T, T, 'stone'));
    entities.push(new SolidBlock(4120, 520, T, T, 'stone'));

    entities.push(new SolidBlock(4160, 440, T, T, 'slope_down'));
    entities.push(new SolidBlock(4160, 480, T, T, 'stone'));
    entities.push(new SolidBlock(4160, 520, T, T, 'stone'));

    addGround(4200, 4320, 480, 'solid');

    // -------------------------------------------------------------
    // SECTION 8: GLACIAL SLOPES & SPIKY GAUNTLET (x: 4320 -> 5120)
    // -------------------------------------------------------------
    // Slippery ice runway with slopes
    for (let x = 4320; x < 4880; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'ice'));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // High Semisolid Escape Route above the ice (y: 340)
    for (let x = 4440; x <= 4720; x += T) {
      entities.push(new SolidBlock(x, 340, T, T, 'semisolid'));
    }
    // Health Heart in mystery block on the upper route!
    entities.push(new SolidBlock(4560, 240, T, T, 'mystery', 'heart'));
    entities.push(new Collectible(4644, 290, 32, 32, 'coin'));

    // Spiky Gauntlet on the ice below (Use pistol or take upper route!)
    const enemySpiky3 = new EnemyWalker(4460, 440, T, T, 'spiky');
    enemySpiky3.patrolRange = 60;
    enemySpiky3.speed = 55;
    entities.push(enemySpiky3);

    const enemySpiky4 = new EnemyWalker(4680, 440, T, T, 'spiky');
    enemySpiky4.patrolRange = 60;
    enemySpiky4.speed = 60;
    entities.push(enemySpiky4);

    // Mystery Block dispensing Ammunition to reload pistol!
    entities.push(new SolidBlock(4800, 340, T, T, 'mystery', 'powerup'));

    addGround(4880, 5120, 480, 'solid');
    const enemyWalker3 = new EnemyWalker(4960, 440, T, T, 'walker');
    enemyWalker3.patrolRange = 70;
    entities.push(enemyWalker3);

    // -------------------------------------------------------------
    // SECTION 9: SKY ISLES & THE CLOUD EXPRESS (x: 5120 -> 5960)
    // -------------------------------------------------------------
    // Vast chasm with floating cloud formations & moving ferries
    for (let x = 5160; x <= 5320; x += T) {
      entities.push(new SolidBlock(x, 400, T, T, 'cloud'));
    }
    entities.push(new Collectible(5204, 350, 32, 32, 'coin'));
    entities.push(new Collectible(5284, 350, 32, 32, 'coin'));

    // High Musical Note Block for high sky access
    entities.push(new SolidBlock(5320, 360, T, T, 'note'));

    // Airborne Cloud Island (y: 220) with Star Gem!
    for (let x = 5280; x <= 5440; x += T) {
      entities.push(new SolidBlock(x, 220, T, T, 'cloud'));
    }
    entities.push(new Collectible(5364, 170, 32, 32, 'star'));

    // Horizontal Cloud Express Ferry platform
    const skyPlat = new MovingPlatform(5480, 380, 80, 24);
    skyPlat.axis = 'horizontal';
    skyPlat.distance = 80;
    skyPlat.speed = 70;
    entities.push(skyPlat);

    // Winged Hopper patrolling over the void
    const enemyWinged4 = new EnemyWalker(5480, 240, T, T, 'winged');
    enemyWinged4.patrolRange = 60;
    entities.push(enemyWinged4);

    // Second Cloud Island with Mystery Block [?] for Ammo
    for (let x = 5660; x <= 5820; x += T) {
      entities.push(new SolidBlock(x, 380, T, T, 'cloud'));
    }
    entities.push(new SolidBlock(5740, 260, T, T, 'mystery', 'powerup'));
    entities.push(new Collectible(5704, 330, 32, 32, 'coin'));

    // Donut stepping stones
    entities.push(new SolidBlock(5860, 420, T, T, 'donut'));
    entities.push(new SolidBlock(5900, 420, T, T, 'donut'));

    // -------------------------------------------------------------
    // SECTION 10: FORTRESS OF SPIKES & FINAL MOAT (x: 5960 -> 6640)
    // -------------------------------------------------------------
    // Castle Base
    for (let x = 5960; x < 6440; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'stone'));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // Fortress Watchtower with Mega Block and Pipe
    entities.push(new SolidBlock(6080, 400, 80, 80, 'mega'));
    entities.push(new SolidBlock(6200, 360, 40, 80, 'pipe'));

    // Final Health Heart & Coin Mystery Blocks
    entities.push(new SolidBlock(6080, 280, T, T, 'mystery', 'heart'));
    entities.push(new SolidBlock(6120, 280, T, T, 'mystery', 'coin'));

    // Patrolling Armored Spiky and Walker
    const enemySpiky5 = new EnemyWalker(6280, 440, T, T, 'spiky');
    enemySpiky5.patrolRange = 50;
    entities.push(enemySpiky5);

    // Final Mega Trampoline launching over the deep spiked moat!
    entities.push(new Springboard(6380, 440, T, T, 'mega'));

    // Giant Spiked Moat
    for (let x = 6440; x < 6640; x += T) {
      entities.push(new HazardSpikes(x, 480, T, T));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // -------------------------------------------------------------
    // SECTION 11: GRAND PYRAMID STAIRCASE & GOAL FLAG (x: 6640 -> 7300)
    // -------------------------------------------------------------
    // Ascending Staircase Base
    addGround(6640, 6880, 480, 'stone');

    // Column 1 (Height: 1 block, y: 440)
    entities.push(new SolidBlock(6680, 440, T, T, 'stone'));

    // Column 2 (Height: 2 blocks, y: 400)
    entities.push(new SolidBlock(6720, 440, T, T, 'stone'));
    entities.push(new SolidBlock(6720, 400, T, T, 'stone'));

    // Column 3 (Height: 3 blocks, y: 360)
    entities.push(new SolidBlock(6760, 440, T, T, 'stone'));
    entities.push(new SolidBlock(6760, 400, T, T, 'stone'));
    entities.push(new SolidBlock(6760, 360, T, T, 'stone'));

    // Column 4 (Height: 4 blocks, y: 320)
    entities.push(new SolidBlock(6800, 440, T, T, 'stone'));
    entities.push(new SolidBlock(6800, 400, T, T, 'stone'));
    entities.push(new SolidBlock(6800, 360, T, T, 'stone'));
    entities.push(new SolidBlock(6800, 320, T, T, 'stone'));

    // Column 5 (Apex / Height: 5 blocks, y: 280)
    entities.push(new SolidBlock(6840, 440, T, T, 'stone'));
    entities.push(new SolidBlock(6840, 400, T, T, 'stone'));
    entities.push(new SolidBlock(6840, 360, T, T, 'stone'));
    entities.push(new SolidBlock(6840, 320, T, T, 'stone'));
    entities.push(new SolidBlock(6840, 280, T, T, 'stone'));
    // Glowing Star Gem right above the peak!
    entities.push(new Collectible(6844, 230, 32, 32, 'star'));

    // Victory Courtyard Floor
    addGround(6880, 7280, 480, 'stone');

    // Triumphal Goal Finish Line Flag!
    entities.push(new GoalFlag(7100, 400, 48, 80));
    // High Star above the flag
    entities.push(new Collectible(7108, 330, 32, 32, 'star'));

    return {
      background: { theme: 'sky', customImage: null },
      playerSpawn: { x: 80, y: 400 },
      entities
    };
  }

  // Alias for backward compatibility
  static getPresetCrateChallenge() {
    return this.getStarterWorld();
  }
}
