// Registries are runtime infrastructure, not simulation state. The Registry
// class lives outside TavernState and is never serialized; the no-class-instances
// rule applies only to state, so using a class here does not violate Phase 2 rules.

export type RegistryItem = {
  id: string
}

export class Registry<T extends RegistryItem> {
  private items = new Map<string, T>()

  register(item: T): void {
    if (this.items.has(item.id)) {
      throw new Error(`Duplicate registry id: ${item.id}`)
    }
    this.items.set(item.id, item)
  }

  get(id: string): T {
    const item = this.items.get(id)
    if (!item) {
      throw new Error(`Missing registry id: ${id}`)
    }
    return item
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  all(): T[] {
    return [...this.items.values()]
  }

  /**
   * Remove a single item by id. Returns `true` if an item was removed.
   * Useful for tests that register transient entries and need to clean
   * up without wiping the entire registry.
   */
  unregister(id: string): boolean {
    return this.items.delete(id)
  }

  clear(): void {
    this.items.clear()
  }
}
