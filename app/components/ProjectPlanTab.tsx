'use client'

import { useMemo } from 'react'
import { useDeadlines } from '@/lib/useDeadlines'
import { computePillStatus, PILL_CONFIG, formatDate, formatCurrency } from '@/lib/utils'
import { BUCKET_COLORS, BUCKETS } from '@/data/workstreams'
import StatusPill from './StatusPill'

// ── Date constants — must match lib/utils.ts TODAY exactly, never call new Date() ──
const TODAY_STR  = '2026-06-12'
const PLUS14_STR = '2026-06-26'

// ── Timeline: Jun 1 → Oct 31 2026 ────────────────────────────────────────────
const TL_START = new Date('2026-06-01T00:00:00')
const TL_END   = new Date('2026-10-31T00:00:00')
const TL_MS    = TL_END.getTime() - TL_START.getTime()

function toPct(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr + 'T00:00:00').getTime() - TL_START.getTime()
  return Math.max(0, Math.min(100, (ms / TL_MS) * 100))
}

const TODAY_PCT = toPct(TODAY_STR)!

const MONTH_MARKS = [
  { label: 'Jun', pct: toPct('2026-06-01')! },
  { label: 'Jul', pct: toPct('2026-07-01')! },
  { label: 'Aug', pct: toPct('2026-08-01')! },
  { label: 'Sep', pct: toPct('2026-09-01')! },
  { label: 'Oct', pct: toPct('2026-10-01')! },
]

// ── Budget baseline — mirrors the Reference-tab committed total ───────────────
const BUDGET_BASELINE = 8402

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onGoToDeadlines: () => void
  onGoToWorkstreams: () => void
}

export default function ProjectPlanTab({ onGoToDeadlines, onGoToWorkstreams }: Props) {
  const { deadlines, loading } = useDeadlines()

  // ── Phase spans: earliest approval_date → latest due_date per bucket ──────
  const phases = useMemo(() => BUCKETS.map(bucket => {
    const rows         = deadlines.filter(d => d.bucket === bucket.id)
    const approvalDates = rows.map(d => d.approval_date).filter((x): x is string => x !== null)
    const dueDates      = rows.map(d => d.due_date).filter((x): x is string => x !== null)

    // Left: prefer earliest approval_date, fall back to earliest due_date
    const leftCandidates  = approvalDates.length ? approvalDates : dueDates
    const rightCandidates = dueDates.length      ? dueDates      : approvalDates

    const leftDate  = leftCandidates.length  ? leftCandidates.reduce((a, b) => a < b ? a : b)  : null
    const rightDate = rightCandidates.length ? rightCandidates.reduce((a, b) => a > b ? a : b) : null

    const leftPct  = toPct(leftDate)
    const rightPct = toPct(rightDate)
    const hasBar   = leftPct !== null && rightPct !== null

    return { bucket, leftPct: leftPct ?? 0, rightPct: rightPct ?? 0, hasBar }
  }), [deadlines])

  // ── Health metrics ────────────────────────────────────────────────────────
  const health = useMemo(() => {
    const total      = deadlines.length
    const overdue    = deadlines.filter(d =>
      computePillStatus(d.status, d.due_date) === 'passed' && d.status !== 'done'
    ).length
    const urgent     = deadlines.filter(d =>
      computePillStatus(d.status, d.due_date) === 'urgent'
    ).length
    const dueNext14  = deadlines.filter(d =>
      d.due_date && d.due_date >= TODAY_STR && d.due_date <= PLUS14_STR
    ).length
    const doneCount  = deadlines.filter(d => d.status === 'done').length
    const pctComplete = total > 0 ? Math.round((doneCount / total) * 100) : 0
    return { overdue, urgent, dueNext14, doneCount, pctComplete, total }
  }, [deadlines])

  // ── Critical path: is_critical, sorted due_date asc, nulls last ───────────
  const critical = useMemo(() =>
    [...deadlines.filter(d => d.is_critical)].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }),
    [deadlines]
  )

  // ── Progress by workstream: X done / Y total per workstream ─────────────
  const workstreamProgress = useMemo(() => BUCKETS.map(bucket => ({
    bucket,
    workstreams: bucket.workstreams.map(ws => {
      const rows = deadlines.filter(d => d.workstream === ws.id)
      const done = rows.filter(d => d.status === 'done').length
      return { ws, total: rows.length, done }
    }),
  })), [deadlines])

  // ── Budget rollup: sum non-null amounts vs BUDGET_BASELINE ──────────────
  const budget = useMemo(() => {
    const total = deadlines.reduce((sum, d) => sum + (d.amount ?? 0), 0)
    const byBucket = BUCKETS.map(b => ({
      bucket: b,
      amount: deadlines
        .filter(d => d.bucket === b.id)
        .reduce((sum, d) => sum + (d.amount ?? 0), 0),
    }))
    return { total, byBucket }
  }, [deadlines])

  // ── Ownership: count per owner, unassigned count, sorted desc ────────────
  const ownership = useMemo(() => {
    const counts: Record<string, number> = {}
    let unassigned = 0
    deadlines.forEach(d => {
      const owner = d.owner?.trim()
      if (!owner) { unassigned++ }
      else { counts[owner] = (counts[owner] ?? 0) + 1 }
    })
    const owners = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    return { owners, unassigned }
  }, [deadlines])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Phase Roadmap ────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Phase Roadmap</h2>
          <button
            onClick={onGoToWorkstreams}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors underline underline-offset-2"
          >
            View Workstreams →
          </button>
        </div>

        {/* Month header — aligned with bar area */}
        <div className="flex">
          <div className="w-44 flex-shrink-0" />
          <div className="flex-1 relative h-5 mb-1">
            {MONTH_MARKS.map(m => (
              <span
                key={m.label}
                className="absolute text-xs font-medium text-slate-400 -translate-x-1/2 select-none"
                style={{ left: `${m.pct}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Bucket rows */}
        <div className="space-y-1.5">
          {phases.map(({ bucket, leftPct, rightPct, hasBar }) => (
            <div key={bucket.id} className="flex items-center gap-3">
              <div className="w-44 flex-shrink-0 flex items-center justify-end gap-1.5 pr-1 min-w-0">
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ background: BUCKET_COLORS[bucket.id] }}
                />
                <span className="text-xs text-slate-600 truncate">{bucket.name}</span>
              </div>

              <div className="flex-1 relative h-6 bg-slate-100 rounded overflow-hidden">
                {/* TODAY line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-800 z-10"
                  style={{ left: `${TODAY_PCT}%` }}
                />

                {hasBar ? (
                  <div
                    className="absolute top-1 bottom-1 rounded"
                    style={{
                      left:    `${leftPct}%`,
                      width:   `max(3px, ${rightPct - leftPct}%)`,
                      background: BUCKET_COLORS[bucket.id],
                      opacity: 0.78,
                    }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center px-2 text-xs text-slate-400 italic">
                    No dates set
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* TODAY label below */}
        <div className="flex mt-0.5">
          <div className="w-44 flex-shrink-0" />
          <div className="flex-1 relative h-4">
            <span
              className="absolute text-xs text-slate-500 font-medium -translate-x-1/2 select-none"
              style={{ left: `${TODAY_PCT}%` }}
            >
              Today
            </span>
          </div>
        </div>
      </section>

      {/* ── Health Overview ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Health Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className={`rounded-lg px-4 py-5 text-center ${PILL_CONFIG.passed.className}`}>
            <div className="text-3xl font-bold tabular-nums">{health.overdue}</div>
            <div className="text-xs font-medium mt-1 opacity-90">Overdue</div>
          </div>

          <div className={`rounded-lg px-4 py-5 text-center ${PILL_CONFIG.urgent.className}`}>
            <div className="text-3xl font-bold tabular-nums">{health.urgent}</div>
            <div className="text-xs font-medium mt-1 opacity-90">Urgent (≤14 d)</div>
          </div>

          <div className={`rounded-lg px-4 py-5 text-center ${PILL_CONFIG.upcoming.className}`}>
            <div className="text-3xl font-bold tabular-nums">{health.dueNext14}</div>
            <div className="text-xs font-medium mt-1 opacity-90">Due next 14 days</div>
          </div>

          <div className={`rounded-lg px-4 py-5 text-center ${PILL_CONFIG.done.className}`}>
            <div className="text-3xl font-bold tabular-nums">{health.pctComplete}%</div>
            <div className="text-xs font-medium mt-1 opacity-90">{health.doneCount} / {health.total} done</div>
          </div>

        </div>
      </section>

      {/* ── Critical Path ────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-900">Critical Path</h2>
          <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {critical.length}
          </span>
        </div>

        {critical.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No critical items flagged.</p>
        ) : (
          <div>
            {/* Column headers */}
            <div className="flex items-center gap-4 px-3 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <span className="flex-1 min-w-0">Item</span>
              <span className="flex-shrink-0 w-28 text-right">Due Date</span>
              <span className="flex-shrink-0 w-24 text-right hidden sm:block">Owner</span>
              <span className="flex-shrink-0 w-20 text-right">Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50">
              {critical.map(d => (
                <button
                  key={d.id}
                  onClick={onGoToDeadlines}
                  className="w-full flex items-center gap-4 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors rounded"
                >
                  <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{d.item}</span>
                  <span className="flex-shrink-0 w-28 text-right text-xs text-slate-500">{formatDate(d.due_date)}</span>
                  <span className="flex-shrink-0 w-24 text-right text-xs text-slate-500 truncate hidden sm:block">
                    {d.owner ?? <span className="italic text-slate-400">Unassigned</span>}
                  </span>
                  <span className="flex-shrink-0 w-20 flex justify-end">
                    <StatusPill status={d.status} dueDate={d.due_date} />
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-3 px-3">
              Click any row to open the Deadlines tab.
            </p>
          </div>
        )}
      </section>

      {/* ── Progress by Workstream ──────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Progress by Workstream</h2>
          <button
            onClick={onGoToWorkstreams}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors underline underline-offset-2"
          >
            View Workstreams →
          </button>
        </div>

        <div className="space-y-5">
          {workstreamProgress.map(({ bucket, workstreams }) => (
            <div key={bucket.id}>
              {/* Bucket group header */}
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ background: BUCKET_COLORS[bucket.id] }}
                />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {bucket.name}
                </span>
              </div>

              {/* Workstream rows */}
              <div className="space-y-1.5 pl-3.5 border-l-2" style={{ borderColor: BUCKET_COLORS[bucket.id] + '40' }}>
                {workstreams.map(({ ws, done, total }) => (
                  <button
                    key={ws.id}
                    onClick={onGoToWorkstreams}
                    className="w-full flex items-center gap-3 group"
                  >
                    <span className="w-52 flex-shrink-0 text-xs text-slate-600 text-right truncate group-hover:text-slate-900 transition-colors pr-1">
                      {ws.name}
                    </span>
                    <div className="flex-1 relative h-4 bg-slate-100 rounded overflow-hidden">
                      {total > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 rounded transition-all"
                          style={{
                            width: `${(done / total) * 100}%`,
                            background: BUCKET_COLORS[bucket.id],
                            opacity: 0.75,
                          }}
                        />
                      )}
                    </div>
                    <span className="flex-shrink-0 w-14 text-right text-xs tabular-nums text-slate-400">
                      {total === 0
                        ? <span className="italic">0 items</span>
                        : `${done} / ${total}`
                      }
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Budget Rollup ────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Budget</h2>

        {/* Committed vs baseline */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(budget.total)}
            </span>
            <span className="text-sm text-slate-400">
              of {formatCurrency(BUDGET_BASELINE)} baseline committed
            </span>
            {budget.total > BUDGET_BASELINE && (
              <span className="text-xs font-semibold text-red-600 ml-1">over budget</span>
            )}
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (budget.total / BUDGET_BASELINE) * 100)}%`,
                background: budget.total > BUDGET_BASELINE ? '#ef4444' : '#3b82f6',
              }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {budget.total > BUDGET_BASELINE
              ? `${formatCurrency(budget.total - BUDGET_BASELINE)} over baseline`
              : `${formatCurrency(BUDGET_BASELINE - budget.total)} remaining`
            }
          </p>
        </div>

        {/* Per-bucket breakdown */}
        {budget.byBucket.some(b => b.amount > 0) ? (
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            {budget.byBucket.filter(b => b.amount > 0).map(({ bucket, amount }) => (
              <div key={bucket.id} className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ background: BUCKET_COLORS[bucket.id] }}
                />
                <span className="flex-1 text-xs text-slate-600 truncate">{bucket.name}</span>
                <span className="text-xs font-medium text-slate-700 tabular-nums">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic border-t border-slate-100 pt-3">
            No amounts recorded yet.
          </p>
        )}
      </section>

      {/* ── Ownership at a Glance ────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Ownership</h2>

        {ownership.owners.length === 0 && ownership.unassigned === 0 ? (
          <p className="text-sm text-slate-400 italic">No deadlines found.</p>
        ) : (
          <div>
            <div className="flex items-center gap-4 px-3 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <span className="flex-1">Owner</span>
              <span className="w-12 text-right">Items</span>
            </div>

            <div className="divide-y divide-slate-50">
              {ownership.owners.map(({ name, count }) => (
                <button
                  key={name}
                  onClick={onGoToDeadlines}
                  className="w-full flex items-center gap-4 px-3 py-2 text-left hover:bg-slate-50 transition-colors rounded"
                >
                  <span className="flex-1 text-sm text-slate-700">{name}</span>
                  <span className="w-12 text-right text-sm font-semibold text-slate-900 tabular-nums">
                    {count}
                  </span>
                </button>
              ))}

              {ownership.unassigned > 0 && (
                <button
                  onClick={onGoToDeadlines}
                  className="w-full flex items-center gap-4 px-3 py-2 text-left hover:bg-slate-50 transition-colors rounded"
                >
                  <span className="flex-1 text-sm text-slate-400 italic">Unassigned</span>
                  <span className="w-12 text-right text-sm font-semibold text-slate-400 tabular-nums">
                    {ownership.unassigned}
                  </span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-3 px-3">
              Click any row to open the Deadlines tab.
            </p>
          </div>
        )}
      </section>

    </div>
  )
}
