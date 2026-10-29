// Sidehop Level Editor History (Undo / Redo) Engine

import { LevelStorage } from '../storage/storage.js?v=20261029_165613';
import { sounds } from '../audio/sound.js?v=20261029_165613';

export class HistoryManager {
  constructor(maxStates = 40) {
    this.maxStates = maxStates;
    this.undoStack = [];
    this.redoStack = [];
    this.onStateChange = null; // callback (canUndo, canRedo) => {}
  }

  // Push a state snapshot
  pushState(player, entities, background) {
    const snapshot = LevelStorage.serialize(player, entities, background);
    
    // Don't push duplicate if identical to last state
    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];
      if (JSON.stringify(last) === JSON.stringify(snapshot)) {
        return;
      }
    }

    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }

    // New action invalidates redo branch
    this.redoStack = [];
    this.notifyChange();
  }

  canUndo() {
    return this.undoStack.length > 1;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(player, entities, background, onApplyBg) {
    if (!this.canUndo()) return false;

    // Pop current state onto redo stack
    const current = this.undoStack.pop();
    this.redoStack.push(current);

    // Get previous state
    const previous = this.undoStack[this.undoStack.length - 1];
    if (previous) {
      const bg = LevelStorage.deserialize(previous, player, entities);
      if (bg && onApplyBg) onApplyBg(bg);
      LevelStorage.autoSave(player, entities, bg || background);
      sounds.playClick();
      this.notifyChange();
      return true;
    }
    return false;
  }

  redo(player, entities, background, onApplyBg) {
    if (!this.canRedo()) return false;

    const next = this.redoStack.pop();
    this.undoStack.push(next);

    const bg = LevelStorage.deserialize(next, player, entities);
    if (bg && onApplyBg) onApplyBg(bg);
    LevelStorage.autoSave(player, entities, bg || background);
    sounds.playClick();
    this.notifyChange();
    return true;
  }

  notifyChange() {
    if (this.onStateChange) {
      this.onStateChange(this.canUndo(), this.canRedo());
    }
  }

  updateButtons() {
    this.notifyChange();
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }
}
