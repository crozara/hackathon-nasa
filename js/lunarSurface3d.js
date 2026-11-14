// ============================================================================
// THE SILENT MUSEUM: LIGHTWEIGHT 3D LUNAR ORBITAL DIORAMA ENGINE (Three.js)
// Designed for 60 FPS on any browser:
// - Sculpted 3D Lunar Regolith Diorama Pedestal (no heavy 2.6km terrain)
// - Full 360-degree interactive orbit & zoom around each NASA artifact
// - Lightweight single-pass WebGL rendering + 3-point Solar & Earthshine lighting
// - Photorealistic Earthrise backdrop with Fresnel atmospheric glow
// ============================================================================

export class LunarSurface3D {
  constructor(container, artifacts, callbacks = {}) {
    this.container = container;
    this.artifacts = artifacts;
    this.onStationChange = callbacks.onStationChange || null;
    this.onArtifactClick = callbacks.onArtifactClick || null;
    this.onCuriosityClick = callbacks.onCuriosityClick || null;

    // All 4 stations share the central diorama pedestal (0, 0) for instant 60 FPS switching
    this.stations = [
      { id: "lrrr", index: 0, pos: { x: 0, z: 0 }, radius: 5.2, targetY: 0.65 },
      { id: "pse", index: 1, pos: { x: 0, z: 0 }, radius: 5.4, targetY: 0.7 },
      { id: "eagle", index: 2, pos: { x: 0, z: 0 }, radius: 8.6, targetY: 1.55 },
      { id: "lrv", index: 3, pos: { x: 0, z: 0 }, radius: 6.4, targetY: 0.9 }
    ];

    this.currentStationIndex = 0;
    this.isInspectMode = false;
    this.stationGroups = {};

    // Start directly above the lunar surface, then swoop in smoothly on call accept
    this.isInOrbit = false;
    this.isDescending = false;
    this.descentProgress = 0;

    // Interactive 360° Orbital Camera State
    this.orbitTheta = 0.25;
    this.orbitPhi = 1.05;
    this.orbitRadius = 9.2;
    this.targetOrbitTheta = 0.25;
    this.targetOrbitPhi = 1.05;
    this.targetOrbitRadius = 9.2;
    this.lookTarget = { x: 0, y: 0.65, z: 0 };
    this.targetLook = { x: 0, y: 0.65, z: 0 };

    // Smooth diorama swap transition
    this.transitionScale = 1.0;

    this.isPointerDown = false;
    this.pointerStart = { x: 0, y: 0 };
    this.pointerMoved = false;

    this.clock = null;
    this.animatedObjects = {};
    this.clickableMeshes = [];
    this.curiosityMeshes = [];
    this.ageDifficulty = "adult";

    this.initThree();
  }

  initThree() {
    const THREE = window.THREE;
    if (!THREE) return;

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.02);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.createTextures();
    this.createLighting();
    this.createSpaceBackdrop();
    this.createDioramaPedestal();
    this.createAllStations();

    this.updateVisibleStation();
    this.bindEvents();
    this.animate();
  }

  renderMarkers() {}

  // ==========================================================================
  // LIGHTWEIGHT TEXTURES (KAPTON FOIL + LUNAR REGOLITH)
  // ==========================================================================
  createTextures() {
    const THREE = window.THREE;

    // Fallback subtle regolith dust texture (512x512)
    const regCanvas = document.createElement("canvas");
    regCanvas.width = 512;
    regCanvas.height = 512;
    const rctx = regCanvas.getContext("2d");
    rctx.fillStyle = "#6c7078";
    rctx.fillRect(0, 0, 512, 512);

    let seed = 19690720;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 650; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 4 + rand() * 18;
      const v = Math.floor(88 + rand() * 38);
      const g = rctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${v},${v + 1},${v + 3},0.22)`);
      g.addColorStop(1, `rgba(${v},${v + 1},${v + 3},0)`);
      rctx.fillStyle = g;
      rctx.beginPath();
      rctx.arc(x, y, r, 0, Math.PI * 2);
      rctx.fill();
    }

    this.regolithTex = new THREE.CanvasTexture(regCanvas);
    this.regolithTex.wrapS = THREE.RepeatWrapping;
    this.regolithTex.wrapT = THREE.RepeatWrapping;
    this.regolithTex.repeat.set(12, 12);

    // Upgrade to photorealistic Apollo regolith photo (zero-CORS Data URI or HTTP path)
    const regSrc =
      (window.MUSEUM_TEXTURES && window.MUSEUM_TEXTURES.regolith) ||
      "assets/images/lunar-regolith-tex.jpg";
    new THREE.TextureLoader().load(
      regSrc,
      (photoTex) => {
        photoTex.wrapS = THREE.RepeatWrapping;
        photoTex.wrapT = THREE.RepeatWrapping;
        photoTex.repeat.set(12, 12);
        this.regolithTex = photoTex;
        if (this.pedestalTopMat) {
          this.pedestalTopMat.map = photoTex;
          this.pedestalTopMat.needsUpdate = true;
        }
      },
      undefined,
      () => {}
    );

    // Crinkled Kapton Gold Foil Bump Texture
    const foilCanvas = document.createElement("canvas");
    foilCanvas.width = 256;
    foilCanvas.height = 256;
    const fctx = foilCanvas.getContext("2d");
    fctx.fillStyle = "#808080";
    fctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      fctx.strokeStyle = rand() > 0.5 ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.32)";
      fctx.lineWidth = 1 + rand() * 2;
      fctx.beginPath();
      const x = rand() * 256;
      const y = rand() * 256;
      fctx.moveTo(x, y);
      fctx.lineTo(x + (rand() - 0.5) * 26, y + (rand() - 0.5) * 26);
      fctx.stroke();
    }
    this.kaptonBumpTex = new THREE.CanvasTexture(foilCanvas);
    this.kaptonBumpTex.wrapS = THREE.RepeatWrapping;
    this.kaptonBumpTex.wrapT = THREE.RepeatWrapping;
    this.kaptonBumpTex.repeat.set(3, 3);
  }

  // ==========================================================================
  // CLEAN 3-POINT SOLAR + EARTHSHINE MUSEUM LIGHTING
  // ==========================================================================
  createLighting() {
    const THREE = window.THREE;

    const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x111827, 0.32);
    this.scene.add(hemiLight);

    // Primary Solar Key Light
    this.sunLight = new THREE.DirectionalLight(0xfffcf5, 2.65);
    this.sunLight.position.set(14, 12, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 45;
    const d = 8.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Cool Blue Earthshine Rim Light from opposite side
    const earthRim = new THREE.DirectionalLight(0x60a5fa, 0.55);
    earthRim.position.set(-12, 6, -14);
    this.scene.add(earthRim);
  }

  // ==========================================================================
  // LIGHTWEIGHT SPACE BACKDROP (1,400 STARS + PHOTOREALISTIC EARTH)
  // ==========================================================================
  createSpaceBackdrop() {
    const THREE = window.THREE;

    const starGeo = new THREE.BufferGeometry();
    const starCount = 1400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 180 + Math.random() * 140;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 1.3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.78,
      fog: false
    });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Distant Earth in upper-left sky with Fresnel atmosphere
    const earthHolder = new THREE.Group();
    earthHolder.position.set(-34, 22, -92);

    const eCanvas = document.createElement("canvas");
    eCanvas.width = 512;
    eCanvas.height = 256;
    const ectx = eCanvas.getContext("2d");
    const oceanGrad = ectx.createLinearGradient(0, 0, 0, 256);
    oceanGrad.addColorStop(0, "#e0f2fe");
    oceanGrad.addColorStop(0.2, "#1d4ed8");
    oceanGrad.addColorStop(0.5, "#0f296b");
    oceanGrad.addColorStop(0.8, "#1d4ed8");
    oceanGrad.addColorStop(1, "#e0f2fe");
    ectx.fillStyle = oceanGrad;
    ectx.fillRect(0, 0, 512, 256);
    const fallbackTex = new THREE.CanvasTexture(eCanvas);

    this.earthMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: fallbackTex },
        uSunDir: { value: new THREE.Vector3(14, 12, 10).normalize() }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uSunDir;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        void main() {
          vec3 texColor = texture2D(uMap, vUv).rgb;
          float ndotl = dot(normalize(vWorldNormal), normalize(uSunDir));
          float dayFactor = smoothstep(-0.18, 0.3, ndotl);
          float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 3.2);
          vec3 atmoColor = vec3(0.32, 0.64, 1.0) * fresnel * (0.25 + 0.9 * dayFactor);
          vec3 lit = texColor * (0.03 + 1.06 * dayFactor) + atmoColor;
          gl_FragColor = vec4(lit, 1.0);
        }
      `,
      fog: false
    });

    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(5.8, 48, 48), this.earthMat);
    this.earthMesh.rotation.z = 0.41;
    earthHolder.add(this.earthMesh);

    const earthSrc =
      (window.MUSEUM_TEXTURES && window.MUSEUM_TEXTURES.earth) ||
      "assets/images/earth-equirect.jpg";
    new THREE.TextureLoader().load(
      earthSrc,
      (tex) => {
        this.earthMat.uniforms.uMap.value = tex;
        this.earthMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    this.scene.add(earthHolder);
  }

  // ==========================================================================
  // FULL 3D ORBITAL MOON GLOBE (OPENING SHOT BEFORE DESCENT ZOOM-IN)
  // ==========================================================================
  createOrbitalMoon() {
    const THREE = window.THREE;

    this.orbitalMoonGroup = new THREE.Group();

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce3,
      roughness: 0.96,
      metalness: 0.0,
      fog: false
    });

    const moonSrc =
      (window.MUSEUM_TEXTURES && window.MUSEUM_TEXTURES.moon) ||
      "assets/images/moon-equirect.jpg";
    new THREE.TextureLoader().load(
      moonSrc,
      (moonTex) => {
        moonMat.map = moonTex;
        moonMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    const moonSphere = new THREE.Mesh(new THREE.SphereGeometry(10.5, 56, 56), moonMat);
    // Face the iconic near side (Mare Tranquillitatis, Mare Imbrium, Tycho) toward the camera
    moonSphere.rotation.y = -Math.PI / 2 + 0.18;
    this.orbitalMoonMesh = moonSphere;
    this.orbitalMoonGroup.add(moonSphere);

    this.scene.add(this.orbitalMoonGroup);
  }

  // ==========================================================================
  // BROAD CURVED LUNAR HORIZON CAP (64m WIDE, ULTRA-LIGHTWEIGHT ~2K TRIS)
  // ==========================================================================
  getSurfaceY(x, z) {
    const r = Math.hypot(x, z);
    if (r <= 3.8) return 0;
    const t = r - 3.8;
    // Noticeable convex lunar horizon drop + subtle organic undulations
    const drop = -0.017 * t * t;
    const ripple =
      (Math.sin(x * 0.24 + z * 0.19) * 0.12 + Math.cos(x * 0.45 - z * 0.37) * 0.05) *
      Math.min(1, t / 4.0);
    return drop + ripple;
  }

  createDioramaPedestal() {
    const THREE = window.THREE;

    const diorama = new THREE.Group();
    this.dioramaBaseGroup = diorama;

    // 64m x 64m subdivided disc trimmed/curved gently into a planetary lunar horizon
    const topGeo = new THREE.PlaneGeometry(64, 64, 48, 48);
    topGeo.rotateX(-Math.PI / 2);
    const pos = topGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setY(i, this.getSurfaceY(vx, vz));
    }
    topGeo.computeVertexNormals();

    this.pedestalTopMat = new THREE.MeshStandardMaterial({
      color: 0x767b85,
      map: this.regolithTex,
      roughness: 0.98,
      metalness: 0.0
    });
    const topMesh = new THREE.Mesh(topGeo, this.pedestalTopMat);
    topMesh.receiveShadow = true;
    diorama.add(topMesh);

    // Subtle accent marker ring around the active exhibit (not a tiny pedestal edge)
    const haloGeo = new THREE.RingGeometry(2.6, 2.66, 72);
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    this.dioramaRing = new THREE.Mesh(haloGeo, haloMat);
    this.dioramaRing.position.y = 0.015;
    diorama.add(this.dioramaRing);

    // 22 naturally sculpted, partially-embedded lunar basalt boulders (1 draw call)
    const rockGeo = new THREE.IcosahedronGeometry(1, 2);
    const rPos = rockGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      // Continuous organic rock noise (natural facets & hollows, no spiky origami triangles)
      const n1 = Math.sin(vx * 2.4 + vy * 1.9) * Math.cos(vz * 2.2 - vx * 1.5);
      const n2 = Math.sin(vx * 5.1 - vz * 4.7 + vy * 3.8) * 0.25;
      const factor = 0.82 + n1 * 0.22 + n2 * 0.14;
      rPos.setXYZ(i, vx * factor, vy * factor * 0.62, vz * factor);
    }
    rockGeo.computeVertexNormals();

    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x626770,
      map: this.regolithTex,
      roughness: 0.98,
      metalness: 0.0
    });
    const rocks = new THREE.InstancedMesh(rockGeo, this.rockMat, 22);
    rocks.castShadow = true;
    rocks.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2 + (i % 3) * 0.28;
      const dist = 5.2 + (i % 6) * 3.6;
      const rx = Math.cos(ang) * dist;
      const rz = Math.sin(ang) * dist;
      const ry = this.getSurfaceY(rx, rz);
      const s = 0.18 + (i % 5) * 0.11;
      // Embed base slightly into the lunar dust so boulders sit naturally on the surface
      dummy.position.set(rx, ry + s * 0.1, rz);
      dummy.scale.set(s * (1.0 + (i % 3) * 0.25), s * 0.65, s * (0.9 + (i % 2) * 0.2));
      dummy.rotation.set((i % 4) * 0.18, i * 1.1, (i % 3) * 0.15);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    diorama.add(rocks);

    this.scene.add(diorama);
  }

  createAllStations() {
    this.buildStation1_LRRR(this.stations[0]);
    this.buildStation2_PSE(this.stations[1]);
    this.buildStation3_Eagle(this.stations[2]);
    this.buildStation4_LRV(this.stations[3]);
  }
  addStationPerimeter(group, accentHex, artifactId) {
    const THREE = window.THREE;

    const ringGeo = new THREE.RingGeometry(2.3, 2.36, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.38
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    group.add(ring);

    const ptLight = new THREE.PointLight(accentHex, 0.75, 9);
    ptLight.position.set(0, 2.4, 1.5);
    group.add(ptLight);

    const hitGeo = new THREE.SphereGeometry(2.4, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.y = 1.1;
    hitMesh.userData = { artifactId };
    group.add(hitMesh);
    this.clickableMeshes.push(hitMesh);

    // 3 Interactive Curiosity Orbs (difficulty & placement adapt by ageProfile)
    const offsetsByAge =
      artifactId === "eagle"
        ? {
            child: [
              [-2.25, 1.55, 1.45],
              [2.25, 1.85, 1.2],
              [0.2, 2.75, -2.0]
            ],
            teen: [
              [-1.95, 0.72, 1.65],
              [2.15, 2.35, -1.15],
              [-0.45, 1.1, -2.25]
            ],
            adult: [
              [-1.55, 0.42, 1.85],
              [1.8, 2.65, -1.65],
              [-0.65, 0.55, -2.15]
            ]
          }
        : {
            child: [
              [-1.55, 1.35, 1.15],
              [1.65, 1.5, 0.9],
              [0.1, 2.05, -1.45]
            ],
            teen: [
              [-1.45, 0.52, 1.3],
              [1.75, 1.85, -0.95],
              [-0.35, 0.78, -1.65]
            ],
            adult: [
              [-1.2, 0.28, 1.45],
              [1.55, 2.15, -1.25],
              [-0.55, 0.35, -1.55]
            ]
          };

    const initialOffsets = offsetsByAge[this.ageDifficulty] || offsetsByAge.adult;

    // Shared "?" badge texture for this station's accent color
    const qCanvas = document.createElement("canvas");
    qCanvas.width = 128;
    qCanvas.height = 128;
    const qCtx = qCanvas.getContext("2d");
    const hexStr = "#" + accentHex.toString(16).padStart(6, "0");

    qCtx.clearRect(0, 0, 128, 128);
    const rad = qCtx.createRadialGradient(64, 64, 10, 64, 64, 58);
    rad.addColorStop(0, "rgba(15, 23, 42, 0.92)");
    rad.addColorStop(0.68, "rgba(15, 23, 42, 0.82)");
    rad.addColorStop(1, "rgba(15, 23, 42, 0)");
    qCtx.fillStyle = rad;
    qCtx.beginPath();
    qCtx.arc(64, 64, 58, 0, Math.PI * 2);
    qCtx.fill();

    qCtx.strokeStyle = hexStr;
    qCtx.lineWidth = 5;
    qCtx.beginPath();
    qCtx.arc(64, 64, 42, 0, Math.PI * 2);
    qCtx.stroke();

    qCtx.fillStyle = "#ffffff";
    qCtx.font = "bold 62px Georgia, serif";
    qCtx.textAlign = "center";
    qCtx.textBaseline = "middle";
    qCtx.fillText("?", 64, 68);

    const qTex = new THREE.CanvasTexture(qCanvas);

    initialOffsets.forEach((coords, orbIndex) => {
      const orbGroup = new THREE.Group();
      orbGroup.position.set(coords[0], coords[1], coords[2]);

      const spriteMat = new THREE.SpriteMaterial({
        map: qTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthTest: true
      });
      const qSprite = new THREE.Sprite(spriteMat);
      qSprite.scale.set(0.55, 0.55, 1);

      const orbHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );

      orbGroup.add(qSprite);
      orbGroup.add(orbHit);

      orbHit.userData = {
        artifactId,
        orbIndex,
        orbGroup,
        baseY: coords[1],
        offsetsByAge,
        accentHex,
        spriteMat,
        qSprite,
        discovered: false
      };

      group.add(orbGroup);
      this.curiosityMeshes.push(orbHit);
    });

    this.stationGroups[artifactId] = group;
    group.visible = artifactId === this.stations[this.currentStationIndex].id;
  }

  buildStation1_LRRR(st) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.position.set(st.pos.x, 0, st.pos.z);

    this.addStationPerimeter(group, 0x10b981, "lrrr");

    const alumMat = new THREE.MeshStandardMaterial({
      color: 0xd8dee9,
      metalness: 0.8,
      roughness: 0.26
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.5
    });
    const silicaMat = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      metalness: 0.92,
      roughness: 0.08,
      emissive: 0x10b981,
      emissiveIntensity: 0.45
    });

    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 1.15), darkMat);
    basePlate.position.y = 0.04;
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    group.add(basePlate);

    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.9), alumMat);
    strutL.position.set(-0.56, 0.3, -0.05);
    strutL.castShadow = true;
    group.add(strutL);

    const strutR = strutL.clone();
    strutR.position.x = 0.56;
    group.add(strutR);

    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0.46, 0);
    panelGroup.rotation.x = 0.52;

    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.12, 1.12), alumMat);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    panelGroup.add(frameMesh);

    const prismGeo = new THREE.CylinderGeometry(0.036, 0.022, 0.04, 6);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const px = -0.45 + c * 0.1;
        const pz = -0.45 + r * 0.1;
        const prism = new THREE.Mesh(prismGeo, silicaMat);
        prism.position.set(px, 0.052, pz);
        panelGroup.add(prism);
      }
    }
    group.add(panelGroup);

    const gnomon = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 12), alumMat);
    gnomon.position.set(0.68, 0.25, 0.32);
    group.add(gnomon);

    // Emerald 532nm Laser Beam pointing straight toward Earth's exact position (-34, 22, -92)
    const panelCenter = new THREE.Vector3(0, 0.52, 0);
    const earthTarget = new THREE.Vector3(-34, 22, -92);
    const beamDir = new THREE.Vector3().subVectors(earthTarget, panelCenter);
    const beamLen = beamDir.length();

    // Thin glowing laser beam reaching all the way to Earth
    const beamGeo = new THREE.CylinderGeometry(0.014, 0.014, beamLen, 8);
    beamGeo.translate(0, beamLen / 2, 0);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.42,
      fog: false
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.copy(panelCenter);
    beamMesh.lookAt(earthTarget);
    group.add(beamMesh);

    const pulseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x6ee7b7, fog: false })
    );
    group.add(pulseMesh);

    this.animatedObjects.lrrrPulse = {
      mesh: pulseMesh,
      start: panelCenter,
      end: earthTarget
    };

    this.scene.add(group);
  }

  buildStation2_PSE(st) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.position.set(st.pos.x, 0, st.pos.z);

    this.addStationPerimeter(group, 0xf59e0b, "pse");

    const kaptonGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      bumpMap: this.kaptonBumpTex,
      bumpScale: 0.05,
      metalness: 0.86,
      roughness: 0.24
    });
    const solarCellMat = new THREE.MeshStandardMaterial({
      color: 0x172554,
      metalness: 0.75,
      roughness: 0.2,
      emissive: 0x0f172a,
      emissiveIntensity: 0.3
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.22
    });

    const bodyCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.44, 0.78, 32),
      kaptonGoldMat
    );
    bodyCyl.position.y = 0.39;
    bodyCyl.castShadow = true;
    bodyCyl.receiveShadow = true;
    group.add(bodyCyl);

    const rhuCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.12, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.75,
        metalness: 0.5,
        roughness: 0.3
      })
    );
    rhuCap.position.y = 0.82;
    group.add(rhuCap);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.95, 12), silverMat);
    mast.position.y = 1.25;
    mast.castShadow = true;
    group.add(mast);

    [-1, 1].forEach((dir) => {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(dir * 0.98, 0.22, 0);
      wingGroup.rotation.z = dir * -0.14;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.68), silverMat);
      frame.castShadow = true;
      frame.receiveShadow = true;
      wingGroup.add(frame);

      const cells = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.036, 0.6), solarCellMat);
      wingGroup.add(cells);

      group.add(wingGroup);
    });

    const waveGeo = new THREE.RingGeometry(0.55, 0.62, 48);
    waveGeo.rotateX(-Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.y = 0.03;
    group.add(waveMesh);
    this.animatedObjects.pseWave = waveMesh;

    this.scene.add(group);
  }

  buildStation3_Eagle(st) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.position.set(st.pos.x, 0, st.pos.z);
    group.rotation.y = 0.28;

    this.addStationPerimeter(group, 0xeab308, "eagle");

    const kaptonGoldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      bumpMap: this.kaptonBumpTex,
      bumpScale: 0.06,
      metalness: 0.88,
      roughness: 0.25
    });
    const darkAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.75,
      roughness: 0.35
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.18
    });

    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 1.95, 1.48, 8),
      kaptonGoldMat
    );
    bodyMesh.position.y = 1.65;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    const topDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(1.82, 1.96, 0.14, 8),
      darkAlloyMat
    );
    topDeck.position.y = 2.42;
    group.add(topDeck);

    const engineBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.82, 0.78, 24, 1, true),
      darkAlloyMat
    );
    engineBell.position.y = 0.65;
    group.add(engineBell);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const legGroup = new THREE.Group();
      legGroup.rotation.y = angle;

      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.055, 1.85, 12),
        kaptonGoldMat
      );
      strut.position.set(0, 0.95, 2.75);
      strut.rotation.x = -0.16;
      strut.castShadow = true;
      legGroup.add(strut);

      const brace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
        silverMat
      );
      brace.position.set(0, 1.55, 2.15);
      brace.rotation.x = Math.PI / 2 - 0.25;
      legGroup.add(brace);

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.52, 0.1, 24),
        kaptonGoldMat
      );
      pad.position.set(0, 0.05, 2.9);
      pad.castShadow = true;
      pad.receiveShadow = true;
      legGroup.add(pad);

      if (i === 0) {
        const railL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.85, 0.03), silverMat);
        railL.position.set(-0.2, 1.02, 2.86);
        railL.rotation.x = -0.16;
        legGroup.add(railL);

        const railR = railL.clone();
        railR.position.x = 0.2;
        legGroup.add(railR);

        for (let r = 0; r < 9; r++) {
          const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), silverMat);
          rung.rotation.z = Math.PI / 2;
          rung.position.set(0, 0.35 + r * 0.17, 2.97 - r * 0.027);
          legGroup.add(rung);
        }

        const plaque = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.14, 0.02),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.95,
            roughness: 0.1,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.35
          })
        );
        plaque.position.set(0, 0.78, 2.84);
        plaque.rotation.x = -0.16;
        legGroup.add(plaque);
      }

      group.add(legGroup);
    }

    this.scene.add(group);
  }

  buildStation4_LRV(st) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.position.set(st.pos.x, 0, st.pos.z);
    group.rotation.y = -0.45;

    this.addStationPerimeter(group, 0x38bdf8, "lrv");

    const alumMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.82,
      roughness: 0.25
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.88,
      roughness: 0.22
    });
    const wireMeshMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.75,
      roughness: 0.35,
      wireframe: true
    });
    const seatMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.6,
      metalness: 0.2
    });
    const fenderMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.4,
      roughness: 0.5
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 2.75), alumMat);
    chassis.position.y = 0.42;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    const batteryBox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.68), alumMat);
    batteryBox.position.set(0, 0.6, 0.92);
    batteryBox.castShadow = true;
    group.add(batteryBox);

    const wheelPositions = [
      { x: -0.92, z: 1.05, isRearRight: false },
      { x: 0.92, z: 1.05, isRearRight: false },
      { x: -0.92, z: -1.05, isRearRight: true },
      { x: 0.92, z: -1.05, isRearRight: false }
    ];

    wheelPositions.forEach((wp) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wp.x, 0.405, wp.z);

      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.095, 12, 28), wireMeshMat);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 16), alumMat);
      hub.rotation.z = Math.PI / 2;
      wGroup.add(hub);

      const fender = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.45,
          0.45,
          0.22,
          16,
          1,
          true,
          -Math.PI * 0.35,
          Math.PI * 0.7
        ),
        wp.isRearRight ? goldMat : fenderMat
      );
      fender.rotation.z = Math.PI / 2;
      wGroup.add(fender);

      group.add(wGroup);
    });

    [-0.36, 0.36].forEach((sx) => {
      const seatBottom = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.48), seatMat);
      seatBottom.position.set(sx, 0.56, -0.1);
      seatBottom.castShadow = true;
      group.add(seatBottom);

      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.05), seatMat);
      seatBack.position.set(sx, 0.84, -0.34);
      seatBack.rotation.x = -0.12;
      seatBack.castShadow = true;
      group.add(seatBack);
    });

    const consolePost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.48, 10), alumMat);
    consolePost.position.set(0, 0.72, 0.34);
    consolePost.rotation.x = -0.25;
    group.add(consolePost);

    const gyroPanel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.08), alumMat);
    gyroPanel.position.set(0, 0.96, 0.28);
    gyroPanel.rotation.x = -0.45;
    group.add(gyroPanel);

    const tStick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8), goldMat);
    tStick.position.set(0, 0.68, 0.08);
    group.add(tStick);
    const tHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), goldMat);
    tHandle.rotation.z = Math.PI / 2;
    tHandle.position.set(0, 0.82, 0.08);
    group.add(tHandle);

    const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 10), alumMat);
    antMast.position.set(-0.48, 1.15, 0.72);
    group.add(antMast);

    const umbrellaDish = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.85,
        roughness: 0.25,
        side: THREE.DoubleSide
      })
    );
    umbrellaDish.position.set(-0.48, 1.82, 0.72);
    umbrellaDish.rotation.x = Math.PI + 0.35;
    group.add(umbrellaDish);

    const camMast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 10), alumMat);
    camMast.position.set(0.46, 0.82, 0.95);
    group.add(camMast);

    const tvCamGroup = new THREE.Group();
    tvCamGroup.position.set(0.46, 1.16, 0.95);
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.32), goldMat);
    camBody.castShadow = true;
    tvCamGroup.add(camBody);

    const camLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 })
    );
    camLens.rotation.x = Math.PI / 2;
    camLens.position.z = 0.2;
    tvCamGroup.add(camLens);

    group.add(tvCamGroup);
    this.animatedObjects.edFendellCam = tvCamGroup;

    this.scene.add(group);
  }

  // ==========================================================================
  // ORBITAL CAMERA CONTROLS, TRANSITIONS & ANIMATION LOOP
  // ==========================================================================
  snapToStation(index, inspectMode = false) {
    this.currentStationIndex = index;
    this.isInspectMode = inspectMode;
    const st = this.stations[index];

    this.orbitTheta = 0.34;
    this.orbitPhi = 1.22;
    this.orbitRadius = inspectMode ? st.radius * 0.85 : st.radius;
    this.targetOrbitTheta = this.orbitTheta;
    this.targetOrbitPhi = this.orbitPhi;
    this.targetOrbitRadius = this.orbitRadius;

    const shiftX = inspectMode ? 1.15 : 0;
    this.lookTarget = { x: shiftX, y: st.targetY, z: 0 };
    this.targetLook = { x: shiftX, y: st.targetY, z: 0 };

    this.updateVisibleStation();
  }

  descendToSurface() {
    const st = this.stations[this.currentStationIndex];
    this.isInOrbit = false;
    this.isDescending = false;
    this.targetOrbitRadius = st.radius;
    this.targetOrbitPhi = 1.22;
    this.targetLook = { x: 0, y: st.targetY, z: 0 };
    this.updateVisibleStation();
  }

  updateVisibleStation() {
    const activeId = this.stations[this.currentStationIndex].id;
    if (this.orbitalMoonGroup) {
      this.orbitalMoonGroup.visible = this.isInOrbit;
    }
    if (this.dioramaBaseGroup) {
      this.dioramaBaseGroup.visible = !this.isInOrbit;
    }
    Object.entries(this.stationGroups).forEach(([id, grp]) => {
      grp.visible = !this.isInOrbit && id === activeId;
    });
    if (this.dioramaRing) {
      const art = this.artifacts.find((a) => a.id === activeId);
      if (art) this.dioramaRing.material.color.set(art.accentColor);
    }
  }

  goToStation(index, inspectMode = false) {
    const clamped = (index + this.stations.length) % this.stations.length;
    const isDifferent = clamped !== this.currentStationIndex;

    this.currentStationIndex = clamped;
    this.isInspectMode = inspectMode;
    const st = this.stations[clamped];

    if (isDifferent) {
      this.transitionScale = 0.08;
      this.targetOrbitTheta += 0.55;
    }

    this.targetOrbitPhi = 1.22;
    this.targetOrbitRadius = inspectMode ? st.radius * 0.85 : st.radius;
    this.targetLook = { x: inspectMode ? 1.15 : 0, y: st.targetY, z: 0 };

    this.updateVisibleStation();

    if (this.onStationChange) {
      this.onStationChange(st.id, clamped, inspectMode);
    }
  }

  setInspectMode(inspectMode) {
    this.isInspectMode = inspectMode;
    const st = this.stations[this.currentStationIndex];
    this.targetOrbitRadius = inspectMode ? st.radius * 0.85 : st.radius;
    this.targetLook = { x: inspectMode ? 1.15 : 0, y: st.targetY, z: 0 };
  }

  bindEvents() {
    window.addEventListener("resize", () => this.onResize());

    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      this.isPointerDown = true;
      this.pointerMoved = false;
      this.pointerStart = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.isPointerDown) return;
      const dx = e.clientX - this.pointerStart.x;
      const dy = e.clientY - this.pointerStart.y;
      if (Math.hypot(dx, dy) > 4) this.pointerMoved = true;

      this.targetOrbitTheta -= dx * 0.008;
      this.targetOrbitPhi = Math.max(0.55, Math.min(1.48, this.targetOrbitPhi - dy * 0.006));
      this.pointerStart = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointerup", (e) => {
      const wasDrag = this.pointerMoved;
      this.isPointerDown = false;
      if (!wasDrag) {
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const activeId = this.stations[this.currentStationIndex].id;
        const activeOrbs = this.curiosityMeshes.filter((m) => m.userData.artifactId === activeId);
        const orbHits = this.raycaster.intersectObjects(activeOrbs, false);
        if (orbHits.length > 0 && this.onCuriosityClick) {
          const { orbIndex } = orbHits[0].object.userData;
          this.onCuriosityClick(activeId, orbIndex);
          return;
        }

        const activeHit = this.clickableMeshes.filter((m) => m.userData.artifactId === activeId);
        const hits = this.raycaster.intersectObjects(activeHit, false);
        if (hits.length > 0 && this.onArtifactClick) {
          this.onArtifactClick(activeId);
        }
      }
    });

    dom.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const st = this.stations[this.currentStationIndex];
        const minR = st.radius * 0.55;
        const maxR = st.radius * 2.4;
        this.targetOrbitRadius = Math.max(
          minR,
          Math.min(maxR, this.targetOrbitRadius + e.deltaY * 0.004)
        );
      },
      { passive: false }
    );

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        this.goToStation(this.currentStationIndex + 1, this.isInspectMode);
      } else if (e.key === "ArrowLeft") {
        this.goToStation(this.currentStationIndex - 1, this.isInspectMode);
      }
    });
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.renderer || !this.scene || !this.camera) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.getElapsedTime();

    // Smooth Orbital Descent Zoom-In from full Moon sphere down to Station 1
    if (this.isDescending) {
      this.descentProgress = Math.min(1.0, this.descentProgress + dt / 2.2);
      const t = this.descentProgress;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const st = this.stations[this.currentStationIndex];

      if (t < 0.62) {
        // Zooming into the sunlit Mare Tranquillitatis region of the Moon globe
        this.targetOrbitRadius = 35.0 - (35.0 - 11.2) * (ease / 0.62);
        this.targetOrbitPhi = 1.42 - 0.16 * (ease / 0.62);
        this.targetLook = { x: 0, y: 0.4 * (ease / 0.62), z: 0 };
      } else {
        // Cross-fade into the curved lunar surface & 1st artifact
        if (this.isInOrbit) {
          this.isInOrbit = false;
          this.transitionScale = 0.08;
          this.orbitRadius = 11.5;
          this.updateVisibleStation();
        }
        this.targetOrbitRadius = st.radius;
        this.targetOrbitPhi = 1.22;
        this.targetLook = { x: 0, y: st.targetY, z: 0 };
      }

      if (t >= 1.0) {
        this.isDescending = false;
      }
    }

    // Smoothly damp orbital camera
    const damp = 1 - Math.exp(-7.5 * dt);
    this.orbitTheta += (this.targetOrbitTheta - this.orbitTheta) * damp;
    this.orbitPhi += (this.targetOrbitPhi - this.orbitPhi) * damp;
    this.orbitRadius += (this.targetOrbitRadius - this.orbitRadius) * damp;
    this.lookTarget.x += (this.targetLook.x - this.lookTarget.x) * damp;
    this.lookTarget.y += (this.targetLook.y - this.lookTarget.y) * damp;
    this.lookTarget.z += (this.targetLook.z - this.lookTarget.z) * damp;

    // Gentle idle turntable drift when not dragging
    if (!this.isPointerDown && !this.isDescending) {
      this.targetOrbitTheta += dt * (this.isInOrbit ? 0.04 : 0.08);
    }

    if (this.orbitalMoonMesh && this.isInOrbit) {
      this.orbitalMoonMesh.rotation.y += dt * 0.03;
    }

    // Smooth scale-in on station swap
    if (this.transitionScale < 1.0) {
      this.transitionScale = Math.min(1.0, this.transitionScale + dt * 2.8);
      const activeId = this.stations[this.currentStationIndex].id;
      const grp = this.stationGroups[activeId];
      if (grp) {
        const s = 0.86 + 0.14 * this.transitionScale;
        grp.scale.set(s, s, s);
      }
    }

    const cx = this.lookTarget.x + this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);
    const cy = this.lookTarget.y + this.orbitRadius * Math.cos(this.orbitPhi);
    const cz = this.lookTarget.z + this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.lookTarget.x, this.lookTarget.y, this.lookTarget.z);

    if (this.earthMesh) {
      this.earthMesh.rotation.y = elapsed * 0.03;
    }

    // Animate LRRR Laser Pulse
    if (this.animatedObjects.lrrrPulse) {
      const p = this.animatedObjects.lrrrPulse;
      const cycle = (elapsed * 0.85) % 2;
      const t = cycle <= 1 ? cycle : 2 - cycle;
      p.mesh.position.lerpVectors(p.start, p.end, t);
    }

    // Animate PSE Seismic Ring
    if (this.animatedObjects.pseWave) {
      const w = this.animatedObjects.pseWave;
      const s = 1 + ((elapsed * 0.7) % 2.2);
      w.scale.set(s, s, 1);
      w.material.opacity = Math.max(0, 0.75 * (1 - (s - 1) / 2.2));
    }

    // Animate Ed Fendell Camera on LRV
    if (this.animatedObjects.edFendellCam) {
      this.animatedObjects.edFendellCam.rotation.x =
        -0.25 - Math.abs(Math.sin(elapsed * 0.55)) * 0.45;
    }

    // Animate 3D Curiosity Orbs (subtlety depends on ageDifficulty)
    if (this.curiosityMeshes && this.curiosityMeshes.length > 0) {
      const activeId = this.stations[this.currentStationIndex].id;
      const amp =
        this.ageDifficulty === "child" ? 0.1 : this.ageDifficulty === "teen" ? 0.045 : 0.015;
      this.curiosityMeshes.forEach((m) => {
        if (m.userData.artifactId !== activeId) return;
        const { orbGroup, orbIndex, baseY, discovered } = m.userData;
        if (orbGroup) {
          const effAmp = discovered ? 0.08 : amp;
          orbGroup.position.y = baseY + Math.sin(elapsed * 2.1 + orbIndex * 1.7) * effAmp;
          orbGroup.rotation.y = elapsed * (discovered ? 1.1 : 0.6);
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  setAgeDifficulty(ageProfile) {
    this.ageDifficulty = ageProfile || "adult";
    const scale =
      this.ageDifficulty === "child" ? 1.25 : this.ageDifficulty === "teen" ? 0.78 : 0.56;
    const spriteOp =
      this.ageDifficulty === "child" ? 0.98 : this.ageDifficulty === "teen" ? 0.72 : 0.42;

    this.curiosityMeshes.forEach((m) => {
      const { orbGroup, orbIndex, offsetsByAge, spriteMat, discovered } = m.userData;
      if (offsetsByAge && offsetsByAge[this.ageDifficulty]) {
        const coords = offsetsByAge[this.ageDifficulty][orbIndex];
        if (coords && orbGroup) {
          orbGroup.position.set(coords[0], coords[1], coords[2]);
          m.userData.baseY = coords[1];
        }
      }
      if (!discovered && orbGroup) {
        orbGroup.scale.set(scale, scale, scale);
        if (spriteMat) spriteMat.opacity = spriteOp;
      }
    });
  }

  markCuriosityDiscovered(artifactId, orbIndex) {
    this.curiosityMeshes.forEach((m) => {
      if (m.userData.artifactId === artifactId && m.userData.orbIndex === orbIndex) {
        m.userData.discovered = true;
        if (m.userData.orbGroup) {
          m.userData.orbGroup.scale.set(1.1, 1.1, 1.1);
        }
        if (m.userData.spriteMat) {
          m.userData.spriteMat.color.setHex(0xfbbf24);
          m.userData.spriteMat.opacity = 1.0;
        }
      }
    });
  }
}
