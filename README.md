# 🌕 The Silent Lunar Museum — *Abandoned, But Not Forgotten*

> **NASA Space Apps Challenge — Storytelling about NASA's Discarded Equipment on the Moon and Mars**

Uma experiência web interativa de exploração lunar e *storytelling* em **1ª pessoa** onde os próprios equipamentos deixados pela NASA na Lua ganham voz para narrar sua jornada, a engenharia que os manteve vivos e as descobertas científicas que tornaram possíveis.

---

## ✨ Principais Recursos e Diferenciais

1. **Globo Lunar 3D Interativo com Telemetria Real (`js/moon3d.js`)**
   - Projeção esférica 3D interativa com mares lunares (*Mare Tranquillitatis*, *Mare Imbrium*, *Mare Serenitatis*, *Oceanus Procellarum*, etc.), crateras com sistemas de raios (*Tycho*, *Copernicus*, *Kepler*, *Aristarchus*), grade selenográfica, **Zonas de Exclusão Históricas da NASA** e animação em tempo real do **Feixe Laser Terra–Lua (532 nm)**.

2. **Storytelling em 1ª Pessoa Adaptado por Faixa Etária + Bilíngue (`js/data.js`)**
   - **Idiomas:** Português (`PT-BR`) e Inglês (`EN-US`) com troca em tempo real.
   - **Adaptação por Idade:** Cada equipamento conta sua história em **3 níveis de profundidade e tom**:
     - 🧒 **Criança (7–11 anos • Jovem Astronauta):** Narrativa lúdica, curiosa e acessível.
     - 🧑 **Adolescente (12–17 anos • Cadete Espacial):** Desafios extremos de engenharia, curiosidades humanas e física em ação.
     - 🎓 **Adulto (18+ anos • Curador Científico):** Crônica literária e poética em 1ª pessoa combinada com rigor físico, dados técnicos e artigos oficiais da NASA.

3. **Narração em Áudio (Text-to-Speech) & Paisagem Sonora Espacial (`js/audio.js`)**
   - Leitura em voz alta (PT-BR e EN-US) sincronizada parágrafo por parágrafo com equalizador visual.
   - **Tons Quindar Autênticos da Apollo** (`2525 Hz` / `2475 Hz`) ao iniciar/encerrar transmissões e trilha sonora procedural espacial via Web Audio API.

4. **Inspeção de Anatomia (Renders Fotorealistas + Esquemas Técnicos Blueprint SVG com Hotspots)**
   - Alterne entre fotografias/renders em solo lunar e esquemas técnicos vetoriais com **5 pontos interativos (hotspots)** em cada equipamento.

5. **Laboratórios de Ciência Interativos (`js/labs.js`)**
   - **Simulador LLR (Retrorefletor Laser Apollo 11):** Dispare pulsos laser da Terra, teste a reflexão em prismas *corner-cube* ($d = \frac{c \cdot \Delta t}{2}$) e calcule o afastamento da Lua ($3,8\text{ cm/ano}$) de 1969 a 2050.
   - **Sismógrafo Lunar de 3 Eixos & Simulador Térmico Nuclear (PSE Apollo 11):** Simule impactos de meteoritos e *moonquakes* nos 3 eixos e acompanhe o aquecedor nuclear de radioisótopo mantendo $-54^\circ\text{C}$ durante a noite lunar de 340 horas a $-170^\circ\text{C}$.
   - **Navegador Giroscópico ("Fio de Ariadne") & Câmera de Ed Fendell (Rover Lunar LRV):** Explore os episódios do *Seatbelt Basalt* (Apollo 15), do reparo do para-lama com mapas (Apollo 17) e opere remotamente a câmera de TV para filmar a decolagem final da humanidade na Lua.
   - **Laboratório Base Tranquilidade (Módulo Eagle Apollo 11):** Comparador de gravidade $1/6$ e inspeção da placa histórica *"We came in peace for all mankind"*.

6. **Passaporte de Memórias Lunares & Desafio do Curador**
   - Colecione os carimbos das estações lunares visitadas e responda ao quiz educativo bilíngue.

---

## 🚀 Como Executar Localmente

Basta iniciar um servidor HTTP simples na pasta do projeto:

```bash
python3 -m http.server 8080
```

Depois, acesse no navegador: **http://localhost:8080**
