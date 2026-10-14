// Sidehop Video Recorder & Highlight Replay Engine

import { sounds } from '../audio/sound.js';

export class VideoRecorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordStartTime = 0;
    this.recordTimerInterval = null;
    this.lastRecordedBlob = null;
    this.lastRecordedUrl = null;

    // UI Elements
    this.recBadge = document.getElementById('rec-badge');
    this.recTimerDisplay = document.getElementById('rec-timer');
    this.previewModal = document.getElementById('video-preview-modal');
    this.previewVideo = document.getElementById('preview-video-player');
    this.downloadBtn = document.getElementById('download-video-btn');
    this.closePreviewBtn = document.getElementById('close-video-preview');

    this.bindEvents();
  }

  bindEvents() {
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.downloadVideo());
    }
    if (this.closePreviewBtn) {
      this.closePreviewBtn.addEventListener('click', () => this.closePreview());
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
    return this.isRecording;
  }

  startRecording() {
    if (this.isRecording) return;
    try {
      const stream = this.canvas.captureStream(30); // 30 FPS canvas stream
      this.recordedChunks = [];

      const options = { mimeType: 'video/webm;codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.lastRecordedBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.lastRecordedUrl = URL.createObjectURL(this.lastRecordedBlob);
        this.openPreview(this.lastRecordedUrl);
      };

      this.mediaRecorder.start(100); // collect 100ms slices
      this.isRecording = true;
      this.recordStartTime = Date.now();

      if (this.recBadge) this.recBadge.classList.add('active');
      sounds.playClick();

      this.recordTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.recordStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        if (this.recTimerDisplay) {
          this.recTimerDisplay.textContent = `${mins}:${secs}`;
        }
      }, 1000);

    } catch (err) {
      console.warn('Canvas video recording not supported in this environment:', err);
      alert('Video recording is supported on Chrome, Firefox, Edge, and Safari 14.1+.');
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.stop();
    this.isRecording = false;

    if (this.recordTimerInterval) {
      clearInterval(this.recordTimerInterval);
      this.recordTimerInterval = null;
    }

    if (this.recBadge) this.recBadge.classList.remove('active');
    if (this.recTimerDisplay) this.recTimerDisplay.textContent = '00:00';
    sounds.playClick();
  }

  openPreview(videoUrl) {
    if (!this.previewModal || !this.previewVideo) return;
    this.previewVideo.src = videoUrl;
    this.previewVideo.play();
    this.previewModal.classList.add('active');
  }

  closePreview() {
    if (this.previewVideo) {
      this.previewVideo.pause();
      this.previewVideo.src = '';
    }
    if (this.previewModal) {
      this.previewModal.classList.remove('active');
    }
    sounds.playClick();
  }

  downloadVideo() {
    if (!this.lastRecordedUrl) return;
    const a = document.createElement('a');
    a.href = this.lastRecordedUrl;
    a.download = `sidehop-clip-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    sounds.playCollect();
  }
}
