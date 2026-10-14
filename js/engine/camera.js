// Sidehop 2D Smooth Tracking & Editor Pan Camera

export class Camera {
  constructor(viewportWidth = 960, viewportHeight = 540) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1.0;
    this.minX = 0;
    this.minY = -1000;
    this.maxX = 4000;
    this.maxY = 1200;
  }

  resize(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  // Smoothly track target in Play Mode
  follow(target, dt) {
    if (!target) return;
    // Keep target roughly in the horizontal center-left and vertical lower-middle
    const desiredX = target.x + target.width / 2 - this.viewportWidth * 0.45;
    const desiredY = target.y + target.height / 2 - this.viewportHeight * 0.6;

    // Smooth lerp follow
    const lerpSpeed = 6.0;
    this.x += (desiredX - this.x) * Math.min(1.0, lerpSpeed * dt);
    this.y += (desiredY - this.y) * Math.min(1.0, lerpSpeed * dt);

    this.clamp();
  }

  // Direct pan for Edit Mode
  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  clamp() {
    this.x = Math.max(this.minX, Math.min(this.maxX - this.viewportWidth, this.x));
    this.y = Math.max(this.minY, Math.min(this.maxY - this.viewportHeight, this.y));
  }

  // Transform screen coordinates (mouse click) to world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: screenX + this.x,
      y: screenY + this.y
    };
  }

  // Transform world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.x,
      y: worldY - this.y
    };
  }
}
