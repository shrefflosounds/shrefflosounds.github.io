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

    // Health System (4 Hearts before death)
    this.maxHearts = 4;
    this.hearts = 4;
    this.invulnerableTimer = 0; // Invincibility frames after taking damage

    // Pistol Gun Powerup
    this.hasPistol = false;
    this.ammo = 0;
    this.shootCooldown = 0;
    this.recoilTimer = 0;
    this.shootKeyHeld = false;

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
    this.grounded = false;
    this.hearts = this.maxHearts;
    this.invulnerableTimer = 0;
    this.hasPistol = false;
    this.ammo = 0;
    this.shootCooldown = 0;
    this.recoilTimer = 0;
    this.shootKeyHeld = false;
    this.deformation = { scaleX: 1, scaleY: 1, rotation: 0 };
    this.squashFactor = 0;
    this.squashTime = 0;
    this.idleTimer = 0;
  }

  respawn() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.isDead = false;
    this.hasDoubleJump = this.doubleJumpAllowed;
    this.hearts = this.maxHearts;
    this.invulnerableTimer = 0;
    this.hasPistol = false;
    this.ammo = 0;
    this.shootCooldown = 0;
    this.recoilTimer = 0;
    this.shootKeyHeld = false;
    this.deformation = { scaleX: 1, scaleY: 1, rotation: 0 };
    this.squashFactor = 0;
    this.squashTime = 0;
    this.idleTimer = 0;
  }

  shoot() {
    if (!this.hasPistol || this.ammo <= 0) return null;
    this.ammo -= 1;
    this.shootCooldown = 0.22;
    this.recoilTimer = 0.14;
    const bx = this.facing > 0 ? this.x + this.width + 4 : this.x - 20;
    const by = this.y + 18;
    if (this.ammo <= 0) {
      this.hasPistol = false;
    }
    return new Bullet(bx, by, this.facing);
  }

  takeDamage(amount = 1, knockbackDir = 0) {
    if (this.isDead || this.invulnerableTimer > 0) return false;
    this.hearts = Math.max(0, this.hearts - amount);
    this.invulnerableTimer = 1.35; // 1.35s of invincibility

    // Lose gun powerup when hurt (like Fire Flower in Mario)
    this.hasPistol = false;
    this.ammo = 0;

    // Apply arcade knockback bounce
    this.vy = -340;
    this.vx = (knockbackDir !== 0 ? knockbackDir : -this.facing) * 260;
    this.grounded = false;

    // Visual impact squash
    this.deformation.scaleX = 0.8;
    this.deformation.scaleY = 1.25;

    if (this.hearts <= 0) {
      this.isDead = true;
    }
    return true;
  }

  handleInput(keys, dt) {
    // Decrement invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer < 0) this.invulnerableTimer = 0;
    }

    if (this.isDead) return;

    let moveDir = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) moveDir -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) moveDir += 1;

    // Smooth horizontal acceleration & deceleration with surface friction support
    const targetVx = moveDir * this.speed;
    const surfFriction = (this.standingOnSolid && typeof this.standingOnSolid.friction === 'number') ? this.standingOnSolid.friction : 1.0;
    const accel = this.grounded ? (16.0 * surfFriction) : 9.0;
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

    // Pistol Shooting (Keys: KeyF, KeyX, KeyJ, ShiftLeft, ShiftRight)
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.recoilTimer > 0) this.recoilTimer -= dt;

    let shotBullet = null;
    const isShootKey = Boolean(keys['KeyF'] || keys['KeyX'] || keys['KeyJ'] || keys['ShiftLeft'] || keys['ShiftRight']);
    if (this.hasPistol && isShootKey) {
      if (!this.shootKeyHeld && this.shootCooldown <= 0) {
        this.shootKeyHeld = true;
        shotBullet = this.shoot();
      }
    } else if (!isShootKey) {
      this.shootKeyHeld = false;
    }

    return shotBullet;
  }

  draw(ctx) {
    ctx.save();

    // Flicker visibility during invulnerability frames
    if (this.invulnerableTimer > 0) {
      const isFlicker = Math.floor(this.invulnerableTimer * 18) % 2 === 0;
      if (isFlicker) {
        ctx.globalAlpha = 0.35;
      }
    }

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

      // Equipped Pistol (Kid Pix / Neo-brutalist sidearm)
      if (this.hasPistol) {
        const recoilX = this.recoilTimer > 0 ? -4 : 0;
        ctx.save();
        ctx.translate(26 + recoilX, 22);

        // Slide & Barrel
        ctx.fillStyle = '#222222';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, -6, 16, 7, 2);
        ctx.fill();
        ctx.stroke();

        // Grip / Handle
        ctx.beginPath();
        ctx.roundRect(-2, 0, 6, 9, 2);
        ctx.fill();
        ctx.stroke();

        // Neon orange slide accent
        ctx.fillStyle = '#FF6D00';
        ctx.fillRect(4, -5, 8, 2);

        // Muzzle flash when firing
        if (this.recoilTimer > 0.08) {
          ctx.fillStyle = '#FFEE58';
          ctx.strokeStyle = '#FF3D00';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(16, -2.5);
          ctx.lineTo(24, -6);
          ctx.lineTo(20, -2.5);
          ctx.lineTo(26, -2.5);
          ctx.lineTo(20, 0);
          ctx.lineTo(24, 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }
    });

    ctx.restore();
  }
}

// 2. SOLID BLOCK (Mario Maker 2 Styles, Shapes, Sizes & Slants)
export class SolidBlock extends Entity {
  constructor(x, y, width = 40, height = 40, variant = 'solid') {
    let w = width;
    let h = height;
    if (variant === 'mega' && width === 40 && height === 40) { w = 80; h = 80; }
    else if (variant === 'slab' && width === 40 && height === 40) { w = 40; h = 20; }
    else if (variant === 'pipe' && width === 40 && height === 40) { w = 40; h = 80; }

    super(null, 'crate', x, y, w, h); // type remains 'crate' internally for physics/solids compatibility
    this.variant = variant || 'solid';
    this.bounciness = this.variant === 'note' ? 0.95 : 0.0;
    this.friction = this.variant === 'ice' ? 0.12 : 1.0;
    this.isOneWay = (this.variant === 'cloud' || this.variant === 'semisolid');

    // Mystery Block [?] & Note Block Bump State
    this.bumpOffsetY = 0;
    this.bumpTimer = 0;
    this.isUsed = false;

    // Donut Lift State
    this.startX = x;
    this.startY = y;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.isDropping = false;
    this.dropSpeed = 0;
    this.respawnTimer = 0;
  }

  setVariant(variant) {
    this.variant = variant;
    this.friction = variant === 'ice' ? 0.12 : 1.0;
    this.isOneWay = (variant === 'cloud' || variant === 'semisolid');
    this.bounciness = variant === 'note' ? 0.95 : 0.0;

    if (variant === 'mega') { this.width = 80; this.height = 80; }
    else if (variant === 'slab') { this.width = 40; this.height = 20; }
    else if (variant === 'pipe') { this.width = 40; this.height = 80; }
    else if (this.width !== 40 || this.height !== 40) {
      if (['solid', 'slope_up', 'slope_down', 'semisolid', 'donut', 'note', 'mystery', 'ice', 'cloud', 'stone'].includes(variant)) {
        this.width = 40;
        this.height = 40;
      }
    }
  }

  bump() {
    if (this.variant === 'mystery' && this.isUsed) return;
    this.bumpTimer = 0.22;
    if (this.variant === 'mystery') {
      this.isUsed = true;
      sounds.playCollect();
      if (typeof window !== 'undefined' && window.sidehop) {
        window.sidehop.score += 100;
      }
    } else if (this.variant === 'note') {
      sounds.playBounce();
    }
  }

  update(dt) {
    if (this.bumpTimer > 0) {
      this.bumpTimer -= dt;
      if (this.bumpTimer <= 0) {
        this.bumpOffsetY = 0;
      } else {
        this.bumpOffsetY = Math.sin((this.bumpTimer / 0.22) * Math.PI) * -12;
      }
    }

    // Donut Lift Physics
    if (this.variant === 'donut') {
      if (this.isDropping) {
        this.dropSpeed += 1150 * dt;
        this.y += this.dropSpeed * dt;
        if (this.y > this.startY + 500) {
          this.respawnTimer += dt;
          if (this.respawnTimer > 2.5) {
            this.x = this.startX;
            this.y = this.startY;
            this.isDropping = false;
            this.dropSpeed = 0;
            this.shakeTimer = 0;
            this.shakeOffsetX = 0;
            this.respawnTimer = 0;
          }
        }
      } else if (this.shakeTimer > 0) {
        this.shakeTimer += dt;
        this.shakeOffsetX = Math.sin(this.shakeTimer * 50) * 3;
        if (this.shakeTimer > 0.55) {
          this.isDropping = true;
          this.dropSpeed = 90;
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + (this.shakeOffsetX || 0), this.y + (this.bumpOffsetY || 0));

    this.renderCustomOrFallback(ctx, () => {
      // 1. SLANT UP (45° Incline /)
      if (this.variant === 'slope_up') {
        ctx.fillStyle = '#FFB300';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(0, this.height);
        ctx.lineTo(this.width, this.height);
        ctx.lineTo(this.width, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Lush grass trim along the hypotenuse
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, this.height);
        ctx.lineTo(this.width, 0);
        ctx.stroke();

        // Slope angle indicator hatch
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.width * 0.45, this.height);
        ctx.lineTo(this.width, this.height * 0.45);
        ctx.stroke();
      }

      // 2. SLANT DOWN (45° Decline \)
      else if (this.variant === 'slope_down') {
        ctx.fillStyle = '#FFB300';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, this.height);
        ctx.lineTo(this.width, this.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Lush grass trim along hypotenuse
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.width, this.height);
        ctx.stroke();

        // Slope angle indicator hatch
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.height * 0.45);
        ctx.lineTo(this.width * 0.55, this.height);
        ctx.stroke();
      }

      // 3. SEMI-SOLID PLATFORM (Mario Maker Wood Boardwalk)
      else if (this.variant === 'semisolid') {
        // Wooden top deck
        ctx.fillStyle = '#D7CCC8';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.width, 12);
        ctx.strokeRect(0, 0, this.width, 12);

        // Support vertical pilings
        ctx.fillStyle = '#A1887F';
        ctx.fillRect(5, 12, 8, this.height - 12);
        ctx.strokeRect(5, 12, 8, this.height - 12);
        ctx.fillRect(this.width - 13, 12, 8, this.height - 12);
        ctx.strokeRect(this.width - 13, 12, 8, this.height - 12);

        // Cross timber
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(5, this.height - 10, this.width - 10, 6);
        ctx.strokeRect(5, this.height - 10, this.width - 10, 6);

        // Mushroom rivet
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(this.width / 2, 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. HALF SLAB (40×20 Stepping Stone)
      else if (this.variant === 'slab') {
        ctx.fillStyle = '#FFB300';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Mint grass cap
        ctx.fillStyle = '#00E676';
        ctx.fillRect(0, 0, this.width, 6);
        ctx.strokeRect(0, 0, this.width, 6);

        // Center brick seam
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.width / 2, 6);
        ctx.lineTo(this.width / 2, this.height);
        ctx.stroke();
      }

      // 5. MEGA BLOCK (80×80 2×2 Giant Terrain Block)
      else if (this.variant === 'mega') {
        ctx.fillStyle = '#8D6E63';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 4;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Top lush grass cap
        ctx.fillStyle = '#00E676';
        ctx.fillRect(0, 0, this.width, 14);
        ctx.strokeRect(0, 0, this.width, 14);

        // 4 interior masonry quadrants
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2); ctx.lineTo(this.width, this.height / 2);
        ctx.moveTo(this.width / 2, 14); ctx.lineTo(this.width / 2, this.height);
        ctx.stroke();

        // Center golden medallion
        ctx.fillStyle = '#FFE600';
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 6. WARP PIPE (40×80 Green Pipe)
      else if (this.variant === 'pipe') {
        // Pipe Lip / Collar at top (48px wide, 22px tall)
        ctx.fillStyle = '#00E676';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(-4, 0, this.width + 8, 22);
        ctx.strokeRect(-4, 0, this.width + 8, 22);

        // Pipe stem (40px wide, 58px tall)
        ctx.fillStyle = '#00C853';
        ctx.fillRect(0, 22, this.width, this.height - 22);
        ctx.strokeRect(0, 22, this.width, this.height - 22);

        // Glossy cylindrical highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(4, 3, 7, 16);
        ctx.fillRect(6, 24, 7, this.height - 27);
      }

      // 7. DONUT LIFT (Falling Donut Platform)
      else if (this.variant === 'donut') {
        // Strawberry donut ring
        ctx.fillStyle = '#FF4081';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Center donut hole
        ctx.fillStyle = '#FFF8E1';
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Colorful sprinkles
        ctx.fillStyle = '#FFE600';
        ctx.fillRect(this.width / 2 - 11, this.height / 2 - 10, 4, 2);
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(this.width / 2 + 7, this.height / 2 - 8, 2, 4);
        ctx.fillStyle = '#00E676';
        ctx.fillRect(this.width / 2 - 9, this.height / 2 + 8, 4, 2);
      }

      // 8. NOTE BLOCK (Musical Super Bouncer ♪)
      else if (this.variant === 'note') {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Pop pink corner brackets
        ctx.fillStyle = '#FF2A85';
        ctx.fillRect(3, 3, 6, 6);
        ctx.fillRect(this.width - 9, 3, 6, 6);
        ctx.fillRect(3, this.height - 9, 6, 6);
        ctx.fillRect(this.width - 9, this.height - 9, 6, 6);

        // Musical Eighth Note ♪
        ctx.font = '900 24px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#121212';
        ctx.fillText('♪', this.width / 2, this.height / 2 + 1);
      }

      // 9. CASTLE STONE BLOCK
      else if (this.variant === 'stone') {
        ctx.fillStyle = '#9E9E9E';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Chiseled bevel highlights and shadows
        ctx.strokeStyle = '#EEEEEE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(3, 3); ctx.lineTo(this.width - 3, 3);
        ctx.moveTo(3, 3); ctx.lineTo(3, this.height - 3);
        ctx.stroke();

        ctx.strokeStyle = '#616161';
        ctx.beginPath();
        ctx.moveTo(this.width - 3, 3); ctx.lineTo(this.width - 3, this.height - 3);
        ctx.moveTo(3, this.height - 3); ctx.lineTo(this.width - 3, this.height - 3);
        ctx.stroke();

        // Central cross carving
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(12, 12, this.width - 24, this.height - 24);
      }

      // 10. MYSTERY QUESTION BLOCK [?]
      else if (this.variant === 'mystery') {
        if (!this.isUsed) {
          ctx.fillStyle = '#FFE600';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.strokeRect(0, 0, this.width, this.height);

          // Corner bolts
          ctx.fillStyle = '#121212';
          const r = 3;
          ctx.fillRect(4, 4, r, r);
          ctx.fillRect(this.width - 7, 4, r, r);
          ctx.fillRect(4, this.height - 7, r, r);
          ctx.fillRect(this.width - 7, this.height - 7, r, r);

          // Question mark
          ctx.font = '900 24px "Fredoka", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#121212';
          ctx.fillText('?', this.width / 2, this.height / 2 + 1);
        } else {
          // Deactivated Empty Block
          ctx.fillStyle = '#BCAAA4';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.strokeRect(0, 0, this.width, this.height);

          ctx.fillStyle = '#8D6E63';
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 11. CLOUD PLATFORM
      else if (this.variant === 'cloud') {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(this.width * 0.25, 16, 11, Math.PI, Math.PI * 2);
        ctx.arc(this.width * 0.5, 12, 13, Math.PI, Math.PI * 2);
        ctx.arc(this.width * 0.75, 16, 11, Math.PI, Math.PI * 2);
        ctx.lineTo(this.width, this.height - 6);
        ctx.quadraticCurveTo(this.width / 2, this.height - 2, 0, this.height - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(6, this.height - 6);
        ctx.lineTo(this.width - 6, this.height - 6);
        ctx.stroke();
      }

      // 12. ICE BLOCK
      else if (this.variant === 'ice') {
        ctx.fillStyle = '#B2EBF2';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.moveTo(4, 4);
        ctx.lineTo(this.width - 4, 4);
        ctx.lineTo(this.width - 12, 12);
        ctx.lineTo(4, 12);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 184, 212, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, this.height - 8);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.lineTo(this.width - 8, this.height - 14);
        ctx.stroke();
      }

      // 13. STANDARD SOLID GROUND BLOCK
      else {
        ctx.fillStyle = '#FFB300';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Mint grass cap
        ctx.fillStyle = '#00E676';
        ctx.fillRect(0, 0, this.width, 10);
        ctx.strokeRect(0, 0, this.width, 10);

        // Brick seams
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2 + 5);
        ctx.lineTo(this.width, this.height / 2 + 5);
        ctx.moveTo(this.width / 2, 10);
        ctx.lineTo(this.width / 2, this.height / 2 + 5);
        ctx.moveTo(this.width / 4, this.height / 2 + 5);
        ctx.lineTo(this.width / 4, this.height);
        ctx.moveTo((this.width * 3) / 4, this.height / 2 + 5);
        ctx.lineTo((this.width * 3) / 4, this.height);
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}

// Backward-compatible alias
export const CrateBlock = SolidBlock;

// 3. BOUNCER / SPRINGBOARD (Spring & Mega Trampoline Variants)
export class Springboard extends Entity {
  constructor(x, y, width = 40, height = 40, variant = 'spring') {
    super(null, 'springboard', x, y, width, height);
    this.variant = variant || 'spring'; // 'spring', 'mega'
    this.launchForce = this.variant === 'mega' ? 1020 : 820;
    this.compressTimer = 0;
  }

  setVariant(variant) {
    this.variant = variant;
    this.launchForce = variant === 'mega' ? 1020 : 820;
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
      const springHeight = isCompressed ? this.height * 0.42 : this.height * 0.85;
      const offsetY = this.height - springHeight;

      // Base plate
      ctx.fillStyle = '#121212';
      ctx.fillRect(2, this.height - 8, this.width - 4, 8);

      // Coil
      ctx.strokeStyle = this.variant === 'mega' ? '#00E5FF' : '#FF3388';
      ctx.lineWidth = this.variant === 'mega' ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(8, this.height - 8);
      ctx.lineTo(this.width - 8, this.height - springHeight / 2);
      ctx.lineTo(8, offsetY + 6);
      ctx.stroke();

      // Bouncy Top Cap
      ctx.fillStyle = this.variant === 'mega' ? '#FFE600' : '#00E676';
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(2, offsetY, this.width - 4, 10, 4);
      ctx.fill();
      ctx.stroke();

      if (this.variant === 'mega') {
        // Star badge on mega trampoline cap
        ctx.fillStyle = '#121212';
        ctx.beginPath();
        ctx.arc(this.width / 2, offsetY + 5, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
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

// 5. ENEMY WALKER (Walker, Winged Hopper, and Armored Spiky Variants)
export class EnemyWalker extends Entity {
  constructor(x, y, width = 40, height = 40, variant = 'walker') {
    super(null, 'enemy', x, y, width, height);
    this.variant = variant || 'walker'; // 'walker', 'winged', 'spiky'
    this.startX = x;
    this.patrolRange = 120;
    this.speed = 75;
    this.dir = 1;
    this.stompable = this.variant !== 'spiky';
    this.isSquashed = false;
    this.squashTimer = 0;
    this.walkCycle = 0;
    this.hopTimer = 0;
    this.hopOffset = 0;
  }

  setVariant(variant) {
    this.variant = variant;
    this.stompable = variant !== 'spiky';
  }

  stomp() {
    this.isSquashed = true;
    this.squashTimer = 0.35;
    sounds.playStomp();
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

    // Winged hopper jump motion
    if (this.variant === 'winged') {
      this.hopTimer += dt * 3.5;
      this.hopOffset = Math.abs(Math.sin(this.hopTimer)) * -18;
    } else {
      this.hopOffset = 0;
    }

    // Check patrol limits
    if (this.x > this.startX + this.patrolRange) {
      this.dir = -1;
    } else if (this.x < this.startX - this.patrolRange) {
      this.dir = 1;
    }

    // Check collision with solid tiles to reverse direction
    for (const solid of solids) {
      if (!solid.active || solid === this || solid.isOneWay || solid.variant === 'cloud') continue;
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

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height + (this.hopOffset || 0));
    
    if (this.isSquashed) {
      ctx.scale(1.4, 0.2);
    } else {
      ctx.scale(this.dir, 1 + Math.sin(this.walkCycle) * 0.08);
    }
    ctx.translate(-this.width / 2, -this.height);

    this.renderCustomOrFallback(ctx, () => {
      if (this.variant === 'winged') {
        // Winged Hopper (Golden Yellow with animated white wings)
        const wingFlap = Math.sin(this.walkCycle * 2.5) * 8;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;

        // Left & right wings
        ctx.beginPath();
        ctx.ellipse(2, 14 + wingFlap, 9, 6, -0.4, 0, Math.PI * 2);
        ctx.ellipse(this.width - 2, 14 + wingFlap, 9, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Round golden body
        ctx.fillStyle = '#FFD54F';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(4, 6, this.width - 8, this.height - 10, 10);
        ctx.fill();
        ctx.stroke();

        // Big anime eyes
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(14, 18, 5, 0, Math.PI * 2);
        ctx.arc(26, 18, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#121212';
        ctx.beginPath();
        ctx.arc(15, 18, 2.5, 0, Math.PI * 2);
        ctx.arc(27, 18, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Little orange beak
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.moveTo(17, 24);
        ctx.lineTo(23, 24);
        ctx.lineTo(20, 28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.variant === 'spiky') {
        // Armored Spiky Urchin (Cannot be stomped!)
        // Steel Spikes on top
        ctx.fillStyle = '#ECEFF1';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(6, 12);
        ctx.lineTo(12, 1);
        ctx.lineTo(18, 12);
        ctx.lineTo(24, 0);
        ctx.lineTo(30, 12);
        ctx.lineTo(36, 1);
        ctx.lineTo(this.width - 6, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crimson Armored Body
        ctx.fillStyle = '#FF3B30';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(4, 10, this.width - 8, this.height - 14, 8);
        ctx.fill();
        ctx.stroke();

        // Glowing yellow slit eyes
        ctx.fillStyle = '#FFE600';
        ctx.beginPath();
        ctx.arc(14, 21, 4, 0, Math.PI * 2);
        ctx.arc(26, 21, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#121212';
        ctx.fillRect(13, 19, 2.5, 4);
        ctx.fillRect(25, 19, 2.5, 4);
      } else {
        // Standard Lavender Walker (Grumpy Potato)
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
      }
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

// 7. BULLET PROJECTILE (Fired by Player Pistol)
export class Bullet extends Entity {
  constructor(x, y, dir = 1) {
    super(null, 'bullet', x, y, 16, 8);
    this.dir = dir; // 1 = right, -1 = left
    this.speed = 720;
    this.life = 1.2; // seconds
  }

  update(dt, solids) {
    this.x += this.dir * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    // Check collision with solid blocks
    for (const solid of solids) {
      if (!solid.active || solid.isOneWay || solid.variant === 'cloud') continue;
      if (
        this.x < solid.x + solid.width &&
        this.x + this.width > solid.x &&
        this.y < solid.y + solid.height &&
        this.y + this.height > solid.y
      ) {
        this.active = false;
        return;
      }
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.dir, 1);

    // Glowing Neon Yellow energy slug
    ctx.fillStyle = '#FFEE58';
    ctx.strokeStyle = '#121212';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -4, 16, 8, 4);
    ctx.fill();
    ctx.stroke();

    // Hot White energy core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-4, -2, 8, 4, 2);
    ctx.fill();

    ctx.restore();
  }
}

// 8. COLLECTIBLE TOKEN / POWERUP (Coin, Star, Heart, Pistol)
export class Collectible extends Entity {
  constructor(x, y, width = 32, height = 32, variant = 'coin') {
    super(null, 'collectible', x, y, width, height);
    this.variant = variant || 'coin'; // 'coin', 'star', 'heart', 'pistol'
    this.bobTimer = Math.random() * Math.PI;
    this.collected = false;
    this.points = this.calcPoints(this.variant);
  }

  calcPoints(v) {
    if (v === 'star') return 500;
    if (v === 'heart') return 200;
    if (v === 'pistol') return 300;
    return 100;
  }

  setVariant(variant) {
    this.variant = variant;
    this.points = this.calcPoints(variant);
  }

  update(dt) {
    this.bobTimer += dt * 4;
  }

  collect() {
    this.collected = true;
    this.active = false;
    if (this.variant === 'pistol') {
      sounds.playGunPickup();
    } else {
      sounds.playCollect();
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    const bobOffset = Math.sin(this.bobTimer) * 4;
    ctx.translate(this.x, this.y + bobOffset);

    this.renderCustomOrFallback(ctx, () => {
      if (this.variant === 'heart') {
        // Heart Health Pickup (+1 Heart, +200 pts)
        const pulse = 1 + Math.sin(this.bobTimer * 1.5) * 0.08;
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(pulse, pulse);

        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.bezierCurveTo(-4, -11, -12, -6, -12, 1);
        ctx.bezierCurveTo(-12, 7, -5, 10, 0, 14);
        ctx.bezierCurveTo(5, 10, 12, 7, 12, 1);
        ctx.bezierCurveTo(12, -6, 4, -11, 0, -3);
        ctx.closePath();

        ctx.fillStyle = '#FF2D55';
        ctx.fill();
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Cute white shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(-4, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.variant === 'pistol') {
        // Pistol Gun Powerup Bubble
        const aura = 1 + Math.sin(this.bobTimer * 2) * 0.08;
        ctx.fillStyle = '#FFF9C4';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, 15 * aura, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Mini Kid-Pix Pistol
        ctx.save();
        ctx.translate(this.width / 2 - 8, this.height / 2 - 2);
        // Slide / Barrel
        ctx.fillStyle = '#222222';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, -5, 16, 6, 2);
        ctx.fill();
        ctx.stroke();
        // Grip / Handle
        ctx.beginPath();
        ctx.roundRect(-2, 0, 6, 9, 2);
        ctx.fill();
        ctx.stroke();
        // Neon orange slide accent
        ctx.fillStyle = '#FF6D00';
        ctx.fillRect(4, -4, 8, 2);
        ctx.restore();
      } else if (this.variant === 'star') {
        // Glowing Star Gem (+500 pts)
        ctx.fillStyle = '#FFE600';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;

        // Radiant 5-point star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(
            this.width / 2 + Math.cos((18 + i * 72) * Math.PI / 180) * (this.width / 2 - 2),
            this.height / 2 - Math.sin((18 + i * 72) * Math.PI / 180) * (this.height / 2 - 2)
          );
          ctx.lineTo(
            this.width / 2 + Math.cos((54 + i * 72) * Math.PI / 180) * (this.width / 4),
            this.height / 2 - Math.sin((54 + i * 72) * Math.PI / 180) * (this.height / 4)
          );
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cute smiling eyes
        ctx.fillStyle = '#121212';
        ctx.beginPath();
        ctx.arc(this.width / 2 - 3.5, this.height / 2 - 1, 1.8, 0, Math.PI * 2);
        ctx.arc(this.width / 2 + 3.5, this.height / 2 - 1, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Golden Coin (+100 pts)
        const spin = Math.abs(Math.sin(this.bobTimer));
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(Math.max(0.25, spin), 1);
        ctx.translate(-this.width / 2, -this.height / 2);

        ctx.fillStyle = '#FFE600';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, this.width / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner coin rim
        ctx.strokeStyle = '#D87A24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, this.width / 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }
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
