export type PreparationBoundary<T> =
  | { readonly active: true; readonly value: T }
  | { readonly active: false };

export class ScenePreparationLifetime {
  private generation = 0;
  private cancelled = false;

  begin(): number {
    return this.generation;
  }

  cancel(): void {
    this.cancelled = true;
    this.generation += 1;
  }

  active(generation: number): boolean {
    return !this.cancelled && generation === this.generation;
  }

  async wait<T>(generation: number, operation: Promise<T>): Promise<PreparationBoundary<T>> {
    const value = await operation;
    return this.active(generation)
      ? { active: true, value }
      : { active: false };
  }
}
