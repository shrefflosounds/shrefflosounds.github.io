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
    const wasGrounded = entity.grounded;

    // Apply gravity
    entity.vy += grav * dt;
    if (entity.vy > 1200) entity.vy = 1200;

    // 1. Horizontal Movement & Collision
    const prevX = entity.x;
    entity.x += entity.vx * dt;
    this.resolveHorizontalCollisions(entity, solids, prevX);

    // 2. Vertical Movement & Collision
    const prevVy = entity.vy;
    entity.y += entity.vy * dt;
    entity.grounded = false;
    this.resolveVerticalCollisions(entity, solids);

    // Landing detection for procedural squash:
    // Only trigger landing squash if entity was genuinely airborne and landed with significant downward velocity (> 180 px/s)
    if (!wasGrounded && entity.grounded) {
      if (prevVy > 180) {
        const landImpact = Math.min(1.0, (prevVy - 180) / 600);
        entity.squashFactor = 0.22 * landImpact;
        entity.squashTime = 0.15; // duration in seconds
      } else {
        entity.squashFactor = 0;
        entity.squashTime = 0;
      }
    }

    // Update procedural squash-and-stretch timers
    this.updateProceduralDeformation(entity, dt);
  }

  resolveHorizontalCollisions(entity, solids, prevX) {
    const isSlope = (s) => s && (s.isSlope || s.variant?.includes('slope'));
    const isSlopeUp = (s) => s && (s.slopeDirection === 'up' || s.variant?.includes('slope_up'));
    const isSlopeDown = (s) => s && (s.slopeDirection === 'down' || s.variant?.includes('slope_down'));

    for (const solid of solids) {
      if (!solid.active) continue;
      // Skip one-way platforms and angled sloped surfaces horizontally
      if (solid.isOneWay || solid.variant === 'cloud' || solid.variant === 'semisolid' || isSlope(solid)) continue;

      // Skip solid blocks that are covered underneath any slope
      const isUnderSlope = solids.some(s =>
        s.active && isSlope(s) &&
        Math.abs(s.x - solid.x) < 2 &&
        solid.y >= s.y + s.height - 2
      );
      if (isUnderSlope) continue;

      // Ignore horizontal collision if vertical overlap is merely boundary-level (e.g. resting on floor)
      const verticalOverlap = Math.min(entity.y + entity.height, solid.y + solid.height) - Math.max(entity.y, solid.y);
      if (verticalOverlap <= 3) continue;

      if (this.checkOverlap(entity, solid)) {
        if (entity.vx > 0) {
          // Entity moving right: only solid's left edge can block it!
          // If entity was already past solid's left edge, solid is behind or beneath entity (e.g. descending adjacent slope)
          if (prevX !== undefined && prevX + entity.width > solid.x + 2) continue;

          // Check if left face is the top junction of an adjoining slope_up
          const connectedSlopeUp = solids.some(s =>
            s.active && isSlopeUp(s) &&
            Math.abs((s.x + s.width) - solid.x) <= 2 &&
            Math.abs(s.y - solid.y) <= 2
          );
          if (connectedSlopeUp) continue;

          entity.x = solid.x - entity.width;
          entity.vx = 0;
        } else if (entity.vx < 0) {
          // Entity moving left: only solid's right edge can block it!
          // If entity was already past solid's right edge, solid is behind or beneath entity (e.g. descending adjacent slope)
          if (prevX !== undefined && prevX < solid.x + solid.width - 2) continue;

          // Check if right face is the top junction of an adjoining slope_down
          const connectedSlopeDown = solids.some(s =>
            s.active && isSlopeDown(s) &&
            Math.abs(s.x - (solid.x + solid.width)) <= 2 &&
            Math.abs(s.y - solid.y) <= 2
          );
          if (connectedSlopeDown) continue;

          entity.x = solid.x + solid.width;
          entity.vx = 0;
        }
      }
    }
  }

  resolveVerticalCollisions(entity, solids) {
    const isSlope = (s) => s && (s.isSlope || s.variant?.includes('slope'));
    const isSlopeUp = (s) => s && (s.slopeDirection === 'up' || s.variant?.includes('slope_up'));

    for (const solid of solids) {
      if (!solid.active) continue;

      // 1. Handle Walkable Slopes / Slants (slope_up and slope_down across all materials)
      if (isSlope(solid)) {
        if (entity.x + entity.width > solid.x && entity.x < solid.x + solid.width) {
          const px = Math.max(solid.x, Math.min(solid.x + solid.width, entity.x + entity.width / 2));
          const relX = (px - solid.x) / solid.width;

          const surfaceY = isSlopeUp(solid)
            ? solid.y + (1 - relX) * solid.height
            : solid.y + relX * solid.height;

          const footY = entity.y + entity.height;
          // Downward snapping tolerance: snap down by up to 32px to track downhill runs smoothly without airborne bouncing
          const snapDownTol = (entity.grounded || entity.standingOnSolid) ? 32 : 16;

          // Catch player anytime feet are near or descending onto slope surface (and not actively jumping upward)
          if (footY >= surfaceY - snapDownTol && footY <= solid.y + solid.height + 4 && entity.vy >= -60) {
            entity.y = surfaceY - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = solid;
          }
        }
        continue;
      }

      // 2. Handle One-Way Platforms (Cloud Platforms & Semi-Solid Boardwalks)
      if (solid.isOneWay || solid.variant === 'cloud' || solid.variant === 'semisolid') {
        if (entity.vy > 0 && this.checkOverlap(entity, solid)) {
          // Only land if entity was previously at or above top edge
          if (entity.y + entity.height - (entity.vy * 0.035) <= solid.y + 12) {
            entity.y = solid.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = solid;
          }
        }
        continue;
      }

      if (this.checkOverlap(entity, solid)) {
        if (entity.vy > 0) {
          // Landing on top of solid
          entity.y = solid.y - entity.height;
          entity.standingOnSolid = solid;

          // Note Block super bounce (♪)
          if (solid.variant === 'note') {
            entity.vy = -860;
            entity.grounded = false;
            if (solid.bump) solid.bump();
          }
          // Donut Lift trigger
          else if (solid.variant === 'donut') {
            if (solid.shakeTimer === 0 && !solid.isDropping) {
              solid.shakeTimer = 0.01;
            }
            entity.vy = 0;
            entity.grounded = true;
          }
          // Apply surface bounciness if configured
          else if (solid.bounciness && solid.bounciness > 0.05) {
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

          // Trigger Mystery Block [?] bump when bonked from below
          if (solid.bump && !solid.isUsed) {
            try {
              solid.bump();
            } catch (bumpErr) {
              console.error('solid.bump error:', bumpErr);
            }
          }
        }
      }
    }

    // Safety grounding check: if feet are resting on top surface of solid within 1.5px and downward/neutral vy
    if (!entity.grounded && entity.vy >= 0) {
      for (const solid of solids) {
        if (!solid.active) continue;
        if (solid.isSlope || solid.variant?.includes('slope')) continue;
        const onTop = Math.abs((entity.y + entity.height) - solid.y) <= 1.5;
        const horizAligned = (entity.x + entity.width > solid.x + 2) && (entity.x < solid.x + solid.width - 2);
        if (onTop && horizAligned) {
          entity.y = solid.y - entity.height;
          entity.vy = 0;
          entity.grounded = true;
          entity.standingOnSolid = solid;
          if (solid.variant === 'donut' && solid.shakeTimer === 0 && !solid.isDropping) {
            solid.shakeTimer = 0.01;
          }
          break;
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

    // 1. Landing Squash Decay (smooth sine easing)
    if (entity.squashTime > 0) {
      entity.squashTime -= dt;
      if (entity.squashTime <= 0) {
        entity.squashTime = 0;
        entity.squashFactor = 0;
      } else {
        const progress = Math.max(0, entity.squashTime / 0.15);
        const factor = (typeof entity.squashFactor === 'number' && entity.squashFactor > 0) ? entity.squashFactor : 0;
        const intensity = factor * Math.sin(progress * Math.PI);
        scaleY -= intensity;
        scaleX += intensity * 0.75;
      }
    } 
    // 2. Airborne Stretch (Jump takeoff or falling elongation)
    else if (!entity.grounded) {
      if (entity.vy < -80) {
        // Jumping up: stretch tall & skinny
        const stretch = Math.min(0.20, (-entity.vy / 800) * 0.20);
        scaleY += stretch;
        scaleX -= stretch * 0.45;
      } else if (entity.vy > 180) {
        // Falling fast: slight downward stretch
        const fallStretch = Math.min(0.14, (entity.vy / 900) * 0.14);
        scaleY += fallStretch;
        scaleX -= fallStretch * 0.35;
      }
    } 
    // 3. Ground Idle Breathing Wobble (gentle, relaxing life)
    else {
      entity.idleTimer = (entity.idleTimer || 0) + dt * 2.2;
      const breathe = Math.sin(entity.idleTimer) * 0.018; // Very subtle 1.8% cartoon breathe
      scaleY += breathe;
      scaleX -= breathe * 0.25;
    }

    // 4. Running Lean & Directional Facing
    if (Math.abs(entity.vx) > 20) {
      const leanAngle = (entity.vx / 350) * 0.10; // slight tilt forward into motion
      rotation = Math.max(-0.14, Math.min(0.14, leanAngle));
    }

    entity.deformation.scaleX = scaleX;
    entity.deformation.scaleY = scaleY;
    entity.deformation.rotation = rotation;
  }
}
