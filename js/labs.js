// ============================================================================
// THE SILENT MUSEUM: INTERACTIVE SCIENCE LABORATORIES
// Hands-on physics & engineering simulators for LRRR, PSE, LRV, and EAGLE
// ============================================================================

export class ScienceLabController {
  constructor(container, audioEngine) {
    this.container = container;
    this.audio = audioEngine;
    this.activeInterval = null;
    this.animFrame = null;
  }

  cleanup() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  renderLab(artifact, lang = "pt") {
    this.cleanup();
    if (!this.container) return;

    switch (artifact.labType) {
      case "laser":
        this.renderLaserLab(lang);
        break;
      case "seismic":
        this.renderSeismicLab(lang);
        break;
      case "rover":
        this.renderRoverLab(lang);
        break;
      case "eagle":
      default:
        this.renderEagleLab(lang);
        break;
    }
  }

  // ==========================================================================
  // LAB 1: LRRR — LUNAR LASER RANGING & CORNER-CUBE OPTICS SIMULATOR
  // ==========================================================================
  renderLaserLab(lang) {
    const isPt = lang === "pt";
    this.container.innerHTML = `
      <div class="lab-card">
        <div class="lab-header">
          <div>
            <span class="lab-badge">SIMULADOR ÓPTICO // LUNAR LASER RANGING (LLR)</span>
            <h4>${
              isPt
                ? "Disparo Laser Terra–Lua & Geometria do Prisma Corner-Cube"
                : "Earth–Moon Laser Ranging & Corner-Cube Prism Geometry"
            }</h4>
          </div>
          <button class="btn-primary lab-action-btn" id="fireLaserBtn">
            ⚡ ${isPt ? "Disparar Pulso Laser (532 nm)" : "Fire Laser Pulse (532 nm)"}
          </button>
        </div>

        <canvas id="laserLabCanvas" width="680" height="220" class="lab-canvas"></canvas>

        <div class="lab-telemetry-grid">
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Tempo de Ida e Volta (Δt)" : "Round-Trip Time (Δt)"}</span>
            <strong class="t-value emerald" id="llrTimeVal">2,5644 s</strong>
            <span class="t-sub">c = 299.792.458 m/s</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Distância Calculada d = (c × Δt)/2" : "Calculated Distance d = (c × Δt)/2"}</span>
            <strong class="t-value cyan" id="llrDistVal">384.400,00 km</strong>
            <span class="t-sub" id="llrDriftSub">+216,6 cm ${isPt ? "desde Jul/1969" : "since Jul/1969"}</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Eficiência de Retorno Óptico" : "Optical Return Efficiency"}</span>
            <strong class="t-value gold" id="llrPhotonVal">1 / 10¹⁷ fótons</strong>
            <span class="t-sub">${isPt ? "100 prismas de sílica fundida" : "100 fused-silica prisms"}</span>
          </div>
        </div>

        <div class="lab-controls-row">
          <div class="lab-slider-group">
            <label>
              <span>${isPt ? "Ângulo de Entrada do Feixe no Prisma Corner-Cube:" : "Laser Incidence Angle on Corner-Cube Prism:"}</span>
              <strong id="angleLabelVal">14°</strong>
            </label>
            <input type="range" id="prismAngleSlider" min="-32" max="32" value="14" />
            <small class="lab-hint">
              ${
                isPt
                  ? "Observe no gráfico: não importa o ângulo de entrada, o prisma corner-cube reflete o raio exatamente paralelo de volta para o telescópio!"
                  : "Notice on the canvas: regardless of entry angle, the corner-cube prism reflects the beam back strictly parallel to its source!"
              }
            </small>
          </div>

          <div class="lab-slider-group">
            <label>
              <span>${isPt ? "Ano da Medição (Afastamento de 3,8 cm/ano):" : "Measurement Year (3.8 cm/year Recession):"}</span>
              <strong id="yearLabelVal">2026</strong>
            </label>
            <input type="range" id="llrYearSlider" min="1969" max="2050" value="2026" />
            <small class="lab-hint" id="yearDriftExplain">
              ${
                isPt
                  ? "Em 57 anos (1969 → 2026), a Lua se afastou +216,6 cm da Terra devido às forças de maré!"
                  : "In 57 years (1969 → 2026), the Moon has drifted +216.6 cm farther from Earth due to tidal forces!"
              }
            </small>
          </div>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector("#laserLabCanvas");
    const ctx = canvas.getContext("2d");
    const fireBtn = this.container.querySelector("#fireLaserBtn");
    const angleSlider = this.container.querySelector("#prismAngleSlider");
    const yearSlider = this.container.querySelector("#llrYearSlider");
    const angleLabel = this.container.querySelector("#angleLabelVal");
    const yearLabel = this.container.querySelector("#yearLabelVal");
    const distVal = this.container.querySelector("#llrDistVal");
    const timeVal = this.container.querySelector("#llrTimeVal");
    const driftSub = this.container.querySelector("#llrDriftSub");
    const driftExplain = this.container.querySelector("#yearDriftExplain");

    let pulseProgress = -1;
    let angleDeg = 14;
    let selectedYear = 2026;

    const updateTelemetry = () => {
      const yearsElapsed = selectedYear - 1969;
      const driftCm = (yearsElapsed * 3.8).toFixed(1);
      const baseKm = 384400 + (yearsElapsed * 0.000038);
      const dt = ((baseKm * 2) / 299792.458).toFixed(4);

      yearLabel.textContent = selectedYear;
      angleLabel.textContent = `${angleDeg > 0 ? "+" : ""}${angleDeg}°`;
      timeVal.textContent = `${dt.replace(".", isPt ? "," : ".")} s`;
      distVal.textContent = `${
        isPt
          ? baseKm.toFixed(2).replace(".", ",")
          : baseKm.toFixed(2)
      } km (+${isPt ? driftCm.replace(".", ",") : driftCm} cm)`;
      driftSub.textContent = `+${isPt ? driftCm.replace(".", ",") : driftCm} cm ${
        isPt ? `desde 1969 (${yearsElapsed} anos)` : `since 1969 (${yearsElapsed} yrs)`
      }`;
      driftExplain.textContent = isPt
        ? `Entre 1969 e ${selectedYear} (${yearsElapsed} anos), os 100 prismas revelaram um afastamento acumulado de +${driftCm.replace(".", ",")} cm!`
        : `Between 1969 and ${selectedYear} (${yearsElapsed} years), the 100 prisms measured a cumulative recession of +${driftCm} cm!`;
    };

    angleSlider.addEventListener("input", (e) => {
      angleDeg = parseInt(e.target.value, 10);
      updateTelemetry();
    });

    yearSlider.addEventListener("input", (e) => {
      selectedYear = parseInt(e.target.value, 10);
      updateTelemetry();
    });

    fireBtn.addEventListener("click", () => {
      pulseProgress = 0;
      if (this.audio) this.audio.playLaserPulse();
    });

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#060D17";
      ctx.fillRect(0, 0, w, h);

      // Earth Observatory on Left
      const ex = 80;
      const ey = h * 0.5;
      ctx.fillStyle = "#2563EB";
      ctx.beginPath();
      ctx.arc(ex, ey, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#60A5FA";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#E2E8F0";
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillText(isPt ? "OBSERVATÓRIO TERRA" : "EARTH OBSERVATORY", 22, ey + 52);

      // Corner-Cube Retroreflector Prism on Right (Moon)
      const px = w - 125;
      const py = h * 0.5;
      const prismSize = 58;

      ctx.save();
      ctx.translate(px, py);
      // Draw 2D Corner-Cube cross-section (90-degree vertex pointing right)
      ctx.fillStyle = "rgba(16, 185, 129, 0.14)";
      ctx.strokeStyle = "#34D399";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-prismSize * 0.5, -prismSize);
      ctx.lineTo(prismSize * 0.5, 0);
      ctx.lineTo(-prismSize * 0.5, prismSize);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "#34D399";
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillText("PRISMA CORNER-CUBE (LUA)", w - 195, py + 76);

      // Ray Tracing (Incoming ray at angleDeg + internal bounce + parallel return ray)
      const offsetY = (angleDeg / 35) * 32;
      const hit1X = px + 14;
      const hit1Y = py - 24 + offsetY * 0.35;
      const hit2X = px + 14;
      const hit2Y = py + 24 + offsetY * 0.35;

      // Incoming Beam (Dashed Green)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.65)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(ex + 32, ey - 10 + offsetY);
      ctx.lineTo(hit1X, hit1Y);
      ctx.stroke();

      // Internal Bounce inside Corner-Cube
      ctx.setLineDash([]);
      ctx.strokeStyle = "#A7F3D0";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hit1X, hit1Y);
      ctx.lineTo(hit2X, hit2Y);
      ctx.stroke();

      // Parallel Reflected Beam Returning to Earth
      ctx.strokeStyle = "#34D399";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hit2X, hit2Y);
      ctx.lineTo(ex + 32, ey + 14 + offsetY);
      ctx.stroke();

      // Animated Pulse Packet if fired
      if (pulseProgress >= 0) {
        pulseProgress += 0.018;
        let dotX, dotY;
        if (pulseProgress <= 1) {
          dotX = ex + 32 + (hit1X - (ex + 32)) * pulseProgress;
          dotY = ey - 10 + offsetY + (hit1Y - (ey - 10 + offsetY)) * pulseProgress;
        } else if (pulseProgress <= 2) {
          const t = pulseProgress - 1;
          dotX = hit2X + (ex + 32 - hit2X) * t;
          dotY = hit2Y + (ey + 14 + offsetY - hit2Y) * t;
        } else {
          pulseProgress = -1;
          if (this.audio) this.audio.playPing(1320, 0.12);
        }

        if (pulseProgress >= 0) {
          ctx.fillStyle = "#6EE7B7";
          ctx.shadowColor = "#10B981";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      this.animFrame = requestAnimationFrame(draw);
    };

    updateTelemetry();
    draw();
  }

  // ==========================================================================
  // LAB 2: PSE — 3-AXIS LUNAR SEISMOGRAPH & NUCLEAR THERMAL SURVIVAL LAB
  // ==========================================================================
  renderSeismicLab(lang) {
    const isPt = lang === "pt";
    this.container.innerHTML = `
      <div class="lab-card">
        <div class="lab-header">
          <div>
            <span class="lab-badge">LABORATÓRIO SISMOLÓGICO // APOLLO 11 PSE</span>
            <h4>${
              isPt
                ? "Sismógrafo de 3 Eixos (Moonquakes) & Luta Térmica Dia/Noite"
                : "3-Axis Lunar Seismograph & Day/Night Thermal Survival"
            }</h4>
          </div>
          <div class="lab-btn-group">
            <button class="btn-secondary lab-sm-btn" data-quake="meteorite">
              ☄️ ${isPt ? "Impacto de Meteorito" : "Meteorite Impact"}
            </button>
            <button class="btn-primary lab-sm-btn" data-quake="moonquake">
              🌋 ${isPt ? "Moonquake Profundo" : "Deep Moonquake"}
            </button>
            <button class="btn-secondary lab-sm-btn" data-quake="footsteps">
              👣 ${isPt ? "Passos de Buzz Aldrin" : "Buzz Aldrin's Steps"}
            </button>
          </div>
        </div>

        <canvas id="seismicLabCanvas" width="680" height="210" class="lab-canvas"></canvas>

        <div class="lab-telemetry-grid">
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Ciclo Ambiental Lunar" : "Lunar Environment Cycle"}</span>
            <strong class="t-value gold" id="pseCycleVal">${isPt ? "Noite Lunar (340h)" : "Lunar Night (340h)"}</strong>
            <span class="t-sub" id="pseSurfaceTemp">${isPt ? "Solo: -170°C" : "Surface: -170°C"}</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Temperatura Interna do PSE" : "PSE Internal Temperature"}</span>
            <strong class="t-value emerald" id="pseCoreTemp">-54,0°C ( Seguro )</strong>
            <span class="t-sub" id="pseHeaterStatus">${
              isPt ? "Aquecedor Nuclear Pu-238: ATIVO" : "Pu-238 Nuclear Heater: ACTIVE"
            }</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Evento Sísmico Detectado" : "Detected Seismic Event"}</span>
            <strong class="t-value cyan" id="pseEventStatus">${
              isPt ? "Aguardando vibração..." : "Awaiting vibration..."
            }</strong>
            <span class="t-sub">${isPt ? "100 a 200 impactos na missão" : "100–200 impacts in mission"}</span>
          </div>
        </div>

        <div class="lab-controls-row">
          <div class="lab-slider-group">
            <label>
              <span>${
                isPt
                  ? "Simulador Térmico (Deslize entre a Noite de -170°C e o Meio-Dia de +120°C):"
                  : "Thermal Simulator (Slide between -170°C Night and +120°C Lunar Noon):"
              }</span>
              <strong id="solarHourLabel">Noite (-170°C)</strong>
            </label>
            <input type="range" id="pseThermalSlider" min="0" max="100" value="15" />
            <small class="lab-hint" id="pseThermalHint">
              ${
                isPt
                  ? "À noite (-170°C), o aquecedor nuclear de radioisótopo impede que o aparelho baixe de -54°C. Ao meio-dia, acione o 'Power Dump' para tentar resfriá-lo!"
                  : "At night (-170°C), the nuclear radioisotope heater keeps the unit at -54°C minimum. At noon, trigger a 'Power Dump' to fight overheating!"
              }
            </small>
          </div>
          <div style="display:flex;align-items:center;">
            <button class="btn-secondary" id="powerDumpBtn">
              ❄️ ${isPt ? "Aplicar Corte de Energia (Power Dump)" : "Apply Cooling Power Dump"}
            </button>
          </div>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector("#seismicLabCanvas");
    const ctx = canvas.getContext("2d");
    const eventStatus = this.container.querySelector("#pseEventStatus");
    const thermalSlider = this.container.querySelector("#pseThermalSlider");
    const cycleVal = this.container.querySelector("#pseCycleVal");
    const surfaceTemp = this.container.querySelector("#pseSurfaceTemp");
    const coreTemp = this.container.querySelector("#pseCoreTemp");
    const heaterStatus = this.container.querySelector("#pseHeaterStatus");
    const solarHourLabel = this.container.querySelector("#solarHourLabel");
    const powerDumpBtn = this.container.querySelector("#powerDumpBtn");

    let amp = 1.5;
    let freq = 0.2;
    let decay = 0.992;
    let coolingOffset = 0;

    this.container.querySelectorAll("[data-quake]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-quake");
        if (type === "meteorite") {
          amp = 32;
          freq = 0.55;
          decay = 0.988;
          eventStatus.textContent = isPt
            ? "Impacto de Meteorito (Ondas P/S)"
            : "Meteorite Impact (P/S Waves)";
          if (this.audio) this.audio.playSeismicRumble(1.3);
        } else if (type === "moonquake") {
          amp = 42;
          freq = 0.28;
          decay = 0.994; // Moonquakes ring for a very long time!
          eventStatus.textContent = isPt
            ? "Moonquake Profundo (Reverberação Longa)"
            : "Deep Moonquake (Long Ringing)";
          if (this.audio) this.audio.playSeismicRumble(0.85);
        } else {
          amp = 16;
          freq = 0.8;
          decay = 0.975;
          eventStatus.textContent = isPt
            ? "Passos de Astronauta a 16,8m"
            : "Astronaut Footsteps at 16.8m";
          if (this.audio) this.audio.playPing(320, 0.1);
        }
      });
    });

    const updateThermal = () => {
      const val = parseInt(thermalSlider.value, 10);
      const extTemp = Math.round(-170 + (val / 100) * 290); // -170°C to +120°C
      surfaceTemp.textContent = `${isPt ? "Solo Lunar" : "Lunar Soil"}: ${extTemp > 0 ? "+" : ""}${extTemp}°C`;

      if (extTemp < -54) {
        // Nuclear RHU clamps internal minimum at -54°C!
        cycleVal.textContent = isPt ? "Noite Lunar (340h)" : "Lunar Night (340h)";
        solarHourLabel.textContent = `${extTemp}°C (Noite)`;
        coreTemp.textContent = "-54,0°C (Protegido)";
        coreTemp.className = "t-value emerald";
        heaterStatus.textContent = isPt
          ? "Aquecedor Nuclear (Radioisótopo): ATIVO • Painéis Solares: STANDBY"
          : "Radioisotope Heater: ACTIVE • Solar Panels: STANDBY";
      } else if (extTemp <= 65) {
        const internal = Math.round(extTemp * 0.7 - coolingOffset);
        cycleVal.textContent = isPt ? "Manhã / Tarde Lunar" : "Lunar Morning / Afternoon";
        solarHourLabel.textContent = `+${extTemp}°C (Dia Operacional)`;
        coreTemp.textContent = `${internal}°C (Operação Nominal)`;
        coreTemp.className = "t-value cyan";
        heaterStatus.textContent = isPt
          ? "Painéis Solares: GERANDO ENERGIA"
          : "Solar Panels: GENERATING POWER";
      } else {
        const internal = Math.max(45, Math.round(extTemp * 0.85 - coolingOffset));
        cycleVal.textContent = isPt ? "Meio-Dia Escaldante!" : "Scorching Lunar Noon!";
        solarHourLabel.textContent = `+${extTemp}°C (Alerta Térmico!)`;
        if (internal > 75) {
          coreTemp.textContent = `+${internal}°C (SUPERAQUECIMENTO!)`;
          coreTemp.className = "t-value gold";
          heaterStatus.textContent = isPt
            ? "Risco de falha (como ocorreu em 25/08/1969 às 04:00 UT)!"
            : "Risk of failure (as occurred Aug 25, 1969 at 04:00 UT)!";
        } else {
          coreTemp.textContent = `+${internal}°C (Resfriado por Power Dump)`;
          coreTemp.className = "t-value emerald";
          heaterStatus.textContent = isPt
            ? "Power Dump ativo estabilizando eletrônica!"
            : "Power Dump active stabilizing electronics!";
        }
      }
    };

    thermalSlider.addEventListener("input", () => {
      coolingOffset = 0;
      updateThermal();
    });

    powerDumpBtn.addEventListener("click", () => {
      coolingOffset = 32;
      if (this.audio) this.audio.playPing(660, 0.12);
      updateThermal();
    });

    const historyZ = new Array(170).fill(0);
    const historyNS = new Array(170).fill(0);
    const historyEW = new Array(170).fill(0);
    let tick = 0;

    const drawSeismograph = () => {
      tick++;
      amp = Math.max(0.8, amp * decay);

      const zVal = Math.sin(tick * freq) * amp * (0.7 + Math.random() * 0.5);
      const nsVal = Math.cos(tick * freq * 0.85 + 1) * amp * 0.75 * (0.7 + Math.random() * 0.5);
      const ewVal = Math.sin(tick * freq * 1.15 + 2) * amp * 0.65 * (0.7 + Math.random() * 0.5);

      historyZ.push(zVal);
      historyZ.shift();
      historyNS.push(nsVal);
      historyNS.shift();
      historyEW.push(ewVal);
      historyEW.shift();

      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#080B12";
      ctx.fillRect(0, 0, w, h);

      const channels = [
        { label: "EIXO Z (CIMA-BAIXO)", y: 42, data: historyZ, color: "#FBBF24" },
        { label: "EIXO N-S (NORTE-SUL)", y: 105, data: historyNS, color: "#38BDF8" },
        { label: "EIXO L-O (LESTE-OESTE)", y: 168, data: historyEW, color: "#34D399" }
      ];

      channels.forEach((ch) => {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ch.y);
        ctx.lineTo(w, ch.y);
        ctx.stroke();

        ctx.fillStyle = ch.color;
        ctx.font = "600 10px 'JetBrains Mono', monospace";
        ctx.fillText(ch.label, 12, ch.y - 18);

        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ch.data.forEach((v, i) => {
          const x = (i / (ch.data.length - 1)) * w;
          const y = ch.y + Math.max(-26, Math.min(26, v));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });

      this.animFrame = requestAnimationFrame(drawSeismograph);
    };

    updateThermal();
    drawSeismograph();
  }

  // ==========================================================================
  // LAB 3: LRV — DIRECTIONAL GYROSCOPE ("ARIADNE'S THREAD") & ED FENDELL CAMERA
  // ==========================================================================
  renderRoverLab(lang) {
    const isPt = lang === "pt";
    this.container.innerHTML = `
      <div class="lab-card">
        <div class="lab-header">
          <div>
            <span class="lab-badge">PAINEL DE NAVEGAÇÃO LRV // GIROSCÓPIO & CÂMERA DE ED FENDELL</span>
            <h4>${
              isPt
                ? "Navegação Sem Bússola ('Fio de Ariadne') & A Despedida da Apollo 17"
                : "Compass-Free Gyro Navigation ('Ariadne's Thread') & Apollo 17 Liftoff"
            }</h4>
          </div>
          <div class="lab-btn-group">
            <button class="btn-secondary lab-sm-btn" data-stop="seatbelt">
              🪨 ${isPt ? "Apollo 15: Seatbelt Basalt" : "Apollo 15: Seatbelt Basalt"}
            </button>
            <button class="btn-secondary lab-sm-btn" data-stop="fender">
              🛠️ ${isPt ? "Apollo 17: Reparo do Para-lama" : "Apollo 17: Fender Repair"}
            </button>
            <button class="btn-primary lab-sm-btn" data-stop="liftoff">
              🎥 ${isPt ? "Ed Fendell: Filmar Decolagem!" : "Ed Fendell: Film Liftoff!"}
            </button>
          </div>
        </div>

        <canvas id="roverLabCanvas" width="680" height="220" class="lab-canvas"></canvas>

        <div class="lab-telemetry-grid">
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Fio de Ariadne (Seta p/ Módulo Lunar)" : "Ariadne's Thread (Bearing to LM)"}</span>
            <strong class="t-value gold" id="lrvBearingVal">248° WSW (Direto p/ Casa)</strong>
            <span class="t-sub">${isPt ? "Giroscópio Direcional + 4 Odômetros" : "Directional Gyro + 4 Wheel Odometers"}</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Distância do Módulo / Odômetro" : "Range to LM / Total Odometer"}</span>
            <strong class="t-value cyan" id="lrvRangeVal">7,6 km / 35,9 km</strong>
            <span class="t-sub">${isPt ? "Soma das 3 missões: 90,5 km" : "Combined 3 missions: 90.5 km"}</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Episódio Ativo no Simulador" : "Active Mission Episode"}</span>
            <strong class="t-value emerald" id="lrvEpisodeTitle">${
              isPt ? "Taurus-Littrow (Apollo 17)" : "Taurus-Littrow (Apollo 17)"
            }</strong>
            <span class="t-sub" id="lrvEpisodeSub">${
              isPt ? "Clique nos botões acima para simular" : "Click the buttons above to simulate"
            }</span>
          </div>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector("#roverLabCanvas");
    const ctx = canvas.getContext("2d");
    const bearingEl = this.container.querySelector("#lrvBearingVal");
    const rangeEl = this.container.querySelector("#lrvRangeVal");
    const epTitle = this.container.querySelector("#lrvEpisodeTitle");
    const epSub = this.container.querySelector("#lrvEpisodeSub");

    let mode = "seatbelt";
    let liftoffY = 0;
    let cameraTiltDeg = 5;

    this.container.querySelectorAll("[data-stop]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.getAttribute("data-stop");
        liftoffY = 0;
        cameraTiltDeg = 5;
        if (this.audio) this.audio.playQuindarTone(true);

        if (mode === "seatbelt") {
          bearingEl.textContent = "132° SE (Seta p/ LM Falcon)";
          rangeEl.textContent = "4,8 km / 27,9 km (Apollo 15)";
          epTitle.textContent = isPt
            ? "O Segredo do 'Seatbelt Basalt'"
            : "The 'Seatbelt Basalt' Prank";
          epSub.textContent = isPt
            ? "Scott e Irwin fingiram defeito no cinto para pegar um basalto cheio de bolhas!"
            : "Scott & Irwin faked a seatbelt issue to grab a vesicular volcanic rock!";
        } else if (mode === "fender") {
          bearingEl.textContent = "248° WSW (Seta p/ LM Challenger)";
          rangeEl.textContent = "7,6 km / 35,9 km (Apollo 17)";
          epTitle.textContent = isPt
            ? "Reparo com Mapas e Fita Adesiva"
            : "Lunar Map & Duct Tape Fender Fix";
          epSub.textContent = isPt
            ? "Para-lama traseiro direito consertado contra a chuva de poeira abrasiva!"
            : "Right-rear fender improvised with laminated lunar maps & clamps!";
        } else {
          bearingEl.textContent = "090° E (Estacionado a 145 m do LM)";
          rangeEl.textContent = "0,14 km / 90,5 km Totais";
          epTitle.textContent = isPt
            ? "14 Dez 1972: 'Ignition!' (Câmera de Ed Fendell)"
            : "Dec 14, 1972: 'Ignition!' (Ed Fendell Camera)";
          epSub.textContent = isPt
            ? "Ed Fendell em Houston inclina a lente (+1,28s delay) e filma a subida às estrelas!"
            : "Ed Fendell in Houston tilts the lens (+1.28s delay) to film the ascent to the stars!";
        }
      });
    });

    const drawRoverSim = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#060B14";
      ctx.fillRect(0, 0, w, h);

      // Left Panel: Authentic Apollo LRV Gyroscope Compass Dial ("Ariadne's Thread")
      const dialX = 115;
      const dialY = h * 0.5;
      const dialR = 68;

      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 9.5px 'JetBrains Mono', monospace";
      ctx.fillText("N", dialX - 3, dialY - dialR + 12);
      ctx.fillText("S", dialX - 3, dialY + dialR - 5);
      ctx.fillText("E", dialX + dialR - 11, dialY + 3);
      ctx.fillText("O", dialX - dialR + 5, dialY + 3);

      // Ariadne's Thread Golden Arrow pointing back to Lunar Module
      const targetAngle = mode === "seatbelt" ? 2.1 : mode === "fender" ? 4.1 : 1.57;
      ctx.save();
      ctx.translate(dialX, dialY);
      ctx.rotate(targetAngle);
      ctx.strokeStyle = "#FBBF24";
      ctx.fillStyle = "#FBBF24";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 32);
      ctx.lineTo(0, -42);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(-7, -34);
      ctx.lineTo(7, -34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#FBBF24";
      ctx.font = "600 9.5px 'JetBrains Mono', monospace";
      ctx.fillText(isPt ? "SETA P/ MÓDULO LUNAR" : "ARROW TO LUNAR MODULE", 48, h - 14);

      // Right Viewport: Scene Animation (LRV + Challenger Liftoff / Camera View)
      const sceneX = 230;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      ctx.beginPath();
      ctx.moveTo(sceneX, 12);
      ctx.lineTo(sceneX, h - 12);
      ctx.stroke();

      // Lunar Ground in Right Scene
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(sceneX + 10, h - 42, w - sceneX - 20, 30);

      // Mini LRV parked on Left of Scene
      const rvx = sceneX + 75;
      const rvy = h - 54;
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rvx - 18, rvy + 8, 9, 0, Math.PI * 2);
      ctx.arc(rvx + 18, rvy + 8, 9, 0, Math.PI * 2);
      ctx.moveTo(rvx - 22, rvy);
      ctx.lineTo(rvx + 22, rvy);
      ctx.stroke();

      if (mode === "liftoff") {
        liftoffY = (liftoffY + 0.85) % 135;
        cameraTiltDeg = Math.min(58, Math.round(5 + liftoffY * 0.42));
      } else {
        liftoffY = 0;
        cameraTiltDeg = 8;
      }

      // Ed Fendell TV Camera Field-of-View Cone tilting up!
      const tiltRad = (-cameraTiltDeg * Math.PI) / 180;
      ctx.save();
      ctx.translate(rvx + 15, rvy - 6);
      ctx.rotate(tiltRad);
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(260, -42);
      ctx.lineTo(260, 42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Lunar Module Descent Stage on Right + Ascending Challenger Stage!
      const lmx = w - 115;
      const lmy = h - 52;
      ctx.fillStyle = "#EAB308";
      ctx.fillRect(lmx - 20, lmy, 40, 12);

      // Ascent stage rising when in liftoff mode
      const ascentY = lmy - 18 - liftoffY;
      ctx.fillStyle = "#E2E8F0";
      ctx.beginPath();
      ctx.arc(lmx, ascentY, 13, 0, Math.PI * 2);
      ctx.fill();

      if (mode === "liftoff" && liftoffY > 2) {
        // Rocket plume
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.moveTo(lmx - 7, ascentY + 12);
        ctx.lineTo(lmx + 7, ascentY + 12);
        ctx.lineTo(lmx, ascentY + 32);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = "#BAE6FD";
      ctx.font = "600 10.5px 'JetBrains Mono', monospace";
      ctx.fillText(
        mode === "liftoff"
          ? `CÂMERA DE ED FENDELL // TILT: +${cameraTiltDeg}° (TRANSMISSÃO AO VIVO)`
          : mode === "seatbelt"
          ? "PARADA SECRETA: BASALTO DO CINTO DE SEGURANÇA (77,31 KG AMOSTRAS)"
          : "REPARO DE EMERGÊNCIA: MAPA LUNAR + FITA NO PARA-LAMA TRASEIRO",
        sceneX + 24,
        28
      );

      this.animFrame = requestAnimationFrame(drawRoverSim);
    };

    drawRoverSim();
  }

  // ==========================================================================
  // LAB 4: EAGLE — 1/6 LUNAR GRAVITY & TRANQUILITY BASE PLAQUE INSPECTOR
  // ==========================================================================
  renderEagleLab(lang) {
    const isPt = lang === "pt";
    this.container.innerHTML = `
      <div class="lab-card">
        <div class="lab-header">
          <div>
            <span class="lab-badge">LABORATÓRIO BASE TRANQUILIDADE // GRAVIDADE 1/6 & PLACA HISTÓRICA</span>
            <h4>${
              isPt
                ? "Simulador de Gravidade Lunar (1/6) & A Placa da Escada da Eagle"
                : "Lunar 1/6 Gravity Comparator & Eagle's Ladder Plaque"
            }</h4>
          </div>
        </div>

        <div class="lab-telemetry-grid">
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Rover LRV Vazio (Terra → Lua)" : "Empty LRV Rover (Earth → Moon)"}</span>
            <strong class="t-value cyan">210 kg → 35 kg</strong>
            <span class="t-sub">${isPt ? "Carrega +490 kg de carga útil!" : "Carries +490 kg payload!"}</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Amostras da Apollo 11" : "Apollo 11 Rock Samples"}</span>
            <strong class="t-value gold">21,55 kg → 3,59 kg</strong>
            <span class="t-sub">${isPt ? "Quarentena até 10/08/1969" : "Quarantined until Aug 10, 1969"}</span>
          </div>
          <div class="telemetry-box">
            <span class="t-label">${isPt ? "Precisão Translunar Apollo 11" : "Apollo 11 Translunar Precision"}</span>
            <strong class="t-value emerald">Erro: 1,6 pé/s</strong>
            <span class="t-sub">${isPt ? "12 min de descida motorizada" : "12 min powered descent"}</span>
          </div>
        </div>

        <div class="plaque-showcase">
          <div class="plaque-metal">
            <div class="plaque-header">HERE MEN FROM THE PLANET EARTH</div>
            <div class="plaque-body">
              FIRST SET FOOT UPON THE MOON<br/>
              JULY 1969, A.D.<br/>
              <strong>WE CAME IN PEACE FOR ALL MANKIND</strong>
            </div>
            <div class="plaque-sigs">
              <span>Neil A. Armstrong</span>
              <span>Michael Collins</span>
              <span>Edwin E. Aldrin, Jr.</span>
              <span>Richard Nixon</span>
            </div>
          </div>
          <div class="plaque-translation">
            <h5>${isPt ? "Tradução & Significado Histórico:" : "Historical Context & Legacy:"}</h5>
            <p>
              ${
                isPt
                  ? "\"Aqui homens do planeta Terra pisaram pela primeira vez na Lua. Julho de 1969 d.C. Viemos em paz por toda a humanidade.\" — Gravada em aço inoxidável presa entre o terceiro e o quarto degrau da perna dianteira do Estágio de Descida da Eagle, ela permanece intocada no vácuo do Mar da Tranquilidade (0° 41' 15\" N, 23° 26' E)."
                  : "Mounted on the front landing strut between the third and fourth ladder rungs of Eagle's Descent Stage, this stainless-steel plaque remains untouched in the vacuum of Mare Tranquillitatis (0° 41' 15\" N, 23° 26' E)."
              }
            </p>
          </div>
        </div>
      </div>
    `;
  }
}
