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
    const wasStandingOnSolid = entity.standingOnSolid;

    // Apply gravity
    entity.vy += grav * dt;
    if (entity.vy > 1200) entity.vy = 1200;

    // Spatial broadphase filter: only test solids near this entity (massive FPS speedup!)
    const marginX = Math.max(96, Math.abs(entity.vx * dt) + 64);
    const marginY = Math.max(96, Math.abs(entity.vy * dt) + 64);
    const minX = entity.x - marginX;
    const maxX = entity.x + entity.width + marginX;
    const minY = entity.y - marginY;
    const maxY = entity.y + entity.height + marginY;
    const localSolids = solids.filter(s =>
      s.active &&
      s.x + s.width >= minX &&
      s.x <= maxX &&
      s.y + s.height >= minY &&
      s.y <= maxY
    );

    // 1. Horizontal Movement & Collision
    const prevX = entity.x;
    entity.x += entity.vx * dt;
    this.resolveHorizontalCollisions(entity, localSolids, prevX);

    // 2. Vertical Movement & Collision
    const prevY = entity.y;
    const prevVy = entity.vy;
    entity.y += entity.vy * dt;
    entity.grounded = false;
    entity.standingOnSolid = null;
    this.resolveVerticalCollisions(entity, localSolids, prevY, dt, wasGrounded, wasStandingOnSolid);

    // 3. Safety: ensure entity is never trapped inside solid slope geometry
    this.resolveSlopeEntrapment(entity, localSolids);

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

    const movingRight = entity.vx > 0 || (prevX !== undefined && entity.x > prevX);
    const movingLeft = entity.vx < 0 || (prevX !== undefined && entity.x < prevX);

    for (const solid of solids) {
      if (!solid.active) continue;
      // Skip one-way platforms horizontally
      if (solid.isOneWay || solid.variant === 'cloud' || solid.variant === 'semisolid') continue;

      if (isSlope(solid)) {
        this.resolveSlopeHorizontal(entity, solid, solids, prevX, movingRight, movingLeft);
        continue;
      }

      // Ignore horizontal collision if vertical overlap is merely boundary-level (e.g. resting on floor)
      const verticalOverlap = Math.min(entity.y + entity.height, solid.y + solid.height) - Math.max(entity.y, solid.y);
      if (verticalOverlap <= 3) continue;

      if (!this.checkOverlap(entity, solid)) continue;

      if (movingRight) {
        // Entity moving right: only an exposed left edge of solid can block it!
        if (!this.isFaceExposedLeft(solid, entity, solids)) continue;

        // Check if left face is the top junction of an adjoining slope_up
        const connectedSlopeUp = solids.some(s =>
          s.active && isSlopeUp(s) &&
          Math.abs((s.x + s.width) - solid.x) <= 2 &&
          Math.abs(s.y - solid.y) <= 2
        );
        if (connectedSlopeUp && (entity.y + entity.height) <= solid.y + 8) continue;

        entity.x = solid.x - entity.width;
        entity.vx = 0;
      } else if (movingLeft) {
        // Entity moving left: only an exposed right edge of solid can block it!
        if (!this.isFaceExposedRight(solid, entity, solids)) continue;

        // Check if right face is the top junction of an adjoining slope_down
        const connectedSlopeDown = solids.some(s =>
          s.active && isSlopeDown(s) &&
          Math.abs(s.x - (solid.x + solid.width)) <= 2 &&
          Math.abs(s.y - solid.y) <= 2
        );
        if (connectedSlopeDown && (entity.y + entity.height) <= solid.y + 8) continue;

        entity.x = solid.x + solid.width;
        entity.vx = 0;
      }
    }
  }

  // Returns true if solid's left face is exposed to the entity at entity's current vertical span
  isFaceExposedLeft(solid, entity, solids) {
    const entTop = entity.y + 4;
    const entBottom = entity.y + entity.height - 4;
    if (entTop >= entBottom) return true;

    const isSlopeDown = (s) => s && (s.slopeDirection === 'down' || s.variant?.includes('slope_down'));
    const isSlopeCeilUp = (s) => s && (s.slopeDirection === 'ceil_up' || s.variant?.includes('slope_ceil_up'));

    for (const s of solids) {
      if (!s || s === solid || !s.active || s.isOneWay || s.variant === 'cloud' || s.variant === 'semisolid') continue;
      // Neighbor must touch solid's left edge
      if (Math.abs((s.x + s.width) - solid.x) > 2) continue;
      // Neighbor must not be a slope that tapers to 0 height at its right edge
      if (isSlopeDown(s) && !isSlopeCeilUp(s)) continue;
      // If neighbor fully covers the entity's vertical span on the left, the face is internal
      if (s.y <= entTop && (s.y + s.height) >= entBottom) {
        return false;
      }
    }
    return true;
  }

  // Returns true if solid's right face is exposed to the entity at entity's current vertical span
  isFaceExposedRight(solid, entity, solids) {
    const entTop = entity.y + 4;
    const entBottom = entity.y + entity.height - 4;
    if (entTop >= entBottom) return true;

    const isSlopeUp = (s) => s && (s.slopeDirection === 'up' || s.variant?.includes('slope_up'));
    const isSlopeCeilDown = (s) => s && (s.slopeDirection === 'ceil_down' || s.variant?.includes('slope_ceil_down'));

    for (const s of solids) {
      if (!s || s === solid || !s.active || s.isOneWay || s.variant === 'cloud' || s.variant === 'semisolid') continue;
      // Neighbor must touch solid's right edge
      if (Math.abs(s.x - (solid.x + solid.width)) > 2) continue;
      // Neighbor must not be a slope that tapers to 0 height at its left edge
      if (isSlopeUp(s) && !isSlopeCeilDown(s)) continue;
      // If neighbor fully covers the entity's vertical span on the right, the face is internal
      if (s.y <= entTop && (s.y + s.height) >= entBottom) {
        return false;
      }
    }
    return true;
  }

  // Returns the ground slope (slope_up / slope_down, any material) sitting directly on top of a block, if any.
  // Such a block's top face is internal: the walkable surface is the slope's diagonal above it.
  getCoveringGroundSlope(solid, solids) {
    for (const s of solids) {
      if (!s || s === solid || !s.active) continue;
      const v = s.variant || '';
      if (!(s.isSlope || v.includes('slope'))) continue;
      if (v.includes('slope_ceil') || s.slopeDirection === 'ceil_up' || s.slopeDirection === 'ceil_down') continue;
      if (Math.abs((s.y + s.height) - solid.y) <= 2 &&
          (s.x < solid.x + solid.width) && (s.x + s.width > solid.x)) {
        return s;
      }
    }
    return null;
  }

  // Resolves horizontal interactions with slopes:
  // 1. Exterior vertical wall faces
  // 2. Diagonal ramp faces when jumping or running into a slope
  resolveSlopeHorizontal(entity, slope, solids, prevX, movingRight, movingLeft) {
    const v = slope.variant || '';
    const dir = slope.slopeDirection ||
      (v.includes('slope_ceil_up') ? 'ceil_up' : v.includes('slope_ceil_down') ? 'ceil_down' :
       v.includes('slope_up') ? 'up' : v.includes('slope_down') ? 'down' : null);
    if (!dir) return;

    const verticalOverlap = Math.min(entity.y + entity.height, slope.y + slope.height) - Math.max(entity.y, slope.y);
    if (verticalOverlap <= 3) return;
    if (!this.checkOverlap(entity, slope)) return;

    const footY = entity.y + entity.height;

    // 1. Vertical flat wall face of slope:
    // slope_up (◢) and slope_ceil_down (◥) have a vertical RIGHT wall at slope.x + slope.width
    if (dir === 'up' || dir === 'ceil_down') {
      const faceX = slope.x + slope.width;
      // Entity must be approaching from the right outside the wall
      const approachingFromRight = (prevX !== undefined) ? (prevX >= faceX - 3) : (entity.x >= faceX - 3);
      if (approachingFromRight && (movingLeft || entity.x < faceX)) {
        if (this.isFaceExposedRight(slope, entity, solids)) {
          entity.x = faceX;
          if (entity.vx < 0) entity.vx = 0;
          return;
        }
      }
    }

    // slope_down (◣) and slope_ceil_up (◤) have a vertical LEFT wall at slope.x
    if (dir === 'down' || dir === 'ceil_up') {
      const faceX = slope.x;
      // Entity must be approaching from the left outside the wall
      const approachingFromLeft = (prevX !== undefined) ? (prevX + entity.width <= faceX + 3) : (entity.x + entity.width <= faceX + 3);
      if (approachingFromLeft && (movingRight || entity.x + entity.width > faceX)) {
        if (this.isFaceExposedLeft(slope, entity, solids)) {
          entity.x = faceX - entity.width;
          if (entity.vx > 0) entity.vx = 0;
          return;
        }
      }
    }

    // 2. Diagonal ramp face:
    // When an entity moves horizontally into the diagonal face of a ground slope:
    // If the entity's feet are within the step-up threshold, allow it to walk up!
    // But if the entity is airborne or attempting to penetrate into the solid triangle body,
    // block horizontal movement at the diagonal face!
    if (dir === 'up') {
      // slope_up (◢): rises from bottom-left to top-right
      if (movingRight) {
        const probeX = Math.max(slope.x, Math.min(slope.x + slope.width, entity.x + entity.width / 2));
        const relX = (probeX - slope.x) / slope.width;
        const surfY = slope.y + (1 - relX) * slope.height;

        const stepTolerance = (entity.grounded || entity.standingOnSolid) ? 24 : 12;
        if (footY > surfY + stepTolerance && footY <= slope.y + slope.height + 4) {
          const xBarrier = slope.x + (slope.y + slope.height - footY) * (slope.width / slope.height);
          if (entity.x + entity.width > xBarrier) {
            entity.x = Math.max(slope.x - entity.width, xBarrier - entity.width);
            entity.vx = 0;
          }
        }
      }
    } else if (dir === 'down') {
      // slope_down (◣): falls from top-left to bottom-right
      if (movingLeft) {
        const probeX = Math.max(slope.x, Math.min(slope.x + slope.width, entity.x + entity.width / 2));
        const relX = (probeX - slope.x) / slope.width;
        const surfY = slope.y + relX * slope.height;

        const stepTolerance = (entity.grounded || entity.standingOnSolid) ? 24 : 12;
        if (footY > surfY + stepTolerance && footY <= slope.y + slope.height + 4) {
          const xBarrier = slope.x + (footY - slope.y) * (slope.width / slope.height);
          if (entity.x < xBarrier) {
            entity.x = Math.min(slope.x + slope.width, xBarrier);
            entity.vx = 0;
          }
        }
      }
    }
  }

  resolveVerticalCollisions(entity, solids, prevY, dt, wasGrounded = false, wasStandingOnSolid = null) {
    const isSlope = (s) => s && (s.isSlope || s.variant?.includes('slope'));
    const isSlopeUp = (s) => s && (s.slopeDirection === 'up' || s.variant?.includes('slope_up'));
    const isSlopeDown = (s) => s && (s.slopeDirection === 'down' || s.variant?.includes('slope_down'));
    const isCeilSlopeUp = (s) => s && (s.slopeDirection === 'ceil_up' || s.variant?.includes('slope_ceil_up'));
    const isCeilSlopeDown = (s) => s && (s.slopeDirection === 'ceil_down' || s.variant?.includes('slope_ceil_down'));
    const isCeilSlope = (s) => isCeilSlopeUp(s) || isCeilSlopeDown(s);
    const isGroundSlope = (s) => isSlope(s) && !isCeilSlope(s);

    const footY = entity.y + entity.height;
    const prevFootY = prevY !== undefined ? (prevY + entity.height) : (footY - (entity.vy * (dt || 0.016)));

    // 1. Handle Walkable Ground Slopes (slope_up and slope_down across all materials)
    const overlappingGroundSlopes = solids.filter(s =>
      s.active && isGroundSlope(s) &&
      entity.x + entity.width > s.x && entity.x < s.x + s.width &&
      footY >= s.y - 32 && entity.y <= s.y + s.height + 8
    );

    if (overlappingGroundSlopes.length > 0) {
      const footX = entity.x + entity.width / 2;

      let bestSlope = null;
      let bestSurfaceY = Infinity;

      const centerSlopes = overlappingGroundSlopes.filter(s => footX >= s.x && footX <= s.x + s.width);
      const candidates = centerSlopes.length > 0 ? centerSlopes : overlappingGroundSlopes;

      for (const slope of candidates) {
        const px = Math.max(slope.x, Math.min(slope.x + slope.width, footX));
        const relX = (px - slope.x) / slope.width;
        const surfY = isSlopeUp(slope)
          ? slope.y + (1 - relX) * slope.height
          : slope.y + relX * slope.height;

        // 1a. Head bonking on flat bottom of a ground slope when jumping up from below
        if (entity.vy < 0 && entity.y < slope.y + slope.height && prevY >= slope.y + slope.height - 18) {
          entity.y = slope.y + slope.height;
          entity.vy = 0;
          continue;
        }

        // 1b. Standing, walking, or landing on the diagonal surface
        if (entity.vy >= -60) {
          // Downhill snapping or uphill walking:
          // If entity was grounded or standing on solid, snap to slope surface within 36px
          const isWalkingSlope = (wasGrounded || wasStandingOnSolid) &&
            (footY >= surfY - 24) &&
            (footY <= surfY + 36);

          // Landing from above: previously above surface and feet reached or passed surface
          const maxFallStep = Math.max(24, Math.abs(entity.vy * (dt || 0.016)) + 16);
          const isLanding = (prevFootY <= surfY + 16) &&
            (footY >= surfY - 10) &&
            (footY <= surfY + maxFallStep);

          // Feet slightly penetrating top of wedge
          const isPenetrating = (footY >= surfY) &&
            (footY <= surfY + 32);

          if (isWalkingSlope || isLanding || isPenetrating) {
            if (surfY < bestSurfaceY) {
              bestSurfaceY = surfY;
              bestSlope = slope;
            }
          }
        }
      }

      if (bestSlope !== null) {
        entity.y = bestSurfaceY - entity.height;
        entity.vy = 0;
        entity.grounded = true;
        entity.standingOnSolid = bestSlope;
      }
    }

    // 2. Handle Inverted / Ceiling Slopes (slope_ceil_up and slope_ceil_down)
    for (const solid of solids) {
      if (!solid.active || !isCeilSlope(solid)) continue;

      if (entity.x + entity.width > solid.x && entity.x < solid.x + solid.width) {
        const probeX = Math.max(solid.x, Math.min(solid.x + solid.width, entity.x + entity.width / 2));
        const relX = (probeX - solid.x) / solid.width;
        const ceilY = isCeilSlopeUp(solid)
          ? solid.y + (1 - relX) * solid.height
          : solid.y + relX * solid.height;

        // Bonking head on diagonal underside from below
        if (entity.vy < 0 && entity.y <= ceilY && entity.y + entity.height > ceilY) {
          entity.y = ceilY;
          entity.vy = 0;
        }
        // Standing on flat top if exposed
        else if (entity.vy >= 0 && (entity.y + entity.height) >= solid.y - 12 && (entity.y + entity.height) <= solid.y + 12) {
          const hasBlockAbove = solids.some(s => s.active && s !== solid && Math.abs(s.x - solid.x) < 2 && Math.abs((s.y + s.height) - solid.y) < 2);
          if (!hasBlockAbove) {
            entity.y = solid.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = solid;
          }
        }
      }
    }

    // 3. Handle Standard Solids & One-Way Platforms
    for (const solid of solids) {
      if (!solid.active) continue;
      if (isSlope(solid)) continue;

      // One-way platforms (cloud & semisolid)
      if (solid.isOneWay || solid.variant === 'cloud' || solid.variant === 'semisolid') {
        if (entity.vy > 0 && this.checkOverlap(entity, solid)) {
          const pFootY = prevY !== undefined ? (prevY + entity.height) : (entity.y + entity.height - (entity.vy * (dt || 0.016)));
          if (pFootY <= solid.y + 12) {
            entity.y = solid.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = solid;
          }
        }
        continue;
      }

      if (this.checkOverlap(entity, solid)) {
        const coveredTop = this.getCoveringGroundSlope(solid, solids);
        if (coveredTop && entity.vy >= 0) continue;

        if (entity.vy > 0 || (entity.grounded && (entity.y + entity.height) > solid.y)) {
          const cFootY = entity.y + entity.height;
          const pFootY = prevY !== undefined ? (prevY + entity.height) : (cFootY - (entity.vy * (dt || 0.016)));
          const maxStepDown = Math.max(16, (entity.vy * (dt || 0.016)) + 8);
          if (pFootY <= solid.y + maxStepDown && cFootY <= solid.y + maxStepDown + 8) {
            entity.y = solid.y - entity.height;
            entity.standingOnSolid = solid;

            if (solid.variant === 'note') {
              entity.vy = -860;
              entity.grounded = false;
              if (solid.bump) solid.bump();
            } else if (solid.variant === 'donut') {
              if (solid.shakeTimer === 0 && !solid.isDropping) {
                solid.shakeTimer = 0.01;
              }
              entity.vy = 0;
              entity.grounded = true;
            } else if (solid.bounciness && solid.bounciness > 0.05) {
              entity.vy = -entity.vy * solid.bounciness;
              if (Math.abs(entity.vy) < 80) {
                entity.vy = 0;
                entity.grounded = true;
              }
            } else {
              entity.vy = 0;
              entity.grounded = true;
            }
          }
        } else if (entity.vy < 0) {
          // Bonking head on bottom of solid
          const solidBottom = solid.y + solid.height;
          const prevHeadY = prevY !== undefined ? prevY : (entity.y - (entity.vy * (dt || 0.016)));
          const maxStepUp = Math.max(16, Math.abs(entity.vy * (dt || 0.016)) + 6);
          const struckFromBelow = (prevHeadY >= solidBottom - maxStepUp) &&
                                  (entity.y >= solidBottom - 16) &&
                                  (entity.y + entity.height > solidBottom);
          const horizAligned = (entity.x + entity.width > solid.x + 4) && (entity.x < solid.x + solid.width - 4);

          if (struckFromBelow && horizAligned) {
            entity.y = solidBottom;
            entity.vy = 0;

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
    }

    // Safety grounding check: if feet are resting on top surface of solid/slope within 4px
    if (!entity.grounded && entity.vy >= 0) {
      for (const solid of solids) {
        if (!solid.active) continue;
        if (solid.isSlope || solid.variant?.includes('slope')) continue;
        if (this.getCoveringGroundSlope(solid, solids)) continue;
        const onTop = Math.abs((entity.y + entity.height) - solid.y) <= 4;
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

      if (!entity.grounded) {
        const safetyFootX = entity.x + entity.width / 2;
        const centerOnAnySlope = solids.some(s =>
          s.active && isGroundSlope(s) && safetyFootX >= s.x && safetyFootX <= s.x + s.width
        );
        for (const slope of solids) {
          if (!slope.active || !isGroundSlope(slope)) continue;
          if (centerOnAnySlope && !(safetyFootX >= slope.x && safetyFootX <= slope.x + slope.width)) continue;
          if (entity.x + entity.width > slope.x && entity.x < slope.x + slope.width) {
            const footX = entity.x + entity.width / 2;
            const px = Math.max(slope.x, Math.min(slope.x + slope.width, footX));
            const relX = (px - slope.x) / slope.width;
            const surfY = isSlopeUp(slope)
              ? slope.y + (1 - relX) * slope.height
              : slope.y + relX * slope.height;

            const curFootY = entity.y + entity.height;
            if (Math.abs(curFootY - surfY) <= 8) {
              entity.y = surfY - entity.height;
              entity.vy = 0;
              entity.grounded = true;
              entity.standingOnSolid = slope;
              break;
            }
          }
        }
      }
    }
  }

  // Safety: Eject any entity that somehow ended up inside the solid wedge of a slope
  resolveSlopeEntrapment(entity, solids) {
    const isGroundSlope = (s) => s && (s.isSlope || s.variant?.includes('slope')) &&
      !s.slopeDirection?.includes('ceil') && !s.variant?.includes('slope_ceil');

    for (const slope of solids) {
      if (!slope.active || !isGroundSlope(slope)) continue;
      const dir = slope.slopeDirection || (slope.variant?.includes('slope_up') ? 'up' : 'down');

      // Check if entity is inside slope bounding box
      if (entity.x + entity.width > slope.x && entity.x < slope.x + slope.width &&
          entity.y + entity.height > slope.y && entity.y < slope.y + slope.height) {
        const footX = Math.max(slope.x, Math.min(slope.x + slope.width, entity.x + entity.width / 2));
        const relX = (footX - slope.x) / slope.width;
        const surfY = dir === 'up'
          ? slope.y + (1 - relX) * slope.height
          : slope.y + relX * slope.height;

        const curFootY = entity.y + entity.height;
        // If entity's feet are beneath the surface and inside the wedge
        if (curFootY > surfY && entity.y < slope.y + slope.height) {
          entity.y = surfY - entity.height;
          if (entity.vy > 0) entity.vy = 0;
          entity.grounded = true;
          entity.standingOnSolid = slope;
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
