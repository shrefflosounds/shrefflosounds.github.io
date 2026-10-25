# Sidehop — Project Brief

## 2.1 The Seed
- **Q1. In one sentence, what do you want to make?**  
  A playful, web-based 2D platformer creator and personalization studio where anyone can draw, tune, build, and record playable platforming worlds in minutes.
- **Q2. What medium does it work in?**  
  Play, 2D game design, interactive motion, sound synthesis, and digital drawing/painting.
- **Q3. What thing you've made, loved, or been frustrated by does this grow out of?**  
  Grows out of nostalgia for the uninhibited creative chaos of *Kid Pix 3D*, the tactile thrill of *Super Mario Maker*, and the custom doodle-to-life mechanics of *Drawn to Life* and *WarioWare D.I.Y.* Most modern game engines (Unity, Godot) have steep learning curves; Sidehop exists to make level creation as immediate as a box of crayons.
- **Reference:** Placed in `/reference/`. Tactile neo-brutalist toy workbench with punchy colors, thick ink outlines, and procedural squash-and-stretch.

---

## 2.2 Raison d'Être (Why Should This Exist?)
- **Q4. What does it let someone do, see or feel that they can't easily do now?**  
  Instantly draw or import any photo/doodle/GIF, have it automatically inherit lively procedural squash-and-stretch physics, place it into a platforming level, and playtest it with one keypress without compiling or loading.
- **Q5. What's the ONE thing it should do better than anything else?**  
  Instant, frictionless playtesting and personal expressive personalization (painting custom sprites and tuning physics on the fly).
- **Q6. What will it deliberately NOT do?**  
  It will NOT be a complex 3D engine, will NOT have a backend user account database or cloud multiplayer, and will NOT require programming scripts or installation steps.
- **Q7. Finish this sentence for the About panel:**  
  *Sidehop exists because building and playing your own video games should feel as immediate, tactile, and expressive as finger painting on drafting paper.*

---

## 2.3 The User
- **Q8. Who is the primary user?**  
  A design student or creative maker at a laptop or desktop computer with a keyboard and trackpad/mouse, spending 10 to 30 minutes between classes, wanting to sketch a quirky platformer world and export a fun video clip or `.sidehop` level package to share with classmates.
- **Q9. Is there a secondary user?**  
  Friends and playtesters who receive exported `.sidehop` files or watch downloaded `.webm` gameplay video recordings.
- **Q10. Who is it NOT for?**  
  Hardcore competitive esports players seeking complex scripting, or mobile phone users looking for a one-thumb casual tap-runner.

---

## 2.4 The Interaction Model
- **Q11. Primary input:**  
  Keyboard + Mouse/Trackpad (keyboard for Mario-style platformer controls `A`/`D`/`Space` and shortcuts, mouse/trackpad for grid placement, box select, and brush drawing).
- **Q12. Best model:**  
  Direct manipulation + parametric (direct drag/drop placement and freehand painting, backed by parametric physics sliders in the component inspector).
- **Q13. First 10 seconds:**  
  Opens directly into an inviting pre-populated playground ("World 1-1: Sidehop Meadow") with Hero, bounce pads, coins, and enemies ready to test immediately by pressing Space.
- **Q14. Core loop:**  
  Paint or select a block/entity → place on the grid → press Space to run and jump → tweak parameters or undo → export level or record clip.
- **Q15. What leaves the app?**  
  1. `.sidehop` project files (universal JSON package for complete levels or individual personal assets).  
  2. WebM video captures recorded directly from canvas via `MediaRecorder`.  
  3. PNG exports of custom painted sprites.

---

## 2.5 Prior Art and Research
1. **Super Mario Maker** (Nintendo, 2015): Benchmark for instantaneous in-place play/edit switching and grid-snapped level construction.
2. **Kid Pix 3D / Kid Pix Studio** (Craig Hickman / Broderbund, 1989/1994): Benchmark for tactile joy, chunky UI, squishy sounds, goofy stamps, and creative freedom.
3. **Drawn to Life** (5th Cell, 2007): Precedent for player-authored heroes and platforms walking inside the game.
4. **WarioWare D.I.Y.** (Nintendo, 2009): Micro-scale game and graphics customization with simple constraints.
5. **Bitsy Game Maker** (Adam Le Doux, 2016): Open-source precedent for single-browser, zero-backend creative game creation.
6. **PICO-8** (Joseph White / Lexaloffle, 2015): Fantasy console showing the elegance of integrated sprite and map editors.
- **Closest inspirations:** Super Mario Maker for level interaction; Kid Pix for artistic tactile feel.
- **What it does differently:** Runs entirely in any web browser with zero installation, instant video clip recording, and custom GIF/drawing animation.

---

## 2.6 Identity
- **Q19. Name:** **Sidehop** (lowercase URL: `sidehop`)
- **Q20. Wordmark register:** Chunky retro neo-brutalist toy workbench; thick ink borders (`3px solid #121212`), offset drop shadows (`4px 4px 0px #121212`), high tactile contrast.
- **Q21. Colors:**
  - Canvas / Drafting Paper: `#FAF8F5`
  - Cyber Cyan: `#00E5FF`
  - Canary Yellow: `#FFE600`
  - Bubblegum Magenta: `#FF3388`
  - Mint Green: `#00E676`
  - Ink Black: `#121212`
- **Q22. Voice:** Playful, encouraging, tactile, and direct.

---

## 2.7 Technical Choices
- **Q23. Versioning scheme:** Build counter format (`v00000-001`, `v00000-002`).
- **Q24. License:** MIT License.
- **Q25. Target platforms:** Modern desktop browsers (Chrome, Edge, Safari, Firefox) on macOS, Windows, Linux, and ChromeOS.
- **Q26. App display:** PWA with `standalone` display mode, installable to dock/desktop, offline-capable via service worker.

---

## 2.8 What's Mine
The overall concept, the Kid Pix-inspired platformer workbench fusion, the dual-mode in-place playtesting workflow, the `.sidehop` level/asset container specification, the procedural squash-and-stretch rendering algorithm for arbitrary drawings, the Web Audio chiptune/SFX synthesis engine, the custom Art Studio paint canvas, and the neo-brutalist toy visual identity are authored by John O'Brien.
