// Sidehop Entity System — Player, Crates, Springs, Hazards, Enemies, Platforms, Goals

import { sounds } from '../audio/sound.js';

export class Entity {
  constructor(id, type, x, y, width, height) {
    this.id = id || ('ent_' + Math.random().toString(36).substr(2, 9));
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.active = true;
    this.customVisual = null; // dataURL or Image object for custom painted art / GIF
    this.customImageElement = null;
  }

  setCustomVisual(dataUrl) {
    this.customVisual = dataUrl;
    if (dataUrl) {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        this.customImageElement = img;
      };
    } else {
      this.customImageElement = null;
    }
  }

  // Draw custom image or fallback
  renderCustomOrFallback(ctx, fallbackDrawFn) {
    if (this.customImageElement && this.customImageElement.complete) {
      ctx.drawImage(this.customImageElement, 0, 0, this.width, this.height);
    } else {
      fallbackDrawFn();
    }
  }
}

// 1. PLAYER HERO
export class Player extends Entity {
  constructor(x, y) {
    super('player', 'player', x, y, 40, 48);
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.facing = 1; // 1 = right, -1 = left

    // Tunable Parameters (via Inspector)
    this.speed = 340;
    this.jumpForce = 620;
    this.gravityScale = 1.0;
    this.doubleJumpAllowed = true;
    this.hasDoubleJump = true;

    // Movement Tuning
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.isDead = false;
    this.respawnTimer = 0;
    this.spawnX = x;
    this.spawnY = y;

    // Procedural Squash-and-stretch
    this.deformation = { scaleX: 1, scaleY: 1, rotation: 0 };
    this.squashFactor = 0;
    this.squashTime = 0;
    this.idleTimer = 0;
  }

  setSpawn(x, y) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  respawn() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.isDead = false;
    this.hasDoubleJump = this.doubleJumpAllowed;
  }

  handleInput(keys, dt) {
    if (this.isDead) return;

    let moveDir = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) moveDir -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) moveDir += 1;

    // Smooth horizontal acceleration & deceleration
    const targetVx = moveDir * this.speed;
    const accel = this.grounded ? 16.0 : 9.0;
    this.vx += (targetVx - this.vx) * Math.min(1.0, accel * dt);

    if (moveDir !== 0) {
      this.facing = moveDir;
    }

    // Coyote timer
    if (this.grounded) {
      this.coyoteTimer = 0.12;
      this.hasDoubleJump = this.doubleJumpAllowed;
    } else {
      this.coyoteTimer -= dt;
    }

    // Jump buffer
    if (keys['ArrowUp'] || keys['KeyW'] || keys['Space']) {
      if (!this.jumpKeyHeld) {
        this.jumpBufferTimer = 0.15;
      }
      this.jumpKeyHeld = true;
    } else {
      this.jumpKeyHeld = false;
      // Variable jump height cut
      if (this.vy < -150) {
        this.vy *= 0.55;
      }
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        // Ground Jump
        this.vy = -this.jumpForce;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        sounds.playJump();
      } else if (this.hasDoubleJump && !this.grounded) {
        // Double Jump
        this.vy = -this.jumpForce * 0.9;
        this.hasDoubleJump = false;
        this.jumpBufferTimer = 0;
        sounds.playBounce();
      }
    }
  }

  draw(ctx) {
    ctx.save();
    // Center transformation on character's bottom-center for squash-and-stretch
    const centerX = this.x + this.width / 2;
    const bottomY = this.y + this.height;

    ctx.translate(centerX, bottomY);
    ctx.scale(this.facing * this.deformation.scaleX, this.deformation.scaleY);
    ctx.rotate(this.facing * this.deformation.rotation);
    ctx.translate(-this.width / 2, -this.height);

    this.renderCustomOrFallback(ctx, () => {
      // Default Sidehop Playful Mascot
      // Body (electric cyan rounded rectangle with neo-brutalist border)
      ctx.fillStyle = '#00E5FF';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.roundRect(4, 8, this.width - 8, this.height - 14, 10);
      ctx.fill();
      ctx.stroke();

      // Big Goofy Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(16, 18, 6, 0, Math.PI * 2);
      ctx.arc(28, 18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupils (looking forward)
      ctx.fillStyle = '#121212';
      ctx.beginPath();
      ctx.arc(18, 18, 3, 0, Math.PI * 2);
      ctx.arc(30, 18, 3, 0, Math.PI * 2);
      ctx.fill();

      // Cheerful Smile
      ctx.beginPath();
      ctx.arc(22, 26, 6, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Chunky Sneakers
      ctx.fillStyle = '#FF3388';
      ctx.beginPath();
      ctx.roundRect(4, this.height - 8, 14, 8, 4);
      ctx.roundRect(22, this.height - 8, 14, 8, 4);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }
}

// 2. SOLID BLOCK (Ground / Platform Tile)
export class SolidBlock extends Entity {
  constructor(x, y, width = 40, height = 40) {
    super(null, 'crate', x, y, width, height); // type remains 'crate' internally for physics/solids compatibility
    this.bounciness = 0.0;
    this.friction = 1.0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    this.renderCustomOrFallback(ctx, () => {
      // Clean Neo-Brutalist Platformer Ground Block
      // Earthy terracotta / golden clay base
      ctx.fillStyle = '#FFB300'; // Amber platformer block
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;

      ctx.fillRect(0, 0, this.width, this.height);
      ctx.strokeRect(0, 0, this.width, this.height);

      // Top Grass / Trim cap
      ctx.fillStyle = '#00E676'; // Lush Mint Green cap
      ctx.fillRect(0, 0, this.width, 10);
      ctx.strokeRect(0, 0, this.width, 10);

      // Subtle brick / tile texture seams
      ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Horizontal seam
      ctx.moveTo(0, this.height / 2 + 5);
      ctx.lineTo(this.width, this.height / 2 + 5);
      // Vertical seam top half
      ctx.moveTo(this.width / 2, 10);
      ctx.lineTo(this.width / 2, this.height / 2 + 5);
      // Vertical seam bottom half
      ctx.moveTo(this.width / 4, this.height / 2 + 5);
      ctx.lineTo(this.width / 4, this.height);
      ctx.moveTo((this.width * 3) / 4, this.height / 2 + 5);
      ctx.lineTo((this.width * 3) / 4, this.height);
      ctx.stroke();
    });

    ctx.restore();
  }
}

// Backward-compatible alias
export const CrateBlock = SolidBlock;

// 3. BOUNCER / SPRINGBOARD
export class Springboard extends Entity {
  constructor(x, y, width = 40, height = 40) {
    super(null, 'springboard', x, y, width, height);
    this.launchForce = 980;
    this.compressTimer = 0;
  }

  trigger() {
    this.compressTimer = 0.25;
    sounds.playBounce();
  }

  update(dt) {
    if (this.compressTimer > 0) {
      this.compressTimer -= dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    this.renderCustomOrFallback(ctx, () => {
      const isCompressed = this.compressTimer > 0.1;
      const springHeight = isCompressed ? this.height * 0.45 : this.height * 0.85;
      const offsetY = this.height - springHeight;

      // Base plate
      ctx.fillStyle = '#121212';
      ctx.fillRect(2, this.height - 8, this.width - 4, 8);

      // Coil
      ctx.strokeStyle = '#FF3388';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(8, this.height - 8);
      ctx.lineTo(this.width - 8, this.height - springHeight / 2);
      ctx.lineTo(8, offsetY + 6);
      ctx.stroke();

      // Bouncy Top Cap
      ctx.fillStyle = '#00E676'; // Mint green
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(2, offsetY, this.width - 4, 10, 4);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }
}

// 4. HAZARD SPIKES
export class HazardSpikes extends Entity {
  constructor(x, y, width = 40, height = 40) {
    super(null, 'hazard', x, y, width, height);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    this.renderCustomOrFallback(ctx, () => {
      ctx.fillStyle = '#FF3B30'; // Punchy red
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;

      const numSpikes = 3;
      const spikeW = this.width / numSpikes;

      ctx.beginPath();
      ctx.moveTo(0, this.height);
      for (let i = 0; i < numSpikes; i++) {
        ctx.lineTo(i * spikeW + spikeW / 2, 4);
        ctx.lineTo((i + 1) * spikeW, this.height);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }
}

// 5. ENEMY WALKER
export class EnemyWalker extends Entity {
  constructor(x, y, width = 40, height = 40) {
    super(null, 'enemy', x, y, width, height);
    this.startX = x;
    this.patrolRange = 120;
    this.speed = 80;
    this.dir = 1;
    this.stompable = true;
    this.isSquashed = false;
    this.squashTimer = 0;
    this.walkCycle = 0;
  }

  update(dt, solids) {
    if (this.isSquashed) {
      this.squashTimer -= dt;
      if (this.squashTimer <= 0) {
        this.active = false;
      }
      return;
    }

    this.x += this.dir * this.speed * dt;
    this.walkCycle += dt * 8;

    // Check patrol limits
    if (this.x > this.startX + this.patrolRange) {
      this.dir = -1;
    } else if (this.x < this.startX - this.patrolRange) {
      this.dir = 1;
    }

    // Check collision with solid tiles to reverse direction
    for (const solid of solids) {
      if (!solid.active || solid === this) continue;
      if (
        this.x < solid.x + solid.width &&
        this.x + this.width > solid.x &&
        this.y < solid.y + solid.height &&
        this.y + this.height > solid.y
      ) {
        this.dir *= -1;
        this.x += this.dir * 4;
        break;
      }
    }
  }

  stomp() {
    this.isSquashed = true;
    this.squashTimer = 0.35;
    sounds.playStomp();
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height);
    
    if (this.isSquashed) {
      ctx.scale(1.4, 0.2);
    } else {
      ctx.scale(this.dir, 1 + Math.sin(this.walkCycle) * 0.08);
    }
    ctx.translate(-this.width / 2, -this.height);

    this.renderCustomOrFallback(ctx, () => {
      // Quirky potato monster
      ctx.fillStyle = '#B388FF'; // Lavender purple
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.roundRect(4, 6, this.width - 8, this.height - 10, 10);
      ctx.fill();
      ctx.stroke();

      // Grumpy Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(14, 18, 5, 0, Math.PI * 2);
      ctx.arc(26, 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#121212';
      ctx.beginPath();
      ctx.arc(16, 18, 2.5, 0, Math.PI * 2);
      ctx.arc(28, 18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Zigzag Grumpy Mouth
      ctx.beginPath();
      ctx.moveTo(14, 27);
      ctx.lineTo(18, 24);
      ctx.lineTo(22, 27);
      ctx.lineTo(26, 24);
      ctx.stroke();
    });

    ctx.restore();
  }
}

// 6. MOVING PLATFORM
export class MovingPlatform extends Entity {
  constructor(x, y, width = 80, height = 24) {
    super(null, 'moving_platform', x, y, width, height);
    this.startX = x;
    this.startY = y;
    this.axis = 'horizontal'; // 'horizontal' or 'vertical'
    this.distance = 160;
    this.speed = 70;
    this.progress = 0;
    this.dx = 0;
    this.dy = 0;
  }

  update(dt) {
    this.progress += (this.speed * dt) / this.distance;
    const offset = Math.sin(this.progress) * this.distance;

    const prevX = this.x;
    const prevY = this.y;

    if (this.axis === 'horizontal') {
      this.x = this.startX + offset;
      this.y = this.startY;
    } else {
      this.x = this.startX;
      this.y = this.startY + offset;
    }

    this.dx = this.x - prevX;
    this.dy = this.y - prevY;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    this.renderCustomOrFallback(ctx, () => {
      ctx.fillStyle = '#00E5FF';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.roundRect(0, 0, this.width, this.height, 6);
      ctx.fill();
      ctx.stroke();

      // Platform grip lines
      ctx.fillStyle = '#121212';
      for (let i = 12; i < this.width - 10; i += 16) {
        ctx.fillRect(i, 4, 3, this.height - 8);
      }
    });

    ctx.restore();
  }
}

// 7. COLLECTIBLE TOKEN / COIN
export class Collectible extends Entity {
  constructor(x, y, width = 32, height = 32) {
    super(null, 'collectible', x, y, width, height);
    this.bobTimer = Math.random() * Math.PI;
    this.collected = false;
  }

  update(dt) {
    this.bobTimer += dt * 4;
  }

  collect() {
    this.collected = true;
    this.active = false;
    sounds.playCollect();
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    const bobOffset = Math.sin(this.bobTimer) * 4;
    ctx.translate(this.x, this.y + bobOffset);

    this.renderCustomOrFallback(ctx, () => {
      // Golden Coin / Star
      ctx.fillStyle = '#FFE600';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, this.width / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner star / shine
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.width / 2 - 3, this.height / 2 - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}

// 8. GOAL FINISH LINE
export class GoalFlag extends Entity {
  constructor(x, y, width = 48, height = 80) {
    super(null, 'goal', x, y, width, height);
    this.waveTimer = 0;
    this.reached = false;
  }

  update(dt) {
    this.waveTimer += dt * 6;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    this.renderCustomOrFallback(ctx, () => {
      // Flagpole
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(8, this.height);
      ctx.stroke();

      // Waving Flag
      const wave = Math.sin(this.waveTimer) * 4;
      ctx.fillStyle = '#00E676'; // Mint green
      ctx.beginPath();
      ctx.moveTo(10, 6);
      ctx.quadraticCurveTo(24, 2 + wave, 44, 14);
      ctx.lineTo(10, 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Base
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, this.height - 8, 16, 8);
    });

    ctx.restore();
  }
}
