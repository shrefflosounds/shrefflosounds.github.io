# Sidehop 🐰📦

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
- **Component Inspector:** Live parameter sliders for player speed, jump height, gravity/weight, double-jump toggling, crate bounciness, springboard launch forces, and enemy patrol range.
- **8 Core Starter Components:**
  1. Player Hero
  2. Milk Crates & Solid Blocks
  3. Springboard Bouncers
  4. Spike Hazards
  5. Patrolling Grumpy Potato Enemies (stompable!)
  6. Moving Platforms (horizontal / vertical)
  7. Star Collectibles
  8. Goal Finish Line with Confetti Fanfare
- **Dual-Mode Video Recording:** Manual `● REC` button to capture canvas gameplay via `MediaRecorder` API with one-click `.webm` download, plus instant replay highlights.
- **Procedural Web Audio Engine:** Built-in retro chiptune BGM loop, goofy boings, squishy drawing sounds, coin chimes, and victory fanfares (zero external audio files needed).
- **Universal Level Sharing:** Auto-saves to browser storage (`localStorage`) and allows one-click JSON Level Export and Import.
- **Bundled Showcase Level:** "The Milk Crate Hop" tribute challenge included out of the box.

---

## 🚀 Running Locally

To run locally in any modern browser:

```bash
# Using Python 3's built-in HTTP server:
python3 -m http.server 8000
```
Then open: `http://localhost:8000`

---

## 🌐 Live GitHub Pages Deployment

This repository includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes directly to GitHub Pages upon pushing to `main`.
