<!--
  WeeklyOverview — the Reports → Weekly screen renderer.

  Shape locked by `docs/plans/game-loop-and-ux.md §4.1` and the locked
  decisions in `docs/plans/phase-90-weekly-overview.md`. The component
  is pure presentation: it never reads simulation state outside the
  projected `WeeklyOverviewData` it receives.

  Sections gracefully omit when their slice is undefined or empty. The
  week-over-week comparison strip only appears once two weeks of
  history exist.
-->
<script lang="ts">
  import TermLabel from './TermLabel.svelte'
  import EntityLink from './links/EntityLink.svelte'
  import MetricLink from './links/MetricLink.svelte'
  import { pressureColor } from '../design/tokens'
  import type {
    CustomerGroupRow,
    InvoiceRow,
    MaintenanceRow,
    StaffRow,
    WeeklyOverviewData,
  } from '../../../../src/reports/weeklyOverviewProjection'

  let { data }: { data: WeeklyOverviewData } = $props()

  type Dir = 'gain' | 'loss' | 'neutral'

  function signed(n: number): string {
    if (n > 0) return `+${n}`
    if (n < 0) return `${n}`
    return '·'
  }

  function signedRounded(n: number): string {
    return signed(Math.round(n))
  }

  function dirOf(n: number): Dir {
    if (n > 0) return 'gain'
    if (n < 0) return 'loss'
    return 'neutral'
  }

  function arrowOf(n: number): string {
    if (n >= 1) return '↗'
    if (n <= -1) return '↙'
    return '→'
  }

  function fillPct(value: number, max = 100): string {
    return `${Math.max(2, Math.min(100, (value / max) * 100))}%`
  }

  function expenseDir(n: number): Dir {
    // Expense rows (purchases, wages, rent, repairs, waste) carry a
    // positive number representing a cost. Visually a non-zero expense
    // is a loss; zero is neutral.
    if (n > 0) return 'loss'
    return 'neutral'
  }
</script>

<section class="overview" aria-label="Weekly overview">
  {#if !data.hasResult || !data.header}
    <p class="placeholder">{data.empty?.message}</p>
  {:else}
    <!-- ── Header ────────────────────────────────────────────────── -->
    <header class="block header">
      <p class="section-label block-label">
        Week {data.header.weekNumber} · Month {data.header.monthNumber} · Year {data.header.yearNumber}
      </p>
      <p class="head-line display">Closed day {data.header.endDay}</p>
      {#if data.header.daysSinceClose > 0}
        <p class="tag dim">(closed {data.header.daysSinceClose}
          {data.header.daysSinceClose === 1 ? 'day' : 'days'} ago)</p>
      {/if}
    </header>

    <!-- ── Week-over-week comparison ─────────────────────────────── -->
    {#if data.comparison}
      <section class="block">
        <h2 class="block-label section-label">vs previous week</h2>
        <div class="compare-strip">
          <div class="compare-tile">
            <span class="compare-label chip"><TermLabel term="weekly_net" label="net" /></span>
            <span class="compare-value mono">{signedRounded(data.economy?.net ?? 0)}</span>
            <span class="compare-delta mono" data-dir={dirOf(data.comparison.netDelta)}>
              {arrowOf(data.comparison.netDelta)} {signedRounded(data.comparison.netDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label chip">sales</span>
            <span class="compare-value mono">{Math.round(data.economy?.sales ?? 0)}</span>
            <span class="compare-delta mono" data-dir={dirOf(data.comparison.salesDelta)}>
              {arrowOf(data.comparison.salesDelta)} {signedRounded(data.comparison.salesDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label chip"><TermLabel term="wages" label="wages" /></span>
            <span class="compare-value mono">{Math.round(data.economy?.wages ?? 0)}</span>
            <span class="compare-delta mono" data-dir={dirOf(-data.comparison.wagesDelta)}>
              {arrowOf(data.comparison.wagesDelta)} {signedRounded(data.comparison.wagesDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label chip"><TermLabel term="patronage" label="satisfaction" /></span>
            <span class="compare-value mono">
              {Math.round(averageSatisfaction(data.customerGroups?.rows ?? []))}
            </span>
            <span class="compare-delta mono" data-dir={dirOf(data.comparison.averageSatisfactionDelta)}>
              {arrowOf(data.comparison.averageSatisfactionDelta)}
              {signedRounded(data.comparison.averageSatisfactionDelta)}
            </span>
          </div>
        </div>
      </section>
    {/if}

    <!-- ── Economy ───────────────────────────────────────────────── -->
    {#if data.economy}
      <section class="block">
        <h2 class="block-label section-label">Economy</h2>
        <ul class="econ-list">
          <li class="econ-row">
            <span class="econ-label">sales</span>
            <span class="econ-amt mono" data-dir="gain">{signed(Math.round(data.economy.sales))}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">purchases</span>
            <span class="econ-amt mono" data-dir={expenseDir(data.economy.purchases)}>−{Math.round(data.economy.purchases)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label"><TermLabel term="wages" label="wages" /></span>
            <span class="econ-amt mono" data-dir={expenseDir(data.economy.wages)}>−{Math.round(data.economy.wages)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">rent</span>
            <span class="econ-amt mono" data-dir={expenseDir(data.economy.rent)}>−{Math.round(data.economy.rent)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">repairs</span>
            <span class="econ-amt mono" data-dir={expenseDir(data.economy.repairs)}>−{Math.round(data.economy.repairs)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">waste</span>
            <span class="econ-amt mono" data-dir={expenseDir(data.economy.waste)}>−{Math.round(data.economy.waste)}</span>
          </li>
          {#if data.economy.other !== 0}
            <li class="econ-row">
              <span class="econ-label">other</span>
              <span class="econ-amt mono" data-dir={dirOf(data.economy.other)}>{signed(Math.round(data.economy.other))}</span>
            </li>
          {/if}
          <li class="econ-row net">
            <span class="econ-label"><TermLabel term="weekly_net" label="net" /></span>
            <span class="econ-amt mono accent">{signed(Math.round(data.economy.net))}</span>
          </li>
        </ul>
        {#if data.economy.topRevenueSource || data.economy.largestCost}
          <div class="econ-callouts">
            {#if data.economy.topRevenueSource}
              <!-- Phase 195 — top-revenue source is a stock item; link it. -->
              <span class="callout-chip">
                <span class="chip">top revenue</span>
                <EntityLink
                  kind="stock"
                  id={data.economy.topRevenueSource.id}
                  label={data.economy.topRevenueSource.label}
                />
              </span>
            {/if}
            {#if data.economy.largestCost}
              <span class="callout-chip">
                <span class="chip">largest cost</span> {data.economy.largestCost}
              </span>
            {/if}
          </div>
        {/if}
      </section>
    {/if}

    <!-- ── Signals ───────────────────────────────────────────────── -->
    {#if data.signals}
      <section class="block">
        <h2 class="block-label section-label"><TermLabel term="weekly_signals" label="signals" /></h2>
        <div class="signal-pills">
          {#each (['cheap', 'filthy', 'dangerous', 'tasty', 'reliable'] as const) as axis (axis)}
            <!-- Phase 195 — each signal axis is a reputation axis; link it
                 to its drilldown. -->
            <span class="signal-pill mono" data-dir={dirOf(data.signals[axis])}>
              {signedRounded(data.signals[axis])}
              <MetricLink kind="reputation" id={axis}><span class="chip">{axis}</span></MetricLink>
            </span>
          {/each}
        </div>
        {#if data.signals.notes.length > 0}
          <ul class="note-list">
            {#each data.signals.notes.slice(0, 6) as note, i (i)}
              <li class="note">{note}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ── Customer groups ───────────────────────────────────────── -->
    {#if data.customerGroups && data.customerGroups.rows.length > 0}
      <section class="block">
        <h2 class="block-label section-label">Customer groups</h2>
        <ul class="trend-list">
          {#each data.customerGroups.rows as row (row.id)}
            {@const r = row as CustomerGroupRow}
            <li class="trend-row group-row">
              <span class="trend-name">
                {#if r.isBest}<span class="marker best" title="best of the week">★</span>{/if}
                {#if r.isWorst}<span class="marker worst" title="worst of the week">▽</span>{/if}
                {r.label}
              </span>
              <span class="trend-cell mono" data-dir={dirOf(r.loyaltyDelta)}>
                {arrowOf(r.loyaltyDelta)} {signedRounded(r.loyaltyDelta)} <span class="chip">loyal</span>
              </span>
              <span class="trend-cell mono" data-dir={dirOf(r.patronageDelta)}>
                {arrowOf(r.patronageDelta)} {signedRounded(r.patronageDelta)} <span class="chip">patr</span>
              </span>
              <span class="trend-cell mono dim">
                {Math.round(r.averageSatisfaction)} <span class="chip">sat</span>
              </span>
              <span class="trend-cell mono dim">
                {r.totalTraffic} <span class="chip">visits</span>
              </span>
              {#if r.shortageCount > 0}
                <span class="shortage-badge mono" title="stock shortages this week">
                  {r.shortageCount}× short
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Staff ─────────────────────────────────────────────────── -->
    {#if data.staff && data.staff.rows.length > 0}
      <section class="block">
        <h2 class="block-label section-label">Staff</h2>
        <ul class="trend-list">
          {#each data.staff.rows as row (row.id)}
            {@const r = row as StaffRow}
            <li class="trend-row staff-row">
              <span class="trend-name">
                <!-- Phase 190b — staff names link to Tavern → Staff detail. -->
                <EntityLink kind="staff" id={r.id} label={r.name} /><span class="role chip"> · {r.roleLabel}</span>
              </span>
              <span class="trend-cell mono" data-dir={dirOf(r.moraleDelta)}>
                {arrowOf(r.moraleDelta)} {signedRounded(r.moraleDelta)} <span class="chip">mor</span>
              </span>
              <span class="trend-cell mono" data-dir={dirOf(-r.stressDelta)}>
                {arrowOf(r.stressDelta)} {signedRounded(r.stressDelta)} <span class="chip">str</span>
              </span>
              <span class="trend-cell mono" data-dir={dirOf(-r.fatigueDelta)}>
                {arrowOf(r.fatigueDelta)} {signedRounded(r.fatigueDelta)} <span class="chip">fat</span>
              </span>
              <span class="trend-cell mono" data-dir={dirOf(r.loyaltyDelta)}>
                {arrowOf(r.loyaltyDelta)} {signedRounded(r.loyaltyDelta)} <span class="chip">loy</span>
              </span>
              {#if r.notes.length > 0}
                <details class="staff-notes">
                  <summary class="chip">notes ({r.notes.length})</summary>
                  <ul>
                    {#each r.notes as note, i (i)}<li>{note}</li>{/each}
                  </ul>
                </details>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Maintenance backlog ───────────────────────────────────── -->
    {#if data.maintenance && data.maintenance.rows.length > 0}
      <section class="block">
        <h2 class="block-label section-label"><TermLabel term="maintenance_backlog" label="maintenance backlog" /></h2>
        <ul class="maint-list">
          {#each data.maintenance.rows as row (row.areaId)}
            {@const r = row as MaintenanceRow}
            <li class="maint-row">
              <!-- Phase 195 — link the area to its Tavern detail. -->
              <span class="maint-label">
                <EntityLink kind="area" id={r.areaId} label={r.areaLabel} />
              </span>
              <div class="maint-track">
                <div
                  class="maint-fill"
                  style="width: {fillPct(r.severity, 100)}; background: {pressureColor(r.severity)};"
                ></div>
              </div>
              <span class="maint-value mono" style="color: {pressureColor(r.severity)};">
                {Math.round(r.severity)}
              </span>
              {#if r.reasons.length > 0}
                <span class="maint-reasons chip">{r.reasons.join(' · ')}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Wages ─────────────────────────────────────────────────── -->
    {#if data.wages}
      <section class="block">
        <h2 class="block-label section-label"><TermLabel term="wages" label="wages" /></h2>
        <p class="wages-line mono">
          paid <span class="accent">{Math.round(data.wages.paidAmount)}</span>
          / due <span class="dim">{Math.round(data.wages.totalDue)}</span>
          {#if !data.wages.paid && data.wages.unpaidStaff.length > 0}
            <span class="loss"> · {data.wages.unpaidStaff.length} unpaid</span>
          {/if}
        </p>
        {#if data.wages.unpaidStaff.length > 0}
          <ul class="unpaid-list">
            {#each data.wages.unpaidStaff as s (s.id)}
              <li class="unpaid-row">
                <span class="trend-name"><EntityLink kind="staff" id={s.id} label={s.name} /><span class="role chip"> · {s.roleLabel}</span></span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ── Supplier invoices ─────────────────────────────────────── -->
    {#if data.supplierInvoices && data.supplierInvoices.rows.length > 0}
      <section class="block">
        <h2 class="block-label section-label"><TermLabel term="supplier_invoice" label="supplier invoices" /></h2>
        <p class="invoice-summary mono">
          unpaid <span class="loss">{data.supplierInvoices.unpaidCount}</span>
          · paid <span class="dim">{data.supplierInvoices.paidCount}</span>
          {#if data.supplierInvoices.totalUnpaid > 0}
            · owed <span class="loss">{Math.round(data.supplierInvoices.totalUnpaid)}</span>
          {/if}
        </p>
        <ul class="invoice-list">
          {#each invoicesUnpaidFirst(data.supplierInvoices.rows) as inv (inv.id)}
            <li class="invoice-row" class:paid={inv.paid}>
              <!-- Phase 195 — invoice row id is the supplier id; link it. -->
              <span class="trend-name">
                <EntityLink kind="supplier" id={inv.id} label={inv.supplierLabel} />
              </span>
              <span class="trend-cell mono" data-dir={inv.paid ? 'neutral' : 'loss'}>
                {Math.round(inv.amount)}c
              </span>
              <span class="trend-cell mono dim">due W{inv.dueWeek}</span>
              {#if inv.relatedStock.length > 0}
                <span class="invoice-stock chip">{inv.relatedStock.join(' · ')}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Community ─────────────────────────────────────────────── -->
    {#if data.community}
      <section class="block">
        <details class="community">
          <summary class="community-summary">
            <span class="block-label section-label">Community</span>
            <span class="mono dim">
              {data.community.suppliersTouched} suppliers ·
              {data.community.regularsTouched} regulars ·
              {data.community.factionShifts} factions ·
              {data.community.rumoursActive} rumours
            </span>
          </summary>
          {#if data.community.notes.length > 0}
            <ul class="note-list">
              {#each data.community.notes as note, i (i)}<li class="note">{note}</li>{/each}
            </ul>
          {/if}
        </details>
      </section>
    {/if}
  {/if}
</section>

<script module lang="ts">
  // Module-scoped pure helpers — runes are not needed and they keep
  // the instance script small.
  import type { CustomerGroupRow as _Row, InvoiceRow as _InvoiceRow } from '../../../../src/reports/weeklyOverviewProjection'

  export function averageSatisfaction(rows: readonly _Row[]): number {
    if (rows.length === 0) return 0
    const sum = rows.reduce((s, r) => s + r.averageSatisfaction, 0)
    return sum / rows.length
  }

  export function invoicesUnpaidFirst(rows: readonly _InvoiceRow[]): _InvoiceRow[] {
    const unpaid = rows.filter((r) => !r.paid)
    const paid = rows.filter((r) => r.paid)
    return [...unpaid, ...paid]
  }
</script>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .block-label {
    color: var(--accent);
    margin-bottom: 2px;
  }

  .placeholder {
    text-align: center;
    color: var(--text-faint);
    font-style: italic;
    padding: var(--sp-xl) var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
  }

  .header {
    gap: var(--sp-xs);
  }

  .head-line {
    font-size: 22px;
    letter-spacing: 0.08em;
    color: var(--text);
  }

  .dim {
    color: var(--text-faint);
  }

  .accent {
    color: var(--accent);
  }

  .loss {
    color: var(--loss);
  }

  /* ── Comparison strip ─────────────────────────────────────── */
  .compare-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--sp-xs);
  }

  .compare-tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
  }

  .compare-label {
    color: var(--text-faint);
  }

  .compare-value {
    color: var(--text);
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }

  .compare-delta {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .compare-delta[data-dir='gain'] { color: var(--gain); }
  .compare-delta[data-dir='loss'] { color: var(--loss); }
  .compare-delta[data-dir='neutral'] { color: var(--text-faint); }

  /* ── Economy ──────────────────────────────────────────────── */
  .econ-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-xs) var(--sp-sm);
  }

  .econ-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    padding: 4px 0;
    gap: var(--sp-sm);
  }

  .econ-row.net {
    border-top: 1px dashed color-mix(in srgb, var(--accent) 30%, transparent);
    padding-top: 8px;
    margin-top: 4px;
    font-weight: 600;
  }

  .econ-label {
    color: var(--text-dim);
    font-size: 15px;
  }

  .econ-amt {
    font-variant-numeric: tabular-nums;
  }
  .econ-amt[data-dir='gain'] { color: var(--gain); }
  .econ-amt[data-dir='loss'] { color: var(--loss); }
  .econ-amt[data-dir='neutral'] { color: var(--text-faint); }

  .econ-callouts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    margin-top: var(--sp-xs);
  }

  .callout-chip {
    display: inline-flex;
    gap: 6px;
    align-items: baseline;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    font-size: 13px;
    color: var(--text-dim);
  }

  /* ── Signals ──────────────────────────────────────────────── */
  .signal-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
  }

  .signal-pill {
    display: inline-flex;
    gap: 6px;
    padding: 4px 10px;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    font-size: 13px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .signal-pill[data-dir='gain'] {
    color: var(--gain);
    border-color: color-mix(in srgb, var(--gain) 40%, transparent);
  }
  .signal-pill[data-dir='loss'] {
    color: var(--loss);
    border-color: color-mix(in srgb, var(--loss) 40%, transparent);
  }

  .note-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--sp-xs);
  }

  .note {
    color: var(--text-faint);
    font-size: 13px;
    font-style: italic;
    line-height: 1.5;
  }

  /* ── Trend rows (customer groups, staff) ──────────────────── */
  .trend-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .trend-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-xs) var(--sp-sm);
    padding: 8px var(--sp-xs);
    background: var(--surface);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
    min-height: 44px;
  }

  .trend-name {
    flex: 1 1 140px;
    color: var(--text);
    font-size: 15px;
  }

  .role {
    color: var(--text-faint);
    font-weight: normal;
  }

  .marker {
    margin-right: 4px;
  }
  .marker.best { color: var(--accent); }
  .marker.worst { color: var(--text-faint); }

  .trend-cell {
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    color: var(--text-dim);
    white-space: nowrap;
  }
  .trend-cell[data-dir='gain'] { color: var(--gain); }
  .trend-cell[data-dir='loss'] { color: var(--loss); }
  .trend-cell[data-dir='neutral'] { color: var(--text-faint); }
  .trend-cell.dim { color: var(--text-faint); }

  .shortage-badge {
    padding: 2px 8px;
    background: color-mix(in srgb, var(--loss) 18%, transparent);
    color: var(--loss);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .staff-notes {
    flex: 1 1 100%;
  }

  .staff-notes summary {
    color: var(--text-faint);
    cursor: pointer;
    font-size: 12px;
  }

  .staff-notes ul {
    margin-top: 4px;
    padding-left: var(--sp-md);
    color: var(--text-faint);
    font-size: 13px;
    font-style: italic;
  }

  /* ── Maintenance ──────────────────────────────────────────── */
  .maint-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .maint-row {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    grid-template-areas:
      'label bar value'
      'reasons reasons reasons';
    column-gap: var(--sp-sm);
    row-gap: 2px;
    align-items: center;
    padding: 6px var(--sp-xs);
    background: var(--surface);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
  }

  .maint-label {
    grid-area: label;
    color: var(--text);
    font-size: 14px;
  }

  .maint-track {
    grid-area: bar;
    height: 6px;
    background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
    border-radius: 3px;
    overflow: hidden;
  }

  .maint-fill {
    height: 100%;
    border-radius: 3px;
    transition: width var(--m-base) var(--ease);
  }

  .maint-value {
    grid-area: value;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
  }

  .maint-reasons {
    grid-area: reasons;
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
    line-height: 1.4;
  }

  /* ── Wages ────────────────────────────────────────────────── */
  .wages-line {
    font-size: 14px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .unpaid-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--sp-xs);
  }

  .unpaid-row {
    padding: 6px var(--sp-xs);
    background: color-mix(in srgb, var(--loss) 8%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--loss) 50%, transparent);
    border-radius: var(--radius-sm);
  }

  /* ── Supplier invoices ────────────────────────────────────── */
  .invoice-summary {
    font-size: 14px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .invoice-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--sp-xs);
  }

  .invoice-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-xs) var(--sp-sm);
    padding: 6px var(--sp-xs);
    background: color-mix(in srgb, var(--loss) 10%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--loss) 50%, transparent);
    border-radius: var(--radius-sm);
    min-height: 44px;
  }

  .invoice-row.paid {
    background: var(--surface);
    border-left-color: color-mix(in srgb, var(--text-faint) 40%, transparent);
    color: var(--text-faint);
  }

  .invoice-stock {
    color: var(--text-faint);
    flex: 1 1 100%;
  }

  /* ── Community ────────────────────────────────────────────── */
  .community {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-sm);
  }

  .community-summary {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
