/** undo.ts — a minimal undo/redo command stack shared by global-correction
 *  edits and keyframe edits (both push a {undo, redo} pair capturing the old
 *  and new value via closures; nothing here needs to know which kind it is). */

export interface UndoCommand {
  undo(): void;
  redo(): void;
}

export class UndoStack {
  private readonly undoStack: UndoCommand[] = [];
  private readonly redoStack: UndoCommand[] = [];

  /** Push a just-performed action. Call this AFTER applying the change (the
   *  command's `redo` should reproduce the same result). Clears the redo
   *  stack, matching standard editor undo semantics. */
  push(cmd: UndoCommand): void {
    this.undoStack.push(cmd);
    this.redoStack.length = 0;
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.redo();
    this.undoStack.push(cmd);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
