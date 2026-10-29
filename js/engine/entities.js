// Sidehop Entity System — Player, Crates, Springs, Hazards, Enemies, Platforms, Goals

import { sounds } from '../audio/sound.js';

// Safe Canvas roundRect polyfill / wrapper for Safari / WebKit and older browsers
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

export class Entity {
  constructor(id, type, x, y, width, height) {
    this.id = id || ('ent_' + Math.random().toString(36).substr(2, 9));
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.active = true;
    this.color = null; // Custom starter component color (e.g. red ice block, custom goal flag)
    this.customVisual = null; // dataURL or Image object for custom painted art / GIF
    this.customImageElement = null;
  }

  setColor(color) {
    this.color = color;
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
    if (this.customImageElement && this.customImageElement.complete && this.customImageElement.naturalWidth > 0 && this.customImageElement.naturalHeight > 0) {
      try {
        ctx.drawImage(this.customImageElement, 0, 0, this.width, this.height);
        return;
      } catch (err) {
        console.warn('Entity custom image draw failed:', err);
      }
    }
    fallbackDrawFn();
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
    this.isJumping = false;
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

    // Player retains gun powerup and ammo when taking damage per user request

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
      // Variable jump height cut (only cuts active player jumps upon releasing jump key)
      if (this.isJumping && this.vy < -150) {
        this.vy *= 0.55;
        this.isJumping = false;
      }
    }

    if (this.grounded || this.vy >= 0) {
      this.isJumping = false;
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        // Ground Jump
        this.vy = -this.jumpForce;
        this.grounded = false;
        this.standingOnSolid = null;
        this.isJumping = true;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        sounds.playJump();
      } else if (this.hasDoubleJump && !this.grounded) {
        // Double Jump
        this.vy = -this.jumpForce * 0.9;
        this.hasDoubleJump = false;
        this.standingOnSolid = null;
        this.isJumping = true;
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
    try {
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
        const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';

        if (isUncanny) {
          // 3D / UNCANNY REALISM HERO: Tactile 3D Red Silicone / Flesh-Vinyl Cube Creature
          // with top horn/ear nubs, round wire-frame spectacles, and unblinking realistic human eyes!
          // Soft 3D ground contact shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
          ctx.beginPath();
          ctx.ellipse(this.width / 2, this.height - 2, 16, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tiny stubby 3D crimson legs/feet
          const legGrad = ctx.createLinearGradient(0, this.height - 9, 0, this.height);
          legGrad.addColorStop(0, '#991B1B');
          legGrad.addColorStop(1, '#450A0A');
          ctx.fillStyle = legGrad;
          ctx.beginPath();
          ctx.roundRect(7, this.height - 8, 9, 8, 3.5);
          ctx.roundRect(24, this.height - 8, 9, 8, 3.5);
          ctx.fill();

          // Top left & right 3D horn/ear nubs
          [ [9, 6], [25, 6] ].forEach(([nx, ny]) => {
            const nubGrad = ctx.createRadialGradient(nx + 2, ny + 1, 1, nx + 3, ny + 3, 6);
            nubGrad.addColorStop(0, '#F87171');
            nubGrad.addColorStop(0.55, '#DC2626');
            nubGrad.addColorStop(1, '#7F1D1D');
            ctx.fillStyle = nubGrad;
            ctx.beginPath();
            ctx.roundRect(nx, ny - 4, 6, 8, 3);
            ctx.fill();
          });

          // 3D Extruded Back/Side Bevel Depth of Cube
          ctx.fillStyle = '#450A0A';
          ctx.beginPath();
          ctx.roundRect(2, 9, this.width - 6, this.height - 15, 7);
          ctx.fill();

          // Main 3D Raytraced / Subsurface-Scattered Crimson Cube Body
          const bodyGrad = ctx.createRadialGradient(13, 14, 3, 20, 22, 24);
          bodyGrad.addColorStop(0, this.color || '#FF6B6B');
          bodyGrad.addColorStop(0.35, this.color || '#DC2626');
          bodyGrad.addColorStop(0.78, '#991B1B');
          bodyGrad.addColorStop(1, '#450A0A');
          ctx.fillStyle = bodyGrad;
          ctx.beginPath();
          ctx.roundRect(4, 8, this.width - 8, this.height - 15, 7);
          ctx.fill();

          // Top 3D specular rim light & organic pore/Dimple highlights
          const rimGrad = ctx.createLinearGradient(6, 9, 6, 15);
          rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
          rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = rimGrad;
          ctx.beginPath();
          ctx.roundRect(6, 9, this.width - 12, 5, 3);
          ctx.fill();

          ctx.strokeStyle = 'rgba(69, 10, 10, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(4, 8, this.width - 8, this.height - 15, 7);
          ctx.stroke();

          // UNCANNY REALISTIC HUMAN EYES with Sclera, Red Capillaries, Hazel/Blue Iris, Pupil & Wet Catchlight
          const eyeCenters = [ [15, 19], [28, 19] ];
          eyeCenters.forEach(([ex, ey]) => {
            // Deep fleshy eye socket shadow
            ctx.fillStyle = 'rgba(45, 5, 5, 0.65)';
            ctx.beginPath();
            ctx.arc(ex, ey + 0.5, 6.4, 0, Math.PI * 2);
            ctx.fill();

            // 3D Eyeball Sclera (spherical radial shading)
            const scleraGrad = ctx.createRadialGradient(ex - 1.5, ey - 1.5, 1, ex, ey, 5.6);
            scleraGrad.addColorStop(0, '#FFFFFF');
            scleraGrad.addColorStop(0.7, '#F1F5F9');
            scleraGrad.addColorStop(0.92, '#FECACA');
            scleraGrad.addColorStop(1, '#991B1B');
            ctx.fillStyle = scleraGrad;
            ctx.beginPath();
            ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
            ctx.fill();

            // Tiny bloodshot capillary vein on outer sclera
            ctx.strokeStyle = 'rgba(220, 38, 38, 0.45)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(ex - 4.8, ey - 1);
            ctx.lineTo(ex - 3.2, ey - 0.3);
            ctx.stroke();

            // Detailed Iris (icy blue-amber ring)
            const irisGrad = ctx.createRadialGradient(ex + 1, ey, 0.5, ex + 1, ey, 3.1);
            irisGrad.addColorStop(0, '#7DD3FC');
            irisGrad.addColorStop(0.65, '#0284C7');
            irisGrad.addColorStop(1, '#0F172A');
            ctx.fillStyle = irisGrad;
            ctx.beginPath();
            ctx.arc(ex + 1, ey, 3.0, 0, Math.PI * 2);
            ctx.fill();

            // Deep Black Pupil
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.arc(ex + 1.2, ey, 1.45, 0, Math.PI * 2);
            ctx.fill();

            // Wet Cornea Specular Catchlights
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(ex - 0.5, ey - 1.6, 1.25, 0, Math.PI * 2);
            ctx.arc(ex + 2.2, ey + 1.2, 0.6, 0, Math.PI * 2);
            ctx.fill();

            // Round Metallic Wire-Frame Spectacle Rim (from the sketches!)
            ctx.strokeStyle = '#1E293B';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(ex, ey, 6.0, 0, Math.PI * 2);
            ctx.stroke();
            // Gold/silver wire highlight on glasses
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(ex, ey, 6.0, Math.PI * 1.1, Math.PI * 1.65);
            ctx.stroke();
          });

          // Spectacle bridge connecting the two lenses
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(21, 18.5);
          ctx.lineTo(22, 18.5);
          ctx.stroke();

          // Uncanny subtle anatomical crease mouth
          ctx.strokeStyle = '#450A0A';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(21.5, 27.5, 4.2, 0.15, Math.PI - 0.15);
          ctx.stroke();
        } else {
          // Default Sidehop Playful Mascot
          // Body (electric cyan rounded rectangle with neo-brutalist border, or custom component color)
          ctx.fillStyle = this.color || '#00E5FF';
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
        }

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
    } catch (err) {
      console.warn('Player draw error:', err);
    } finally {
      ctx.restore();
    }
  }
}

// 2. SOLID BLOCK (Mario Maker 2 Styles, Shapes, Sizes & Slants)
export class SolidBlock extends Entity {
  constructor(x, y, width = 40, height = 40, variant = 'solid', content = null) {
    let w = width;
    let h = height;
    if (variant === 'mega' && width === 40 && height === 40) { w = 80; h = 80; }
    else if (variant === 'slab' && width === 40 && height === 40) { w = 40; h = 20; }
    else if (variant === 'pipe' && width === 40 && height === 40) { w = 40; h = 80; }

    super(null, 'crate', x, y, w, h); // type remains 'crate' internally for physics/solids compatibility
    this.variant = variant || 'solid';
    this.material = null; // 'stone', 'ice', 'solid', 'cloud', 'semisolid'
    if (this.variant.startsWith('stone_') || this.variant === 'stone') this.material = 'stone';
    else if (this.variant.startsWith('ice_') || this.variant === 'ice') this.material = 'ice';
    else if (this.variant.startsWith('cloud_') || this.variant === 'cloud') this.material = 'cloud';

    this.content = content || null; // 'powerup', 'heart', 'coin', 'star', 'ammo', or null (auto)
    this.bounciness = this.variant === 'note' ? 0.95 : 0.0;
    this.friction = (this.variant === 'ice' || this.variant.includes('ice_slope')) ? 0.12 : 1.0;
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

  get isSlope() {
    return this.variant === 'slope_up' || this.variant === 'slope_down' ||
           this.variant === 'slope_ceil_up' || this.variant === 'slope_ceil_down' ||
           this.variant === 'stone_slope_up' || this.variant === 'stone_slope_down' ||
           this.variant === 'stone_slope_ceil_up' || this.variant === 'stone_slope_ceil_down' ||
           this.variant === 'ice_slope_up' || this.variant === 'ice_slope_down' ||
           this.variant === 'ice_slope_ceil_up' || this.variant === 'ice_slope_ceil_down' ||
           this.variant.includes('slope');
  }

  get slopeDirection() {
    if (this.variant.includes('slope_ceil_up')) return 'ceil_up';
    if (this.variant.includes('slope_ceil_down')) return 'ceil_down';
    if (this.variant.includes('slope_up')) return 'up';
    if (this.variant.includes('slope_down')) return 'down';
    return null;
  }

  get isCeilingSlope() {
    return this.slopeDirection === 'ceil_up' || this.slopeDirection === 'ceil_down';
  }

  get effectiveMaterial() {
    if (this.material) return this.material;
    if (this.variant.startsWith('stone_') || this.variant === 'stone') return 'stone';
    if (this.variant.startsWith('ice_') || this.variant === 'ice') return 'ice';
    if (this.variant.startsWith('cloud_') || this.variant === 'cloud') return 'cloud';
    if (this.variant.startsWith('semisolid_') || this.variant === 'semisolid') return 'semisolid';

    // Auto-detect material for generic slopes based on adjacent blocks
    if (this.isSlope) {
      const col = Math.round(this.x / 40);
      const row = Math.round(this.y / 40);
      const bottomEnt = SolidBlock.terrainMap.get(`${col},${row + 1}`);
      const topEnt = SolidBlock.terrainMap.get(`${col},${row - 1}`);
      const rightEnt = SolidBlock.terrainMap.get(`${col + 1},${row}`);
      const leftEnt = SolidBlock.terrainMap.get(`${col - 1},${row}`);

      const checkMat = (ent) => {
        if (!ent || !ent.active) return null;
        if (ent.variant === 'stone' || ent.variant?.startsWith('stone_') || ent.material === 'stone') return 'stone';
        if (ent.variant === 'ice' || ent.variant?.startsWith('ice_') || ent.material === 'ice') return 'ice';
        if (ent.variant === 'cloud' || ent.variant?.startsWith('cloud_') || ent.material === 'cloud') return 'cloud';
        return null;
      };

      const mat = checkMat(bottomEnt) || checkMat(topEnt) || checkMat(rightEnt) || checkMat(leftEnt);
      if (mat) return mat;
    }
    return 'solid';
  }

  setVariant(variant) {
    this.variant = variant;
    if (variant.startsWith('stone_') || variant === 'stone') this.material = 'stone';
    else if (variant.startsWith('ice_') || variant === 'ice') this.material = 'ice';
    else if (variant.startsWith('cloud_') || variant === 'cloud') this.material = 'cloud';
    else if (variant === 'solid') this.material = 'solid';

    this.friction = (variant === 'ice' || variant.includes('ice_slope')) ? 0.12 : 1.0;
    this.isOneWay = (variant === 'cloud' || variant === 'semisolid');
    this.bounciness = variant === 'note' ? 0.95 : 0.0;

    if (variant === 'mega') { this.width = 80; this.height = 80; }
    else if (variant === 'slab') { this.width = 40; this.height = 20; }
    else if (variant === 'pipe') { this.width = 40; this.height = 80; }
    else if (this.width !== 40 || this.height !== 40) {
      if (!['mega', 'slab', 'pipe'].includes(variant)) {
        this.width = 40;
        this.height = 40;
      }
    }
    SolidBlock.terrainMapDirty = true;
  }

  bump(entity = null) {
    if (this.variant === 'mystery' && this.isUsed) return;
    this.bumpTimer = 0.22;
    if (this.variant === 'mystery') {
      this.isUsed = true;
      try {
        if (typeof window !== 'undefined' && window.sidehop && window.sidehop.handleMysteryBlockHit) {
          window.sidehop.handleMysteryBlockHit(this);
        } else {
          sounds.playCollect();
          if (typeof window !== 'undefined' && window.sidehop) {
            window.sidehop.score += 100;
          }
        }
      } catch (err) {
        console.error('Mystery block bump error:', err);
      }
    } else if (this.variant === 'note') {
      // Advance melodic note counter on every bounce so it plays a varied musical progression
      SolidBlock.noteSequenceIndex = ((SolidBlock.noteSequenceIndex || 0) + 1) % 16;
      const heightOffset = Math.max(0, Math.round((480 - this.y) / 80));
      const notePitch = (SolidBlock.noteSequenceIndex + heightOffset) % 16;
      sounds.playMusicNote(notePitch);
      if (typeof window !== 'undefined' && window.sidehop && window.sidehop.spawnMusicNoteParticle) {
        window.sidehop.spawnMusicNoteParticle(this.x + this.width / 2, this.y);
      }
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

  getNeighbors() {
    const app = (typeof window !== 'undefined' && window.sidehop);
    if (!SolidBlock.terrainMapActive || SolidBlock.terrainMapDirty || SolidBlock.terrainMap.size === 0) {
      if (app && app.entities) {
        SolidBlock.updateTerrainMap(app.entities);
      }
    }
    const col = Math.round(this.x / 40);
    const row = Math.round(this.y / 40);

    const isSolidOpaque = (ent) => {
      if (!ent || !ent.active) return false;
      return ent.variant !== 'cloud' && ent.variant !== 'semisolid';
    };

    const topEnt = SolidBlock.terrainMap.get(`${col},${row - 1}`);
    const bottomEnt = SolidBlock.terrainMap.get(`${col},${row + 1}`);
    const leftEnt = SolidBlock.terrainMap.get(`${col - 1},${row}`);
    const rightEnt = SolidBlock.terrainMap.get(`${col + 1},${row}`);

    const myMat = this.effectiveMaterial;
    const isSlope = this.isSlope;
    const myDir = this.slopeDirection;

    const matchesMat = (ent) => {
      if (!ent || !isSolidOpaque(ent)) return false;
      const otherMat = ent.effectiveMaterial;
      if (myMat === 'stone') return otherMat === 'stone';
      if (myMat === 'ice') return otherMat === 'ice';
      // For general terrain/dirt/ground: matches other general terrain
      return otherMat !== 'stone' && otherMat !== 'ice';
    };

    // 1. Top face (along y = 0, width = 40):
    //    Present on: square blocks, slope_ceil_up, and slope_ceil_down.
    //    Touches neighbor's bottom face on: square blocks, slope_up, and slope_down.
    const myHasTopFace = (!isSlope || myDir === 'ceil_up' || myDir === 'ceil_down');
    const topHasBottomFace = Boolean(topEnt && (!topEnt.isSlope || topEnt.slopeDirection === 'up' || topEnt.slopeDirection === 'down'));
    const hasTop = Boolean(myHasTopFace && topHasBottomFace && matchesMat(topEnt));

    // 2. Bottom face (along y = 40, width = 40):
    //    Present on: square blocks, slope_up, and slope_down.
    //    Touches neighbor's top face on: square blocks, slope_ceil_up, and slope_ceil_down.
    const myHasBottomFace = (!isSlope || myDir === 'up' || myDir === 'down');
    const bottomHasTopFace = Boolean(bottomEnt && (!bottomEnt.isSlope || bottomEnt.slopeDirection === 'ceil_up' || bottomEnt.slopeDirection === 'ceil_down'));
    const hasBottom = Boolean(myHasBottomFace && bottomHasTopFace && matchesMat(bottomEnt));

    // 3. Left face (along x = 0, height = 40):
    //    Present on: square blocks, slope_down, and slope_ceil_up.
    //    Touches neighbor's right face on: square blocks, slope_up, and slope_ceil_down.
    const myHasLeftFace = (!isSlope || myDir === 'down' || myDir === 'ceil_up');
    const leftHasRightFace = Boolean(leftEnt && (!leftEnt.isSlope || leftEnt.slopeDirection === 'up' || leftEnt.slopeDirection === 'ceil_down'));
    const hasLeft = Boolean(myHasLeftFace && leftHasRightFace && matchesMat(leftEnt));

    // 4. Right face (along x = 40, height = 40):
    //    Present on: square blocks, slope_up, and slope_ceil_down.
    //    Touches neighbor's left face on: square blocks, slope_down, and slope_ceil_up.
    const myHasRightFace = (!isSlope || myDir === 'up' || myDir === 'ceil_down');
    const rightHasLeftFace = Boolean(rightEnt && (!rightEnt.isSlope || rightEnt.slopeDirection === 'down' || rightEnt.slopeDirection === 'ceil_up'));
    const hasRight = Boolean(myHasRightFace && rightHasLeftFace && matchesMat(rightEnt));

    return { hasTop, hasBottom, hasLeft, hasRight, topEnt, bottomEnt, leftEnt, rightEnt };
  }

  static getThemePalette() {
    const theme = (typeof window !== 'undefined' && (window.sidehop?.currentTheme || window.__SIDEHOP_THEME__)) || 'grass';
    switch (theme) {
      case 'snowy':
        return {
          theme: 'snowy',
          dirtBase: '#475569',
          speckDark: '#1E293B',
          speckLight: '#CBD5E1',
          speckMid: '#64748B',
          turfMain: '#FFFFFF',
          turfHighlight: '#F8FAFC',
          turfShadow: '#CBD5E1',
          speckAccent: '#BAE6FD'
        };
      case 'night':
        return {
          theme: 'night',
          dirtBase: '#111827',
          speckDark: '#030712',
          speckLight: '#818CF8',
          speckMid: '#38BDF8',
          turfMain: '#312E81',
          turfHighlight: '#4338CA',
          turfShadow: '#1E1B4B',
          speckAccent: '#A855F7'
        };
      case 'chrome':
        return {
          theme: 'chrome',
          dirtBase: '#475569',
          speckDark: '#1E293B',
          speckLight: '#F1F5F9',
          speckMid: '#94A3B8',
          turfMain: '#CBD5E1',
          turfHighlight: '#FFFFFF',
          turfShadow: '#334155',
          speckAccent: '#00E5FF'
        };
      case '8-bit':
        return {
          theme: '8-bit',
          dirtBase: '#B85000',
          speckDark: '#502000',
          speckLight: '#F8B800',
          speckMid: '#D82800',
          turfMain: '#00A800',
          turfHighlight: '#58F858',
          turfShadow: '#006800',
          speckAccent: '#FCFCFC'
        };
      case 'jungle':
        return {
          theme: 'jungle',
          dirtBase: '#1B382B',
          speckDark: '#0D1F17',
          speckLight: '#74C69D',
          speckMid: '#2D6A4F',
          turfMain: '#105238',
          turfHighlight: '#52B788',
          turfShadow: '#081C15',
          speckAccent: '#FFD166'
        };
      case 'neon':
        return {
          theme: 'neon',
          dirtBase: '#08080E',
          speckDark: '#020204',
          speckLight: '#00E5FF',
          speckMid: '#FF007F',
          turfMain: '#00E5FF',
          turfHighlight: '#80F2FF',
          turfShadow: '#007A8A',
          speckAccent: '#00FF66'
        };
      case 'atlantis':
        return {
          theme: 'atlantis',
          dirtBase: '#05233A',
          speckDark: '#02121E',
          speckLight: '#38BDF8',
          speckMid: '#0284C7',
          turfMain: '#0284C7',
          turfHighlight: '#38BDF8',
          turfShadow: '#03456B',
          speckAccent: '#2DD4BF'
        };
      case 'uncanny':
      case 'mixed':
        return {
          theme: 'uncanny',
          dirtBase: '#3A2314',
          speckDark: '#1C0F07',
          speckLight: '#8C6239',
          speckMid: '#5C3A21',
          turfMain: '#4D9E2A',
          turfHighlight: '#8CE063',
          turfShadow: '#1E4611',
          speckAccent: '#A3E635'
        };
      case 'grass':
      default:
        return {
          theme: 'grass',
          dirtBase: '#866043',
          speckDark: '#5D4037',
          speckLight: '#9C724E',
          speckMid: '#6D4C41',
          turfMain: '#558B2F',
          turfHighlight: '#7CB342',
          turfShadow: '#33691E',
          speckAccent: '#558B2F'
        };
    }
  }

  // Ensure square block assets remain in their physical block shape when an image or GIF is applied
  renderCustomOrFallback(ctx, fallbackDrawFn) {
    if (this.customImageElement && this.customImageElement.complete && this.customImageElement.naturalWidth > 0 && this.customImageElement.naturalHeight > 0) {
      try {
        ctx.save();
        try {
          const pal = SolidBlock.getThemePalette();

          if (this.isSlope && this.slopeDirection === 'up') {
            // 45° Incline Triangle Clipping
            ctx.beginPath();
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.fillStyle = pal.dirtBase;
            ctx.fill();
            ctx.clip();
          } else if (this.isSlope && this.slopeDirection === 'down') {
            // 45° Decline Triangle Clipping
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, this.height);
            ctx.lineTo(0, this.height);
            ctx.closePath();
            ctx.fillStyle = pal.dirtBase;
            ctx.fill();
            ctx.clip();
          } else if (this.isSlope && this.slopeDirection === 'ceil_up') {
            // 45° Inverted Incline Triangle Clipping (Top-Left)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(0, this.height);
            ctx.closePath();
            ctx.fillStyle = pal.dirtBase;
            ctx.fill();
            ctx.clip();
          } else if (this.isSlope && this.slopeDirection === 'ceil_down') {
            // 45° Inverted Decline Triangle Clipping (Top-Right)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.fillStyle = pal.dirtBase;
            ctx.fill();
            ctx.clip();
          } else {
            // Square & rectangular blocks: retain solid square block shape
            ctx.fillStyle = pal.dirtBase; // Themed block base backing
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.beginPath();
            ctx.rect(0, 0, this.width, this.height);
            ctx.clip();
          }

          // Draw custom visual using Aspect-Ratio Preserving Cover Mode
          const img = this.customImageElement;
          const imgW = img.naturalWidth || this.width;
          const imgH = img.naturalHeight || this.height;
          const scale = (imgW > 0 && imgH > 0) ? Math.max(this.width / imgW, this.height / imgH) : 1;
          const dw = imgW * scale;
          const dh = imgH * scale;
          const dx = (this.width - dw) / 2;
          const dy = (this.height - dh) / 2;

          ctx.drawImage(img, dx, dy, dw, dh);
        } finally {
          ctx.restore();
        }

        // Outer neo-brutalist border and bevel so the block retains its physical block appearance
        ctx.save();
        try {
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          if (this.isSlope && this.slopeDirection === 'up') {
            ctx.beginPath();
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.stroke();
          } else if (this.isSlope && this.slopeDirection === 'down') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, this.height);
            ctx.lineTo(0, this.height);
            ctx.closePath();
            ctx.stroke();
          } else if (this.isSlope && this.slopeDirection === 'ceil_up') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(0, this.height);
            ctx.closePath();
            ctx.stroke();
          } else if (this.isSlope && this.slopeDirection === 'ceil_down') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
            ctx.closePath();
            ctx.stroke();
          } else {
            ctx.strokeRect(0, 0, this.width, this.height);

            // Subtle top bevel highlight for 3D physical block depth
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(2, 2, this.width - 4, 3);
            // Subtle bottom bevel shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(2, this.height - 5, this.width - 4, 3);
          }
        } finally {
          ctx.restore();
        }
        return;
      } catch (err) {
        console.warn('SolidBlock custom image render failed:', err);
      }
    }
    fallbackDrawFn();
  }

  draw(ctx) {
    ctx.save();
    try {
      ctx.translate(this.x + (this.shakeOffsetX || 0), this.y + (this.bumpOffsetY || 0));

      this.renderCustomOrFallback(ctx, () => {
      const pal = SolidBlock.getThemePalette();

      // 1. SLANT UP (45° Incline /)
      if (this.isSlope && this.slopeDirection === 'up') {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        const mat = this.effectiveMaterial;

        if (mat === 'stone') {
          // Castle Stone Slope Up (matches gray stone masonry bevels)
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), this.height + (hasBottom ? 0.5 : 0));
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), 0);
          ctx.closePath();
          ctx.fillStyle = '#9E9E9E';
          ctx.fill();

          // Chiseled highlights & shadows
          ctx.strokeStyle = '#EEEEEE';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), 0);
          ctx.stroke();

          ctx.strokeStyle = '#616161';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height - 2);
            ctx.lineTo(this.width, this.height - 2);
          }
          ctx.stroke();

          // Central carving bevel matching stone block's inner cross/square
          ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(12, this.height - 6);
          ctx.lineTo(this.width - 10, 16);
          ctx.lineTo(this.width - 10, this.height - 6);
          ctx.closePath();
          ctx.stroke();

          // Outer outlines ONLY on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        } else if (mat === 'ice') {
          // Slippery Ice Slope Up (seamlessly blends with adjacent Ice Blocks)
          const xRight = this.width + (hasRight ? 0.5 : 0);
          const yBottom = this.height + (hasBottom ? 0.5 : 0);

          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(xRight, 0);
          ctx.lineTo(xRight, yBottom);
          ctx.lineTo(0, yBottom);
          ctx.closePath();
          ctx.fillStyle = this.color || '#B2EBF2'; // Matching Ice Block base
          ctx.fill();

          // Angled Top Glossy Sheen Band:
          // Rises up along the 45° incline and meets right neighbor at (this.width, 0..8)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.lineTo(this.width, 8);
          ctx.lineTo(6, this.height);
          ctx.closePath();
          ctx.fill();

          // Top edge white specular line
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.stroke();

          // Crystalline facet chevron matching Ice Block's cyan style
          ctx.strokeStyle = 'rgba(0, 184, 212, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(14, this.height - 4);
          ctx.lineTo(this.width - 18, this.height / 2 + 2);
          ctx.lineTo(this.width - 10, this.height - 10);
          ctx.stroke();

          // Outlines ONLY on exposed faces!
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        } else {
          // Base Dirt Fill
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), this.height + (hasBottom ? 0.5 : 0));
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), 0);
          ctx.closePath();
          ctx.fillStyle = pal.dirtBase;
          ctx.fill();

          // Dirt specks inside lower-right half of triangle
          ctx.fillStyle = pal.speckDark;
          ctx.fillRect(26, 26, 4, 3);
          ctx.fillRect(33, 14, 3, 4);
          ctx.fillStyle = pal.speckLight;
          ctx.fillRect(18, 30, 4, 3);
          ctx.fillStyle = pal.speckMid;
          ctx.fillRect(32, 28, 4, 3);

          // Theme-specific turf / band along angled hypotenuse:
          // Ends at (this.width, 0) spanning y=0 to y=8 at x=this.width (matching solid block's 8px turf cap!)
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.lineTo(this.width, 8);
          ctx.lineTo(6, this.height);
          ctx.closePath();
          ctx.fillStyle = pal.turfMain;
          ctx.fill();

          // Turf top highlight
          ctx.strokeStyle = pal.turfHighlight;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.stroke();

          // Turf underside shadow edge
          ctx.strokeStyle = pal.turfShadow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(6, this.height);
          ctx.lineTo(this.width, 8);
          ctx.stroke();

          // Turf fringe droplets into dirt
          ctx.fillStyle = pal.turfMain;
          ctx.fillRect(16, 22, 4, 3);
          ctx.fillRect(26, 12, 4, 3);
          ctx.fillStyle = pal.turfShadow;
          ctx.fillRect(16, 24, 4, 1);
          ctx.fillRect(26, 14, 4, 1);

          // Outlines (only exposed faces)
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        }
      }

      // 2. SLANT DOWN (45° Decline \)
      else if (this.isSlope && this.slopeDirection === 'down') {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        const mat = this.effectiveMaterial;
        const xLeft = hasLeft ? -0.5 : 0;
        const yBottom = this.height + (hasBottom ? 0.5 : 0);

        if (mat === 'stone') {
          // Castle Stone Slope Down
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(xLeft, 0);
          ctx.lineTo(xLeft, yBottom);
          ctx.lineTo(this.width, yBottom);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fillStyle = '#9E9E9E';
          ctx.fill();

          // Chiseled bevel highlight along hypotenuse (meets top highlight of left stone block at 0,0)
          ctx.strokeStyle = '#EEEEEE';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.stroke();

          ctx.strokeStyle = '#616161';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height - 2);
            ctx.lineTo(this.width, this.height - 2);
          }
          ctx.stroke();

          // Central carving bevel matching stone block's inner cross/square
          ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(10, 16);
          ctx.lineTo(this.width - 12, this.height - 6);
          ctx.lineTo(10, this.height - 6);
          ctx.closePath();
          ctx.stroke();

          // Outer outlines ONLY on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        } else if (mat === 'ice') {
          // Slippery Ice Slope Down (seamlessly blends with adjacent Ice Blocks)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(xLeft, 0);
          ctx.lineTo(xLeft, yBottom);
          ctx.lineTo(this.width, yBottom);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fillStyle = this.color || '#B2EBF2'; // Matching Ice Block base
          ctx.fill();

          // Angled Top Glossy Sheen Band:
          // Starts at (0, 0) spanning y=0 to y=8 at x=0 (matching ice block's 8px gloss bar)
          // and flows smoothly down along the 45° incline to (this.width, this.height)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.lineTo(this.width - 6, this.height);
          ctx.lineTo(0, 8);
          ctx.closePath();
          ctx.fill();

          // Top edge white specular line
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.stroke();

          // Crystalline facet chevron matching Ice Block's cyan style
          ctx.strokeStyle = 'rgba(0, 184, 212, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(10, this.height - 10);
          ctx.lineTo(18, this.height / 2 + 2);
          ctx.lineTo(this.width - 14, this.height - 4);
          ctx.stroke();

          // Outlines ONLY on exposed faces!
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        } else {
          // Base Dirt Fill
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(xLeft, 0);
          ctx.lineTo(xLeft, yBottom);
          ctx.lineTo(this.width, yBottom);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fillStyle = pal.dirtBase;
          ctx.fill();

          // Dirt specks inside lower-left half of triangle
          ctx.fillStyle = pal.speckDark;
          ctx.fillRect(10, 26, 4, 3);
          ctx.fillRect(4, 14, 3, 4);
          ctx.fillStyle = pal.speckLight;
          ctx.fillRect(18, 30, 4, 3);
          ctx.fillRect(4, 28, 4, 3);

          // Theme-specific turf / band along angled hypotenuse:
          // Starts at (0, 0) spanning y=0 to y=8 at x=0 (matching solid block's 8px turf cap!)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.lineTo(this.width - 6, this.height);
          ctx.lineTo(0, 8);
          ctx.closePath();
          ctx.fillStyle = pal.turfMain;
          ctx.fill();

          // Turf top highlight
          ctx.strokeStyle = pal.turfHighlight;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.stroke();

          // Turf underside shadow edge
          ctx.strokeStyle = pal.turfShadow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.lineTo(this.width - 6, this.height);
          ctx.stroke();

          // Turf fringe droplets into dirt
          ctx.fillStyle = pal.turfMain;
          ctx.fillRect(8, 12, 4, 3);
          ctx.fillRect(18, 22, 4, 3);
          ctx.fillStyle = pal.turfShadow;
          ctx.fillRect(8, 14, 4, 1);
          ctx.fillRect(18, 24, 4, 1);

          // Outlines (only exposed faces)
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);

          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          if (!hasBottom) {
            ctx.moveTo(0, this.height);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        }
      }

      // 3. SLANT CEILING UP (45° Inverted Incline ◤ - smooth underside for slope_up)
      else if (this.isSlope && this.slopeDirection === 'ceil_up') {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        const mat = this.effectiveMaterial;
        const xLeft = hasLeft ? -0.5 : 0;
        const yTop = hasTop ? -0.5 : 0;

        if (mat === 'stone') {
          // Castle Stone Inverted Slope Up
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(xLeft, this.height);
          ctx.lineTo(xLeft, yTop);
          ctx.lineTo(this.width, yTop);
          ctx.lineTo(this.width, 0);
          ctx.closePath();
          ctx.fillStyle = '#9E9E9E';
          ctx.fill();

          // Underside chiseled highlight
          ctx.strokeStyle = '#EEEEEE';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.stroke();

          ctx.strokeStyle = '#616161';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasTop) {
            ctx.moveTo(0, 2);
            ctx.lineTo(this.width, 2);
          }
          if (!hasLeft) {
            ctx.moveTo(2, 0);
            ctx.lineTo(2, this.height);
          }
          ctx.stroke();

          // Central carving bevel
          ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(8, 8);
          ctx.lineTo(this.width - 14, 8);
          ctx.lineTo(8, this.height - 14);
          ctx.closePath();
          ctx.stroke();

          // Outlines on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          if (!hasTop) {
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
          }
          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          ctx.stroke();
        } else if (mat === 'ice') {
          // Slippery Ice Inverted Slope Up (seamless underside for slope_up)
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(xLeft, this.height);
          ctx.lineTo(xLeft, yTop);
          ctx.lineTo(this.width, yTop);
          ctx.lineTo(this.width, 0);
          ctx.closePath();
          ctx.fillStyle = this.color || '#B2EBF2'; // Matching Ice Block base
          ctx.fill();

          // Underside Glossy Sheen Band:
          // Follows the 45° diagonal underside from (0, this.height) to (this.width, 0)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.lineTo(this.width - 8, 0);
          ctx.lineTo(0, this.height - 8);
          ctx.closePath();
          ctx.fill();

          // Underside edge white specular line
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.stroke();

          // Crystalline facet chevron matching Ice Block cyan style
          ctx.strokeStyle = 'rgba(0, 184, 212, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(8, 10);
          ctx.lineTo(18, 16);
          ctx.lineTo(24, 6);
          ctx.stroke();

          // Outlines ONLY on exposed faces!
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          if (!hasTop) {
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
          }
          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          ctx.stroke();
        } else {
          // Themed Dirt Fill
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(xLeft, this.height);
          ctx.lineTo(xLeft, yTop);
          ctx.lineTo(this.width, yTop);
          ctx.lineTo(this.width, 0);
          ctx.closePath();
          ctx.fillStyle = pal.dirtBase;
          ctx.fill();

          // Dirt specks inside top-left triangle
          ctx.fillStyle = pal.speckDark;
          ctx.fillRect(8, 10, 4, 3);
          ctx.fillRect(16, 6, 3, 4);
          ctx.fillStyle = pal.speckLight;
          ctx.fillRect(12, 18, 4, 3);
          ctx.fillStyle = pal.speckMid;
          ctx.fillRect(6, 24, 4, 3);

          // Turf cap ONLY if top is exposed (!hasTop)
          if (!hasTop) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(this.width, 6);
            ctx.lineTo(0, 8);
            ctx.closePath();
            ctx.fillStyle = pal.turfMain;
            ctx.fill();

            ctx.strokeStyle = pal.turfHighlight;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.stroke();
          }

          // Underside shadow band along diagonal
          ctx.strokeStyle = pal.turfShadow;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          ctx.stroke();

          // Outlines on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, 0);
          if (!hasTop) {
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
          }
          if (!hasLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.height);
          }
          ctx.stroke();
        }
      }

      // 4. SLANT CEILING DOWN (45° Inverted Decline ◥ - smooth underside for slope_down)
      else if (this.isSlope && this.slopeDirection === 'ceil_down') {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        const mat = this.effectiveMaterial;
        const xRight = this.width + (hasRight ? 0.5 : 0);
        const yTop = hasTop ? -0.5 : 0;

        if (mat === 'stone') {
          // Castle Stone Inverted Slope Down
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, yTop);
          ctx.lineTo(xRight, yTop);
          ctx.lineTo(xRight, this.height);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fillStyle = '#9E9E9E';
          ctx.fill();

          // Underside chiseled highlight
          ctx.strokeStyle = '#EEEEEE';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.stroke();

          ctx.strokeStyle = '#616161';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasTop) {
            ctx.moveTo(0, 2);
            ctx.lineTo(this.width, 2);
          }
          if (!hasRight) {
            ctx.moveTo(this.width - 2, 0);
            ctx.lineTo(this.width - 2, this.height);
          }
          ctx.stroke();

          // Central carving bevel
          ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(this.width - 8, 8);
          ctx.lineTo(14, 8);
          ctx.lineTo(this.width - 8, this.height - 14);
          ctx.closePath();
          ctx.stroke();

          // Outlines on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          if (!hasTop) {
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
          }
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        } else if (mat === 'ice') {
          // Slippery Ice Inverted Slope Down (seamless underside for slope_down)
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, yTop);
          ctx.lineTo(xRight, yTop);
          ctx.lineTo(xRight, this.height);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fillStyle = this.color || '#B2EBF2'; // Matching Ice Block base
          ctx.fill();

          // Underside Glossy Sheen Band:
          // Follows the 45° diagonal underside from (0, 0) to (this.width, this.height)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(8, 0);
          ctx.lineTo(this.width, this.height - 8);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fill();

          // Underside edge white specular line
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.stroke();

          // Crystalline facet chevron matching Ice Block cyan style
          ctx.strokeStyle = 'rgba(0, 184, 212, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(this.width - 8, 10);
          ctx.lineTo(this.width - 18, 16);
          ctx.lineTo(this.width - 24, 6);
          ctx.stroke();

          // Outlines ONLY on exposed faces!
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          if (!hasTop) {
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
          }
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        } else {
          // Themed Dirt Fill
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, yTop);
          ctx.lineTo(xRight, yTop);
          ctx.lineTo(xRight, this.height);
          ctx.lineTo(this.width, this.height);
          ctx.closePath();
          ctx.fillStyle = pal.dirtBase;
          ctx.fill();

          // Dirt specks inside top-right triangle
          ctx.fillStyle = pal.speckDark;
          ctx.fillRect(this.width - 12, 10, 4, 3);
          ctx.fillRect(this.width - 19, 6, 3, 4);
          ctx.fillStyle = pal.speckLight;
          ctx.fillRect(this.width - 16, 18, 4, 3);
          ctx.fillStyle = pal.speckMid;
          ctx.fillRect(this.width - 10, 24, 4, 3);

          // Turf cap ONLY if top is exposed (!hasTop)
          if (!hasTop) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.lineTo(this.width, 8);
            ctx.lineTo(0, 6);
            ctx.closePath();
            ctx.fillStyle = pal.turfMain;
            ctx.fill();

            ctx.strokeStyle = pal.turfHighlight;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
            ctx.stroke();
          }

          // Underside shadow band along diagonal
          ctx.strokeStyle = pal.turfShadow;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.stroke();

          // Outlines on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, this.height);
          if (!hasTop) {
            ctx.moveTo(0, 0);
            ctx.lineTo(this.width, 0);
          }
          if (!hasRight) {
            ctx.moveTo(this.width, 0);
            ctx.lineTo(this.width, this.height);
          }
          ctx.stroke();
        }
      }

      // 3. SEMI-SOLID PLATFORM (Mario Maker Wood Boardwalk / 3D Trestle Workbench)
      else if (this.variant === 'semisolid') {
        if (pal.theme === 'uncanny') {
          // 3D Diorama Wooden Trestle Workbench Platform with Glowing Red LED Indicator Dots!
          // Soft 3D cast drop shadow underneath top beam
          ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
          ctx.fillRect(2, 12, this.width - 2, 5);

          // 3D cylindrical wooden trestle legs with shaded grain
          const legGradL = ctx.createLinearGradient(5, 12, 13, 12);
          legGradL.addColorStop(0, '#B4845C');
          legGradL.addColorStop(0.5, '#7C4D2B');
          legGradL.addColorStop(1, '#3E2211');
          ctx.fillStyle = legGradL;
          ctx.fillRect(5, 12, 8, this.height - 12);

          const legGradR = ctx.createLinearGradient(this.width - 13, 12, this.width - 5, 12);
          legGradR.addColorStop(0, '#B4845C');
          legGradR.addColorStop(0.5, '#7C4D2B');
          legGradR.addColorStop(1, '#3E2211');
          ctx.fillStyle = legGradR;
          ctx.fillRect(this.width - 13, 12, 8, this.height - 12);

          // Cross brace timber with 3D bevel
          const braceGrad = ctx.createLinearGradient(0, this.height - 11, 0, this.height - 4);
          braceGrad.addColorStop(0, '#9C6B43');
          braceGrad.addColorStop(1, '#4A2812');
          ctx.fillStyle = braceGrad;
          ctx.fillRect(5, this.height - 10, this.width - 10, 6);

          // 3D Beveled Hardwood / Anodized Top Rail
          const railGrad = ctx.createLinearGradient(0, 0, 0, 12);
          railGrad.addColorStop(0, '#E6C29F');
          railGrad.addColorStop(0.25, '#C89666');
          railGrad.addColorStop(0.8, '#85522B');
          railGrad.addColorStop(1, '#43230E');
          ctx.fillStyle = railGrad;
          ctx.beginPath();
          ctx.roundRect(0, 0, this.width, 12, 3);
          ctx.fill();
          ctx.strokeStyle = '#261206';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // 3 Glowing Red LED Indicator Lights along the top rail (from the sketches!)
          [this.width * 0.24, this.width * 0.5, this.width * 0.76].forEach(lx => {
            const ledGlow = ctx.createRadialGradient(lx, 6, 0.5, lx, 6, 5.5);
            ledGlow.addColorStop(0, '#FFFFFF');
            ledGlow.addColorStop(0.35, '#FF2A55');
            ledGlow.addColorStop(1, 'rgba(255, 42, 85, 0)');
            ctx.fillStyle = ledGlow;
            ctx.beginPath();
            ctx.arc(lx, 6, 5.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(lx, 6, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(lx - 0.7, 5.3, 0.9, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
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
      }

      // 4. HALF SLAB (40×20 Stepping Stone)
      else if (this.variant === 'slab') {
        const { hasTop } = this.getNeighbors();
        // Base dirt
        ctx.fillStyle = '#866043';
        ctx.fillRect(0, 0, this.width, this.height);

        // Specks
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(8, 12, 4, 3);
        ctx.fillStyle = '#9C724E';
        ctx.fillRect(24, 10, 4, 3);

        // Grass cap if not covered
        if (!hasTop) {
          ctx.fillStyle = '#558B2F';
          ctx.fillRect(0, 0, this.width, 6);

          ctx.fillStyle = '#7CB342';
          ctx.fillRect(0, 0, this.width, 2);

          ctx.fillStyle = '#33691E';
          ctx.fillRect(0, 5, this.width, 1);

          ctx.fillStyle = '#558B2F';
          ctx.fillRect(6, 6, 4, 2);
          ctx.fillRect(22, 6, 4, 2);
        }

        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, this.width, this.height);
      }

      // 5. MEGA BLOCK (80×80 2×2 Giant Terrain Block)
      else if (this.variant === 'mega') {
        ctx.fillStyle = '#866043';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 4;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Top lush grass cap
        ctx.fillStyle = '#558B2F';
        ctx.fillRect(0, 0, this.width, 14);
        ctx.fillStyle = '#7CB342';
        ctx.fillRect(0, 0, this.width, 3);
        ctx.fillStyle = '#33691E';
        ctx.fillRect(0, 13, this.width, 2);

        // Drooping grass fringe
        ctx.fillStyle = '#558B2F';
        for (let fx = 8; fx < this.width - 8; fx += 14) {
          ctx.fillRect(fx, 14, 6, 5);
        }

        // 4 interior quadrants
        ctx.strokeStyle = 'rgba(18, 18, 18, 0.3)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2); ctx.lineTo(this.width, this.height / 2);
        ctx.moveTo(this.width / 2, 14); ctx.lineTo(this.width / 2, this.height);
        ctx.stroke();

        // Center golden medallion
        ctx.fillStyle = '#FFE600';
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
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
        if (pal.theme === 'uncanny') {
          // 3D Torus Bakery Donut with Glossy Pink Strawberry Glaze & 3D Sugar Sprinkles!
          const cx = this.width / 2;
          const cy = this.height / 2;

          // 3D drop shadow beneath donut
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.arc(cx + 2, cy + 3, 18.5, 0, Math.PI * 2);
          ctx.fill();

          // Warm golden fried dough base torus
          const doughGrad = ctx.createRadialGradient(cx - 4, cy - 4, 5, cx, cy, 18.5);
          doughGrad.addColorStop(0, '#FDE68A');
          doughGrad.addColorStop(0.65, '#D97706');
          doughGrad.addColorStop(1, '#78350F');
          ctx.fillStyle = doughGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 18.5, 0, Math.PI * 2);
          ctx.arc(cx, cy, 6.2, 0, Math.PI * 2, true);
          ctx.fill();

          // Glossy 3D Pink Strawberry Icing Glaze
          const icingGrad = ctx.createRadialGradient(cx - 5, cy - 6, 3, cx, cy, 17);
          icingGrad.addColorStop(0, '#FBCFE8');
          icingGrad.addColorStop(0.35, '#F472B6');
          icingGrad.addColorStop(0.8, '#DB2777');
          icingGrad.addColorStop(1, '#831843');
          ctx.fillStyle = icingGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 16.8, 0, Math.PI * 2);
          ctx.arc(cx, cy, 7.2, 0, Math.PI * 2, true);
          ctx.fill();

          // Raytraced curved specular highlight ring on glaze
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(cx, cy, 12.5, Math.PI * 1.12, Math.PI * 1.72);
          ctx.stroke();

          // 3D Pill Sprinkles with tiny cast shadows
          const sprinkles = [
            [-10, -8, 0.4, '#FEF08A'],
            [8, -9, -0.5, '#38BDF8'],
            [-11, 6, -0.3, '#4ADE80'],
            [9, 7, 0.6, '#FFFFFF'],
            [0, -12, 0.1, '#FB7185'],
            [1, 11, -0.2, '#FACC15']
          ];
          sprinkles.forEach(([sx, sy, rot, sCol]) => {
            ctx.save();
            ctx.translate(cx + sx, cy + sy);
            ctx.rotate(rot);
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(-2.5, -0.5, 5, 2.2);
            ctx.fillStyle = sCol;
            ctx.beginPath();
            ctx.roundRect(-2.5, -1, 5, 2, 1);
            ctx.fill();
            ctx.restore();
          });
        } else {
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
        const { hasTop, hasBottom, hasLeft, hasRight, rightEnt, bottomEnt } = this.getNeighbors();

        if (pal.theme === 'uncanny') {
          // 3D Brushed Industrial Titanium / Steel Junction Block with Recessed Square & Hex Rivets
          if (!hasBottom) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
            ctx.fillRect(2, this.height, this.width - 2, 5);
          }
          const metalGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
          metalGrad.addColorStop(0, '#E2E8F0');
          metalGrad.addColorStop(0.45, '#94A3B8');
          metalGrad.addColorStop(0.85, '#475569');
          metalGrad.addColorStop(1, '#1E293B');
          ctx.fillStyle = metalGrad;
          ctx.fillRect(0, 0, this.width, this.height);

          // 3D Bevel highlights & shadows
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fillRect(0, 0, this.width, 3);
          ctx.fillRect(0, 0, 3, this.height);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
          ctx.fillRect(0, this.height - 3, this.width, 3);
          ctx.fillRect(this.width - 3, 0, 3, this.height);

          // Recessed inner machined square panel
          ctx.fillStyle = '#64748B';
          ctx.fillRect(9, 9, this.width - 18, this.height - 18);
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(9, 9, this.width - 18, this.height - 18);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.strokeRect(10.5, 10.5, this.width - 21, this.height - 21);

          // 4 Corner machined hex bolts
          [ [5, 5], [this.width - 5, 5], [5, this.height - 5], [this.width - 5, this.height - 5] ].forEach(([bx, by]) => {
            ctx.fillStyle = '#0F172A';
            ctx.beginPath();
            ctx.arc(bx + 0.5, by + 0.8, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F8FAFC';
            ctx.beginPath();
            ctx.arc(bx, by, 2.0, 0, Math.PI * 2);
            ctx.fill();
          });

          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(0, 0, this.width, this.height);
        } else {
          // Base fill with seamless 0.5px overlap on connecting edges
          const xStart = hasLeft ? -0.5 : 0;
          const yStart = hasTop ? -0.5 : 0;
          const fillW = this.width + (hasRight ? 0.5 : 0) - xStart;
          const fillH = this.height + (hasBottom ? 0.5 : 0) - yStart;
          ctx.fillStyle = '#9E9E9E';
          ctx.fillRect(xStart, yStart, fillW, fillH);

          // Chiseled highlights on top & left
          ctx.strokeStyle = '#EEEEEE';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasTop) {
            ctx.moveTo(hasLeft ? 0 : 3, 3);
            ctx.lineTo(hasRight ? this.width : this.width - 3, 3);
          }
          if (!hasLeft) {
            ctx.moveTo(3, hasTop ? 0 : 3);
            ctx.lineTo(3, hasBottom ? this.height : this.height - 3);
          }
          ctx.stroke();

          // Chiseled shadows on right & bottom
          ctx.strokeStyle = '#616161';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasRight) {
            ctx.moveTo(this.width - 3, hasTop ? 0 : 3);
            ctx.lineTo(this.width - 3, hasBottom ? this.height : this.height - 3);
          }
          if (!hasBottom) {
            ctx.moveTo(hasLeft ? 0 : 3, this.height - 3);
            ctx.lineTo(hasRight ? this.width : this.width - 3, this.height - 3);
          }
          ctx.stroke();

          // Subtle masonry mortar seams between adjacent stone blocks
          if (hasRight && rightEnt && !rightEnt.isSlope) {
            ctx.strokeStyle = 'rgba(18, 18, 18, 0.28)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.width, 0); ctx.lineTo(this.width, this.height);
            ctx.stroke();
          }
          if (hasBottom && bottomEnt && !bottomEnt.isSlope) {
            ctx.strokeStyle = 'rgba(18, 18, 18, 0.28)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, this.height); ctx.lineTo(this.width, this.height);
            ctx.stroke();
          }

          // Central cross carving
          ctx.strokeStyle = 'rgba(18, 18, 18, 0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(12, 12, this.width - 24, this.height - 24);

          // Outlines ONLY on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          if (!hasTop) { ctx.moveTo(0, 0); ctx.lineTo(this.width, 0); }
          if (!hasBottom) { ctx.moveTo(0, this.height); ctx.lineTo(this.width, this.height); }
          if (!hasLeft) { ctx.moveTo(0, 0); ctx.lineTo(0, this.height); }
          if (!hasRight) { ctx.moveTo(this.width, 0); ctx.lineTo(this.width, this.height); }
          ctx.stroke();
        }
      }

      // 10. MYSTERY QUESTION BLOCK [?]
      else if (this.variant === 'mystery') {
        if (!this.isUsed) {
          if (pal.theme === 'uncanny') {
            // 3D Beveled Amber Gold Resin / Anodized Metal Cube with Embossed [?] & Corner Screws
            ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
            ctx.fillRect(3, this.height, this.width - 2, 5);

            const goldGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
            goldGrad.addColorStop(0, '#FEF08A');
            goldGrad.addColorStop(0.35, '#F59E0B');
            goldGrad.addColorStop(0.82, '#B45309');
            goldGrad.addColorStop(1, '#78350F');
            ctx.fillStyle = goldGrad;
            ctx.beginPath();
            ctx.roundRect(0, 0, this.width, this.height, 4);
            ctx.fill();

            // 3D Bevel Frame
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.fillRect(2, 2, this.width - 4, 3);
            ctx.fillRect(2, 2, 3, this.height - 4);
            ctx.fillStyle = 'rgba(69, 26, 3, 0.6)';
            ctx.fillRect(2, this.height - 5, this.width - 4, 3);
            ctx.fillRect(this.width - 5, 2, 3, this.height - 4);

            // Corner recessed screw heads
            [ [6, 6], [this.width - 6, 6], [6, this.height - 6], [this.width - 6, this.height - 6] ].forEach(([sx, sy]) => {
              ctx.fillStyle = '#451A03';
              ctx.beginPath();
              ctx.arc(sx, sy, 2.3, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#FDE68A';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(sx - 1.4, sy - 1.4);
              ctx.lineTo(sx + 1.4, sy + 1.4);
              ctx.stroke();
            });

            // 3D Embossed '?' Symbol
            ctx.font = '900 24px "Fredoka", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#451A03';
            ctx.fillText('?', this.width / 2 + 1.5, this.height / 2 + 2.5);
            ctx.fillStyle = '#FFFBEB';
            ctx.fillText('?', this.width / 2, this.height / 2 + 1);

            ctx.strokeStyle = '#451A03';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, this.width, this.height);
          } else {
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
          }
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
        if (pal.theme === 'uncanny') {
          // 3D Steamed White Bao Dumpling Platform with Pleated Dough Swirls & Bioluminescent Cyan/Mint Underglow!
          const cx = this.width / 2;

          // Volumetric Bioluminescent Mint/Cyan Neon Underglow (from the sketches!)
          const underGlow = ctx.createRadialGradient(cx, this.height - 4, 2, cx, this.height - 2, 24);
          underGlow.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
          underGlow.addColorStop(0.45, 'rgba(0, 229, 255, 0.55)');
          underGlow.addColorStop(1, 'rgba(0, 229, 255, 0)');
          ctx.fillStyle = underGlow;
          ctx.fillRect(-4, this.height - 14, this.width + 8, 22);

          // 3D Plump Steamed Bao Bun Body (warm subsurface dough shading)
          const baoGrad = ctx.createRadialGradient(cx - 5, 12, 3, cx, 22, 24);
          baoGrad.addColorStop(0, '#FFFFFF');
          baoGrad.addColorStop(0.55, '#F8FAFC');
          baoGrad.addColorStop(0.85, '#E2E8F0');
          baoGrad.addColorStop(1, '#94A3B8');
          ctx.fillStyle = baoGrad;

          ctx.beginPath();
          ctx.moveTo(3, this.height - 7);
          ctx.quadraticCurveTo(0, 14, cx * 0.45, 9);
          ctx.quadraticCurveTo(cx, 3, cx * 1.55, 9);
          ctx.quadraticCurveTo(this.width, 14, this.width - 3, this.height - 7);
          ctx.quadraticCurveTo(cx, this.height - 3, 3, this.height - 7);
          ctx.closePath();
          ctx.fill();

          // Delicate 3D Steamed Bao Pleat Creases radiating from top apex
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.42)';
          ctx.lineWidth = 1.3;
          [-12, -6, 0, 6, 12].forEach(dx => {
            ctx.beginPath();
            ctx.moveTo(cx + dx * 0.18, 7);
            ctx.quadraticCurveTo(cx + dx * 0.75, 14, cx + dx, 23);
            ctx.stroke();
          });

          // Tiny top bao twist dimple
          ctx.fillStyle = '#CBD5E1';
          ctx.beginPath();
          ctx.arc(cx, 7.5, 2.2, 0, Math.PI * 2);
          ctx.fill();

          // Crisp glowing mint-cyan neon light bar along bottom rim
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(5, this.height - 6);
          ctx.quadraticCurveTo(cx, this.height - 3, this.width - 5, this.height - 6);
          ctx.stroke();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(8, this.height - 6);
          ctx.quadraticCurveTo(cx, this.height - 3.5, this.width - 8, this.height - 6);
          ctx.stroke();
        } else {
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
      }

      // 12. ICE BLOCK
      else if (this.variant === 'ice') {
        const { hasTop, hasBottom, hasLeft, hasRight, rightEnt, bottomEnt } = this.getNeighbors();

        if (pal.theme === 'uncanny') {
          // 9-SLICE CONTINUOUS TRANSLUCENT GLACIAL / RAYTRACED REFRACTIVE ICE BLOCK
          // (Zero vertical seam lines between adjacent ice blocks, internal geometric refraction lattice, trapped air bubbles & 4-point specular starbursts!)
          const xStart = hasLeft ? -0.6 : 0;
          const yStart = hasTop ? -0.6 : 0;
          const fillW = this.width + (hasRight ? 0.6 : 0) - xStart;
          const fillH = this.height + (hasBottom ? 0.6 : 0) - yStart;

          if (!hasBottom) {
            // Cyan caustic light shadow cast underneath ice shelf
            ctx.fillStyle = 'rgba(14, 116, 144, 0.32)';
            ctx.fillRect(xStart, this.height, fillW, 5);
          }

          // Continuous translucent cyan-blue glacial gradient
          const iceGrad = ctx.createLinearGradient(0, 0, 0, this.height);
          iceGrad.addColorStop(0, 'rgba(165, 243, 252, 0.90)');
          iceGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.82)');
          iceGrad.addColorStop(1, 'rgba(2, 132, 199, 0.88)');
          ctx.fillStyle = iceGrad;
          ctx.fillRect(xStart, yStart, fillW, fillH);

          // Internal raytraced geometric crystal refraction facets (spanning continuously across neighbor tiles)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, 26);
          ctx.lineTo(18, 12);
          ctx.lineTo(this.width, 24);
          ctx.moveTo(18, 12);
          ctx.lineTo(28, 36);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(186, 230, 253, 0.32)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(6, 36);
          ctx.lineTo(28, 20);
          ctx.lineTo(this.width, 30);
          ctx.stroke();

          // Trapped micro air bubbles inside the glacial ice
          const col = Math.round(this.x / 40);
          const bShift = (col * 13) % 7;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.arc(10 + bShift, 22, 1.6, 0, Math.PI * 2);
          ctx.arc(27 - bShift * 0.5, 29, 1.1, 0, Math.PI * 2);
          ctx.fill();

          // Continuous glossy frost/specular top bevel cap
          if (!hasTop) {
            const capGrad = ctx.createLinearGradient(0, 0, 0, 10);
            capGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
            capGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            ctx.fillStyle = capGrad;
            ctx.fillRect(xStart, 0, fillW, 10);
          }

          // 4-Point SGI Raytraced Specular Starburst Glint on top-left crystal facet
          if (!hasTop && (col % 2 === 0)) {
            const gx = 12;
            const gy = 8;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(gx, gy - 6);
            ctx.lineTo(gx + 1.3, gy - 1.3);
            ctx.lineTo(gx + 6, gy);
            ctx.lineTo(gx + 1.3, gy + 1.3);
            ctx.lineTo(gx, gy + 6);
            ctx.lineTo(gx - 1.3, gy + 1.3);
            ctx.lineTo(gx - 6, gy);
            ctx.lineTo(gx - 1.3, gy - 1.3);
            ctx.closePath();
            ctx.fill();
          }

          // Outer crisp refractive rim ONLY on exposed boundary edges (9-slice continuous!)
          ctx.strokeStyle = '#0369A1';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (!hasTop) { ctx.moveTo(xStart, 0); ctx.lineTo(xStart + fillW, 0); }
          if (!hasBottom) { ctx.moveTo(xStart, this.height); ctx.lineTo(xStart + fillW, this.height); }
          if (!hasLeft) { ctx.moveTo(0, yStart); ctx.lineTo(0, yStart + fillH); }
          if (!hasRight) { ctx.moveTo(this.width, yStart); ctx.lineTo(this.width, yStart + fillH); }
          ctx.stroke();
        } else {
          // Base fill with seamless 0.5px overlap on connecting edges
          const xStart = hasLeft ? -0.5 : 0;
          const yStart = hasTop ? -0.5 : 0;
          const fillW = this.width + (hasRight ? 0.5 : 0) - xStart;
          const fillH = this.height + (hasBottom ? 0.5 : 0) - yStart;
          ctx.fillStyle = this.color || '#B2EBF2';
          ctx.fillRect(xStart, yStart, fillW, fillH);

          // Top glossy ice sheen if not covered from above
          if (!hasTop) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            const startX = hasLeft ? 0 : 4;
            const endX = hasRight ? this.width : this.width - 4;
            ctx.moveTo(startX, 3);
            ctx.lineTo(endX, 3);
            ctx.lineTo(endX - (hasRight ? 4 : 8), 11);
            ctx.lineTo(startX + (hasLeft ? 4 : 0), 11);
            ctx.closePath();
            ctx.fill();
          }

          // Crystalline ice chevron motif in center
          ctx.strokeStyle = 'rgba(0, 184, 212, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(8, this.height - 8);
          ctx.lineTo(this.width / 2, this.height / 2);
          ctx.lineTo(this.width - 8, this.height - 14);
          ctx.stroke();

          // Subtle internal ice facet seams between adjacent ice blocks
          if (hasRight && rightEnt && !rightEnt.isSlope) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.width, 0); ctx.lineTo(this.width, this.height);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(0, 184, 212, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.width - 1, 0); ctx.lineTo(this.width - 1, this.height);
            ctx.stroke();
          }
          if (hasBottom && bottomEnt && !bottomEnt.isSlope) {
            ctx.strokeStyle = 'rgba(0, 184, 212, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, this.height); ctx.lineTo(this.width, this.height);
            ctx.stroke();
          }

          // Outlines ONLY on exposed faces
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';
          ctx.beginPath();
          if (!hasTop) { ctx.moveTo(0, 0); ctx.lineTo(this.width, 0); }
          if (!hasBottom) { ctx.moveTo(0, this.height); ctx.lineTo(this.width, this.height); }
          if (!hasLeft) { ctx.moveTo(0, 0); ctx.lineTo(0, this.height); }
          if (!hasRight) { ctx.moveTo(this.width, 0); ctx.lineTo(this.width, this.height); }
          ctx.stroke();
        }
      }

      // 13. STANDARD SOLID GROUND BLOCK (Theme-Aware: Grass, Snowy, Night, Chrome, 8-Bit, Jungle)
      else {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();

        // Base Dirt / Stone Fill (with seamless 0.5px overlap on connecting edges)
        const xStart = hasLeft ? -0.5 : 0;
        const yStart = hasTop ? -0.5 : 0;
        const fillW = this.width + (hasRight ? 0.5 : 0) - xStart;
        const fillH = this.height + (hasBottom ? 0.5 : 0) - yStart;
        ctx.fillStyle = pal.dirtBase;
        ctx.fillRect(xStart, yStart, fillW, fillH);

        // Deterministic organic specks
        const col = Math.round(this.x / 40);
        const row = Math.round(this.y / 40);
        const speckShift = ((col * 31) ^ (row * 17)) & 3;

        // Dark specks
        ctx.fillStyle = pal.speckDark;
        ctx.fillRect(6 + speckShift, 14, 4, 3);
        ctx.fillRect(24 - speckShift, 28, 4, 3);
        ctx.fillRect(14, 33, 3, 3);
        ctx.fillRect(31, 20 + speckShift, 3, 4);

        // Light specks
        ctx.fillStyle = pal.speckLight;
        ctx.fillRect(18 - speckShift, 16, 4, 3);
        ctx.fillRect(8, 26 - speckShift, 3, 4);
        ctx.fillRect(28 + speckShift, 34, 4, 3);

        // Medium specks
        ctx.fillStyle = pal.speckMid;
        ctx.fillRect(26, 8 + speckShift, 4, 3);
        ctx.fillRect(4 + speckShift, 33, 3, 3);
        ctx.fillRect(16 + speckShift, 22, 3, 3);

        // Extra underground specks in upper region if covered
        if (hasTop) {
          ctx.fillStyle = pal.speckLight;
          ctx.fillRect(8 + speckShift, 4, 4, 3);
          ctx.fillStyle = pal.speckDark;
          ctx.fillRect(22 - speckShift, 3, 4, 3);
          ctx.fillStyle = pal.speckMid;
          ctx.fillRect(32, 5 + speckShift, 3, 3);
        }

        // Theme-Specific Distinctive Inlays
        if (pal.theme === 'chrome') {
          const animTime = performance.now() * 0.001;
          // Polished brushed titanium specular wave sweeping across surface
          const sweepPhase = Math.sin(animTime * 2.2 + (this.x * 0.04));
          const sweepAlpha = Math.max(0, sweepPhase) * 0.35;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + sweepAlpha})`;
          ctx.fillRect(2, 6, this.width - 4, 6);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(2, 12, this.width - 4, 3);

          // Chamfered metallic diagonal sheen
          ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + sweepAlpha * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(4, 20); ctx.lineTo(this.width - 4, 14); ctx.lineTo(this.width - 4, 18); ctx.lineTo(4, 24);
          ctx.closePath();
          ctx.fill();

          // Cybernetic glowing circuit trace
          ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
          ctx.fillRect(14, this.height - 8, this.width - 28, 2);
          ctx.fillRect(this.width / 2 - 1, this.height - 14, 2, 6);
          ctx.fillStyle = '#00E5FF';
          ctx.fillRect(this.width / 2 - 2, this.height - 15, 4, 4);

          // Heavy industrial corner rivets with metallic highlights & drop shadows
          [
            [5, 5], [this.width - 8, 5],
            [5, this.height - 8], [this.width - 8, this.height - 8]
          ].forEach(([rx, ry]) => {
            ctx.fillStyle = '#1E293B';
            ctx.fillRect(rx, ry + 1, 4, 3);
            ctx.fillStyle = '#CBD5E1';
            ctx.fillRect(rx, ry, 3.5, 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(rx, ry, 1.5, 1.5);
          });
        } else if (pal.theme === '8-bit') {
          // Chunky 8-bit retro pixel grout lines
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 20, this.width, 2);
          ctx.fillRect(20, 0, 2, 20);
          ctx.fillRect(10, 22, 2, this.height - 22);
          ctx.fillRect(30, 22, 2, this.height - 22);
        } else if (pal.theme === 'night') {
          // Glowing starlight / crystal flecks
          ctx.fillStyle = pal.speckAccent;
          ctx.fillRect(12 + speckShift, 18, 2.5, 2.5);
          ctx.fillRect(26 - speckShift, 12, 2.5, 2.5);
        } else if (pal.theme === 'jungle') {
          const animTime = performance.now() * 0.001;
          // Ancient carved Mayan stone glyph in center
          ctx.fillStyle = 'rgba(8, 28, 21, 0.45)';
          ctx.fillRect(this.width / 2 - 8, this.height / 2 - 8, 16, 16);
          ctx.fillStyle = 'rgba(82, 183, 136, 0.35)';
          ctx.fillRect(this.width / 2 - 5, this.height / 2 - 5, 10, 10);
          ctx.fillStyle = '#FFD166';
          ctx.fillRect(this.width / 2 - 2, this.height / 2 - 2, 4, 4);

          // Living ivy sprigs creeping along stone
          ctx.fillStyle = '#2D6A4F';
          ctx.beginPath();
          ctx.ellipse(8, 24, 4, 2.5, 0.5, 0, Math.PI * 2);
          ctx.ellipse(this.width - 8, 22, 4, 2.5, -0.5, 0, Math.PI * 2);
          ctx.fill();

          // Lichen speckles
          ctx.fillStyle = pal.speckAccent;
          ctx.fillRect(10 + speckShift, 12, 2.5, 2.5);
          ctx.fillRect(26 - speckShift, 26, 2, 2);
        } else if (pal.theme === 'neon') {
          // Vibrant glowing neon accents
          ctx.fillStyle = '#00E5FF';
          ctx.fillRect(4, this.height - 4, 3, 2);
          ctx.fillRect(this.width - 7, this.height - 4, 3, 2);
          ctx.fillStyle = '#FF007F';
          ctx.fillRect(16, 20, 2.5, 2.5);
        } else if (pal.theme === 'atlantis') {
          // Deep aquatic coral speckles
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(4, 18, 3, 2);
          ctx.fillStyle = '#2DD4BF';
          ctx.fillRect(this.width - 7, 24, 3, 2);
        } else if (pal.theme === 'uncanny') {
          // 1. 3D Diorama Cast Shadow beneath exposed bottom edges
          if (!hasBottom) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
            ctx.fillRect(xStart, this.height, fillW, 6);
          }

          // 2. Geologic Loamy Soil Cross-Section Gradient
          const soilGrad = ctx.createLinearGradient(0, 0, 0, this.height);
          soilGrad.addColorStop(0, '#4A2C18');
          soilGrad.addColorStop(0.55, '#341D0F');
          soilGrad.addColorStop(1, '#1F1007');
          ctx.fillStyle = soilGrad;
          ctx.fillRect(xStart, yStart, fillW, fillH);

          // 3. Fine organic root filaments & geologic soil striations
          ctx.strokeStyle = 'rgba(161, 98, 54, 0.35)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(9 + speckShift, 9);
          ctx.quadraticCurveTo(13, 18, 7 + speckShift, 28);
          ctx.moveTo(27 - speckShift, 10);
          ctx.quadraticCurveTo(23, 21, 30 - speckShift, 32);
          ctx.stroke();

          // 4. Embedded 3D shaded stones / pebbles in soil cross-section
          const pebbles = [
            [11 + speckShift, 22, 4.2, 3.0],
            [26 - speckShift, 17, 3.5, 2.6],
            [19, 31 - speckShift, 4.8, 3.2],
            [32, 28, 3.0, 2.2]
          ];
          pebbles.forEach(([px, py, rx, ry]) => {
            ctx.fillStyle = '#140904';
            ctx.beginPath();
            ctx.ellipse(px + 0.6, py + 1.0, rx, ry, 0.2, 0, Math.PI * 2);
            ctx.fill();

            const pebGrad = ctx.createRadialGradient(px - 1, py - 1, 0.5, px, py, rx);
            pebGrad.addColorStop(0, '#A89F91');
            pebGrad.addColorStop(0.6, '#6E6259');
            pebGrad.addColorStop(1, '#3B312B');
            ctx.fillStyle = pebGrad;
            ctx.beginPath();
            ctx.ellipse(px, py, rx, ry, 0.2, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // LUSH THEMED SURFACE CAP (ONLY ON EXPOSED TOP LAYER!)
        if (!hasTop) {
          const grassW = this.width + (hasRight ? 0.5 : 0);

          // Turf main body
          ctx.fillStyle = pal.turfMain;
          ctx.fillRect(0, 0, grassW, 8);

          // Turf top highlight
          ctx.fillStyle = pal.turfHighlight;
          ctx.fillRect(0, 0, grassW, 2.5);

          // Turf underside shadow
          ctx.fillStyle = pal.turfShadow;
          ctx.fillRect(0, 8, grassW, 2);

          if (pal.theme === 'snowy') {
            // Pillowy soft snow drifts on top edge
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(8, 2, 5, 0, Math.PI * 2);
            ctx.arc(20, 1, 6, 0, Math.PI * 2);
            ctx.arc(32, 2, 5, 0, Math.PI * 2);
            ctx.fill();
            // Icicle drops
            ctx.fillStyle = '#E0F2FE';
            ctx.fillRect(12, 9, 3, 4);
            ctx.fillRect(26, 9, 2, 3);
          } else if (pal.theme === 'chrome') {
            // Polished Liquid Mirror Chrome Top Cap with Real-Time Reflection
            const animTime = performance.now() * 0.001;
            const sweep = ((animTime * 60 + this.x) % 180) / 180;
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(0, 0, grassW, 8);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, grassW, 2.5);
            // Moving specular glare
            const glareX = (sweep * grassW);
            const glareGrad = ctx.createLinearGradient(glareX - 12, 0, glareX + 12, 0);
            glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            glareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
            glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = glareGrad;
            ctx.fillRect(0, 0, grassW, 8);
            ctx.fillStyle = '#334155';
            ctx.fillRect(0, 8, grassW, 2);
          } else if (pal.theme === 'jungle') {
            const animTime = performance.now() * 0.001;
            // Lush fern moss top cap
            ctx.fillStyle = '#105238';
            ctx.fillRect(0, 0, grassW, 8);
            ctx.fillStyle = '#52B788';
            ctx.fillRect(0, 0, grassW, 3);
            ctx.fillStyle = '#081C15';
            ctx.fillRect(0, 8, grassW, 2);

            // Dynamic swaying vine tendrils with realistic leaves
            const sway1 = Math.sin(animTime * 2.8 + (this.x * 0.06)) * 4;
            const sway2 = Math.cos(animTime * 2.4 + (this.x * 0.08)) * 3.5;
            ctx.fillStyle = '#1B4332';
            ctx.fillRect(6 + sway1 * 0.3, 8, 3.5, 8);
            ctx.fillRect(18 + sway2 * 0.3, 8, 4, 13);
            ctx.fillRect(30 + sway1 * 0.4, 8, 3.5, 7);

            // Fern leaf leaflets swaying
            ctx.fillStyle = '#40916C';
            ctx.beginPath();
            ctx.ellipse(7 + sway1, 15, 3.5, 2, 0.3, 0, Math.PI * 2);
            ctx.ellipse(20 + sway2, 20, 4, 2.5, -0.3, 0, Math.PI * 2);
            ctx.ellipse(31 + sway1, 14, 3.5, 2, 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Vibrant tropical red hibiscus flower blooming
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(20 + sway2, 22, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFE600';
            ctx.fillRect(19.5 + sway2, 21.5, 1.5, 1.5);

            // Glistening dew drops
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(8, 2, 1.5, 1.5);
            ctx.fillRect(24, 2, 1.5, 1.5);
          } else if (pal.theme === 'neon') {
            // Crisp electric neon edge
            ctx.fillStyle = '#00E5FF';
            ctx.fillRect(0, 0, grassW, 3);
            ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
            ctx.fillRect(0, 3, grassW, 4);
          } else if (pal.theme === 'atlantis') {
            // Bioluminescent aquatic rim
            ctx.fillStyle = '#38BDF8';
            ctx.fillRect(0, 0, grassW, 3);
            ctx.fillStyle = '#2DD4BF';
            ctx.fillRect(8, 8, 3, 3);
            ctx.fillRect(24, 8, 3, 4);
          } else if (pal.theme === 'uncanny') {
            // Thick 3D Diorama Living Turf Grass Mat with Individual Blades & Cast Shadow onto Soil
            ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
            ctx.fillRect(0, 9, grassW, 3);

            const turfGrad = ctx.createLinearGradient(0, -2, 0, 10);
            turfGrad.addColorStop(0, '#A3E635');
            turfGrad.addColorStop(0.45, '#4D9E2A');
            turfGrad.addColorStop(1, '#1E4611');
            ctx.fillStyle = turfGrad;
            ctx.fillRect(0, 0, grassW, 9);

            // Individual 3D Grass Blades jutting above & draping over soil edge
            for (let gx = 2; gx < grassW - 2; gx += 4) {
              const bladeH = 3 + ((gx * 7 + col * 3) % 3);
              ctx.fillStyle = (gx % 8 === 0) ? '#BEF264' : '#65A30D';
              ctx.beginPath();
              ctx.moveTo(gx, 2);
              ctx.lineTo(gx + 1.8, -bladeH);
              ctx.lineTo(gx + 3.5, 2);
              ctx.closePath();
              ctx.fill();

              // Overhanging turf root tuft
              ctx.fillStyle = '#366E1D';
              ctx.beginPath();
              ctx.moveTo(gx, 8);
              ctx.lineTo(gx + 2, 11 + (gx % 3));
              ctx.lineTo(gx + 4, 8);
              ctx.closePath();
              ctx.fill();
            }
          } else {
            // Drooping blades / fringe into dirt
            ctx.fillStyle = pal.turfMain;
            ctx.fillRect(5, 8, 4, 4);
            ctx.fillRect(14, 8, 5, 5);
            ctx.fillRect(23, 8, 4, 4);
            ctx.fillRect(32, 8, 5, 5);

            // Fringe bottom shadow
            ctx.fillStyle = pal.turfShadow;
            ctx.fillRect(5, 11, 4, 1.5);
            ctx.fillRect(14, 12, 5, 1.5);
            ctx.fillRect(23, 11, 4, 1.5);
            ctx.fillRect(32, 12, 5, 1.5);
          }

          // Side drape on exposed left/right corners
          if (!hasLeft) {
            ctx.fillStyle = pal.turfMain;
            ctx.fillRect(0, 8, 3, 5);
            ctx.fillStyle = pal.turfShadow;
            ctx.fillRect(0, 12, 3, 1.5);
          }
          if (!hasRight) {
            ctx.fillStyle = pal.turfMain;
            ctx.fillRect(this.width - 3, 8, 3, 5);
            ctx.fillStyle = pal.turfShadow;
            ctx.fillRect(this.width - 3, 12, 3, 1.5);
          }
        }

        // Outer contour outlines (only on exposed faces!)
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 3;
        ctx.lineCap = 'square';
        ctx.beginPath();

        if (!hasTop) {
          ctx.moveTo(0, 0);
          ctx.lineTo(this.width, 0);
        }
        if (!hasBottom) {
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width, this.height);
        }
        if (!hasLeft) {
          ctx.moveTo(0, 0);
          ctx.lineTo(0, this.height);
        }
        if (!hasRight) {
          ctx.moveTo(this.width, 0);
          ctx.lineTo(this.width, this.height);
        }
        ctx.stroke();
      }
    });
    } catch (err) {
      console.warn('SolidBlock draw error:', err);
    } finally {
      ctx.restore();
    }
  }
}

// Terrain Spatial Autotiling Map Cache
SolidBlock.terrainMap = new Map();
SolidBlock.terrainMapActive = false;
SolidBlock.terrainMapDirty = false;
SolidBlock.updateTerrainMap = function(entities) {
  if (!entities) return;
  SolidBlock.terrainMap.clear();
  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i];
    if (!ent || !ent.active || ent.isDropping) continue;
    if (ent.type === 'crate' || ent instanceof SolidBlock) {
      const col = Math.round(ent.x / 40);
      const row = Math.round(ent.y / 40);
      const wTiles = Math.max(1, Math.round(ent.width / 40));
      const hTiles = Math.max(1, Math.round(ent.height / 40));
      for (let c = 0; c < wTiles; c++) {
        for (let r = 0; r < hTiles; r++) {
          SolidBlock.terrainMap.set(`${col + c},${row + r}`, ent);
        }
      }
    }
  }
  SolidBlock.terrainMapActive = true;
  SolidBlock.terrainMapDirty = false;
};

// Backward-compatible alias
export const CrateBlock = SolidBlock;

// 3. BOUNCER / SPRINGBOARD (Spring & Mega Trampoline Variants)
export class Springboard extends Entity {
  constructor(x, y, width = 40, height = 40, variant = 'spring') {
    super(null, 'springboard', x, y, width, height);
    this.variant = variant || 'spring'; // 'spring', 'mega'
    this.launchForce = this.variant === 'mega' ? 1040 : 840;
    this.compressTimer = 0;
    this.isOneWay = true; // One-way platform top support
  }

  setVariant(variant) {
    this.variant = variant;
    this.launchForce = variant === 'mega' ? 1040 : 840;
  }

  trigger() {
    this.compressTimer = 0.28;
    sounds.playBounce();
  }

  update(dt) {
    if (this.compressTimer > 0) {
      this.compressTimer -= dt;
    }
  }

  draw(ctx) {
    ctx.save();
    try {
      ctx.translate(this.x, this.y);

      const isCompressed = this.compressTimer > 0.05;

      if (this.customImageElement && this.customImageElement.complete && this.customImageElement.naturalWidth > 0 && this.customImageElement.naturalHeight > 0) {
        try {
          if (isCompressed) {
            // Dynamic squish animation for custom decal on bounce!
            const squashY = this.height * 0.35;
            ctx.drawImage(this.customImageElement, -this.width * 0.05, squashY, this.width * 1.1, this.height * 0.65);
          } else {
            ctx.drawImage(this.customImageElement, 0, 0, this.width, this.height);
          }
        } catch (drawErr) {
          console.warn('Springboard custom decal draw error:', drawErr);
        }
      } else {
        const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';
        const springHeight = isCompressed ? this.height * 0.42 : this.height * 0.85;
        const offsetY = this.height - springHeight;

        if (isUncanny) {
          // 3D Raytraced / Diorama Springboard: 3D Wood/Steel Base + Cylindrical Helical Steel Spring + Beveled Yellow Cushion Pad!
          // Ground shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(1, this.height - 2, this.width - 2, 5);

          // 3D Wooden / Steel Base Block
          const baseGrad = ctx.createLinearGradient(0, this.height - 10, 0, this.height);
          baseGrad.addColorStop(0, '#B4845C');
          baseGrad.addColorStop(0.5, '#784824');
          baseGrad.addColorStop(1, '#3D220E');
          ctx.fillStyle = baseGrad;
          ctx.beginPath();
          ctx.roundRect(2, this.height - 9, this.width - 4, 9, 2);
          ctx.fill();
          ctx.strokeStyle = '#1E1107';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 3D Helical Chrome Coil Spring (back dark coils + front specular coils)
          const rungs = 3;
          const coilTop = offsetY + 8;
          const coilBot = this.height - 9;
          const stepY = (coilBot - coilTop) / rungs;

          // Back shadow coils
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let r = 0; r < rungs; r++) {
            const y1 = coilBot - r * stepY;
            const y2 = y1 - stepY * 0.5;
            ctx.moveTo(9, y1);
            ctx.lineTo(this.width - 9, y2);
          }
          ctx.stroke();

          // Front specular chrome coils
          const coilGrad = ctx.createLinearGradient(8, 0, this.width - 8, 0);
          coilGrad.addColorStop(0, '#64748B');
          coilGrad.addColorStop(0.45, '#FFFFFF');
          coilGrad.addColorStop(0.85, '#94A3B8');
          coilGrad.addColorStop(1, '#1E293B');
          ctx.strokeStyle = coilGrad;
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          for (let r = 0; r < rungs; r++) {
            const y1 = coilBot - r * stepY;
            const y2 = y1 - stepY * 0.5;
            const y3 = y1 - stepY;
            ctx.moveTo(this.width - 9, y2);
            ctx.lineTo(9, y3);
          }
          ctx.stroke();

          // 3D Beveled Golden-Yellow Cushion Pad on Top
          const padGrad = ctx.createLinearGradient(0, offsetY, 0, offsetY + 10);
          padGrad.addColorStop(0, '#FEF08A');
          padGrad.addColorStop(0.35, this.color || '#FACC15');
          padGrad.addColorStop(0.85, '#CA8A04');
          padGrad.addColorStop(1, '#713F12');
          ctx.fillStyle = padGrad;
          ctx.beginPath();
          ctx.roundRect(2, offsetY, this.width - 4, 10, 4);
          ctx.fill();
          ctx.strokeStyle = '#422006';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Top specular gleam on cushion
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fillRect(5, offsetY + 1.5, this.width - 10, 2);
        } else {
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
          ctx.fillStyle = this.color || (this.variant === 'mega' ? '#FFE600' : '#00E676');
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
        }
      }
    } catch (err) {
      console.warn('Springboard draw error:', err);
    } finally {
      ctx.restore();
    }
  }
}

// 4. HAZARD SPIKES
export class HazardSpikes extends Entity {
  constructor(x, y, width = 40, height = 40) {
    super(null, 'hazard', x, y, width, height);
  }

  draw(ctx) {
    ctx.save();
    try {
      ctx.translate(this.x, this.y);

      this.renderCustomOrFallback(ctx, () => {
        const theme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        if (theme === 'uncanny' || theme === 'mixed') {
          // 3D Raytraced / Machined Steel Cones with Split Light/Shadow Facets
          const numSpikes = 3;
          const spikeW = this.width / numSpikes;
          for (let i = 0; i < numSpikes; i++) {
            const sx = i * spikeW;
            const midX = sx + spikeW / 2;

            // Left sunlit metallic facet
            const leftGrad = ctx.createLinearGradient(sx, this.height, midX, 4);
            leftGrad.addColorStop(0, '#94A3B8');
            leftGrad.addColorStop(0.5, '#F8FAFC');
            leftGrad.addColorStop(1, '#FFFFFF');
            ctx.fillStyle = leftGrad;
            ctx.beginPath();
            ctx.moveTo(sx, this.height);
            ctx.lineTo(midX, 4);
            ctx.lineTo(midX, this.height);
            ctx.closePath();
            ctx.fill();

            // Right shaded metallic facet
            const rightGrad = ctx.createLinearGradient(midX, 4, sx + spikeW, this.height);
            rightGrad.addColorStop(0, '#64748B');
            rightGrad.addColorStop(1, '#0F172A');
            ctx.fillStyle = rightGrad;
            ctx.beginPath();
            ctx.moveTo(midX, 4);
            ctx.lineTo(sx + spikeW, this.height);
            ctx.lineTo(midX, this.height);
            ctx.closePath();
            ctx.fill();

            // Outer contour
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, this.height);
            ctx.lineTo(midX, 4);
            ctx.lineTo(sx + spikeW, this.height);
            ctx.closePath();
            ctx.stroke();
          }
          return;
        }
        let spikeFill = '#EF4444';
        if (theme === 'snowy') spikeFill = '#93C5FD'; // Icicle blue
        else if (theme === 'night') spikeFill = '#A855F7'; // Amethyst crystal
        else if (theme === 'chrome') spikeFill = '#E2E8F0'; // Metallic chrome
        else if (theme === '8-bit') spikeFill = '#D82800'; // Retro arcade red
        else if (theme === 'jungle') spikeFill = '#B45309'; // Bamboo thorn
        else if (theme === 'neon') spikeFill = '#FF007F'; // Electric neon pink
        else if (theme === 'atlantis') spikeFill = '#06B6D4'; // Aquatic cyan

        ctx.fillStyle = this.color || spikeFill;
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

        // Gleam highlight down left edge of each spike
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < numSpikes; i++) {
          ctx.moveTo(i * spikeW + 2, this.height - 2);
          ctx.lineTo(i * spikeW + spikeW / 2, 7);
        }
        ctx.stroke();
      });
    } catch (err) {
      console.warn('HazardSpikes draw error:', err);
    } finally {
      ctx.restore();
    }
  }
}

// 5. ENEMY WALKER (Walker, Flyer, and Spiker Variants)
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
    try {
      ctx.translate(this.x + this.width / 2, this.y + this.height + (this.hopOffset || 0));
    
    if (this.isSquashed) {
      ctx.scale(1.4, 0.2);
    } else {
      ctx.scale(this.dir, 1 + Math.sin(this.walkCycle) * 0.08);
    }
    ctx.translate(-this.width / 2, -this.height);

    this.renderCustomOrFallback(ctx, () => {
      const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
      const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';

      // Helper for 3D Uncanny Realistic Human Eyes with Round Wire-Frame Spectacles
      const drawUncannySpectacledEyes = (ey, irisColor = '#D97706') => {
        [ [14, ey], [26, ey] ].forEach(([ex, eY]) => {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
          ctx.beginPath();
          ctx.arc(ex, eY + 0.5, 5.8, 0, Math.PI * 2);
          ctx.fill();

          const scleraG = ctx.createRadialGradient(ex - 1.2, eY - 1.2, 0.8, ex, eY, 5.0);
          scleraG.addColorStop(0, '#FFFFFF');
          scleraG.addColorStop(0.72, '#F1F5F9');
          scleraG.addColorStop(1, '#FCA5A5');
          ctx.fillStyle = scleraG;
          ctx.beginPath();
          ctx.arc(ex, eY, 4.9, 0, Math.PI * 2);
          ctx.fill();

          const irisG = ctx.createRadialGradient(ex + 0.8, eY, 0.4, ex + 0.8, eY, 2.7);
          irisG.addColorStop(0, '#FDE047');
          irisG.addColorStop(0.65, irisColor);
          irisG.addColorStop(1, '#0F172A');
          ctx.fillStyle = irisG;
          ctx.beginPath();
          ctx.arc(ex + 0.8, eY, 2.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#020617';
          ctx.beginPath();
          ctx.arc(ex + 1.0, eY, 1.3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(ex - 0.5, eY - 1.3, 1.1, 0, Math.PI * 2);
          ctx.fill();

          // Round metallic wire-frame spectacle rim
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(ex, eY, 5.3, 0, Math.PI * 2);
          ctx.stroke();
        });
        // Spectacle bridge
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(19.3, ey);
        ctx.lineTo(20.7, ey);
        ctx.stroke();
      };

      if (this.variant === 'winged') {
        if (isUncanny) {
          // 3D Uncanny Yellow Owl Flyer Creature from the Reference Sketches!
          // (Feathered wings, golden 3D owl body, ear tufts, round wire-frame spectacles, uncanny realistic eyes & hooked beak)
          const wingFlap = Math.sin(this.walkCycle * 2.5) * 8;

          // Layered 3D Feathered Wings (left & right)
          [ [-1, 1], [1, -1] ].forEach(([side, rotSign]) => {
            const wx = side < 0 ? 3 : this.width - 3;
            const wy = 15 + wingFlap;
            const wingG = ctx.createRadialGradient(wx, wy - 2, 1, wx, wy, 12);
            wingG.addColorStop(0, '#FFFFFF');
            wingG.addColorStop(0.55, '#FDE68A');
            wingG.addColorStop(1, '#B45309');
            ctx.fillStyle = wingG;
            ctx.strokeStyle = '#451A03';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(wx, wy, 10.5, 6.5, rotSign * -0.38, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Feather quill ridges
            ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(wx - side * 3, wy);
            ctx.lineTo(wx + side * 7, wy + 2);
            ctx.moveTo(wx - side * 2, wy + 2);
            ctx.lineTo(wx + side * 6, wy + 4);
            ctx.stroke();
          });

          // 3D Owl Ear Tufts on top corners
          ctx.fillStyle = '#B45309';
          ctx.beginPath();
          ctx.moveTo(7, 9); ctx.lineTo(4, 2); ctx.lineTo(13, 7); ctx.closePath();
          ctx.moveTo(this.width - 7, 9); ctx.lineTo(this.width - 4, 2); ctx.lineTo(this.width - 13, 7); ctx.closePath();
          ctx.fill();

          // 3D Spherical Golden Owl Body
          const owlGrad = ctx.createRadialGradient(14, 12, 3, 20, 20, 20);
          owlGrad.addColorStop(0, '#FEF08A');
          owlGrad.addColorStop(0.42, '#F59E0B');
          owlGrad.addColorStop(0.82, '#B45309');
          owlGrad.addColorStop(1, '#451A03');
          ctx.fillStyle = owlGrad;
          ctx.beginPath();
          ctx.roundRect(5, 6, this.width - 10, this.height - 10, 12);
          ctx.fill();
          ctx.strokeStyle = '#451A03';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Breast feather chevrons
          ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
          ctx.lineWidth = 1.1;
          [ [14, 29], [20, 31], [26, 29] ].forEach(([fx, fy]) => {
            ctx.beginPath();
            ctx.arc(fx, fy, 2.5, 0.2, Math.PI - 0.2);
            ctx.stroke();
          });

          // Uncanny realistic owl eyes with round wire-frame spectacles
          drawUncannySpectacledEyes(17.5, '#D97706');

          // 3D Curved Hooked Owl Beak
          const beakG = ctx.createLinearGradient(17, 22, 23, 28);
          beakG.addColorStop(0, '#FDBA74');
          beakG.addColorStop(0.5, '#EA580C');
          beakG.addColorStop(1, '#431407');
          ctx.fillStyle = beakG;
          ctx.beginPath();
          ctx.moveTo(17, 22.5);
          ctx.quadraticCurveTo(20, 21, 23, 22.5);
          ctx.lineTo(20, 28.5);
          ctx.closePath();
          ctx.fill();

          // Tiny 3D owl talons at bottom
          ctx.fillStyle = '#D97706';
          ctx.fillRect(11, this.height - 5, 5, 4);
          ctx.fillRect(24, this.height - 5, 5, 4);
        } else {
          // Flyer (Golden Yellow with animated white wings)
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
        }
      } else if (this.variant === 'spiky') {
        if (isUncanny) {
          // 3D Uncanny Spiker: 3D Chrome Steel Cones on Top + Crimson 3D Body + Spectacled Uncanny Eyes!
          [11, 20, 29].forEach(sx => {
            const spG = ctx.createLinearGradient(sx - 5, 11, sx + 5, 0);
            spG.addColorStop(0, '#475569');
            spG.addColorStop(0.5, '#FFFFFF');
            spG.addColorStop(1, '#0F172A');
            ctx.fillStyle = spG;
            ctx.beginPath();
            ctx.moveTo(sx - 5, 12);
            ctx.lineTo(sx, 0);
            ctx.lineTo(sx + 5, 12);
            ctx.closePath();
            ctx.fill();
          });

          const spBodyG = ctx.createRadialGradient(14, 15, 2, 20, 22, 20);
          spBodyG.addColorStop(0, '#F87171');
          spBodyG.addColorStop(0.45, '#DC2626');
          spBodyG.addColorStop(1, '#450A0A');
          ctx.fillStyle = spBodyG;
          ctx.beginPath();
          ctx.roundRect(4, 10, this.width - 8, this.height - 14, 8);
          ctx.fill();

          drawUncannySpectacledEyes(20.5, '#EF4444');
        } else {
          // Spiker (Hazardous spines - cannot be stomped!)
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
        }
      } else {
        if (isUncanny) {
          // 3D Uncanny Walker Creature (3D shaded violet/flesh cube with realistic spectacled eyes)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
          ctx.beginPath();
          ctx.ellipse(this.width / 2, this.height - 2, 14, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();

          const wGrad = ctx.createRadialGradient(13, 12, 3, 20, 20, 22);
          wGrad.addColorStop(0, this.color || '#DDD6FE');
          wGrad.addColorStop(0.38, this.color || '#8B5CF6');
          wGrad.addColorStop(0.82, '#4C1D95');
          wGrad.addColorStop(1, '#1E1B4B');
          ctx.fillStyle = wGrad;
          ctx.beginPath();
          ctx.roundRect(4, 6, this.width - 8, this.height - 10, 9);
          ctx.fill();
          ctx.strokeStyle = '#1E1B4B';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          drawUncannySpectacledEyes(17.5, '#7C3AED');

          // Uncanny realistic scowl crease
          ctx.strokeStyle = '#1E1B4B';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(14, 27);
          ctx.quadraticCurveTo(20, 24, 26, 27);
          ctx.stroke();
        } else {
          // Standard Walker
          ctx.fillStyle = this.color || '#B388FF'; // Lavender purple or custom component color
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
      }
    });
    } catch (err) {
      console.warn('EnemyWalker draw error:', err);
    } finally {
      ctx.restore();
    }
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
    try {
      ctx.translate(this.x, this.y);

      this.renderCustomOrFallback(ctx, () => {
        ctx.fillStyle = this.color || '#00E5FF';
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
    } catch (err) {
      console.warn('MovingPlatform draw error:', err);
    } finally {
      ctx.restore();
    }
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
    try {
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
    } catch (err) {
      console.warn('Bullet draw error:', err);
    } finally {
      ctx.restore();
    }
  }
}

// 8. COLLECTIBLE TOKEN / POWERUP (Coin, Star, Heart, Pistol, Ammo)
export class Collectible extends Entity {
  constructor(x, y, width = 32, height = 32, variant = 'coin') {
    super(null, 'collectible', x, y, width, height);
    this.variant = variant || 'coin'; // 'coin', 'star', 'heart', 'pistol', 'ammo'
    this.bobTimer = Math.random() * Math.PI;
    this.collected = false;
    this.points = this.calcPoints(this.variant);
    this.emerging = false;
    this.emergeVy = 0;
    this.targetY = y;
  }

  calcPoints(v) {
    if (v === 'star') return 500;
    if (v === 'heart') return 200;
    if (v === 'pistol') return 300;
    if (v === 'ammo') return 200;
    return 100;
  }

  setVariant(variant) {
    this.variant = variant;
    this.points = this.calcPoints(variant);
  }

  update(dt) {
    this.bobTimer += dt * 4;
    if (this.emerging) {
      this.y += this.emergeVy * dt;
      this.emergeVy += 400 * dt;
      if (this.y <= this.targetY || this.emergeVy >= 0) {
        this.y = this.targetY;
        this.emerging = false;
        this.emergeVy = 0;
      }
    }
  }

  collect() {
    this.collected = true;
    this.active = false;
    if (this.variant === 'pistol' || this.variant === 'ammo') {
      sounds.playGunPickup();
    } else {
      sounds.playCollect();
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    try {
      const bobOffset = Math.sin(this.bobTimer) * 4;
      ctx.translate(this.x, this.y + bobOffset);

    this.renderCustomOrFallback(ctx, () => {
      const isAmmoRefill = this.variant === 'ammo' ||
        (this.variant === 'pistol' && typeof window !== 'undefined' && window.sidehop && window.sidehop.gunPickedUpInLevel);

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
      } else if (isAmmoRefill) {
        // Ammunition Box Pickup (+15 Rounds)
        const aura = 1 + Math.sin(this.bobTimer * 2) * 0.08;
        ctx.fillStyle = '#C8E6C9';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, 15 * aura, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(this.width / 2 - 11, this.height / 2 - 9);

        // Olive drab metal ammo can
        ctx.fillStyle = '#2E7D32';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, 4, 22, 14, 2);
        ctx.fill();
        ctx.stroke();

        // Top lid & latch
        ctx.fillStyle = '#1B5E20';
        ctx.beginPath();
        ctx.roundRect(-1, 2, 24, 3, 1);
        ctx.fill();
        ctx.stroke();

        // Latch handle
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(8, 0, 6, 3);

        // Three golden brass bullets standing in front
        const bulletXs = [3, 9, 15];
        for (const bx of bulletXs) {
          // Bullet casing (gold brass)
          ctx.fillStyle = '#FFD700';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx, 8, 4, 8, 1);
          ctx.fill();
          ctx.stroke();
          // Copper projectile tip
          ctx.fillStyle = '#FF6D00';
          ctx.beginPath();
          ctx.moveTo(bx, 8);
          ctx.lineTo(bx + 2, 5);
          ctx.lineTo(bx + 4, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
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
        const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';
        const cx = this.width / 2;
        const cy = this.height / 2;

        if (isUncanny) {
          // 3D Raytraced Faceted Gold Star with Volumetric Bloom & 4-Point Lens Flare (from the sketches!)
          const bloom = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
          bloom.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
          bloom.addColorStop(0.4, 'rgba(250, 204, 21, 0.55)');
          bloom.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(cx, cy, 22, 0, Math.PI * 2);
          ctx.fill();

          const starG = ctx.createLinearGradient(0, 0, this.width, this.height);
          starG.addColorStop(0, '#FFFFFF');
          starG.addColorStop(0.28, '#FEF08A');
          starG.addColorStop(0.65, '#F59E0B');
          starG.addColorStop(1, '#78350F');
          ctx.fillStyle = starG;
          ctx.strokeStyle = '#78350F';
          ctx.lineWidth = 1.6;
        } else {
          // Glowing Star Gem (+500 pts)
          ctx.fillStyle = this.color || '#FFE600';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 2.5;
        }

        // Radiant 5-point star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(
            cx + Math.cos((18 + i * 72) * Math.PI / 180) * (this.width / 2 - 2),
            cy - Math.sin((18 + i * 72) * Math.PI / 180) * (this.height / 2 - 2)
          );
          ctx.lineTo(
            cx + Math.cos((54 + i * 72) * Math.PI / 180) * (this.width / 4),
            cy - Math.sin((54 + i * 72) * Math.PI / 180) * (this.height / 4)
          );
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (isUncanny) {
          // Internal 3D facet ridge lines to center apex
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(
              cx + Math.cos((18 + i * 72) * Math.PI / 180) * (this.width / 2 - 2),
              cy - Math.sin((18 + i * 72) * Math.PI / 180) * (this.height / 2 - 2)
            );
          }
          ctx.stroke();

          // 4-point raytraced specular lens flare
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(cx - 10, cy - 5, 8, 1.5);
          ctx.fillRect(cx - 6.75, cy - 8.25, 1.5, 8);
        } else {
          // Cute smiling eyes
          ctx.fillStyle = '#121212';
          ctx.beginPath();
          ctx.arc(cx - 3.5, cy - 1, 1.8, 0, Math.PI * 2);
          ctx.arc(cx + 3.5, cy - 1, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Golden Coin (+100 pts)
        const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';
        const spin = Math.abs(Math.sin(this.bobTimer));
        const cx = this.width / 2;
        const cy = this.height / 2;

        if (isUncanny) {
          // Soft golden volumetric glow halo
          const coinGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 19);
          coinGlow.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
          coinGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = coinGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, 19, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.translate(cx, cy);
        ctx.scale(Math.max(0.25, spin), 1);
        ctx.translate(-cx, -cy);

        if (isUncanny) {
          // 3D Raytraced Metallic Gold Coin with Specular Anisotropic Sheen & Embossed Rim
          // 3D Coin Edge Thickness
          ctx.fillStyle = '#78350F';
          ctx.beginPath();
          ctx.arc(cx + 2, cy + 1, cx - 2, 0, Math.PI * 2);
          ctx.fill();

          const coinGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
          coinGrad.addColorStop(0, '#FFFFFF');
          coinGrad.addColorStop(0.25, '#FEF08A');
          coinGrad.addColorStop(0.55, '#F59E0B');
          coinGrad.addColorStop(0.85, '#B45309');
          coinGrad.addColorStop(1, '#78350F');
          ctx.fillStyle = coinGrad;
          ctx.strokeStyle = '#78350F';
          ctx.lineWidth = 1.8;

          ctx.beginPath();
          ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Recessed inner coin face & vertical embossed bar
          ctx.strokeStyle = '#FFFBEB';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, cx / 1.55, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#FFFBEB';
          ctx.fillRect(cx - 1.5, cy - 5, 3, 10);
        } else {
          ctx.fillStyle = this.color || '#FFE600';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 3;

          ctx.beginPath();
          ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Inner coin rim
          ctx.strokeStyle = '#D87A24';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, this.width / 3.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
    } catch (err) {
      console.warn('Collectible draw error:', err);
    } finally {
      ctx.restore();
    }
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
    try {
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
      ctx.fillStyle = this.color || '#00E676'; // Mint green or custom component color
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
    } catch (err) {
      console.warn('GoalFlag draw error:', err);
    } finally {
      ctx.restore();
    }
  }
}

// Export aliases
export { HazardSpikes as SpikeHazard, EnemyWalker as Enemy, GoalFlag as GoalPole };

if (typeof window !== 'undefined') {
  window.Entity = Entity;
  window.Player = Player;
  window.SolidBlock = SolidBlock;
  window.CrateBlock = SolidBlock;
  window.Springboard = Springboard;
  window.HazardSpikes = HazardSpikes;
  window.SpikeHazard = HazardSpikes;
  window.EnemyWalker = EnemyWalker;
  window.Enemy = EnemyWalker;
  window.MovingPlatform = MovingPlatform;
  window.Bullet = Bullet;
  window.Collectible = Collectible;
  window.GoalFlag = GoalFlag;
  window.GoalPole = GoalFlag;
}
