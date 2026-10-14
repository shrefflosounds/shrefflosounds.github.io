// Sidehop Kid-Pix-Style Art Studio & Custom Visuals Importer

import { sounds } from '../audio/sound.js';
import { AssetLibrary } from '../storage/asset_library.js';

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
    this.onApplyCallback = onApply;
    this.clearCanvas();

    // If entity already has custom visual, draw it onto canvas
    if (entity.customVisual) {
      const img = new Image();
      img.src = entity.customVisual;
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
      this.ctx.fill();
      this.ctx.stroke();
    } else if (this.currentStamp === 'smile') {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#121212';
      this.ctx.beginPath();
      this.ctx.arc(-5, -3, 2, 0, Math.PI * 2);
      this.ctx.arc(5, -3, 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(0, 2, 6, 0.2, Math.PI - 0.2);
      this.ctx.stroke();
    }

    ctx.restore();
  }

  // Handle Image/GIF File Upload
  handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        this.clearCanvas();
        // Scale and center image onto canvas preserving aspect ratio
        const scale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (this.canvas.width - drawW) / 2;
        const offsetY = (this.canvas.height - drawH) / 2;
        this.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        sounds.playPaintSquish();
      };
    };
    reader.readAsDataURL(file);
  }

  apply() {
    if (this.targetEntity && this.onApplyCallback) {
      const dataUrl = this.canvas.toDataURL('image/png');
      this.targetEntity.setCustomVisual(dataUrl);
      this.onApplyCallback(this.targetEntity);
    }
    this.close();
  }

  saveToLibrary(customName) {
    const dataUrl = this.canvas.toDataURL('image/png');
    const defaultName = (this.targetEntity && this.targetEntity.type)
      ? `${this.targetEntity.type.toUpperCase()} Custom`
      : 'My Drawing';
    const name = customName || defaultName;
    const asset = AssetLibrary.saveAsset(name, dataUrl);
    sounds.playCollect();
    return asset;
  }

  resetDefault() {
    if (this.targetEntity && this.onApplyCallback) {
      this.targetEntity.setCustomVisual(null);
      this.onApplyCallback(this.targetEntity);
    }
    this.close();
  }
}
