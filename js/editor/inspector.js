// Sidehop Component Inspector — Real-Time Parameter Tuning

import { sounds } from '../audio/sound.js';

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
    this.titleElement.textContent = `Tuning: ${entity.type.toUpperCase()}`;
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

    if (ent.type === 'player') {
      this.addSlider('Run Speed', ent.speed, 150, 600, 10, (val) => ent.speed = val);
      this.addSlider('Jump Force', ent.jumpForce, 300, 950, 10, (val) => ent.jumpForce = val);
      this.addSlider('Weight / Gravity', ent.gravityScale, 0.4, 2.5, 0.1, (val) => ent.gravityScale = val);
      this.addSlider('Max Hearts', ent.maxHearts || 4, 1, 8, 1, (val) => {
        ent.maxHearts = val;
        ent.hearts = val;
      });
      this.addToggle('Double Jump Allowed', ent.doubleJumpAllowed, (val) => {
        ent.doubleJumpAllowed = val;
        ent.hasDoubleJump = val;
      });
    } else if (ent.type === 'crate') {
      this.addSlider('Bounciness', ent.bounciness, 0, 1.2, 0.05, (val) => ent.bounciness = val);
      this.addSlider('Friction', ent.friction, 0.1, 1.0, 0.05, (val) => ent.friction = val);
    } else if (ent.type === 'springboard') {
      this.addSlider('Launch Force', ent.launchForce, 500, 1400, 20, (val) => ent.launchForce = val);
    } else if (ent.type === 'enemy') {
      this.addSlider('Patrol Speed', ent.speed, 20, 240, 5, (val) => ent.speed = val);
      this.addSlider('Patrol Distance', ent.patrolRange, 40, 300, 10, (val) => ent.patrolRange = val);
      this.addToggle('Stompable', ent.stompable, (val) => ent.stompable = val);
    } else if (ent.type === 'moving_platform') {
      this.addSlider('Move Speed', ent.speed, 20, 200, 5, (val) => ent.speed = val);
      this.addSlider('Travel Distance', ent.distance, 40, 400, 10, (val) => ent.distance = val);
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
      o.value = opt;
      o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (opt === currentVal) o.selected = true;
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
