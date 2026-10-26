import { sounds } from '../audio/sound.js';
import { SidehopFile } from '../storage/sidehop-format.js';

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

    this.initCanvas();
    this.bindEvents();
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

    // If entity already has custom visual, draw it onto canvas
    if (entity && entity.customVisual) {
      const img = new Image();
      img.src = entity.customVisual;
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      };
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
      const dataUrl = this.canvas.toDataURL('image/png');
      this.targetEntity.setCustomVisual(dataUrl);
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
      this.onApplyCallback(this.targetEntity);
    }
    this.close();
  }
}
