// Sidehop Level Persistence & Preset Levels Engine

import { CrateBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js';

const STORAGE_KEY = 'sidehop_saved_level_v1';

export class LevelStorage {
  // Serialize active level to JSON-compatible object
  static serialize(player, entities) {
    return {
      version: 1,
      name: 'My Sidehop Level',
      player: {
        spawnX: player.spawnX,
        spawnY: player.spawnY,
        speed: player.speed,
        jumpForce: player.jumpForce,
        gravityScale: player.gravityScale,
        doubleJumpAllowed: player.doubleJumpAllowed,
        customVisual: player.customVisual
      },
      entities: entities.map(ent => ({
        type: ent.type,
        x: ent.x,
        y: ent.y,
        width: ent.width,
        height: ent.height,
        customVisual: ent.customVisual,
        bounciness: ent.bounciness,
        friction: ent.friction,
        launchForce: ent.launchForce,
        speed: ent.speed,
        patrolRange: ent.patrolRange,
        stompable: ent.stompable,
        distance: ent.distance,
        axis: ent.axis
      }))
    };
  }

  // Restore entities from data object
  static deserialize(data, player, entities) {
    if (!data) return false;

    // Restore player
    if (data.player) {
      player.setSpawn(data.player.spawnX || 120, data.player.spawnY || 360);
      if (data.player.speed) player.speed = data.player.speed;
      if (data.player.jumpForce) player.jumpForce = data.player.jumpForce;
      if (data.player.gravityScale !== undefined) player.gravityScale = data.player.gravityScale;
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
        let ent = null;
        switch (d.type) {
          case 'crate':
            ent = new CrateBlock(d.x, d.y, d.width, d.height);
            if (d.bounciness !== undefined) ent.bounciness = d.bounciness;
            if (d.friction !== undefined) ent.friction = d.friction;
            break;
          case 'springboard':
            ent = new Springboard(d.x, d.y, d.width, d.height);
            if (d.launchForce !== undefined) ent.launchForce = d.launchForce;
            break;
          case 'hazard':
            ent = new HazardSpikes(d.x, d.y, d.width, d.height);
            break;
          case 'enemy':
            ent = new EnemyWalker(d.x, d.y, d.width, d.height);
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
            ent = new Collectible(d.x, d.y, d.width, d.height);
            break;
          case 'goal':
            ent = new GoalFlag(d.x, d.y, d.width, d.height);
            break;
        }

        if (ent) {
          if (d.customVisual) ent.setCustomVisual(d.customVisual);
          entities.push(ent);
        }
      });
    }

    return true;
  }

  // LocalStorage Auto-save
  static autoSave(player, entities) {
    try {
      const data = this.serialize(player, entities);
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
    return false;
  }

  // Download JSON file
  static exportLevel(player, entities) {
    const data = this.serialize(player, entities);
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
        const success = this.deserialize(data, player, entities);
        if (callback) callback(success);
      } catch (err) {
        alert('Invalid Sidehop level file.');
      }
    };
    reader.readAsText(file);
  }

  // Default Preset 1: The Iconic Milk Crate Hop Challenge!
  static getPresetCrateChallenge() {
    const entities = [];
    const T = 40;

    // Flat starting ground
    for (let x = 0; x < 280; x += T) {
      entities.push(new CrateBlock(x, 480, T, T));
    }

    // Milk Crate Pyramid Challenge! (Rising stairs of crates)
    // Step 1
    entities.push(new CrateBlock(320, 480, T, T));
    entities.push(new CrateBlock(320, 440, T, T));
    // Step 2
    entities.push(new CrateBlock(360, 480, T, T));
    entities.push(new CrateBlock(360, 440, T, T));
    entities.push(new CrateBlock(360, 400, T, T));
    // Step 3 (Apex)
    entities.push(new CrateBlock(400, 480, T, T));
    entities.push(new CrateBlock(400, 440, T, T));
    entities.push(new CrateBlock(400, 400, T, T));
    entities.push(new CrateBlock(400, 360, T, T));
    entities.push(new Collectible(404, 320, 32, 32)); // Star at the top of the pyramid!
    // Step 4 (Down)
    entities.push(new CrateBlock(440, 480, T, T));
    entities.push(new CrateBlock(440, 440, T, T));
    entities.push(new CrateBlock(440, 400, T, T));
    // Step 5
    entities.push(new CrateBlock(480, 480, T, T));
    entities.push(new CrateBlock(480, 440, T, T));

    // Hazard Pit with Spikes
    for (let x = 520; x < 680; x += T) {
      entities.push(new HazardSpikes(x, 500, T, T));
    }

    // Spring launch pad over pit
    entities.push(new Springboard(480, 400, T, T));

    // Landing ledge
    for (let x = 700; x < 1000; x += T) {
      entities.push(new CrateBlock(x, 440, T, T));
    }

    // Patrolling grumpy potato enemy on ledge
    entities.push(new EnemyWalker(780, 400, T, T));
    entities.push(new Collectible(840, 380, 32, 32));

    // Moving Platform across sky
    entities.push(new MovingPlatform(1040, 380, 80, 24));

    // Goal Platform
    for (let x = 1240; x < 1440; x += T) {
      entities.push(new CrateBlock(x, 400, T, T));
    }
    // Goal Flag
    entities.push(new GoalFlag(1360, 320, 48, 80));

    return {
      playerSpawn: { x: 80, y: 400 },
      entities
    };
  }
}
