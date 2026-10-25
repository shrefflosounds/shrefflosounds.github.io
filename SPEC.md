# Sidehop — Alpha Specification & Project Handoff Document

**App Name:** Sidehop  
**Creator:** John O'Brien  
**Lead AI Architect:** Antigravity (Agy)  
**Target Milestone:** Full Working Demo Live on GitHub Pages by Monday  
**Repository Directory:** `/Users/johnobrien/Documents/antigravity/sidehop`

---

## 1. Project Identity & Overview

| Dimension | Specification |
| :--- | :--- |
| **What is it called?** | **Sidehop** |
| **Who is it for?** | A joyful, accessible creative sandbox fusing the tactile, uninhibited experimentation of *Kid Pix 3D* with personal expressive creativity. Designed for young creators, casual meme makers, and playful designers who want to turn any doodle, photo, or GIF into a playable platformer in seconds. |
| **What does it do?** | Empowers users to effortlessly build 2D platformer levels, paint or import custom visuals (sprites, tiles, and backgrounds), fine-tune component physics and behaviors via intuitive sliders, playtest seamlessly in-place, and record gameplay video clips for instant download and sharing. |
| **How does it work?** | Operates on a dual-mode workflow: **Edit Mode** features a snap-to-grid 2D plane with drag-and-drop entity palettes and context-sensitive inspector cards. **Play Mode** slides the tools away for instant arcade testing with full physics and keyboard/touch controls. |
| **Key Benchmark References** | - *Super Mario Maker:* Instant in-place play/edit switching, grid-snapped object placement, intuitive palettes.<br>- *Drawn to Life:* Player-authored characters, custom platforms, and expressive world personalization.<br>- *WarioWare D.I.Y.:* Micro-scale creativity, accessible visual tools, and custom behavioral tuning.<br>- *Kid Pix 3D:* Tactile joy, squishy audio/visual feedback, oversized buttons, and playful creative abandon. |

---

## 2. Visual Identity & Aesthetic System

- **Design Philosophy:** **Neo-Brutalist Toy Workbench** (Fusion of *Kid Pix*, *WarioWare D.I.Y.*, and Modern Neo-Brutalism).
- **Styling Rules:**
  - Thick, unapologetic black ink borders (`2.5px – 3px solid #121212`).
  - Hard, crisp offset drop shadows (`4px 4px 0px #121212`) that compress on press (`translate(2px, 2px)` with shadow reduction) for tactile physical feedback.
  - Smooth rounded corners (`border-radius: 12px – 16px`) on buttons and container panels.
- **Color Palette:**
  - **Canvas & Workbench:** Warm drafting paper / subtle grid cream (`#FAF8F5`).
  - **Electric Cyber Cyan (`#00E5FF`):** Main interactive accents, selection rings, primary buttons.
  - **Canary Pop Yellow (`#FFE600`):** Tool drawer headers, highlight banners, star collectibles.
  - **Bubblegum Magenta (`#FF3388`):** Player character accents, special trigger states, paint accents.
  - **Mint Green (`#00E676`):** "PLAY / TEST" button, goal flags, success states.
  - **Punchy Crimson (`#FF3B30`):** "● REC" record button, hazard spikes.
  - **Ink Black (`#121212`):** Crisp outlines, typography, and contrast borders.

---

## 3. Interaction Model & Mode Switching

### Edit Mode $\longleftrightarrow$ Play Mode Transition
1. **Instant In-Place Testing (Mario Maker Style):**
   - In **Edit Mode**, creators drag, place, erase, paint, and inspect level components on a snap-to-grid canvas.
   - Clicking the oversized green **"PLAY"** button (or pressing `Spacebar` / `Tab`) triggers a fluid sliding transition where tool drawers retract to the margins.
   - The game becomes active immediately right from the player's current position (with a secondary "Restart from Start Flag" button in the HUD).
   - Pressing **"EDIT"** freezes physics in place and slides the creative workbench tools back into view.

### Entity Interaction & Customization
- **Context-Sensitive Pop-ups:** Clicking any placed entity or palette item pops up a miniature action card with:
  1. **Paint / Customize (Pencil Icon):** Opens the in-app Art Studio modal.
  2. **Inspect / Tune (Slider Icon):** Opens the Physics & Behavior tuning panel.
  3. **Duplicate / Delete:** Rapid level composition tools.

---

## 4. Feature Set & Tools

### A. Level Editor & Grid Engine
- **Grid Snapping:** Responsive 32x32px or 48x48px grid alignment for clean platforming architecture.
- **Starter Entity Library (8 Core Components):**
  1. **Player Hero:** Start spawn location with customizable sprite.
  2. **Solid Blocks & Platforms:** Ground, brick, and solid terrain blocks.
  3. **Bouncers / Trampolines:** High-launch springboards.
  4. **Hazards:** Spikes and pit traps triggering instant comical defeat & respawn.
  5. **Enemies / Walkers:** Patrolling ground creatures.
  6. **Moving Platforms:** Floating platforms with customizable travel path.
  7. **Collectibles:** Coins, gems, and snack tokens that increase score.
  8. **Goal Finish Line:** Flagpole / trophy triggering victory fanfare.

### B. Customization Studio (Paint & Import)
- **Art Studio Modal:**
  - Freehand drawing canvas with adjustable brush sizes, eraser, color palette, and quirky stamp brushes.
  - Image file uploader (PNG, JPG, WebP) with transparent background helper.
  - Animated GIF uploader with native frame cycling.
- **Atmospheric Background Customizer:**
  - Dynamic preset themes (Sky Blue, Sunset Gold, Midnight Galaxy, Synthwave Grid, Pastel Meadow, Lofi Notebook).
  - Custom image / animated GIF background upload with parallax support.
- **Procedural Squash & Stretch Animation:**
  - Any hand-drawn doodle or photo cutout dynamically squashes on ground landing, stretches on jump takeoff, leans into running acceleration, and gently breathes while idling.

### C. Component Inspector (Finer Parameter Tuning)
- **Player Tuning:** Run Speed slider, Jump Velocity slider, Gravity/Weight slider, Double-Jump toggle.
- **Block Tuning:** Bounciness slider (0 = dead stop, 1 = bouncy rubber), Friction slider.
- **Spring Tuning:** Launch Force slider.
- **Enemy Tuning:** Patrol Speed, Patrol Distance, Stompable (stomp to defeat) vs. Deadly.
- **Moving Platform Tuning:** Axis (Horizontal vs. Vertical), Speed, Travel Distance.

### D. Audio & Sound Design (Full Tactile Toy Audio)
- Built with zero-dependency browser Web Audio API:
  - Goofy boing on jump, tactile squish on landing.
  - Squelchy paint sounds when drawing in the Art Studio.
  - Cheerful chime on collectible pickup.
  - Wacky defeat sound & celebratory victory fanfare.
  - Optional toggleable upbeat retro background chiptune track.
  - Master Mute / Sound FX volume toggle.

### E. Video Recording & Sharing
- **Tactile Manual REC Mode:** Chunky vintage red `● REC` button on the header (or shortcut `R`). While active, an animated retro camcorder overlay pulses. Stopping opens a preview modal with one-click `.webm` video download and animated GIF export.
- **Automatic 15-Second Instant Replay Buffer:** Rolling canvas buffer in memory enabling a one-click "Save Replay Clip" on the victory screen.
- **Dual-Tier Level Persistence:**
  - Auto-saves levels and custom artwork directly in browser `localStorage`.
  - One-click **"Export Level (.sidehop / .json)"** and **"Import Level"** for sharing levels with friends.
  - Built-in pre-made starter levels ("World 1-1: Sidehop Meadow" and "Bouncy Castle") ready to play immediately.

---

## 5. Technical Architecture & Tech Stack

```
/Users/johnobrien/Documents/antigravity/sidehop/
├── index.html              # Main responsive Neo-Brutalist workbench & canvas HUD
├── css/
│   └── style.css           # Neo-Brutalist theme (thick borders, offset shadows, animations)
├── js/
│   ├── main.js             # App coordinator & state management
│   ├── engine/
│   │   ├── physics.js      # 2D platformer physics, AABB collisions, squash/stretch math
│   │   ├── entities.js     # Player, Crates, Bouncers, Hazards, Enemies, Platforms, Goals
│   │   └── camera.js       # Smooth 2D tracking camera with bounds
│   ├── editor/
│   │   ├── grid.js         # Snap-to-grid placement, selection, deletion, drag-and-drop
│   │   ├── inspector.js    # Parameter tuning sliders (speed, jump, weight, behavior)
│   │   └── paint.js        # In-app Kid Pix drawing canvas, stamps, image/GIF importer
│   ├── audio/
│   │   └── sound.js        # Web Audio API procedural sound synthesizer & music engine
│   ├── recorder/
│   │   └── recorder.js     # MediaRecorder canvas video capture & replay buffer
│   └── storage/
│       ├── storage.js          # LocalStorage auto-save & level persistence
│       └── sidehop-format.js   # Universal .sidehop package parser, serializer & schema
├── assets/                 # Default SVG stamps, sound presets, and demo levels
├── .github/
│   └── workflows/
│       └── deploy.yml      # Automated GitHub Pages CI/CD deployment
└── SPEC.md                 # This live specification document
```

### The `.sidehop` File Format Specification
The `.sidehop` file is a structured JSON package (`application/x-sidehop+json`):
1. **`kind: "level"`**: Full level world definition (version, name, background, player parameters, and entity list with custom visuals).

- **Universal Auto-Detection:** Seamlessly parses `.sidehop` packages or legacy JSON levels and loads the level layout.
- **Drag-and-Drop:** Canvas stage detects file drops and loads `.sidehop` levels immediately.

- **Runtime:** 100% Client-Side Modern JavaScript (ES6 Modules) + HTML5 2D Canvas.
- **Zero Heavy Build Dependencies:** No complex node build toolchains required to run; instant live reload, zero build errors, completely static and guaranteed 100% compatible with GitHub Pages.

---

## 6. What We Know vs. What We Know That We Don't Know

### What We Know (Solidified)
1. App name: **Sidehop** by John O'Brien.
2. Target vibe: A blend of Kid Pix 3D playful playroom chaos + personal expressive freedom.
3. Visuals: Neo-Brutalist Toy Workbench with thick borders, hard drop shadows, and punchy pop colors.
4. Interaction: Instant in-place Mario Maker play/edit switching with grid-snapped level construction.
5. Customization: Pop-up pencil button on objects opening the Art Studio (brush, eraser, stamps, image/GIF import) with procedural squash & stretch.
6. Physics Inspector: Sliders for player speed/jump/weight, enemy patrol, platform range, and crate bounciness.
7. Audio: Tactile procedural Web Audio sound design with mute controls.
8. Video Recording: Dual-mode manual REC + rolling 15s instant replay buffer.
9. Persistence: LocalStorage auto-save + JSON level export/import.
10. Target Delivery: Live on GitHub Pages for Monday demo.

### What We Know That We Don't Know (Implementation Micro-Choices)
1. **GitHub Credentials / Target Repo:** John will authorize GitHub via `gh auth login` in the terminal or provide a Personal Access Token / repo name.
2. **Touch / Mobile Support:** Whether the Monday demo is strictly keyboard + mouse (desktop) or needs on-screen touch D-pad for mobile/tablet browsers (we will include responsive touch controls just in case!).
3. **Demo Level Theme:** The default starter level will celebrate the iconic crate challenge from the slide deck.

---

## 7. Immediate Action Plan

1. **GitHub Connection:** Run `gh auth login` or configure Git credentials.
2. **Core Engine Construction:** Build the responsive HTML5 canvas, physics engine with procedural squash-and-stretch, and grid level editor.
3. **Neo-Brutalist Workbench UI:** Build the draggable entity palette, slide-away drawer transitions, and the pop-up inspector.
4. **Kid Pix Art Studio:** Build the modal paint canvas, brush tools, and image/GIF uploader.
5. **Web Audio & Video Recorder:** Implement the Web Audio sound generator and canvas `MediaRecorder`.
6. **Deploy to GitHub Pages:** Push to repository and verify the live public URL.
