# 🌕 Museum of Lost Space Technology — *Abandoned, But Not Forgotten*

> **NASA Space Apps Challenge — Storytelling about NASA's Discarded Equipment on the Moon and Mars**

An interactive bilingual web experience combining lunar exploration and **first-person storytelling**, where four iconic NASA instruments left behind on the Moon come to life to narrate their journeys, extreme engineering challenges, and the scientific discoveries still guiding humanity's return to the Moon under the Artemis Program.

---

## ✨ Key Features

### 1. Language & Age-Adaptive Experience
- **Startup Setup (`#onboardingModal`):** Visitors select their preferred language and age profile right upon opening the site (reconfigurable anytime via the top gear icon).
- **Full Bilingual Support:** **English (`EN-US`)** and **Portuguese (`PT-BR`)** across the entire UI, stories, radio comms, quiz, neural audio, and certificate.
- **3 Storytelling Depth Levels (`js/data.js`):**
  - 🧒 **Child:** Playful, curious, and accessible space storytelling.
  - 🧑 **Teen:** Engineering behind-the-scenes, applied physics, and Apollo mission trivia.
  - 🎓 **Adult:** Poetic historical chronicle paired with technical precision and official NASA records.

### 2. The 04 Lunar Landmarks & Interactive Storybook (`#storyDrawer`)
1. **Laser Ranging Retroreflector (LRRR) — Apollo 11** *(Mare Tranquillitatis)*
2. **Passive Seismic Experiment (PSE) — Apollo 11** *(Mare Tranquillitatis)*
3. **Lunar Module Eagle Descent Stage (LM-5) — Apollo 11** *(Tranquility Base)*
4. **Lunar Roving Vehicle (LRV) — Apollo 15, 16 & 17** *(Hadley Rille / Taurus-Littrow)*

- **Book-Style Reader:** Smooth page-turn animations, procedural paper-turn sound effects, and an image zoom lightbox for historical illustrations and renders.
- **Audio Narration Controls:** Play/pause toggle, speed selector (`1.0x`, `1.25x`, `1.5x`), and an interactive paragraph progress scrubber.

### 3. On-Demand 3D Lunar Surface Exploration (`js/lunarSurface3d.js`)
- Powered by **Three.js (`r128`)** when entering 3D Mode:
  - Telemetry loading screen and opening **Mission Logbook** briefing.
  - Interactive 3D lunar terrain with equirectangular/procedural textures, Earth on the horizon, and smooth lateral travel between all 4 stations.
  - **12 Hidden Curiosity Orbs** (3 positioned in 360° around each artifact) that unlock station **Passport Stamps**.
  - **Ask the Equipment:** Direct interactive Q&A with 3 questions per artifact answered in each instrument's own distinct neural voice.

### 4. Commander Vega — Recurring Mission Guide, Final Quiz & PNG Certificate
- **Continuous Narrative Arc:** **Commander Vega** guides visitors across editorial chapters, chapter transitions, live 3D onboard radio comms, and final certificate delivery.
- **Complete Journey Flow (Site + 3D):** Visitors who finish all 4 stories exclusively on the static site receive an interactive prompt from Commander Vega inviting them to explore the **3D Lunar Voyage** before heading to the wrap-up quiz and certificate.
- **Final Quiz (4 Questions):** Age- and language-adapted challenge with encouraging feedback and neural voice narration.
- **Official PNG Certificate (`1400×990`):** Custom-generated on `<canvas>` with the visitor's name, followed by a post-download thank-you screen featuring the GitHub repository link and quick navigation back to the site or 3D mode.

### 5. Technical Anatomy & Interactive Science Labs (`js/schematics.js`, `js/labs.js`)
- **Anatomy Inspection:** Switch between surface renders and SVG blueprint schematics featuring **5 interactive hotspots** per instrument.
- **Hands-On Simulators:** Earth–Moon laser distance ranging (532 nm), 3-axis lunar seismograph + Plutonium-238 nuclear heater, Tranquility Base `1/6` gravity comparator, and the LRV gyroscopic navigator + Ed Fendell's remote TV camera.

### 6. Neural Voice Audio (270 MP3s) & Web Audio API (`js/audio.js`)
- **270 pre-generated `.mp3` clips (`assets/audio/`):**
  - `102` first-person story narration clips (4 artifacts × 2 languages × 3 age profiles).
  - `24` *Ask the Equipment* Q&A responses with custom vocal identities per artifact.
  - `144` Commander Vega clips (site chapters, bridges, 3D radio tips, 3D voyage invite, mission logbook, quiz, and certificate delivery).
- **Cross-Device Playback Reliability:** Reusable per-channel `<audio>` elements with `playsinline`, automatic first-touch unlock for iOS Safari / Android Chrome, and automatic Web Speech API fallback.
- **Apollo Telemetry & Ambient Soundscape:** Authentic **Quindar tones (`2525 Hz` / `2475 Hz`)**, UI telemetry pings, laser pulses, seismic rumbles, and procedural deep-space ambient drone via Web Audio API.

---

## 📁 Project Structure

```text
hackathon-nasa/
├── index.html                   # Editorial site layout, 3D wrapper, and modals
├── css/
│   └── styles.css               # Responsive dark space-tech visual system
├── js/
│   ├── bundle.js                # Standalone IIFE bundle loaded by index.html (file:// & HTTP)
│   ├── app.js                   # Main application controller, UI state, quiz & certificate
│   ├── data.js                  # Bilingual age-adapted content, quiz & Commander Vega scripts
│   ├── audio.js                 # Neural MP3 player, Web Audio FX & TTS fallback engine
│   ├── lunarSurface3d.js        # 3D lunar surface scene (Three.js r128) & curiosity orbs
│   ├── labs.js                  # Interactive science simulators
│   ├── schematics.js            # Interactive SVG blueprint diagrams with hotspots
│   └── textures.js              # Procedural textures and Moon/Earth surface maps
├── assets/
│   ├── audio/                   # 270 neural MP3 clips (stories, Q&A & Commander Vega)
│   └── images/                  # Equipment renders, textures, guide portrait & favicon
└── scripts/
    ├── generate_voices.py       # Edge TTS generator for artifact stories and Q&A clips
    └── generate_vega_voices.py  # Edge TTS generator for Commander Vega clips
```

---

## 🚀 Running Locally

`index.html` loads the standalone bundle `js/bundle.js` (compatible with both HTTP servers and direct local opening). To serve locally over HTTP:

```bash
python3 -m http.server 8080
```

Then open **http://localhost:8080** in your browser.

### Regenerating Voices or Editing JS Modules
- If you update narration or dialogue text in `js/data.js`, regenerate missing or updated clips with `edge-tts`:
  ```bash
  pip install edge-tts
  python3 scripts/generate_voices.py
  python3 scripts/generate_vega_voices.py
  ```
- Whenever you modify source modules inside `js/`, rebuild `js/bundle.js` (which bundles `textures.js`, `data.js`, `audio.js`, `schematics.js`, `labs.js`, `lunarSurface3d.js`, and `app.js` into a single IIFE without `import`/`export` statements).
