// ============================================================================
// ECHOES OF THE MOON: MINIMALIST FIRST-PERSON LUNAR EXPLORATION CONTROLLER
// One Focal Point at a Time: Walk on the 3D Moon -> Listen to the Object's Voice
// -> Open Deep Science & NASA Specs on Demand
// ============================================================================

import { UI_TEXT, ARTIFACTS } from "./data.js";
import { LunarSurface3D } from "./lunarSurface3d.js";
import { MuseumAudioEngine } from "./audio.js";
import { getArtifactBlueprintSVG } from "./schematics.js";
import { ScienceLabController } from "./labs.js";

const STATION_ORDER = ["lrrr", "pse", "eagle", "lrv"];

class EchoesOfTheMoonApp {
  constructor() {
    this.lang = "pt";
    this.ageProfile = "adult"; // 'child' | 'teen' | 'adult'
    this.stationIndex = 0;
    this.is3DActive = false;
    this.isStoryOpen = false;
    this.activeSciTab = "anatomy";
    this.anatomyMode = "photo";
    this.activeHotspotIdx = 0;
    this.visitedStations = new Set();
    this.expandedInlineCards = new Set();
    this._hasRenderedEditorialOnce = false;
    this._hasSeenMissionLetter = false;
    this._hasShownCertReward = false;

    this.audio = new MuseumAudioEngine();
    this.surface3D = null;
    this.labController = null;

    this.init();
  }

  init() {
    const labMount = document.getElementById("scienceLabMount");
    this.labController = new ScienceLabController(labMount, this.audio);

    this.bindEvents();
    this.renderUI();
    this.setupScrollReveal();
  }

  ensure3DInitialized() {
    if (this.surface3D) return;
    const viewport = document.getElementById("lunar3DViewport");
    this.surface3D = new LunarSurface3D(viewport, ARTIFACTS, {
      onStationChange: (artifactId, idx, inspectMode) => {
        this.stationIndex = idx;
        this.isStoryOpen = Boolean(inspectMode);
        if (this.isStoryOpen && artifactId) {
          this.visitedStations.add(artifactId);
        }
        this.audio.stopSpeech(false);
        this.audio.playQuindarTone(true);
        this.renderUI();
      },
      onArtifactClick: () => {
        this.openStoryView();
      }
    });
  }

  enter3DMode(stationIdx = null) {
    if (stationIdx !== null) {
      this.stationIndex = stationIdx;
    }
    this.is3DActive = true;
    this.isStoryOpen = false;
    this.audio.stopSpeech(false);
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
    this.surface3D.descendToSurface();
    this.audio.playQuindarTone(true);
    this.renderUI();
    if (!this._hasSeenMissionLetter) {
      this.openMissionLetter();
    }
  }

  exit3DMode() {
    this.is3DActive = false;
    this.isStoryOpen = false;
    this.audio.stopSpeech(false);
    document.body.classList.remove("in-3d-mode");
    document.getElementById("mode3DWrapper").classList.add("hidden");
    document.getElementById("storyDrawer").classList.add("hidden");
    document.getElementById("staticMuseumSite").classList.remove("hidden");
    this.renderUI();
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

  get currentArtifact() {
    const id = STATION_ORDER[this.stationIndex];
    return ARTIFACTS.find((a) => a.id === id) || ARTIFACTS[0];
  }

  get t() {
    return UI_TEXT[this.lang];
  }

  bindEvents() {
    // 1. Language Switchers
    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.lang = btn.getAttribute("data-lang-btn");
        this.audio.stopSpeech(false);
        this.audio.playPing(780, 0.08);
        this.renderUI();
      });
    });

    // 2. Age Profile Switchers
    document.querySelectorAll("[data-age-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.ageProfile = btn.getAttribute("data-age-btn");
        this.audio.stopSpeech(false);
        this.audio.playPing(920, 0.08);
        this.renderUI();
      });
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
    document.getElementById("ambientSoundBtn").addEventListener("click", () => {
      this.audio.toggleAmbient();
      this.updateAmbientUI();
    });

    // 5. Lateral Travel Navigation in 3D Mode
    document.getElementById("prevStationBtn").addEventListener("click", () => {
      const prevIdx = (this.stationIndex - 1 + STATION_ORDER.length) % STATION_ORDER.length;
      if (this.surface3D && this.is3DActive) {
        this.surface3D.goToStation(prevIdx, this.isStoryOpen);
      } else {
        this.stationIndex = prevIdx;
        this.renderUI();
      }
    });

    document.getElementById("nextStationBtn").addEventListener("click", () => {
      const nextIdx = (this.stationIndex + 1) % STATION_ORDER.length;
      if (this.surface3D && this.is3DActive) {
        this.surface3D.goToStation(nextIdx, this.isStoryOpen);
      } else {
        this.stationIndex = nextIdx;
        this.renderUI();
      }
    });

    // 6. Open & Close Story Reading Drawer
    document.getElementById("openStoryBtn").addEventListener("click", () => {
      this.openStoryView();
    });

    document.getElementById("closeStoryBtn").addEventListener("click", () => {
      this.closeStoryView();
    });

    document.getElementById("returnToWalkBrand").addEventListener("click", () => {
      if (this.isStoryOpen) {
        this.closeStoryView();
      }
    });

    document.getElementById("storyNextArtifactBtn").addEventListener("click", () => {
      const nextIdx = (this.stationIndex + 1) % STATION_ORDER.length;
      this.audio.playQuindarTone(true);
      if (this.surface3D && this.is3DActive) {
        this.surface3D.goToStation(nextIdx, true);
      } else {
        this.stationIndex = nextIdx;
        this.visitedStations.add(this.currentArtifact.id);
        this.renderUI();
      }
    });

    // 7. Audio Narration (Text-to-Speech)
    document.getElementById("narratePlayBtn").addEventListener("click", () => {
      if (this.audio.isSpeaking) {
        const paused = this.audio.togglePauseSpeech();
        this.updateSpeechButtons(true, paused);
      } else {
        const paragraphs = this.currentArtifact[this.lang].stories[this.ageProfile];
        this.updateSpeechButtons(true, false);
        this.audio.speakStory(paragraphs, this.lang, this.ageProfile, {
          onParagraphChange: (idx) => this.highlightParagraph(idx),
          onSpeechEnd: () => this.updateSpeechButtons(false, false)
        });
      }
    });

    document.getElementById("narrateStopBtn").addEventListener("click", () => {
      this.audio.stopSpeech(true);
      this.updateSpeechButtons(false, false);
    });

    document.getElementById("narrateSpeedBtn").addEventListener("click", (e) => {
      this.audio.speechRate = this.audio.speechRate === 1.0 ? 1.2 : 1.0;
      e.currentTarget.textContent = `${this.audio.speechRate.toFixed(1)}x`;
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

    document.getElementById("missionProgressBadge").addEventListener("click", () => {
      if (this.visitedStations.size >= STATION_ORDER.length) {
        this.openCertificateModal();
      } else {
        this.openMissionLetter();
      }
    });

    document.getElementById("closeCertificateBtn").addEventListener("click", () => {
      this.closeCertificateModal();
    });

    document.getElementById("certificateModal").addEventListener("click", (e) => {
      if (e.target.id === "certificateModal") {
        this.closeCertificateModal();
      }
    });

    document.getElementById("certNameInput").addEventListener("input", () => {
      this.renderCertificateCanvas();
    });

    document.getElementById("downloadCertBtn").addEventListener("click", () => {
      this.downloadCertificate();
    });
  }

  openStoryView() {
    this.isStoryOpen = true;
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
    this.isStoryOpen = false;
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
      this.openCertificateModal();
    }
  }

  openMissionLetter() {
    this._hasSeenMissionLetter = true;
    const isPt = this.lang === "pt";
    const visited = this.visitedStations.size;

    document.getElementById("letterStamp").textContent = isPt
      ? "DIÁRIO DE BORDO • MISSÃO APOLLO"
      : "MISSION LOGBOOK • APOLLO";
    document.getElementById("letterTitle").textContent = isPt
      ? "Preparando a sua viagem à Lua, pequeno explorador!"
      : "Preparing your journey to the Moon, young explorer!";
    document.getElementById("letterBody").innerHTML = isPt
      ? `
        <p>Seja bem-vindo(a) à superfície lunar. Em poucos instantes você caminhará pelo mesmo solo silencioso onde máquinas históricas da NASA permanecem desde 1969.</p>
        <p>Lembre-se: os modelos 3D que você verá são <strong>representações ilustrativas</strong> criadas para dar vida a essa expedição.</p>
        <p>Aproveite a jornada, aproxime-se de cada equipamento e <strong>conheça todas as ${STATION_ORDER.length} histórias</strong> (${visited}/${STATION_ORDER.length} descobertas) para desbloquear seu <strong>Certificado Oficial de Explorador Lunar</strong>!</p>
      `
      : `
        <p>Welcome to the lunar surface. In just a moment, you will walk across the same silent soil where historic NASA machines have rested since 1969.</p>
        <p>Remember: the 3D models ahead are <strong>illustrative representations</strong> crafted to bring this expedition to life.</p>
        <p>Enjoy the journey, visit each monument, and <strong>discover all ${STATION_ORDER.length} stories</strong> (${visited}/${STATION_ORDER.length} unlocked) to earn your <strong>Official Lunar Explorer Certificate</strong>!</p>
      `;
    document.getElementById("letterSignature").textContent = isPt
      ? "— Curadoria do Museu do Silêncio Lunar"
      : "— Curators of the Silent Lunar Museum";
    document.getElementById("startExpeditionBtn").textContent = isPt
      ? "Iniciar Exploração →"
      : "Start Exploration →";

    const fill = document.getElementById("letterProgressFill");
    fill.style.width = "0%";
    document.getElementById("missionLetterModal").classList.remove("hidden");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = "100%";
      });
    });
  }

  closeMissionLetter() {
    document.getElementById("missionLetterModal").classList.add("hidden");
    this.audio.playPing(880, 0.08);
  }

  openCertificateModal() {
    const isPt = this.lang === "pt";
    const age = this.ageProfile || "adult";

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

    document.getElementById("certificateModal").classList.remove("hidden");
    this.audio.playQuindarTone(true);
    this.renderCertificateCanvas();
  }

  closeCertificateModal() {
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
      isPt ? "MUSEU DO SILÊNCIO LUNAR  •  NASA SPACE APPS" : "SILENT LUNAR MUSEUM  •  NASA SPACE APPS",
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
      650
    );

    // Date & Signature footer
    const today = new Date().toLocaleDateString(isPt ? "pt-BR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px monospace";
    ctx.fillText(
      (isPt ? "EMITIDO EM " : "ISSUED ON ") + today.toUpperCase(),
      w / 2,
      785
    );

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "italic 24px Georgia, serif";
    ctx.fillText(
      isPt ? "Abandonados, mas nunca esquecidos." : "Abandoned, but never forgotten.",
      w / 2,
      860
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
  }

  updateAmbientUI() {
    const btn = document.getElementById("ambientSoundBtn");
    const txt = document.getElementById("ambientSoundText");
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

    document.getElementById("navBrandTitle").textContent = isPt ? "Ecos da Lua" : "Echoes of the Moon";
    document.getElementById("navLinkStories").textContent = isPt ? "Histórias" : "Stories";
    document.getElementById("navLinkArtemis").textContent = isPt ? "Legado Artemis" : "Artemis Legacy";
    document.getElementById("navAgeChild").textContent = isPt ? "Criança" : "Child";
    document.getElementById("navAgeTeen").textContent = isPt ? "Adolescente" : "Teen";
    document.getElementById("navAgeAdult").textContent = isPt ? "Adulto" : "Adult";
    document.getElementById("open3DModeBtn").textContent = isPt ? "Explorar em 3D" : "Explore in 3D";

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

    listEl.innerHTML = `
      <div class="showcase-tabs-bar">${tabsHtml}</div>
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
              ${isPt ? "Ler & Ouvir História" : "Read & Hear Story"}
            </button>
            <button class="btn-chapter-link" data-3d-idx="${activeIdx}">
              ${isPt ? "Explorar em 3D →" : "Explore in 3D →"}
            </button>
          </div>
        </div>
      </article>
    `;

    listEl.querySelectorAll("[data-showcase-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
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
        this.audio.speakStory(paragraphs, this.lang, this.ageProfile, {
          onParagraphChange: (pIdx) => this.highlightParagraph(pIdx),
          onSpeechEnd: () => this.updateSpeechButtons(false, false)
        });
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
    document.getElementById("museumTitleText").textContent = isPt
      ? "MUSEU DO SILÊNCIO LUNAR"
      : "THE SILENT LUNAR MUSEUM";
    document.getElementById("topAgeChild").textContent = isPt ? "Criança" : "Child";
    document.getElementById("topAgeTeen").textContent = isPt ? "Adolescente" : "Teen";
    document.getElementById("topAgeAdult").textContent = isPt ? "Adulto" : "Adult";
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
    document.getElementById("walkCoordsText").textContent = isPt
      ? art.coordinates.sitePt
      : art.coordinates.siteEn;
    document.getElementById("walkArtifactTitle").textContent = loc.name;
    document.getElementById("walkArtifactPersona").textContent = `"${loc.personaTitle}"`;
    document.getElementById("openStoryBtnLabel").textContent = isPt
      ? "Ouvir a Minha História"
      : "Hear My Story";
    document.getElementById("walkHintText").textContent = isPt
      ? "Arraste para olhar ao redor • Use os botões laterais para viajar até o próximo equipamento"
      : "Drag to look around • Use the side buttons to travel to the next equipment";

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

  renderStoryDrawer() {
    const isPt = this.lang === "pt";
    const art = this.currentArtifact;
    const loc = art[this.lang];
    const t = this.t;

    document.getElementById("backToWalkText").textContent = this.is3DActive
      ? isPt
        ? "Voltar à Cena 3D"
        : "Back to 3D View"
      : isPt
      ? "Fechar História"
      : "Close Story";
    document.getElementById("storyStatusTag").textContent = t.statusLabels[art.statusType];
    document.getElementById("storyCodeMeta").textContent = `${art.mission.toUpperCase()} • ${art.datePlaced} • ${art.coordinates.display}`;
    document.getElementById("storyMainTitle").textContent = loc.name;
    document.getElementById("storyPersonaSub").textContent = `"${loc.personaTitle}"`;

    document.querySelector(".age-chip-child").textContent = isPt ? "Criança" : "Child";
    document.querySelector(".age-chip-teen").textContent = isPt ? "Adolescente" : "Teen";
    document.querySelector(".age-chip-adult").textContent = isPt ? "Adulto" : "Adult";

    this.updateSpeechButtons(this.audio.isSpeaking, this.audio.isPaused);

    const paragraphs = loc.stories[this.ageProfile];
    const flow = document.getElementById("storyParagraphsFlow");
    flow.innerHTML = paragraphs
      .map((p, idx) => `<p class="story-p" id="sp-${idx}">${p}</p>`)
      .join("");

    document.getElementById("storyQuoteHighlight").textContent = `"${loc.quote}"`;
    document.getElementById("openScienceBtnText").textContent = isPt
      ? "Ver Ciência, Fotografia & Ficha Técnica"
      : "View Science, Photo & NASA Tech Specs";
    document.getElementById("storyNextArtifactText").textContent = isPt
      ? "Próximo Equipamento"
      : "Next Equipment";
  }

  updateSpeechButtons(isSpeaking, isPaused) {
    const isPt = this.lang === "pt";
    const playTxt = document.getElementById("narratePlayText");
    const stopBtn = document.getElementById("narrateStopBtn");
    const wave = document.getElementById("miniWave");

    if (!isSpeaking) {
      playTxt.textContent = isPt ? "Ouvir o Objeto Narrar" : "Listen to Object Narrate";
      stopBtn.classList.add("hidden");
      wave.classList.remove("playing");
    } else {
      playTxt.textContent = isPaused
        ? isPt
          ? "Continuar Voz"
          : "Resume Voice"
        : isPt
        ? "Pausar Voz"
        : "Pause Voice";
      stopBtn.classList.remove("hidden");
      wave.classList.toggle("playing", !isPaused);
    }
  }

  highlightParagraph(idx) {
    document.querySelectorAll(".story-p").forEach((el, i) => {
      el.classList.toggle("speaking-now", i === idx);
      if (i === idx) {
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
    document.getElementById("closeScienceModalBtn").textContent = isPt
      ? "✕ Fechar"
      : "✕ Close";

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
