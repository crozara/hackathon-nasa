// ============================================================================
// THE SILENT MUSEUM: INTERACTIVE 3D LUNAR GLOBE & ORBITAL TELEMETRY ENGINE
// Pure HTML5 Canvas 3D Spherical Projection with Selenographic Maria, Craters,
// Earth-Moon Laser Ranging Pulse, NASA Exclusion Zones & Interactive Beacons
// ============================================================================

export class LunarGlobe3D {
  constructor(canvas, artifacts, onSelectArtifact) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.artifacts = artifacts;
    this.onSelectArtifact = onSelectArtifact;

    // Camera / Globe rotation state (in radians)
    this.rotLon = -0.42; // Centered near Mare Tranquillitatis & Taurus-Littrow
    this.rotLat = 0.16;
    this.targetRotLon = -0.42;
    this.targetRotLat = 0.16;
    this.zoom = 1.0;
    this.targetZoom = 1.0;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.velLon = 0.0007;
    this.autoRotate = true;

    // Toggles
    this.showGrid = true;
    this.showLaser = true;
    this.showZones = true;

    this.selectedArtifactId = "lrrr";
    this.hoveredBeacon = null;
    this.projectedBeacons = [];
    this.time = 0;

    this.initSceneData();
    this.bindEvents();
    this.resize();
    this.animate();
  }

  initSceneData() {
    // Deep-space starfield
    this.stars = Array.from({ length: 240 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.7 + 0.2,
      twinkleSpeed: Math.random() * 0.03 + 0.01,
      phase: Math.random() * Math.PI * 2
    }));

    // Real Selenographic Lunar Maria (Dark Basaltic Plains)
    this.maria = [
      { name: "Mare Tranquillitatis", lat: 8.5, lon: 31.4, rx: 16, ry: 14, shade: 0.34 },
      { name: "Mare Serenitatis", lat: 28.0, lon: 17.5, rx: 15, ry: 14, shade: 0.36 },
      { name: "Mare Imbrium", lat: 33.0, lon: -16.0, rx: 24, ry: 21, shade: 0.35 },
      { name: "Oceanus Procellarum", lat: 18.0, lon: -52.0, rx: 26, ry: 34, shade: 0.31 },
      { name: "Mare Crisium", lat: 17.0, lon: 59.0, rx: 10, ry: 12, shade: 0.38 },
      { name: "Mare Foecunditatis", lat: -8.0, lon: 51.0, rx: 14, ry: 18, shade: 0.32 },
      { name: "Mare Nectaris", lat: -15.2, lon: 35.5, rx: 9, ry: 9, shade: 0.33 },
      { name: "Mare Nubium", lat: -21.0, lon: -17.0, rx: 16, ry: 15, shade: 0.31 },
      { name: "Mare Humorum", lat: -24.4, lon: -38.6, rx: 11, ry: 11, shade: 0.34 },
      { name: "Sinus Iridum", lat: 44.1, lon: -31.5, rx: 8, ry: 7, shade: 0.32 }
    ];

    // Iconic Lunar Craters (with ray systems for Tycho, Copernicus, Kepler)
    this.craters = [
      { name: "Tycho", lat: -43.3, lon: -11.4, r: 6.5, rays: true, bright: 0.85 },
      { name: "Copernicus", lat: 9.6, lon: -20.1, r: 7.2, rays: true, bright: 0.82 },
      { name: "Kepler", lat: 8.1, lon: -38.0, r: 4.5, rays: true, bright: 0.78 },
      { name: "Aristarchus", lat: 23.7, lon: -47.4, r: 4.2, rays: true, bright: 0.92 },
      { name: "Plato", lat: 51.6, lon: -9.3, r: 6.8, rays: false, darkFloor: true },
      { name: "Archimedes", lat: 29.7, lon: -4.0, r: 5.2, rays: false, darkFloor: true },
      { name: "Theophilus", lat: -11.4, lon: 26.4, r: 5.8, rays: false, bright: 0.6 },
      { name: "Ptolemaeus", lat: -9.2, lon: -1.8, r: 7.8, rays: false, bright: 0.55 },
      { name: "Clavius", lat: -58.4, lon: -14.4, r: 10.5, rays: false, bright: 0.52 },
      { name: "Langrenus", lat: -8.9, lon: 61.1, r: 6.4, rays: false, bright: 0.68 }
    ];

    // Procedural secondary highland craters (deterministic seed)
    let seed = 19690720;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 95; i++) {
      const lat = (rand() - 0.5) * 155;
      const lon = (rand() - 0.5) * 340;
      const r = rand() * 3.8 + 1.1;
      this.craters.push({
        name: null,
        lat,
        lon,
        r,
        rays: false,
        bright: 0.45 + rand() * 0.25
      });
    }

    // All historical beacons shown on the globe (including all 3 LRV sites!)
    this.beacons = [
      {
        id: "lrrr",
        artifactId: "lrrr",
        code: "LRRR // APOLLO 11",
        shortLabel: "Retrorefletor Laser",
        lat: 0.67,
        lon: 23.47,
        offsetPx: { x: -46, y: -32 },
        color: "#10B981",
        zoneRadiusMeters: 100
      },
      {
        id: "pse",
        artifactId: "pse",
        code: "PSE // APOLLO 11",
        shortLabel: "Sismômetro Passivo",
        lat: -1.8, // Slight visual separation from LRRR at Tranquility Base so both pins are easy to click
        lon: 20.8,
        realLat: 0.67,
        realLon: 23.47,
        offsetPx: { x: -52, y: 28 },
        color: "#F59E0B",
        zoneRadiusMeters: 100
      },
      {
        id: "eagle",
        artifactId: "eagle",
        code: "LM-5 EAGLE // APOLLO 11",
        shortLabel: "Módulo Eagle (Base)",
        lat: 2.8,
        lon: 26.2,
        realLat: 0.67,
        realLon: 23.47,
        offsetPx: { x: 48, y: 24 },
        color: "#EAB308",
        zoneRadiusMeters: 100
      },
      {
        id: "lrv",
        artifactId: "lrv",
        code: "LRV-3 // APOLLO 17",
        shortLabel: "Rover Lunar (Taurus-Littrow)",
        lat: 20.19,
        lon: 30.77,
        offsetPx: { x: 46, y: -28 },
        color: "#38BDF8",
        zoneRadiusMeters: 225
      },
      {
        id: "lrv-a15",
        artifactId: "lrv",
        code: "LRV-1 // APOLLO 15",
        shortLabel: "Rover LRV-1 (Hadley-Apennine)",
        lat: 26.13,
        lon: 3.63,
        offsetPx: { x: -42, y: -24 },
        color: "#38BDF8",
        isSecondaryRover: true,
        zoneRadiusMeters: 225
      },
      {
        id: "lrv-a16",
        artifactId: "lrv",
        code: "LRV-2 // APOLLO 16",
        shortLabel: "Rover LRV-2 (Descartes)",
        lat: -8.97,
        lon: 15.5,
        offsetPx: { x: -38, y: 26 },
        color: "#38BDF8",
        isSecondaryRover: true,
        zoneRadiusMeters: 225
      }
    ];
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("pointerdown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check if user clicked a beacon or callout pill
      const hit = this.findHitBeacon(mx, my);
      if (hit) {
        this.focusOnBeacon(hit);
        if (this.onSelectArtifact) {
          this.onSelectArtifact(hit.artifactId);
        }
        return;
      }

      this.isDragging = true;
      this.autoRotate = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.canvas.style.cursor = "grabbing";
    });

    window.addEventListener("pointermove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        this.targetRotLon -= dx * 0.0065;
        this.targetRotLat = Math.max(-1.1, Math.min(1.1, this.targetRotLat + dy * 0.0065));
        this.rotLon = this.targetRotLon;
        this.rotLat = this.targetRotLat;
        return;
      }

      // Check hover
      if (
        mx >= 0 &&
        mx <= rect.width &&
        my >= 0 &&
        my <= rect.height
      ) {
        const hit = this.findHitBeacon(mx, my);
        this.hoveredBeacon = hit;
        this.canvas.style.cursor = hit ? "pointer" : "grab";
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = "grab";
      }
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        this.targetZoom = Math.max(0.78, Math.min(1.55, this.targetZoom + delta));
      },
      { passive: false }
    );
  }

  findHitBeacon(mx, my) {
    for (const b of this.projectedBeacons) {
      if (!b.visible) continue;
      const distPin = Math.hypot(mx - b.px, my - b.py);
      if (distPin < 22) return b;
      if (
        b.box &&
        mx >= b.box.x &&
        mx <= b.box.x + b.box.w &&
        my >= b.box.y &&
        my <= b.box.y + b.box.h
      ) {
        return b;
      }
    }
    return null;
  }

  selectArtifact(artifactId) {
    this.selectedArtifactId = artifactId;
    const beacon = this.beacons.find((b) => b.artifactId === artifactId && !b.isSecondaryRover);
    if (beacon) {
      this.focusOnBeacon(beacon);
    }
  }

  focusOnBeacon(beacon) {
    this.autoRotate = false;
    this.targetRotLon = (-beacon.lon * Math.PI) / 180;
    this.targetRotLat = (beacon.lat * Math.PI) / 180;
    this.targetZoom = 1.15;
  }

  resetCamera() {
    this.targetRotLon = -0.42;
    this.targetRotLat = 0.16;
    this.targetZoom = 1.0;
    this.autoRotate = true;
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width || 640;
    this.height = rect.height || 520;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Project selenographic (lat, lon in degrees) onto 3D Orthographic Sphere
  projectLatLon(latDeg, lonDeg, cx, cy, radius) {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180 + this.rotLon;

    const x = Math.cos(lat) * Math.sin(lon);
    const y =
      Math.sin(lat) * Math.cos(this.rotLat) -
      Math.cos(lat) * Math.cos(lon) * Math.sin(this.rotLat);
    const z =
      Math.sin(lat) * Math.sin(this.rotLat) +
      Math.cos(lat) * Math.cos(lon) * Math.cos(this.rotLat);

    return {
      x: cx + x * radius,
      y: cy - y * radius,
      z,
      visible: z > 0.02
    };
  }

  animate() {
    this.time += 0.016;

    if (this.autoRotate && !this.isDragging) {
      this.targetRotLon += 0.0008;
    }

    // Smooth damping toward target camera rotation & zoom
    this.rotLon += (this.targetRotLon - this.rotLon) * 0.08;
    this.rotLat += (this.targetRotLat - this.rotLat) * 0.08;
    this.zoom += (this.targetZoom - this.zoom) * 0.08;

    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w * 0.5;
    const cy = h * 0.51;
    const baseRadius = Math.min(w, h) * 0.34 * this.zoom;

    ctx.clearRect(0, 0, w, h);

    // 1. Deep-Space Starfield
    this.stars.forEach((s) => {
      const twinkle = Math.sin(this.time * 60 * s.twinkleSpeed + s.phase) * 0.25 + 0.75;
      ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Distant Blue Earth in Top-Left Sky ("The Blue Marble" watching the Moon)
    const earthX = w * 0.13;
    const earthY = h * 0.18;
    const earthR = Math.max(18, Math.min(w, h) * 0.042);
    this.renderDistantEarth(ctx, earthX, earthY, earthR);

    // 3. Outer Lunar Orbital Telemetry Rings
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.11)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Lunar Horizon Atmospheric / Regolith Rim Glow
    const halo = ctx.createRadialGradient(
      cx - baseRadius * 0.2,
      cy - baseRadius * 0.2,
      baseRadius * 0.82,
      cx,
      cy,
      baseRadius * 1.14
    );
    halo.addColorStop(0, "rgba(226, 232, 240, 0.14)");
    halo.addColorStop(0.6, "rgba(56, 189, 248, 0.05)");
    halo.addColorStop(1, "rgba(5, 7, 11, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.14, 0, Math.PI * 2);
    ctx.fill();

    // 5. Clip to 3D Lunar Sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.clip();

    // Base Lunar Highland Albedo (Lit from Top-Left Sun)
    const sphereGrad = ctx.createRadialGradient(
      cx - baseRadius * 0.34,
      cy - baseRadius * 0.32,
      baseRadius * 0.08,
      cx + baseRadius * 0.15,
      cy + baseRadius * 0.15,
      baseRadius * 1.08
    );
    sphereGrad.addColorStop(0, "#E2E8F0");
    sphereGrad.addColorStop(0.38, "#CBD5E1");
    sphereGrad.addColorStop(0.72, "#64748B");
    sphereGrad.addColorStop(0.93, "#1E293B");
    sphereGrad.addColorStop(1, "#090D16");
    ctx.fillStyle = sphereGrad;
    ctx.fillRect(cx - baseRadius, cy - baseRadius, baseRadius * 2, baseRadius * 2);

    // 6. Render Lunar Maria (Dark Basaltic Plains)
    this.maria.forEach((m) => {
      const p = this.projectLatLon(m.lat, m.lon, cx, cy, baseRadius);
      if (p.z > -0.2) {
        const foreshorten = Math.max(0.25, p.z);
        const rx = (m.rx / 90) * baseRadius * 1.45;
        const ry = (m.ry / 90) * baseRadius * 1.45 * foreshorten;

        const mGrad = ctx.createRadialGradient(p.x, p.y, rx * 0.1, p.x, p.y, rx);
        mGrad.addColorStop(0, `rgba(30, 41, 59, ${m.shade * Math.min(1, p.z + 0.3)})`);
        mGrad.addColorStop(0.65, `rgba(30, 41, 59, ${m.shade * 0.65 * Math.min(1, p.z + 0.3)})`);
        mGrad.addColorStop(1, "rgba(30, 41, 59, 0)");

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, ry / Math.max(1, rx));
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 7. Render Lunar Craters & Ray Systems
    this.craters.forEach((c) => {
      const p = this.projectLatLon(c.lat, c.lon, cx, cy, baseRadius);
      if (!p.visible) return;
      const rPx = (c.r / 90) * baseRadius * 1.2;
      const scaleY = Math.max(0.35, p.z);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, scaleY);

      // Ejecta rays for major craters (Tycho, Copernicus, Kepler, Aristarchus)
      if (c.rays && p.z > 0.2) {
        ctx.strokeStyle = `rgba(248, 250, 252, ${0.14 * p.z})`;
        ctx.lineWidth = 1.1;
        for (let a = 0; a < 12; a++) {
          const ang = (a * Math.PI) / 6 + c.lat;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * rPx, Math.sin(ang) * rPx);
          ctx.lineTo(Math.cos(ang) * rPx * 4.2, Math.sin(ang) * rPx * 4.2);
          ctx.stroke();
        }
      }

      // Crater shadow wall (top-left inner shadow)
      ctx.fillStyle = c.darkFloor
        ? `rgba(15, 23, 42, ${0.48 * p.z})`
        : `rgba(15, 23, 42, ${0.28 * p.z})`;
      ctx.beginPath();
      ctx.arc(0, 0, rPx, 0, Math.PI * 2);
      ctx.fill();

      // Sunlit crater rim (bottom-right highlight)
      ctx.strokeStyle = `rgba(248, 250, 252, ${0.42 * p.z})`;
      ctx.lineWidth = Math.max(0.8, rPx * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, rPx, -0.3, Math.PI * 0.85);
      ctx.stroke();

      ctx.restore();
    });

    // 8. Selenographic Latitude / Longitude Grid
    if (this.showGrid) {
      ctx.strokeStyle = "rgba(226, 232, 240, 0.13)";
      ctx.lineWidth = 0.8;

      // Parallels (Latitude lines)
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const p = this.projectLatLon(lat, lon, cx, cy, baseRadius);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Meridians (Longitude lines)
      for (let lon = -150; lon <= 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -84; lat <= 84; lat += 6) {
          const p = this.projectLatLon(lat, lon, cx, cy, baseRadius);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }
    }

    // 9. Lunar Day/Night Terminator Vignette
    const termGrad = ctx.createRadialGradient(
      cx - baseRadius * 0.42,
      cy - baseRadius * 0.35,
      baseRadius * 0.5,
      cx + baseRadius * 0.3,
      cy + baseRadius * 0.3,
      baseRadius * 1.25
    );
    termGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    termGrad.addColorStop(0.7, "rgba(5, 7, 11, 0.18)");
    termGrad.addColorStop(1, "rgba(5, 7, 11, 0.82)");
    ctx.fillStyle = termGrad;
    ctx.fillRect(cx - baseRadius, cy - baseRadius, baseRadius * 2, baseRadius * 2);

    ctx.restore(); // End Sphere Clip

    // Crisp Specular Rim Border on Lunar Sphere
    ctx.strokeStyle = "rgba(226, 232, 240, 0.24)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 10. Project Beacons & Render NASA Exclusion Zones + Earth-Moon Laser Beam
    this.projectedBeacons = this.beacons.map((b) => {
      const p = this.projectLatLon(b.lat, b.lon, cx, cy, baseRadius);
      return {
        ...b,
        px: p.x,
        py: p.y,
        pz: p.z,
        visible: p.visible
      };
    });

    // Earth-to-Moon Laser Ranging Beam (to LRRR at Mare Tranquillitatis)
    const lrrrBeacon = this.projectedBeacons.find((b) => b.id === "lrrr");
    if (this.showLaser && lrrrBeacon && lrrrBeacon.visible) {
      this.renderLaserBeam(ctx, earthX, earthY, lrrrBeacon.px, lrrrBeacon.py);
    }

    // Render Beacons & Telemetry Callouts
    this.projectedBeacons.forEach((b) => {
      if (!b.visible) return;
      const isSelected = b.artifactId === this.selectedArtifactId;
      const isHovered = this.hoveredBeacon && this.hoveredBeacon.id === b.id;

      // NASA Exclusion Zone Ring (225m / 100m buffer protection)
      if (this.showZones) {
        const zonePulse = (Math.sin(this.time * 2.5) * 0.5 + 0.5) * 8;
        ctx.save();
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = isSelected ? 0.55 : 0.25;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(b.px, b.py, (b.isSecondaryRover ? 13 : 18) + zonePulse * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Outer Sonar Pulse
      const pulseR = 8 + ((this.time * 18) % 18);
      const pulseAlpha = Math.max(0, 1 - (pulseR - 8) / 18);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = isSelected ? pulseAlpha * 0.9 : pulseAlpha * 0.45;
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(b.px, b.py, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Center Beacon Core
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = isSelected || isHovered ? 14 : 6;
      ctx.beginPath();
      ctx.arc(b.px, b.py, isSelected ? 6.5 : b.isSecondaryRover ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.px, b.py, isSelected ? 2.5 : 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Telemetry Leader Line & Floating Callout Pill
      if (!b.isSecondaryRover || isSelected || isHovered) {
        const lx = b.px + b.offsetPx.x;
        const ly = b.py + b.offsetPx.y;

        ctx.strokeStyle = isSelected ? b.color : "rgba(226, 232, 240, 0.45)";
        ctx.lineWidth = isSelected ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(b.px, b.py);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        ctx.font = "600 10.5px 'JetBrains Mono', monospace";
        const textWidth = ctx.measureText(b.code).width;
        const boxW = textWidth + 18;
        const boxH = 22;
        const boxX = b.offsetPx.x >= 0 ? lx : lx - boxW;
        const boxY = ly - boxH / 2;

        b.box = { x: boxX, y: boxY, w: boxW, h: boxH };

        ctx.fillStyle = isSelected
          ? "rgba(15, 23, 42, 0.94)"
          : "rgba(9, 13, 22, 0.82)";
        ctx.strokeStyle = isSelected || isHovered ? b.color : "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = isSelected ? 1.5 : 1;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? "#FFFFFF" : "#CBD5E1";
        ctx.textBaseline = "middle";
        ctx.fillText(b.code, boxX + 9, boxY + boxH / 2);
      }
    });

    // 11. Render Apollo Hasselblad Réseau Crosshairs (+ fiducial marks)
    this.renderHasselbladFiducials(ctx, w, h);
  }

  renderDistantEarth(ctx, x, y, r) {
    ctx.save();
    // Atmospheric blue glow
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.1);
    glow.addColorStop(0, "rgba(56, 189, 248, 0.45)");
    glow.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Earth Ocean & Clouds
    const earthGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    earthGrad.addColorStop(0, "#93C5FD");
    earthGrad.addColorStop(0.45, "#2563EB");
    earthGrad.addColorStop(0.85, "#1E3A8A");
    earthGrad.addColorStop(1, "#090D16");
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(147, 197, 253, 0.85)";
    ctx.fillText("TERRA // 384.400 KM", x - r, y + r + 14);
    ctx.restore();
  }

  renderLaserBeam(ctx, x1, y1, x2, y2) {
    ctx.save();
    // Base laser line
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, "rgba(16, 185, 129, 0.35)");
    grad.addColorStop(0.5, "rgba(52, 211, 153, 0.7)");
    grad.addColorStop(1, "rgba(16, 185, 129, 0.95)");

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -this.time * 45;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Round-trip photon packet (forward & reflected back!)
    const cycle = (this.time * 0.65) % 2;
    const t = cycle <= 1 ? cycle : 2 - cycle;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;

    ctx.fillStyle = "#34D399";
    ctx.shadowColor = "#10B981";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderHasselbladFiducials(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(226, 232, 240, 0.16)";
    ctx.lineWidth = 1;
    const pts = [
      [w * 0.25, h * 0.25],
      [w * 0.75, h * 0.25],
      [w * 0.5, h * 0.51],
      [w * 0.25, h * 0.75],
      [w * 0.75, h * 0.75]
    ];
    pts.forEach(([fx, fy]) => {
      ctx.beginPath();
      ctx.moveTo(fx - 6, fy);
      ctx.lineTo(fx + 6, fy);
      ctx.moveTo(fx, fy - 6);
      ctx.lineTo(fx, fy + 6);
      ctx.stroke();
    });
    ctx.restore();
  }
}
