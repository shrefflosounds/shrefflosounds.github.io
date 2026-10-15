// Sidehop Level Persistence & Preset Levels Engine

import { SolidBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';

const STORAGE_KEY = 'sidehop_saved_level_v2';

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

  // Default Preset 1: World 1-1 "Sidehop Meadow"
  static getStarterWorld() {
    const entities = [];
    const T = 40;

    // 1. Starting Ground Runway
    for (let x = 0; x < 360; x += T) {
      entities.push(new SolidBlock(x, 480, T, T));
    }

    // 2. Gentle Ascending Platformer Steps
    entities.push(new SolidBlock(240, 440, T, T));
    entities.push(new SolidBlock(280, 440, T, T));
    entities.push(new SolidBlock(280, 400, T, T));
    entities.push(new Collectible(284, 350, 32, 32));

    // 3. Floating Mystery Island with Coin
    for (let x = 360; x < 480; x += T) {
      entities.push(new SolidBlock(x, 320, T, T));
    }
    entities.push(new Collectible(420, 270, 32, 32));

    // 4. Springboard Leap over Spike Gap
    for (let x = 400; x < 600; x += T) {
      entities.push(new HazardSpikes(x, 500, T, T));
    }
    // High bounce launch pad
    entities.push(new Springboard(360, 480, T, T));

    // 5. Landing Terrace with Patrolling Enemy
    for (let x = 640; x < 960; x += T) {
      entities.push(new SolidBlock(x, 440, T, T));
    }
    entities.push(new EnemyWalker(740, 400, T, T));
    entities.push(new Collectible(800, 380, 32, 32));
    entities.push(new Collectible(860, 380, 32, 32));

    // 6. Smooth Moving Platform across the Chasm
    entities.push(new MovingPlatform(1020, 380, 80, 24));

    // 7. Victory Platform with Goal Flag
    for (let x = 1200; x < 1440; x += T) {
      entities.push(new SolidBlock(x, 440, T, T));
    }
    entities.push(new GoalFlag(1340, 360, 48, 80));

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
