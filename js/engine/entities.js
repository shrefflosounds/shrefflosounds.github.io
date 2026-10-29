// Sidehop Entity System — Player, Crates, Springs, Hazards, Enemies, Platforms, Goals

import { sounds } from '../audio/sound.js?v=20261029_165613';

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

  // --- LIFELIKE 3D PER-PIXEL RAYTRACED & NORMAL-MAPPED RENDER ENGINE ---
  static get3DCache() {
    if (!Entity._cache3D) Entity._cache3D = new Map();
    return Entity._cache3D;
  }

  static get3DCanvas(key, w, h, buildFn) {
    const cache = Entity.get3DCache();
    if (cache.has(key)) return cache.get(key);
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cctx = c.getContext('2d');
    buildFn(cctx, w, h);
    cache.set(key, c);
    return c;
  }

  static hash2D(ix, iy, seed = 0) {
    let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  static noise2D(x, y, periodX = 0, periodY = 0, seed = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const wrap = (v, p) => (p > 0 ? ((v % p) + p) % p : v);
    const x0 = wrap(ix, periodX);
    const x1 = wrap(ix + 1, periodX);
    const y0 = wrap(iy, periodY);
    const y1 = wrap(iy + 1, periodY);
    const a = Entity.hash2D(x0, y0, seed);
    const b = Entity.hash2D(x1, y0, seed);
    const c = Entity.hash2D(x0, y1, seed);
    const d = Entity.hash2D(x1, y1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  static fbm2D(x, y, octaves = 4, periodX = 0, periodY = 0, seed = 0) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      val += amp * Entity.noise2D(x * freq, y * freq, periodX * freq, periodY * freq, seed + i * 31);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val / norm;
  }

  static voronoi2D(x, y, periodX = 0, periodY = 0, seed = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const wrap = (v, p) => (p > 0 ? ((v % p) + p) % p : v);
    let d1 = 8;
    let d2 = 8;
    let cellId = 0;
    let bestDx = 0;
    let bestDy = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = wrap(ix + i, periodX);
        const cy = wrap(iy + j, periodY);
        const rx = i + Entity.hash2D(cx, cy, seed) * 0.78 + 0.11 - fx;
        const ry = j + Entity.hash2D(cx, cy, seed + 79) * 0.78 + 0.11 - fy;
        const d = Math.hypot(rx, ry);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          bestDx = -rx;
          bestDy = -ry;
          cellId = Entity.hash2D(cx, cy, seed + 193);
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return { d1, d2, edge: d2 - d1, cellId, dx: bestDx, dy: bestDy };
  }

  static drawLifelikeSpectacledEyes(ctx, leftX, rightX, eyeY, radius = 5.4, irisHex = '#38BDF8', frameColor = '#1E293B') {
    const eyes = [leftX, rightX];
    eyes.forEach((ex) => {
      // 1. Deep 3D orbital eye socket shadow (soft ambient occlusion)
      const sockG = ctx.createRadialGradient(ex, eyeY + 0.6, radius * 0.4, ex, eyeY + 0.6, radius * 1.38);
      sockG.addColorStop(0, 'rgba(15, 5, 5, 0.85)');
      sockG.addColorStop(0.65, 'rgba(30, 10, 10, 0.45)');
      sockG.addColorStop(1, 'rgba(30, 10, 10, 0)');
      ctx.fillStyle = sockG;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.6, radius * 1.38, 0, Math.PI * 2);
      ctx.fill();

      // 2. 3D Spherical Wet Sclera with Subsurface Pinkish-Crimson Rim
      const scleraG = ctx.createRadialGradient(ex - radius * 0.28, eyeY - radius * 0.28, radius * 0.1, ex, eyeY, radius);
      scleraG.addColorStop(0, '#FFFFFF');
      scleraG.addColorStop(0.62, '#F1F5F9');
      scleraG.addColorStop(0.86, '#E2C6C6');
      scleraG.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = scleraG;
      ctx.beginPath();
      ctx.arc(ex, eyeY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle organic micro-capillary on outer sclera
      ctx.strokeStyle = 'rgba(185, 28, 28, 0.32)';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(ex - radius * 0.82, eyeY - 0.8);
      ctx.quadraticCurveTo(ex - radius * 0.62, eyeY + 0.4, ex - radius * 0.48, eyeY - 0.2);
      ctx.stroke();

      // 3. Multi-layered Fibrous 3D Iris
      const ix = ex + radius * 0.14;
      const iy = eyeY;
      const ir = radius * 0.56;
      const irisG = ctx.createRadialGradient(ix - ir * 0.2, iy - ir * 0.2, ir * 0.1, ix, iy, ir);
      irisG.addColorStop(0, '#FEF08A');
      irisG.addColorStop(0.55, irisHex);
      irisG.addColorStop(0.88, '#0F172A');
      irisG.addColorStop(1, '#020617');
      ctx.fillStyle = irisG;
      ctx.beginPath();
      ctx.arc(ix, iy, ir, 0, Math.PI * 2);
      ctx.fill();

      // 4. Deep Black Pupil
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(ix + 0.2, iy, ir * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // 5. Upper eyelid cast shadow arc across top of eyeball
      const lidShadow = ctx.createLinearGradient(ex, eyeY - radius, ex, eyeY - radius * 0.2);
      lidShadow.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
      lidShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = lidShadow;
      ctx.beginPath();
      ctx.arc(ex, eyeY, radius, Math.PI, Math.PI * 2);
      ctx.fill();

      // 6. Dual Wet Corneal Specular Catchlights
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - radius * 0.18, eyeY - radius * 0.28, radius * 0.23, 0, Math.PI * 2);
      ctx.arc(ix + ir * 0.38, iy + ir * 0.35, radius * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // 7. Subtle Refractive Glass Lens Sheen inside Spectacles
      const lensG = ctx.createLinearGradient(ex - radius, eyeY - radius, ex + radius, eyeY + radius);
      lensG.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
      lensG.addColorStop(0.45, 'rgba(255, 255, 255, 0.02)');
      lensG.addColorStop(1, 'rgba(56, 189, 248, 0.12)');
      ctx.fillStyle = lensG;
      ctx.beginPath();
      ctx.arc(ex, eyeY, radius * 1.08, 0, Math.PI * 2);
      ctx.fill();

      // 8. 3D Cylindrical Metallic Wire-Frame Spectacle Rim
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.arc(ex + 0.4, eyeY + 0.7, radius * 1.1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      ctx.arc(ex, eyeY, radius * 1.1, 0, Math.PI * 2);
      ctx.stroke();

      // Specular metallic glint on top-left wire rim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(ex, eyeY, radius * 1.1, Math.PI * 1.08, Math.PI * 1.62);
      ctx.stroke();
    });

    // 3D Curved Metal Nose Bridge connecting the two lenses
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(leftX + radius * 1.08, eyeY - 0.5);
    ctx.quadraticCurveTo((leftX + rightX) * 0.5, eyeY - 2.2, rightX - radius * 1.08, eyeY - 0.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(leftX + radius * 1.08, eyeY - 1.0);
    ctx.quadraticCurveTo((leftX + rightX) * 0.5, eyeY - 2.7, rightX - radius * 1.08, eyeY - 1.0);
    ctx.stroke();
  }

  // Per-pixel 3D Raytraced Superquadric Rounded-Cube Body Builder (for Hero & 3D Creatures)
  static getLifelikeBodyCanvas(key, w, h, baseRGB, hasHorns = true) {
    return Entity.get3DCanvas(key, w, h, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;
      const [br, bg, bb] = baseRGB;
      // Key light from upper-left-front: (-0.42, -0.58, 0.70)
      const lx = -0.42, ly = -0.58, lz = 0.70;
      // Halfway vector for Blinn-Phong specular with view (0, 0, 1)
      const hLen = Math.hypot(lx, ly, lz + 1);
      const hx = lx / hLen, hy = ly / hLen, hz = (lz + 1) / hLen;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          const u = (px / cw) * 40;
          const v = (py / ch) * 48;
          let r = 0, g = 0, b = 0, a = 0;

          // 1. Soft 3D Ground Contact Shadow at bottom (v around 44..47.5)
          const sdX = (u - 20) / 16.5;
          const sdY = (v - 45.2) / 3.2;
          const sdDist = Math.hypot(sdX, sdY);
          if (sdDist < 1.0) {
            const sAlpha = Math.pow(1 - sdDist, 1.8) * 0.55;
            r = 8; g = 10; b = 15; a = sAlpha * 255;
          }

          // 2. Four Stubby 3D Cylindrical Legs (front pair & back pair at v = 37..45.5)
          const legs = [
            { cx: 10.5, r: 3.6, top: 37, bot: 45.2, shade: 1.0 },
            { cx: 15.2, r: 3.2, top: 37, bot: 44.4, shade: 0.72 },
            { cx: 24.8, r: 3.2, top: 37, bot: 44.4, shade: 0.72 },
            { cx: 29.5, r: 3.6, top: 37, bot: 45.2, shade: 1.0 }
          ];
          for (let li = 0; li < legs.length; li++) {
            const lg = legs[li];
            if (v >= lg.top && v <= lg.bot && Math.abs(u - lg.cx) <= lg.r) {
              const nx = (u - lg.cx) / lg.r;
              const ny = v > lg.bot - 2.2 ? (v - (lg.bot - 2.2)) / 2.2 : -0.15;
              const nzSq = 1 - nx * nx - ny * ny;
              if (nzSq > 0) {
                const nz = Math.sqrt(nzSq);
                const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
                const ao = Math.min(1, (v - lg.top) / 3.5);
                const lit = (0.22 + diff * 0.78) * lg.shade * (0.45 + 0.55 * ao);
                const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 28) * 0.35 * lg.shade;
                r = Math.min(255, br * lit + spec * 255);
                g = Math.min(255, bg * lit + spec * 255);
                b = Math.min(255, bb * lit + spec * 255);
                a = 255;
              }
            }
          }

          // 3. Sculpted 3D Conical Horn / Ear Nubs on Top Corners (v = 2.5..12)
          if (hasHorns && v >= 2.2 && v <= 12.5) {
            const horns = [
              { baseCx: 10.2, tipX: 8.4, tipY: 2.8, baseY: 11.5, baseR: 4.4 },
              { baseCx: 29.8, tipX: 31.6, tipY: 2.8, baseY: 11.5, baseR: 4.4 }
            ];
            for (let hi = 0; hi < 2; hi++) {
              const hn = horns[hi];
              const t = Math.max(0, Math.min(1, (v - hn.tipY) / (hn.baseY - hn.tipY)));
              const curCx = hn.tipX + (hn.baseCx - hn.tipX) * t;
              const curR = Math.max(0.9, hn.baseR * Math.pow(t, 0.72));
              const dx = u - curCx;
              if (Math.abs(dx) <= curR) {
                const nx = dx / curR;
                const ny = -0.38;
                const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
                const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
                const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 32) * 0.48;
                const sss = Math.pow(1 - t, 1.5) * 0.22;
                const lit = 0.28 + diff * 0.78 + sss;
                r = Math.min(255, br * lit + spec * 255);
                g = Math.min(255, bg * lit + spec * 240);
                b = Math.min(255, bb * lit + spec * 240);
                a = 255;
              }
            }
          }

          // 4. Main 3D Rounded-Cube Superquadric Body (u = 3.5..36.5, v = 7.5..40.5)
          // Slightly angled 3D perspective so top plane & left/right bevels have real 3D volume
          const bx = (u - 20.0) / 16.0;
          const by = (v - 24.0) / 15.8;
          // Superquadric distance: |x|^3.6 + |y|^3.6
          const ax = Math.abs(bx);
          const ay = Math.abs(by);
          const sqDist = Math.pow(ax, 3.6) + Math.pow(ay, 3.6);
          if (sqDist <= 1.0) {
            // Smooth anti-aliased edge coverage
            const edgeCov = Math.min(1, (1.0 - Math.pow(sqDist, 0.28)) * 22);
            // Compute 3D surface normal of rounded cube + subtle organic silicone/clay micro-bump
            const bumpX = (Entity.fbm2D(u * 0.35 + 0.2, v * 0.35, 3, 0, 0, 41) - Entity.fbm2D(u * 0.35 - 0.2, v * 0.35, 3, 0, 0, 41)) * 0.14;
            const bumpY = (Entity.fbm2D(u * 0.35, v * 0.35 + 0.2, 3, 0, 0, 41) - Entity.fbm2D(u * 0.35, v * 0.35 - 0.2, 3, 0, 0, 41)) * 0.14;

            let nx = Math.sign(bx) * Math.pow(ax, 2.4) * 0.92 + bx * 0.25 + bumpX;
            let ny = Math.sign(by) * Math.pow(ay, 2.4) * 0.92 + by * 0.25 + bumpY;
            // Visible 3D top bevel shelf (v around 7.5..11.5 tilts upward toward sky)
            if (by < -0.68) {
              ny -= 0.35 * ((-0.68 - by) / 0.32);
            }
            const nLen = Math.hypot(nx, ny, 1.0);
            nx /= nLen;
            ny /= nLen;
            const nz = Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny));

            // Key sun diffuse + sky hemisphere fill + warm subsurface scattering + rim light
            const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
            const wrapDiff = Math.max(0, (nx * lx + ny * ly + nz * lz + 0.35) / 1.35);
            const skyFill = (-ny * 0.5 + 0.5) * 0.22;
            const rim = Math.pow(1 - nz, 2.6) * (nx > 0.2 ? 0.32 : 0.12);
            // Glossy studio softbox reflection on upper-left brow
            const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz);
            const spec = Math.pow(nDotH, 42) * 0.62 + Math.pow(nDotH, 12) * 0.16;

            // Subtle anatomical mouth indentation at (u: 17..24, v: 29.5)
            const mouthDx = (u - 20.5) / 3.4;
            const mouthDy = (v - 29.5) / 1.1;
            const mouthDist = Math.hypot(mouthDx, mouthDy);
            const mouthShade = mouthDist < 1.0 ? (0.35 + 0.65 * mouthDist) : 1.0;

            const lit = (0.16 + nDotL * 0.68 + wrapDiff * 0.22 + skyFill) * mouthShade;
            const nr = Math.min(255, br * lit + spec * 255 + rim * 180);
            const ng = Math.min(255, bg * lit + spec * 245 + rim * 195);
            const nb = Math.min(255, bb * lit + spec * 250 + rim * 220);

            r = r * (1 - edgeCov) + nr * edgeCov;
            g = g * (1 - edgeCov) + ng * edgeCov;
            b = b * (1 - edgeCov) + nb * edgeCov;
            a = Math.max(a, edgeCov * 255);
          }

          const idx = (py * cw + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
      cctx.putImageData(img, 0, 0);
    });
  }

  // Per-pixel 3D Geological Soil Cross-Section & Volumetric Turf Builder (80x88, 2x Retina)
  static getLifelikeSoilCanvas(col, row, hasTop, hasBottom, hasLeft, hasRight) {
    const cMod = ((col % 4) + 4) % 4;
    const rMod = ((row % 2) + 2) % 2;
    const key = `soil3d_${cMod}_${rMod}_${hasTop ? 1 : 0}${hasBottom ? 1 : 0}${hasLeft ? 1 : 0}${hasRight ? 1 : 0}`;
    return Entity.get3DCanvas(key, 80, 88, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;
      const lx = -0.45, ly = -0.62, lz = 0.64;

      // Render 80x80 soil block in py = 8..87 (leaving py = 0..7 for 3D overhanging grass blades)
      for (let py = 8; py < ch; py++) {
        const by = py - 8; // 0..79
        for (let px = 0; px < cw; px++) {
          const wx = cMod * 80 + px;
          const wy = rMod * 80 + by;

          // Multi-scale seamless tileable soil FBM + Voronoi stone pebbles
          const n1 = Entity.fbm2D(wx * 0.075, wy * 0.075, 4, 24, 12, 17);
          const n2 = Entity.fbm2D((wx + 1.4) * 0.075, wy * 0.075, 4, 24, 12, 17);
          const n3 = Entity.fbm2D(wx * 0.075, (wy + 1.4) * 0.075, 4, 24, 12, 17);
          const fine = Entity.noise2D(wx * 0.35, wy * 0.35, 112, 56, 91);

          const vor = Entity.voronoi2D(wx * 0.0625, wy * 0.0625, 20, 10, 53);
          const isPebble = vor.cellId < 0.42 && vor.d1 < 0.34 && (hasTop || by > 13);

          let nx = (n1 - n2) * 2.4;
          let ny = (n1 - n3) * 2.4;
          let nz = 1.0;

          // Base dark loamy organic soil color with subterranean strata variation
          const strata = Math.sin(wy * 0.09 + n1 * 3.2) * 0.5 + 0.5;
          let baseR = 56 + strata * 18 + (fine - 0.5) * 16;
          let baseG = 33 + strata * 11 + (fine - 0.5) * 10;
          let baseB = 18 + strata * 6 + (fine - 0.5) * 6;
          let specAmt = 0.06;

          if (isPebble) {
            // 3D spherical embedded river pebble with mineral tint and crevice AO
            const pebNormR = vor.d1 / 0.34;
            nx = (vor.dx / 0.34) * 0.85 + nx * 0.2;
            ny = (vor.dy / 0.34) * 0.85 + ny * 0.2;
            nz = Math.sqrt(Math.max(0.08, 1 - pebNormR * pebNormR * 0.82));
            const mineralTone = (vor.cellId / 0.42);
            baseR = 112 + mineralTone * 38;
            baseG = 102 + mineralTone * 34;
            baseB = 92 + mineralTone * 28;
            specAmt = 0.28;
            // Dark crevice ambient occlusion around pebble rim
            if (pebNormR > 0.78) {
              const crevice = 1 - ((pebNormR - 0.78) / 0.22) * 0.65;
              baseR *= crevice;
              baseG *= crevice;
              baseB *= crevice;
            }
          }

          // 3D Bevel / Cliff edge rounding on exposed block boundaries (NO cartoon outlines!)
          let edgeAO = 1.0;
          if (!hasLeft && px < 10) {
            const t = (10 - px) / 10;
            nx -= t * 0.65;
            edgeAO *= (0.72 + 0.28 * (1 - t));
          }
          if (!hasRight && px > 69) {
            const t = (px - 69) / 10;
            nx += t * 0.75;
            edgeAO *= (0.48 + 0.52 * (1 - t));
          }
          if (!hasBottom && by > 68) {
            const t = (by - 68) / 11;
            ny += t * 0.85;
            edgeAO *= (0.38 + 0.62 * (1 - t));
          }
          // Cast shadow directly beneath overhanging turf canopy
          if (!hasTop && by < 22) {
            const turfShadow = by < 11 ? 0.38 : (0.38 + ((by - 11) / 11) * 0.62);
            edgeAO *= turfShadow;
          }

          const nLen = Math.hypot(nx, ny, nz);
          nx /= nLen; ny /= nLen; nz /= nLen;

          const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
          const spec = Math.pow(Math.max(0, nz), 18) * specAmt;
          const light = (0.32 + diff * 0.88) * edgeAO;

          const idx = (py * cw + px) * 4;
          data[idx] = Math.min(255, Math.max(0, baseR * light + spec * 255));
          data[idx + 1] = Math.min(255, Math.max(0, baseG * light + spec * 255));
          data[idx + 2] = Math.min(255, Math.max(0, baseB * light + spec * 255));
          data[idx + 3] = 255;
        }
      }
      cctx.putImageData(img, 0, 0);

      // Fine organic hanging root tendrils inside the soil cross-section
      cctx.save();
      cctx.lineCap = 'round';
      for (let ri = 0; ri < 5; ri++) {
        const rx = 8 + ((cMod * 37 + ri * 17) % 64);
        const ryStart = hasTop ? (10 + (ri * 13) % 24) : 18;
        const rLen = 18 + ((cMod * 11 + ri * 23) % 24);
        const curve = ((ri % 2 === 0) ? 1 : -1) * (6 + (ri * 3));
        // Root shadow
        cctx.strokeStyle = 'rgba(12, 6, 2, 0.55)';
        cctx.lineWidth = 2.0;
        cctx.beginPath();
        cctx.moveTo(rx + 1, ryStart + 1);
        cctx.quadraticCurveTo(rx + curve * 0.6 + 1, ryStart + rLen * 0.5 + 1, rx + curve + 1, ryStart + rLen + 1);
        cctx.stroke();
        // Root lit fiber
        cctx.strokeStyle = 'rgba(168, 118, 76, 0.58)';
        cctx.lineWidth = 1.2;
        cctx.beginPath();
        cctx.moveTo(rx, ryStart);
        cctx.quadraticCurveTo(rx + curve * 0.6, ryStart + rLen * 0.5, rx + curve, ryStart + rLen);
        cctx.stroke();
      }
      cctx.restore();

      // Volumetric 3D Living Turf Grass Canopy along Exposed Top Surface (!hasTop)
      if (!hasTop) {
        // 1. Dense dark root-thatch base layer with soft drop shadow
        const thatchGrad = cctx.createLinearGradient(0, 6, 0, 22);
        thatchGrad.addColorStop(0, '#4D9E2A');
        thatchGrad.addColorStop(0.55, '#255D16');
        thatchGrad.addColorStop(1, '#0F2908');
        cctx.fillStyle = thatchGrad;
        cctx.fillRect(0, 8, cw, 11);

        // 2. Overhanging 3D grass root tufts casting shadow onto soil below
        for (let gx = 0; gx < cw; gx += 2.2) {
          const seed = Entity.hash2D(cMod * 80 + Math.floor(gx), 1, 77);
          const droop = 17 + seed * 8;
          const lean = (seed - 0.5) * 5;
          cctx.strokeStyle = 'rgba(10, 24, 6, 0.65)';
          cctx.lineWidth = 2.1;
          cctx.beginPath();
          cctx.moveTo(gx, 14);
          cctx.lineTo(gx + lean, droop + 2);
          cctx.stroke();

          cctx.strokeStyle = seed > 0.5 ? '#3E8E22' : '#2D6E18';
          cctx.lineWidth = 1.6;
          cctx.beginPath();
          cctx.moveTo(gx, 13);
          cctx.lineTo(gx + lean, droop);
          cctx.stroke();
        }

        // 3. Hundreds of 3D-lit Individual Grass Blades (Back shadow layer -> Mid emerald -> Sunlit lime tips)
        for (let pass = 0; pass < 3; pass++) {
          const step = pass === 0 ? 1.6 : (pass === 1 ? 1.8 : 2.2);
          for (let gx = 0.5; gx < cw; gx += step) {
            const hSeed = Entity.hash2D(cMod * 100 + Math.floor(gx * 2), pass, 131);
            const tilt = (Entity.hash2D(cMod * 100 + Math.floor(gx * 2), pass + 10, 199) - 0.46) * 6.5;
            const rootY = 14 - pass * 1.5 + (hSeed * 3);
            const tipY = (pass === 0 ? 3.5 : (pass === 1 ? 2.0 : 0.8)) + hSeed * 4.5;

            const bGrad = cctx.createLinearGradient(gx, rootY, gx + tilt, tipY);
            if (pass === 0) {
              bGrad.addColorStop(0, '#14330B');
              bGrad.addColorStop(1, '#367A1E');
            } else if (pass === 1) {
              bGrad.addColorStop(0, '#1E4D12');
              bGrad.addColorStop(0.6, '#4EA82B');
              bGrad.addColorStop(1, '#8CE063');
            } else {
              bGrad.addColorStop(0, '#2E6F1B');
              bGrad.addColorStop(0.5, '#65C438');
              bGrad.addColorStop(1, '#D9F99D');
            }
            cctx.strokeStyle = bGrad;
            cctx.lineWidth = pass === 2 ? 1.35 : 1.7;
            cctx.lineCap = 'round';
            cctx.beginPath();
            cctx.moveTo(gx, rootY);
            cctx.quadraticCurveTo(gx + tilt * 0.45, (rootY + tipY) * 0.5, gx + tilt, tipY);
            cctx.stroke();
          }
        }
      }
    });
  }

  // Per-pixel 3D Translucent Glacial Ice Block Builder (80x80, 2x Retina, Seamless 9-Slice)
  static getLifelikeIceCanvas(col, hasTop, hasBottom, hasLeft, hasRight) {
    const cMod = ((col % 4) + 4) % 4;
    const key = `ice3d_${cMod}_${hasTop ? 1 : 0}${hasBottom ? 1 : 0}${hasLeft ? 1 : 0}${hasRight ? 1 : 0}`;
    return Entity.get3DCanvas(key, 80, 80, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          const wx = cMod * 80 + px;
          const wy = py;

          // Multi-scale Voronoi internal glacial crystal fractures + FBM caustic waves
          const vLarge = Entity.voronoi2D(wx * 0.028, wy * 0.032, 9, 4, 307);
          const vSmall = Entity.voronoi2D(wx * 0.065, wy * 0.065, 21, 6, 509);
          const fbm = Entity.fbm2D(wx * 0.05, wy * 0.05, 3, 16, 8, 701);

          // Internal fracture planes (bright white-cyan refractive cracks inside the ice)
          const crack1 = Math.max(0, 1 - vLarge.edge / 0.065);
          const crack2 = Math.max(0, 1 - vSmall.edge / 0.048) * 0.65;
          const facetShade = (vLarge.cellId - 0.5) * 0.18 + (fbm - 0.5) * 0.22;

          // Vertical depth gradient: frosted white-cyan top -> rich glacial cyan middle -> bright bottom caustic
          const yNorm = py / ch;
          let r = 24 + (1 - yNorm) * 115 + facetShade * 55;
          let g = 168 + (1 - yNorm) * 68 + facetShade * 45;
          let b = 212 + (1 - yNorm) * 38 + facetShade * 30;

          // Apply internal crystal fracture highlights
          const crackGlow = Math.min(1, crack1 * crack1 * 0.95 + crack2 * 0.65);
          r = r + (248 - r) * crackGlow;
          g = g + (254 - g) * crackGlow;
          b = b + (255 - b) * crackGlow;

          // Top 3D refractive frost bevel (!hasTop)
          if (!hasTop && py < 14) {
            const topT = Math.pow(1 - py / 14, 1.5);
            r = r + (245 - r) * topT * 0.88;
            g = g + (253 - g) * topT * 0.92;
            b = b + (255 - b) * topT * 0.95;
          }
          // Bottom internal total-reflection caustic rim (!hasBottom)
          if (!hasBottom && py > 68) {
            const botT = (py - 68) / 12;
            r = r * (1 - botT * 0.35) + 120 * botT * 0.35;
            g = g * (1 - botT * 0.15) + 235 * botT * 0.15;
            b = Math.min(255, b + botT * 28);
          }
          // Left/Right exposed 3D beveled ice edges
          if (!hasLeft && px < 10) {
            const lt = (10 - px) / 10;
            r = r + (235 - r) * lt * 0.65;
            g = g + (250 - g) * lt * 0.65;
            b = b + (255 - b) * lt * 0.65;
          }
          if (!hasRight && px > 70) {
            const rt = (px - 70) / 10;
            r *= (1 - rt * 0.38);
            g *= (1 - rt * 0.25);
            b *= (1 - rt * 0.15);
          }

          const idx = (py * cw + px) * 4;
          data[idx] = Math.min(255, Math.max(0, r));
          data[idx + 1] = Math.min(255, Math.max(0, g));
          data[idx + 2] = Math.min(255, Math.max(0, b));
          data[idx + 3] = 242; // Slight optical translucency
        }
      }
      cctx.putImageData(img, 0, 0);

      // Trapped 3D spherical micro air bubbles inside ice
      for (let bi = 0; bi < 6; bi++) {
        const bx = 10 + ((cMod * 29 + bi * 13) % 60);
        const by = 16 + ((cMod * 19 + bi * 17) % 50);
        const br = 1.4 + (bi % 3) * 0.9;
        cctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        cctx.beginPath();
        cctx.arc(bx, by, br, 0, Math.PI * 2);
        cctx.fill();
        cctx.fillStyle = '#FFFFFF';
        cctx.beginPath();
        cctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.4, 0, Math.PI * 2);
        cctx.fill();
      }

      // 8-Ray Optical Starburst Specular Glint on Top Ice Bevel (matches 01_sidehop_50pct_realism_diorama.png!)
      if (!hasTop && (cMod === 0 || cMod === 2)) {
        const sx = cMod === 0 ? 24 : 54;
        const sy = 10;
        const glow = cctx.createRadialGradient(sx, sy, 0.5, sx, sy, 14);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        glow.addColorStop(0.35, 'rgba(224, 242, 254, 0.55)');
        glow.addColorStop(1, 'rgba(224, 242, 254, 0)');
        cctx.fillStyle = glow;
        cctx.beginPath();
        cctx.arc(sx, sy, 14, 0, Math.PI * 2);
        cctx.fill();

        cctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        cctx.lineWidth = 1.4;
        [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].forEach((ang, i) => {
          const len = i < 2 ? 12 : 7;
          cctx.beginPath();
          cctx.moveTo(sx - Math.cos(ang) * len, sy - Math.sin(ang) * len);
          cctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
          cctx.stroke();
        });
      }
    });
  }

  // Per-pixel 3D Raytraced Glazed Bakery Donut Builder (80x80, 2x Retina)
  static getLifelikeDonutCanvas() {
    return Entity.get3DCanvas('donut3d_v2', 80, 80, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;
      const cx = 40, cy = 40;
      const R = 23.5; // Major radius of torus
      const rTube = 13.0; // Minor tube radius
      const lx = -0.42, ly = -0.58, lz = 0.70;
      const hLen = Math.hypot(lx, ly, lz + 1);
      const hx = lx / hLen, hy = ly / hLen, hz = (lz + 1) / hLen;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const d = Math.hypot(dx, dy);

          // Soft cast drop shadow shifted (+2.5, +4.0)
          const sDist = Math.abs(Math.hypot(px - (cx + 2.5), py - (cy + 4.0)) - R);
          let outR = 0, outG = 0, outB = 0, outA = 0;
          if (sDist < rTube + 3.5) {
            const sAlpha = Math.pow(Math.max(0, 1 - sDist / (rTube + 3.5)), 2.0) * 0.45;
            outR = 12; outG = 8; outB = 10; outA = sAlpha * 255;
          }

          const distFromRing = d - R;
          if (Math.abs(distFromRing) <= rTube) {
            const edgeCov = Math.min(1, (rTube - Math.abs(distFromRing)) * 1.5);
            const z = Math.sqrt(Math.max(0.01, rTube * rTube - distFromRing * distFromRing));
            const theta = Math.atan2(dy, dx);
            const cosT = d > 0.001 ? dx / d : 1;
            const sinT = d > 0.001 ? dy / d : 0;

            // Exact 3D torus normal
            const bump = (Entity.noise2D(px * 0.25, py * 0.25, 0, 0, 88) - 0.5) * 0.12;
            let nx = (distFromRing / rTube) * cosT + bump;
            let ny = (distFromRing / rTube) * sinT + bump;
            let nz = z / rTube;
            const nLen = Math.hypot(nx, ny, nz);
            nx /= nLen; ny /= nLen; nz /= nLen;

            // Organic scalloped strawberry icing boundary along outer & inner rim
            const dripOuter = R + rTube * (0.66 + 0.14 * Math.sin(theta * 5 + 0.7) + 0.08 * Math.cos(theta * 3));
            const dripInner = R - rTube * (0.68 + 0.10 * Math.cos(theta * 4 - 0.5));
            const isIcing = (d <= dripOuter && d >= dripInner);

            const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
            const wrap = Math.max(0, (nx * lx + ny * ly + nz * lz + 0.4) / 1.4);
            const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz);

            let mr, mg, mb;
            if (isIcing) {
              // Thick glossy strawberry-pink glaze with wet Blinn-Phong specular reflection
              const spec = Math.pow(nDotH, 54) * 0.85 + Math.pow(nDotH, 14) * 0.22;
              const sss = Math.pow(1 - nz, 2.2) * 0.18;
              const lit = 0.26 + nDotL * 0.58 + wrap * 0.28 + sss;
              mr = Math.min(255, 244 * lit + spec * 255);
              mg = Math.min(255, 102 * lit + spec * 255);
              mb = Math.min(255, 172 * lit + spec * 255);
            } else {
              // Golden-brown fried bakery dough underside/rim
              const spec = Math.pow(nDotH, 16) * 0.18;
              const lit = 0.22 + nDotL * 0.65 + wrap * 0.25;
              mr = Math.min(255, 232 * lit + spec * 255);
              mg = Math.min(255, 158 * lit + spec * 220);
              mb = Math.min(255, 82 * lit + spec * 180);
            }

            outR = outR * (1 - edgeCov) + mr * edgeCov;
            outG = outG * (1 - edgeCov) + mg * edgeCov;
            outB = outB * (1 - edgeCov) + mb * edgeCov;
            outA = Math.max(outA, edgeCov * 255);
          }

          const idx = (py * cw + px) * 4;
          data[idx] = outR;
          data[idx + 1] = outG;
          data[idx + 2] = outB;
          data[idx + 3] = outA;
        }
      }
      cctx.putImageData(img, 0, 0);

      // 3D Cylindrical Sugar Sprinkles with individual drop shadows & specular sheen
      const sprinkles = [
        [-19, -14, 0.45, '#FEF08A'],
        [0, -23, 0.12, '#FFFFFF'],
        [18, -15, -0.52, '#38BDF8'],
        [23, 2, 1.15, '#4ADE80'],
        [16, 18, 0.62, '#FDE047'],
        [-2, 23, -0.18, '#FFFFFF'],
        [-18, 15, -0.42, '#60A5FA'],
        [-23, 0, 1.25, '#86EFAC'],
        [-10, -21, -0.35, '#FB7185'],
        [11, -21, 0.38, '#FACC15']
      ];
      sprinkles.forEach(([sx, sy, rot, col]) => {
        cctx.save();
        cctx.translate(cx + sx, cy + sy);
        cctx.rotate(rot);
        // Cast shadow on glaze
        cctx.fillStyle = 'rgba(60, 10, 30, 0.42)';
        cctx.beginPath();
        cctx.roundRect(-4.5, -1.2, 9, 4.2, 2);
        cctx.fill();
        // 3D pill body
        cctx.fillStyle = col;
        cctx.beginPath();
        cctx.roundRect(-5, -2.2, 9, 4.0, 2);
        cctx.fill();
        // Specular cylinder highlight along top of sprinkle
        cctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        cctx.fillRect(-3.8, -1.7, 6.6, 1.2);
        cctx.restore();
      });
    });
  }

  // Per-pixel 3D Sculpted Steamed Bao / Porcelain Cloud Platform Builder (88x88, 2x Retina)
  static getLifelikeCloudCanvas() {
    return Entity.get3DCanvas('cloud3d_bao_v2', 88, 88, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;
      const cx = 44, cy = 48;
      const rx = 38, ry = 28;
      const lx = -0.38, ly = -0.65, lz = 0.66;
      const hLen = Math.hypot(lx, ly, lz + 1);
      const hx = lx / hLen, hy = ly / hLen, hz = (lz + 1) / hLen;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          let outR = 0, outG = 0, outB = 0, outA = 0;

          // 1. Bioluminescent Mint-Cyan Volumetric Underglow at flat base (py around 62..84)
          const glowDx = (px - cx) / 36;
          const glowDy = (py - 68) / 14;
          const glowDist = Math.hypot(glowDx, glowDy);
          if (glowDist < 1.0) {
            const gInt = Math.pow(1 - glowDist, 2.0) * 0.78;
            outR = 52; outG = 235; outB = 188; outA = gInt * 255;
          }

          // 2. Sculpted 3D Oblate Steamed Bao Shape with Flattened Bottom & Pinched Crown
          const nyRaw = (py - cy) / ry;
          // Bao is wider near bottom-middle and pinched toward top apex
          const pinchScale = nyRaw < 0 ? (1.0 - 0.18 * Math.pow(-nyRaw, 1.4)) : (1.0 + 0.08 * nyRaw);
          const nxRaw = (px - cx) / (rx * pinchScale);
          // Flatten bottom below nyRaw > 0.58
          const effNy = nyRaw > 0.52 ? (0.52 + (nyRaw - 0.52) * 2.1) : nyRaw;
          const rSq = nxRaw * nxRaw + effNy * effNy;

          if (rSq <= 1.0) {
            const edgeCov = Math.min(1, (1 - Math.sqrt(rSq)) * 18);
            const nzBase = Math.sqrt(Math.max(0.02, 1 - rSq));

            // 7 radial steamed-bao pleat creases converging toward the top crown (cx, cy - 18)
            const pleatDx = px - cx;
            const pleatDy = py - (cy - 16);
            const pleatDist = Math.hypot(pleatDx, pleatDy);
            const pleatAng = Math.atan2(pleatDy, pleatDx);
            const pleatEnv = Math.max(0, 1 - pleatDist / 32) * (pleatDist > 3 ? 1 : pleatDist / 3);
            const pleatWave = Math.sin(pleatAng * 7) * pleatEnv;

            // Fine steamed dough micro-pores
            const doughTex = (Entity.fbm2D(px * 0.22, py * 0.22, 3, 0, 0, 613) - 0.5) * 0.08;

            let nx = nxRaw + Math.cos(pleatAng + Math.PI / 2) * pleatWave * 0.28 + doughTex;
            let ny = effNy + Math.sin(pleatAng + Math.PI / 2) * pleatWave * 0.28 + doughTex;
            let nz = nzBase - Math.abs(pleatWave) * 0.12;
            const nLen = Math.hypot(nx, ny, nz);
            nx /= nLen; ny /= nLen; nz /= nLen;

            const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
            // Warm subsurface scattering through soft white dough
            const wrap = Math.max(0, (nx * lx + ny * ly + nz * lz + 0.55) / 1.55);
            const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz);
            const spec = Math.pow(nDotH, 24) * 0.22;

            // Crease ambient occlusion in the pinched folds
            const foldAO = 1 - Math.max(0, -pleatWave) * 0.22;
            const lit = (0.38 + nDotL * 0.42 + wrap * 0.26) * foldAO;

            // Bounce cyan-mint bioluminescent light on the underside of the bao (effNy > 0.35)
            const cyanBounce = Math.max(0, (effNy - 0.25) / 0.75);
            let mr = Math.min(255, (250 * lit + spec * 255) * (1 - cyanBounce * 0.42) + 80 * cyanBounce * 0.42);
            let mg = Math.min(255, (246 * lit + spec * 255) * (1 - cyanBounce * 0.12) + 245 * cyanBounce * 0.12);
            let mb = Math.min(255, (238 * lit + spec * 255) * (1 - cyanBounce * 0.18) + 220 * cyanBounce * 0.18);

            outR = outR * (1 - edgeCov) + mr * edgeCov;
            outG = outG * (1 - edgeCov) + mg * edgeCov;
            outB = outB * (1 - edgeCov) + mb * edgeCov;
            outA = Math.max(outA, edgeCov * 255);
          }

          const idx = (py * cw + px) * 4;
          data[idx] = outR;
          data[idx + 1] = outG;
          data[idx + 2] = outB;
          data[idx + 3] = outA;
        }
      }
      cctx.putImageData(img, 0, 0);
    });
  }

  // Per-pixel 3D Machined Brushed Steel / Industrial Aluminum Block Builder (80x80, 2x Retina)
  static getLifelikeStoneCanvas(hasTop, hasBottom, hasLeft, hasRight) {
    const key = `stone3d_${hasTop ? 1 : 0}${hasBottom ? 1 : 0}${hasLeft ? 1 : 0}${hasRight ? 1 : 0}`;
    return Entity.get3DCanvas(key, 80, 80, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          // Anisotropic horizontal brushed stainless-steel micro-grain
          const brush = Entity.fbm2D(px * 0.035, py * 0.85, 3, 0, 0, 911);
          //Diagonal metallic specular sheen
          const diag = Math.sin((px * 0.7 + py * 0.5) * 0.055) * 0.5 + 0.5;
          let lum = 148 + (brush - 0.5) * 28 + diag * 36;

          // 3D 45-degree outer chamfer bevels
          const bev = 6;
          if (!hasTop && py < bev) lum += 48 * (1 - py / bev);
          if (!hasLeft && px < bev) lum += 34 * (1 - px / bev);
          if (!hasBottom && py >= ch - bev) lum -= 62 * (1 - (ch - 1 - py) / bev);
          if (!hasRight && px >= cw - bev) lum -= 52 * (1 - (cw - 1 - px) / bev);

          // Subtle machined seam between connected steel blocks
          if (hasTop && py < 2) lum -= 24;
          if (hasLeft && px < 2) lum -= 24;
          if (hasBottom && py >= ch - 2) lum -= 32;
          if (hasRight && px >= cw - 2) lum -= 32;

          // Signature Recessed 3D Square Industrial Socket in center (px: 20..60, py: 20..60)
          if (px >= 20 && px < 60 && py >= 20 && py < 60) {
            const ib = 4;
            if (py < 20 + ib) {
              // Top inner shadow bevel of recessed socket
              lum = 68 + (brush - 0.5) * 16;
            } else if (px < 20 + ib) {
              // Left inner shadow bevel
              lum = 82 + (brush - 0.5) * 16;
            } else if (py >= 60 - ib) {
              // Bottom inner lit bevel catching overhead sun
              lum = 212 + (brush - 0.5) * 18;
            } else if (px >= 60 - ib) {
              // Right inner lit bevel
              lum = 192 + (brush - 0.5) * 18;
            } else {
              // Recessed inner brushed plate
              lum = 128 + (brush - 0.5) * 22 + diag * 20;
            }
          }

          // Cool titanium-steel tint
          const r = Math.min(255, Math.max(0, lum * 0.95));
          const g = Math.min(255, Math.max(0, lum * 0.99));
          const b = Math.min(255, Math.max(0, lum * 1.06));
          const idx = (py * cw + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
      cctx.putImageData(img, 0, 0);

      // 4 Countersunk 3D Hex Socket Bolts in corners
      [ [11, 11], [69, 11], [11, 69], [69, 69] ].forEach(([bx, by]) => {
        cctx.fillStyle = '#1E293B';
        cctx.beginPath();
        cctx.arc(bx + 0.8, by + 1.0, 3.8, 0, Math.PI * 2);
        cctx.fill();
        const bGrad = cctx.createLinearGradient(bx - 3, by - 3, bx + 3, by + 3);
        bGrad.addColorStop(0, '#F8FAFC');
        bGrad.addColorStop(0.5, '#94A3B8');
        bGrad.addColorStop(1, '#334155');
        cctx.fillStyle = bGrad;
        cctx.beginPath();
        cctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        cctx.fill();
      });
    });
  }

  // Per-pixel 3D Beveled Amber-Gold Mystery Block Builder (80x80, 2x Retina)
  static getLifelikeMysteryCanvas(isUsed = false) {
    const key = isUsed ? 'mystery3d_used_v2' : 'mystery3d_active_v2';
    return Entity.get3DCanvas(key, 80, 80, (cctx, cw, ch) => {
      const img = cctx.createImageData(cw, ch);
      const data = img.data;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          const tex = Entity.fbm2D(px * 0.08, py * 0.08, 3, 0, 0, 443);
          const cx = (px - 40) / 40;
          const cy = (py - 40) / 40;
          const rad = Math.hypot(cx + 0.25, cy + 0.28);

          let r, g, b;
          if (isUsed) {
            const v = 115 - rad * 35 + (tex - 0.5) * 18;
            r = v * 1.05; g = v * 0.96; b = v * 0.88;
          } else {
            // Warm glowing amber-gold resin & brushed brass
            const glow = Math.max(0, 1 - rad * 0.72);
            r = 195 + glow * 60 + (tex - 0.5) * 18;
            g = 128 + glow * 88 + (tex - 0.5) * 16;
            b = 14 + glow * 48 + (tex - 0.5) * 10;
          }

          // 3D Chamfered outer bevels (7px)
          const bev = 7;
          if (py < bev) {
            const t = 1 - py / bev;
            r += 55 * t; g += 55 * t; b += 55 * t;
          }
          if (px < bev) {
            const t = 1 - px / bev;
            r += 35 * t; g += 35 * t; b += 35 * t;
          }
          if (py >= ch - bev) {
            const t = 1 - (ch - 1 - py) / bev;
            r *= (1 - 0.48 * t); g *= (1 - 0.48 * t); b *= (1 - 0.48 * t);
          }
          if (px >= cw - bev) {
            const t = 1 - (cw - 1 - px) / bev;
            r *= (1 - 0.38 * t); g *= (1 - 0.38 * t); b *= (1 - 0.38 * t);
          }

          const idx = (py * cw + px) * 4;
          data[idx] = Math.min(255, Math.max(0, r));
          data[idx + 1] = Math.min(255, Math.max(0, g));
          data[idx + 2] = Math.min(255, Math.max(0, b));
          data[idx + 3] = 255;
        }
      }
      cctx.putImageData(img, 0, 0);

      // 4 Recessed Corner Machine Screws
      [ [12, 12], [68, 12], [12, 68], [68, 68] ].forEach(([sx, sy]) => {
        cctx.fillStyle = isUsed ? '#292524' : '#78350F';
        cctx.beginPath();
        cctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
        cctx.fill();
        cctx.strokeStyle = isUsed ? '#78716C' : '#FDE68A';
        cctx.lineWidth = 1.2;
        cctx.beginPath();
        cctx.moveTo(sx - 2, sy - 2);
        cctx.lineTo(sx + 2, sy + 2);
        cctx.stroke();
      });

      if (!isUsed) {
        // 3D Extruded / Recessed '?' Emblem with Drop Shadow & Specular Highlight
        cctx.font = '900 46px "Fredoka", sans-serif';
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';
        // Deep cast shadow
        cctx.fillStyle = 'rgba(69, 26, 3, 0.72)';
        cctx.fillText('?', 42.5, 44.5);
        // Top-left bright specular bevel
        cctx.fillStyle = '#FFFFFF';
        cctx.fillText('?', 39, 41);
        // Main engraved dark-bronze / ivory inlay
        const qGrad = cctx.createLinearGradient(0, 18, 0, 62);
        qGrad.addColorStop(0, '#78350F');
        qGrad.addColorStop(0.5, '#451A03');
        qGrad.addColorStop(1, '#92400E');
        cctx.fillStyle = qGrad;
        cctx.fillText('?', 40.5, 42.5);
      }
    });
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
          // LIFELIKE 3D HERO: Per-Pixel Raytraced 3D Rounded-Cube Character (Subsurface scattering, studio softbox reflection, 3D legs & horns)
          let baseRgb = [225, 38, 46];
          if (this.color && this.color.startsWith('#') && this.color.length === 7) {
            baseRgb = [
              parseInt(this.color.slice(1, 3), 16) || 225,
              parseInt(this.color.slice(3, 5), 16) || 38,
              parseInt(this.color.slice(5, 7), 16) || 46
            ];
          }
          const bodyCanvas = Entity.getLifelikeBodyCanvas('hero3d_' + (this.color || 'red'), 80, 96, baseRgb, true);
          ctx.drawImage(bodyCanvas, 0, 0, this.width, this.height);

          // Lifelike 3D anatomical eyes with round wire-frame spectacles & optical lens glint
          Entity.drawLifelikeSpectacledEyes(ctx, 14.5, 26.5, 19.5, 5.2, '#38BDF8', '#1E293B');

          // Subtle 3D anatomical mouth crease with lower-lip highlight
          ctx.strokeStyle = 'rgba(40, 5, 8, 0.72)';
          ctx.lineWidth = 1.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(20.5, 28.0, 3.8, 0.18, Math.PI - 0.18);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 200, 200, 0.35)';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.arc(20.5, 29.0, 3.4, 0.25, Math.PI - 0.25);
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

        // Equipped Pistol
        if (this.hasPistol) {
          const recoilX = this.recoilTimer > 0 ? -4 : 0;
          ctx.save();
          ctx.translate(26 + recoilX, 22);

          if (isUncanny) {
            // 3D Blued-Steel & Brushed Aluminum Sidearm with Walnut Grip
            const slideGrad = ctx.createLinearGradient(0, -6, 0, 1);
            slideGrad.addColorStop(0, '#94A3B8');
            slideGrad.addColorStop(0.35, '#334155');
            slideGrad.addColorStop(1, '#0F172A');
            ctx.fillStyle = slideGrad;
            ctx.beginPath();
            ctx.roundRect(0, -6, 16, 7, 1.8);
            ctx.fill();

            const gripGrad = ctx.createLinearGradient(-2, 0, 4, 9);
            gripGrad.addColorStop(0, '#78350F');
            gripGrad.addColorStop(1, '#270E04');
            ctx.fillStyle = gripGrad;
            ctx.beginPath();
            ctx.roundRect(-2, 0, 6, 9, 1.8);
            ctx.fill();

            // Specular barrel highlight & fiber-optic sight
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.fillRect(1, -5.2, 13, 1.2);
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(13.5, -6.8, 1.8, 1.2);
          } else {
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
          }

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
    const topMatchesOrCovers = (myMat === 'stone' || myMat === 'ice')
      ? matchesMat(topEnt)
      : Boolean(topEnt && isSolidOpaque(topEnt) && topEnt.variant !== 'donut');
    const hasTop = Boolean(myHasTopFace && topHasBottomFace && topMatchesOrCovers);

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

      // 0. LIFELIKE 3D SLOPES (All 45° Slants: up, down, ceil_up, ceil_down for Soil, Stone, and Ice)
      if (this.isSlope && pal.theme === 'uncanny') {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        const mat = this.effectiveMaterial;
        const dir = this.slopeDirection;
        const col = Math.round(this.x / 40);
        const row = Math.round(this.y / 40);

        ctx.save();
        ctx.beginPath();
        if (dir === 'up') {
          ctx.moveTo(0, this.height);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), 0);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), this.height + (hasBottom ? 0.5 : 0));
        } else if (dir === 'down') {
          ctx.moveTo(hasLeft ? -0.5 : 0, 0);
          ctx.lineTo(this.width, this.height);
          ctx.lineTo(hasLeft ? -0.5 : 0, this.height + (hasBottom ? 0.5 : 0));
        } else if (dir === 'ceil_up') {
          ctx.moveTo(hasLeft ? -0.5 : 0, hasTop ? -0.5 : 0);
          ctx.lineTo(this.width, hasTop ? -0.5 : 0);
          ctx.lineTo(hasLeft ? -0.5 : 0, this.height);
        } else {
          ctx.moveTo(0, hasTop ? -0.5 : 0);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), hasTop ? -0.5 : 0);
          ctx.lineTo(this.width + (hasRight ? 0.5 : 0), this.height);
        }
        ctx.closePath();
        ctx.clip();

        if (mat === 'stone') {
          const stCanvas = Entity.getLifelikeStoneCanvas(hasTop, hasBottom, hasLeft, hasRight);
          ctx.drawImage(stCanvas, 0, 0, this.width, this.height);
        } else if (mat === 'ice') {
          const iceCanvas = Entity.getLifelikeIceCanvas(col, row, true, hasBottom, hasLeft, hasRight);
          ctx.drawImage(iceCanvas, 0, 0, this.width, this.height);
        } else {
          const soilCanvas = Entity.getLifelikeSoilCanvas(col, row, true, hasBottom, hasLeft, hasRight);
          ctx.drawImage(soilCanvas, 0, -4, this.width, this.height + 4);
        }
        ctx.restore();

        // 3D Hypotenuse Bevel / Volumetric Grass Blades along the 45° slope face (ZERO black outlines!)
        if (mat === 'stone') {
          const x1 = (dir === 'up' || dir === 'ceil_up') ? 0 : 0;
          const y1 = (dir === 'up' || dir === 'ceil_up') ? this.height : 0;
          const x2 = this.width;
          const y2 = (dir === 'up' || dir === 'ceil_up') ? 0 : this.height;
          ctx.strokeStyle = (dir === 'up' || dir === 'down') ? 'rgba(255, 255, 255, 0.78)' : 'rgba(15, 23, 42, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (mat === 'ice') {
          const x1 = 0;
          const y1 = (dir === 'up' || dir === 'ceil_up') ? this.height : 0;
          const x2 = this.width;
          const y2 = (dir === 'up' || dir === 'ceil_up') ? 0 : this.height;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.lineWidth = 3.0;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (dir === 'up' || dir === 'down') {
          // 3D Volumetric Turf Mat & Grass Blades rising along the 45° slope
          const isUp = dir === 'up';
          const yStart = isUp ? this.height : 0;
          const yEnd = isUp ? 0 : this.height;

          // Cast shadow underneath turf along slope
          ctx.strokeStyle = 'rgba(10, 4, 1, 0.55)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(isUp ? 5 : 0, isUp ? this.height : 5);
          ctx.lineTo(isUp ? this.width : this.width - 5, isUp ? 5 : this.height);
          ctx.stroke();

          // Rich 3D turf body along slope
          const turfG = ctx.createLinearGradient(0, 0, 0, this.height);
          turfG.addColorStop(0, '#84CC16');
          turfG.addColorStop(0.5, '#4D7C0F');
          turfG.addColorStop(1, '#1A2E05');
          ctx.strokeStyle = turfG;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, yStart + 2);
          ctx.lineTo(this.width, yEnd + 2);
          ctx.stroke();

          // Individual 3D grass blades growing along the 45° incline
          for (let step = 2; step <= this.width - 2; step += 3) {
            const bx = step;
            const by = isUp ? (this.height - step) : step;
            const bLen = 4.5 + Entity.hash2D(step + col * 19, row, 88) * 4.5;
            const lean = (Entity.hash2D(step, col, 99) - 0.5) * 3.5;
            const bGrad = ctx.createLinearGradient(bx, by + 2, bx + lean, by - bLen);
            bGrad.addColorStop(0, '#1A2E05');
            bGrad.addColorStop(0.45, '#4D7C0F');
            bGrad.addColorStop(1, (step % 6 === 0) ? '#D9F99D' : '#A3E635');
            ctx.fillStyle = bGrad;
            ctx.beginPath();
            ctx.moveTo(bx - 1.6, by + 3);
            ctx.quadraticCurveTo(bx + lean * 0.4, by - bLen * 0.4, bx + lean, by - bLen);
            ctx.lineTo(bx + 1.6, by + 3);
            ctx.closePath();
            ctx.fill();
          }
        }
        return;
      }

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
          // LIFELIKE 3D Miniature Wooden & Brushed-Steel Workbench Trestle with 3 Glowing Red LED Indicator Lenses!
          ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
          ctx.fillRect(1, 12, this.width - 2, 5);

          // 3D A-frame angled walnut & steel trestle legs
          const legGradL = ctx.createLinearGradient(4, 12, 13, 12);
          legGradL.addColorStop(0, '#D9A066');
          legGradL.addColorStop(0.35, '#8F563B');
          legGradL.addColorStop(0.85, '#4A2812');
          legGradL.addColorStop(1, '#261206');
          ctx.fillStyle = legGradL;
          ctx.beginPath();
          ctx.moveTo(6, 11); ctx.lineTo(14, 11); ctx.lineTo(11, this.height); ctx.lineTo(3, this.height);
          ctx.closePath();
          ctx.fill();

          const legGradR = ctx.createLinearGradient(this.width - 14, 12, this.width - 3, 12);
          legGradR.addColorStop(0, '#D9A066');
          legGradR.addColorStop(0.35, '#8F563B');
          legGradR.addColorStop(0.85, '#4A2812');
          legGradR.addColorStop(1, '#261206');
          ctx.fillStyle = legGradR;
          ctx.beginPath();
          ctx.moveTo(this.width - 14, 11); ctx.lineTo(this.width - 6, 11); ctx.lineTo(this.width - 3, this.height); ctx.lineTo(this.width - 11, this.height);
          ctx.closePath();
          ctx.fill();

          // Horizontal cross-brace beam with 3D metallic bolts
          const braceGrad = ctx.createLinearGradient(0, this.height - 13, 0, this.height - 6);
          braceGrad.addColorStop(0, '#B4845C');
          braceGrad.addColorStop(0.4, '#7C4D2B');
          braceGrad.addColorStop(1, '#341A0B');
          ctx.fillStyle = braceGrad;
          ctx.beginPath();
          ctx.roundRect(4, this.height - 13, this.width - 8, 6.5, 1.5);
          ctx.fill();

          // 3D Butcher-Block / Brushed Brass Top Deck with Chamfered Bevel
          const railGrad = ctx.createLinearGradient(0, 0, 0, 12);
          railGrad.addColorStop(0, '#FDE68A');
          railGrad.addColorStop(0.18, '#D9A066');
          railGrad.addColorStop(0.65, '#8F563B');
          railGrad.addColorStop(1, '#3E1F0D');
          ctx.fillStyle = railGrad;
          ctx.beginPath();
          ctx.roundRect(0, 0, this.width, 12, 3);
          ctx.fill();

          // Top specular edge highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fillRect(2, 1, this.width - 4, 1.8);

          // 3 Glowing Red LED Indicator Lenses embedded in top rail
          [this.width * 0.22, this.width * 0.5, this.width * 0.78].forEach(lx => {
            // Chrome bezel ring
            ctx.fillStyle = '#1E293B';
            ctx.beginPath();
            ctx.arc(lx, 6, 3.6, 0, Math.PI * 2);
            ctx.fill();

            // Volumetric red LED bloom
            const ledGlow = ctx.createRadialGradient(lx, 6, 0.4, lx, 6, 6.5);
            ledGlow.addColorStop(0, '#FFFFFF');
            ledGlow.addColorStop(0.32, '#FF2A55');
            ledGlow.addColorStop(0.65, 'rgba(239, 68, 68, 0.45)');
            ledGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = ledGlow;
            ctx.beginPath();
            ctx.arc(lx, 6, 6.5, 0, Math.PI * 2);
            ctx.fill();

            // Glossy ruby lens dome
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(lx, 6, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(lx - 0.8, 5.1, 0.9, 0, Math.PI * 2);
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
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        if (pal.theme === 'uncanny') {
          const col = Math.round(this.x / 40);
          const row = Math.round(this.y / 40);
          const soilCanvas = Entity.getLifelikeSoilCanvas(col, row, hasTop, hasBottom, hasLeft, hasRight);
          ctx.drawImage(soilCanvas, 0, 0, 80, 50, 0, -4, this.width, this.height + 4);
        } else {
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
      }

      // 5. MEGA BLOCK (80×80 2×2 Giant Terrain Block)
      else if (this.variant === 'mega') {
        if (pal.theme === 'uncanny') {
          const col = Math.round(this.x / 40);
          const row = Math.round(this.y / 40);
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
              const sCanvas = Entity.getLifelikeSoilCanvas(col + c, row + r, r > 0, r === 0, c > 0, c === 0);
              ctx.drawImage(sCanvas, c * 40, r * 40 - 4, 40, 44);
            }
          }
        } else {
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
      }

      // 6. WARP PIPE (40×80 Green Pipe)
      else if (this.variant === 'pipe') {
        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Cylindrical Phong-Shaded Industrial Emerald Pipe (Zero Cartoon Outlines!)
          // Cast shadow under pipe lip onto stem
          const stemGrad = ctx.createLinearGradient(0, 22, this.width, 22);
          stemGrad.addColorStop(0, '#064E3B');
          stemGrad.addColorStop(0.18, '#10B981');
          stemGrad.addColorStop(0.32, '#A7F3D0');
          stemGrad.addColorStop(0.45, '#34D399');
          stemGrad.addColorStop(0.75, '#059669');
          stemGrad.addColorStop(0.92, '#064E3B');
          stemGrad.addColorStop(1, '#022C22');
          ctx.fillStyle = stemGrad;
          ctx.fillRect(0, 21, this.width, this.height - 21);

          // Cast shadow immediately beneath collar
          const collarShadow = ctx.createLinearGradient(0, 21, 0, 30);
          collarShadow.addColorStop(0, 'rgba(2, 44, 34, 0.72)');
          collarShadow.addColorStop(1, 'rgba(2, 44, 34, 0)');
          ctx.fillStyle = collarShadow;
          ctx.fillRect(0, 21, this.width, 9);

          // 3D Cylindrical Collar / Flange at top (-4..width+4, 0..22)
          const lipGrad = ctx.createLinearGradient(-4, 0, this.width + 4, 0);
          lipGrad.addColorStop(0, '#064E3B');
          lipGrad.addColorStop(0.16, '#10B981');
          lipGrad.addColorStop(0.30, '#ECFDF5');
          lipGrad.addColorStop(0.42, '#34D399');
          lipGrad.addColorStop(0.74, '#059669');
          lipGrad.addColorStop(0.92, '#064E3B');
          lipGrad.addColorStop(1, '#022C22');
          ctx.fillStyle = lipGrad;
          ctx.beginPath();
          ctx.roundRect(-4, 0, this.width + 8, 22, 3);
          ctx.fill();

          // Top chamfered rim & dark hollow interior opening illusion
          const rimTop = ctx.createLinearGradient(-4, 0, this.width + 4, 0);
          rimTop.addColorStop(0, '#34D399');
          rimTop.addColorStop(0.3, '#FFFFFF');
          rimTop.addColorStop(1, '#047857');
          ctx.fillStyle = rimTop;
          ctx.fillRect(-3, 0.5, this.width + 6, 2.5);

          // Machined flange bolts along collar bottom rim
          [2, 14, 26, 38].forEach(bx => {
            ctx.fillStyle = '#022C22';
            ctx.beginPath();
            ctx.arc(bx + 0.5, 18.5, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#A7F3D0';
            ctx.beginPath();
            ctx.arc(bx, 18, 1.5, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
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
      }

      // 7. DONUT LIFT (Falling Donut Platform)
      else if (this.variant === 'donut') {
        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Per-Pixel Raytraced Glazed Torus Bakery Donut with 3D Pill Sprinkles!
          const donutCanvas = Entity.getLifelikeDonutCanvas();
          ctx.drawImage(donutCanvas, 0, 0, this.width, this.height);
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
        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Studio Acoustic Synthesizer Pad with Brushed Pearl Housing & Glowing Magenta Corner Pads
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(2, this.height - 1, this.width - 2, 5);

          const padGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
          padGrad.addColorStop(0, '#FFFFFF');
          padGrad.addColorStop(0.45, '#F1F5F9');
          padGrad.addColorStop(0.85, '#CBD5E1');
          padGrad.addColorStop(1, '#64748B');
          ctx.fillStyle = padGrad;
          ctx.beginPath();
          ctx.roundRect(0, 0, this.width, this.height, 6);
          ctx.fill();

          // Inner recessed rubberized studio pad
          const innerG = ctx.createRadialGradient(16, 14, 2, 20, 20, 18);
          innerG.addColorStop(0, '#FFFFFF');
          innerG.addColorStop(0.7, '#E2E8F0');
          innerG.addColorStop(1, '#94A3B8');
          ctx.fillStyle = innerG;
          ctx.beginPath();
          ctx.roundRect(4, 4, this.width - 8, this.height - 8, 4);
          ctx.fill();

          // 4 Glowing Neon-Magenta LED Corner Bumpers
          [ [5, 5], [this.width - 10, 5], [5, this.height - 10], [this.width - 10, this.height - 10] ].forEach(([cx, cy]) => {
            ctx.fillStyle = '#EC4899';
            ctx.beginPath();
            ctx.roundRect(cx, cy, 5, 5, 1.5);
            ctx.fill();
            ctx.fillStyle = '#FBCFE8';
            ctx.fillRect(cx + 1, cy + 1, 2, 1.5);
          });

          // 3D Extruded Chrome Eighth Note ♪
          ctx.font = '900 23px "Fredoka", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.fillText('♪', this.width / 2 + 1.2, this.height / 2 + 2.2);
          ctx.fillStyle = '#1E293B';
          ctx.fillText('♪', this.width / 2, this.height / 2 + 1);
        } else {
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
      }

      // 9. CASTLE STONE BLOCK
      else if (this.variant === 'stone') {
        const { hasTop, hasBottom, hasLeft, hasRight, rightEnt, bottomEnt } = this.getNeighbors();

        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Per-Pixel Brushed Stainless-Steel / Aluminum Industrial Block with Recessed Socket & 4 Hex Bolts!
          if (!hasBottom) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(1, this.height, this.width - 1, 5);
          }
          const stCanvas = Entity.getLifelikeStoneCanvas(hasTop, hasBottom, hasLeft, hasRight);
          ctx.drawImage(stCanvas, 0, 0, this.width, this.height);
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
        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Per-Pixel Chamfered Amber-Gold Block with 3D Embossed '?' & Corner Screws!
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(2, this.height, this.width - 2, 5);
          const mysCanvas = Entity.getLifelikeMysteryCanvas(!this.isUsed);
          ctx.drawImage(mysCanvas, 0, 0, this.width, this.height);
        } else if (!this.isUsed) {
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
        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Per-Pixel Raytraced Steamed Bao / Porcelain Cloud Platform with 7 Radial Pleats & Cyan-Mint Underglow!
          const cloudCanvas = Entity.getLifelikeCloudCanvas();
          ctx.drawImage(cloudCanvas, 0, 0, this.width, this.height);
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
          // LIFELIKE 3D Per-Pixel Refractive Glacial Ice with Continuous Voronoi Fractures, Micro-Bubbles & 8-Ray Optical Starburst!
          const col = Math.round(this.x / 40);
          const row = Math.round(this.y / 40);
          if (!hasBottom) {
            ctx.fillStyle = 'rgba(8, 145, 178, 0.34)';
            ctx.fillRect(0, this.height, this.width, 5);
          }
          const iceCanvas = Entity.getLifelikeIceCanvas(col, row, hasTop, hasBottom, hasLeft, hasRight);
          ctx.drawImage(iceCanvas, hasLeft ? -0.4 : 0, hasTop ? -0.4 : 0, this.width + (hasLeft ? 0.4 : 0) + (hasRight ? 0.4 : 0), this.height + (hasTop ? 0.4 : 0) + (hasBottom ? 0.4 : 0));
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

      // 13. STANDARD SOLID GROUND BLOCK (Theme-Aware: Lifelike 3D, Grass, Snowy, Night, Chrome, 8-Bit, Jungle, Neon, Atlantis)
      else {
        const { hasTop, hasBottom, hasLeft, hasRight } = this.getNeighbors();
        const col = Math.round(this.x / 40);
        const row = Math.round(this.y / 40);

        if (pal.theme === 'uncanny') {
          // LIFELIKE 3D Per-Pixel Normal-Mapped Geological Soil Cross-Section + 3D River Pebbles + Hanging Roots + 130 Volumetric Grass Blades!
          if (!hasBottom) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
            ctx.fillRect(hasLeft ? -0.4 : 0, this.height, this.width + (hasLeft ? 0.4 : 0) + (hasRight ? 0.4 : 0), 6);
          }
          const soilCanvas = Entity.getLifelikeSoilCanvas(col, row, hasTop, hasBottom, hasLeft, hasRight);
          const ox = hasLeft ? -0.4 : 0;
          const ow = this.width + (hasLeft ? 0.4 : 0) + (hasRight ? 0.4 : 0);
          ctx.drawImage(soilCanvas, ox, -4, ow, this.height + 4);
          return;
        }

        // Base Dirt / Stone Fill (with seamless 0.5px overlap on connecting edges)
        const xStart = hasLeft ? -0.5 : 0;
        const yStart = hasTop ? -0.5 : 0;
        const fillW = this.width + (hasRight ? 0.5 : 0) - xStart;
        const fillH = this.height + (hasBottom ? 0.5 : 0) - yStart;
        ctx.fillStyle = pal.dirtBase;
        ctx.fillRect(xStart, yStart, fillW, fillH);

        // Deterministic organic specks
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
          // LIFELIKE 3D Raytraced Machined Chrome Steel Cones on a Brushed Steel Base Bar (Zero Cartoon Outlines!)
          const numSpikes = 3;
          const spikeW = this.width / numSpikes;
          for (let i = 0; i < numSpikes; i++) {
            const sx = i * spikeW;
            const midX = sx + spikeW / 2;

            // Left sunlit polished chrome cone surface
            const leftGrad = ctx.createLinearGradient(sx, this.height - 4, midX, 3);
            leftGrad.addColorStop(0, '#CBD5E1');
            leftGrad.addColorStop(0.45, '#FFFFFF');
            leftGrad.addColorStop(1, '#F8FAFC');
            ctx.fillStyle = leftGrad;
            ctx.beginPath();
            ctx.moveTo(sx + 0.5, this.height - 3);
            ctx.lineTo(midX, 3);
            ctx.lineTo(midX + 1, this.height - 3);
            ctx.closePath();
            ctx.fill();

            // Right shaded titanium cone surface
            const rightGrad = ctx.createLinearGradient(midX, 3, sx + spikeW, this.height - 3);
            rightGrad.addColorStop(0, '#94A3B8');
            rightGrad.addColorStop(0.55, '#334155');
            rightGrad.addColorStop(1, '#0F172A');
            ctx.fillStyle = rightGrad;
            ctx.beginPath();
            ctx.moveTo(midX, 3);
            ctx.lineTo(sx + spikeW - 0.5, this.height - 3);
            ctx.lineTo(midX, this.height - 3);
            ctx.closePath();
            ctx.fill();

            // Specular razor ridge highlight down cone center-left
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(midX, 3.5);
            ctx.lineTo(midX - spikeW * 0.14, this.height - 4);
            ctx.stroke();
          }

          // 3D Brushed Steel Base Flange
          const baseG = ctx.createLinearGradient(0, this.height - 5, 0, this.height);
          baseG.addColorStop(0, '#94A3B8');
          baseG.addColorStop(0.4, '#475569');
          baseG.addColorStop(1, '#0F172A');
          ctx.fillStyle = baseG;
          ctx.beginPath();
          ctx.roundRect(0, this.height - 4.5, this.width, 4.5, 1.5);
          ctx.fill();
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

    // Ground enemy ledge-detection & gravity support (prevents ground enemies from walking over empty air!)
    if (this.variant !== 'winged' && Array.isArray(solids)) {
      const footY = this.y + this.height;
      const leadX = this.dir > 0 ? (this.x + this.width - 3) : (this.x + 3);
      let anyFootSupported = false;
      let leadFootSupported = false;

      for (const solid of solids) {
        if (!solid || !solid.active || solid === this) continue;
        // Check if solid top is right beneath enemy's feet
        if (Math.abs(solid.y - footY) <= 8) {
          if (this.x + this.width - 5 > solid.x && this.x + 5 < solid.x + solid.width) {
            anyFootSupported = true;
          }
          if (leadX >= solid.x && leadX <= solid.x + solid.width) {
            leadFootSupported = true;
          }
        }
      }

      if (anyFootSupported) {
        this.vy = 0;
        // If the leading foot is about to step off a ledge into empty air, turn around!
        if (!leadFootSupported) {
          this.dir *= -1;
          this.x += this.dir * 3;
        }
      } else {
        // Apply gravity if placed in mid-air until landing on a solid surface below
        this.vy = Math.min(600, (this.vy || 0) + 980 * dt);
        const nextY = this.y + this.vy * dt;
        let landed = false;
        for (const solid of solids) {
          if (!solid || !solid.active || solid === this) continue;
          if (
            this.x + this.width - 6 > solid.x &&
            this.x + 6 < solid.x + solid.width &&
            this.y + this.height <= solid.y + 6 &&
            nextY + this.height >= solid.y
          ) {
            this.y = solid.y - this.height;
            this.vy = 0;
            landed = true;
            break;
          }
        }
        if (!landed) {
          this.y = nextY;
        }
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

      if (this.variant === 'winged') {
        if (isUncanny) {
          // LIFELIKE 3D Sculpted Golden-Amber Owl Flyer Creature (Zero Cartoon Outlines!)
          const wingFlap = Math.sin(this.walkCycle * 2.5) * 8;

          // Layered 3D Feathered Wings (left & right) with soft drop shadows & volumetric feather shading
          [ [-1, 1], [1, -1] ].forEach(([side, rotSign]) => {
            const wx = side < 0 ? 3 : this.width - 3;
            const wy = 15 + wingFlap;

            // Wing cast shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
            ctx.beginPath();
            ctx.ellipse(wx + 0.5, wy + 2.0, 10.5, 6.2, rotSign * -0.38, 0, Math.PI * 2);
            ctx.fill();

            const wingG = ctx.createRadialGradient(wx - side * 2, wy - 3, 1, wx, wy, 12);
            wingG.addColorStop(0, '#FFFBEB');
            wingG.addColorStop(0.45, '#FDE68A');
            wingG.addColorStop(0.8, '#D97706');
            wingG.addColorStop(1, '#78350F');
            ctx.fillStyle = wingG;
            ctx.beginPath();
            ctx.ellipse(wx, wy, 10.5, 6.5, rotSign * -0.38, 0, Math.PI * 2);
            ctx.fill();

            // 3D Primary feather pinions
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(wx - side * 3, wy - 1);
            ctx.lineTo(wx + side * 7, wy + 1);
            ctx.moveTo(wx - side * 2, wy + 1.5);
            ctx.lineTo(wx + side * 6, wy + 3.5);
            ctx.stroke();
          });

          // 3D Sculpted Owl Ear Tufts on top corners
          [ [7, 9, 3, 1.5, 14, 7], [this.width - 7, 9, this.width - 3, 1.5, this.width - 14, 7] ].forEach(([x1, y1, x2, y2, x3, y3]) => {
            const tuftG = ctx.createLinearGradient(x2, y2, x1, y1);
            tuftG.addColorStop(0, '#FEF08A');
            tuftG.addColorStop(0.5, '#D97706');
            tuftG.addColorStop(1, '#78350F');
            ctx.fillStyle = tuftG;
            ctx.beginPath();
            ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
            ctx.fill();
          });

          // Per-Pixel Raytraced 3D Golden-Amber Owl Body
          const owlBody = Entity.getLifelikeBodyCanvas('owl3d', 80, 80, [238, 158, 24], false);
          ctx.drawImage(owlBody, 0, 0, this.width, this.height);

          // 3D Plumage breast scallops (highlighted + shaded)
          [ [14, 29], [20, 31], [26, 29] ].forEach(([fx, fy]) => {
            ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(fx, fy - 0.8, 2.6, 0.2, Math.PI - 0.2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(69, 26, 3, 0.55)';
            ctx.beginPath();
            ctx.arc(fx, fy, 2.6, 0.2, Math.PI - 0.2);
            ctx.stroke();
          });

          // Lifelike 3D owl eyes with round wire-frame spectacles
          Entity.drawLifelikeSpectacledEyes(ctx, 14, 26, 17.5, 4.9, '#D97706', '#1E293B');

          // 3D Glossy Hooked Owl Beak with specular ridge
          const beakG = ctx.createLinearGradient(17, 21, 23, 28);
          beakG.addColorStop(0, '#FED7AA');
          beakG.addColorStop(0.45, '#EA580C');
          beakG.addColorStop(1, '#431407');
          ctx.fillStyle = beakG;
          ctx.beginPath();
          ctx.moveTo(16.8, 22.0);
          ctx.quadraticCurveTo(20, 20.2, 23.2, 22.0);
          ctx.lineTo(20, 28.5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.ellipse(19.2, 23.2, 0.9, 1.8, -0.2, 0, Math.PI * 2);
          ctx.fill();
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
          // LIFELIKE 3D Spiker: Per-Pixel Raytraced Crimson Body + 3 Machined Chrome Steel Cones + Spectacled Eyes!
          const spBody = Entity.getLifelikeBodyCanvas('spiky3d', 80, 80, [215, 35, 42], false);
          ctx.drawImage(spBody, 0, 2, this.width, this.height - 2);

          // 3 Raytraced Machined Chrome Cones on Crown
          [11, 20, 29].forEach(sx => {
            const leftG = ctx.createLinearGradient(sx - 5.5, 11, sx, 0);
            leftG.addColorStop(0, '#CBD5E1');
            leftG.addColorStop(0.5, '#FFFFFF');
            leftG.addColorStop(1, '#F8FAFC');
            ctx.fillStyle = leftG;
            ctx.beginPath();
            ctx.moveTo(sx - 5.2, 11);
            ctx.lineTo(sx, 0);
            ctx.lineTo(sx + 0.5, 11);
            ctx.closePath();
            ctx.fill();

            const rightG = ctx.createLinearGradient(sx, 0, sx + 5.5, 11);
            rightG.addColorStop(0, '#94A3B8');
            rightG.addColorStop(0.6, '#334155');
            rightG.addColorStop(1, '#0F172A');
            ctx.fillStyle = rightG;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx + 5.2, 11);
            ctx.lineTo(sx, 11);
            ctx.closePath();
            ctx.fill();
          });

          Entity.drawLifelikeSpectacledEyes(ctx, 14, 26, 20.5, 4.8, '#EF4444', '#1E293B');
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
          // LIFELIKE 3D Walker Creature: Per-Pixel Raytraced Violet Rounded-Cube + Lifelike Spectacled Eyes!
          let wRgb = [139, 92, 246];
          if (this.color && this.color.startsWith('#') && this.color.length === 7) {
            wRgb = [
              parseInt(this.color.slice(1, 3), 16) || 139,
              parseInt(this.color.slice(3, 5), 16) || 92,
              parseInt(this.color.slice(5, 7), 16) || 246
            ];
          }
          const wBody = Entity.getLifelikeBodyCanvas('walker3d_' + (this.color || 'purple'), 80, 80, wRgb, false);
          ctx.drawImage(wBody, 0, 0, this.width, this.height);

          Entity.drawLifelikeSpectacledEyes(ctx, 14, 26, 18.0, 4.9, '#8B5CF6', '#1E293B');

          // 3D Anatomical scowl crease with lower lip highlight
          ctx.strokeStyle = 'rgba(30, 27, 75, 0.78)';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(14.5, 27.5);
          ctx.quadraticCurveTo(20, 24.5, 25.5, 27.5);
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
        const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        if (activeTheme === 'uncanny' || activeTheme === 'mixed') {
          // LIFELIKE 3D Brushed Titanium & Cyan-Neon Anti-Gravity Hover Platform
          const glowG = ctx.createRadialGradient(this.width / 2, this.height + 2, 4, this.width / 2, this.height + 2, 36);
          glowG.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
          glowG.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = glowG;
          ctx.fillRect(4, this.height - 4, this.width - 8, 14);

          const deckG = ctx.createLinearGradient(0, 0, 0, this.height);
          deckG.addColorStop(0, '#F8FAFC');
          deckG.addColorStop(0.25, '#94A3B8');
          deckG.addColorStop(0.75, '#334155');
          deckG.addColorStop(1, '#0F172A');
          ctx.fillStyle = deckG;
          ctx.beginPath();
          ctx.roundRect(0, 0, this.width, this.height, 6);
          ctx.fill();

          // Glowing cyan energy core strip along center
          const coreG = ctx.createLinearGradient(8, 0, this.width - 8, 0);
          coreG.addColorStop(0, '#0284C7');
          coreG.addColorStop(0.5, '#A5F3FC');
          coreG.addColorStop(1, '#0284C7');
          ctx.fillStyle = coreG;
          ctx.beginPath();
          ctx.roundRect(8, this.height / 2 - 2.5, this.width - 16, 5, 2.5);
          ctx.fill();
          return;
        }

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
      const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
      const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';
      const isAmmoRefill = this.variant === 'ammo' ||
        (this.variant === 'pistol' && typeof window !== 'undefined' && window.sidehop && window.sidehop.gunPickedUpInLevel);

      if (this.variant === 'heart') {
        // Heart Health Pickup (+1 Heart, +200 pts)
        const pulse = 1 + Math.sin(this.bobTimer * 1.5) * 0.08;
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(pulse, pulse);

        if (isUncanny) {
          // LIFELIKE 3D Ruby-Crystal / Subsurface-Scattered Glossy Heart with Volumetric Bloom!
          const hGlow = ctx.createRadialGradient(0, 2, 2, 0, 2, 18);
          hGlow.addColorStop(0, 'rgba(244, 63, 94, 0.55)');
          hGlow.addColorStop(1, 'rgba(244, 63, 94, 0)');
          ctx.fillStyle = hGlow;
          ctx.beginPath();
          ctx.arc(0, 2, 18, 0, Math.PI * 2);
          ctx.fill();

          const hGrad = ctx.createRadialGradient(-4, -4, 1.5, 0, 2, 15);
          hGrad.addColorStop(0, '#FFE4E6');
          hGrad.addColorStop(0.28, '#FB7185');
          hGrad.addColorStop(0.65, '#E11D48');
          hGrad.addColorStop(1, '#4C0519');
          ctx.fillStyle = hGrad;
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.bezierCurveTo(-4, -11, -12, -6, -12, 1);
          ctx.bezierCurveTo(-12, 7, -5, 10, 0, 14);
          ctx.bezierCurveTo(5, 10, 12, 7, 12, 1);
          ctx.bezierCurveTo(12, -6, 4, -11, 0, -3);
          ctx.closePath();
          ctx.fill();

          // Studio softbox specular reflection on left lobe
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.ellipse(-5, -3.5, 2.8, 1.6, -0.45, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

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
        if (isUncanny) {
          const orbG = ctx.createRadialGradient(this.width / 2 - 4, this.height / 2 - 4, 2, this.width / 2, this.height / 2, 16 * aura);
          orbG.addColorStop(0, 'rgba(220, 252, 231, 0.92)');
          orbG.addColorStop(0.65, 'rgba(74, 222, 128, 0.45)');
          orbG.addColorStop(1, 'rgba(22, 101, 52, 0.85)');
          ctx.fillStyle = orbG;
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, 15.5 * aura, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#C8E6C9';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, 15 * aura, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(this.width / 2 - 11, this.height / 2 - 9);

        // Olive drab metal ammo can
        const canG = ctx.createLinearGradient(0, 4, 22, 18);
        canG.addColorStop(0, '#4ADE80');
        canG.addColorStop(0.35, '#15803D');
        canG.addColorStop(1, '#052E16');
        ctx.fillStyle = isUncanny ? canG : '#2E7D32';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = isUncanny ? 1 : 2;
        ctx.beginPath();
        ctx.roundRect(0, 4, 22, 14, 2);
        ctx.fill();
        if (!isUncanny) ctx.stroke();

        // Top lid & latch
        ctx.fillStyle = '#14532D';
        ctx.beginPath();
        ctx.roundRect(-1, 2, 24, 3, 1);
        ctx.fill();
        if (!isUncanny) ctx.stroke();

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
          if (!isUncanny) ctx.stroke();
          // Copper projectile tip
          ctx.fillStyle = '#FF6D00';
          ctx.beginPath();
          ctx.moveTo(bx, 8);
          ctx.lineTo(bx + 2, 5);
          ctx.lineTo(bx + 4, 8);
          ctx.closePath();
          ctx.fill();
          if (!isUncanny) ctx.stroke();
        }

        ctx.restore();
      } else if (this.variant === 'pistol') {
        // Pistol Gun Powerup Bubble
        const aura = 1 + Math.sin(this.bobTimer * 2) * 0.08;
        if (isUncanny) {
          const orbG = ctx.createRadialGradient(this.width / 2 - 4, this.height / 2 - 4, 2, this.width / 2, this.height / 2, 16 * aura);
          orbG.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
          orbG.addColorStop(0.65, 'rgba(253, 224, 71, 0.45)');
          orbG.addColorStop(1, 'rgba(202, 138, 4, 0.85)');
          ctx.fillStyle = orbG;
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, 15.5 * aura, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#FFF9C4';
          ctx.strokeStyle = '#121212';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, 15 * aura, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Mini Pistol
        ctx.save();
        ctx.translate(this.width / 2 - 8, this.height / 2 - 2);
        // Slide / Barrel
        ctx.fillStyle = isUncanny ? '#334155' : '#222222';
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, -5, 16, 6, 2);
        ctx.fill();
        if (!isUncanny) ctx.stroke();
        // Grip / Handle
        ctx.fillStyle = isUncanny ? '#78350F' : '#222222';
        ctx.beginPath();
        ctx.roundRect(-2, 0, 6, 9, 2);
        ctx.fill();
        if (!isUncanny) ctx.stroke();
        // Neon orange slide accent
        ctx.fillStyle = '#FF6D00';
        ctx.fillRect(4, -4, 8, 2);
        ctx.restore();
      } else if (this.variant === 'star') {
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
        const activeTheme = (typeof window !== 'undefined' && (window.__SIDEHOP_THEME__ || window.sidehop?.currentTheme)) || 'grass';
        const isUncanny = activeTheme === 'uncanny' || activeTheme === 'mixed';
        const wave = Math.sin(this.waveTimer) * 4;

        if (isUncanny) {
          // LIFELIKE 3D Brushed Chrome Flagpole, Raytraced Gold Finial Sphere, Stepped Steel Base & Silk Waving Banner!
          // 3D Silk Waving Banner with ripple shading
          const flagG = ctx.createLinearGradient(10, 6, 44, 24);
          flagG.addColorStop(0, '#34D399');
          flagG.addColorStop(0.35, '#A7F3D0');
          flagG.addColorStop(0.65, '#10B981');
          flagG.addColorStop(1, '#065F46');
          ctx.fillStyle = flagG;
          ctx.beginPath();
          ctx.moveTo(9, 6);
          ctx.quadraticCurveTo(25, 1 + wave, 45, 14 + wave * 0.5);
          ctx.quadraticCurveTo(26, 22 + wave * 0.6, 9, 29);
          ctx.closePath();
          ctx.fill();

          // Cylindrical Chrome Flagpole (x = 6..10.5)
          const poleG = ctx.createLinearGradient(5.5, 0, 10.5, 0);
          poleG.addColorStop(0, '#334155');
          poleG.addColorStop(0.35, '#FFFFFF');
          poleG.addColorStop(0.7, '#94A3B8');
          poleG.addColorStop(1, '#0F172A');
          ctx.fillStyle = poleG;
          ctx.fillRect(6, 4, 4.5, this.height - 10);

          // 3D Raytraced Gold Finial Orb at top of pole
          const orbG = ctx.createRadialGradient(6.8, 2.5, 0.5, 8.2, 4, 4.8);
          orbG.addColorStop(0, '#FFFFFF');
          orbG.addColorStop(0.35, '#FDE047');
          orbG.addColorStop(0.75, '#D97706');
          orbG.addColorStop(1, '#451A03');
          ctx.fillStyle = orbG;
          ctx.beginPath();
          ctx.arc(8.2, 4, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // 3D Stepped Brushed Steel Pedestal Base
          const baseG = ctx.createLinearGradient(0, this.height - 9, 16, this.height);
          baseG.addColorStop(0, '#E2E8F0');
          baseG.addColorStop(0.45, '#64748B');
          baseG.addColorStop(1, '#0F172A');
          ctx.fillStyle = baseG;
          ctx.beginPath();
          ctx.roundRect(0, this.height - 8, 16, 8, 2);
          ctx.fill();
          return;
        }

        // Flagpole
        ctx.strokeStyle = '#121212';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8, this.height);
        ctx.stroke();

        // Waving Flag
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
