// ============================================================================
// THE SILENT MUSEUM: AUDIO ENGINE & NASA QUINDAR TELEMETRY + TTS NARRATOR
// Uses Web Audio API (procedural space drone & Apollo Quindar tones)
// and Web Speech API (bilingual PT-BR / EN-US first-person narration)
// ============================================================================

export class MuseumAudioEngine {
  constructor() {
    this.ctx = null;
    this.ambientRunning = false;
    this.ambientGain = null;
    this.ambientNodes = [];
    this.isSpeaking = false;
    this.isPaused = false;
    this.speechRate = 1.0;
    this.currentParagraphIndex = -1;
    this.currentAudioEl = null;
    this.onParagraphChange = null;
    this.onSpeechEnd = null;
    this.onProgress = null;
    this._playbackToken = 0;
    this._progressTimer = null;
    this._paragraphs = [];
    this._paragraphDurations = [];
    this._paragraphStartOffset = 0;
    this._paragraphStartedAt = 0;
    this._pausedElapsedInPara = 0;
    this._audioOffsetSynced = true;
    this._speechLang = "pt";
    this._speechAge = "adult";
    this._speechArtifactId = null;
  }

  estimateParagraphDuration(text, rate = this.speechRate) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    const baseSec = Math.max(4, words / 2.35);
    return baseSec / Math.max(0.5, rate || 1.0);
  }

  estimateTotalDuration(paragraphs, rate = this.speechRate) {
    if (!Array.isArray(paragraphs) || !paragraphs.length) return 0;
    return paragraphs.reduce((sum, p) => sum + this.estimateParagraphDuration(p, rate), 0);
  }

  setSpeechRate(rate) {
    this.speechRate = rate;
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.playbackRate = rate;
      } catch (_) {}
    }
    this.emitProgress();
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Authentic NASA Apollo Quindar Tone (2525 Hz intro / 2475 Hz outro, 250ms)
  playQuindarTone(isIntro = true) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isIntro ? 2525 : 2475, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.015);
      gain.gain.setValueAtTime(0.07, now + 0.21);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch (_) {
      // Ignore if audio context blocked
    }
  }

  // Subtle UI click / telemetry ping
  playPing(freq = 880, duration = 0.09) {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + duration);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch (_) {}
  }

  // Laser pulse sound for LRRR simulator
  playLaserPulse() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  // Seismic rumble for PSE simulator
  playSeismicRumble(intensity = 1.0) {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(58 * intensity, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.8);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(140, now);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch (_) {}
  }

  // Toggle deep-space ambient museum pad
  toggleAmbient() {
    this.initContext();
    if (!this.ctx) return false;

    if (this.ambientRunning) {
      this.stopAmbient();
      return false;
    } else {
      this.startAmbient();
      return true;
    }
  }

  startAmbient() {
    if (!this.ctx || this.ambientRunning) return;
    const now = this.ctx.currentTime;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.001, now);
    this.ambientGain.gain.linearRampToValueAtTime(0.045, now + 2.0);
    this.ambientGain.connect(this.ctx.destination);

    // Cosmic fifths chord (A1, E2, B2, C#3) through a warm lowpass filter
    const freqs = [55.0, 82.41, 123.47, 138.59];
    this.ambientNodes = freqs.map((f, idx) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(f, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260 + idx * 60, now);

      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.08 + idx * 0.03, now);
      lfoGain.gain.setValueAtTime(45, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc.connect(filter);
      filter.connect(this.ambientGain);

      osc.start(now);
      lfo.start(now);
      return { osc, lfo };
    });

    this.ambientRunning = true;
  }

  stopAmbient() {
    if (!this.ctx || !this.ambientRunning) return;
    const now = this.ctx.currentTime;
    if (this.ambientGain) {
      this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    }
    setTimeout(() => {
      this.ambientNodes.forEach((n) => {
        try {
          n.osc.stop();
          n.lfo.stop();
        } catch (_) {}
      });
      this.ambientNodes = [];
    }, 650);
    this.ambientRunning = false;
  }

  // ==========================================================================
  // PRE-GENERATED NEURAL MP3 + WEB SPEECH API FALLBACK NARRATOR
  // ==========================================================================
  _clearProgressTimer() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  getPlaybackTimes() {
    const durations = this._paragraphDurations || [];
    const totalDuration = durations.reduce((acc, d) => acc + d, 0);
    if (!this.isSpeaking || this.currentParagraphIndex < 0) {
      return {
        currentTime: 0,
        totalDuration,
        progress: 0,
        paragraphProgress: 0,
        isSpeaking: false,
        isPaused: false,
        paragraphIndex: -1
      };
    }

    let elapsedBefore = 0;
    for (let i = 0; i < this.currentParagraphIndex && i < durations.length; i++) {
      elapsedBefore += durations[i];
    }

    let inPara = 0;
    const paraDur =
      this.currentAudioEl && Number.isFinite(this.currentAudioEl.duration) && this.currentAudioEl.duration > 0
        ? this.currentAudioEl.duration
        : durations[this.currentParagraphIndex] || 0;
    if (this.currentAudioEl) {
      inPara = this._audioOffsetSynced
        ? Math.min(paraDur || Infinity, this.currentAudioEl.currentTime || 0)
        : this._paragraphStartOffset;
    } else if (this.isPaused) {
      inPara = this._pausedElapsedInPara;
    } else if (this._paragraphStartedAt) {
      inPara =
        this._paragraphStartOffset +
        ((performance.now() - this._paragraphStartedAt) / 1000) * Math.max(0.5, this.speechRate);
    }
    inPara = Math.max(0, Math.min(paraDur || inPara, inPara));

    const currentTime = Math.min(totalDuration, elapsedBefore + inPara);
    const progress = totalDuration > 0 ? Math.max(0, Math.min(1, currentTime / totalDuration)) : 0;
    const paragraphProgress = paraDur > 0 ? Math.max(0, Math.min(1, inPara / paraDur)) : 0;

    return {
      currentTime,
      totalDuration,
      progress,
      paragraphProgress,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      paragraphIndex: this.currentParagraphIndex
    };
  }

  emitProgress() {
    if (this.onProgress) {
      this.onProgress(this.getPlaybackTimes());
    }
  }

  _startParagraphPlayback(startIndex = 0, offsetInParagraph = 0) {
    const token = ++this._playbackToken;
    const paragraphs = this._paragraphs;
    const lang = this._speechLang;
    const ageProfile = this._speechAge;
    const artifactId = this._speechArtifactId;

    const voices = "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
    const targetLangPrefix = lang === "pt" ? "pt" : "en";
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(targetLangPrefix) &&
          (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Luciana") || v.name.includes("Daniel"))
      ) || voices.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix));

    let index = Math.max(0, startIndex);

    const finishNarration = () => {
      if (token !== this._playbackToken) return;
      this._clearProgressTimer();
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentParagraphIndex = -1;
      this.currentAudioEl = null;
      this.playQuindarTone(false);
      if (this.onParagraphChange) this.onParagraphChange(-1);
      this.emitProgress();
      if (this.onSpeechEnd) this.onSpeechEnd();
    };

    const speakWithWebSpeech = (pIdx) => {
      if (token !== this._playbackToken) return;
      if (!("speechSynthesis" in window)) {
        finishNarration();
        return;
      }
      this._paragraphStartOffset = 0;
      this._pausedElapsedInPara = 0;
      this._paragraphStartedAt = performance.now();

      const utterance = new SpeechSynthesisUtterance(paragraphs[pIdx]);
      utterance.lang = lang === "pt" ? "pt-BR" : "en-US";
      if (preferredVoice) utterance.voice = preferredVoice;

      if (ageProfile === "child") {
        utterance.pitch = 1.08;
        utterance.rate = 0.98 * this.speechRate;
      } else if (ageProfile === "teen") {
        utterance.pitch = 1.02;
        utterance.rate = 1.04 * this.speechRate;
      } else {
        utterance.pitch = 0.94;
        utterance.rate = 0.96 * this.speechRate;
      }

      this._clearProgressTimer();
      this._progressTimer = setInterval(() => {
        if (token !== this._playbackToken || !this.isSpeaking) return;
        this.emitProgress();
      }, 150);

      utterance.onend = () => {
        if (token !== this._playbackToken) return;
        this._clearProgressTimer();
        if (this.isSpeaking) {
          index++;
          speakNext(0);
        }
      };

      utterance.onerror = () => {
        if (token !== this._playbackToken) return;
        this._clearProgressTimer();
        finishNarration();
      };

      window.speechSynthesis.speak(utterance);
      this.emitProgress();
    };

    const speakNext = (initialOffset = 0) => {
      if (token !== this._playbackToken) return;
      if (!this.isSpeaking || index >= paragraphs.length) {
        finishNarration();
        return;
      }

      this.currentParagraphIndex = index;
      this._pausedElapsedInPara = initialOffset;
      this._paragraphStartOffset = initialOffset;
      this._paragraphStartedAt = performance.now();
      this._audioOffsetSynced = initialOffset <= 0;
      if (this.onParagraphChange) this.onParagraphChange(index);
      this.emitProgress();

      if (artifactId) {
        const paraIdx = index;
        const audioUrl = `assets/audio/${artifactId}-${lang}-${ageProfile}-p${paraIdx}.mp3`;
        const audioEl = new Audio(audioUrl);
        audioEl.playbackRate = this.speechRate;
        this.currentAudioEl = audioEl;

        let fellBack = false;
        const fallback = () => {
          if (token !== this._playbackToken || fellBack || !this.isSpeaking) return;
          fellBack = true;
          this.currentAudioEl = null;
          this._audioOffsetSynced = true;
          speakWithWebSpeech(paraIdx);
        };

        audioEl.addEventListener("loadedmetadata", () => {
          if (token !== this._playbackToken || fellBack) return;
          if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
            this._paragraphDurations[paraIdx] = audioEl.duration;
            if (initialOffset > 0 && initialOffset < audioEl.duration) {
              try {
                audioEl.currentTime = initialOffset;
              } catch (_) {
                this._audioOffsetSynced = true;
              }
            } else {
              this._audioOffsetSynced = true;
            }
            this.emitProgress();
          }
        });

        audioEl.addEventListener("seeked", () => {
          if (token !== this._playbackToken || fellBack) return;
          this._audioOffsetSynced = true;
          this.emitProgress();
        });

        audioEl.addEventListener("timeupdate", () => {
          if (token !== this._playbackToken || fellBack) return;
          this.emitProgress();
        });

        audioEl.onended = () => {
          if (token !== this._playbackToken || fellBack) return;
          if (this.isSpeaking) {
            this.currentAudioEl = null;
            index++;
            speakNext(0);
          }
        };
        audioEl.onerror = fallback;
        audioEl.play().catch(fallback);
        return;
      }

      speakWithWebSpeech(index);
    };

    speakNext(offsetInParagraph);
  }

  speakStory(paragraphs, lang = "pt", ageProfile = "adult", callbacks = {}, artifactId = null) {
    this.stopSpeech(false);
    this.playQuindarTone(true);

    this.onParagraphChange = callbacks.onParagraphChange || null;
    this.onSpeechEnd = callbacks.onSpeechEnd || null;
    this.onProgress = callbacks.onProgress || this.onProgress || null;
    this._paragraphs = Array.isArray(paragraphs) ? paragraphs : [];
    this._paragraphDurations = this._paragraphs.map((p) => this.estimateParagraphDuration(p, 1.0));
    this._speechLang = lang;
    this._speechAge = ageProfile;
    this._speechArtifactId = artifactId;
    this.isSpeaking = true;
    this.isPaused = false;

    this._startParagraphPlayback(0, 0);
  }

  _jumpToParagraphOffset(targetPara, offsetInPara = 0) {
    const wasPaused = this.isPaused;
    this._playbackToken++;
    this._clearProgressTimer();
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.pause();
        this.currentAudioEl.currentTime = 0;
      } catch (_) {}
      this.currentAudioEl = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    this.isSpeaking = true;
    this.isPaused = false;
    this._startParagraphPlayback(targetPara, offsetInPara);
    if (wasPaused) {
      setTimeout(() => {
        if (this.isSpeaking && !this.isPaused) {
          this.togglePauseSpeech();
        }
      }, 60);
    }
  }

  seekToFraction(fraction) {
    const clamped = Math.max(0, Math.min(0.995, fraction));
    const durations = this._paragraphDurations || [];
    const total = durations.reduce((acc, d) => acc + d, 0);
    if (!this.isSpeaking || total <= 0) return;

    const targetTime = clamped * total;
    let accumulated = 0;
    let targetPara = 0;
    let offsetInPara = 0;

    for (let i = 0; i < durations.length; i++) {
      if (targetTime <= accumulated + durations[i] || i === durations.length - 1) {
        targetPara = i;
        offsetInPara = Math.max(0, targetTime - accumulated);
        break;
      }
      accumulated += durations[i];
    }

    this._jumpToParagraphOffset(targetPara, offsetInPara);
  }

  seekToParagraph(paraIndex, ratioInPara = 0) {
    if (!this.isSpeaking || !this._paragraphs.length) return;
    const safeIdx = Math.max(0, Math.min(this._paragraphs.length - 1, paraIndex));
    const paraDur = this._paragraphDurations[safeIdx] || 0;
    const offset = Math.max(0, Math.min(Math.max(0, paraDur - 0.5), ratioInPara * paraDur));
    this._jumpToParagraphOffset(safeIdx, offset);
  }

  togglePauseSpeech() {
    if (!this.isSpeaking) return false;
    if (this.currentAudioEl) {
      if (this.isPaused) {
        this.currentAudioEl.play().catch(() => {});
        this.isPaused = false;
        this.emitProgress();
        return false;
      } else {
        this.currentAudioEl.pause();
        this.isPaused = true;
        this.emitProgress();
        return true;
      }
    }
    if (!("speechSynthesis" in window)) return false;
    if (this.isPaused) {
      window.speechSynthesis.resume();
      this._paragraphStartOffset = this._pausedElapsedInPara;
      this._paragraphStartedAt = performance.now();
      this.isPaused = false;
      this.emitProgress();
      return false;
    } else {
      const elapsedNow =
        this._paragraphStartOffset +
        ((performance.now() - this._paragraphStartedAt) / 1000) * Math.max(0.5, this.speechRate);
      this._pausedElapsedInPara = elapsedNow;
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.emitProgress();
      return true;
    }
  }

  stopSpeech(playTone = true) {
    this._playbackToken++;
    this._clearProgressTimer();
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.pause();
        this.currentAudioEl.currentTime = 0;
      } catch (_) {}
      this.currentAudioEl = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.isSpeaking && playTone) {
      this.playQuindarTone(false);
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentParagraphIndex = -1;
    this._paragraphStartedAt = 0;
    this._pausedElapsedInPara = 0;
    this._audioOffsetSynced = true;
    this._paragraphStartOffset = 0;
    if (this.onParagraphChange) this.onParagraphChange(-1);
    this.emitProgress();
    if (this.onSpeechEnd) this.onSpeechEnd();
  }

  /**
   * Procedural realistic paper page-turn sound via filtered noise + soft settle thud
   */
  playPageTurnSound(forward = true) {
    try {
      this.initContext();
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      const duration = 0.24;
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(forward ? 950 : 2300, now);
      filter.frequency.exponentialRampToValueAtTime(forward ? 2500 : 880, now + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + duration);

      // Soft paper settle thud at the end of the turn
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(125, now + 0.14);
      thudOsc.frequency.exponentialRampToValueAtTime(60, now + 0.23);
      thudGain.gain.setValueAtTime(0.001, now + 0.14);
      thudGain.gain.linearRampToValueAtTime(0.045, now + 0.16);
      thudGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.24);
      thudOsc.connect(thudGain);
      thudGain.connect(this.ctx.destination);
      thudOsc.start(now + 0.14);
      thudOsc.stop(now + 0.25);
    } catch (_) {
      // Ignore audio errors if blocked
    }
  }
}
