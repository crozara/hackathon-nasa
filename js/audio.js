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
    this.onParagraphChange = null;
    this.onSpeechEnd = null;
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
  speakStory(paragraphs, lang = "pt", ageProfile = "adult", callbacks = {}, artifactId = null) {
    this.stopSpeech(false);
    this.playQuindarTone(true);

    this.onParagraphChange = callbacks.onParagraphChange || null;
    this.onSpeechEnd = callbacks.onSpeechEnd || null;
    this.isSpeaking = true;
    this.isPaused = false;

    const voices = "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
    const targetLangPrefix = lang === "pt" ? "pt" : "en";
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(targetLangPrefix) &&
          (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Luciana") || v.name.includes("Daniel"))
      ) || voices.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix));

    let index = 0;

    const finishNarration = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentParagraphIndex = -1;
      this.currentAudioEl = null;
      this.playQuindarTone(false);
      if (this.onParagraphChange) this.onParagraphChange(-1);
      if (this.onSpeechEnd) this.onSpeechEnd();
    };

    const speakWithWebSpeech = (pIdx) => {
      if (!("speechSynthesis" in window)) {
        finishNarration();
        return;
      }
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

      utterance.onend = () => {
        if (this.isSpeaking) {
          index++;
          speakNext();
        }
      };

      utterance.onerror = () => {
        finishNarration();
      };

      window.speechSynthesis.speak(utterance);
    };

    const speakNext = () => {
      if (!this.isSpeaking || index >= paragraphs.length) {
        finishNarration();
        return;
      }

      this.currentParagraphIndex = index;
      if (this.onParagraphChange) this.onParagraphChange(index);

      if (artifactId) {
        const audioUrl = `assets/audio/${artifactId}-${lang}-${ageProfile}-p${index}.mp3`;
        const audioEl = new Audio(audioUrl);
        audioEl.playbackRate = this.speechRate;
        this.currentAudioEl = audioEl;

        let fellBack = false;
        const fallback = () => {
          if (fellBack || !this.isSpeaking) return;
          fellBack = true;
          this.currentAudioEl = null;
          speakWithWebSpeech(index);
        };

        audioEl.onended = () => {
          if (this.isSpeaking && !fellBack) {
            this.currentAudioEl = null;
            index++;
            speakNext();
          }
        };
        audioEl.onerror = fallback;
        audioEl.play().catch(fallback);
        return;
      }

      speakWithWebSpeech(index);
    };

    speakNext();
  }

  togglePauseSpeech() {
    if (!this.isSpeaking) return false;
    if (this.currentAudioEl) {
      if (this.isPaused) {
        this.currentAudioEl.play().catch(() => {});
        this.isPaused = false;
        return false;
      } else {
        this.currentAudioEl.pause();
        this.isPaused = true;
        return true;
      }
    }
    if (!("speechSynthesis" in window)) return false;
    if (this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      return false;
    } else {
      window.speechSynthesis.pause();
      this.isPaused = true;
      return true;
    }
  }

  stopSpeech(playTone = true) {
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
    if (this.onParagraphChange) this.onParagraphChange(-1);
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
