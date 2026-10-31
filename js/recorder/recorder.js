// Sidehop Video Recorder & Highlight Replay Engine

import { sounds } from '../audio/sound.js?v=20261031_134910';

export class VideoRecorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.mediaRecorder = null;
    this.videoTrack = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.isAutoReplay = false;
    this.recordStartTime = 0;
    this.recordTimerInterval = null;
    this.victoryStopTimeout = null;
    this._discardOnStop = false;
    this._openModalOnStop = false;
    this._lastFramePush = 0;
    this._audioKeepAliveOsc = null;
    this._audioKeepAliveGain = null;
    this._audioDest = null;
    this.lastRecordedBlob = null;
    this.lastRecordedUrl = null;
    this.selectedMime = 'video/mp4';

    // UI Elements
    this.recBadge = document.getElementById('rec-badge');
    this.recTimerDisplay = document.getElementById('rec-timer');
    this.previewModal = document.getElementById('video-preview-modal');
    this.previewVideo = document.getElementById('preview-video-player');
    this.downloadBtn = document.getElementById('download-video-btn');
    this.closePreviewBtn = document.getElementById('close-video-preview');
    this.victoryReplayContainer = document.getElementById('victory-replay-container');
    this.victoryReplayVideo = document.getElementById('victory-replay-video');

    this.bindEvents();
  }

  bindEvents() {
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.downloadVideo());
    }
    if (this.closePreviewBtn) {
      this.closePreviewBtn.addEventListener('click', () => this.closePreview());
    }
    if (this.victoryReplayContainer) {
      this.victoryReplayContainer.style.cursor = 'pointer';
      this.victoryReplayContainer.title = 'Click to open full replay player & download';
      this.victoryReplayContainer.addEventListener('click', () => {
        if (this.lastRecordedUrl) {
          this.openPreview(this.lastRecordedUrl);
        }
      });
    }
  }

  toggleRecording() {
    if (this.isRecording && !this.isAutoReplay) {
      this.stopRecording({ openModal: true });
    } else if (this.isRecording && this.isAutoReplay) {
      // Promote active background replay recording to manual recording with UI badge
      this.isAutoReplay = false;
      this._openModalOnStop = true;
      if (this.recBadge) this.recBadge.classList.add('active');
      sounds.playClick();
      this._startTimerDisplay();
    } else {
      this.startRecording({ autoReplay: false });
    }
    return this.isRecording && !this.isAutoReplay;
  }

  _startTimerDisplay() {
    if (this.recordTimerInterval) {
      clearInterval(this.recordTimerInterval);
    }
    const updateClock = () => {
      const elapsed = Math.floor((Date.now() - this.recordStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      if (this.recTimerDisplay) {
        this.recTimerDisplay.textContent = `${mins}:${secs}`;
      }
    };
    updateClock();
    this.recordTimerInterval = setInterval(updateClock, 1000);
  }

  _cleanupAudioStream() {
    try {
      if (this._audioKeepAliveOsc) {
        this._audioKeepAliveOsc.stop();
        this._audioKeepAliveOsc.disconnect();
      }
    } catch (e) {}
    try {
      if (this._audioKeepAliveGain) {
        this._audioKeepAliveGain.disconnect();
      }
    } catch (e) {}
    try {
      if (this._audioDest && sounds && sounds.masterGain) {
        sounds.masterGain.disconnect(this._audioDest);
      }
    } catch (e) {}
    this._audioKeepAliveOsc = null;
    this._audioKeepAliveGain = null;
    this._audioDest = null;
  }

  startRecording({ autoReplay = false } = {}) {
    if (this.victoryStopTimeout) {
      clearTimeout(this.victoryStopTimeout);
      this.victoryStopTimeout = null;
    }

    if (this.isRecording) {
      if (!autoReplay && this.isAutoReplay) {
        // Promote background replay to manual recording
        this.isAutoReplay = false;
        this._openModalOnStop = true;
        if (this.recBadge) this.recBadge.classList.add('active');
        sounds.playClick();
        this._startTimerDisplay();
      }
      return;
    }

    try {
      const stream = this.canvas.captureStream(30); // 30 FPS canvas stream
      this.videoTrack = (stream.getVideoTracks && stream.getVideoTracks()[0]) || null;

      // Mix game audio into recording stream with continuous keep-alive clock
      try {
        if (sounds && sounds.ensureContext && sounds.ensureContext() && sounds.ctx.state === 'running' && sounds.masterGain) {
          const dest = sounds.ctx.createMediaStreamDestination();
          sounds.masterGain.connect(dest);

          // Silent keep-alive oscillator prevents MP4/WebM muxer from stalling during silent gaps
          const osc = sounds.ctx.createOscillator();
          const quietGain = sounds.ctx.createGain();
          quietGain.gain.value = 0.00001;
          osc.connect(quietGain);
          quietGain.connect(dest);
          osc.start();

          this._audioKeepAliveOsc = osc;
          this._audioKeepAliveGain = quietGain;
          this._audioDest = dest;

          dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        }
      } catch (audioErr) {
        // Fallback to video-only if audio capture fails
      }

      this.recordedChunks = [];
      this._discardOnStop = false;
      this._openModalOnStop = !autoReplay;
      this.isAutoReplay = !!autoReplay;

      // Prioritize MP4 formats, falling back to WebM
      const mimeCandidates = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      this.selectedMime = mimeCandidates.find(type => MediaRecorder.isTypeSupported(type)) || 'video/mp4';

      const options = {
        mimeType: this.selectedMime,
        videoBitsPerSecond: 4500000
      };
      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this._cleanupAudioStream();
        this.videoTrack = null;

        if (this._discardOnStop || this.recordedChunks.length === 0) {
          this._discardOnStop = false;
          return;
        }

        this.lastRecordedBlob = new Blob(this.recordedChunks, { type: this.selectedMime });
        if (this.lastRecordedUrl) {
          try { URL.revokeObjectURL(this.lastRecordedUrl); } catch (e) {}
        }
        this.lastRecordedUrl = URL.createObjectURL(this.lastRecordedBlob);

        // Update inline replay preview on the Victory screen if present
        this.updateVictoryInlineReplay(this.lastRecordedUrl);

        if (this._openModalOnStop) {
          this._openModalOnStop = false;
          this.openPreview(this.lastRecordedUrl);
        }
      };

      this.mediaRecorder.start(200); // collect 200ms slices
      this.isRecording = true;
      this.recordStartTime = Date.now();

      if (!autoReplay) {
        if (this.recBadge) this.recBadge.classList.add('active');
        sounds.playClick();
        this._startTimerDisplay();
      }
    } catch (err) {
      console.warn('Canvas video recording not supported in this environment:', err);
      if (!autoReplay) {
        alert('Video recording is supported on Chrome, Firefox, Edge, and Safari 14.1+.');
      }
    }
  }

  /**
   * Automatically starts or restarts background level replay recording for a Play attempt.
   */
  startAutoReplay() {
    if (this.victoryStopTimeout) {
      clearTimeout(this.victoryStopTimeout);
      this.victoryStopTimeout = null;
    }
    this.hideVictoryInlineReplay();

    // Do not interrupt an explicit user manual recording
    if (this.isRecording && !this.isAutoReplay) return;

    if (this.isRecording && this.isAutoReplay) {
      this._discardOnStop = true;
      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.onstop = () => {
            this._cleanupAudioStream();
            this.videoTrack = null;
            this.startRecording({ autoReplay: true });
          };
          this.mediaRecorder.stop();
          this.isRecording = false;
          return;
        }
      } catch (e) {}
      this.isRecording = false;
    }

    this.startRecording({ autoReplay: true });
  }

  /**
   * Cancels background auto-replay when returning to Edit Mode without completing the level.
   */
  cancelAutoReplay() {
    if (this.victoryStopTimeout) {
      clearTimeout(this.victoryStopTimeout);
      this.victoryStopTimeout = null;
    }
    this.hideVictoryInlineReplay();

    if (this.isRecording && this.isAutoReplay) {
      this._discardOnStop = true;
      this._openModalOnStop = false;
      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
      this.isRecording = false;
      this.isAutoReplay = false;
      this._cleanupAudioStream();
    }
  }

  /**
   * Called when the player reaches the Goal Flag.
   * Captures ~1.1s of victory confetti celebration and then finalizes the full level replay clip.
   */
  finalizeReplayOnVictory() {
    if (this.victoryStopTimeout) {
      clearTimeout(this.victoryStopTimeout);
      this.victoryStopTimeout = null;
    }

    if (!this.isRecording) {
      if (this.lastRecordedUrl) {
        this.updateVictoryInlineReplay(this.lastRecordedUrl);
      }
      return;
    }

    this.victoryStopTimeout = setTimeout(() => {
      this.victoryStopTimeout = null;
      if (this.isRecording) {
        this.stopRecording({ openModal: this._openModalOnStop });
      }
    }, 1100);
  }

  /**
   * Called when clicking "Save Replay Clip" on the Victory Overlay.
   * Opens the full level replay immediately (or as soon as the victory celebration finishes).
   */
  openReplayOrRecord() {
    if (this.victoryStopTimeout) {
      clearTimeout(this.victoryStopTimeout);
      this.victoryStopTimeout = null;
    }

    if (this.isRecording) {
      this._openModalOnStop = true;
      this.stopRecording({ openModal: true });
      return;
    }

    if (this.lastRecordedUrl) {
      sounds.playClick();
      this.openPreview(this.lastRecordedUrl);
    }
  }

  /**
   * Pushes rendered canvas frames to the MediaStream track during active recording.
   */
  captureFrame() {
    if (!this.isRecording || !this.videoTrack) return;
    if (typeof this.videoTrack.requestFrame === 'function') {
      const now = performance.now();
      if (now - this._lastFramePush >= 30) {
        this._lastFramePush = now;
        try {
          this.videoTrack.requestFrame();
        } catch (e) {}
      }
    }
  }

  stopRecording({ openModal = true } = {}) {
    if (this.victoryStopTimeout) {
      clearTimeout(this.victoryStopTimeout);
      this.victoryStopTimeout = null;
    }

    if (!this.isRecording || !this.mediaRecorder) return;
    this._openModalOnStop = !!openModal;
    const wasManual = !this.isAutoReplay;

    try {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch (e) {}

    this.isRecording = false;
    this.isAutoReplay = false;

    if (this.recordTimerInterval) {
      clearInterval(this.recordTimerInterval);
      this.recordTimerInterval = null;
    }

    if (this.recBadge) this.recBadge.classList.remove('active');
    if (this.recTimerDisplay) this.recTimerDisplay.textContent = '00:00';
    if (wasManual || openModal) {
      sounds.playClick();
    }
  }

  updateVictoryInlineReplay(videoUrl) {
    if (!this.victoryReplayContainer || !this.victoryReplayVideo || !videoUrl) return;
    this.victoryReplayVideo.src = videoUrl;
    this.victoryReplayVideo.muted = true;
    this.victoryReplayContainer.style.display = 'block';
    this.victoryReplayVideo.play().catch(() => {});
  }

  hideVictoryInlineReplay() {
    if (this.victoryReplayVideo) {
      this.victoryReplayVideo.pause();
      this.victoryReplayVideo.removeAttribute('src');
    }
    if (this.victoryReplayContainer) {
      this.victoryReplayContainer.style.display = 'none';
    }
  }

  openPreview(videoUrl) {
    if (!this.previewModal || !this.previewVideo) return;
    this.previewVideo.src = videoUrl;
    this.previewVideo.currentTime = 0;
    this.previewVideo.play().catch(() => {});
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
    const ext = (this.selectedMime && this.selectedMime.includes('webm')) ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = this.lastRecordedUrl;
    a.download = `sidehop-clip-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    sounds.playCollect();
  }
}
