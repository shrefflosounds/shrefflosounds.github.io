// Sidehop Level Persistence & Preset Levels Engine

import { SolidBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';

const STORAGE_KEY = 'sidehop_saved_level_v3';

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

  // Download JSON file
  static exportLevel(player, entities, background) {
    const data = this.serialize(player, entities, background);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sidehop-level-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Import JSON file
  static importLevel(file, player, entities, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const bg = this.deserialize(data, player, entities);
        if (callback) callback(bg);
      } catch (err) {
        alert('Invalid Sidehop level file.');
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
    // SECTION 2: SLOPES & WARP PIPE PLATEAU (x: 480 -> 960)
    // -------------------------------------------------------------
    // Incline hill slant
    entities.push(new SolidBlock(480, 480, T, T, 'slope_up'));
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
    enemy2.patrolRange = 80;
    entities.push(enemy2);

    // Decline hill slant
    entities.push(new SolidBlock(760, 480, T, T, 'slope_down'));
    entities.push(new SolidBlock(760, 520, T, T, 'solid'));

    // Valley ground
    addGround(800, 960, 480, 'solid');
    entities.push(new Collectible(844, 430, 32, 32, 'coin'));
    entities.push(new Collectible(904, 430, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 3: NOTE BLOCK, HALF SLABS & SKY CLOUD ISLAND (x: 960 -> 1440)
    // -------------------------------------------------------------
    // Spike Pit (x: 960 -> 1200)
    for (let x = 960; x < 1200; x += T) {
      entities.push(new HazardSpikes(x, 500, T, T));
    }

    // Musical Note Block trampoline right at edge of the pit
    entities.push(new SolidBlock(920, 440, T, T, 'note'));

    // Stepping Half Slabs over the hazard
    entities.push(new SolidBlock(1000, 440, 40, 20, 'slab'));
    entities.push(new Collectible(1004, 390, 32, 32, 'coin'));

    entities.push(new SolidBlock(1100, 420, 40, 20, 'slab'));
    entities.push(new Collectible(1104, 370, 32, 32, 'coin'));

    // High Sky Cloud Island (accessible via Note Block bounce!)
    entities.push(new SolidBlock(1000, 220, T, T, 'cloud'));
    entities.push(new SolidBlock(1040, 220, T, T, 'cloud'));
    entities.push(new SolidBlock(1080, 220, T, T, 'cloud'));
    entities.push(new SolidBlock(1120, 220, T, T, 'cloud'));
    // Secret 500-pt Star Gem on the cloud!
    entities.push(new Collectible(1064, 170, 32, 32, 'star'));

    // Landing Ground
    addGround(1200, 1400, 480, 'solid');
    entities.push(new Collectible(1284, 430, 32, 32, 'coin'));
    entities.push(new Collectible(1344, 430, 32, 32, 'coin'));

    // -------------------------------------------------------------
    // SECTION 4: DONUT LIFT BRIDGE & SLIPPERY ICE CAVERN (x: 1400 -> 1920)
    // -------------------------------------------------------------
    // Donut Lift Bridge over bottomless chasm (x: 1400 -> 1600)
    entities.push(new SolidBlock(1400, 480, T, T, 'donut'));
    entities.push(new Collectible(1404, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1440, 480, T, T, 'donut'));
    entities.push(new Collectible(1444, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1480, 480, T, T, 'donut'));
    entities.push(new Collectible(1484, 430, 32, 32, 'coin'));

    entities.push(new SolidBlock(1520, 480, T, T, 'donut'));
    entities.push(new Collectible(1524, 430, 32, 32, 'coin'));

    // Slippery Ice Plateau (x: 1600 -> 1880)
    for (let x = 1600; x < 1880; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'ice'));
      entities.push(new SolidBlock(x, 520, T, T, 'solid'));
    }

    // Armored Spiky Enemy on the ice (Cannot stomp!)
    const enemy3 = new EnemyWalker(1720, 440, T, T, 'spiky');
    enemy3.patrolRange = 90;
    entities.push(enemy3);

    // Heart Health Pickup floating above the ice
    entities.push(new Collectible(1724, 360, 32, 32, 'heart'));

    // -------------------------------------------------------------
    // SECTION 5: DUAL MOVING PLATFORMS & SEMISOLID LEDGE (x: 1880 -> 2400)
    // -------------------------------------------------------------
    // Massive Chasm (x: 1880 -> 2360)
    // Vertical moving elevator platform
    const vertPlat = new MovingPlatform(1920, 440, 80, 24);
    vertPlat.axis = 'vertical';
    vertPlat.distance = 110;
    vertPlat.speed = 60;
    entities.push(vertPlat);

    // High Semisolid Platform in the middle (jump through from below)
    entities.push(new SolidBlock(2060, 320, T, T, 'semisolid'));
    entities.push(new SolidBlock(2100, 320, T, T, 'semisolid'));
    entities.push(new SolidBlock(2140, 320, T, T, 'semisolid'));
    entities.push(new Collectible(2104, 270, 32, 32, 'star')); // Hidden Star!

    // Horizontal moving ferry platform
    const horizPlat = new MovingPlatform(2220, 440, 80, 24);
    horizPlat.axis = 'horizontal';
    horizPlat.distance = 100;
    horizPlat.speed = 70;
    entities.push(horizPlat);

    // -------------------------------------------------------------
    // SECTION 6: CASTLE STONE FORTRESS & MEGA TRAMPOLINE (x: 2360 -> 2840)
    // -------------------------------------------------------------
    // Castle Stone Fortress Base
    for (let x = 2360; x < 2720; x += T) {
      entities.push(new SolidBlock(x, 480, T, T, 'stone'));
      entities.push(new SolidBlock(x, 520, T, T, 'stone'));
    }

    // Standard Springboard
    entities.push(new Springboard(2400, 440, T, T, 'spring'));

    // 2x2 Mega Blocks (80x80) forming fortress towers
    entities.push(new SolidBlock(2480, 400, 80, 80, 'mega'));
    entities.push(new Collectible(2514, 340, 32, 32, 'coin'));

    // Warp Pipe on fortress
    entities.push(new SolidBlock(2600, 400, 40, 80, 'pipe'));
    entities.push(new Collectible(2604, 350, 32, 32, 'coin'));

    // Mega Trampoline launcher: shoots player soaring over the final moat!
    entities.push(new Springboard(2680, 440, T, T, 'mega'));

    // Final Moat filled with Hazards (x: 2720 -> 2920)
    for (let x = 2720; x < 2920; x += T) {
      entities.push(new HazardSpikes(x, 500, T, T));
    }

    // -------------------------------------------------------------
    // SECTION 7: GRAND STAIRCASE & VICTORY FLAG (x: 2920 -> 3480)
    // -------------------------------------------------------------
    // Ascending Staircase Base
    addGround(2920, 3120, 480, 'stone');

    // Column 1
    entities.push(new SolidBlock(2960, 440, T, T, 'stone'));
    // Column 2
    entities.push(new SolidBlock(3000, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3000, 400, T, T, 'stone'));
    // Column 3
    entities.push(new SolidBlock(3040, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3040, 400, T, T, 'stone'));
    entities.push(new SolidBlock(3040, 360, T, T, 'stone'));
    // Column 4 (Peak)
    entities.push(new SolidBlock(3080, 440, T, T, 'stone'));
    entities.push(new SolidBlock(3080, 400, T, T, 'stone'));
    entities.push(new SolidBlock(3080, 360, T, T, 'stone'));
    entities.push(new SolidBlock(3080, 320, T, T, 'stone'));
    entities.push(new Collectible(3084, 270, 32, 32, 'coin'));

    // Victory Courtyard
    addGround(3120, 3440, 480, 'stone');

    // The Goal Flag!
    entities.push(new GoalFlag(3320, 400, 48, 80));
    // High Star above the flag
    entities.push(new Collectible(3328, 330, 32, 32, 'star'));

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
