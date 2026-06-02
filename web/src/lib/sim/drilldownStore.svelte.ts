// Phase 190a / ISSUE-157a — Global cause-drilldown store.
//
// Mirrors `glossaryStore`: a tiny global the single app-root
// `CauseDrilldown` binds against, so a `MetricLink` anywhere in the tree
// can open a drilldown without prop-drilling open/path state through
// every screen. Screens that own their own drilldown (DailyReport,
// ReportsScreen) keep their local instances — this store backs the
// from-anywhere `MetricLink` path only.

class DrilldownStore {
  open = $state(false)
  /** Diff/pressure path (e.g. `coin`, `pressures.<id>`, `reputation.<axis>`). */
  path: string | undefined = $state(undefined)

  show(path: string): void {
    this.path = path
    this.open = true
  }

  close(): void {
    this.open = false
  }
}

export const drilldownStore = new DrilldownStore()
