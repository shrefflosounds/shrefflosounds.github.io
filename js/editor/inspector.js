// Sidehop Component Inspector — Real-Time Parameter Tuning

import { sounds } from '../audio/sound.js?v=20261028_205041';
import { SolidBlock } from '../engine/entities.js?v=20261028_205041';

export class Inspector {
  constructor(panelElement) {
    this.panel = panelElement;
    this.targetEntity = null;
    this.fieldsContainer = this.panel.querySelector('#inspector-fields');
    this.titleElement = this.panel.querySelector('#inspector-title');
    this.closeBtn = this.panel.querySelector('#inspector-close');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
  }

  open(entity) {
    this.targetEntity = entity;
    this.panel.classList.add('active');
    this.titleElement.textContent = '🎛️ Inspector & Physics Tuner';
    this.renderFields();
    sounds.playClick();
  }

  close() {
    this.panel.classList.remove('active');
    this.targetEntity = null;
    sounds.playClick();
  }

  renderFields() {
    this.fieldsContainer.innerHTML = '';
    const ent = this.targetEntity;
    if (!ent) return;

    // General Information Card
    const infoCard = document.createElement('div');
    infoCard.className = 'inspector-info-card';
    infoCard.innerHTML = `
      <div>Component: ${ent.type.toUpperCase()}${ent.variant ? ` (${ent.variant})` : ''}</div>
      <div>Position: X: ${Math.round(ent.x)}px, Y: ${Math.round(ent.y)}px</div>
      <div>Size: Width: ${Math.round(ent.width || 40)}px, Height: ${Math.round(ent.height || 40)}px</div>
    `;
    this.fieldsContainer.appendChild(infoCard);

    // Physics Preset Buttons (for Player and Blocks)
    if (ent.type === 'player' || ent.type === 'crate' || ent.type === 'block') {
      const presetRow = document.createElement('div');
      presetRow.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px;';
      const presets = [
        { name: 'Standard Physics', apply: () => {
          if (ent.type === 'player') { ent.speed = 280; ent.jumpForce = 620; ent.gravityScale = 1.0; }
          else { ent.bounciness = 0; ent.friction = 0.8; }
        }},
        { name: 'Floaty Moon', apply: () => {
          if (ent.type === 'player') { ent.speed = 220; ent.jumpForce = 720; ent.gravityScale = 0.5; }
          else { ent.bounciness = 0.3; ent.friction = 0.8; }
        }},
        { name: 'High Gravity', apply: () => {
          if (ent.type === 'player') { ent.speed = 320; ent.jumpForce = 820; ent.gravityScale = 1.8; }
          else { ent.bounciness = 0; ent.friction = 0.9; }
        }},
        { name: 'Super Bouncy', apply: () => {
          if (ent.type === 'player') { ent.speed = 300; ent.jumpForce = 750; ent.gravityScale = 0.85; }
          else { ent.bounciness = 0.85; ent.friction = 0.6; }
        }},
        { name: 'Ice Skater', apply: () => {
          if (ent.type === 'player') { ent.speed = 360; ent.jumpForce = 600; ent.gravityScale = 1.0; }
          else { ent.bounciness = 0; ent.friction = 0.05; }
        }}
      ];

      presets.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'neo-btn';
        btn.style.cssText = 'font-size: 11px; padding: 4px 8px; flex: 1 1 30%; justify-content: center;';
        btn.textContent = p.name;
        btn.addEventListener('click', () => {
          p.apply();
          this.renderFields();
          sounds.playClick();
        });
        presetRow.appendChild(btn);
      });
      this.fieldsContainer.appendChild(presetRow);
    }

    if (ent.type === 'player') {
      this.addSlider('Speed (px/s)', ent.speed, 150, 600, 10, (val) => ent.speed = val);
      this.addSlider('Jump Force', ent.jumpForce, 300, 950, 10, (val) => ent.jumpForce = val);
      this.addSlider('Gravity (px/s²)', ent.gravityScale, 0.4, 2.5, 0.1, (val) => ent.gravityScale = val);
      this.addSlider('Max Hearts', ent.maxHearts || 4, 1, 8, 1, (val) => {
        ent.maxHearts = val;
        ent.hearts = val;
      });
      this.addToggle('Double Jump Allowed', ent.doubleJumpAllowed, (val) => {
        ent.doubleJumpAllowed = val;
        ent.hasDoubleJump = val;
      });
    } else if (ent.type === 'crate' || ent.type === 'block') {
      const shapeOptions = [
        { value: 'square', label: '■ Full Square Block' },
        { value: 'slope_up', label: '◢ Slope Up (45° Incline ↗)' },
        { value: 'slope_down', label: '◣ Slope Down (45° Decline ↘)' },
        { value: 'slope_ceil_up', label: '◤ Inverted Slope Up (45° ↗)' },
        { value: 'slope_ceil_down', label: '◥ Inverted Slope Down (45° ↘)' }
      ];
      const currentShape = ent.isSlope ? (`slope_${ent.slopeDirection}`) : 'square';
      this.addSelect('Block Shape', currentShape, shapeOptions, (shape) => {
        const mat = ent.effectiveMaterial || 'solid';
        if (shape === 'square') {
          ent.setVariant(mat === 'stone' ? 'stone' : mat === 'ice' ? 'ice' : 'solid');
        } else if (shape === 'slope_up') {
          ent.setVariant(mat === 'stone' ? 'stone_slope_up' : mat === 'ice' ? 'ice_slope_up' : 'slope_up');
        } else if (shape === 'slope_down') {
          ent.setVariant(mat === 'stone' ? 'stone_slope_down' : mat === 'ice' ? 'ice_slope_down' : 'slope_down');
        } else if (shape === 'slope_ceil_up') {
          ent.setVariant(mat === 'stone' ? 'stone_slope_ceil_up' : mat === 'ice' ? 'ice_slope_ceil_up' : 'slope_ceil_up');
        } else if (shape === 'slope_ceil_down') {
          ent.setVariant(mat === 'stone' ? 'stone_slope_ceil_down' : mat === 'ice' ? 'ice_slope_ceil_down' : 'slope_ceil_down');
        }
        if (typeof window !== 'undefined' && window.sidehop?.entities) {
          SolidBlock.updateTerrainMap(window.sidehop.entities);
        }
      });

      const materialOptions = [
        { value: 'solid', label: '🟩 Ground Turf' },
        { value: 'stone', label: '🪨 Castle Stone' },
        { value: 'ice', label: '🧊 Slippery Ice' },
        { value: 'cloud', label: '☁️ Soft Cloud' },
        { value: 'semisolid', label: '🪵 Wood Platform' }
      ];
      const currentMat = ent.effectiveMaterial || 'solid';
      this.addSelect('Surface Material', currentMat, materialOptions, (mat) => {
        ent.material = mat;
        if (ent.isSlope) {
          const dir = ent.slopeDirection;
          if (dir === 'up') {
            ent.setVariant(mat === 'stone' ? 'stone_slope_up' : mat === 'ice' ? 'ice_slope_up' : 'slope_up');
          } else if (dir === 'down') {
            ent.setVariant(mat === 'stone' ? 'stone_slope_down' : mat === 'ice' ? 'ice_slope_down' : 'slope_down');
          } else if (dir === 'ceil_up') {
            ent.setVariant(mat === 'stone' ? 'stone_slope_ceil_up' : mat === 'ice' ? 'ice_slope_ceil_up' : 'slope_ceil_up');
          } else if (dir === 'ceil_down') {
            ent.setVariant(mat === 'stone' ? 'stone_slope_ceil_down' : mat === 'ice' ? 'ice_slope_ceil_down' : 'slope_ceil_down');
          }
        } else {
          ent.setVariant(mat);
        }
        if (typeof window !== 'undefined' && window.sidehop?.entities) {
          SolidBlock.updateTerrainMap(window.sidehop.entities);
        }
      });

      this.addSlider('Bounciness', ent.bounciness || 0, 0, 1.2, 0.05, (val) => ent.bounciness = val);
      this.addSlider('Friction', ent.friction || 0.8, 0.05, 1.0, 0.05, (val) => ent.friction = val);
      this.addToggle('One-Way Platform', !!ent.isOneWay, (val) => ent.isOneWay = val);
    } else if (ent.type === 'springboard') {
      this.addSlider('Launch Force', ent.launchForce, 500, 1400, 20, (val) => ent.launchForce = val);
    } else if (ent.type === 'enemy') {
      this.addSlider('Speed (px/s)', ent.speed, 20, 240, 5, (val) => ent.speed = val);
      this.addSlider('Patrol Distance', ent.patrolRange, 40, 300, 10, (val) => ent.patrolRange = val);
      this.addToggle('Stompable', ent.stompable, (val) => ent.stompable = val);
    } else if (ent.type === 'moving_platform') {
      this.addSlider('Speed (px/s)', ent.speed, 20, 200, 5, (val) => ent.speed = val);
      this.addSlider('Patrol Distance', ent.distance, 40, 400, 10, (val) => ent.distance = val);
      this.addSelect('Movement Axis', ent.axis, ['horizontal', 'vertical'], (val) => ent.axis = val);
    } else {
      const p = document.createElement('p');
      p.className = 'inspector-empty-msg';
      p.textContent = 'This component uses standard game physics.';
      this.fieldsContainer.appendChild(p);
    }
  }

  addSlider(label, currentVal, min, max, step, onChange) {
    const group = document.createElement('div');
    group.className = 'inspector-control-group';

    const header = document.createElement('div');
    header.className = 'control-header';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = label;
    const valSpan = document.createElement('span');
    valSpan.className = 'val-badge';
    valSpan.textContent = currentVal;
    header.appendChild(titleSpan);
    header.appendChild(valSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = currentVal;
    input.className = 'neo-slider';

    input.addEventListener('input', (e) => {
      const num = parseFloat(e.target.value);
      valSpan.textContent = num;
      onChange(num);
    });

    group.appendChild(header);
    group.appendChild(input);
    this.fieldsContainer.appendChild(group);
  }

  addToggle(label, currentVal, onChange) {
    const group = document.createElement('div');
    group.className = 'inspector-control-group toggle-group';

    const span = document.createElement('span');
    span.textContent = label;

    const labelBtn = document.createElement('label');
    labelBtn.className = 'neo-toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = currentVal;

    const slider = document.createElement('span');
    slider.className = 'toggle-knob';

    input.addEventListener('change', (e) => {
      onChange(e.target.checked);
      sounds.playClick();
    });

    labelBtn.appendChild(input);
    labelBtn.appendChild(slider);
    group.appendChild(span);
    group.appendChild(labelBtn);
    this.fieldsContainer.appendChild(group);
  }

  addSelect(label, currentVal, options, onChange) {
    const group = document.createElement('div');
    group.className = 'inspector-control-group';

    const span = document.createElement('span');
    span.textContent = label;

    const select = document.createElement('select');
    select.className = 'neo-select';
    options.forEach(opt => {
      const o = document.createElement('option');
      const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
      const text = typeof opt === 'object' && opt !== null ? opt.label : (String(opt).charAt(0).toUpperCase() + String(opt).slice(1));
      o.value = val;
      o.textContent = text;
      if (val === currentVal) o.selected = true;
      select.appendChild(o);
    });

    select.addEventListener('change', (e) => {
      onChange(e.target.value);
      sounds.playClick();
    });

    group.appendChild(span);
    group.appendChild(select);
    this.fieldsContainer.appendChild(group);
  }
}
