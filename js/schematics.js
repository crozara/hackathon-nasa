// ============================================================================
// THE SILENT MUSEUM: NASA ENGINEERING BLUEPRINTS (SVG SCHEMATICS)
// High-precision technical schematics for LRRR, PSE, LRV, and LM-5 EAGLE
// ============================================================================

export function getArtifactBlueprintSVG(artifactId) {
  switch (artifactId) {
    case "lrrr":
      return `
        <svg viewBox="0 0 800 450" class="blueprint-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="bpGrid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(16, 185, 129, 0.12)" stroke-width="0.8"/>
            </pattern>
            <linearGradient id="laserGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#34D399" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#10B981" stop-opacity="0.15"/>
            </linearGradient>
          </defs>
          <rect width="800" height="450" fill="#06121A"/>
          <rect width="800" height="450" fill="url(#bpGrid)"/>

          <!-- Technical Border & Blueprint Header -->
          <rect x="16" y="16" width="768" height="418" fill="none" stroke="#10B981" stroke-opacity="0.4" stroke-width="1.5"/>
          <text x="32" y="42" fill="#34D399" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5">
            NASA DWG // APOLLO 11 LRRR — 10x10 CORNER-CUBE FUSED SILICA ARRAY (Ø 3.8 CM)
          </text>
          <text x="32" y="418" fill="#6EE7B7" font-family="JetBrains Mono, monospace" font-size="10" opacity="0.75">
            PRINCIPLE: d = (c × Δt) / 2   |   MATERIAL: SUPRASIL FUSED SILICA   |   POWER: PASSIVE (0 W)
          </text>

          <!-- Incoming & Outgoing Laser Beam Diagram -->
          <line x1="680" y1="35" x2="435" y2="185" stroke="#10B981" stroke-width="2.5" stroke-dasharray="7 5"/>
          <line x1="425" y1="195" x2="670" y2="45" stroke="#34D399" stroke-width="2.5"/>
          <text x="565" y="72" fill="#34D399" font-family="JetBrains Mono, monospace" font-size="10">
            FEIXE LASER 532nm (Δt ≈ 2,56 s)
          </text>

          <!-- Tilted Pallet Frame (3D Isometric Projection) -->
          <polygon points="220,120 550,95 600,285 270,315" fill="rgba(16, 185, 129, 0.08)" stroke="#34D399" stroke-width="2"/>
          <polygon points="270,315 600,285 600,320 270,350" fill="rgba(16, 185, 129, 0.16)" stroke="#10B981" stroke-width="1.5"/>
          <polygon points="180,340 270,350 220,120 165,305" fill="rgba(16, 185, 129, 0.05)" stroke="#10B981" stroke-width="1.2" stroke-dasharray="4 4"/>

          <!-- 10x10 Grid of 100 Corner-Cube Prisms -->
          ${Array.from({ length: 10 })
            .map((_, row) =>
              Array.from({ length: 10 })
                .map((__, col) => {
                  const u = (col + 0.5) / 10;
                  const v = (row + 0.5) / 10;
                  const topX = 240 + u * 295 + v * 42;
                  const topY = 132 - u * 20 + v * 165;
                  return `
                    <g>
                      <circle cx="${topX.toFixed(1)}" cy="${topY.toFixed(1)}" r="7.5" fill="rgba(6, 78, 59, 0.7)" stroke="#34D399" stroke-width="1"/>
                      <line x1="${(topX - 5).toFixed(1)}" y1="${(topY - 4).toFixed(1)}" x2="${(topX + 5).toFixed(1)}" y2="${(topY + 4).toFixed(1)}" stroke="rgba(167, 243, 208, 0.55)" stroke-width="0.7"/>
                      <line x1="${topX.toFixed(1)}" y1="${(topY - 7).toFixed(1)}" x2="${topX.toFixed(1)}" y2="${(topY + 7).toFixed(1)}" stroke="rgba(167, 243, 208, 0.55)" stroke-width="0.7"/>
                    </g>
                  `;
                })
                .join("")
            )
            .join("")}

          <!-- Corner-Cube Detail Inset (Left Side) -->
          <rect x="42" y="135" width="145" height="145" rx="6" fill="rgba(6, 18, 26, 0.9)" stroke="#10B981" stroke-width="1.2"/>
          <polygon points="114,155 168,185 168,245 114,270 60,245 60,185" fill="rgba(16, 185, 129, 0.1)" stroke="#34D399" stroke-width="1.4"/>
          <line x1="114" y1="212" x2="114" y2="155" stroke="#34D399" stroke-width="1"/>
          <line x1="114" y1="212" x2="168" y2="245" stroke="#34D399" stroke-width="1"/>
          <line x1="114" y1="212" x2="60" y2="245" stroke="#34D399" stroke-width="1"/>
          <text x="52" y="296" fill="#A7F3D0" font-family="JetBrains Mono, monospace" font-size="9.5">
            PRISMA CORNER-CUBE (Ø 3,8cm)
          </text>

          <!-- Lunar Regolith Base Line -->
          <path d="M 110 365 Q 380 345 690 365" fill="none" stroke="#6EE7B7" stroke-width="1.5" stroke-opacity="0.5"/>
        </svg>
      `;

    case "pse":
      return `
        <svg viewBox="0 0 800 450" class="blueprint-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="450" fill="#140F06"/>
          <defs>
            <pattern id="bpGridPse" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(245, 158, 11, 0.12)" stroke-width="0.8"/>
            </pattern>
          </defs>
          <rect width="800" height="450" fill="url(#bpGridPse)"/>
          <rect x="16" y="16" width="768" height="418" fill="none" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="1.5"/>

          <text x="32" y="42" fill="#FBBF24" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5">
            NASA DWG // APOLLO 11 PASSIVE SEISMIC EXPERIMENT (PSE) — 3-AXIS + RHU NUCLEAR HEATER
          </text>
          <text x="32" y="418" fill="#FDE68A" font-family="JetBrains Mono, monospace" font-size="10" opacity="0.8">
            SENSORS: 3 LONG-PERIOD (X, Y, Z) + 1 SHORT-PERIOD  |  NIGHT: 340h (-170°C)  |  MIN TEMP: -54°C (Pu-238 RHU)
          </text>

          <!-- S-Band Vertical Antenna Mast -->
          <line x1="400" y1="62" x2="400" y2="155" stroke="#FBBF24" stroke-width="3"/>
          <circle cx="400" cy="60" r="6" fill="#F59E0B" stroke="#FEF3C7" stroke-width="1.5"/>
          <circle cx="400" cy="60" r="22" fill="none" stroke="#F59E0B" stroke-dasharray="3 4" stroke-width="1"/>
          <circle cx="400" cy="60" r="38" fill="none" stroke="#F59E0B" stroke-dasharray="3 6" stroke-width="0.8"/>

          <!-- Left Solar Panel Wing -->
          <polygon points="85,255 315,235 300,320 65,342" fill="rgba(245, 158, 11, 0.12)" stroke="#FBBF24" stroke-width="2"/>
          ${Array.from({ length: 7 })
            .map((_, i) => {
              const x = 95 + i * 31;
              return `<line x1="${x}" y1="252" x2="${x - 12}" y2="336" stroke="rgba(251, 191, 36, 0.45)" stroke-width="1"/>`;
            })
            .join("")}
          <line x1="78" y1="295" x2="308" y2="276" stroke="rgba(251, 191, 36, 0.45)" stroke-width="1"/>

          <!-- Right Solar Panel Wing -->
          <polygon points="485,235 715,255 735,342 500,320" fill="rgba(245, 158, 11, 0.12)" stroke="#FBBF24" stroke-width="2"/>
          ${Array.from({ length: 7 })
            .map((_, i) => {
              const x = 505 + i * 31;
              return `<line x1="${x}" y1="238" x2="${x + 12}" y2="334" stroke="rgba(251, 191, 36, 0.45)" stroke-width="1"/>`;
            })
            .join("")}
          <line x1="492" y1="276" x2="722" y2="295" stroke="rgba(251, 191, 36, 0.45)" stroke-width="1"/>

          <!-- Central Cylindrical Kapton Housing -->
          <ellipse cx="400" cy="162" rx="76" ry="22" fill="rgba(245, 158, 11, 0.25)" stroke="#FBBF24" stroke-width="2"/>
          <path d="M 324 162 L 324 315 A 76 22 0 0 0 476 315 L 476 162" fill="rgba(245, 158, 11, 0.16)" stroke="#FBBF24" stroke-width="2"/>

          <!-- Internal Cutaway: Plutonium-238 Radioisotope Heater Unit (RHU) -->
          <rect x="372" y="130" width="56" height="24" rx="4" fill="rgba(239, 68, 68, 0.35)" stroke="#F87171" stroke-width="1.5"/>
          <text x="380" y="146" fill="#FCA5A5" font-family="JetBrains Mono, monospace" font-size="9.5">Pu-238 RHU</text>

          <!-- Internal Cutaway: 4 Seismometers (Z, N-S, E-W + Short Period) -->
          <circle cx="368" cy="225" r="20" fill="none" stroke="#FDE68A" stroke-width="1.4" stroke-dasharray="3 2"/>
          <text x="355" y="229" fill="#FDE68A" font-family="JetBrains Mono, monospace" font-size="9">N-S</text>
          <circle cx="432" cy="225" r="20" fill="none" stroke="#FDE68A" stroke-width="1.4" stroke-dasharray="3 2"/>
          <text x="419" y="229" fill="#FDE68A" font-family="JetBrains Mono, monospace" font-size="9">E-W</text>
          <circle cx="400" cy="272" r="22" fill="none" stroke="#FBBF24" stroke-width="1.6"/>
          <text x="384" y="276" fill="#FBBF24" font-family="JetBrains Mono, monospace" font-size="9">VERT-Z</text>

          <!-- Seismic Waves Under Regolith -->
          <path d="M 210 375 Q 400 355 590 375" fill="none" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="5 5"/>
          <path d="M 160 395 Q 400 368 640 395" fill="none" stroke="#F59E0B" stroke-width="0.9" stroke-dasharray="4 6" opacity="0.6"/>
        </svg>
      `;

    case "lrv":
      return `
        <svg viewBox="0 0 800 450" class="blueprint-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="450" fill="#06101E"/>
          <defs>
            <pattern id="bpGridLrv" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(56, 189, 248, 0.12)" stroke-width="0.8"/>
            </pattern>
          </defs>
          <rect width="800" height="450" fill="url(#bpGridLrv)"/>
          <rect x="16" y="16" width="768" height="418" fill="none" stroke="#38BDF8" stroke-opacity="0.4" stroke-width="1.5"/>

          <text x="32" y="42" fill="#38BDF8" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5">
            NASA BOEING/GM DWG // LUNAR ROVING VEHICLE (LRV) — 3.10m × 2.30m WHEELBASE (210 KG)
          </text>
          <text x="32" y="418" fill="#BAE6FD" font-family="JetBrains Mono, monospace" font-size="10" opacity="0.8">
            MOTORS: 4 × 0.25 HP (36V Ag-Zn)  |  WHEELS: Ø 81cm PIANO-WIRE MESH (5.4 KG)  |  NAV: DIRECTIONAL GYRO + ODOMETERS
          </text>

          <!-- Dimension Callout Lines -->
          <line x1="130" y1="388" x2="670" y2="388" stroke="#38BDF8" stroke-width="1" stroke-dasharray="4 4"/>
          <text x="330" y="382" fill="#7DD3FC" font-family="JetBrains Mono, monospace" font-size="10">
            COMPRIMENTO TOTAL: 3,10 METROS (ENTRE-EIXOS: 2,30 m)
          </text>

          <!-- High-Gain Golden Umbrella Antenna (Front Left) -->
          <line x1="235" y1="245" x2="215" y2="125" stroke="#FBBF24" stroke-width="3"/>
          <path d="M 155 125 Q 215 65 275 125 Z" fill="rgba(251, 191, 36, 0.18)" stroke="#FBBF24" stroke-width="2"/>
          <line x1="215" y1="95" x2="215" y2="70" stroke="#FBBF24" stroke-width="2"/>

          <!-- Ed Fendell Color TV Camera (Front) -->
          <rect x="178" y="192" width="42" height="24" rx="3" fill="rgba(56, 189, 248, 0.25)" stroke="#FBBF24" stroke-width="1.8"/>
          <polygon points="178,196 156,186 156,222 178,212" fill="rgba(251, 191, 36, 0.3)" stroke="#FBBF24" stroke-width="1.4"/>

          <!-- Aluminum Chassis Frame (Folded Origami 3-Part Chassis) -->
          <rect x="175" y="255" width="450" height="22" rx="4" fill="rgba(56, 189, 248, 0.18)" stroke="#38BDF8" stroke-width="2"/>
          <!-- Battery Pack Housing (Front 2x 36V Silver-Zinc) -->
          <polygon points="185,255 295,255 280,220 200,220" fill="rgba(56, 189, 248, 0.15)" stroke="#38BDF8" stroke-width="1.6"/>
          <text x="205" y="242" fill="#BAE6FD" font-family="JetBrains Mono, monospace" font-size="9">2× 36V Ag-Zn</text>

          <!-- Navigation Console & Gyroscope + T-Controller -->
          <line x1="345" y1="255" x2="360" y2="192" stroke="#38BDF8" stroke-width="3"/>
          <rect x="342" y="176" width="36" height="22" rx="3" fill="#0EA5E9" fill-opacity="0.3" stroke="#38BDF8" stroke-width="1.8"/>
          <!-- T-Shaped Hand Controller -->
          <line x1="422" y1="255" x2="422" y2="212" stroke="#FBBF24" stroke-width="2.5"/>
          <line x1="408" y1="212" x2="436" y2="212" stroke="#FBBF24" stroke-width="3.5"/>

          <!-- Lawn-Chair Tubular Aluminum Seats & Seatbelt Basalt Strap -->
          <polyline points="395,255 465,255 488,182" fill="none" stroke="#E2E8F0" stroke-width="3.5"/>
          <polyline points="435,255 505,255 528,182" fill="none" stroke="#38BDF8" stroke-width="3"/>
          <!-- Rear Lunar Communications Relay Unit & Sample Bags (77.31 kg) -->
          <rect x="535" y="205" width="78" height="50" rx="4" fill="rgba(56, 189, 248, 0.15)" stroke="#38BDF8" stroke-width="1.6"/>
          <text x="544" y="233" fill="#BAE6FD" font-family="JetBrains Mono, monospace" font-size="8.5">CARGA: 490 KG</text>

          <!-- Front & Rear Fenders (Right-Rear Map Repair Highlighted!) -->
          <path d="M 135 285 A 72 72 0 0 1 265 285" fill="none" stroke="#38BDF8" stroke-width="3"/>
          <path d="M 535 285 A 72 72 0 0 1 665 285" fill="none" stroke="#FBBF24" stroke-width="3.5" stroke-dasharray="8 3"/>

          <!-- Front Piano-Wire Mesh Wheel (Ø 81 cm) -->
          <g transform="translate(200, 315)">
            <circle cx="0" cy="0" r="56" fill="rgba(15, 23, 42, 0.75)" stroke="#38BDF8" stroke-width="2.5"/>
            <circle cx="0" cy="0" r="42" fill="none" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1" stroke-dasharray="3 3"/>
            ${Array.from({ length: 12 })
              .map((_, i) => {
                const a = (i * Math.PI) / 6;
                return `<line x1="0" y1="0" x2="${(Math.cos(a) * 56).toFixed(1)}" y2="${(Math.sin(a) * 56).toFixed(1)}" stroke="rgba(125, 211, 252, 0.45)" stroke-width="1"/>`;
              })
              .join("")}
            <circle cx="0" cy="0" r="14" fill="#0284C7" stroke="#E0F2FE" stroke-width="1.5"/>
          </g>

          <!-- Rear Piano-Wire Mesh Wheel (Ø 81 cm) -->
          <g transform="translate(600, 315)">
            <circle cx="0" cy="0" r="56" fill="rgba(15, 23, 42, 0.75)" stroke="#38BDF8" stroke-width="2.5"/>
            <circle cx="0" cy="0" r="42" fill="none" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1" stroke-dasharray="3 3"/>
            ${Array.from({ length: 12 })
              .map((_, i) => {
                const a = (i * Math.PI) / 6;
                return `<line x1="0" y1="0" x2="${(Math.cos(a) * 56).toFixed(1)}" y2="${(Math.sin(a) * 56).toFixed(1)}" stroke="rgba(125, 211, 252, 0.45)" stroke-width="1"/>`;
              })
              .join("")}
            <circle cx="0" cy="0" r="14" fill="#0284C7" stroke="#E0F2FE" stroke-width="1.5"/>
          </g>
        </svg>
      `;

    case "eagle":
    default:
      return `
        <svg viewBox="0 0 800 450" class="blueprint-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="450" fill="#141106"/>
          <defs>
            <pattern id="bpGridEagle" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(234, 179, 8, 0.12)" stroke-width="0.8"/>
            </pattern>
          </defs>
          <rect width="800" height="450" fill="url(#bpGridEagle)"/>
          <rect x="16" y="16" width="768" height="418" fill="none" stroke="#EAB308" stroke-opacity="0.4" stroke-width="1.5"/>

          <text x="32" y="42" fill="#FACC15" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5">
            GRUMMAN / NASA DWG // APOLLO 11 LM-5 "EAGLE" DESCENT STAGE — TRANQUILITY BASE
          </text>
          <text x="32" y="418" fill="#FEF08A" font-family="JetBrains Mono, monospace" font-size="10" opacity="0.8">
            COORDS: 0° 41' 15" N, 23° 26' E  |  DESCENT TIME: 12 MIN  |  PLAQUE: "WE CAME IN PEACE FOR ALL MANKIND"
          </text>

          <!-- Octagonal Kapton Gold Descent Stage Body -->
          <polygon points="265,140 535,140 565,165 235,165" fill="rgba(234, 179, 8, 0.25)" stroke="#FACC15" stroke-width="2"/>
          <rect x="235" y="165" width="330" height="125" fill="rgba(234, 179, 8, 0.16)" stroke="#FACC15" stroke-width="2"/>
          <line x1="325" y1="165" x2="325" y2="290" stroke="#FACC15" stroke-width="1.4"/>
          <line x1="475" y1="165" x2="475" y2="290" stroke="#FACC15" stroke-width="1.4"/>

          <!-- SEQ Bay Compartment Label -->
          <rect x="488" y="185" width="64" height="55" fill="rgba(250, 204, 21, 0.22)" stroke="#FEF08A" stroke-width="1.2"/>
          <text x="496" y="212" fill="#FEF08A" font-family="JetBrains Mono, monospace" font-size="9">SEQ BAY</text>
          <text x="492" y="226" fill="#FEF08A" font-family="JetBrains Mono, monospace" font-size="8">(LRRR+PSE)</text>

          <!-- Front Landing Strut & 9-Rung Ladder + Commemorative Plaque -->
          <rect x="378" y="155" width="44" height="185" fill="rgba(15, 23, 42, 0.65)" stroke="#FEF08A" stroke-width="1.6"/>
          ${Array.from({ length: 9 })
            .map((_, r) => {
              const y = 172 + r * 18;
              return `<line x1="382" y1="${y}" x2="418" y2="${y}" stroke="#FDE047" stroke-width="2"/>`;
            })
            .join("")}
          <!-- Commemorative Stainless Steel Plaque -->
          <rect x="384" y="212" width="32" height="14" fill="#38BDF8" fill-opacity="0.45" stroke="#BAE6FD" stroke-width="1.2"/>

          <!-- Descent Engine Skirt -->
          <polygon points="348,290 452,290 472,338 328,338" fill="rgba(148, 163, 184, 0.28)" stroke="#E2E8F0" stroke-width="1.8"/>

          <!-- Left & Right Outrigger Landing Gear Struts & 94cm Footpads -->
          <line x1="235" y1="185" x2="145" y2="345" stroke="#FACC15" stroke-width="3.5"/>
          <line x1="235" y1="275" x2="145" y2="345" stroke="#FACC15" stroke-width="2.5"/>
          <ellipse cx="145" cy="350" rx="42" ry="10" fill="rgba(234, 179, 8, 0.35)" stroke="#FEF08A" stroke-width="2"/>

          <line x1="565" y1="185" x2="655" y2="345" stroke="#FACC15" stroke-width="3.5"/>
          <line x1="565" y1="275" x2="655" y2="345" stroke="#FACC15" stroke-width="2.5"/>
          <ellipse cx="655" cy="350" rx="42" ry="10" fill="rgba(234, 179, 8, 0.35)" stroke="#FEF08A" stroke-width="2"/>

          <ellipse cx="400" cy="352" rx="40" ry="10" fill="rgba(234, 179, 8, 0.35)" stroke="#FEF08A" stroke-width="2"/>
        </svg>
      `;
  }
}
