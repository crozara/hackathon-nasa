// ============================================================================
// ECHOES OF THE MOON: MINIMALIST FIRST-PERSON LUNAR EXPLORATION CONTROLLER
// One Focal Point at a Time: Walk on the 3D Moon -> Listen to the Object's Voice
// -> Open Deep Science & NASA Specs on Demand
// ============================================================================

import { UI_TEXT, ARTIFACTS, ARTIFACT_INTERACTIONS, MISSION_QUIZ, VEGA_JOURNEY } from "./data.js";
import { LunarSurface3D } from "./lunarSurface3d.js";
import { MuseumAudioEngine } from "./audio.js";
import { getArtifactBlueprintSVG } from "./schematics.js";
import { ScienceLabController } from "./labs.js";

const STATION_ORDER = ["lrrr", "pse", "eagle", "lrv"];

class EchoesOfTheMoonApp {
  constructor() {
    this.lang = localStorage.getItem("nasa_lang") || "en";
    this.ageProfile = localStorage.getItem("nasa_age") || "adult"; // 'child' | 'teen' | 'adult'
    this.hasOnboarded = localStorage.getItem("nasa_onboarded") === "true";
    this.stationIndex = 0;
    this.storyPageIndex = 0;
    this.is3DActive = false;
    this.isStoryOpen = false;
    this.isImmersiveReading = false;
    this.activeSciTab = "anatomy";
    this.anatomyMode = "photo";
    this.activeHotspotIdx = 0;
    this.visitedStations = new Set();
    this.discoveredCuriosities = new Map();
    this.askedQuestions = new Map();
    this.unlockedStamps = new Set();
    this.expandedInlineCards = new Set();
    this._hasRenderedEditorialOnce = false;
    this._hasSeenMissionLetter = false;
    this._hasShownCertReward = false;
    this._vegaShownComms = new Set();
    this._vegaCommsTimer = null;
    this._activeVegaChannel = null;
    this._currentCommsKey = null;
    this._storyBridgeTimer = null;
    this._currentBridgeId = null;
    this.quizState = {
      phase: "welcome",
      questionIdx: 0,
      score: 0,
      answeredIdx: null,
      completed: false,
      rankTitle: null
    };

    this.audio = new MuseumAudioEngine();
    this.surface3D = null;
    this.labController = null;

    this.init();
  }

  init() {
    const onboardingModal = document.getElementById("onboardingModal");
    if (this.hasOnboarded && onboardingModal) {
      onboardingModal.classList.add("hidden");
    }

    const labMount = document.getElementById("scienceLabMount");
    this.labController = new ScienceLabController(labMount, this.audio);

    this.bindEvents();
    this.updateOnboardingLanguageUI();
    this.renderUI();
    this.setupScrollReveal();
    this.renderStoriesBackdrop();
    window.addEventListener("resize", () => {
      clearTimeout(this._backdropResizeTimer);
      this._backdropResizeTimer = setTimeout(() => this.renderStoriesBackdrop(), 160);
    });
  }

  updateOnboardingLanguageUI() {
    const t = UI_TEXT[this.lang] || UI_TEXT.en;

    const setElText = (id, text) => {
      const el = document.getElementById(id);
      if (el && text !== undefined) el.textContent = text;
    };

    // Kicker, Title & Subtitle
    setElText("onboardingKicker", t.nasaChallengeBadge);
    setElText("onboardingTitle", t.onboardingWelcome);
    setElText("onboardingSubtitle", t.onboardingLead || t.museumSubtitle);

    // Section Labels
    setElText("onboardingLangLabel", t.selectLanguageLabel);
    setElText("onboardingAgeLabel", t.selectAgeLabel);

    // Age Profiles (Title & Description)
    if (t.ageProfiles) {
      setElText("onboardingChildTitle", t.ageProfiles.child.name);
      setElText("onboardingChildDesc", t.ageProfiles.child.desc);

      setElText("onboardingTeenTitle", t.ageProfiles.teen.name);
      setElText("onboardingTeenDesc", t.ageProfiles.teen.desc);

      setElText("onboardingAdultTitle", t.ageProfiles.adult.name);
      setElText("onboardingAdultDesc", t.ageProfiles.adult.desc);
    }

    // Final Call to Action
    setElText("onboardingCtaText", t.startExpeditionBtn);

    // Sync active state on language & age buttons inside onboarding modal
    document.querySelectorAll("#onboardingModal [data-lang-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === this.lang);
    });
    document.querySelectorAll("#onboardingModal [data-age-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-age-btn") === this.ageProfile);
    });
  }

  ensure3DInitialized() {
    if (this.surface3D) return;
    const viewport = document.getElementById("lunar3DViewport");
    this.surface3D = new LunarSurface3D(viewport, ARTIFACTS, {
      onStationChange: (artifactId, idx, inspectMode) => {
        this.stationIndex = idx;
        this.storyPageIndex = 0;
        this.isStoryOpen = Boolean(inspectMode);
        if (this.isStoryOpen && artifactId) {
          this.visitedStations.add(artifactId);
        }
        this.closeInteractionCard();
        this.audio.stopSpeech(false);
        this.audio.playQuindarTone(true);
        this.renderUI();
        if (!inspectMode && artifactId) {
          this.showVega3DComms(artifactId);
        } else {
          this.hideVega3DComms();
        }
      },
      onArtifactClick: () => {
        this.closeInteractionCard();
        this.openStoryView();
      },
      onCuriosityClick: (artifactId, orbIndex) => {
        this.handleCuriosityOrbClick(artifactId, orbIndex);
      }
    });
    this.surface3D.setAgeDifficulty(this.ageProfile);
  }

  enter3DMode(stationIdx = null) {
    if (this._isLoading3D) return;
    if (stationIdx !== null) {
      this.stationIndex = stationIdx;
    }
    this._isLoading3D = true;
    this.is3DActive = true;
    this.isStoryOpen = false;
    this.stopVegaChannel();
    this.audio.stopSpeech(false);

    const isPt = this.lang === "pt";
    const overlay = document.getElementById("missionLoadingOverlay");
    const kickerEl = document.getElementById("missionLoadKicker");
    const titleEl = document.getElementById("missionLoadTitle");
    const statusEl = document.getElementById("missionLoadStatus");
    const labelEl = document.getElementById("missionLoadLabel");
    const percentEl = document.getElementById("missionLoadPercent");
    const fillEl = document.getElementById("missionLoadFill");

    const stages = isPt
      ? [
          { at: 0, text: "Calibrando coordenadas lunares..." },
          { at: 28, text: "Mapeando terreno de Mare Tranquillitatis..." },
          { at: 58, text: "Posicionando equipamentos históricos da Apollo..." },
          { at: 84, text: "Sincronizando sensores e telemetria 3D..." },
          { at: 100, text: "Missão pronta! Pousando na superfície lunar..." }
        ]
      : [
          { at: 0, text: "Calibrating lunar coordinates..." },
          { at: 28, text: "Mapping Mare Tranquillitatis terrain..." },
          { at: 58, text: "Positioning historic Apollo artifacts..." },
          { at: 84, text: "Syncing 3D optics & mission telemetry..." },
          { at: 100, text: "Mission ready! Touching down on the Moon..." }
        ];

    if (overlay && kickerEl && titleEl && statusEl && labelEl && percentEl && fillEl) {
      kickerEl.textContent = isPt
        ? "TELEMETRIA APOLLO • TRANSFERÊNCIA LUNAR"
        : "APOLLO TELEMETRY • LUNAR TRANSFER";
      titleEl.textContent = isPt ? "Preparando Missão 3D" : "Preparing 3D Mission";
      labelEl.textContent = isPt ? "CARREGAMENTO DA MISSÃO" : "MISSION LOADING";
      statusEl.textContent = stages[0].text;
      percentEl.textContent = "0%";
      fillEl.style.width = "0%";
      overlay.classList.remove("hidden", "is-fading");
    }

    const activate3DScene = () => {
      document.body.classList.add("in-3d-mode");
      document.getElementById("staticMuseumSite").classList.add("hidden");
      document.getElementById("storyDrawer").classList.add("hidden");
      document.getElementById("scienceModal").classList.add("hidden");
      document.getElementById("walkHudDock").classList.remove("hidden");
      document.getElementById("mode3DWrapper").classList.remove("hidden");

      this.ensure3DInitialized();
      this.surface3D.onResize();
      this.surface3D.setInspectMode(false);
      this.surface3D.snapToStation(this.stationIndex, false);
      this.renderUI();
    };

    const finishLoading = () => {
      this._isLoading3D = false;
      if (this.surface3D && this.is3DActive) {
        this.surface3D.descendToSurface();
      }
      this.audio.playQuindarTone(true);
      if (overlay) {
        overlay.classList.add("is-fading");
        setTimeout(() => {
          overlay.classList.add("hidden");
          overlay.classList.remove("is-fading");
          if (this.is3DActive && !this._hasSeenMissionLetter) {
            this.openMissionLetter();
          } else if (this.is3DActive) {
            this.showVega3DComms(this.currentArtifact.id);
          }
        }, 380);
      } else if (!this._hasSeenMissionLetter) {
        this.openMissionLetter();
      } else {
        this.showVega3DComms(this.currentArtifact.id);
      }
    };

    if (!overlay) {
      activate3DScene();
      finishLoading();
      return;
    }

    // Initialize WebGL right after first frame so loading overlay paints immediately
    let sceneReady = false;
    const durationMs = 3750;
    const startTime = performance.now();

    const step = (now) => {
      if (!this.is3DActive) {
        this._isLoading3D = false;
        overlay.classList.add("hidden");
        return;
      }

      if (!sceneReady && now - startTime >= 60) {
        sceneReady = true;
        activate3DScene();
      }

      const elapsed = now - startTime;
      const raw = Math.min(1, elapsed / durationMs);
      // Ease out slightly while keeping smooth progression to 100%
      const eased = 1 - Math.pow(1 - raw, 2.1);
      const pct = Math.min(100, Math.round(eased * 100));

      percentEl.textContent = `${pct}%`;
      fillEl.style.width = `${pct}%`;

      let currentStage = stages[0];
      for (const s of stages) {
        if (pct >= s.at) currentStage = s;
      }
      statusEl.textContent = currentStage.text;

      if (raw < 1) {
        requestAnimationFrame(step);
      } else {
        if (!sceneReady) {
          sceneReady = true;
          activate3DScene();
        }
        percentEl.textContent = "100%";
        fillEl.style.width = "100%";
        statusEl.textContent = stages[stages.length - 1].text;
        setTimeout(finishLoading, 240);
      }
    };

    requestAnimationFrame(step);
  }

  exit3DMode() {
    this._isLoading3D = false;
    this.is3DActive = false;
    this.isStoryOpen = false;
    this.isImmersiveReading = false;
    this.hideVega3DComms();
    this.stopVegaChannel();
    this.audio.stopSpeech(false);
    const loadOverlay = document.getElementById("missionLoadingOverlay");
    if (loadOverlay) {
      loadOverlay.classList.add("hidden");
      loadOverlay.classList.remove("is-fading");
    }
    document.body.classList.remove("in-3d-mode");
    document.getElementById("mode3DWrapper").classList.add("hidden");
    document.getElementById("storyDrawer").classList.add("hidden");
    document.getElementById("staticMuseumSite").classList.remove("hidden");
    this.renderUI();
    requestAnimationFrame(() => this.renderStoriesBackdrop());
  }

  setupScrollReveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal-on-scroll").forEach((el) => el.classList.add("in-view"));
      return;
    }
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            this.revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal-on-scroll").forEach((el) => this.revealObserver.observe(el));
  }

  renderStoriesBackdrop() {
    const canvas = document.getElementById("storiesNebulaCanvas");
    if (!canvas) return;
    const container =
      canvas.closest(".cosmic-stories-artemis-band") || canvas.closest("section");
    const w = container ? container.clientWidth : window.innerWidth;
    const h = container ? container.clientHeight : 1180;
    if (!w || !h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Deterministic PRNG for consistent cosmic starfield & nebula dust
    let seed = 19690724;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    ctx.fillStyle = "#010309";
    ctx.fillRect(0, 0, w, h);

    // Deep-blue cosmic nebula clouds spanning both Stories and Artemis sections
    const clouds = [
      { x: w * 0.08, y: h * 0.14, r: w * 0.34, c: "rgba(29, 78, 216, 0.22)" },
      { x: w * 0.14, y: h * 0.24, r: w * 0.24, c: "rgba(56, 189, 248, 0.14)" },
      { x: w * 0.42, y: h * 0.11, r: w * 0.28, c: "rgba(30, 58, 138, 0.16)" },
      { x: w * 0.78, y: h * 0.22, r: w * 0.32, c: "rgba(37, 99, 235, 0.20)" },
      { x: w * 0.88, y: h * 0.38, r: w * 0.30, c: "rgba(56, 189, 248, 0.13)" },
      { x: w * 0.12, y: h * 0.56, r: w * 0.30, c: "rgba(30, 64, 175, 0.19)" },
      { x: w * 0.52, y: h * 0.68, r: w * 0.34, c: "rgba(29, 78, 216, 0.15)" },
      { x: w * 0.86, y: h * 0.80, r: w * 0.32, c: "rgba(37, 99, 235, 0.17)" }
    ];
    clouds.forEach((cl) => {
      const grad = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r);
      grad.addColorStop(0, cl.c);
      grad.addColorStop(0.55, cl.c.replace(/[\d.]+\)$/, "0.05)"));
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    // Wispy nebula puffs along diagonal cosmic dust bands
    for (let i = 0; i < 85; i++) {
      const onLeft = i % 2 === 0;
      const px = onLeft
        ? w * (0.0 + rand() * 0.34)
        : w * (0.62 + rand() * 0.38);
      const py = h * (0.05 + rand() * 0.88);
      const pr = 26 + rand() * 88;
      const alpha = 0.02 + rand() * 0.045;
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, `rgba(96, 165, 250, ${alpha.toFixed(3)})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pinpoint background stars across both sections
    const starCount = Math.min(520, Math.max(240, Math.floor((w * h) / 3600)));
    for (let i = 0; i < starCount; i++) {
      const sx = rand() * w;
      const sy = rand() * h;
      const sr = 0.4 + rand() * 1.15;
      const op = 0.25 + rand() * 0.7;
      ctx.fillStyle = rand() > 0.78
        ? `rgba(147, 197, 253, ${op.toFixed(2)})`
        : `rgba(241, 245, 249, ${op.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle bright 4-point star flares
    const flareSpots = [
      { x: w * 0.11, y: h * 0.09, s: 13 },
      { x: w * 0.21, y: h * 0.30, s: 9 },
      { x: w * 0.07, y: h * 0.42, s: 11 },
      { x: w * 0.73, y: h * 0.07, s: 12 },
      { x: w * 0.93, y: h * 0.12, s: 14 },
      { x: w * 0.86, y: h * 0.46, s: 10 },
      { x: w * 0.16, y: h * 0.64, s: 11 },
      { x: w * 0.88, y: h * 0.78, s: 12 }
    ];
    flareSpots.forEach((f) => {
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.s * 1.6);
      glow.addColorStop(0, "rgba(224, 242, 254, 0.85)");
      glow.addColorStop(0.25, "rgba(96, 165, 250, 0.35)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.s * 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(224, 242, 254, 0.65)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(f.x - f.s, f.y);
      ctx.lineTo(f.x + f.s, f.y);
      ctx.moveTo(f.x, f.y - f.s);
      ctx.lineTo(f.x, f.y + f.s);
      ctx.stroke();
    });
  }

  get currentArtifact() {
    const id = STATION_ORDER[this.stationIndex];
    return ARTIFACTS.find((a) => a.id === id) || ARTIFACTS[0];
  }

  get t() {
    return UI_TEXT[this.lang];
  }

  bindEvents() {
    // 1. Language Switchers (including Onboarding Modal)
    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.lang = btn.getAttribute("data-lang-btn");
        localStorage.setItem("nasa_lang", this.lang);
        if (this.audio) {
          this.audio.stopSpeech(false);
          if (typeof this.audio.playPing === "function") {
            this.audio.playPing(780, 0.08);
          }
        }
        this.updateOnboardingLanguageUI();
        this.renderUI();
      });
    });

    // 2. Age Profile Switchers (including Onboarding Modal & Storybook)
    document.querySelectorAll("[data-age-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.ageProfile = btn.getAttribute("data-age-btn");
        localStorage.setItem("nasa_age", this.ageProfile);
        if (this.audio) {
          this.audio.stopSpeech(false);
          if (typeof this.audio.playPing === "function") {
            this.audio.playPing(920, 0.08);
          }
        }
        this.updateOnboardingLanguageUI();
        this.renderUI();
      });
    });

    // 2b. Onboarding Enter Button ("ENTER THE MUSEUM")
    const enterMuseumBtn = document.getElementById("enterMuseumBtn");
    const onboardingModal = document.getElementById("onboardingModal");
    if (enterMuseumBtn && onboardingModal) {
      enterMuseumBtn.addEventListener("click", () => {
        this.hasOnboarded = true;
        localStorage.setItem("nasa_onboarded", "true");
        localStorage.setItem("nasa_lang", this.lang);
        localStorage.setItem("nasa_age", this.ageProfile);
        onboardingModal.classList.add("hidden");
        if (this.audio && typeof this.audio.playPing === "function") {
          this.audio.playPing(880, 0.1);
        }
        this.renderUI();
      });
    }

    // 2c. Reopen Settings Button in Navbar & 3D Topbar
    ["reopenSettingsBtn", "reopenSettings3DBtn"].forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn && onboardingModal) {
        btn.addEventListener("click", () => {
          this.lang = localStorage.getItem("nasa_lang") || this.lang;
          this.ageProfile = localStorage.getItem("nasa_age") || this.ageProfile;
          this.updateOnboardingLanguageUI();
          onboardingModal.classList.remove("hidden");
          if (this.audio && typeof this.audio.playPing === "function") {
            this.audio.playPing(820, 0.08);
          }
        });
      }
    });

    // 3. On-Demand 3D Mode Triggers
    ["open3DModeBtn", "heroOpen3DBtn", "artemisOpen3DBtn"].forEach((id) => {
      document.getElementById(id).addEventListener("click", () => {
        this.enter3DMode(this.stationIndex);
      });
    });

    document.getElementById("exit3DBtn").addEventListener("click", () => {
      this.exit3DMode();
    });

    // 4. Ambient Sound Toggle
    const ambientSoundBtn = document.getElementById("ambientSoundBtn");
    if (ambientSoundBtn) {
      ambientSoundBtn.addEventListener("click", () => {
        this.audio.toggleAmbient();
        this.updateAmbientUI();
      });
    }

    // 5. Lateral Travel Navigation in 3D Mode
    const stepStation = (delta) => {
      const targetIdx = (this.stationIndex + delta + STATION_ORDER.length) % STATION_ORDER.length;
      this.audio.stopSpeech(false);
      if (this.surface3D && this.is3DActive) {
        this.surface3D.goToStation(targetIdx, this.isStoryOpen);
      } else {
        this.stationIndex = targetIdx;
        this.storyPageIndex = 0;
        this.renderUI();
      }
    };

    document.getElementById("prevStationBtn").addEventListener("click", () => stepStation(-1));
    document.getElementById("nextStationBtn").addEventListener("click", () => stepStation(1));

    // 6. Open & Close Story Reading Drawer
    document.getElementById("openStoryBtn").addEventListener("click", () => {
      this.closeInteractionCard();
      this.openStoryView();
    });

    document.getElementById("openAskBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.openAskEquipmentCard();
    });

    document.getElementById("closeIcardBtn").addEventListener("click", () => {
      this.closeInteractionCard();
    });

    document.getElementById("closeStoryBtn").addEventListener("click", () => {
      this.closeStoryView();
    });

    const returnToWalkBrand = document.getElementById("returnToWalkBrand");
    if (returnToWalkBrand) {
      returnToWalkBrand.addEventListener("click", () => {
        if (this.isStoryOpen) {
          this.closeStoryView();
        }
      });
    }

    document.getElementById("storyDrawer").addEventListener("click", (e) => {
      if (e.target.id === "storyDrawer" || e.target.classList.contains("story-drawer-inner")) {
        if (this.isImmersiveReading) {
          this.isImmersiveReading = false;
          this.updateImmersiveUI();
        } else {
          this.closeStoryView();
        }
      }
    });

    const immersiveBtn = document.getElementById("immersiveModeBtn");
    if (immersiveBtn) {
      immersiveBtn.addEventListener("click", () => {
        this.isImmersiveReading = !this.isImmersiveReading;
        this.audio.playPing(this.isImmersiveReading ? 660 : 520, 0.08);
        this.updateImmersiveUI();
      });
    }

    const turnBookPage = (delta) => {
      const paragraphs = this.currentArtifact[this.lang].stories[this.ageProfile] || [];
      const bookPages = this.buildBookPages(paragraphs);
      const totalPages = Math.max(1, bookPages.length);
      const nextIndex = this.storyPageIndex + delta;
      if (nextIndex < 0 || nextIndex >= totalPages) return;
      this.storyPageIndex = nextIndex;
      this.audio.playPageTurnSound(delta > 0);
      this.renderStoryDrawer(delta > 0 ? "next" : "prev");
      if (this.audio.isSpeaking && bookPages[nextIndex]) {
        const target = bookPages[nextIndex];
        this.audio.seekToParagraph(target.paraIndex, target.startRatio || 0);
      }
    };

    document.getElementById("bookPrevPageBtn").addEventListener("click", () => turnBookPage(-1));
    document.getElementById("bookNextPageBtn").addEventListener("click", () => turnBookPage(1));

    const switchStoryChapter = (delta) => {
      const targetIdx = (this.stationIndex + delta + STATION_ORDER.length) % STATION_ORDER.length;
      const targetId = STATION_ORDER[targetIdx];
      this.audio.stopSpeech(false);
      this.storyPageIndex = 0;
      this.audio.playPageTurnSound(delta > 0);
      if (this.surface3D && this.is3DActive) {
        this.surface3D.goToStation(targetIdx, true);
      } else {
        this.stationIndex = targetIdx;
        this.visitedStations.add(this.currentArtifact.id);
        this.renderUI();
      }
      this.showStoryBridge(targetId);
    };

    document.getElementById("storyPrevArtifactBtn").addEventListener("click", () => switchStoryChapter(-1));
    document.getElementById("storyNextArtifactBtn").addEventListener("click", () => switchStoryChapter(1));

    // 7. Audio Narration (Integrated Player + Text-to-Speech)
    this.audio.onProgress = (stats) => this.updateAudioProgressUI(stats);

    const startNarrationAt = (initialFraction = 0) => {
      const paragraphs = this.currentArtifact[this.lang].stories[this.ageProfile];
      this.updateSpeechButtons(true, false);
      this.audio.speakStory(
        paragraphs,
        this.lang,
        this.ageProfile,
        {
          onParagraphChange: (idx) => this.highlightParagraph(idx),
          onSpeechEnd: () => {
            this.updateSpeechButtons(false, false);
            this.updateAudioProgressUI(null);
          },
          onProgress: (stats) => this.updateAudioProgressUI(stats)
        },
        this.currentArtifact.id
      );
      if (initialFraction > 0.01) {
        this.audio.seekToFraction(initialFraction);
      }
    };

    const togglePlay = () => {
      if (this.audio.isSpeaking) {
        const paused = this.audio.togglePauseSpeech();
        this.updateSpeechButtons(true, paused);
      } else {
        startNarrationAt(0);
      }
    };

    document.getElementById("narratePlayBtn").addEventListener("click", togglePlay);
    const capsuleIcon = document.getElementById("audioCapsuleIcon");
    if (capsuleIcon) capsuleIcon.addEventListener("click", togglePlay);
    const statusReadout = document.querySelector(".audio-status-readout");
    if (statusReadout) statusReadout.addEventListener("click", togglePlay);

    const progressTrack = document.getElementById("audioProgressTrack");
    if (progressTrack) {
      progressTrack.addEventListener("click", (e) => {
        const rect = progressTrack.getBoundingClientRect();
        if (!rect.width) return;
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (this.audio.isSpeaking) {
          this.audio.seekToFraction(frac);
        } else {
          startNarrationAt(frac);
        }
      });
    }

    document.getElementById("narrateStopBtn").addEventListener("click", () => {
      this.audio.stopSpeech(true);
      this.updateSpeechButtons(false, false);
      this.updateAudioProgressUI(null);
    });

    document.getElementById("narrateSpeedBtn").addEventListener("click", (e) => {
      const nextRate = this.audio.speechRate === 1.0 ? 1.2 : 1.0;
      this.audio.setSpeechRate(nextRate);
      e.currentTarget.textContent = `${nextRate.toFixed(1)}x`;
    });

    // 8. On-Demand Science & NASA Specs Modal
    document.getElementById("openScienceModalBtn").addEventListener("click", () => {
      this.activeHotspotIdx = 0;
      this.renderScienceModal();
      document.getElementById("scienceModal").classList.remove("hidden");
      this.audio.playPing(980, 0.09);
    });

    document.getElementById("closeScienceModalBtn").addEventListener("click", () => {
      document.getElementById("scienceModal").classList.add("hidden");
      this.labController.cleanup();
    });

    document.getElementById("scienceModal").addEventListener("click", (e) => {
      if (e.target.id === "scienceModal") {
        document.getElementById("scienceModal").classList.add("hidden");
        this.labController.cleanup();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("scienceModal");
      if (!modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
        this.labController.cleanup();
      } else if (this.isStoryOpen) {
        this.closeStoryView();
      }
    });

    document.querySelectorAll("[data-scitab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.activeSciTab = btn.getAttribute("data-scitab");
        this.audio.playPing(840, 0.07);
        this.renderScienceModal();
      });
    });

    document.getElementById("modePhotoBtn").addEventListener("click", () => {
      this.anatomyMode = "photo";
      this.renderAnatomyPane();
    });

    document.getElementById("modeBlueprintBtn").addEventListener("click", () => {
      this.anatomyMode = "blueprint";
      this.renderAnatomyPane();
    });

    document.getElementById("startExpeditionBtn").addEventListener("click", () => {
      this.closeMissionLetter();
    });

    const letterVegaBtn = document.getElementById("letterVegaVoiceBtn");
    if (letterVegaBtn) {
      letterVegaBtn.addEventListener("click", () => {
        const langKey = this.lang === "pt" ? "pt" : "en";
        const age = this.ageProfile || "adult";
        const letter = VEGA_JOURNEY[langKey].missionLetter[age] || VEGA_JOURNEY[langKey].missionLetter.adult;
        const spoken = `${letter.title} ${letter.paragraphs.join(" ")}`;
        const idle = this.lang === "pt" ? "Ouvir Vega" : "Hear Vega";
        this.playVegaChannelClip(
          "letter",
          `assets/audio/vega-${langKey}-${age}-letter.mp3`,
          spoken,
          "#letterVegaAvatarRing",
          "#letterVegaVoiceBtn",
          idle
        );
      });
    }

    const vegaCommsHearBtn = document.getElementById("vegaCommsHearBtn");
    if (vegaCommsHearBtn) {
      vegaCommsHearBtn.addEventListener("click", () => {
        if (!this._currentCommsKey) return;
        clearTimeout(this._vegaCommsTimer);
        const langKey = this.lang === "pt" ? "pt" : "en";
        const text = VEGA_JOURNEY[langKey].comms3D[this._currentCommsKey] || "";
        const idle = VEGA_JOURNEY[langKey].commsHearBtn;
        this.playVegaChannelClip(
          "comms",
          `assets/audio/vega-${langKey}-comms-${this._currentCommsKey}.mp3`,
          text,
          "#vegaCommsAvatarRing",
          "#vegaCommsHearBtn",
          idle,
          () => {
            this._vegaCommsTimer = setTimeout(() => this.hideVega3DComms(), 2500);
          }
        );
      });
    }

    const vegaCommsCloseBtn = document.getElementById("vegaCommsCloseBtn");
    if (vegaCommsCloseBtn) {
      vegaCommsCloseBtn.addEventListener("click", () => {
        this.hideVega3DComms();
      });
    }

    const certVegaBtn = document.getElementById("certVegaVoiceBtn");
    if (certVegaBtn) {
      certVegaBtn.addEventListener("click", () => {
        const langKey = this.lang === "pt" ? "pt" : "en";
        const age = this.ageProfile || "adult";
        const text = VEGA_JOURNEY[langKey].certificateDelivery[age];
        const idle = this.lang === "pt" ? "Ouvir Vega" : "Hear Vega";
        this.playVegaChannelClip(
          "cert",
          `assets/audio/vega-${langKey}-${age}-cert.mp3`,
          text,
          "#certVegaAvatarRing",
          "#certVegaVoiceBtn",
          idle
        );
      });
    }

    document.getElementById("missionProgressBadge").addEventListener("click", () => {
      if (this.visitedStations.size >= STATION_ORDER.length) {
        if (this.quizState.completed) {
          this.openCertificateModal();
        } else {
          this.openAstronautQuizModal();
        }
      } else {
        this.openMissionLetter();
      }
    });

    document.getElementById("closeQuizBtn").addEventListener("click", () => {
      this.closeAstronautQuizModal();
    });

    document.getElementById("astronautQuizModal").addEventListener("click", (e) => {
      if (e.target.id === "astronautQuizModal") {
        this.closeAstronautQuizModal();
      }
    });

    const quizReplayBtn = document.getElementById("quizReplayVoiceBtn");
    if (quizReplayBtn) {
      quizReplayBtn.addEventListener("click", () => {
        if (this.audio.vegaMuted) {
          this.audio.vegaMuted = false;
        }
        if (this._lastVegaVoice) {
          this.speakVegaClip(this._lastVegaVoice.audioUrl, this._lastVegaVoice.spokenText);
        }
      });
    }

    const quizVoiceToggleBtn = document.getElementById("quizVoiceToggleBtn");
    if (quizVoiceToggleBtn) {
      quizVoiceToggleBtn.addEventListener("click", () => {
        this.audio.vegaMuted = !this.audio.vegaMuted;
        if (this.audio.vegaMuted) {
          this.audio.stopVegaClip();
          this.updateVegaSpeakingUI(false);
        } else if (this._lastVegaVoice) {
          this.speakVegaClip(this._lastVegaVoice.audioUrl, this._lastVegaVoice.spokenText);
        }
        this.updateVegaVoiceControlsUI();
      });
    }

    const openQuizFromCertBtn = document.getElementById("openQuizFromCertBtn");
    if (openQuizFromCertBtn) {
      openQuizFromCertBtn.addEventListener("click", () => {
        this.closeCertificateModal();
        this.openAstronautQuizModal(true);
      });
    }

    document.getElementById("closeCertificateBtn").addEventListener("click", () => {
      this.closeCertificateModal();
    });

    const storyBridgeHearBtn = document.getElementById("storyBridgeHearBtn");
    if (storyBridgeHearBtn) {
      storyBridgeHearBtn.addEventListener("click", () => {
        if (!this._currentBridgeId) return;
        clearTimeout(this._storyBridgeTimer);
        const langKey = this.lang === "pt" ? "pt" : "en";
        const vegaLoc = VEGA_JOURNEY[langKey];
        const text = vegaLoc.chapterBridges[this._currentBridgeId] || "";
        this.playVegaChannelClip(
          "bridge",
          `assets/audio/vega-${langKey}-bridge-${this._currentBridgeId}.mp3`,
          text,
          "#storyBridgeAvatarRing",
          "#storyBridgeHearBtn",
          vegaLoc.commsHearBtn,
          () => {
            this._storyBridgeTimer = setTimeout(() => this.hideStoryBridge(), 2600);
          }
        );
      });
    }

    const storyBridgeCloseBtn = document.getElementById("storyBridgeCloseBtn");
    if (storyBridgeCloseBtn) {
      storyBridgeCloseBtn.addEventListener("click", () => {
        this.hideStoryBridge();
      });
    }

    document.getElementById("certificateModal").addEventListener("click", (e) => {
      if (e.target.id === "certificateModal" || e.target.classList.contains("certificate-stage-layout")) {
        this.closeCertificateModal();
      }
    });

    const closeThankYouBtn = document.getElementById("closeThankYouBtn");
    if (closeThankYouBtn) {
      closeThankYouBtn.addEventListener("click", () => {
        this.closeThankYouModal();
      });
    }

    const thankYouModal = document.getElementById("thankYouModal");
    if (thankYouModal) {
      thankYouModal.addEventListener("click", (e) => {
        if (e.target.id === "thankYouModal") {
          this.closeThankYouModal();
        }
      });
    }

    const thankYouBackSiteBtn = document.getElementById("thankYouBackSiteBtn");
    if (thankYouBackSiteBtn) {
      thankYouBackSiteBtn.addEventListener("click", () => {
        this.closeThankYouModal();
        if (this.is3DActive) {
          this.exit3DMode();
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    const thankYouBack3DBtn = document.getElementById("thankYouBack3DBtn");
    if (thankYouBack3DBtn) {
      thankYouBack3DBtn.addEventListener("click", () => {
        this.closeThankYouModal();
        if (!this.is3DActive) {
          this.enter3DMode();
        }
      });
    }

    document.getElementById("certNameInput").addEventListener("input", () => {
      this.renderCertificateCanvas();
    });

    document.getElementById("downloadCertBtn").addEventListener("click", () => {
      this.downloadCertificate();
    });

    // 9. Book Photograph Zoom Lightbox (magnifying glass icon or direct image click)
    const zoomBtn = document.getElementById("bookZoomImageBtn");
    const bookImg = document.getElementById("bookArtifactImage");
    if (zoomBtn) {
      zoomBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openBookImageLightbox();
      });
    }
    if (bookImg) {
      bookImg.addEventListener("click", () => this.openBookImageLightbox());
    }

    const lightbox = document.getElementById("bookImageLightbox");
    const closeZoomBtn = document.getElementById("closeBookZoomBtn");
    if (closeZoomBtn) {
      closeZoomBtn.addEventListener("click", () => this.closeBookImageLightbox());
    }
    if (lightbox) {
      lightbox.addEventListener("click", (e) => {
        if (e.target.id === "bookImageLightbox") {
          this.closeBookImageLightbox();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const quizModal = document.getElementById("astronautQuizModal");
        if (quizModal && !quizModal.classList.contains("hidden")) {
          this.closeAstronautQuizModal();
          return;
        }
        if (lightbox && !lightbox.classList.contains("hidden")) {
          this.closeBookImageLightbox();
        }
      }
    });
  }

  openBookImageLightbox() {
    const lightbox = document.getElementById("bookImageLightbox");
    const zoomImg = document.getElementById("bookZoomImg");
    const capTitle = document.getElementById("bookZoomCaptionTitle");
    const capSub = document.getElementById("bookZoomCaptionSub");
    if (!lightbox || !zoomImg) return;

    const art = this.currentArtifact;
    const loc = art[this.lang];
    zoomImg.src = art.imagePath;
    zoomImg.alt = loc.name;
    if (capTitle) capTitle.textContent = `${art.id.toUpperCase()} — ${art.mission}, ${art.datePlaced}`;
    if (capSub) capSub.textContent = loc.shortTag || "";
    lightbox.classList.remove("hidden");
    this.audio.playPing(920, 0.08);
  }

  closeBookImageLightbox() {
    const lightbox = document.getElementById("bookImageLightbox");
    if (lightbox) lightbox.classList.add("hidden");
  }

  openStoryView() {
    this.hideVega3DComms();
    this.hideStoryBridge();
    this.stopVegaChannel();
    this.isStoryOpen = true;
    this.storyPageIndex = 0;
    this.visitedStations.add(this.currentArtifact.id);
    this.audio.playQuindarTone(true);
    if (this.surface3D && this.is3DActive) {
      this.surface3D.setInspectMode(true);
      this.surface3D.renderMarkers(this.lang);
    }
    document.getElementById("walkHudDock").classList.add("hidden");
    document.getElementById("storyDrawer").classList.remove("hidden");
    this.renderUI();
  }

  closeStoryView() {
    this.closeBookImageLightbox();
    this.hideStoryBridge();
    this.isStoryOpen = false;
    this.isImmersiveReading = false;
    this.updateImmersiveUI();
    this.audio.stopSpeech(false);
    if (this.surface3D && this.is3DActive) {
      this.surface3D.setInspectMode(false);
      this.surface3D.renderMarkers(this.lang);
    }
    document.getElementById("storyDrawer").classList.add("hidden");
    document.getElementById("walkHudDock").classList.remove("hidden");
    this.renderUI();
    if (this.visitedStations.size >= STATION_ORDER.length && !this._hasShownCertReward) {
      this._hasShownCertReward = true;
      this.openAstronautQuizModal();
    } else if (this.is3DActive && this.visitedStations.size === 2 && !this._vegaShownComms.has("halfway")) {
      this.showVega3DComms("halfway");
    }
  }

  closeInteractionCard() {
    this.audio.stopArtifactClip(false);
    const card = document.getElementById("interactionCard3D");
    if (card) card.classList.add("hidden");
  }

  handleCuriosityOrbClick(artifactId, orbIndex) {
    this.hideVega3DComms();
    const data = ARTIFACT_INTERACTIONS[artifactId];
    if (!data || !data.curiosities[orbIndex]) return;

    if (!this.discoveredCuriosities.has(artifactId)) {
      this.discoveredCuriosities.set(artifactId, new Set());
    }
    this.discoveredCuriosities.get(artifactId).add(orbIndex);

    if (this.surface3D) {
      this.surface3D.markCuriosityDiscovered(artifactId, orbIndex);
    }
    this.audio.playPing(980, 0.08);

    const isPt = this.lang === "pt";
    const cur = data.curiosities[orbIndex][this.lang];
    const discoveredCount = this.discoveredCuriosities.get(artifactId).size;
    const askedCount = (this.askedQuestions.get(artifactId) || new Set()).size;
    const totalDone = Math.min(3, discoveredCount + askedCount);
    const unlocked = this.unlockedStamps.has(artifactId);

    document.getElementById("icardKicker").textContent = isPt
      ? `CURIOSIDADE 3D • ORBE 0${orbIndex + 1}/03`
      : `3D CURIOSITY • ORB 0${orbIndex + 1}/03`;

    document.getElementById("icardBody").innerHTML = `
      <h3 class="icard-title">${cur.label}</h3>
      <p class="icard-text">${cur.text}</p>
      <div class="icard-progress-note">
        ${
          unlocked
            ? isPt
              ? `★ Selinho "${data.badge.pt.title}" conquistado!`
              : `★ Stamp "${data.badge.en.title}" unlocked!`
            : isPt
              ? `Descobertas aqui: ${totalDone}/3 para desbloquear o selinho`
              : `Discoveries here: ${totalDone}/3 to unlock this station's stamp`
        }
      </div>
    `;

    document.getElementById("interactionCard3D").classList.remove("hidden");
    this.checkStampUnlock(artifactId);
    this.renderStampsBar();
  }

  openAskEquipmentCard(selectedQaIdx = null) {
    if (this.isStoryOpen) {
      this.closeStoryView();
    }
    this.hideVega3DComms();
    this.stopVegaChannel();
    this.audio.stopArtifactClip(false);
    const art = this.currentArtifact;
    const artifactId = art.id;
    const data = ARTIFACT_INTERACTIONS[artifactId];
    if (!data) return;

    const isPt = this.lang === "pt";
    if (!this.askedQuestions.has(artifactId)) {
      this.askedQuestions.set(artifactId, new Set());
    }
    if (selectedQaIdx !== null) {
      this.askedQuestions.get(artifactId).add(selectedQaIdx);
      this.audio.playPing(880, 0.07);
      this.checkStampUnlock(artifactId);
    }

    const askedSet = this.askedQuestions.get(artifactId);
    const activeIdx = selectedQaIdx !== null ? selectedQaIdx : 0;
    const activeQa = data.qa[activeIdx][this.lang];

    if (selectedQaIdx === null && askedSet.size === 0) {
      askedSet.add(0);
      this.checkStampUnlock(artifactId);
    }

    document.getElementById("icardKicker").textContent = isPt
      ? `PERGUNTE AO EQUIPAMENTO • ${art.mission.toUpperCase()}`
      : `ASK THE EQUIPMENT • ${art.mission.toUpperCase()}`;

    const questionsHtml = data.qa
      .slice(0, 3)
      .map((item, idx) => {
        const qText = item[this.lang].q;
        const activeClass = idx === activeIdx ? "active" : "";
        return `<button class="icard-qa-btn ${activeClass}" data-qa-idx="${idx}">${qText}</button>`;
      })
      .join("");

    document.getElementById("icardBody").innerHTML = `
      <div class="icard-qa-list">${questionsHtml}</div>
      <div class="icard-answer-box">
        <p>"${activeQa.a}"</p>
        <button class="icard-speak-btn" id="icardSpeakAnswerBtn">
          ${isPt ? "Ouvir Resposta" : "Hear Answer"}
        </button>
      </div>
    `;

    document.getElementById("icardBody").querySelectorAll("[data-qa-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-qa-idx"), 10);
        this.openAskEquipmentCard(idx);
      });
    });

    const speakAnswerBtn = document.getElementById("icardSpeakAnswerBtn");
    const idleSpeakLabel = isPt ? "Ouvir Resposta" : "Hear Answer";
    const activeSpeakLabel = isPt ? "Parar Áudio" : "Stop Audio";
    if (speakAnswerBtn) {
      speakAnswerBtn.textContent = idleSpeakLabel;
      speakAnswerBtn.addEventListener("click", () => {
        if (this.audio.isArtifactSpeaking) {
          this.audio.stopArtifactClip(true);
          speakAnswerBtn.classList.remove("is-playing");
          speakAnswerBtn.textContent = idleSpeakLabel;
          return;
        }
        const audioUrl = `assets/audio/${artifactId}-${this.lang}-qa${activeIdx}.mp3`;
        this.audio.playArtifactClip(audioUrl, activeQa.a, this.lang, artifactId, {
          onStart: () => {
            speakAnswerBtn.classList.add("is-playing");
            speakAnswerBtn.textContent = activeSpeakLabel;
          },
          onEnd: () => {
            speakAnswerBtn.classList.remove("is-playing");
            speakAnswerBtn.textContent = idleSpeakLabel;
          }
        });
      });
    }

    document.getElementById("interactionCard3D").classList.remove("hidden");
    this.renderStampsBar();
  }

  checkStampUnlock(artifactId) {
    if (this.unlockedStamps.has(artifactId)) return;
    const curCount = (this.discoveredCuriosities.get(artifactId) || new Set()).size;
    const qaCount = (this.askedQuestions.get(artifactId) || new Set()).size;
    if (curCount + qaCount >= 3) {
      this.unlockedStamps.add(artifactId);
      this.showStampToast(artifactId);
      this.renderStampsBar();
    }
  }

  showStampToast(artifactId) {
    const data = ARTIFACT_INTERACTIONS[artifactId];
    if (!data) return;
    const isPt = this.lang === "pt";
    document.getElementById("stampToastIcon").textContent = data.badge.icon;
    document.getElementById("stampToastKicker").textContent = isPt
      ? "SELINHO CONQUISTADO!"
      : "STAMP UNLOCKED!";
    document.getElementById("stampToastTitle").textContent = data.badge[this.lang].title;

    const toast = document.getElementById("stampToast");
    toast.classList.remove("hidden");
    this.audio.playQuindarTone(true);
    clearTimeout(this._stampToastTimer);
    this._stampToastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3600);
  }

  renderStampsBar() {
    const bar = document.getElementById("stampsCollectionBar");
    if (!bar) return;
    const isPt = this.lang === "pt";
    bar.innerHTML = STATION_ORDER.map((id) => {
      const data = ARTIFACT_INTERACTIONS[id];
      const unlocked = this.unlockedStamps.has(id);
      const label = unlocked ? data.badge[this.lang].title : isPt ? "Selinho Bloqueado" : "Locked Stamp";
      return `
        <span class="stamp-pill ${unlocked ? "unlocked" : ""}" title="${label}">
          <span>${data.badge.icon}</span>
          <span>${unlocked ? data.badge[this.lang].title : "???"}</span>
        </span>
      `;
    }).join("");
  }

  stopVegaChannel() {
    if (this._activeVegaChannel) {
      const { avatarSelector, btnSelector, idleLabel } = this._activeVegaChannel;
      const ring = avatarSelector ? document.querySelector(avatarSelector) : null;
      const btn = btnSelector ? document.querySelector(btnSelector) : null;
      if (ring) ring.classList.remove("is-speaking");
      if (btn) {
        btn.classList.remove("is-playing");
        if (idleLabel) btn.textContent = idleLabel;
      }
      this._activeVegaChannel = null;
    }
    this.audio.stopVegaClip();
  }

  playVegaChannelClip(surface, audioUrl, spokenText, avatarSelector, btnSelector, idleLabel, onComplete = null) {
    const isSameActive =
      this._activeVegaChannel &&
      this._activeVegaChannel.surface === surface &&
      this._activeVegaChannel.audioUrl === audioUrl &&
      this.audio.isVegaSpeaking;

    this.stopVegaChannel();
    if (isSameActive) return;

    this.audio.stopSpeech(false);
    this.audio.stopArtifactClip(false);

    const stopText = this.lang === "pt" ? "Parar Áudio" : "Stop Audio";
    this._activeVegaChannel = { surface, audioUrl, avatarSelector, btnSelector, idleLabel };

    const setPlaying = (active) => {
      const ring = avatarSelector ? document.querySelector(avatarSelector) : null;
      const btn = btnSelector ? document.querySelector(btnSelector) : null;
      if (ring) ring.classList.toggle("is-speaking", active);
      if (btn) {
        btn.classList.toggle("is-playing", active);
        btn.textContent = active ? stopText : idleLabel;
      }
    };

    const wasMuted = this.audio.vegaMuted;
    if (wasMuted) this.audio.vegaMuted = false;

    this.audio.playVegaClip(audioUrl, spokenText, this.lang, {
      onStart: () => {
        if (this._activeVegaChannel && this._activeVegaChannel.audioUrl === audioUrl) {
          setPlaying(true);
        }
      },
      onEnd: () => {
        setPlaying(false);
        if (this._activeVegaChannel && this._activeVegaChannel.audioUrl === audioUrl) {
          this._activeVegaChannel = null;
        }
        if (onComplete) onComplete();
      }
    });
  }

  showVega3DComms(key) {
    if (!this.is3DActive || this.isStoryOpen || this._isLoading3D) return;
    if (key === "halfway" && this._vegaShownComms.has("halfway")) return;
    const toast = document.getElementById("vegaCommsToast");
    const chipEl = document.getElementById("vegaCommsChip");
    const textEl = document.getElementById("vegaCommsText");
    const hearBtn = document.getElementById("vegaCommsHearBtn");
    if (!toast || !textEl) return;

    const langKey = this.lang === "pt" ? "pt" : "en";
    const vegaLoc = VEGA_JOURNEY[langKey];
    const msg = vegaLoc.comms3D[key];
    if (!msg) return;

    if (key === "halfway") {
      this._vegaShownComms.add("halfway");
    }
    this._currentCommsKey = key;
    if (chipEl) chipEl.textContent = vegaLoc.commsChip;
    textEl.textContent = msg;
    if (hearBtn) {
      hearBtn.classList.remove("is-playing");
      hearBtn.textContent = vegaLoc.commsHearBtn;
    }

    toast.classList.add("hidden");
    void toast.offsetWidth;
    toast.classList.remove("hidden");
    this.audio.playPing(760, 0.06);
    clearTimeout(this._vegaCommsTimer);
    this._vegaCommsTimer = setTimeout(() => {
      this.hideVega3DComms();
    }, 7500);
  }

  hideVega3DComms() {
    clearTimeout(this._vegaCommsTimer);
    if (this._activeVegaChannel && this._activeVegaChannel.surface === "comms") {
      this.stopVegaChannel();
    }
    this._currentCommsKey = null;
    const toast = document.getElementById("vegaCommsToast");
    if (toast) toast.classList.add("hidden");
  }

  showStoryBridge(artifactId) {
    const toast = document.getElementById("storyBridgeToast");
    const chipEl = document.getElementById("storyBridgeChip");
    const textEl = document.getElementById("storyBridgeText");
    const hearBtn = document.getElementById("storyBridgeHearBtn");
    if (!toast || !textEl || !this.isStoryOpen) return;

    const langKey = this.lang === "pt" ? "pt" : "en";
    const vegaLoc = VEGA_JOURNEY[langKey];
    const text = vegaLoc.chapterBridges[artifactId];
    if (!text) return;

    this._currentBridgeId = artifactId;
    if (chipEl) chipEl.textContent = vegaLoc.bridgeChip;
    textEl.textContent = text;
    if (hearBtn) {
      hearBtn.classList.remove("is-playing");
      hearBtn.textContent = vegaLoc.commsHearBtn;
    }

    toast.classList.add("hidden");
    void toast.offsetWidth;
    toast.classList.remove("hidden");
    clearTimeout(this._storyBridgeTimer);
    this._storyBridgeTimer = setTimeout(() => {
      this.hideStoryBridge();
    }, 8000);
  }

  hideStoryBridge() {
    clearTimeout(this._storyBridgeTimer);
    if (this._activeVegaChannel && this._activeVegaChannel.surface === "bridge") {
      this.stopVegaChannel();
    }
    this._currentBridgeId = null;
    const toast = document.getElementById("storyBridgeToast");
    if (toast) toast.classList.add("hidden");
  }

  openMissionLetter() {
    this._hasSeenMissionLetter = true;
    this.hideVega3DComms();
    const isPt = this.lang === "pt";
    const langKey = isPt ? "pt" : "en";
    const age = this.ageProfile || "adult";
    const visited = this.visitedStations.size;
    const vegaLoc = VEGA_JOURNEY[langKey];
    const letter = vegaLoc.missionLetter[age] || vegaLoc.missionLetter.adult;

    document.getElementById("letterStamp").textContent = isPt
      ? "DIÁRIO DE BORDO • MISSÃO APOLLO"
      : "MISSION LOGBOOK • APOLLO";
    const badgeEl = document.getElementById("letterVegaBadge");
    if (badgeEl) badgeEl.textContent = vegaLoc.guideBadge;
    const voiceBtnEl = document.getElementById("letterVegaVoiceBtn");
    const idleBtnLabel = isPt ? "Ouvir Vega" : "Hear Vega";
    if (voiceBtnEl) {
      voiceBtnEl.textContent = idleBtnLabel;
      voiceBtnEl.classList.remove("is-playing");
    }

    document.getElementById("letterTitle").textContent = letter.title;
    document.getElementById("letterBody").innerHTML =
      letter.paragraphs.map((p) => `<p>${p}</p>`).join("") +
      `<p class="letter-progress-copy">${
        isPt
          ? `Progresso atual: <strong>${visited}/${STATION_ORDER.length} histórias</strong> descobertas.`
          : `Current progress: <strong>${visited}/${STATION_ORDER.length} stories</strong> discovered.`
      }</p>`;
    document.getElementById("letterSignature").textContent = `— ${letter.signature}`;
    document.getElementById("startExpeditionBtn").textContent = isPt
      ? "Iniciar Viagem →"
      : "Begin Journey →";

    const fill = document.getElementById("letterProgressFill");
    fill.style.width = "0%";
    document.getElementById("missionLetterModal").classList.remove("hidden");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = "100%";
      });
    });

    if (!this.audio.vegaMuted) {
      const spoken = `${letter.title} ${letter.paragraphs.join(" ")}`;
      this.playVegaChannelClip(
        "letter",
        `assets/audio/vega-${langKey}-${age}-letter.mp3`,
        spoken,
        "#letterVegaAvatarRing",
        "#letterVegaVoiceBtn",
        idleBtnLabel
      );
    }
  }

  closeMissionLetter() {
    this.stopVegaChannel();
    document.getElementById("missionLetterModal").classList.add("hidden");
    this.audio.playPing(880, 0.08);
    if (this.is3DActive) {
      setTimeout(() => {
        if (this.is3DActive && !this.isStoryOpen) {
          this.showVega3DComms(this.currentArtifact.id);
        }
      }, 450);
    }
  }

  // ==========================================================================
  // FRIENDLY ASTRONAUT FINAL QUIZ (COMANDANTE VEGA)
  // ==========================================================================
  openAstronautQuizModal(forceRestart = false) {
    this.hideVega3DComms();
    this.stopVegaChannel();
    this.audio.stopSpeech(false);
    if (forceRestart || this.quizState.phase === "summary" || !this.quizState.completed) {
      this.quizState = {
        phase: "welcome",
        questionIdx: 0,
        score: 0,
        answeredIdx: null,
        completed: this.quizState.completed,
        rankTitle: this.quizState.rankTitle
      };
    }
    document.getElementById("astronautQuizModal").classList.remove("hidden");
    this.audio.playQuindarTone(true);
    this.renderAstronautQuiz();
  }

  closeAstronautQuizModal() {
    this.audio.stopVegaClip();
    this.updateVegaSpeakingUI(false);
    document.getElementById("astronautQuizModal").classList.add("hidden");
  }

  updateVegaSpeakingUI(isSpeaking) {
    const ringEl = document.getElementById("quizAvatarRing");
    const waveEl = document.getElementById("quizVoiceWave");
    if (ringEl) ringEl.classList.toggle("is-speaking", Boolean(isSpeaking));
    if (waveEl) waveEl.classList.toggle("playing", Boolean(isSpeaking));
  }

  updateVegaVoiceControlsUI() {
    const isPt = this.lang === "pt";
    const replayText = document.getElementById("quizReplayVoiceText");
    const toggleBtn = document.getElementById("quizVoiceToggleBtn");
    const toggleText = document.getElementById("quizVoiceToggleText");
    if (replayText) {
      replayText.textContent = isPt ? "Ouvir Vega" : "Hear Vega";
    }
    if (toggleBtn && toggleText) {
      toggleBtn.classList.toggle("is-muted", Boolean(this.audio.vegaMuted));
      toggleText.textContent = this.audio.vegaMuted
        ? isPt
          ? "🔇 Sem voz"
          : "🔇 Muted"
        : isPt
        ? "🔊 Voz ON"
        : "🔊 Voice ON";
    }
  }

  speakVegaClip(audioUrl, spokenText) {
    this._lastVegaVoice = { audioUrl, spokenText };
    this.updateVegaVoiceControlsUI();
    this.audio.playVegaClip(audioUrl, spokenText, this.lang, {
      onStart: () => this.updateVegaSpeakingUI(true),
      onEnd: () => this.updateVegaSpeakingUI(false)
    });
  }

  handleQuizAnswer(pickedIdx) {
    if (this.quizState.phase !== "question" || this.quizState.answeredIdx !== null) return;
    const isPt = this.lang === "pt";
    const quiz = MISSION_QUIZ[isPt ? "pt" : "en"];
    const age = this.ageProfile || "adult";
    const qData = quiz.questions[this.quizState.questionIdx];
    const q = qData[age] || qData.adult;

    this.quizState.answeredIdx = pickedIdx;
    const isCorrect = pickedIdx === q.correctIndex;
    if (isCorrect) {
      this.quizState.score += 1;
      this.audio.playPing(660, 0.14);
    } else {
      this.audio.playPing(390, 0.14);
    }
    this.renderAstronautQuiz();
  }

  renderAstronautQuiz() {
    const isPt = this.lang === "pt";
    const age = this.ageProfile || "adult";
    const quiz = MISSION_QUIZ[isPt ? "pt" : "en"];
    const total = quiz.questions.length;

    const ringEl = document.getElementById("quizAvatarRing");
    const badgeEl = document.getElementById("quizAvatarBadge");
    const roleEl = document.getElementById("quizGuideRole");
    const nameEl = document.getElementById("quizGuideName");
    const chipEl = document.getElementById("quizArtifactChip");
    const dotsEl = document.getElementById("quizStepDots");
    const feedbackEl = document.getElementById("quizFeedbackPill");
    const titleEl = document.getElementById("quizGreetingTitle");
    const textEl = document.getElementById("quizSpeechText");
    const optionsEl = document.getElementById("quizOptionsList");
    const actionsEl = document.getElementById("quizActionsRow");

    roleEl.textContent = quiz.guideRole;
    nameEl.textContent = quiz.guideName;
    this.updateVegaVoiceControlsUI();

    dotsEl.innerHTML = quiz.questions
      .map((_, i) => {
        let cls = "quiz-step-dot";
        if (this.quizState.phase === "question") {
          if (i < this.quizState.questionIdx) cls += " done";
          else if (i === this.quizState.questionIdx) cls += " active";
        } else if (this.quizState.phase === "summary") {
          cls += " done";
        }
        return `<span class="${cls}">0${i + 1}</span>`;
      })
      .join("");

    ringEl.classList.remove("is-greeting", "is-asking", "is-correct", "is-helping", "is-celebrating");
    const langKey = isPt ? "pt" : "en";

    if (this.quizState.phase === "welcome") {
      const g = quiz.greeting[age] || quiz.greeting.adult;
      ringEl.classList.add("is-greeting");
      badgeEl.textContent = "✦";
      chipEl.textContent = isPt ? "MENSAGEM DE BOAS-VINDAS" : "MISSION GUIDE GREETING";
      feedbackEl.classList.add("hidden");
      titleEl.textContent = g.title;
      textEl.textContent = g.message;
      optionsEl.classList.add("hidden");
      optionsEl.innerHTML = "";
      this.speakVegaClip(`assets/audio/vega-${langKey}-${age}-greeting.mp3`, `${g.title} ${g.message}`);

      actionsEl.innerHTML = `
        <button class="btn-quiz-skip" id="quizSkipBtn" type="button">${g.skipBtn}</button>
        <button class="btn-quiz-primary" id="quizStartBtn" type="button">${g.startBtn}</button>
      `;
      document.getElementById("quizStartBtn").addEventListener("click", () => {
        this.audio.playPing(580, 0.08);
        this.quizState.phase = "question";
        this.quizState.questionIdx = 0;
        this.quizState.score = 0;
        this.quizState.answeredIdx = null;
        this.renderAstronautQuiz();
      });
      document.getElementById("quizSkipBtn").addEventListener("click", () => {
        this.closeAstronautQuizModal();
        this.openCertificateModal();
      });
      return;
    }

    if (this.quizState.phase === "question") {
      const qData = quiz.questions[this.quizState.questionIdx];
      const q = qData[age] || qData.adult;
      const art = ARTIFACTS.find((a) => a.id === qData.artifactId);
      const answered = this.quizState.answeredIdx !== null;
      const isCorrect = answered && this.quizState.answeredIdx === q.correctIndex;

      chipEl.textContent = art ? `${art.mission.toUpperCase()} • ${art.id.toUpperCase()}` : "APOLLO";
      titleEl.textContent = answered
        ? q.question
        : `${quiz.progressPrefix} 0${this.quizState.questionIdx + 1} / 0${total}`;

      if (!answered) {
        ringEl.classList.add("is-asking");
        badgeEl.textContent = "?";
        feedbackEl.classList.add("hidden");
        feedbackEl.classList.remove("is-correct", "is-helping");
        textEl.textContent = q.question;
        this.speakVegaClip(`assets/audio/vega-${langKey}-${age}-q${this.quizState.questionIdx}.mp3`, q.question);
      } else if (isCorrect) {
        ringEl.classList.add("is-correct");
        badgeEl.textContent = "✓";
        feedbackEl.textContent = quiz.correctChip;
        feedbackEl.classList.remove("hidden", "is-helping");
        feedbackEl.classList.add("is-correct");
        textEl.textContent = q.onCorrect;
        this.speakVegaClip(`assets/audio/vega-${langKey}-${age}-q${this.quizState.questionIdx}-ok.mp3`, q.onCorrect);
      } else {
        ringEl.classList.add("is-helping");
        badgeEl.textContent = "↺";
        feedbackEl.textContent = quiz.helpingChip;
        feedbackEl.classList.remove("hidden", "is-correct");
        feedbackEl.classList.add("is-helping");
        textEl.textContent = q.onWrong;
        this.speakVegaClip(`assets/audio/vega-${langKey}-${age}-q${this.quizState.questionIdx}-help.mp3`, q.onWrong);
      }

      const letters = ["A", "B", "C"];
      optionsEl.classList.remove("hidden");
      optionsEl.innerHTML = q.options
        .map((opt, idx) => {
          let cls = "quiz-option-btn";
          if (answered) {
            if (idx === q.correctIndex) cls += " is-correct";
            else if (idx === this.quizState.answeredIdx) cls += " is-wrong";
            else cls += " is-dimmed";
          }
          return `
            <button class="${cls}" data-quiz-opt="${idx}" type="button" ${answered ? "disabled" : ""}>
              <span class="quiz-opt-letter">${letters[idx] || idx + 1}</span>
              <span class="quiz-opt-copy">${opt}</span>
            </button>
          `;
        })
        .join("");

      if (!answered) {
        optionsEl.querySelectorAll("[data-quiz-opt]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-quiz-opt"), 10);
            this.handleQuizAnswer(idx);
          });
        });
        actionsEl.innerHTML = `
          <button class="btn-quiz-skip" id="quizSkipBtn" type="button">${quiz.greeting[age]?.skipBtn || quiz.greeting.adult.skipBtn}</button>
        `;
        document.getElementById("quizSkipBtn").addEventListener("click", () => {
          this.closeAstronautQuizModal();
          this.openCertificateModal();
        });
      } else {
        const isLast = this.quizState.questionIdx >= total - 1;
        actionsEl.innerHTML = `
          <button class="btn-quiz-skip" id="quizSkipBtn" type="button">${quiz.greeting[age]?.skipBtn || quiz.greeting.adult.skipBtn}</button>
          <button class="btn-quiz-primary" id="quizNextBtn" type="button">${isLast ? quiz.finishBtn : quiz.nextBtn}</button>
        `;
        document.getElementById("quizNextBtn").addEventListener("click", () => {
          this.audio.playPing(620, 0.08);
          if (isLast) {
            this.quizState.phase = "summary";
          } else {
            this.quizState.questionIdx += 1;
            this.quizState.answeredIdx = null;
          }
          this.renderAstronautQuiz();
        });
        document.getElementById("quizSkipBtn").addEventListener("click", () => {
          this.closeAstronautQuizModal();
          this.openCertificateModal();
        });
      }
      return;
    }

    // Summary phase
    const tierKey =
      this.quizState.score >= total
        ? "perfect"
        : this.quizState.score >= 2
        ? "great"
        : "curious";
    const tier = quiz.summary[tierKey];
    this.quizState.completed = true;
    this.quizState.rankTitle = tier.rank;

    ringEl.classList.add("is-celebrating");
    badgeEl.textContent = "★";
    chipEl.textContent = `${this.quizState.score}/${total} • ${tier.rank.toUpperCase()}`;
    feedbackEl.textContent = isPt
      ? `★ MISSÃO CONCLUÍDA • ${this.quizState.score} DE ${total}`
      : `★ MISSION COMPLETE • ${this.quizState.score} OF ${total}`;
    feedbackEl.classList.remove("hidden", "is-helping");
    feedbackEl.classList.add("is-correct");
    titleEl.textContent = tier.title;
    textEl.textContent = tier.message;
    optionsEl.classList.add("hidden");
    optionsEl.innerHTML = "";
    this.audio.playQuindarTone(true);
    this.speakVegaClip(`assets/audio/vega-${langKey}-sum-${tierKey}.mp3`, `${tier.title} ${tier.message}`);

    actionsEl.innerHTML = `
      <button class="btn-quiz-secondary" id="quizRetryBtn" type="button">↺ ${quiz.retryBtn}</button>
      <button class="btn-quiz-primary" id="quizGoCertBtn" type="button">${quiz.certBtn}</button>
    `;
    document.getElementById("quizRetryBtn").addEventListener("click", () => {
      this.audio.playPing(540, 0.08);
      this.quizState.phase = "question";
      this.quizState.questionIdx = 0;
      this.quizState.score = 0;
      this.quizState.answeredIdx = null;
      this.renderAstronautQuiz();
    });
    document.getElementById("quizGoCertBtn").addEventListener("click", () => {
      this.closeAstronautQuizModal();
      this.openCertificateModal();
    });
  }

  openCertificateModal() {
    this.hideVega3DComms();
    this.stopVegaChannel();
    const isPt = this.lang === "pt";
    const langKey = isPt ? "pt" : "en";
    const age = this.ageProfile || "adult";
    const vegaLoc = VEGA_JOURNEY[langKey];

    const copy = {
      pt: {
        child: {
          kicker: "MISSÃO CUMPRIDA • 4/4 HISTÓRIAS DESCOBERTAS",
          title: "Parabéns, pequeno explorador!",
          sub: "Você conheceu todas as máquinas mágicas deixadas na Lua! Escreva seu nome abaixo para personalizar e baixar seu certificado de aventura.",
          placeholder: "Escreva seu nome aqui...",
          btn: "Baixar Meu Certificado (PNG)",
          defaultName: "Pequeno Explorador Lunar"
        },
        teen: {
          kicker: "EXPEDIÇÃO CONCLUÍDA • 4/4 MONUMENTOS",
          title: "Parabéns, cadete espacial!",
          sub: "Você desvendou a engenharia e a ciência de todos os equipamentos da Apollo. Digite seu nome para emitir e baixar sua credencial lunar.",
          placeholder: "Seu nome completo...",
          btn: "Baixar Certificado (PNG)",
          defaultName: "Cadete Espacial"
        },
        adult: {
          kicker: "ARQUIVO COMPLETO • 4/4 MEMÓRIAS LUNARES",
          title: "Parabéns, curador lunar!",
          sub: "Você percorreu todos os relatos históricos da Apollo na superfície lunar. Insira seu nome abaixo para personalizar e baixar seu certificado oficial.",
          placeholder: "Seu nome completo...",
          btn: "Baixar Certificado (PNG)",
          defaultName: "Curador Lunar"
        }
      },
      en: {
        child: {
          kicker: "MISSION COMPLETE • 4/4 STORIES DISCOVERED",
          title: "Congratulations, little explorer!",
          sub: "You met every amazing machine left behind on the Moon! Type your name below to personalize and download your adventure certificate.",
          placeholder: "Write your name here...",
          btn: "Download My Certificate (PNG)",
          defaultName: "Little Lunar Explorer"
        },
        teen: {
          kicker: "EXPEDITION COMPLETE • 4/4 MONUMENTS",
          title: "Congratulations, space cadet!",
          sub: "You uncovered the engineering and science behind all four Apollo monuments. Enter your name to generate and download your lunar credential.",
          placeholder: "Your full name...",
          btn: "Download Certificate (PNG)",
          defaultName: "Space Cadet"
        },
        adult: {
          kicker: "ARCHIVE COMPLETE • 4/4 LUNAR MEMORIES",
          title: "Congratulations, lunar curator!",
          sub: "You have explored all historical Apollo accounts on the lunar surface. Enter your name below to personalize and download your official certificate.",
          placeholder: "Your full name...",
          btn: "Download Certificate (PNG)",
          defaultName: "Lunar Curator"
        }
      }
    };

    const c = copy[isPt ? "pt" : "en"][age] || copy[isPt ? "pt" : "en"].adult;
    this._certDefaultName = c.defaultName;

    document.getElementById("certKicker").textContent = c.kicker;
    document.getElementById("certModalTitle").textContent = c.title;
    document.getElementById("certModalSub").textContent = c.sub;
    document.getElementById("certNameInput").placeholder = c.placeholder;
    document.getElementById("downloadCertBtn").textContent = c.btn;
    const replayQuizBtn = document.getElementById("openQuizFromCertBtn");
    if (replayQuizBtn) {
      replayQuizBtn.textContent = this.quizState.completed
        ? isPt
          ? "↺ Refazer Quiz"
          : "↺ Retake Quiz"
        : isPt
        ? "✦ Quiz com Vega"
        : "✦ Quiz with Vega";
    }

    const certVegaChip = document.getElementById("certVegaChip");
    const certVegaSpeech = document.getElementById("certVegaSpeech");
    const certVegaBtn = document.getElementById("certVegaVoiceBtn");
    const deliveryText = vegaLoc.certificateDelivery[age] || vegaLoc.certificateDelivery.adult;
    const certBtnIdle = isPt ? "Ouvir Vega" : "Hear Vega";
    if (certVegaChip) certVegaChip.textContent = vegaLoc.guideBadge;
    if (certVegaSpeech) certVegaSpeech.textContent = deliveryText;
    if (certVegaBtn) {
      certVegaBtn.textContent = certBtnIdle;
      certVegaBtn.classList.remove("is-playing");
    }

    document.getElementById("certificateModal").classList.remove("hidden");
    this.audio.playQuindarTone(true);
    this.renderCertificateCanvas();

    if (!this.audio.vegaMuted) {
      this.playVegaChannelClip(
        "cert",
        `assets/audio/vega-${langKey}-${age}-cert.mp3`,
        deliveryText,
        "#certVegaAvatarRing",
        "#certVegaVoiceBtn",
        certBtnIdle
      );
    }
  }

  closeCertificateModal() {
    this.stopVegaChannel();
    document.getElementById("certificateModal").classList.add("hidden");
  }

  renderCertificateCanvas() {
    const canvas = document.getElementById("certificateCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const isPt = this.lang === "pt";
    const rawName = (document.getElementById("certNameInput").value || "").trim();
    const explorerName =
      rawName ||
      this._certDefaultName ||
      (isPt ? "Pequeno Explorador Lunar" : "Young Lunar Explorer");

    // Deep space background
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 80, w * 0.5, h * 0.5, w * 0.72);
    bgGrad.addColorStop(0, "#0f1c38");
    bgGrad.addColorStop(0.55, "#060b18");
    bgGrad.addColorStop(1, "#02040a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (let i = 0; i < 90; i++) {
      const sx = ((i * 197 + 43) % w);
      const sy = ((i * 313 + 71) % h);
      const sr = (i % 3 === 0) ? 1.6 : 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer & inner frames
    ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, w - 72, h - 72);

    ctx.strokeStyle = "rgba(96, 165, 250, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(52, 52, w - 104, h - 104);

    // Orbital arc motif at top
    ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, 130, 34, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath();
    ctx.arc(w / 2 + 26, 106, 4, 0, Math.PI * 2);
    ctx.fill();

    // Kicker
    ctx.textAlign = "center";
    ctx.fillStyle = "#60a5fa";
    ctx.font = "600 20px monospace";
    ctx.fillText(
      "MUSEUM OF LOST SPACE TECHNOLOGY  •  NASA SPACE APPS",
      w / 2,
      178
    );

    // Main title
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic 58px Georgia, serif";
    ctx.fillText(
      isPt ? "Certificado de Explorador Lunar" : "Lunar Explorer Certificate",
      w / 2,
      268
    );

    // Subtitle
    ctx.fillStyle = "#94a3b8";
    ctx.font = "24px sans-serif";
    ctx.fillText(
      isPt ? "Concedido com honra a" : "Proudly awarded to",
      w / 2,
      348
    );

    // Explorer Name
    ctx.fillStyle = "#fbbf24";
    ctx.font = "italic bold 64px Georgia, serif";
    ctx.fillText(explorerName, w / 2, 438);

    // Divider under name
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, 466);
    ctx.lineTo(w * 0.75, 466);
    ctx.stroke();

    if (this.quizState.completed && this.quizState.rankTitle) {
      ctx.fillStyle = "#38bdf8";
      ctx.font = "600 18px monospace";
      const honorLabel = isPt
        ? `DISTINÇÃO DE BORDO: ${this.quizState.rankTitle.toUpperCase()}`
        : `MISSION DISTINCTION: ${this.quizState.rankTitle.toUpperCase()}`;
      ctx.fillText(honorLabel, w / 2, 502);
    }

    // Completion body
    ctx.fillStyle = "#dbe4f0";
    ctx.font = "25px Georgia, serif";
    const line1 = isPt
      ? "por completar a expedição lunar e conhecer as histórias em primeira pessoa"
      : "for completing the lunar expedition and discovering the first-person stories";
    const line2 = isPt
      ? "dos quatro monumentos históricos da NASA deixados na Lua:"
      : "of the four historic NASA monuments left on the Moon:";
    ctx.fillText(line1, w / 2, 540);
    ctx.fillText(line2, w / 2, 580);

    // Artifacts list
    ctx.fillStyle = "#93c5fd";
    ctx.font = "600 21px monospace";
    ctx.fillText(
      "LRRR (APOLLO 11)  •  PSE (APOLLO 11)  •  EAGLE (APOLLO 11)  •  LRV (APOLLO 15–17)",
      w / 2,
      642
    );

    // Collectible Stamps Row (4 Selinhos)
    const stampStartX = w / 2 - 330;
    const stampStep = 220;
    STATION_ORDER.forEach((id, idx) => {
      const stData = ARTIFACT_INTERACTIONS[id];
      const earned = this.unlockedStamps.has(id);
      const sx = stampStartX + idx * stampStep;
      const sy = 716;

      ctx.save();
      ctx.strokeStyle = earned ? "rgba(251, 191, 36, 0.85)" : "rgba(148, 163, 184, 0.25)";
      ctx.fillStyle = earned ? "rgba(251, 191, 36, 0.12)" : "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(sx - 92, sy - 26, 184, 48, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = earned ? "#fbbf24" : "rgba(148, 163, 184, 0.45)";
      ctx.font = "600 15px monospace";
      ctx.fillText(`${stData.badge.icon}  ${stData.badge[this.lang].title.toUpperCase()}`, sx, sy + 4);
      ctx.restore();
    });

    // Commander Vega official signature + Date footer
    ctx.fillStyle = "#bae6fd";
    ctx.font = "600 20px Georgia, serif";
    ctx.fillText(
      isPt
        ? "✦  Assinado: Comandante Vega — Guia Espacial & Curadoria Lunar  ✦"
        : "✦  Signed: Commander Vega — Expedition Space Guide & Curator  ✦",
      w / 2,
      786
    );

    const today = new Date().toLocaleDateString(isPt ? "pt-BR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "19px monospace";
    ctx.fillText(
      (isPt ? "EMITIDO EM " : "ISSUED ON ") + today.toUpperCase(),
      w / 2,
      826
    );

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "italic 23px Georgia, serif";
    ctx.fillText(
      isPt ? "Abandonados, mas nunca esquecidos." : "Abandoned, but never forgotten.",
      w / 2,
      874
    );
  }

  downloadCertificate() {
    this.renderCertificateCanvas();
    const canvas = document.getElementById("certificateCanvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download =
      this.lang === "pt"
        ? "certificado-explorador-lunar.png"
        : "lunar-explorer-certificate.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    this.audio.playPing(960, 0.12);
    setTimeout(() => {
      this.closeCertificateModal();
      this.openThankYouModal();
    }, 360);
  }

  openThankYouModal() {
    const isPt = this.lang === "pt";
    const modal = document.getElementById("thankYouModal");
    if (!modal) return;

    const rawName = (document.getElementById("certNameInput")?.value || "").trim();
    const explorerRef = rawName || (isPt ? "explorador lunar" : "lunar explorer");

    const kickerEl = document.getElementById("thankYouKicker");
    const titleEl = document.getElementById("thankYouTitle");
    const msgEl = document.getElementById("thankYouMessage");
    const ghTitleEl = document.getElementById("thankYouGithubTitle");
    const backSiteBtn = document.getElementById("thankYouBackSiteBtn");
    const back3DBtn = document.getElementById("thankYouBack3DBtn");

    if (kickerEl) {
      kickerEl.textContent = isPt
        ? "CERTIFICADO BAIXADO • MISSÃO CONCLUÍDA"
        : "CERTIFICATE DOWNLOADED • MISSION COMPLETE";
    }
    if (titleEl) {
      titleEl.textContent = isPt
        ? `Obrigado por viajar pela Lua conosco, ${explorerRef}!`
        : `Thank you for traveling to the Moon with us, ${explorerRef}!`;
    }
    if (msgEl) {
      msgEl.textContent = isPt
        ? "Seu Certificado Oficial foi salvo no seu dispositivo. Esperamos que tenha gostado de descobrir as histórias da Apollo no Museum of Lost Space Technology!"
        : "Your Official Certificate has been saved to your device. Thank you for exploring the Apollo stories at the Museum of Lost Space Technology!";
    }
    if (ghTitleEl) {
      ghTitleEl.textContent = isPt
        ? "Conheça e apoie o projeto no GitHub"
        : "Explore the project on GitHub";
    }
    if (backSiteBtn) {
      backSiteBtn.textContent = isPt ? "← Voltar ao Site" : "← Back to Site";
    }
    if (back3DBtn) {
      back3DBtn.textContent = isPt ? "Voltar ao 3D →" : "Return to 3D →";
    }

    modal.classList.remove("hidden");
    this.audio.playQuindarTone(true);
  }

  closeThankYouModal() {
    const modal = document.getElementById("thankYouModal");
    if (modal) modal.classList.add("hidden");
  }

  updateAmbientUI() {
    const btn = document.getElementById("ambientSoundBtn");
    const txt = document.getElementById("ambientSoundText");
    if (!btn || !txt) return;
    const isOn = this.audio.ambientRunning;
    btn.classList.toggle("active", isOn);
    txt.textContent =
      this.lang === "pt"
        ? isOn
          ? "Som ON"
          : "Som OFF"
        : isOn
        ? "Sound ON"
        : "Sound OFF";
  }

  renderEditorialSite() {
    const isPt = this.lang === "pt";
    const t = this.t;

    document.getElementById("navBrandTitle").textContent = "Museum of Lost Space Technology";
    document.getElementById("navLinkStories").textContent = isPt ? "Histórias" : "Stories";
    document.getElementById("navLinkArtemis").textContent = isPt ? "Legado Artemis" : "Artemis Legacy";
    document.getElementById("navAgeChild").textContent = isPt ? "Criança" : "Child";
    document.getElementById("navAgeTeen").textContent = isPt ? "Adolescente" : "Teen";
    document.getElementById("navAgeAdult").textContent = isPt ? "Adulto" : "Adult";
    document.getElementById("open3DModeBtn").textContent = isPt ? "Explorar em 3D" : "Explore in 3D";
    const settingsLabel = isPt ? "Perfil e Idioma" : "Profile & Language";
    ["reopenSettingsBtn", "reopenSettings3DBtn"].forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.setAttribute("title", settingsLabel);
        btn.setAttribute("aria-label", settingsLabel);
      }
    });

    document.getElementById("heroTeleTop").textContent = isPt
      ? "384.400 KM  •  1/6 GRAVIDADE"
      : "384,400 KM  •  1/6 GRAVITY";
    document.getElementById("heroTeleBottom").textContent = isPt
      ? "Apollo 11–17  |  1969 — Hoje  |  Mare Tranquillitatis"
      : "Apollo 11–17  |  1969 — Today  |  Mare Tranquillitatis";
    document.getElementById("heroTitle").innerHTML = isPt
      ? "Descubra os Segredos<br />Deixados na Lua"
      : "Discover the Secrets<br />Left on the Moon";
    document.getElementById("heroLead").textContent = isPt
      ? "Desde 1969, máquinas silenciosas permaneceram na superfície lunar. Ouça suas histórias contadas em primeira pessoa e entenda a ciência que continua viva até hoje."
      : "Since 1969, silent machines have remained on the lunar surface. Hear their stories told in the first person and explore the science still alive today.";
    document.getElementById("heroStartBtn").textContent = isPt
      ? "Ler & Ouvir Histórias"
      : "Read & Hear Stories";
    document.getElementById("heroOpen3DBtn").textContent = isPt
      ? "Abrir Visualização 3D →"
      : "Open 3D View →";

    document.getElementById("storiesKicker").textContent = isPt
      ? "04 MONUMENTOS LUNARES"
      : "04 LUNAR MONUMENTS";

    const progressTextEl = document.getElementById("discoveryProgressText");
    if (progressTextEl) {
      progressTextEl.textContent = isPt
        ? `Descobertas na expedição: ${this.visitedStations.size} de ${STATION_ORDER.length}`
        : `Expedition discoveries: ${this.visitedStations.size} of ${STATION_ORDER.length}`;
    }

    const learningTakeaways = {
      lrrr: {
        pt: {
          child: "Medindo quanto tempo um raio de luz leva para ir e voltar, descobrimos que a Lua se afasta 3,8 cm da Terra todo ano!",
          teen: "Usando 100 prismas de quartzo e a velocidade da luz (c·Δt/2), o LRRR mede a distância Terra-Lua com precisão milimétrica até hoje.",
          adult: "Com 100 prismas de sílica fundida 100% passivos, o LRRR revelou a recessão lunar de 3,8 cm/ano, o núcleo fluido da Lua e testes da Relatividade Geral."
        },
        en: {
          child: "By timing how long a laser beam takes to bounce back, we learned the Moon drifts 3.8 cm farther from Earth every year!",
          teen: "Using 100 quartz prisms and the speed of light (c·Δt/2), LRRR measures Earth-Moon distance to millimeter precision even today.",
          adult: "With 100 passive fused-silica corner cubes, LRRR revealed the Moon's 3.8 cm/year recession, fluid core, and General Relativity tests."
        }
      },
      pse: {
        pt: {
          child: "A Lua também treme! Aquecido por plutônio, o sismômetro ouviu centenas de 'lunamotos' e impactos de meteoros.",
          teen: "Alimentado por painéis solares de dia e aquecedores de Plutônio-238 à noite (-54 °C vs -170 °C), registrou de 100 a 200 impactos e tremores lunares.",
          adult: "Primeira grande aplicação de energia nuclear em missão tripulada da NASA: 4 sismômetros em 3 eixos que inauguraram a sismologia lunar."
        },
        en: {
          child: "The Moon shakes too! Kept warm by plutonium, the seismometer heard hundreds of 'moonquakes' and meteorite hits.",
          teen: "Solar-powered by day and heated by Plutonium-238 at night (-54 °C vs -170 °C), it recorded 100–200 impacts and moonquakes.",
          adult: "NASA's first major crewed-mission nuclear heater kept 4 three-axis seismometers alive, launching lunar seismology."
        }
      },
      eagle: {
        pt: {
          child: "Na Lua tudo pesa 6 vezes menos! A parte dourada do Eagle ficou lá para sempre como um memorial de paz.",
          teen: "Após 12 minutos de descida guiada, o estágio inferior serviu de plataforma de lançamento e guarda a placa de aço inox da humanidade.",
          adult: "Construído com precisão extrema para o retorno orbital, o estágio de descida tornou-se um monumento silencioso em Mare Tranquillitatis."
        },
        en: {
          child: "On the Moon everything weighs 6 times less! Eagle's golden lower stage stayed behind forever as a monument of peace.",
          teen: "After a 12-minute powered descent, the lower stage acted as a launchpad and still holds humanity's stainless-steel plaque.",
          adult: "Engineered for razor-thin orbital precision, the descent stage remains a silent monument in Mare Tranquillitatis."
        }
      },
      lrv: {
        pt: {
          child: "Pesava só 35 kg na Lua e suas rodas eram feitas de arame de piano para não furar nunca na poeira!",
          teen: "Sem GPS nem bússola, usava um giroscópio direcional ('Fio de Ariadne') e rodou 90,5 km entre as missões Apollo 15, 16 e 17.",
          adult: "Um 'origami de alumínio' de 210 kg (35 kg lunares) com 4 motores nas rodas, câmera controlada de Houston e zonas de preservação de 225 m."
        },
        en: {
          child: "It weighed just 35 kg on the Moon, and its wheels were woven from piano wire so they could never go flat!",
          teen: "With no GPS or compass, it used a directional gyroscope ('Ariadne's Thread') and drove 90.5 km across Apollo 15, 16, and 17.",
          adult: "A 210 kg (35 kg lunar) 'aluminum origami' with 4 hub motors, a camera steered from Houston, and 225 m NASA exclusion zones."
        }
      }
    };
    document.getElementById("storiesHeading").textContent = isPt
      ? "Abandonados, mas nunca esquecidos."
      : "Abandoned, but never forgotten.";
    const subheadingEl = document.getElementById("storiesSubheading");
    if (subheadingEl) {
      subheadingEl.textContent = isPt
        ? "Escolha a faixa etária no topo da página para adaptar o tom de cada narrativa."
        : "Choose an age group at the top to adapt each narrative's voice.";
    }

    document.getElementById("artemisKicker").textContent = isPt
      ? "DO PASSADO APOLLO AO FUTURO ARTEMIS"
      : "FROM APOLLO'S PAST TO ARTEMIS'S FUTURE";
    document.getElementById("artemisHeading").textContent = isPt
      ? "O legado que guia o retorno à Lua."
      : "The legacy guiding humanity's return to the Moon.";
    document.getElementById("artemisBody").textContent = isPt
      ? "Cada espelho, sismômetro, módulo de descida e jipe lunar deixou pistas essenciais para o Programa Artemis. Hoje, esses locais são protegidos como patrimônio histórico da exploração espacial."
      : "Every mirror, seismometer, descent stage, and lunar rover left vital clues for the Artemis Program. Today, these landing sites are protected as historic monuments of space exploration.";
    document.getElementById("artemisOpen3DBtn").textContent = isPt
      ? "Explorar Equipamentos em 3D →"
      : "Explore Equipment in 3D →";
    document.getElementById("exit3DLabel").textContent = isPt ? "Voltar ao Site" : "Back to Site";

    const listEl = document.getElementById("editorialChaptersList");
    const activeIdx = this.stationIndex;
    const activeId = STATION_ORDER[activeIdx];
    const item = ARTIFACTS.find((a) => a.id === activeId) || ARTIFACTS[0];
    const itemLoc = item[this.lang];
    const excerpt = (itemLoc.stories[this.ageProfile] || [])[0] || "";
    const takeaway = learningTakeaways[activeId][this.lang][this.ageProfile];
    const statusLabel = t.statusLabels[item.statusType] || "";

    const tabsHtml = STATION_ORDER.map((id, idx) => {
      const tabArt = ARTIFACTS.find((a) => a.id === id);
      const tabLoc = tabArt[this.lang];
      const activeClass = idx === activeIdx ? "active" : "";
      const visitedClass = this.visitedStations.has(id) ? "is-visited" : "";
      return `
        <button class="showcase-tab-btn ${activeClass} ${visitedClass}" data-showcase-tab="${idx}" style="--tab-accent: ${tabArt.accentColor}">
          <span class="showcase-tab-title">0${idx + 1} · ${tabLoc.shortName || tabLoc.name}</span>
        </button>
      `;
    }).join("");

    const langKey = isPt ? "pt" : "en";
    const age = this.ageProfile || "adult";
    const vegaLoc = VEGA_JOURNEY[langKey];
    const vegaNote =
      (vegaLoc.siteChapters[activeId] && vegaLoc.siteChapters[activeId][age]) || "";
    const isPlayingThisChapter =
      this._activeVegaChannel &&
      this._activeVegaChannel.surface === "chapter" &&
      this._activeVegaChannel.audioUrl.endsWith(`-chap-${activeId}.mp3`) &&
      this.audio.isVegaSpeaking;

    listEl.innerHTML = `
      <div class="showcase-tabs-bar">${tabsHtml}</div>
      <div class="chapter-vega-strip">
        <div class="vega-mini-avatar-wrap ${isPlayingThisChapter ? "is-speaking" : ""}" id="chapterVegaAvatarRing">
          <img src="assets/images/astronaut-guide.jpg" alt="${vegaLoc.guideName}" class="vega-mini-avatar" />
        </div>
        <div class="chapter-vega-copy">
          <span class="chapter-vega-chip">${vegaLoc.siteRoleChip}</span>
          <p class="chapter-vega-note">${vegaNote}</p>
        </div>
        <button class="vega-mini-voice-btn ${isPlayingThisChapter ? "is-playing" : ""}" id="chapterVegaPlayBtn" type="button">
          ${isPlayingThisChapter ? vegaLoc.stopBtn : vegaLoc.listenBtn}
        </button>
      </div>
      <article id="chapter-card-${activeIdx}" class="editorial-chapter-card exhibit-open-stage showcase-stage" style="--card-accent: ${item.accentColor}">
        <div class="chapter-media-wrap">
          <img src="${item.imagePath}" alt="${itemLoc.name}" />
        </div>
        <div class="chapter-body-col">
          <span class="chapter-meta-line">${item.mission.toUpperCase()} · ${item.datePlaced}</span>
          <h3>${itemLoc.name}</h3>
          <p class="showcase-excerpt">${excerpt}</p>
          <div class="chapter-actions-row">
            <button class="btn-chapter-primary" data-read-idx="${activeIdx}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
              <span>${isPt ? "Ler & Ouvir História" : "Read & Hear Story"}</span>
            </button>
            <button class="btn-chapter-link" data-3d-idx="${activeIdx}">
              ${isPt ? "Explorar em 3D →" : "Explore in 3D →"}
            </button>
          </div>
        </div>
      </article>
    `;

    const chapVegaBtn = document.getElementById("chapterVegaPlayBtn");
    if (chapVegaBtn && vegaNote) {
      chapVegaBtn.addEventListener("click", () => {
        this.playVegaChannelClip(
          "chapter",
          `assets/audio/vega-${langKey}-${age}-chap-${activeId}.mp3`,
          vegaNote,
          "#chapterVegaAvatarRing",
          "#chapterVegaPlayBtn",
          vegaLoc.listenBtn
        );
      });
    }

    listEl.querySelectorAll("[data-showcase-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.stopVegaChannel();
        this.stationIndex = parseInt(btn.getAttribute("data-showcase-tab"), 10);
        this.audio.playPing(840, 0.07);
        this.renderUI();
      });
    });

    // Bind dynamic card actions
    listEl.querySelectorAll("[data-voice-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.stationIndex = parseInt(btn.getAttribute("data-voice-idx"), 10);
        this.openStoryView();
        const paragraphs = this.currentArtifact[this.lang].stories[this.ageProfile];
        this.updateSpeechButtons(true, false);
        this.audio.speakStory(
          paragraphs,
          this.lang,
          this.ageProfile,
          {
            onParagraphChange: (pIdx) => this.highlightParagraph(pIdx),
            onSpeechEnd: () => {
              this.updateSpeechButtons(false, false);
              this.updateAudioProgressUI(null);
            }
          },
          this.currentArtifact.id
        );
      });
    });

    listEl.querySelectorAll("[data-read-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.stationIndex = parseInt(btn.getAttribute("data-read-idx"), 10);
        this.openStoryView();
      });
    });

    listEl.querySelectorAll("[data-sci-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.stationIndex = parseInt(btn.getAttribute("data-sci-idx"), 10);
        this.visitedStations.add(this.currentArtifact.id);
        this.activeHotspotIdx = 0;
        this.renderScienceModal();
        document.getElementById("scienceModal").classList.remove("hidden");
        this.audio.playPing(980, 0.09);
        this.renderUI();
      });
    });

    listEl.querySelectorAll("[data-3d-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-3d-idx"), 10);
        this.enter3DMode(idx);
      });
    });

    if (this.revealObserver && !this._hasRenderedEditorialOnce) {
      listEl.querySelectorAll(".reveal-on-scroll").forEach((el) => this.revealObserver.observe(el));
    }
    this._hasRenderedEditorialOnce = true;
  }

  jumpToChapterCard(idx) {
    this.stationIndex = idx;
    this.renderUI();
    const showcase = document.getElementById("editorialChaptersList");
    if (!showcase) return;
    showcase.classList.add("in-view");
    showcase.scrollIntoView({ behavior: "smooth", block: "center" });
    this.audio.playPing(860, 0.08);
  }

  renderUI() {
    const isPt = this.lang === "pt";
    const art = this.currentArtifact;
    const loc = art[this.lang];

    // Set global accent color for current station
    document.documentElement.style.setProperty("--accent", art.accentColor);

    // 1. Update Static Editorial Space-Tech Site
    this.renderEditorialSite();

    // 2. Update Topbar Pills
    const museumTitleEl = document.getElementById("museumTitleText");
    if (museumTitleEl) {
      museumTitleEl.textContent = "MUSEUM OF LOST SPACE TECHNOLOGY";
    }
    const topChildEl = document.getElementById("topAgeChild");
    const topTeenEl = document.getElementById("topAgeTeen");
    const topAdultEl = document.getElementById("topAgeAdult");
    if (topChildEl) topChildEl.textContent = isPt ? "Criança" : "Child";
    if (topTeenEl) topTeenEl.textContent = isPt ? "Adolescente" : "Teen";
    if (topAdultEl) topAdultEl.textContent = isPt ? "Adulto" : "Adult";
    this.updateAmbientUI();

    const badgeBtn = document.getElementById("missionProgressBadge");
    const badgeText = document.getElementById("missionProgressBadgeText");
    if (badgeBtn && badgeText) {
      const visitedCount = this.visitedStations.size;
      const unlocked = visitedCount >= STATION_ORDER.length;
      badgeBtn.classList.toggle("is-unlocked", unlocked);
      badgeText.textContent = unlocked
        ? isPt
          ? "★ Certificado Liberado"
          : "★ Certificate Unlocked"
        : isPt
          ? `Histórias: ${visitedCount}/${STATION_ORDER.length}`
          : `Stories: ${visitedCount}/${STATION_ORDER.length}`;
    }

    document.querySelectorAll("[data-lang-btn]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-lang-btn") === this.lang);
    });
    document.querySelectorAll("[data-age-btn]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-age-btn") === this.ageProfile);
    });

    // 3. Update Lateral Travel Buttons ("Viajar para o próximo / anterior")
    const prevIdx = (this.stationIndex - 1 + STATION_ORDER.length) % STATION_ORDER.length;
    const nextIdx = (this.stationIndex + 1) % STATION_ORDER.length;
    const prevArt = ARTIFACTS.find((a) => a.id === STATION_ORDER[prevIdx]);
    const nextArt = ARTIFACTS.find((a) => a.id === STATION_ORDER[nextIdx]);

    document.getElementById("prevTravelKicker").textContent = isPt
      ? "Viajar para anterior"
      : "Travel to previous";
    document.getElementById("prevTravelTitle").textContent = prevArt[this.lang].name;

    document.getElementById("nextTravelKicker").textContent = isPt
      ? "Viajar para o próximo"
      : "Travel to next";
    document.getElementById("nextTravelTitle").textContent = nextArt[this.lang].name;

    // Hide right travel button when Story Drawer is open on the right side
    document.getElementById("nextStationBtn").classList.toggle("hidden", this.isStoryOpen);

    // 4. Update Walk Bottom Capsule
    const stepNum = `0${this.stationIndex + 1} / 0${STATION_ORDER.length}`;
    document.getElementById("walkStepBadge").textContent = isPt
      ? `ESTAÇÃO ${stepNum}`
      : `STATION ${stepNum}`;
    const coordsEl = document.getElementById("walkCoordsText");
    if (coordsEl) {
      coordsEl.textContent = isPt ? art.coordinates.sitePt : art.coordinates.siteEn;
    }
    document.getElementById("walkArtifactTitle").textContent = loc.name;
    const personaEl = document.getElementById("walkArtifactPersona");
    if (personaEl) {
      personaEl.textContent = `"${loc.personaTitle}"`;
    }
    if (this.surface3D) {
      this.surface3D.setAgeDifficulty(this.ageProfile);
    }
    const askLabel = document.getElementById("openAskBtnLabel");
    if (askLabel) {
      askLabel.textContent = isPt ? "Pergunte ao Equipamento" : "Ask the Equipment";
    }
    this.renderStampsBar();
    document.getElementById("openStoryBtnLabel").textContent = isPt
      ? "Ouvir a Minha História"
      : "Hear My Story";
    const hintMap = {
      pt: {
        child: "Gire a Lua com o dedo ou mouse e clique nos 3 orbes brilhantes ao redor do equipamento!",
        teen: "Gire 360° e dê zoom para encontrar os 3 pontos discretos escondidos ao redor do equipamento.",
        adult: "Inspecione cada ângulo em 360° e dê zoom: há 3 sinais sutis camuflados na cena para descobrir."
      },
      en: {
        child: "Drag to rotate 360° and click the 3 glowing orbs around the equipment!",
        teen: "Rotate 360° and zoom in to find the 3 discreet points hidden around the equipment.",
        adult: "Inspect all 360° angles and zoom in: 3 subtle signals are camouflaged around the scene."
      }
    };
    document.getElementById("walkHintText").textContent =
      hintMap[isPt ? "pt" : "en"][this.ageProfile] || hintMap[isPt ? "pt" : "en"].adult;

    // Station Progress Dots
    const dotsRow = document.getElementById("stationDotsRow");
    dotsRow.innerHTML = STATION_ORDER.map(
      (id, idx) =>
        `<button class="station-dot ${idx === this.stationIndex ? "active" : ""} ${
          this.visitedStations.has(id) ? "visited" : ""
        }" data-dot-idx="${idx}"></button>`
    ).join("");
    dotsRow.querySelectorAll("[data-dot-idx]").forEach((dot) => {
      dot.addEventListener("click", () => {
        const idx = parseInt(dot.getAttribute("data-dot-idx"), 10);
        if (this.surface3D && this.is3DActive) {
          this.surface3D.goToStation(idx, this.isStoryOpen);
        } else {
          this.stationIndex = idx;
          this.renderUI();
        }
      });
    });

    // 5. Update Story Drawer visibility & content
    document.getElementById("walkHudDock").classList.toggle("hidden", this.isStoryOpen);
    document.getElementById("storyDrawer").classList.toggle("hidden", !this.isStoryOpen);
    if (this.isStoryOpen) {
      this.renderStoryDrawer();
    }
  }

  renderStoryDrawer(turnDir = null) {
    const isPt = this.lang === "pt";
    const art = this.currentArtifact;
    const loc = art[this.lang];
    const t = this.t;

    const chapterNum = `0${this.stationIndex + 1}`;
    const chapterTotal = `0${STATION_ORDER.length}`;
    document.getElementById("backToWalkText").textContent = this.is3DActive
      ? isPt
        ? `Cena 3D · ${chapterNum}/${chapterTotal}`
        : `3D View · ${chapterNum}/${chapterTotal}`
      : isPt
      ? "Fechar Livro"
      : "Close Book";
    document.getElementById("storyStatusTag").textContent = this.is3DActive
      ? `◈ ${art.mission}`
      : t.statusLabels[art.statusType];
    document.getElementById("storyCodeMeta").textContent = isPt
      ? `CAPÍTULO ${chapterNum}/${chapterTotal}  •  ${art.mission.toUpperCase()} — ${art.datePlaced.toUpperCase()}`
      : `CHAPTER ${chapterNum}/${chapterTotal}  •  ${art.mission.toUpperCase()} — ${art.datePlaced.toUpperCase()}`;
    document.getElementById("storyMainTitle").textContent = loc.name;
    document.getElementById("storyPersonaSub").textContent = `"${loc.personaTitle}"`;

    const bookImg = document.getElementById("bookArtifactImage");
    if (bookImg) {
      bookImg.src = art.imagePath;
      bookImg.alt = loc.name;
    }

    const capTitle = document.getElementById("bookCaptionTitle");
    const capSub = document.getElementById("bookCaptionSub");
    if (capTitle && capSub) {
      capTitle.textContent = `${art.id.toUpperCase()} — ${art.mission}, ${art.datePlaced}`;
      capSub.textContent = loc.shortTag || (isPt ? art.coordinates.sitePt : art.coordinates.siteEn);
    }

    document.querySelector(".age-chip-child").textContent = isPt ? "Criança" : "Child";
    document.querySelector(".age-chip-teen").textContent = isPt ? "Adolescente" : "Teen";
    document.querySelector(".age-chip-adult").textContent = isPt ? "Adulto" : "Adult";

    this.updateImmersiveUI();
    this.updateSpeechButtons(this.audio.isSpeaking, this.audio.isPaused);
    if (this.audio.isSpeaking) {
      this.updateAudioProgressUI(this.audio.getPlaybackTimes());
    } else {
      this.updateAudioProgressUI(null);
    }

    const paragraphs = loc.stories[this.ageProfile] || [];
    const flow = document.getElementById("storyParagraphsFlow");
    const bookPages = this.buildBookPages(paragraphs);
    const totalPages = Math.max(1, bookPages.length);
    if (this.storyPageIndex >= totalPages) this.storyPageIndex = totalPages - 1;
    if (this.storyPageIndex < 0) this.storyPageIndex = 0;

    const currentPage = bookPages[this.storyPageIndex] || { text: "", paraIndex: 0, isFirstOfChapter: true };
    const isSpeakingPara =
      this.audio.isSpeaking && this.audio.currentParagraphIndex === currentPage.paraIndex;
    flow.innerHTML = `<p class="story-p${currentPage.isFirstOfChapter ? " is-chapter-start" : ""}${isSpeakingPara ? " speaking-now" : ""}" data-para-idx="${currentPage.paraIndex}" id="sp-${currentPage.paraIndex}">${currentPage.text}</p>`;

    const marginMarkers = document.getElementById("bookMarginMarkers");
    if (marginMarkers) {
      marginMarkers.innerHTML = `<span class="book-margin-folio">§ 0${this.storyPageIndex + 1}</span>`;
    }

    const rightPage = document.getElementById("bookRightPage");
    if (rightPage) {
      rightPage.classList.remove("book-page-turn-next", "book-page-turn-prev");
      if (turnDir === "next" || turnDir === "prev") {
        void rightPage.offsetWidth;
        rightPage.classList.add(turnDir === "next" ? "book-page-turn-next" : "book-page-turn-prev");
      }
    }

    const prevBtn = document.getElementById("bookPrevPageBtn");
    const nextBtn = document.getElementById("bookNextPageBtn");
    const pageInd = document.getElementById("bookPageIndicator");
    if (prevBtn && nextBtn && pageInd) {
      prevBtn.disabled = this.storyPageIndex === 0;
      nextBtn.disabled = this.storyPageIndex >= totalPages - 1;
      prevBtn.textContent = isPt ? "← Página Anterior" : "← Previous Page";
      nextBtn.textContent = isPt ? "Próxima Página →" : "Next Page →";
      pageInd.textContent = isPt
        ? `Página ${this.storyPageIndex + 1} de ${totalPages}`
        : `Page ${this.storyPageIndex + 1} of ${totalPages}`;
    }

    document.getElementById("storyQuoteHighlight").textContent = `"${loc.quote}"`;
    document.getElementById("openScienceBtnText").textContent = isPt
      ? "Ver Ciência, Fotografia & Ficha Técnica"
      : "View Science, Photo & NASA Tech Specs";
    const prevArtText = document.getElementById("storyPrevArtifactText");
    if (prevArtText) {
      prevArtText.textContent = isPt ? "Capítulo Anterior" : "Previous Chapter";
    }
    document.getElementById("storyNextArtifactText").textContent = isPt
      ? "Próximo Capítulo"
      : "Next Chapter";
  }

  formatAudioTime(seconds) {
    const safe = Math.max(0, Math.round(Number(seconds) || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  updateAudioProgressUI(stats = null) {
    const fill = document.getElementById("audioProgressFill");
    const thumb = document.getElementById("audioProgressThumb");
    const track = document.getElementById("audioProgressTrack");
    const timeEl = document.getElementById("audioTimeDisplay");
    if (!fill || !thumb || !timeEl) return;

    let currentTime = 0;
    let totalDuration = 0;
    let progress = 0;

    if (stats && stats.totalDuration > 0) {
      currentTime = stats.currentTime;
      totalDuration = stats.totalDuration;
      progress = stats.progress;
    } else {
      const paragraphs = this.currentArtifact?.[this.lang]?.stories?.[this.ageProfile] || [];
      totalDuration = this.audio.estimateTotalDuration(paragraphs, this.audio.speechRate);
      currentTime = 0;
      progress = 0;
    }

    const pct = Math.max(0, Math.min(100, progress * 100));
    fill.style.width = `${pct.toFixed(1)}%`;
    thumb.style.left = `${pct.toFixed(1)}%`;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(pct)));
    timeEl.textContent = `${this.formatAudioTime(currentTime)} / ${this.formatAudioTime(totalDuration)}`;

    if (stats && stats.isSpeaking && !stats.isPaused) {
      this.syncBookPageWithAudio(stats);
    }
  }

  updateImmersiveUI() {
    const isPt = this.lang === "pt";
    const drawer = document.getElementById("storyDrawer");
    const btn = document.getElementById("immersiveModeBtn");
    const txt = document.getElementById("immersiveModeText");
    if (drawer) {
      drawer.classList.toggle("is-immersive", this.isImmersiveReading);
    }
    if (btn) {
      btn.classList.toggle("active", this.isImmersiveReading);
      btn.setAttribute("aria-pressed", String(this.isImmersiveReading));
    }
    if (txt) {
      txt.textContent = this.isImmersiveReading
        ? isPt
          ? "Sair do imersivo"
          : "Exit immersive"
        : isPt
        ? "Modo imersivo"
        : "Immersive mode";
    }
  }

  updateSpeechButtons(isSpeaking, isPaused) {
    const isPt = this.lang === "pt";
    const playBtn = document.getElementById("narratePlayBtn");
    const playIcon = document.getElementById("narratePlayIcon");
    const playTxt = document.getElementById("narratePlayText");
    const stopBtn = document.getElementById("narrateStopBtn");
    const wave = document.getElementById("miniWave");

    const statusReadout = document.querySelector(".audio-status-readout");

    if (playBtn) {
      playBtn.classList.toggle("is-active", isSpeaking);
      playBtn.classList.toggle("is-paused", isPaused);
    }
    if (statusReadout) {
      statusReadout.classList.toggle("is-live", isSpeaking && !isPaused);
    }

    if (!isSpeaking) {
      if (playIcon) playIcon.textContent = "▶";
      playTxt.textContent = isPt ? "Ouvir o Objeto Narrar" : "Listen to Object Narrate";
      stopBtn.classList.add("hidden");
      wave.classList.remove("playing");
    } else {
      if (playIcon) playIcon.textContent = isPaused ? "▶" : "⏸";
      playTxt.textContent = isPaused
        ? isPt
          ? "Narração pausada (continuar)"
          : "Narration paused (resume)"
        : isPt
        ? "O objeto está narrando..."
        : "Object narrating...";
      stopBtn.classList.remove("hidden");
      wave.classList.toggle("playing", !isPaused);
    }
  }

  buildBookPages(paragraphs) {
    const pages = [];
    const maxWordsPerPage = this.is3DActive ? 84 : 52;

    (paragraphs || []).forEach((para, paraIdx) => {
      const sentences = String(para)
        .trim()
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean);

      if (!sentences.length) return;

      const paraChunks = [];
      let current = "";
      let currentWords = 0;

      sentences.forEach((sentence) => {
        const sWords = sentence.split(/\s+/).filter(Boolean).length;
        if (current && currentWords + sWords > maxWordsPerPage) {
          paraChunks.push({ text: current.trim(), words: currentWords });
          current = sentence;
          currentWords = sWords;
        } else {
          current = current ? `${current} ${sentence}` : sentence;
          currentWords += sWords;
        }
      });

      if (current.trim()) {
        paraChunks.push({ text: current.trim(), words: currentWords });
      }

      const totalParaWords = Math.max(
        1,
        paraChunks.reduce((acc, ch) => acc + ch.words, 0)
      );
      let accWords = 0;
      paraChunks.forEach((ch) => {
        const startRatio = accWords / totalParaWords;
        accWords += ch.words;
        const endRatio = accWords / totalParaWords;
        pages.push({
          text: ch.text,
          paraIndex: paraIdx,
          startRatio,
          endRatio,
          isFirstOfChapter: pages.length === 0
        });
      });
    });

    return pages;
  }

  syncBookPageWithAudio(stats) {
    if (!this.isStoryOpen || !stats || stats.paragraphIndex < 0) return;
    const paragraphs = this.currentArtifact?.[this.lang]?.stories?.[this.ageProfile] || [];
    const bookPages = this.buildBookPages(paragraphs);
    if (!bookPages.length) return;

    const paraProg = Math.max(0, Math.min(0.9999, stats.paragraphProgress || 0));
    let targetPage = bookPages.findIndex(
      (p) =>
        p.paraIndex === stats.paragraphIndex &&
        paraProg >= p.startRatio &&
        paraProg < p.endRatio
    );
    if (targetPage < 0) {
      targetPage = bookPages.findIndex((p) => p.paraIndex === stats.paragraphIndex);
    }

    if (targetPage >= 0 && targetPage !== this.storyPageIndex) {
      const forward = targetPage > this.storyPageIndex;
      this.storyPageIndex = targetPage;
      this.audio.playPageTurnSound(forward);
      this.renderStoryDrawer(forward ? "next" : "prev");
    }
  }

  highlightParagraph(idx) {
    if (idx < 0) {
      document.querySelectorAll(".story-p").forEach((el) => el.classList.remove("speaking-now"));
      return;
    }
    const paragraphs = this.currentArtifact[this.lang].stories[this.ageProfile] || [];
    const bookPages = this.buildBookPages(paragraphs);
    const targetPage = bookPages.findIndex((p) => p.paraIndex === idx);
    if (targetPage >= 0 && targetPage !== this.storyPageIndex) {
      const forward = targetPage > this.storyPageIndex;
      this.storyPageIndex = targetPage;
      this.audio.playPageTurnSound(forward);
      this.renderStoryDrawer(forward ? "next" : "prev");
    }
    document.querySelectorAll(".story-p").forEach((el) => {
      const pIdx = Number(el.getAttribute("data-para-idx"));
      const isMatch = pIdx === idx || el.id === `sp-${idx}`;
      el.classList.toggle("speaking-now", isMatch);
      if (isMatch) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  // ==========================================================================
  // ON-DEMAND SCIENCE, ANATOMY & NASA SPECS MODAL
  // ==========================================================================
  renderScienceModal() {
    const isPt = this.lang === "pt";
    const art = this.currentArtifact;
    const loc = art[this.lang];

    document.getElementById("scienceModalKicker").textContent = isPt
      ? "DOSSIÊ CIENTÍFICO E TÉCNICO DA NASA"
      : "NASA SCIENTIFIC & TECHNICAL DOSSIER";
    document.getElementById("scienceModalTitle").textContent = loc.name;
    const closeSciBtn = document.getElementById("closeScienceModalBtn");
    closeSciBtn.textContent = "✕";
    closeSciBtn.setAttribute("aria-label", isPt ? "Fechar" : "Close");

    document.getElementById("sciTabAnatomy").textContent = isPt
      ? "Fotografia & Peças Interativas"
      : "Photo & Interactive Parts";
    document.getElementById("sciTabLab").textContent = isPt
      ? "Simulador Científico"
      : "Science Simulator";
    document.getElementById("sciTabSpecs").textContent = isPt
      ? "Ficha Técnica & Fontes NASA"
      : "Tech Specs & NASA Refs";

    document.querySelectorAll("[data-scitab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-scitab") === this.activeSciTab);
    });
    document.querySelectorAll(".sci-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `sciPane-${this.activeSciTab}`);
    });

    if (this.activeSciTab === "anatomy") {
      this.labController.cleanup();
      this.renderAnatomyPane();
    } else if (this.activeSciTab === "lab") {
      this.labController.renderLab(art, this.lang);
    } else {
      this.labController.cleanup();
      this.renderSpecsPane();
    }
  }

  renderAnatomyPane() {
    const isPt = this.lang === "pt";
    const art = this.currentArtifact;
    const loc = art[this.lang];

    document.getElementById("hotspotHintText").textContent = isPt
      ? "Clique nos pontos numerados sobre o equipamento para descobrir como cada peça funciona:"
      : "Click the numbered points on the equipment to discover how each part works:";
    const pBtn = document.getElementById("modePhotoBtn");
    const bBtn = document.getElementById("modeBlueprintBtn");
    pBtn.textContent = isPt ? "Fotografia Lunar" : "Lunar Render";
    bBtn.textContent = isPt ? "Blueprint Técnico" : "Technical Blueprint";
    pBtn.classList.toggle("active", this.anatomyMode === "photo");
    bBtn.classList.toggle("active", this.anatomyMode === "blueprint");

    const container = document.getElementById("anatomyViewportContainer");
    const visual =
      this.anatomyMode === "photo" && art.imagePath
        ? `<img src="${art.imagePath}" alt="${loc.name}" class="anatomy-photo" />`
        : getArtifactBlueprintSVG(art.id);

    const pins = loc.hotspots
      .map(
        (h, i) => `
        <button class="hotspot-pin ${i === this.activeHotspotIdx ? "active" : ""}" style="left:${h.x}%;top:${h.y}%;" data-hidx="${i}">
          ${i + 1}
        </button>
      `
      )
      .join("");

    container.innerHTML = `
      <div class="anatomy-viewport">
        ${visual}
        <div class="hotspot-overlay">${pins}</div>
      </div>
    `;

    container.querySelectorAll("[data-hidx]").forEach((pin) => {
      pin.addEventListener("click", () => {
        this.activeHotspotIdx = parseInt(pin.getAttribute("data-hidx"), 10);
        this.audio.playPing(1040, 0.08);
        this.renderAnatomyPane();
      });
    });

    const activeH = loc.hotspots[this.activeHotspotIdx] || loc.hotspots[0];
    document.getElementById("hotspotInfoBox").innerHTML = `
      <h4>${this.activeHotspotIdx + 1}. ${activeH.title}</h4>
      <p>${activeH.detail}</p>
    `;
  }

  renderSpecsPane() {
    const isPt = this.lang === "pt";
    const loc = this.currentArtifact[this.lang];

    document.getElementById("techTableHeading").textContent = isPt
      ? "Especificações Técnicas Oficiais"
      : "Official Technical Specifications";
    document.getElementById("cleanSpecsBody").innerHTML = loc.specs
      .map((s) => `<tr><th>${s.label}</th><td>${s.value}</td></tr>`)
      .join("");

    document.getElementById("contextHeading").textContent = isPt
      ? "Contexto Histórico da Missão"
      : "Historical Mission Context";
    document.getElementById("contextBodyText").textContent = loc.missionContext;

    document.getElementById("stateHeading").textContent = isPt
      ? "Estado Atual e Preservação"
      : "Current State & Preservation";
    document.getElementById("stateBodyText").textContent = loc.currentState;

    document.getElementById("refsHeading").textContent = isPt
      ? "Fontes Oficiais da NASA e Artigos"
      : "Official NASA Sources & Papers";
    document.getElementById("cleanRefsList").innerHTML = loc.references
      .map(
        (r) =>
          `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">↗ ${r.title}</a></li>`
      )
      .join("");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.echoesApp = new EchoesOfTheMoonApp();
});
