// Sidehop Level Persistence & Preset Levels Engine

import { SolidBlock, Springboard, HazardSpikes, EnemyWalker, MovingPlatform, Collectible, GoalFlag } from '../engine/entities.js?v=20261026_07';
import { SidehopFile } from './sidehop-format.js';
import { generateStandaloneGameHtml } from './standalone-game-builder.js';

const LEVEL_STORAGE_KEY = 'sidehop_saved_level_v6';

export const STARTER_WORLD_ENTITIES = [
  { type: 'crate', variant: 'solid', x: 0, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 0, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 40, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 40, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 80, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 80, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 120, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 120, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 160, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 200, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 240, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 240, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 280, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 280, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 320, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 320, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 360, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 360, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 400, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 400, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 440, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 440, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 200, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'mystery', x: 240, y: 320, width: 40, height: 40, content: 'powerup' },
  { type: 'crate', variant: 'solid', x: 280, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'mystery', x: 320, y: 320, width: 40, height: 40, content: 'coin' },
  { type: 'crate', variant: 'solid', x: 360, y: 320, width: 40, height: 40 },
  { type: 'collectible', variant: 'coin', x: 244, y: 430, width: 32, height: 32 },
  { type: 'collectible', variant: 'coin', x: 324, y: 430, width: 32, height: 32 },
  { type: 'enemy', variant: 'walker', x: 370, y: 440, width: 40, height: 40, speed: 75, patrolRange: 90, stompable: true },
  { type: 'crate', variant: 'slope_up', x: 480, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 480, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 480, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 520, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 520, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 520, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 560, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 560, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 560, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 600, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 600, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 600, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 640, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 640, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 640, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 680, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 680, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 680, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 720, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 720, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 720, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 760, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 760, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 760, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'pipe', x: 640, y: 360, width: 40, height: 80 },
  { type: 'collectible', variant: 'coin', x: 644, y: 310, width: 32, height: 32 },
  { type: 'enemy', variant: 'winged', x: 810, y: 280, width: 40, height: 40, speed: 75, patrolRange: 60, stompable: true },
  { type: 'crate', variant: 'slope_down', x: 800, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 800, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 800, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 840, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 840, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 880, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 880, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 920, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 920, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 960, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 960, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 1040, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1040, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 1080, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1080, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 1120, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1120, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 1160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1160, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 1200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1200, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 1240, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1240, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'note', x: 1000, y: 440, width: 40, height: 40, bounciness: 0.95 },
  { type: 'crate', variant: 'slab', x: 1120, y: 420, width: 40, height: 20 },
  { type: 'collectible', variant: 'coin', x: 1124, y: 370, width: 32, height: 32 },
  { type: 'crate', variant: 'cloud', x: 1080, y: 200, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 1120, y: 200, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 1160, y: 200, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 1200, y: 200, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 1240, y: 200, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 1280, y: 200, width: 40, height: 40 },
  { type: 'collectible', variant: 'star', x: 1164, y: 150, width: 32, height: 32 },
  { type: 'crate', variant: 'solid', x: 1280, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1280, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1320, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1320, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1360, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1360, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1400, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1400, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1440, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1440, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1480, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 1480, y: 520, width: 40, height: 40 },
  { type: 'enemy', variant: 'walker', x: 1400, y: 440, width: 40, height: 40, speed: 75, patrolRange: 70, stompable: true },
  { type: 'crate', variant: 'donut', x: 1520, y: 480, width: 40, height: 40 },
  { type: 'collectible', variant: 'coin', x: 1524, y: 430, width: 32, height: 32 },
  { type: 'crate', variant: 'donut', x: 1560, y: 480, width: 40, height: 40 },
  { type: 'collectible', variant: 'coin', x: 1564, y: 430, width: 32, height: 32 },
  { type: 'crate', variant: 'stone', x: 1600, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 1600, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'donut', x: 1640, y: 480, width: 40, height: 40 },
  { type: 'collectible', variant: 'coin', x: 1644, y: 430, width: 32, height: 32 },
  { type: 'crate', variant: 'donut', x: 1680, y: 480, width: 40, height: 40 },
  { type: 'collectible', variant: 'coin', x: 1684, y: 430, width: 32, height: 32 },
  { type: 'crate', variant: 'ice', x: 1720, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1720, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 1760, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1760, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 1800, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1800, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 1840, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1840, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 1880, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1880, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 1920, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1920, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 1960, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 1960, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 2000, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 2000, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 2040, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 2040, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 2080, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 2080, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 2120, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 2120, y: 520, width: 40, height: 40 },
  { type: 'enemy', variant: 'spiky', x: 1910, y: 440, width: 40, height: 40, speed: 75, patrolRange: 70, stompable: false },
  { type: 'crate', variant: 'mystery', x: 1800, y: 320, width: 40, height: 40, content: 'powerup' },
  { type: 'crate', variant: 'cloud', x: 2080, y: 240, width: 40, height: 40 },
  { type: 'crate', variant: 'mystery', x: 1920, y: 320, width: 40, height: 40, content: 'coin' },
  { type: 'crate', variant: 'semisolid', x: 2440, y: 360, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 2480, y: 360, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 2520, y: 360, width: 40, height: 40 },
  { type: 'collectible', variant: 'star', x: 2484, y: 310, width: 32, height: 32 },
  { type: 'enemy', variant: 'winged', x: 2460, y: 230, width: 40, height: 40, speed: 75, patrolRange: 50, stompable: true },
  { type: 'moving_platform', x: 2990, y: 420, width: 80, height: 24, speed: 60, distance: 70, axis: 'horizontal' },
  { type: 'crate', variant: 'stone', x: 3360, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3360, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3400, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3400, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3440, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3440, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3480, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3480, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3520, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3520, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3560, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3560, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3600, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3600, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3640, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3640, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3680, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3680, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3720, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3720, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3760, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3760, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3800, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3800, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3840, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3840, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3880, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3880, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3920, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3920, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3960, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 3960, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'mystery', x: 3440, y: 320, width: 40, height: 40, content: 'heart' },
  { type: 'crate', variant: 'mega', x: 3600, y: 400, width: 80, height: 80 },
  { type: 'collectible', variant: 'coin', x: 3624, y: 340, width: 32, height: 32 },
  { type: 'crate', variant: 'pipe', x: 3880, y: 400, width: 40, height: 80 },
  { type: 'enemy', variant: 'spiky', x: 3780, y: 440, width: 40, height: 40, speed: 75, patrolRange: 40, stompable: false },
  { type: 'springboard', variant: 'mega', x: 3960, y: 440, width: 40, height: 40, launchForce: 1040 },
  { type: 'hazard', x: 4000, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4000, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 4040, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4040, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 4080, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4080, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 4120, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4120, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 4160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4160, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone_slope_up', x: 4200, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4200, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone_slope_up', x: 4240, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4240, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4240, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4240, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4280, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4280, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4280, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 4280, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'mystery', x: 4280, y: 240, width: 40, height: 40, content: 'powerup' },
  { type: 'moving_platform', x: 4700, y: 380, width: 80, height: 24, speed: 65, distance: 60, axis: 'vertical' },
  { type: 'enemy', variant: 'winged', x: 4460, y: 240, width: 40, height: 40, speed: 75, patrolRange: 60, stompable: true },
  { type: 'crate', variant: 'stone', x: 5160, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5160, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5160, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5200, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5200, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5200, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5240, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5240, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5240, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5240, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5280, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5280, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5280, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5280, y: 520, width: 40, height: 40 },
  { type: 'enemy', variant: 'walker', x: 5140, y: 360, width: 40, height: 40, speed: 75, patrolRange: 50, stompable: true },
  { type: 'crate', variant: 'stone_slope_down', x: 5320, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5320, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5320, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5320, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone_slope_down', x: 5360, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5360, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 5360, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 5400, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 5400, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 5440, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 5440, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 5480, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 5480, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5520, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5520, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5560, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5560, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5600, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5600, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5640, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5640, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5680, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5680, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5720, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5720, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5760, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5760, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5800, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5800, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5840, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5840, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5880, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5880, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5920, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5920, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 5960, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 5960, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 6000, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 6000, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'ice', x: 6040, y: 480, width: 40, height: 40, friction: 0.12 },
  { type: 'crate', variant: 'solid', x: 6040, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5640, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5680, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5720, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5760, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5800, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5840, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5880, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'semisolid', x: 5920, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'mystery', x: 5800, y: 200, width: 40, height: 40, content: 'heart' },
  { type: 'collectible', variant: 'coin', x: 5524, y: 330, width: 32, height: 32 },
  { type: 'enemy', variant: 'spiky', x: 5680, y: 440, width: 40, height: 40, speed: 55, patrolRange: 60, stompable: false },
  { type: 'enemy', variant: 'spiky', x: 5980, y: 440, width: 40, height: 40, speed: 60, patrolRange: 60, stompable: false },
  { type: 'crate', variant: 'mystery', x: 6160, y: 320, width: 40, height: 40, content: 'powerup' },
  { type: 'crate', variant: 'solid', x: 6080, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6080, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6120, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6120, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6160, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6200, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6240, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6240, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6280, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'solid', x: 6280, y: 520, width: 40, height: 40 },
  { type: 'enemy', variant: 'walker', x: 6050, y: 440, width: 40, height: 40, speed: 75, patrolRange: 70, stompable: true },
  { type: 'crate', variant: 'cloud', x: 6520, y: 280, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6560, y: 280, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6600, y: 280, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6640, y: 280, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6680, y: 280, width: 40, height: 40 },
  { type: 'collectible', variant: 'coin', x: 7244, y: -90, width: 32, height: 32 },
  { type: 'crate', variant: 'note', x: 6680, y: 240, width: 40, height: 40, bounciness: 0.95 },
  { type: 'crate', variant: 'cloud', x: 6840, y: 120, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6880, y: 120, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6920, y: 120, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 6960, y: 120, width: 40, height: 40 },
  { type: 'crate', variant: 'cloud', x: 7000, y: 120, width: 40, height: 40 },
  { type: 'collectible', variant: 'star', x: 6324, y: 170, width: 32, height: 32 },
  { type: 'enemy', variant: 'winged', x: 7250, y: 0, width: 40, height: 40, speed: 75, patrolRange: 60, stompable: true },
  { type: 'crate', variant: 'donut', x: 7720, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 7920, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 7920, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 7960, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 7960, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8000, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8000, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8040, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8040, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8080, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8080, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8120, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8120, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8160, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8200, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8240, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8240, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8280, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8280, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8320, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8320, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8360, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8360, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'mega', x: 7920, y: 400, width: 80, height: 80 },
  { type: 'crate', variant: 'pipe', x: 8880, y: 400, width: 40, height: 80 },
  { type: 'enemy', variant: 'spiky', x: 8190, y: 440, width: 40, height: 40, speed: 75, patrolRange: 50, stompable: false },
  { type: 'springboard', variant: 'mega', x: 8340, y: 440, width: 40, height: 40, launchForce: 1040 },
  { type: 'hazard', x: 8400, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8400, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 8440, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8440, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 8480, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8480, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 8520, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8520, y: 520, width: 40, height: 40 },
  { type: 'hazard', x: 8560, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8560, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8600, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8600, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8640, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8640, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8680, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8680, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8720, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8720, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8760, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8760, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8640, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8680, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8680, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8720, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8720, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8720, y: 360, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8760, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8760, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8760, y: 360, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8760, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 440, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 400, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 360, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 320, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8800, y: 280, width: 40, height: 40 },
  { type: 'collectible', variant: 'star', x: 8804, y: 110, width: 32, height: 32 },
  { type: 'crate', variant: 'stone', x: 8840, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8840, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8880, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8880, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8920, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8920, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8960, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 8960, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9000, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9000, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9040, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9040, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9080, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9080, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9120, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9120, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9160, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9160, y: 520, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9200, y: 480, width: 40, height: 40 },
  { type: 'crate', variant: 'stone', x: 9200, y: 520, width: 40, height: 40 },
  { type: 'goal', x: 9180, y: 400, width: 48, height: 80 },
  { type: 'crate', variant: 'cloud', x: 2280, y: 200, width: 40, height: 40 },
  { type: 'springboard', variant: 'mega', x: 1560, y: 200, width: 40, height: 40, launchForce: 1040 },
  { type: 'crate', variant: 'mystery', x: 5760, y: 200, width: 40, height: 40, content: 'heart' },
  { type: 'springboard', variant: 'spring', x: 7520, y: 240, width: 40, height: 40, launchForce: 840 },
  { type: 'crate', variant: 'slab', x: 7360, y: 120, width: 40, height: 20 },
  { type: 'crate', variant: 'slab', x: 7400, y: 120, width: 40, height: 20 },
];

export class LevelStorage {
  // Serialize active level to JSON-compatible object
  static serialize(player, entities, background = { theme: 'sky', customImage: null }) {
    const activeTheme = (typeof window !== 'undefined' && window.sidehop?.currentTheme) || 'grass';
    return {
      version: 2,
      name: 'Starter World',
      theme: activeTheme,
      background: background,
      player: {
        spawnX: player.spawnX,
        spawnY: player.spawnY,
        speed: player.speed,
        jumpForce: player.jumpForce,
        gravityScale: player.gravityScale,
        maxHearts: player.maxHearts || 4,
        doubleJumpAllowed: player.doubleJumpAllowed,
        color: player.color || null,
        customVisual: player.customVisual
      },
      entities: entities.map(ent => LevelStorage.serializeEntity(ent))
    };
  }

  // Serialize single entity to JSON-friendly descriptor
  static serializeEntity(ent) {
    if (!ent) return null;
    return {
      type: ent.type,
      variant: ent.variant,
      material: ent.material || null,
      content: ent.content || null,
      color: ent.color || null,
      x: ent.x,
      y: ent.y,
      width: ent.width,
      height: ent.height,
      customVisual: ent.customVisual || null,
      bounciness: ent.bounciness,
      friction: ent.friction,
      launchForce: ent.launchForce,
      speed: ent.speed,
      patrolRange: ent.patrolRange,
      stompable: ent.stompable,
      distance: ent.distance,
      axis: ent.axis
    };
  }

  // Create single entity instance from descriptor
  static createEntityFromData(d) {
    if (!d || !d.type) return null;
    let ent = null;
    switch (d.type) {
      case 'crate':
      case 'block':
        ent = new SolidBlock(d.x, d.y, d.width, d.height, d.variant || 'solid', d.content || null);
        if (d.material) ent.material = d.material;
        if (d.bounciness !== undefined) ent.bounciness = d.bounciness;
        if (d.friction !== undefined) ent.friction = d.friction;
        if (d.content) ent.content = d.content;
        break;
      case 'springboard':
        ent = new Springboard(d.x, d.y, d.width, d.height, d.variant || 'spring');
        if (d.launchForce !== undefined) ent.launchForce = d.launchForce;
        break;
      case 'hazard':
        ent = new HazardSpikes(d.x, d.y, d.width, d.height);
        break;
      case 'enemy':
        ent = new EnemyWalker(d.x, d.y, d.width, d.height, d.variant || 'walker');
        if (d.speed !== undefined) ent.speed = d.speed;
        if (d.patrolRange !== undefined) ent.patrolRange = d.patrolRange;
        if (d.stompable !== undefined) ent.stompable = d.stompable;
        break;
      case 'moving_platform':
        ent = new MovingPlatform(d.x, d.y, d.width, d.height);
        if (d.speed !== undefined) ent.speed = d.speed;
        if (d.distance !== undefined) ent.distance = d.distance;
        if (d.axis !== undefined) ent.axis = d.axis;
        break;
      case 'collectible':
        ent = new Collectible(d.x, d.y, d.width, d.height, d.variant || 'coin');
        break;
      case 'goal':
        ent = new GoalFlag(d.x, d.y, d.width, d.height);
        break;
    }

    if (ent) {
      if (d.color) ent.setColor(d.color);
      if (d.customVisual) ent.setCustomVisual(d.customVisual);
    }
    return ent;
  }

  // Clone an entity with an optional new coordinate
  static cloneEntity(ent, targetX, targetY) {
    if (!ent) return null;
    const data = this.serializeEntity(ent);
    if (targetX !== undefined) data.x = targetX;
    if (targetY !== undefined) data.y = targetY;
    return this.createEntityFromData(data);
  }

  // Restore entities from data object
  static deserialize(data, player, entities) {
    if (!data) return null;

    // Restore player
    if (data.player) {
      player.setSpawn(data.player.spawnX || 120, data.player.spawnY || 360);
      if (data.player.speed) player.speed = data.player.speed;
      if (data.player.jumpForce) player.jumpForce = data.player.jumpForce;
      if (data.player.gravityScale !== undefined) player.gravityScale = data.player.gravityScale;
      if (data.player.maxHearts !== undefined) {
        player.maxHearts = data.player.maxHearts;
        player.hearts = player.maxHearts;
      }
      if (data.player.doubleJumpAllowed !== undefined) {
        player.doubleJumpAllowed = data.player.doubleJumpAllowed;
        player.hasDoubleJump = data.player.doubleJumpAllowed;
      }
      if (data.player.color) player.setColor(data.player.color);
      if (data.player.customVisual) player.setCustomVisual(data.player.customVisual);
    }

    // Clear and restore entities
    entities.length = 0;
    if (Array.isArray(data.entities)) {
      data.entities.forEach(d => {
        const ent = LevelStorage.createEntityFromData(d);
        if (ent) entities.push(ent);
      });
    }

    const bg = data.background || { theme: 'sky', customImage: null };
    if (data.theme) {
      bg.worldTheme = data.theme;
    }
    return bg;
  }

  // LocalStorage Auto-save
  static autoSave(player, entities, background) {
    // Never overwrite user's work while built-in interactive demo is running
    if (typeof window !== 'undefined' && window.sidehop && window.sidehop.isDemoActive) {
      return;
    }
    // Never overwrite clean level design while active playtest simulation is running
    if (typeof window !== 'undefined' && window.sidehop && window.sidehop.mode === 'play') {
      return;
    }
    try {
      const data = this.serialize(player, entities, background);
      localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // LocalStorage Auto-load
  static autoLoad(player, entities) {
    try {
      const raw = localStorage.getItem(LEVEL_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return this.deserialize(data, player, entities);
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
    return null;
  }

  // Download Level as .sidehop package file
  static exportLevel(player, entities, background, customTitle) {
    const data = this.serialize(player, entities, background);
    const title = customTitle || data.name || 'Sidehop Level';
    const pkg = SidehopFile.createLevelPackage(data, {
      title: title,
      description: 'Platformer level created with Sidehop'
    });
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sidehop-level';
    SidehopFile.download(`${slug}-${Date.now()}.sidehop`, pkg);
    return pkg;
  }

  // Export Level as a Standalone Playable Single-File HTML Game (Offline, No Editor UI)
  static async exportStandaloneHtml(player, entities, background, theme = 'grass', customTitle) {
    const data = this.serialize(player, entities, background);
    data.theme = theme;
    const title = customTitle || data.name || 'Sidehop Level';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sidehop-game';

    const standaloneHtml = generateStandaloneGameHtml(data, title);
    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  }

  // Import any .sidehop package (or legacy JSON level)
  static importLevel(file, player, entities, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = SidehopFile.parse(e.target.result);

        if (parsed.kind === 'level' || parsed.level) {
          const levelData = parsed.level || parsed;
          const bg = this.deserialize(levelData, player, entities);
          if (callback) {
            callback({
              kind: 'level',
              background: bg,
              meta: parsed.meta,
              levelName: parsed.meta?.title || levelData?.name || 'Sidehop Level'
            });
          }
        } else if (parsed.kind === 'asset') {
          if (callback) {
            callback({
              kind: 'asset',
              asset: parsed.asset,
              meta: parsed.meta
            });
          }
        } else if (parsed.kind === 'bundle') {
          let bg = null;
          if (parsed.level) {
            bg = this.deserialize(parsed.level, player, entities);
          }
          if (callback) {
            callback({
              kind: 'bundle',
              background: bg,
              level: parsed.level,
              assets: parsed.assets || [],
              meta: parsed.meta
            });
          }
        } else {
          alert('This file does not contain a Sidehop level or asset.');
        }
      } catch (err) {
        console.error('Sidehop file import error:', err);
        alert('Invalid Sidehop file (.sidehop or .json): ' + (err.message || 'Parse error'));
      }
    };
    reader.readAsText(file);
  }

  // Default Preset: Starter World (Cleaned layout)
  static getStarterWorld() {
    const entities = STARTER_WORLD_ENTITIES.map(d => LevelStorage.createEntityFromData(d)).filter(Boolean);
    return {
      background: { theme: 'sky', customImage: null },
      playerSpawn: { x: 80, y: 400 },
      entities
    };
  }

  // Alias for backward compatibility
  static getPresetCrateChallenge() {
    return this.getStarterWorld();
  }
}

if (typeof window !== 'undefined') {
  window.LevelStorage = LevelStorage;
  window.STARTER_WORLD_ENTITIES = STARTER_WORLD_ENTITIES;
}
