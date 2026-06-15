'use client'

import { useState, useMemo } from 'react'
import { useDeadlines } from '@/lib/useDeadlines'
import { BUCKET_COLORS, BUCKETS } from '@/data/workstreams'
import { formatDate, formatCurrency, STATUS_LABELS } from '@/lib/utils'
import StatusPill from './StatusPill'
import type { Deadline } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DEADLINE_TYPES = ['Vendor Deadline','Internal Action','Milestone'] as const

const CAL_MIN = { year: 2026, month: 2 }  // March 2026
const CAL_MAX = { year: 2026, month: 9 }  // October 2026
const INIT    = { year: 2026, month: 5 }  // June 2026 (current)
const TODAY_KEY = '2026-06-12'

// ── Helpers ───────────────────────────────────────────────────────────────────
function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const cells: Array<{ date: Date; cur: boolean }> = []

  for (let i = first.getDay() - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), cur: false })
  for (let n = 1; n <= last.getDate(); n++)
    cells.push({ date: new Date(year, month, n), cur: true })
  while (cells.length < 42) {
    const p = cells[cells.length - 1].date
    cells.push({ date: new Date(p.getFullYear(), p.getMonth(), p.getDate() + 1), cur: false })
  }
  return cells
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalEvent { dl: Deadline; kind: 'due' | 'appr' }

// ── Sub-components ────────────────────────────────────────────────────────────
function EventChip({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const color = BUCKET_COLORS[ev.dl.bucket] ?? '#94a3b8'
  const isDue = ev.kind === 'due'
  return (
    <button
      onClick={onClick}
      title={ev.dl.item}
      className="w-full text-left text-xs rounded px-1.5 py-px truncate leading-5 transition-opacity hover:opacity-80"
      style={
        isDue
          ? { background: color, color: '#fff' }
          : { background: color + '20', color: color, border: `1px solid ${color}60` }
      }
    >
      {!isDue && <span className="font-semibold mr-0.5">appr</span>}
      {ev.dl.is_critical && isDue && <span className="mr-0.5">🚩</span>}
      {ev.dl.item}
    </button>
  )
}

function DetailModal({ ev, onClose, onGoToDeadlines }: {
  ev: CalEvent
  onClose: () => void
  onGoToDeadlines: () => void
}) {
  const { dl, kind } = ev
  const color = BUCKET_COLORS[dl.bucket] ?? '#94a3b8'

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {dl.is_critical && <span className="text-sm">🚩</span>}
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: color + '20', color }}
              >
                {dl.type}
              </span>
              {kind === 'appr' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Viewing approval date
                </span>
              )}
            </div>
            <h2 className="font-semibold text-slate-900 text-base leading-snug">{dl.item}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none flex-shrink-0 mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Status</dt>
            <dd><StatusPill status={dl.status} dueDate={dl.due_date} /></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Owner</dt>
            <dd className="text-slate-700">{dl.owner ?? <span className="text-slate-400 italic">Unassigned</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Due Date</dt>
            <dd className="text-slate-700">{formatDate(dl.due_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Approval Date</dt>
            <dd className="text-slate-700">{formatDate(dl.approval_date)}</dd>
          </div>
          {dl.amount != null && (
            <div>
              <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Amount</dt>
              <dd className="text-slate-700">{formatCurrency(dl.amount)}</dd>
            </div>
          )}
          {dl.category && (
            <div>
              <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Category</dt>
              <dd className="text-slate-700">{dl.category}</dd>
            </div>
          )}
        </dl>

        {dl.notes && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-slate-600 leading-relaxed">{dl.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-1 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); onGoToDeadlines() }}
            className="text-sm px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
          >
            View on Deadlines →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onGoToDeadlines: () => void }

export default function CalendarTab({ onGoToDeadlines }: Props) {
  const { deadlines, owners, loading } = useDeadlines()

  const [month, setMonth] = useState(INIT)

  // Filters
  const [filterOwner,      setFilterOwner]     = useState('')
  const [filterType,       setFilterType]      = useState('')
  const [filterBucket,     setFilterBucket]    = useState('')
  const [filterWorkstream, setFilterWorkstream] = useState('')

  const hasFilter = !!(filterOwner || filterType || filterBucket || filterWorkstream)
  const clearFilters = () => {
    setFilterOwner(''); setFilterType(''); setFilterBucket(''); setFilterWorkstream('')
  }

  const [selected, setSelected] = useState<CalEvent | null>(null)

  const canPrev = month.year > CAL_MIN.year || month.month > CAL_MIN.month
  const canNext = month.year < CAL_MAX.year || month.month < CAL_MAX.month

  const shiftMonth = (delta: number) => {
    setMonth(m => {
      let mo = m.month + delta, yr = m.year
      if (mo < 0)  { mo += 12; yr-- }
      if (mo > 11) { mo -= 12; yr++ }
      return { year: yr, month: mo }
    })
  }

  // Filtered deadlines — must have at least one date
  const filtered = useMemo(() => deadlines.filter(d => {
    if (!d.due_date && !d.approval_date) return false
    if (filterOwner      && d.owner      !== filterOwner)              return false
    if (filterType       && d.type       !== filterType)               return false
    if (filterBucket     && d.bucket     !== parseInt(filterBucket))   return false
    if (filterWorkstream && d.workstream !== parseInt(filterWorkstream)) return false
    return true
  }), [deadlines, filterOwner, filterType, filterBucket, filterWorkstream])

  // Events indexed by date key; approval entries sorted before due entries within same day
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    filtered.forEach(dl => {
      if (dl.approval_date) {
        if (!map[dl.approval_date]) map[dl.approval_date] = []
        map[dl.approval_date].push({ dl, kind: 'appr' })
      }
      if (dl.due_date) {
        if (!map[dl.due_date]) map[dl.due_date] = []
        map[dl.due_date].push({ dl, kind: 'due' })
      }
    })
    return map
  }, [filtered])

  const grid = useMemo(() => buildGrid(month.year, month.month), [month])

  const SELECT_CLS = 'text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap gap-2 items-center">
        <select className={SELECT_CLS} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          <option value="">All owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <select className={SELECT_CLS} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {DEADLINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select className={SELECT_CLS} value={filterBucket} onChange={e => { setFilterBucket(e.target.value); setFilterWorkstream('') }}>
          <option value="">All buckets</option>
          {BUCKETS.map(b => <option key={b.id} value={b.id}>B{b.id} — {b.name}</option>)}
        </select>

        <select className={SELECT_CLS} value={filterWorkstream} onChange={e => setFilterWorkstream(e.target.value)}>
          <option value="">All workstreams</option>
          {BUCKETS.flatMap(b => b.workstreams).map(w => (
            <option key={w.id} value={w.id}>B{w.bucket} W{w.id} — {w.name}</option>
          ))}
        </select>

        {hasFilter && (
          <button className="text-xs text-slate-400 hover:text-slate-700 underline ml-1" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Month navigator + legend */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => shiftMonth(-1)}
            disabled={!canPrev}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
          >
            ‹
          </button>
          <span className="font-semibold text-slate-900 w-40 text-center tabular-nums">
            {MONTHS[month.month]} {month.year}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={!canNext}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
          >
            ›
          </button>
        </div>

        {/* Bucket color legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 ml-2">
          {BUCKETS.map(b => (
            <span key={b.id} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: BUCKET_COLORS[b.id] }} />
              {b.name}
            </span>
          ))}
        </div>

        <span className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span style={{ display:'inline-block', width:28, height:12, borderRadius:3, background:'#3b82f6' }} />
            due date
          </span>
          <span className="flex items-center gap-1">
            <span style={{ display:'inline-block', width:28, height:12, borderRadius:3, background:'#3b82f620', border:'1px solid #3b82f660' }} />
            approval date
          </span>
        </span>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells — 6 rows */}
        <div className="grid grid-cols-7">
          {grid.map(({ date, cur }) => {
            const key    = toKey(date)
            const events = eventsByDay[key] ?? []
            const isToday = key === TODAY_KEY

            return (
              <div
                key={key}
                className={`min-h-[90px] p-1 border-b border-r border-slate-100 ${cur ? '' : 'bg-slate-50/60'}`}
              >
                {/* Date number */}
                <div className={`
                  text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full select-none
                  ${isToday ? 'bg-slate-900 text-white' : cur ? 'text-slate-700' : 'text-slate-300'}
                `}>
                  {date.getDate()}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {events.map((ev, i) => (
                    <EventChip key={i} ev={ev} onClick={() => setSelected(ev)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <DetailModal
          ev={selected}
          onClose={() => setSelected(null)}
          onGoToDeadlines={onGoToDeadlines}
        />
      )}
    </div>
  )
}
