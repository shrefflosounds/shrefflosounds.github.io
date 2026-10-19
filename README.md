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
- **Universal Level & Personal Asset Sharing (.sidehop):** Custom package format (`.sidehop`) for one-click export and import of both complete playable levels and individual personal assets (hero skins, painted blocks, custom enemy doodles, animated GIF textures, custom backgrounds, and asset bundles), featuring instant drag-and-drop canvas loading.
- **Personal Asset Studio & Stash:** In-browser personal asset library for saving, managing, applying, and exporting custom visual components across levels.
- **Bundled Showcase Level:** "World 1-1: Sidehop Meadow" starter adventure included out of the box.

---

## 📦 The `.sidehop` File Format

Sidehop features a universal package format with the extension **`.sidehop`** (`application/x-sidehop+json`) for sharing creative platformer content:

- **Playable Levels (`kind: "level"`):** Saves level layouts, entity placements, custom physics parameters, player stats, and embedded personal art.
- **Personal Assets (`kind: "asset"`):** Saves individual custom sprites, hero skins, hand-painted tiles, stamp doodles, or custom background art created in the Kid Pix Art Studio.
- **Asset Bundles (`kind: "bundle"`):** Packages multiple personal assets or levels with companion asset stashes for easy sharing.
- **Drag-and-Drop Support:** Drag any `.sidehop` file from your desktop directly onto the canvas stage to instantly load the level or save the asset into your personal stash!


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
