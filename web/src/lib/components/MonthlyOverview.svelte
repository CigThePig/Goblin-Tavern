<!--
  MonthlyOverview — the Reports → Monthly screen renderer.

  Shape locked by `docs/plans/game-loop-and-ux.md §4.2` and the locked
  decisions in `docs/plans/phase-91-monthly-overview.md`. The component
  is pure presentation: it never reads simulation state outside the
  projected `MonthlyOverviewData` it receives.

  Sections gracefully omit when their slice is undefined or empty. The
  month-over-month comparison strip and the per-axis MoM delta chips
  only appear once a second finalized month exists in history.
-->
<script lang="ts">
  import TermLabel from './TermLabel.svelte'
  import PressureCard from './PressureCard.svelte'
  import { pressureColor } from '../design/tokens'
  import type {
    MonthlyOverviewArc,
    MonthlyOverviewData,
    MonthlyOverviewPressureRow,
    MonthlyOverviewReputationRow,
    MonthlyOverviewUpgradeRow,
  } from '../../../../src/reports/monthlyOverviewProjection'
  import type { ReputationTier } from '../../../../src/sim/modules/monthly/types'

  let {
    data,
    onnavigatepressures,
  }: {
    data: MonthlyOverviewData
    onnavigatepressures?: () => void
  } = $props()

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

  // Pressure-direction dir helper: a rising pressure is bad (loss),
  // falling is good (gain). Used for landlord pressure / inspection
  // suspicion / rival pressure deltas.
  function pressureDirOf(n: number): Dir {
    if (n > 0) return 'loss'
    if (n < 0) return 'gain'
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

  const TIER_LABELS: Record<ReputationTier, string> = {
    absent: 'absent',
    faint: 'faint',
    known: 'known',
    strong: 'strong',
    defining: 'defining',
  }

  // Tier-aware accent color for the reputation badge. Maps the 5 bands
  // to a strength gradient that reads at a glance: absent = muted,
  // defining = the visual centerpiece.
  function tierColor(tier: ReputationTier): string {
    switch (tier) {
      case 'absent':
        return 'var(--text-faint)'
      case 'faint':
        return 'color-mix(in srgb, var(--accent) 25%, var(--text-faint))'
      case 'known':
        return 'var(--text-dim)'
      case 'strong':
        return 'var(--accent)'
      case 'defining':
        return 'var(--gain)'
    }
  }

  function navigatePressures(): void {
    if (onnavigatepressures) onnavigatepressures()
  }
</script>

<section class="overview" aria-label="Monthly overview">
  {#if !data.hasResult || !data.header}
    <p class="placeholder">{data.empty?.message}</p>
  {:else}
    <!-- ── Header ────────────────────────────────────────────────── -->
    <header class="block header">
      <p class="tag block-label">
        Month {data.header.monthNumber} · Year {data.header.yearNumber}
      </p>
      <p class="head-line display">Closed day {data.header.endDay}</p>
      {#if data.header.daysSinceClose > 0}
        <p class="tag dim">(closed {data.header.daysSinceClose}
          {data.header.daysSinceClose === 1 ? 'day' : 'days'} ago)</p>
      {/if}
      <p class="ending-coin mono">
        ending coin <span class="accent">{Math.round(data.header.endingCoin)}</span>
      </p>
    </header>

    <!-- ── Month-over-month comparison ───────────────────────────── -->
    {#if data.comparison}
      <section class="block">
        <h2 class="block-label tag">vs {data.comparison.previousMonthKey}</h2>
        <div class="compare-strip">
          <div class="compare-tile">
            <span class="compare-label tag">ending coin</span>
            <span class="compare-value mono">{Math.round(data.header.endingCoin)}</span>
            <span class="compare-delta mono" data-dir={dirOf(data.comparison.endingCoinDelta)}>
              {arrowOf(data.comparison.endingCoinDelta)}
              {signedRounded(data.comparison.endingCoinDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label tag">
              <TermLabel term="monthly_net" label="net" />
            </span>
            <span class="compare-value mono">{signedRounded(data.economy?.net ?? 0)}</span>
            <span class="compare-delta mono" data-dir={dirOf(data.comparison.netDelta)}>
              {arrowOf(data.comparison.netDelta)} {signedRounded(data.comparison.netDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label tag">
              <TermLabel term="landlord" label="landlord" />
            </span>
            <span class="compare-value mono">{Math.round(data.landlord?.pressureAfter ?? 0)}</span>
            <span class="compare-delta mono" data-dir={pressureDirOf(data.comparison.landlordPressureDelta)}>
              {arrowOf(data.comparison.landlordPressureDelta)}
              {signedRounded(data.comparison.landlordPressureDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label tag">
              <TermLabel term="inspection_suspicion" label="suspicion" />
            </span>
            <span class="compare-value mono">{Math.round(data.inspection?.suspicionAfter ?? 0)}</span>
            <span class="compare-delta mono" data-dir={pressureDirOf(data.comparison.inspectionSuspicionDelta)}>
              {arrowOf(data.comparison.inspectionSuspicionDelta)}
              {signedRounded(data.comparison.inspectionSuspicionDelta)}
            </span>
          </div>
          <div class="compare-tile">
            <span class="compare-label tag">
              <TermLabel term="rival_tavern" label="rival" />
            </span>
            <span class="compare-value mono">{Math.round(data.rival?.pressureAfter ?? 0)}</span>
            <span class="compare-delta mono" data-dir={pressureDirOf(data.comparison.rivalPressureDelta)}>
              {arrowOf(data.comparison.rivalPressureDelta)}
              {signedRounded(data.comparison.rivalPressureDelta)}
            </span>
          </div>
        </div>
      </section>
    {/if}

    <!-- ── Rent & Landlord ───────────────────────────────────────── -->
    {#if data.rent || data.landlord}
      <section class="block">
        <h2 class="block-label tag">
          <TermLabel term="rent" label="rent" /> & landlord
        </h2>
        <div class="rent-landlord">
          {#if data.rent}
            <div class="rent-block" data-paid={data.rent.paid}>
              {#if data.rent.paid}
                <p class="rent-status mono">
                  paid <span class="accent">{Math.round(data.rent.paidAmount)}</span> coin
                </p>
              {:else}
                <p class="rent-status mono loss">
                  UNPAID — <span>{Math.round(data.rent.amountDue)}</span> coin owed
                </p>
              {/if}
              <p class="rent-stats mono">
                missed {data.rent.missedPayments}
                {#if data.rent.arrears > 0}
                  · arrears <span class="loss">{Math.round(data.rent.arrears)}</span>
                {/if}
              </p>
            </div>
          {/if}
          {#if data.landlord}
            <div class="landlord-block">
              <p class="meter-line mono">
                opinion {Math.round(data.landlord.opinionBefore)}
                <span class="arrow">→</span>
                <span class:accent={data.landlord.opinionAfter >= data.landlord.opinionBefore}
                      class:loss={data.landlord.opinionAfter < data.landlord.opinionBefore}>
                  {Math.round(data.landlord.opinionAfter)}
                </span>
              </p>
              <div class="meter-track">
                <div
                  class="meter-fill"
                  style="width: {fillPct(data.landlord.pressureAfter, 100)}; background: {pressureColor(data.landlord.pressureAfter)};"
                ></div>
              </div>
              <p class="meter-line mono">
                pressure {Math.round(data.landlord.pressureBefore)}
                <span class="arrow">→</span>
                <span style="color: {pressureColor(data.landlord.pressureAfter)};">
                  {Math.round(data.landlord.pressureAfter)}
                </span>
              </p>
            </div>
          {/if}
        </div>
        {#if data.landlord && data.landlord.notes.length > 0}
          <ul class="note-list">
            {#each data.landlord.notes.slice(0, 6) as note, i (i)}
              <li class="note">{note}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ── Inspection ────────────────────────────────────────────── -->
    {#if data.inspection}
      <section class="block">
        <h2 class="block-label tag">
          <TermLabel term="inspection_suspicion" label="inspection" />
        </h2>
        {#if data.inspection.warningIssuedThisMonth}
          <p class="warning-chip mono">
            ⚠ warning issued — {data.inspection.warningCount} total
          </p>
        {/if}
        <div class="meter-track">
          <div
            class="meter-fill"
            style="width: {fillPct(data.inspection.suspicionAfter, 100)}; background: {pressureColor(data.inspection.suspicionAfter)};"
          ></div>
        </div>
        <p class="meter-line mono">
          suspicion {Math.round(data.inspection.suspicionBefore)}
          <span class="arrow">→</span>
          <span style="color: {pressureColor(data.inspection.suspicionAfter)};">
            {Math.round(data.inspection.suspicionAfter)}
          </span>
        </p>
        {#if data.inspection.notes.length > 0}
          <ul class="note-list">
            {#each data.inspection.notes.slice(0, 4) as note, i (i)}
              <li class="note">{note}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ── Identity strip — Reputation profile ───────────────────── -->
    {#if data.reputation}
      <section class="block">
        <h2 class="block-label tag">
          identity — <TermLabel term="reputation_tier" label="reputation" />
        </h2>
        <ul class="rep-list">
          {#each data.reputation.rows as row (row.axisId)}
            {@const r = row as MonthlyOverviewReputationRow}
            <li class="rep-row" class:tier-shifted={r.tierChanged}>
              {#if r.reasons.length > 0}
                <details class="rep-details">
                  <summary class="rep-summary">
                    <span class="rep-label">{r.label}</span>
                    <div class="rep-bar-track">
                      <div
                        class="rep-bar-fill"
                        style="width: {fillPct(r.after, 100)}; background: {tierColor(r.tierAfter)};"
                      ></div>
                    </div>
                    <span class="rep-value mono">{Math.round(r.after)}</span>
                    <span class="rep-tier-badge" style="color: {tierColor(r.tierAfter)};">
                      {TIER_LABELS[r.tierAfter]}
                    </span>
                    {#if r.delta !== 0}
                      <span class="rep-delta mono" data-dir={dirOf(r.delta)}>
                        {arrowOf(r.delta)} {signedRounded(r.delta)}
                      </span>
                    {:else}
                      <span class="rep-delta mono dim">→ ·</span>
                    {/if}
                    {#if r.monthOverMonthDelta !== undefined && r.monthOverMonthDelta !== 0}
                      <span class="rep-mom mono" data-dir={dirOf(r.monthOverMonthDelta)}>
                        mom {signedRounded(r.monthOverMonthDelta)}
                      </span>
                    {/if}
                  </summary>
                  <ul class="rep-reasons">
                    {#each r.reasons as reason, i (i)}
                      <li>{reason}</li>
                    {/each}
                  </ul>
                </details>
              {:else}
                <div class="rep-summary rep-summary-flat">
                  <span class="rep-label">{r.label}</span>
                  <div class="rep-bar-track">
                    <div
                      class="rep-bar-fill"
                      style="width: {fillPct(r.after, 100)}; background: {tierColor(r.tierAfter)};"
                    ></div>
                  </div>
                  <span class="rep-value mono">{Math.round(r.after)}</span>
                  <span class="rep-tier-badge" style="color: {tierColor(r.tierAfter)};">
                    {TIER_LABELS[r.tierAfter]}
                  </span>
                  {#if r.delta !== 0}
                    <span class="rep-delta mono" data-dir={dirOf(r.delta)}>
                      {arrowOf(r.delta)} {signedRounded(r.delta)}
                    </span>
                  {:else}
                    <span class="rep-delta mono dim">→ ·</span>
                  {/if}
                  {#if r.monthOverMonthDelta !== undefined && r.monthOverMonthDelta !== 0}
                    <span class="rep-mom mono" data-dir={dirOf(r.monthOverMonthDelta)}>
                      mom {signedRounded(r.monthOverMonthDelta)}
                    </span>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Top pressures ─────────────────────────────────────────── -->
    {#if data.pressures && data.pressures.top.length > 0}
      <section class="block">
        <h2 class="block-label tag">top pressures</h2>
        <div class="pressures">
          {#each data.pressures.top as pressure (pressure.id)}
            {@const p = pressure as MonthlyOverviewPressureRow}
            <PressureCard
              pressure={{
                id: p.id,
                label: p.label,
                value: p.value,
                trend: p.trend,
                tags: [],
                topCauses: p.topCauses,
              }}
              interactive={false}
            />
          {/each}
        </div>
        {#if data.pressures.totalActive > data.pressures.top.length}
          <button
            type="button"
            class="jump-button"
            onclick={navigatePressures}
            disabled={!onnavigatepressures}
          >
            view all {data.pressures.totalActive} active pressures →
          </button>
        {/if}
      </section>
    {/if}

    <!-- ── Active arcs ───────────────────────────────────────────── -->
    {#if data.arcs && data.arcs.length > 0}
      <section class="block">
        <h2 class="block-label tag">active arcs</h2>
        <ul class="arc-list">
          {#each data.arcs.slice(0, 6) as arc (arc.id)}
            {@const a = arc as MonthlyOverviewArc}
            <li class="arc-row">
              <div class="arc-head">
                <span class="arc-label">{a.label}</span>
                <span class="arc-stage" data-stage={a.stage}>{a.stage}</span>
              </div>
              <p class="arc-meta mono dim">
                intensity {Math.round(a.intensity)}
                · age {a.ageDays} {a.ageDays === 1 ? 'day' : 'days'}
              </p>
              {#if a.relatedFactionLabels.length > 0 || a.relatedCultureLabels.length > 0}
                <p class="arc-refs tag dim">
                  {[...a.relatedFactionLabels, ...a.relatedCultureLabels].join(' · ')}
                </p>
              {/if}
              {#if a.recentHistory.length > 0}
                <ul class="arc-history">
                  {#each a.recentHistory as entry, i (i)}
                    <li class="note">
                      <span class="mono">d{entry.day}</span> — {entry.stage}: {entry.note}
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
        {#if data.arcs.length > 6}
          <p class="tag dim">+{data.arcs.length - 6} more</p>
        {/if}
      </section>
    {/if}

    <!-- ── Rival tavern ──────────────────────────────────────────── -->
    {#if data.rival}
      <section class="block">
        <h2 class="block-label tag">
          <TermLabel term="rival_tavern" label="rival tavern" />
        </h2>
        <div class="meter-track">
          <div
            class="meter-fill"
            style="width: {fillPct(data.rival.pressureAfter, 100)}; background: {pressureColor(data.rival.pressureAfter)};"
          ></div>
        </div>
        <p class="meter-line mono">
          pressure {Math.round(data.rival.pressureBefore)}
          <span class="arrow">→</span>
          <span style="color: {pressureColor(data.rival.pressureAfter)};">
            {Math.round(data.rival.pressureAfter)}
          </span>
          · appeal {Math.round(data.rival.appealBefore)}
          <span class="arrow">→</span>
          {Math.round(data.rival.appealAfter)}
        </p>
        {#if data.rival.notes.length > 0}
          <ul class="note-list">
            {#each data.rival.notes.slice(0, 4) as note, i (i)}
              <li class="note">{note}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ── Customers ─────────────────────────────────────────────── -->
    {#if data.customers}
      <section class="block">
        <h2 class="block-label tag">customers</h2>
        <div class="customer-pills">
          {#if data.customers.bestGroupLabel}
            <span class="customer-pill best">
              <span class="marker best">★</span> {data.customers.bestGroupLabel}
            </span>
          {/if}
          {#if data.customers.worstGroupLabel}
            <span class="customer-pill worst">
              <span class="marker worst">▽</span> {data.customers.worstGroupLabel}
            </span>
          {/if}
        </div>
      </section>
    {/if}

    <!-- ── Economy ───────────────────────────────────────────────── -->
    {#if data.economy}
      <section class="block">
        <h2 class="block-label tag">economy</h2>
        <ul class="econ-list">
          <li class="econ-row">
            <span class="econ-label">sales</span>
            <span class="econ-amt mono" data-dir="gain">{signed(Math.round(data.economy.sales))}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">purchases</span>
            <span class="econ-amt mono" data-dir={data.economy.purchases > 0 ? 'loss' : 'neutral'}>−{Math.round(data.economy.purchases)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label"><TermLabel term="wages" label="wages" /></span>
            <span class="econ-amt mono" data-dir={data.economy.wages > 0 ? 'loss' : 'neutral'}>−{Math.round(data.economy.wages)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label"><TermLabel term="rent" label="rent" /></span>
            <span class="econ-amt mono" data-dir={data.economy.rent > 0 ? 'loss' : 'neutral'}>−{Math.round(data.economy.rent)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">repairs</span>
            <span class="econ-amt mono" data-dir={data.economy.repairs > 0 ? 'loss' : 'neutral'}>−{Math.round(data.economy.repairs)}</span>
          </li>
          <li class="econ-row">
            <span class="econ-label">waste</span>
            <span class="econ-amt mono" data-dir={data.economy.waste > 0 ? 'loss' : 'neutral'}>−{Math.round(data.economy.waste)}</span>
          </li>
          {#if data.economy.other !== 0}
            <li class="econ-row">
              <span class="econ-label">other</span>
              <span class="econ-amt mono" data-dir={dirOf(data.economy.other)}>{signed(Math.round(data.economy.other))}</span>
            </li>
          {/if}
          <li class="econ-row net">
            <span class="econ-label"><TermLabel term="monthly_net" label="net" /></span>
            <span class="econ-amt mono accent">{signed(Math.round(data.economy.net))}</span>
          </li>
        </ul>
      </section>
    {/if}

    <!-- ── Upgrade readiness ─────────────────────────────────────── -->
    {#if data.upgrades && data.upgrades.length > 0}
      <section class="block">
        <h2 class="block-label tag">
          <TermLabel term="upgrade_readiness" label="upgrade readiness" />
        </h2>
        <ul class="upgrade-list">
          {#each data.upgrades as upgrade (upgrade.id)}
            {@const u = upgrade as MonthlyOverviewUpgradeRow}
            <li class="upgrade-row">
              <span class="upgrade-label">{u.label}</span>
              <span
                class="upgrade-chip mono"
                style="color: {pressureColor(u.relevance)}; border-color: {pressureColor(u.relevance)};"
              >
                {Math.round(u.relevance)}
              </span>
              <p class="upgrade-rationale">{u.rationale}</p>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Modifiers ─────────────────────────────────────────────── -->
    {#if data.activeModifier || data.nextMonthModifier}
      <section class="block">
        <h2 class="block-label tag">
          <TermLabel term="month_modifier" label="month modifier" />
        </h2>
        <div class="mod-strip">
          {#if data.activeModifier}
            <div class="mod-tile">
              <span class="mod-when tag">this month</span>
              <span class="mod-label">{data.activeModifier.label}</span>
              <p class="mod-desc">{data.activeModifier.description}</p>
              {#if data.activeModifier.tags.length > 0}
                <p class="mod-tags tag dim">{data.activeModifier.tags.join(' · ')}</p>
              {/if}
            </div>
          {/if}
          {#if data.nextMonthModifier}
            <div class="mod-tile mod-next">
              <span class="mod-when tag">next month</span>
              <span class="mod-label">{data.nextMonthModifier.label}</span>
              <p class="mod-desc">{data.nextMonthModifier.description}</p>
              {#if data.nextMonthModifier.tags.length > 0}
                <p class="mod-tags tag dim">{data.nextMonthModifier.tags.join(' · ')}</p>
              {/if}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- ── Strategic summary ─────────────────────────────────────── -->
    {#if data.strategicSummary && data.strategicSummary.length > 0}
      <section class="block">
        <h2 class="block-label tag">strategic summary</h2>
        <ul class="note-list">
          {#each data.strategicSummary as note, i (i)}
            <li class="note">{note}</li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</section>

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

  .ending-coin {
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
    font-size: 14px;
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

  .arrow {
    color: var(--text-faint);
    margin: 0 4px;
  }

  /* ── Comparison strip ─────────────────────────────────────── */
  .compare-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
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

  /* ── Rent + landlord ──────────────────────────────────────── */
  .rent-landlord {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-sm);
  }
  @media (min-width: 480px) {
    .rent-landlord {
      grid-template-columns: 1fr 1fr;
    }
  }

  .rent-block,
  .landlord-block {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .rent-block[data-paid='false'] {
    background: color-mix(in srgb, var(--loss) 8%, var(--surface));
    border-color: color-mix(in srgb, var(--loss) 30%, transparent);
  }

  .rent-status {
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .rent-stats {
    font-size: 13px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .meter-line {
    font-size: 13px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .meter-track {
    height: 6px;
    background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
    border-radius: 3px;
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    border-radius: 3px;
    transition: width var(--m-base) var(--ease);
  }

  /* ── Inspection ───────────────────────────────────────────── */
  .warning-chip {
    align-self: flex-start;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--loss) 20%, transparent);
    color: var(--loss);
    border: 1px solid color-mix(in srgb, var(--loss) 50%, transparent);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  /* ── Reputation identity strip ────────────────────────────── */
  .rep-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rep-row {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .rep-row.tier-shifted {
    border-left: 2px solid var(--accent);
  }

  .rep-details {
    width: 100%;
  }

  .rep-summary,
  .rep-summary-flat {
    display: grid;
    grid-template-columns: minmax(80px, 1fr) minmax(80px, 2fr) auto auto auto auto;
    align-items: center;
    gap: var(--sp-xs);
    padding: 8px var(--sp-sm);
    min-height: 44px;
    cursor: default;
  }

  .rep-details > summary.rep-summary {
    cursor: pointer;
    list-style: none;
  }
  .rep-details > summary.rep-summary::-webkit-details-marker {
    display: none;
  }

  .rep-label {
    color: var(--text);
    font-size: 14px;
  }

  .rep-bar-track {
    height: 6px;
    background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
    border-radius: 3px;
    overflow: hidden;
  }

  .rep-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width var(--m-base) var(--ease);
  }

  .rep-value {
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
    font-size: 13px;
    min-width: 28px;
    text-align: right;
  }

  .rep-tier-badge {
    font-family: var(--font-display);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, currentcolor 10%, transparent);
  }

  .rep-delta {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
  .rep-delta[data-dir='gain'] { color: var(--gain); }
  .rep-delta[data-dir='loss'] { color: var(--loss); }
  .rep-delta[data-dir='neutral'] { color: var(--text-faint); }
  .rep-delta.dim { color: var(--text-faint); }

  .rep-mom {
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    padding: 2px 6px;
    background: var(--surface-raised);
    border-radius: var(--radius-sm);
  }
  .rep-mom[data-dir='gain'] { color: var(--gain); }
  .rep-mom[data-dir='loss'] { color: var(--loss); }
  .rep-mom[data-dir='neutral'] { color: var(--text-faint); }

  .rep-reasons {
    padding: 4px var(--sp-md) var(--sp-sm);
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Top pressures ────────────────────────────────────────── */
  .pressures {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .jump-button {
    align-self: flex-start;
    background: transparent;
    color: var(--accent);
    border: none;
    padding: 6px 0;
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
    cursor: pointer;
  }
  .jump-button:hover,
  .jump-button:focus-visible {
    color: var(--text);
  }
  .jump-button:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  /* ── Active arcs ──────────────────────────────────────────── */
  .arc-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .arc-row {
    padding: var(--sp-sm);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .arc-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-sm);
  }

  .arc-label {
    color: var(--text);
    font-size: 15px;
  }

  .arc-stage {
    font-family: var(--font-display);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--text-dim);
  }
  .arc-stage[data-stage='climax'] {
    color: var(--loss);
    background: color-mix(in srgb, var(--loss) 12%, var(--surface-raised));
  }
  .arc-stage[data-stage='active'] {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised));
  }

  .arc-meta {
    font-size: 13px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .arc-refs {
    font-size: 12px;
  }

  .arc-history {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Customers ────────────────────────────────────────────── */
  .customer-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
  }

  .customer-pill {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    font-size: 14px;
    color: var(--text-dim);
  }

  .customer-pill.best {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .marker.best { color: var(--accent); }
  .marker.worst { color: var(--text-faint); }

  /* ── Notes ────────────────────────────────────────────────── */
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

  /* ── Upgrade readiness ────────────────────────────────────── */
  .upgrade-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .upgrade-row {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'label chip'
      'rationale rationale';
    column-gap: var(--sp-sm);
    row-gap: 2px;
    align-items: center;
    padding: 8px var(--sp-sm);
    background: var(--surface);
    border-radius: var(--radius-sm);
    border: var(--border-faint);
  }

  .upgrade-label {
    grid-area: label;
    color: var(--text);
    font-size: 14px;
  }

  .upgrade-chip {
    grid-area: chip;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid;
    background: transparent;
  }

  .upgrade-rationale {
    grid-area: rationale;
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
    line-height: 1.4;
  }

  /* ── Modifiers ────────────────────────────────────────────── */
  .mod-strip {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-xs);
  }
  @media (min-width: 480px) {
    .mod-strip {
      grid-template-columns: 1fr 1fr;
    }
  }

  .mod-tile {
    padding: var(--sp-sm);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mod-tile.mod-next {
    background: color-mix(in srgb, var(--surface) 65%, transparent);
    border-style: dashed;
  }

  .mod-when {
    color: var(--text-faint);
  }

  .mod-label {
    color: var(--accent);
    font-family: var(--font-display);
    letter-spacing: 0.04em;
    font-size: 14px;
  }

  .mod-desc {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.5;
  }

  .mod-tags {
    font-size: 11px;
  }
</style>
