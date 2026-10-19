// Sidehop Level Persistence & Preset Levels Engine

import { SolidBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';
import { SidehopFile } from './sidehop-format.js';
import { PersonalAssetLibrary } from './asset-library.js';

const STORAGE_KEY = 'sidehop_saved_level_v4';

export class LevelStorage {
  // Serialize active level to JSON-compatible object
  static serialize(player, entities, background = { theme: 'sky', customImage: null }) {
    return {
      version: 2,
      name: 'My Sidehop Level',
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
        ent = new SolidBlock(d.x, d.y, d.width, d.height, d.variant || 'solid');
        if (d.bounciness !== undefined) ent.bounciness = d.bounciness;
        if (d.friction !== undefined) ent.friction = d.friction;
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

    return data.background || { theme: 'sky', customImage: null };
  }

  // LocalStorage Auto-save
  static autoSave(player, entities, background) {
    try {
      const data = this.serialize(player, entities, background);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // LocalStorage Auto-load
  static autoLoad(player, entities) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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

  // Import any .sidehop package (or legacy JSON level)
  static importLevel(file, player, entities, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = SidehopFile.parse(e.target.result);

        if (parsed.kind === 'level') {
          const bg = this.deserialize(parsed.level, player, entities);
          if (callback) {
            callback({
              kind: 'level',
              background: bg,
              meta: parsed.meta,
              levelName: parsed.meta?.title || parsed.level?.name || 'Sidehop Level'
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
        }
      } catch (err) {
        console.error('Sidehop file import error:', err);
        alert('Invalid Sidehop file (.sidehop or .json): ' + (err.message || 'Parse error'));
      }
    };
    reader.readAsText(file);
  }

  // Default Preset 1: World 1-1 "Sidehop Meadow (Expanded Edition)"
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
    // SECTION 1: RUNWAY, MYSTERY BLOCKS & FIRST POTATO (x: 0 -> 480)
    // -------------------------------------------------------------
    addGround(0, 480, 480, 'solid');

    // Overhead Mario-style Mystery & Solid Blocks
    entities.push(new SolidBlock(200, 320, T, T, 'solid'));
    entities.push(new SolidBlock(240, 320, T, T, 'mystery')); // Bumpable [?]
    entities.push(new SolidBlock(280, 320, T, T, 'solid'));
    entities.push(new SolidBlock(320, 320, T, T, 'mystery')); // Bumpable [?]
    entities.push(new SolidBlock(360, 320, T, T, 'solid'));

    // Coins under & above blocks
    entities.push(new Collectible(244, 270, 32, 32, 'coin'));
    entities.push(new Collectible(324, 270, 32, 32, 'coin'));

    // Patrolling Potato Walker
    const enemy1 = new EnemyWalker(380, 440, T, T, 'walker');
    enemy1.patrolRange = 90;
    entities.push(enemy1);

    // -------------------------------------------------------------
    // SECTION 2: SMOOTH SLOPES & WARP PIPE PLATEAU (x: 480 -> 960)
    // -------------------------------------------------------------
    // Incline hill slant (surface rises smoothly from 480 to 440)
    entities.push(new SolidBlock(480, 440, T, T, 'slope_up'));
    entities.push(new SolidBlock(480, 480, T, T, 'solid'));
    entities.push(new SolidBlock(480, 520, T, T, 'solid'));

    // Elevated Plateau (y: 440)
    for (let x = 520; x < 760; x += T) {
      entities.push(new SolidBlock(x, 440, T, T, 'solid'));
      entities.push(new SolidBlock(x, 480, T, T, 'solid'));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Iconic Tall Warp Pipe (40x80) on the plateau
    entities.push(new SolidBlock(600, 360, 40, 80, 'pipe'));
    entities.push(new Collectible(604, 310, 32, 32, 'coin'));

    // Winged Hopper on the elevated ground
    const enemy2 = new EnemyWalker(680, 400, T, T, 'winged');
    enemy2.patrolRange = 60;
    entities.push(enemy2);

    // Decline hill slant (surface descends smoothly from 440 to 480)
    entities.push(new SolidBlock(760, 440, T, T, 'slope_down'));
    entities.push(new SolidBlock(760, 480, T, T, 'solid'));
    entities.push(new SolidBlock(760, 520, T, T, 'solid'));

    // Valley ground
    addGround(800, 960, 480, 'solid');
    entities.push(new Collectible(844, 430, 32, 32, 'coin'));
    entities.push(new Collectible(904, 430, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 3: NOTE BLOCK, HALF SLABS & SKY CLOUD ISLAND (x: 960 -> 1400)
    // -------------------------------------------------------------
    // Spike Pit with solid foundation floor (x: 960 -> 1200)
    for (let x = 960; x < 1200; x += T) {
      entities.push(new HazardSpikes(x, 480, T, T));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Musical Note Block super trampoline right at edge of the pit (resting on ground at 480)
    entities.push(new SolidBlock(920, 440, T, T, 'note'));

    // Stepping Half Slabs over the hazard
    entities.push(new SolidBlock(1020, 420, 40, 20, 'slab'));
    entities.push(new Collectible(1024, 370, 32, 32, 'coin'));

    entities.push(new SolidBlock(1120, 420, 40, 20, 'slab'));
    entities.push(new Collectible(1124, 370, 32, 32, 'coin'));

    // High Sky Cloud Island (accessible via Note Block bounce!)
    for (let x = 1000; x <= 1160; x += T) {
      entities.push(new SolidBlock(x, 220, T, T, 'cloud'));
    }
    // Secret 500-pt Star Gem on the cloud!
    entities.push(new Collectible(1080, 170, 32, 32, 'star'));

    // Landing Ground
    addGround(1200, 1400, 480, 'solid');
    entities.push(new Collectible(1264, 430, 32, 32, 'coin'));
    entities.push(new Collectible(1324, 430, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 4: DONUT LIFT BRIDGE & SLIPPERY ICE CAVERN (x: 1400 -> 1920)
    // -------------------------------------------------------------
    // Donut Lift Bridge with middle resting stone pier over chasm
    entities.push(new SolidBlock(1400, 480, T, T, 'donut'));
    entities.push(new Collectible(1404, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1440, 480, T, T, 'donut'));
    entities.push(new Collectible(1444, 430, 32, 32, 'coin'));

    // Solid resting stone pier
    entities.push(new SolidBlock(1480, 480, T, T, 'stone'));
    entities.push(new SolidBlock(1480, 520, T, T, 'stone'));

    entities.push(new SolidBlock(1520, 480, T, T, 'donut'));
    entities.push(new Collectible(1524, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1560, 480, T, T, 'donut'));
    entities.push(new Collectible(1564, 430, 32, 32, 'coin'));

    // Slippery Ice Plateau (x: 1600 -> 1920)
    for (let x = 1600; x < 1920; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'ice'));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Armored Spiky Enemy on the ice (Cannot stomp!)
    const enemy3 = new EnemyWalker(1740, 440, T, T, 'spiky');
    enemy3.patrolRange = 60;
    entities.push(enemy3);

    // Heart Health Pickup floating above the ice
    entities.push(new Collectible(1744, 400, 32, 32, 'heart'));

    // Upper Bypass Route: Cloud & Mystery Block bridge (y: 340)
    entities.push(new SolidBlock(1660, 340, T, T, 'mystery'));
    entities.push(new SolidBlock(1700, 340, T, T, 'cloud'));
    entities.push(new SolidBlock(1740, 340, T, T, 'cloud'));
    entities.push(new SolidBlock(1780, 340, T, T, 'mystery'));
    entities.push(new Collectible(1704, 290, 32, 32, 'coin'));
    entities.push(new Collectible(1744, 290, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 5: DUAL MOVING PLATFORMS & SEMISOLID LEDGE (x: 1920 -> 2400)
    // -------------------------------------------------------------
    // Deep Chasm (x: 1920 -> 2400)
    // Vertical moving elevator platform (cycles smoothly between y: 335 and 445)
    const vertPlat = new MovingPlatform(1960, 390, 80, 24);
    vertPlat.axis = 'vertical';
    vertPlat.distance = 55;
    vertPlat.speed = 50;
    entities.push(vertPlat);

    // High Semisolid Platform in the middle (jump through from below)
    entities.push(new SolidBlock(2080, 320, T, T, 'semisolid'));
    entities.push(new SolidBlock(2120, 320, T, T, 'semisolid'));
    entities.push(new SolidBlock(2160, 320, T, T, 'semisolid'));
    entities.push(new Collectible(2124, 270, 32, 32, 'star')); // Hidden Star!

    // Horizontal moving ferry platform (cycles smoothly between x: 2190 and 2330 at y: 420)
    const horizPlat = new MovingPlatform(2260, 420, 80, 24);
    horizPlat.axis = 'horizontal';
    horizPlat.distance = 70;
    horizPlat.speed = 60;
    entities.push(horizPlat);

    // -------------------------------------------------------------
    // SECTION 6: CASTLE STONE FORTRESS & MEGA TRAMPOLINE (x: 2400 -> 2940)
    // -------------------------------------------------------------
    // Castle Stone Fortress Base
    for (let x = 2400; x < 2740; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'stone'));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // Standard Springboard
    entities.push(new Springboard(2440, 440, T, T, 'spring'));

    // 2x2 Mega Blocks (80x80) forming fortress tower
    entities.push(new SolidBlock(2520, 400, 80, 80, 'mega'));
    entities.push(new Collectible(2544, 340, 32, 32, 'coin'));

    // Warp Pipe on fortress
    entities.push(new SolidBlock(2640, 400, 40, 80, 'pipe'));
    entities.push(new Collectible(2644, 350, 32, 32, 'coin'));

    // Mega Trampoline launcher: calibrated to sail player comfortably onto the Grand Staircase
    entities.push(new Springboard(2700, 440, T, T, 'mega'));

    // Final Moat filled with Hazards (x: 2740 -> 2940)
    for (let x = 2740; x < 2940; x += T) {
      entities.push(new HazardSpikes(x, 480, T, T));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // -------------------------------------------------------------
    // SECTION 7: GRAND STAIRCASE & VICTORY FLAG (x: 2940 -> 3500)
    // -------------------------------------------------------------
    // Ascending Staircase Base
    addGround(2940, 3140, 480, 'stone');

    // Column 1
    entities.push(new SolidBlock(2980, 440, T, T, 'stone'));
    // Column 2
    entities.push(new SolidBlock(3020, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3020, 400, T, T, 'stone'));
    // Column 3
    entities.push(new SolidBlock(3060, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3060, 400, T, T, 'stone'));
    entities.push(new SolidBlock(3060, 360, T, T, 'stone'));
    // Column 4 (Peak)
    entities.push(new SolidBlock(3100, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3100, 400, T, T, 'stone'));
    entities.push(new SolidBlock(3100, 360, T, T, 'stone'));
    entities.push(new SolidBlock(3100, 320, T, T, 'stone'));
    entities.push(new Collectible(3104, 270, 32, 32, 'coin'));

    // Victory Courtyard
    addGround(3140, 3480, 480, 'stone');

    // The Goal Flag!
    entities.push(new GoalFlag(3340, 400, 48, 80));
    // High Star above the flag
    entities.push(new Collectible(3348, 330, 32, 32, 'star'));

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
