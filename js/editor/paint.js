import { sounds } from '../audio/sound.js?v=20261028_205041';
import { SidehopFile } from '../storage/sidehop-format.js?v=20261028_205041';

export class ArtStudio {
  constructor(modalElement, canvasElement) {
    this.modal = modalElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.currentTool = 'brush'; // 'brush', 'marker', 'eraser', 'stamp', 'bucket'
    this.currentColor = '#00E5FF';
    this.brushSize = 8;
    this.currentStamp = 'star'; // 'star', 'smile', 'heart', 'doodle'
    this.targetEntity = null;
    this.onApplyCallback = null;
    this.componentColor = null;
    this.hasCustomDrawing = false;

    this.initCanvas();
    this.bindEvents();
    this.bindComponentColorEvents();
  }

  bindComponentColorEvents() {
    // Swatches for starter component color tinting
    const colorSection = this.modal?.querySelector('#art-component-color-section');
    if (!colorSection) return;

    colorSection.querySelectorAll('.art-comp-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.getAttribute('data-comp-color');
        this.setComponentColor(c);
      });
    });

    const picker = this.modal?.querySelector('#art-custom-comp-color');
    if (picker) {
      picker.addEventListener('input', (e) => {
        this.setComponentColor(e.target.value);
      });
    }

    const resetBtn = this.modal?.querySelector('#art-reset-color-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.setComponentColor(null);
      });
    }
  }

  setComponentColor(color) {
    this.componentColor = color;
    this.hasCustomDrawing = false;
    if (this.targetEntity) {
      this.targetEntity.setColor(color);
      this.clearCanvas();
      this.renderStarterComponentOnCanvas(this.targetEntity, color);
    }
    this.updateColorPickerUI();
    sounds.playPaintSquish();
  }

  updateColorPickerUI() {
    const colorSection = this.modal?.querySelector('#art-component-color-section');
    if (!colorSection) return;

    if (this.isBackgroundMode) {
      colorSection.style.display = 'none';
      return;
    }
    colorSection.style.display = 'flex';

    const pill = this.modal?.querySelector('#art-color-pill');
    if (pill) {
      if (this.componentColor) {
        pill.textContent = this.componentColor.toUpperCase();
        pill.style.background = this.componentColor;
        pill.style.color = '#FFFFFF';
        pill.style.textShadow = '1px 1px 2px #000';
      } else {
        pill.textContent = 'Default';
        pill.style.background = 'var(--bg-cream)';
        pill.style.color = 'var(--ink-black)';
        pill.style.textShadow = 'none';
      }
    }

    colorSection.querySelectorAll('.art-comp-color-btn').forEach(btn => {
      const c = btn.getAttribute('data-comp-color');
      btn.classList.toggle('active', c === this.componentColor);
    });

    const picker = this.modal?.querySelector('#art-custom-comp-color');
    if (picker && this.componentColor) {
      picker.value = this.componentColor;
    }
  }

  renderStarterComponentOnCanvas(entity, color) {
    if (!entity) return;
    this.ctx.save();
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const type = entity.type;
    const variant = entity.variant;

    if (variant === 'ice' || (type === 'crate' && variant === 'ice')) {
      // 1. Ice Block in Art Studio (Center: 160x160)
      const bx = 30, by = 30, bw = 160, bh = 160;
      const baseCol = color || '#B2EBF2';
      this.ctx.fillStyle = baseCol;
      this.ctx.fillRect(bx, by, bw, bh);

      // Top glossy sheen
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.beginPath();
      this.ctx.moveTo(bx + 12, by + 10);
      this.ctx.lineTo(bx + bw - 12, by + 10);
      this.ctx.lineTo(bx + bw - 30, by + 36);
      this.ctx.lineTo(bx + 30, by + 36);
      this.ctx.closePath();
      this.ctx.fill();

      // Crystalline ice chevron facets
      this.ctx.strokeStyle = color ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 184, 212, 0.75)';
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(bx + 26, by + bh - 26);
      this.ctx.lineTo(bx + bw / 2, by + bh / 2);
      this.ctx.lineTo(bx + bw - 26, by + bh - 48);
      this.ctx.stroke();

      // Outer border
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.strokeRect(bx, by, bw, bh);
    } else if (type === 'goal') {
      // 2. Goal Flag in Art Studio
      const flagCol = color || '#00E676';
      // Flagpole
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 8;
      this.ctx.beginPath();
      this.ctx.moveTo(56, 26);
      this.ctx.lineTo(56, 196);
      this.ctx.stroke();

      // Golden Finial Ball at top
      this.ctx.fillStyle = '#FFE600';
      this.ctx.beginPath();
      this.ctx.arc(56, 26, 9, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Waving Flag
      this.ctx.fillStyle = flagCol;
      this.ctx.beginPath();
      this.ctx.moveTo(60, 38);
      this.ctx.quadraticCurveTo(120, 26, 178, 62);
      this.ctx.lineTo(60, 108);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Flag Wave Highlight
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      this.ctx.beginPath();
      this.ctx.moveTo(60, 38);
      this.ctx.quadraticCurveTo(100, 32, 130, 50);
      this.ctx.lineTo(60, 68);
      this.ctx.closePath();
      this.ctx.fill();

      // Base
      this.ctx.fillStyle = '#121212';
      this.ctx.fillRect(36, 186, 40, 14);
    } else if (type === 'hazard') {
      // 3. Spikes
      const spikeCol = color || '#EF4444';
      this.ctx.fillStyle = spikeCol;
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(25, 180);
      this.ctx.lineTo(55, 45);
      this.ctx.lineTo(85, 180);
      this.ctx.lineTo(110, 45);
      this.ctx.lineTo(135, 180);
      this.ctx.lineTo(165, 45);
      this.ctx.lineTo(195, 180);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (type === 'springboard') {
      // 4. Springboard
      const capCol = color || (variant === 'mega' ? '#FFE600' : '#00E676');
      this.ctx.fillStyle = '#121212';
      this.ctx.fillRect(30, 180, 160, 20);

      this.ctx.strokeStyle = variant === 'mega' ? '#00E5FF' : '#FF3388';
      this.ctx.lineWidth = 8;
      this.ctx.beginPath();
      this.ctx.moveTo(45, 180);
      this.ctx.lineTo(175, 130);
      this.ctx.lineTo(45, 80);
      this.ctx.lineTo(175, 60);
      this.ctx.stroke();

      this.ctx.fillStyle = capCol;
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.roundRect(25, 42, 170, 26, 8);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (type === 'enemy') {
      // 5. Enemy Walker (Grumpy Potato)
      const bodyCol = color || '#B388FF';
      this.ctx.fillStyle = bodyCol;
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.roundRect(40, 40, 140, 140, 36);
      this.ctx.fill();
      this.ctx.stroke();

      // Eyes
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(80, 95, 20, 0, Math.PI * 2);
      this.ctx.arc(140, 95, 20, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#121212';
      this.ctx.beginPath();
      this.ctx.arc(88, 95, 9, 0, Math.PI * 2);
      this.ctx.arc(148, 95, 9, 0, Math.PI * 2);
      this.ctx.fill();

      // Grumpy Eyebrows
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(60, 68); this.ctx.lineTo(95, 80);
      this.ctx.moveTo(160, 68); this.ctx.lineTo(125, 80);
      this.ctx.stroke();
    } else if (type === 'player') {
      // 6. Player Mascot
      const mascotCol = color || '#00E5FF';
      this.ctx.fillStyle = mascotCol;
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.roundRect(45, 45, 130, 130, 32);
      this.ctx.fill();
      this.ctx.stroke();

      // Eyes
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(85, 95, 22, 0, Math.PI * 2);
      this.ctx.arc(135, 95, 22, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#121212';
      this.ctx.beginPath();
      this.ctx.arc(92, 95, 9, 0, Math.PI * 2);
      this.ctx.arc(142, 95, 9, 0, Math.PI * 2);
      this.ctx.fill();

      // Smile
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.arc(110, 130, 24, 0.2, Math.PI - 0.2);
      this.ctx.stroke();
    } else if (type === 'moving_platform') {
      // 7. Moving Platform
      const platCol = color || '#00E5FF';
      this.ctx.fillStyle = platCol;
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.roundRect(20, 85, 180, 50, 12);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#121212';
      for (let gx = 45; gx < 175; gx += 26) {
        this.ctx.fillRect(gx, 95, 10, 30);
      }
    } else if (type === 'collectible') {
      // 8. Collectible (Coin / Star)
      const tokenCol = color || '#FFE600';
      this.ctx.fillStyle = tokenCol;
      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.arc(110, 110, 68, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(110, 110, 48, 0, Math.PI * 2);
      this.ctx.stroke();
    } else {
      // Standard Ground / Solid Block
      const blockCol = color || '#866043';
      this.ctx.fillStyle = blockCol;
      this.ctx.fillRect(30, 30, 160, 160);

      // Turf cap on top
      this.ctx.fillStyle = '#558B2F';
      this.ctx.fillRect(30, 30, 160, 35);
      this.ctx.fillStyle = '#7CB342';
      this.ctx.fillRect(30, 30, 160, 12);

      this.ctx.strokeStyle = '#121212';
      this.ctx.lineWidth = 5;
      this.ctx.strokeRect(30, 30, 160, 160);
    }

    this.ctx.restore();
  }

  initCanvas() {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.clearCanvas();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  openForEntity(entity, onApply) {
    this.targetEntity = entity;
    this.targetBackground = null;
    this.isBackgroundMode = false;
    this.onApplyCallback = onApply;
    this.componentColor = entity ? (entity.color || null) : null;
    this.hasCustomDrawing = !!(entity && entity.customVisual);
    this.clearCanvas();

    const titleEl = this.modal?.querySelector('.modal-title');
    if (titleEl) {
      if (entity && (entity.type === 'player' || entity === window.sidehop?.player)) {
        titleEl.textContent = '🐰 Art Studio — Edit Character';
      } else if (entity && entity.type) {
        titleEl.textContent = `🎨 Art Studio — Edit ${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}`;
      } else {
        titleEl.textContent = '🎨 Art Studio';
      }
    }

    this.updateColorPickerUI();

    // If entity already has custom visual, draw it onto canvas
    if (entity && entity.customVisual) {
      const img = new Image();
      img.src = entity.customVisual;
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      };
    } else if (entity) {
      this.renderStarterComponentOnCanvas(entity, this.componentColor);
    }

    this.modal.classList.add('active');
    sounds.playClick();
  }

  openForBackground(background, onApply) {
    this.targetEntity = null;
    this.targetBackground = background;
    this.isBackgroundMode = true;
    this.onApplyCallback = onApply;
    this.clearCanvas();

    const titleEl = this.modal?.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = '🌄 Art Studio — Draw Background';
    }

    if (background && background.customImage) {
      const img = new Image();
      img.src = background.customImage;
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      };
    }

    this.modal.classList.add('active');
    sounds.playClick();
  }

  close() {
    this.modal.classList.remove('active');
    sounds.playClick();
  }

  bindEvents() {
    // Mouse events on paint canvas
    this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    window.addEventListener('mouseup', () => this.stopDraw());

    // Touch events for mobile/tablet
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.startDraw(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.draw(touch);
    }, { passive: false });

    window.addEventListener('touchend', () => this.stopDraw());
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  startDraw(e) {
    this.isDrawing = true;
    this.hasCustomDrawing = true;
    const pos = this.getCanvasPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;

    if (this.currentTool === 'stamp') {
      this.drawStamp(pos.x, pos.y);
      sounds.playPaintSquish();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
      this.draw(e);
      sounds.playPaintSquish();
    }
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getCanvasPos(e);

    if (this.currentTool === 'stamp') return;

    this.ctx.save();
    if (this.currentTool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = this.brushSize * 2;
    } else if (this.currentTool === 'marker') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushSize * 2.2;
      this.ctx.globalAlpha = 0.65;
    } else {
      // standard brush
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushSize;
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
    this.ctx.restore();

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDraw() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.ctx.beginPath();
  }

  drawStamp(x, y) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = this.currentColor;
    this.ctx.strokeStyle = '#121212';
    this.ctx.lineWidth = 2;

    if (this.currentStamp === 'star') {
      this.ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        this.ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 16, -Math.sin((18 + i * 72) * Math.PI / 180) * 16);
        this.ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 8, -Math.sin((54 + i * 72) * Math.PI / 180) * 8);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (this.currentStamp === 'heart') {
      this.ctx.beginPath();
      this.ctx.moveTo(0, 4);
      this.ctx.bezierCurveTo(-14, -12, -14, 10, 0, 16);
      this.ctx.bezierCurveTo(14, 10, 14, -12, 0, 4);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else if (this.currentStamp === 'smile') {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = '#121212';
      this.ctx.fillRect(-6, -5, 3, 3);
      this.ctx.fillRect(3, -5, 3, 3);
      this.ctx.beginPath();
      this.ctx.arc(0, 2, 7, 0, Math.PI);
      this.ctx.stroke();
    } else if (this.currentStamp === 'doodle') {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.fillRect(-4, -4, 8, 8);
    }
    this.ctx.restore();
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  setBrushSize(size) {
    this.brushSize = parseInt(size, 10) || 8;
  }

  setStamp(stamp) {
    this.currentStamp = stamp;
  }

  // Load custom image/GIF onto canvas preserving aspect ratio & block geometry
  loadImageFromUrl(dataUrl, callback) {
    if (!dataUrl) return;
    this.hasCustomDrawing = true;
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      this.clearCanvas();
      const isBlock = this.targetEntity && (this.targetEntity.type === 'crate' || this.targetEntity.type === 'block');
      const scale = isBlock
        ? Math.max(this.canvas.width / img.width, this.canvas.height / img.height)
        : Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (this.canvas.width - drawW) / 2;
      const offsetY = (this.canvas.height - drawH) / 2;

      if (isBlock) {
        this.ctx.fillStyle = '#FFE600';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      if (isBlock) {
        this.ctx.strokeStyle = '#121212';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
      }
      sounds.playPaintSquish();
      if (callback) callback();
    };
  }

  getSuggestedCategory() {
    if (this.isBackgroundMode) return 'background';
    if (!this.targetEntity) return 'sprite';
    const type = this.targetEntity.type;
    if (type === 'player') return 'player';
    if (type === 'block' || type === 'crate') return 'block';
    if (type === 'enemy') return 'enemy';
    if (type === 'collectible') return 'collectible';
    if (type === 'springboard') return 'spring';
    if (type === 'hazard') return 'hazard';
    return 'sprite';
  }

  // Export current artwork as a .sidehop asset package
  exportAsset(assetName) {
    const dataUrl = this.canvas.toDataURL('image/png');
    const category = this.getSuggestedCategory();
    const name = assetName || (this.targetEntity ? `${this.targetEntity.type} Art` : 'Custom Asset');

    const pkg = SidehopFile.createAssetPackage({
      name: name,
      category: category,
      targetType: this.targetEntity?.type || 'all',
      dataUrl: dataUrl,
      width: this.canvas.width,
      height: this.canvas.height
    }, {
      title: name,
      description: `Custom asset created in Art Studio`
    });

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'personal-asset';

    SidehopFile.download(`${slug}.sidehop`, pkg);
    sounds.playCollect();
    return pkg;
  }

  // Import a .sidehop or image file onto the painting canvas
  importAssetFile(file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = SidehopFile.parse(e.target.result);
        if (parsed.kind === 'asset' && parsed.asset?.dataUrl) {
          this.loadImageFromUrl(parsed.asset.dataUrl, () => {
            if (callback) callback(parsed.asset);
          });
          return;
        } else if (parsed.kind === 'bundle' && parsed.assets?.length > 0) {
          const first = parsed.assets[0];
          if (first && first.dataUrl) {
            this.loadImageFromUrl(first.dataUrl, () => {
              if (callback) callback(first);
            });
            return;
          }
        }
      } catch (_) {
        // Fallback to standard image dataURL upload
        this.handleFileUpload(file);
        if (callback) callback(null);
      }
    };

    if (file.name.endsWith('.sidehop') || file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      this.handleFileUpload(file);
      if (callback) callback(null);
    }
  }

  // Handle Image/GIF File Upload
  handleFileUpload(file) {
    if (!file) return;
    this.hasCustomDrawing = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        console.warn('Failed to load image file');
      };
      img.onload = () => {
        this.clearCanvas();
        // For square blocks, ensure the square shape is filled and preserved without distortion
        const isBlock = this.targetEntity && (this.targetEntity.type === 'crate' || this.targetEntity.type === 'block');
        const scale = isBlock
          ? Math.max(this.canvas.width / img.width, this.canvas.height / img.height)
          : Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (this.canvas.width - drawW) / 2;
        const offsetY = (this.canvas.height - drawH) / 2;

        if (isBlock) {
          this.ctx.fillStyle = '#FFE600';
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        if (isBlock) {
          this.ctx.strokeStyle = '#121212';
          this.ctx.lineWidth = 4;
          this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
        }
        sounds.playPaintSquish();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  apply() {
    if (this.isBackgroundMode && this.onApplyCallback) {
      const dataUrl = this.canvas.toDataURL('image/png');
      this.onApplyCallback(dataUrl);
      this.close();
      return;
    }
    if (this.targetEntity && this.onApplyCallback) {
      if (this.hasCustomDrawing) {
        const dataUrl = this.canvas.toDataURL('image/png');
        this.targetEntity.setCustomVisual(dataUrl);
      } else {
        // Pure starter component recoloring - keep clean vector rendering with color tint!
        this.targetEntity.setCustomVisual(null);
        this.targetEntity.setColor(this.componentColor);
      }
      this.onApplyCallback(this.targetEntity);
    }
    this.close();
  }

  resetDefault() {
    if (this.isBackgroundMode && this.onApplyCallback) {
      this.onApplyCallback(null);
      this.close();
      return;
    }
    if (this.targetEntity && this.onApplyCallback) {
      this.targetEntity.setCustomVisual(null);
      this.targetEntity.setColor(null);
      this.onApplyCallback(this.targetEntity);
    }
    this.close();
  }
}
