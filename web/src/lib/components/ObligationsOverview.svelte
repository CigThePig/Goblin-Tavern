<!--
  ObligationsOverview — the Reports → Obligations screen renderer.

  Expansion Phase 7 §7.4. One place that answers "what do I owe, to whom,
  when, and what can I do about it": the scheduled obligation view, the loan
  and rent ledgers, inspection case status, due dates, the provenance of
  every warning, the player's options, exact settlement entries, and each
  record's own history.

  Pure presentation. Every figure comes from `ObligationCalendarData`, which
  is itself a projection of the records that own them — the component never
  recomputes a balance, a due date, or an eligibility rule. The options rows
  carry the registry's own rejection reasons, so a greyed-out option says why
  in the domain's words rather than the view's.
-->
<script lang="ts">
  import type {
    ObligationCalendarData,
    ObligationCalendarRow,
  } from '../../../../src/reports/obligationCalendarProjection'

  let { data }: { data: ObligationCalendarData } = $props()

  function dueLabel(row: ObligationCalendarRow): string {
    if (row.dueOnDay === undefined) return 'no fixed date'
    const days = row.daysUntilDue ?? 0
    if (days > 1) return `day ${row.dueOnDay} · in ${days} days`
    if (days === 1) return `day ${row.dueOnDay} · tomorrow`
    if (days === 0) return `day ${row.dueOnDay} · today`
    return `day ${row.dueOnDay} · ${-days} ${-days === 1 ? 'day' : 'days'} late`
  }

  // `row.overdue` is the projection's carry of the obligation lifecycle's own
  // `isOverdue`. The view must not re-derive lateness from `daysUntilDue` —
  // that is the simulation's rule to own, and a second copy here is how the
  // screen ends up disagreeing with the arrears the economy acts on.
  function urgencyOf(row: ObligationCalendarRow): 'late' | 'soon' | 'calm' {
    if (row.overdue) return 'late'
    if (row.daysUntilDue !== undefined && row.daysUntilDue <= 2) return 'soon'
    return 'calm'
  }

  const hasAnything = $derived(
    data.rows.length > 0 ||
      data.loans.length > 0 ||
      data.rent !== undefined ||
      data.watch.cases.length > 0,
  )
</script>

<section class="obligations" aria-label="Obligations">
  {#if !hasAnything}
    <p class="placeholder">The tavern owes nobody anything today.</p>
  {:else}
    <!-- ── What is owed ──────────────────────────────────────────── -->
    <section class="block">
      <p class="section-label block-label">Owed</p>
      <p class="head-line display">{data.totalOutstanding} coin</p>
      {#if data.overdue > 0}
        <p class="overdue-note">{data.overdue} of it already late</p>
      {/if}
      <ul class="rows">
        {#each data.rows as row (row.id)}
          <li class="row" class:late={urgencyOf(row) === 'late'} class:soon={urgencyOf(row) === 'soon'}>
            <div class="row-head">
              <span class="row-title">{row.readable}</span>
              <span class="row-amount">{row.outstanding}</span>
            </div>
            <p class="row-meta dim">
              {row.counterparty} · {dueLabel(row)} · {row.status.replace('_', ' ')}
              {#if row.graceEndsOnDay !== undefined}
                · grace ends day {row.graceEndsOnDay}
              {/if}
            </p>
            {#if row.paid > 0 || row.accruedCharges > 0}
              <p class="row-meta dim">
                {#if row.paid > 0}paid {row.paid}{/if}
                {#if row.paid > 0 && row.accruedCharges > 0} · {/if}
                {#if row.accruedCharges > 0}late charges {row.accruedCharges}{/if}
              </p>
            {/if}
            {#if row.options.length > 0}
              <ul class="options">
                {#each row.options as option (option.actionId)}
                  <li class="option" class:disabled={option.disabledReason !== undefined}>
                    <span class="option-label">{option.label}</span>
                    {#if option.disabledReason}
                      <span class="option-reason dim">{option.disabledReason}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    <!-- ── What is coming ────────────────────────────────────────── -->
    {#if data.upcoming.length > 0}
      <section class="block">
        <p class="section-label block-label">On the calendar</p>
        <ul class="rows">
          {#each data.upcoming.slice(0, 12) as event (event.id)}
            <li class="row">
              <div class="row-head">
                <span class="row-title">{event.origin}</span>
                <span class="row-amount small">
                  {event.daysUntil <= 0 ? 'today' : `${event.daysUntil}d`}
                </span>
              </div>
              <p class="row-meta dim">
                day {event.scheduledForDay} · {event.ownerModuleId}
                {#if event.warned} · you have been warned{/if}
              </p>
              {#if event.selectionLabel}
                <p class="row-meta dim">from your choice: “{event.selectionLabel}”</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── Rent ──────────────────────────────────────────────────── -->
    {#if data.rent}
      <section class="block">
        <p class="section-label block-label">{data.rent.landlord}</p>
        <p class="head-line display">
          {data.rent.rentPerPeriod} a month · {data.rent.status.replace('_', ' ')}
        </p>
        <p class="row-meta dim">
          Month {data.rent.periodIndex + 1} due day {data.rent.periodEndsOnDay} ·
          {data.rent.outstanding} outstanding
          {#if data.rent.arrears > 0} · {data.rent.arrears} in arrears{/if}
          · {data.rent.missedPeriods} missed · {data.rent.totalPaid} paid to date
        </p>
        <p class="row-meta dim">
          Opinion {data.rent.landlordOpinion} · concern {data.rent.landlordConcern}
        </p>
        {#if data.rent.concession}
          <p class="row-meta">{data.rent.concession}</p>
        {/if}
        {#if data.rent.notice}
          <div class="notice">
            <p class="notice-title">{data.rent.notice.readable}</p>
            <p class="row-meta dim">
              Returnable day {data.rent.notice.deadlineDay} · cure {data.rent.notice.cureAmount}
            </p>
            <ul class="remedies">
              {#each data.rent.notice.remedies as remedy (remedy)}
                <li>{remedy}</li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if data.rent.accessRequest}
          <p class="row-meta">
            Access requested ({data.rent.accessRequest.reason}) — answer by day
            {data.rent.accessRequest.deadlineDay}.
          </p>
        {/if}
        {#if data.rent.repairs.length > 0}
          <ul class="rows tight">
            {#each data.rent.repairs as repair (repair.readable)}
              <li class="row-meta">{repair.readable}</li>
            {/each}
          </ul>
        {/if}
        {#if data.rent.beliefs.length > 0}
          <ul class="rows tight">
            {#each data.rent.beliefs as belief (belief.readable)}
              <li class="row-meta dim">
                ({belief.weight >= 0 ? '+' : ''}{belief.weight}) {belief.readable}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ── Loans ─────────────────────────────────────────────────── -->
    {#if data.loans.length > 0}
      <section class="block">
        <p class="section-label block-label">Loans</p>
        <ul class="rows">
          {#each data.loans as loan (loan.id)}
            <li class="row">
              <div class="row-head">
                <span class="row-title">{loan.lender}</span>
                <span class="row-amount">{loan.outstanding}</span>
              </div>
              <p class="row-meta dim">
                {loan.status} · borrowed {loan.principal}, fee {loan.fee}, repayable
                {loan.totalRepayable} · repaid {loan.repaid}
              </p>
              {#if loan.nextDueOnDay !== undefined}
                <p class="row-meta dim">
                  Next payment {loan.nextAmount} on day {loan.nextDueOnDay}
                </p>
              {/if}
              {#if loan.missedInstalments > 0 || loan.renegotiations > 0 || loan.collectedByLender > 0}
                <p class="row-meta dim">
                  {#if loan.missedInstalments > 0}{loan.missedInstalments} missed{/if}
                  {#if loan.renegotiations > 0} · renegotiated {loan.renegotiations}×{/if}
                  {#if loan.collectedByLender > 0} · {loan.collectedByLender} seized{/if}
                </p>
              {/if}
              <ul class="rows tight">
                {#each loan.history.slice(-4) as entry (entry.onDay + entry.reason)}
                  <li class="row-meta dim">
                    day {entry.onDay}: {entry.from} → {entry.to} — {entry.reason}
                    {#if entry.amount !== undefined} ({entry.amount}){/if}
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- ── The watch ─────────────────────────────────────────────── -->
    <section class="block">
      <p class="section-label block-label">{data.watch.label}</p>
      <p class="row-meta dim">
        Standing {data.watch.standing} · interest {data.watch.interest} · records
        {data.watch.recordsReadiness}
      </p>
      {#if data.watch.cases.length === 0}
        <p class="row-meta dim">No case open.</p>
      {:else}
        <ul class="rows">
          {#each data.watch.cases as record (record.id)}
            <li class="row">
              <div class="row-head">
                <span class="row-title">{record.inspector}</span>
                <span class="row-amount small">{record.status.replace('_', ' ')}</span>
              </div>
              {#if record.nextVisitDay !== undefined}
                <p class="row-meta dim">
                  {record.announced ? 'Announced' : 'Unannounced'} visit day
                  {record.nextVisitDay}
                  {#if record.daysUntilVisit !== undefined}
                    · {record.daysUntilVisit <= 0 ? 'today' : `in ${record.daysUntilVisit} days`}
                  {/if}
                </p>
              {/if}
              {#if record.findings.length > 0}
                <ul class="rows tight">
                  {#each record.findings as finding (finding.id)}
                    <li class="row-meta" class:met={finding.met}>
                      {finding.requirement} — {finding.met ? 'met' : 'not met'}
                      {#if finding.dueOnDay !== undefined} (by day {finding.dueOnDay}){/if}
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if record.fines.length > 0}
                <ul class="rows tight">
                  {#each record.fines as fine (fine.id)}
                    <li class="row-meta dim">
                      Fine: {fine.outstanding} outstanding
                      {#if fine.dueOnDay !== undefined}, due day {fine.dueOnDay}{/if}
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if record.bribe}
                <p class="row-meta dim">
                  A quiet word of {record.bribe.amount} —
                  {record.bribe.exposed
                    ? 'and it came out'
                    : record.bribe.accepted
                      ? 'taken'
                      : 'refused'}.
                </p>
              {/if}
              {#each record.outcomes.slice(-3) as outcome (outcome.onDay + outcome.outcome)}
                <p class="row-meta dim">day {outcome.onDay}: {outcome.readable}</p>
              {/each}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</section>

<style>
  .obligations {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .block {
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-md);
    padding: var(--sp-md);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .rows.tight {
    gap: 2px;
  }

  .row {
    border-left: 2px solid var(--border-color, rgba(128, 128, 128, 0.35));
    padding-left: var(--sp-sm);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row.soon {
    border-left-color: var(--warn, #c8922a);
  }

  .row.late {
    border-left-color: var(--danger, #b4402f);
  }

  .row-head {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-sm);
    align-items: baseline;
  }

  .row-title {
    font-weight: 600;
  }

  .row-amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .row-amount.small {
    font-weight: 400;
    font-size: 0.85em;
  }

  .row-meta {
    margin: 0;
    font-size: 0.85em;
  }

  .row-meta.met {
    opacity: 0.7;
  }

  .dim {
    opacity: 0.7;
  }

  .overdue-note {
    margin: 0;
    font-size: 0.85em;
    color: var(--danger, #b4402f);
  }

  .notice {
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    padding: var(--sp-sm);
    margin-top: var(--sp-xs);
  }

  .notice-title {
    margin: 0 0 2px;
    font-weight: 600;
  }

  .remedies {
    margin: var(--sp-xs) 0 0;
    padding-left: 1.1em;
    font-size: 0.85em;
  }

  .options {
    list-style: none;
    margin: var(--sp-xs) 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    font-size: 0.85em;
  }

  .option {
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    display: flex;
    gap: 6px;
    align-items: baseline;
  }

  .option.disabled {
    opacity: 0.55;
  }

  .option-reason {
    font-size: 0.9em;
  }

  .placeholder {
    opacity: 0.7;
    margin: 0;
  }
</style>
