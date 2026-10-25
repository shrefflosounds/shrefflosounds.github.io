# Sidehop

<p align="center">
  <img src="assets/logo.png" width="160" alt="Sidehop Logo">
</p>

**A 2D Platformer Creator & Playful Personalization Studio**  
*Created by John O'Brien*

---

## 🎮 Overview

**Sidehop** is a web-based 2D platformer builder inspired by the tactile joy of *Kid Pix 3D*, the creative drawing of *Drawn to Life* and *WarioWare D.I.Y.*, and the instant-test level editing of *Super Mario Maker*. 

Build levels with snap-to-grid placement, customize every visual element using an in-app Kid Pix paint canvas or custom image/GIF uploads, fine-tune physical parameters (run speed, jump velocity, bounciness, and enemy patrols), and record video clips to download and share!

---

## ✨ Features

- **Instant In-Place Playtesting (Mario Maker style):** Toggle between Edit and Play modes with one click or by tapping `Spacebar`.
- **Procedural Squash & Stretch Animation:** Any doodle, cut-out photo, or imported sprite automatically squashes on landing, stretches on jumping, and leans into runs.
- **Kid Pix Art Studio:** In-app painting studio featuring brushes, markers, quirky stamps (stars, hearts, smiles), eraser, and direct Image/GIF imports.
- **Component Inspector:** Live parameter sliders for player speed, jump height, gravity/weight, double-jump toggling, block bounciness, springboard launch forces, and enemy patrol range.
- **Atmospheric Background Customizer:** Dynamic preset themes (Sky Blue, Sunset Gold, Midnight Galaxy, Synthwave Grid, Pastel Meadow, Lofi Notebook) plus custom image or animated GIF upload.
- **8 Core Starter Components:**
  1. Player Hero
  2. Ground & Solid Blocks
  3. Springboard Bouncers
  4. Spike Hazards
  5. Patrolling Grumpy Potato Enemies (stompable!)
  6. Moving Platforms (horizontal / vertical)
  7. Star Collectibles
  8. Goal Finish Line with Confetti Fanfare
- **Dual-Mode Video Recording:** Manual `● REC` button to capture canvas gameplay via `MediaRecorder` API with one-click `.webm` download, plus instant replay highlights.
- **Procedural Web Audio Engine:** Built-in retro chiptune BGM loop, goofy boings, squishy drawing sounds, coin chimes, and victory fanfares (zero external audio files needed).
- **Universal Level Sharing (.sidehop):** Custom package format (`.sidehop`) for one-click export and import of complete playable levels (layouts, physics parameters, custom entity visuals, and backgrounds), featuring instant drag-and-drop canvas loading.
- **Bundled Showcase Level:** "World 1-1: Sidehop Meadow" starter adventure included out of the box.

---

## 📦 The `.sidehop` File Format

Sidehop features a universal package format with the extension **`.sidehop`** (`application/x-sidehop+json`) for sharing creative platformer levels:

- **Playable Levels (`kind: "level"`):** Saves level layouts, entity placements, custom physics parameters, player stats, and embedded custom visuals.
- **Drag-and-Drop Support:** Drag any `.sidehop` file from your desktop directly onto the canvas stage to instantly load the level!


---

## 🌐 Live Application

- **Live URL:** [https://shrefflosounds.github.io/sidehop/](https://shrefflosounds.github.io/sidehop/)
- **Author Portfolio:** [https://shrefflosounds.github.io/](https://shrefflosounds.github.io/)
- **Current Version:** `v00000-001`

---

## 📲 Installing as a PWA (Offline Support)

Sidehop is a Progressive Web App (PWA) that installs directly to your home screen or dock and works completely offline:
- **Chrome / Edge (Mac, Windows, Android):** Click the install icon in the address bar, or choose Menu → *Install Sidehop*.
- **Safari on Mac:** Choose File → *Add to Dock*.
- **Safari on iPhone / iPad:** Tap Share → *Add to Home Screen*.

---

## 🚀 Running Locally

To run locally in any modern browser:

```bash
# Standard local preview:
python3 -m http.server 8000
```
Then open: `http://localhost:8000`

### Designer Markup & Review Tooling
Sidehop includes local markup review tools (Appendix A & B from course guidelines):
```bash
# Start local review server with interactive markup toolbar:
python3 tools/markup-server.py
```
This serves `http://localhost:8765/` with on-screen pen, arrow, note, and text editing tools. Marking up and clicking *Send batch to assistant* writes to `tools/markup-feedback.json` for rapid iteration.

---

## 📄 Documentation & Credits

- [BRIEF.md](BRIEF.md) — Design interview, user profile, core loop, and raison d'être
- [HANDOFF.md](HANDOFF.md) — Session handoff log, what works, and next steps
- [CHANGELOG.md](CHANGELOG.md) — Version history and release notes
- [ATTRIBUTION.md](ATTRIBUTION.md) — Borrowed techniques, inspirations, and API credits
- [LICENSE](LICENSE) — MIT License (c) 2026 John O'Brien

