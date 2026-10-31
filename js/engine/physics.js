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
      // Skip one-way platforms horizontally
      if (solid.isOneWay || solid.variant === 'cloud' || solid.variant === 'semisolid') continue;

      // Slopes: the diagonal face is resolved vertically, but the flat vertical
      // side of every slope wedge is a real wall and must block like a block side.
      if (isSlope(solid)) {
        this.resolveSlopeWallFace(entity, solid, solids, prevX);
        continue;
      }

      // Ignore horizontal collision if vertical overlap is merely boundary-level (e.g. resting on floor)
      const verticalOverlap = Math.min(entity.y + entity.height, solid.y + solid.height) - Math.max(entity.y, solid.y);
      if (verticalOverlap <= 3) continue;

      if (!this.checkOverlap(entity, solid)) continue;

      const hasNeighborLeft = this.hasSolidNeighborLeft(solid, solids);
      const hasNeighborRight = this.hasSolidNeighborRight(solid, solids);

      if (entity.vx > 0) {
        // Entity moving right: only an exposed left edge of solid can block it!
        if (hasNeighborLeft) continue;

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
        // Entity moving left: only an exposed right edge of solid can block it!
        if (hasNeighborRight) continue;

        // Check if right face is the top junction of an adjoining slope_down
        const connectedSlopeDown = solids.some(s =>
          s.active && isSlopeDown(s) &&
          Math.abs(s.x - (solid.x + solid.width)) <= 2 &&
          Math.abs(s.y - solid.y) <= 2
        );
        if (connectedSlopeDown) continue;

        entity.x = solid.x + solid.width;
        entity.vx = 0;
      } else {
        // Entity vx is 0 (or was stopped earlier this frame) but still penetrates an exposed wall:
        // Push entity out to the nearest exposed face to prevent clipping/tunneling!
        if (!hasNeighborRight && (!hasNeighborLeft ? (entity.x + entity.width / 2 > solid.x + solid.width / 2) : true)) {
          entity.x = solid.x + solid.width;
        } else if (!hasNeighborLeft) {
          entity.x = solid.x - entity.width;
        }
      }
    }
  }

  // Returns true if solid has an adjacent solid block or slope covering its left face
  hasSolidNeighborLeft(solid, solids) {
    const isSlopeDown = (s) => s && (s.slopeDirection === 'down' || s.variant?.includes('slope_down'));
    const isSlopeCeilUp = (s) => s && (s.slopeDirection === 'ceil_up' || s.variant?.includes('slope_ceil_up'));
    return solids.some(s => {
      if (!s || s === solid || !s.active || s.isOneWay || s.variant === 'cloud' || s.variant === 'semisolid') return false;
      if (Math.abs((s.x + s.width) - solid.x) > 2) return false;
      if (solid.y >= s.y + s.height - 2 || solid.y + solid.height <= s.y + 2) return false;
      // If neighbor to the left has height 0 at its right edge, it does not cover solid's left face
      if (isSlopeDown(s) && !isSlopeCeilUp(s)) return false;
      return true;
    });
  }

  // Returns true if solid has an adjacent solid block or slope covering its right face
  hasSolidNeighborRight(solid, solids) {
    const isSlopeUp = (s) => s && (s.slopeDirection === 'up' || s.variant?.includes('slope_up'));
    const isSlopeCeilDown = (s) => s && (s.slopeDirection === 'ceil_down' || s.variant?.includes('slope_ceil_down'));
    return solids.some(s => {
      if (!s || s === solid || !s.active || s.isOneWay || s.variant === 'cloud' || s.variant === 'semisolid') return false;
      if (Math.abs(s.x - (solid.x + solid.width)) > 2) return false;
      if (solid.y >= s.y + s.height - 2 || solid.y + solid.height <= s.y + 2) return false;
      // If neighbor to the right has height 0 at its left edge, it does not cover solid's right face
      if (isSlopeUp(s) && !isSlopeCeilDown(s)) return false;
      return true;
    });
  }

  // Returns the ground slope (slope_up / slope_down, any material) sitting directly on top of a block, if any.
  // Such a block's top face is internal: the walkable surface is the slope's diagonal above it.
  getCoveringGroundSlope(solid, solids) {
    for (const s of solids) {
      if (!s || s === solid || !s.active) continue;
      const v = s.variant || '';
      if (!(s.isSlope || v.includes('slope'))) continue;
      if (v.includes('slope_ceil') || s.slopeDirection === 'ceil_up' || s.slopeDirection === 'ceil_down') continue;
      if (Math.abs(s.x - solid.x) < 2 && Math.abs((s.y + s.height) - solid.y) < 2) return s;
    }
    return null;
  }

  // Blocks the entity against the flat vertical side of a slope wedge.
  //   slope_up (◢) & slope_ceil_down (◥) -> vertical RIGHT face
  //   slope_down (◣) & slope_ceil_up (◤) -> vertical LEFT face
  resolveSlopeWallFace(entity, slope, solids, prevX) {
    const v = slope.variant || '';
    const dir = slope.slopeDirection ||
      (v.includes('slope_ceil_up') ? 'ceil_up' : v.includes('slope_ceil_down') ? 'ceil_down' :
       v.includes('slope_up') ? 'up' : v.includes('slope_down') ? 'down' : null);
    const hasRightWall = dir === 'up' || dir === 'ceil_down';
    const hasLeftWall = dir === 'down' || dir === 'ceil_up';
    if (!hasRightWall && !hasLeftWall) return;

    const verticalOverlap = Math.min(entity.y + entity.height, slope.y + slope.height) - Math.max(entity.y, slope.y);
    if (verticalOverlap <= 3) return;
    if (!this.checkOverlap(entity, slope)) return;

    if (hasRightWall) {
      if (this.hasSolidNeighborRight(slope, solids)) return;
      const face = slope.x + slope.width;
      const footY = entity.y + entity.height;
      if (dir === 'up' && footY <= slope.y + 4) return;
      if (dir === 'ceil_down' && entity.y >= slope.y + slope.height - 4) return;

      if (entity.vx < 0 || entity.x < face) {
        entity.x = face;
        if (entity.vx < 0) entity.vx = 0;
      }
    } else if (hasLeftWall) {
      if (this.hasSolidNeighborLeft(slope, solids)) return;
      const face = slope.x;
      const footY = entity.y + entity.height;
      if (dir === 'down' && footY <= slope.y + 4) return;
      if (dir === 'ceil_up' && entity.y >= slope.y + slope.height - 4) return;

      if (entity.vx > 0 || entity.x + entity.width > face) {
        entity.x = face - entity.width;
        if (entity.vx > 0) entity.vx = 0;
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

    // 1. Handle Walkable Ground Slopes (slope_up and slope_down across all materials)
    // Find all active ground slopes overlapping entity horizontally AND vertically near the entity's feet
    const footYInitial = entity.y + entity.height;
    const overlappingGroundSlopes = solids.filter(s =>
      s.active && isGroundSlope(s) &&
      entity.x + entity.width > s.x && entity.x < s.x + s.width &&
      footYInitial >= s.y - 28 && footYInitial <= s.y + s.height + 32
    );

    if (overlappingGroundSlopes.length > 0) {
      const footX = entity.x + entity.width / 2;
      const footY = entity.y + entity.height;
      const prevFootY = prevY !== undefined ? (prevY + entity.height) : (footY - (entity.vy * (dt || 0.016)));

      let bestSlope = null;
      let bestSurfaceY = Infinity;

      // Sample the slope surface under the entity's CENTER. When the center is over a slope tile,
      // only that tile counts — neighbouring tiles touched by the leading edge are ignored.
      // (Sampling neighbours at their clamped corner made the player pop up ~half a tile each time
      // its edge crossed into the next slope tile, so climbing looked jumpy / stair-stepped.)
      // Edge-clamped sampling is kept only as a fallback when no slope is under the center
      // (e.g. stepping onto the foot of a slope or holding onto a peak's edge).
      const centerSlopes = overlappingGroundSlopes.filter(s => footX >= s.x && footX <= s.x + s.width);
      const slopeCandidates = centerSlopes.length > 0 ? centerSlopes : overlappingGroundSlopes;

      for (const slope of slopeCandidates) {
        // Robust overlap clamping: minX < maxX and minX <= px <= maxX
        const minX = Math.max(slope.x, entity.x);
        const maxX = Math.min(slope.x + slope.width, entity.x + entity.width);
        const px = Math.max(minX, Math.min(maxX, footX));
        const relX = (px - slope.x) / slope.width;
        const surfY = isSlopeUp(slope)
          ? slope.y + (1 - relX) * slope.height
          : slope.y + relX * slope.height;

        // Interaction condition:
        // Entity's feet MUST be vertically close to surfY (both above and below bounds!)
        // so lower platforms or clouds below a higher slope NEVER teleport the player upward.
        const maxFallStep = Math.max(20, Math.abs(entity.vy * (dt || 0.016)) + 12);
        const isDescendingOrGrounded = (wasGrounded || wasStandingOnSolid) &&
          (footY >= surfY - 20) &&
          (footY <= surfY + 22) &&
          (prevFootY >= surfY - 24) &&
          (prevFootY <= surfY + 24);
        const isLandingFromAbove = (entity.vy >= 0) &&
          (prevFootY <= surfY + 14) &&
          (footY >= surfY - 6) &&
          (footY <= surfY + maxFallStep);
        const isPenetratingWedge = (footY >= surfY) &&
          (footY <= surfY + 22) &&
          (prevFootY <= surfY + 22) &&
          (prevFootY <= slope.y + slope.height + 6);

        if (entity.vy >= -60 && (isDescendingOrGrounded || isLandingFromAbove || isPenetratingWedge)) {
          // If multiple slopes overlap near the entity's feet, pick the highest support surface (smallest Y)
          if (surfY < bestSurfaceY) {
            bestSurfaceY = surfY;
            bestSlope = slope;
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

    // 1b. Handle Inverted / Ceiling Slopes (slope_ceil_up and slope_ceil_down)
    for (const solid of solids) {
      if (!solid.active || !isCeilSlope(solid)) continue;

      if (entity.x + entity.width > solid.x && entity.x < solid.x + solid.width) {
        const probeX = Math.max(solid.x, Math.min(solid.x + solid.width, entity.x + entity.width / 2));
        const relX = (probeX - solid.x) / solid.width;
        // Diagonal underside ceiling height at probeX
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

    for (const solid of solids) {
      if (!solid.active) continue;
      // Slopes (ground and ceiling) are already resolved above
      if (isSlope(solid)) continue;

      // 2. Handle One-Way Platforms (Cloud Platforms & Semi-Solid Boardwalks)
      if (solid.isOneWay || solid.variant === 'cloud' || solid.variant === 'semisolid') {
        if (entity.vy > 0 && this.checkOverlap(entity, solid)) {
          // Only land if entity was previously at or above top edge
          const prevFootY = prevY !== undefined ? (prevY + entity.height) : (entity.y + entity.height - (entity.vy * (dt || 0.016)));
          if (prevFootY <= solid.y + 12) {
            entity.y = solid.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
            entity.standingOnSolid = solid;
          }
        }
        continue;
      }

      if (this.checkOverlap(entity, solid)) {
        // A block directly under a ground slope has an internal top face — the slope diagonal is the
        // real surface. Never snap the player onto it.
        const coveredTop = this.getCoveringGroundSlope(solid, solids);
        if (coveredTop && entity.vy >= 0) continue;

        if (entity.vy > 0 || (entity.grounded && (entity.y + entity.height) > solid.y)) {
          // Landing on top of solid:
          // Ensure entity entered from above the solid's top surface and feet are near solid.y
          const footY = entity.y + entity.height;
          const prevFootY = prevY !== undefined ? (prevY + entity.height) : (footY - (entity.vy * (dt || 0.016)));
          const maxStepDown = Math.max(16, (entity.vy * (dt || 0.016)) + 6);
          if (prevFootY <= solid.y + maxStepDown && footY <= solid.y + maxStepDown + 8) {
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
          }
        } else if (entity.vy < 0) {
          // Bonking head on bottom of solid
          // 1. Verify this is not a plateau block connected to an adjacent slope on the side the entity is approaching from
          const connectedSlopeUp = solids.some(s =>
            s.active && isSlopeUp(s) &&
            Math.abs((s.x + s.width) - solid.x) <= 2 &&
            Math.abs(s.y - solid.y) <= 2
          );
          const connectedSlopeDown = solids.some(s =>
            s.active && isSlopeDown(s) &&
            Math.abs(s.x - (solid.x + solid.width)) <= 2 &&
            Math.abs(s.y - solid.y) <= 2
          );

          const footX = entity.x + entity.width / 2;
          const isApproachingFromSlopeUp = connectedSlopeUp && footX <= solid.x + 8;
          const isApproachingFromSlopeDown = connectedSlopeDown && footX >= solid.x + solid.width - 8;

          // 2. Verify entity's head actually struck the bottom edge from underneath
          const solidBottom = solid.y + solid.height;
          const prevHeadY = prevY !== undefined ? prevY : (entity.y - (entity.vy * (dt || 0.016)));
          const maxStepUp = Math.max(16, Math.abs(entity.vy * (dt || 0.016)) + 6);

          // Head must have been at/below bottom of solid before the step and feet cannot be near top of solid
          const struckFromBelow = (prevHeadY >= solidBottom - maxStepUp) &&
                                  (entity.y >= solidBottom - 16) &&
                                  (entity.y + entity.height > solidBottom);

          // Entity must have meaningful horizontal overlap under the block (not just grazing vertical side)
          const horizAligned = (entity.x + entity.width > solid.x + 4) && (entity.x < solid.x + solid.width - 4);

          if (struckFromBelow && horizAligned && !isApproachingFromSlopeUp && !isApproachingFromSlopeDown) {
            entity.y = solidBottom;
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
    }

    // Safety grounding check: if feet are resting on top surface of solid/slope within 4px and downward/neutral vy
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
          // Same center-first rule as the main slope pass (prevents neighbour-tile pops)
          if (centerOnAnySlope && !(safetyFootX >= slope.x && safetyFootX <= slope.x + slope.width)) continue;
          if (entity.x + entity.width > slope.x && entity.x < slope.x + slope.width) {
            const minX = Math.max(slope.x, entity.x);
            const maxX = Math.min(slope.x + slope.width, entity.x + entity.width);
            const footX = entity.x + entity.width / 2;
            const px = Math.max(minX, Math.min(maxX, footX));
            const relX = (px - slope.x) / slope.width;
            const surfY = isSlopeUp(slope)
              ? slope.y + (1 - relX) * slope.height
              : slope.y + relX * slope.height;

            const footY = entity.y + entity.height;
            if (Math.abs(footY - surfY) <= 6) {
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
