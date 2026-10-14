// Sidehop 2D Physics & Procedural Squash-and-Stretch Engine

export class PhysicsEngine {
  constructor(tileSize = 40) {
    this.tileSize = tileSize;
    this.gravity = 1400; // px/s^2
  }

  // Calculate AABB intersection
  checkOverlap(boxA, boxB) {
    return (
      boxA.x < boxB.x + boxB.width &&
      boxA.x + boxA.width > boxB.x &&
      boxA.y < boxB.y + boxB.height &&
      boxA.y + boxA.height > boxB.y
    );
  }

  // Update entity movement with platform collision resolution
  updateEntity(entity, solids, dt) {
    const grav = (entity.gravityScale !== undefined ? entity.gravityScale : 1.0) * this.gravity;
    
    // Apply gravity
    if (!entity.grounded) {
      entity.vy += grav * dt;
      // Clamp terminal velocity
      if (entity.vy > 1200) entity.vy = 1200;
    }

    // Horizontal Movement
    entity.x += entity.vx * dt;
    this.resolveHorizontalCollisions(entity, solids);

    // Vertical Movement
    const wasGrounded = entity.grounded;
    entity.y += entity.vy * dt;
    entity.grounded = false;
    this.resolveVerticalCollisions(entity, solids);

    // Landing detection for procedural squash
    if (!wasGrounded && entity.grounded) {
      const landImpact = Math.min(Math.abs(entity.lastVy || 0) / 700, 1.0);
      entity.squashFactor = 0.35 * landImpact;
      entity.squashTime = 0.18; // duration in seconds
    }
    entity.lastVy = entity.vy;

    // Update procedural squash-and-stretch timers
    this.updateProceduralDeformation(entity, dt);
  }

  resolveHorizontalCollisions(entity, solids) {
    for (const solid of solids) {
      if (!solid.active) continue;
      if (this.checkOverlap(entity, solid)) {
        if (entity.vx > 0) {
          entity.x = solid.x - entity.width;
          entity.vx = 0;
        } else if (entity.vx < 0) {
          entity.x = solid.x + solid.width;
          entity.vx = 0;
        }
      }
    }
  }

  resolveVerticalCollisions(entity, solids) {
    for (const solid of solids) {
      if (!solid.active) continue;
      if (this.checkOverlap(entity, solid)) {
        if (entity.vy > 0) {
          // Landing on top of solid
          entity.y = solid.y - entity.height;
          // Apply surface bounciness if configured
          if (solid.bounciness && solid.bounciness > 0.05) {
            entity.vy = -entity.vy * solid.bounciness;
            if (Math.abs(entity.vy) < 80) {
              entity.vy = 0;
              entity.grounded = true;
            }
          } else {
            entity.vy = 0;
            entity.grounded = true;
          }
        } else if (entity.vy < 0) {
          // Bonking head on bottom of solid
          entity.y = solid.y + solid.height;
          entity.vy = 0;
        }
      }
    }
  }

  // Computes the dynamic squash, stretch, and lean values for any sprite
  updateProceduralDeformation(entity, dt) {
    if (!entity.deformation) {
      entity.deformation = { scaleX: 1, scaleY: 1, rotation: 0 };
    }

    let scaleX = 1;
    let scaleY = 1;
    let rotation = 0;

    // 1. Landing Squash Decay
    if (entity.squashTime > 0) {
      entity.squashTime -= dt;
      const progress = Math.max(0, entity.squashTime / 0.18);
      const intensity = (entity.squashFactor || 0.25) * Math.sin(progress * Math.PI);
      scaleY -= intensity;
      scaleX += intensity * 0.9;
    } 
    // 2. Airborne Stretch (Jump takeoff or falling elongation)
    else if (!entity.grounded) {
      if (entity.vy < -50) {
        // Jumping up: stretch tall & skinny
        const stretch = Math.min(0.28, (-entity.vy / 800) * 0.28);
        scaleY += stretch;
        scaleX -= stretch * 0.55;
      } else if (entity.vy > 100) {
        // Falling fast: slight downward stretch
        const fallStretch = Math.min(0.18, (entity.vy / 900) * 0.18);
        scaleY += fallStretch;
        scaleX -= fallStretch * 0.5;
      }
    } 
    // 3. Ground Idle Breathing Wobble
    else {
      entity.idleTimer = (entity.idleTimer || 0) + dt * 3.5;
      const breathe = Math.sin(entity.idleTimer) * 0.035;
      scaleY += breathe;
      scaleX -= breathe * 0.5;
    }

    // 4. Running Lean & Directional Facing
    if (Math.abs(entity.vx) > 20) {
      const leanAngle = (entity.vx / 350) * 0.12; // tilt forward into motion
      rotation = Math.max(-0.16, Math.min(0.16, leanAngle));
    }

    entity.deformation.scaleX = scaleX;
    entity.deformation.scaleY = scaleY;
    entity.deformation.rotation = rotation;
  }
}
