'use client'

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useDeadlines } from '@/lib/useDeadlines'
import { formatDate } from '@/lib/utils'
import StatusPill from './StatusPill'
import { BUCKET_COLORS } from '@/data/workstreams'
import type { Deadline } from '@/types'

// ── Timeline config ────────────────────────────────────────────────────────────
const GANTT_START = new Date('2026-03-30T00:00:00')
const TODAY = new Date('2026-06-12T00:00:00')
const WEEK_W = 44       // px per week column
const TOTAL_WEEKS = 31  // Mar 30 → Oct 26

const WEEKS: Date[] = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
  const d = new Date(GANTT_START)
  d.setDate(d.getDate() + i * 7)
  return d
})

const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7
const ganttW = TOTAL_WEEKS * WEEK_W

function dateToX(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return ((d.getTime() - GANTT_START.getTime()) / MS_PER_WEEK) * WEEK_W
}

const todayX = ((TODAY.getTime() - GANTT_START.getTime()) / MS_PER_WEEK) * WEEK_W
const todayWeekIdx = Math.floor((TODAY.getTime() - GANTT_START.getTime()) / MS_PER_WEEK)

// ── Left frozen columns ────────────────────────────────────────────────────────
const LEFT_COLS = [
  { key: 'flag',   label: '',           width: 28  },
  { key: 'item',   label: 'Item',       width: 210 },
  { key: 'owner',  label: 'Owner',      width: 85  },
  { key: 'appr',   label: 'Appr. Date', width: 85  },
  { key: 'due',    label: 'Due Date',   width: 85  },
  { key: 'status', label: 'Status',     width: 90  },
]

const LEFT_OFFSETS: number[] = LEFT_COLS.reduce<number[]>((acc, _, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + LEFT_COLS[i - 1].width)
  return acc
}, [])

const LEFT_TOTAL = LEFT_COLS.reduce((s, c) => s + c.width, 0)

// ── Category colours ───────────────────────────────────────────────────────────
type BarCat = 'marketing' | 'booth' | 'admin' | 'other'

const CAT: Record<BarCat, { color: string; label: string }> = {
  marketing: { color: '#3b82f6', label: 'Marketing & Advertising' },
  booth:     { color: '#f59e0b', label: 'Booth & Setup' },
  admin:     { color: '#8b5cf6', label: 'Admin' },
  other:     { color: '#10b981', label: 'Other' },
}

function getCategory(d: Deadline): BarCat {
  const cat = (d.category ?? '').toLowerCase()
  const ws = d.workstream
  if (cat.includes('market') || cat.includes('advertis') || [4, 5, 6, 7].includes(ws)) return 'marketing'
  if (cat.includes('booth') || cat.includes('setup') || cat.includes('freeman') || [1, 2].includes(ws)) return 'booth'
  if (cat.includes('admin') || cat.includes('budget') || cat.includes('payment') || [3, 12].includes(ws)) return 'admin'
  return 'other'
}

// ── Style helpers ──────────────────────────────────────────────────────────────
function stickyHead(left: number, isLastLeft: boolean): CSSProperties {
  return {
    position: 'sticky',
    left,
    top: 0,
    zIndex: 30,
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    borderRight: isLastLeft ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
  }
}

function stickyCell(left: number, isLastLeft: boolean, bg: string): CSSProperties {
  return {
    position: 'sticky',
    left,
    zIndex: 10,
    background: bg,
    borderBottom: '1px solid #f1f5f9',
    borderRight: isLastLeft ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
  }
}

function weekLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function BucketDot({ bucket }: { bucket: number }) {
  return (
    <span
      style={{ background: BUCKET_COLORS[bucket] ?? '#94a3b8' }}
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
    />
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function GanttTab() {
  const { deadlines, loading } = useDeadlines()

  const { rows, undated } = useMemo(() => {
    const sorted = [...deadlines].sort((a, b) => {
      if (!a.due_date && !b.due_date) return a.item.localeCompare(b.item)
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
    return {
      rows: sorted.filter(d => d.due_date !== null),
      undated: sorted.filter(d => d.due_date === null),
    }
  }, [deadlines])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 items-center bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700">
        {(Object.entries(CAT) as [BarCat, typeof CAT[BarCat]][]).map(([key, { color, label }]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 28, height: 8, background: color, borderRadius: 4 }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-slate-500">
          <span style={{ display: 'inline-block', width: 2, height: 16, background: '#ef4444', borderRadius: 1 }} />
          Today
        </span>
        <span className="flex items-center gap-2 text-slate-400 text-xs">
          <span>◆ approval date</span>
          <span>■ due date</span>
        </span>
      </div>

      {/* Date TBD panel — items with no due date can't be plotted */}
      {undated.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-4 py-2 border-b border-amber-200 flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Date TBD — {undated.length} item{undated.length !== 1 ? 's' : ''} not yet on timeline
            </span>
            <span className="text-xs text-amber-500">Add a due date to plot these on the chart</span>
          </div>
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {undated.map(d => (
              <div key={d.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-md px-3 py-1.5 text-xs shadow-sm min-w-0">
                <BucketDot bucket={d.bucket} />
                <span className="font-medium text-slate-800 max-w-[200px] truncate" title={d.item}>{d.item}</span>
                {d.owner && <span className="text-slate-400 flex-shrink-0">· {d.owner}</span>}
                <StatusPill status={d.status} dueDate={null} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gantt table */}
      <div
        className="overflow-auto rounded-lg border border-slate-200 bg-white"
        style={{ maxHeight: 'calc(100vh - 270px)' }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            width: LEFT_TOTAL + ganttW,
          }}
        >
          <colgroup>
            {LEFT_COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
            {WEEKS.map((_, i) => <col key={i} style={{ width: WEEK_W }} />)}
          </colgroup>

          {/* ── Header ── */}
          <thead>
            <tr style={{ height: 36 }}>
              {LEFT_COLS.map((col, i) => (
                <th
                  key={col.key}
                  style={stickyHead(LEFT_OFFSETS[i], i === LEFT_COLS.length - 1)}
                  className="px-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
              {WEEKS.map((week, i) => (
                <th
                  key={i}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: i === todayWeekIdx ? '#fef2f2' : '#f8fafc',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #f1f5f9',
                    textAlign: 'center',
                  }}
                  className="text-xs font-normal text-slate-400 whitespace-nowrap"
                >
                  {weekLabel(week)}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Rows ── */}
          <tbody>
            {rows.map(d => {
              const isPast = d.due_date
                ? new Date(d.due_date + 'T00:00:00') < TODAY
                : false
              const barColor = CAT[getCategory(d)].color
              const bg = isPast ? '#f8fafc' : 'white'

              const x1 = dateToX(d.approval_date)
              const x2 = dateToX(d.due_date)

              // Full bar only when both dates present
              const hasBar = x1 !== null && x2 !== null
              const barL = hasBar ? Math.max(0, Math.min(x1!, x2!)) : null
              const barR = hasBar ? Math.min(ganttW, Math.max(x1!, x2!)) : null
              const barW = barL !== null && barR !== null ? Math.max(barR - barL, 2) : 0

              const d1Visible = x1 !== null && x1 >= -2 && x1 <= ganttW + 2
              const d2Visible = x2 !== null && x2 >= -2 && x2 <= ganttW + 2

              return (
                <tr
                  key={d.id}
                  style={{ height: 36, opacity: isPast ? 0.42 : 1 }}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  {/* Flag */}
                  <td style={stickyCell(LEFT_OFFSETS[0], false, bg)} className="px-1 text-center text-xs">
                    {d.is_critical && '🚩'}
                  </td>

                  {/* Item */}
                  <td style={stickyCell(LEFT_OFFSETS[1], false, bg)} className="px-2 py-1 text-sm font-medium text-slate-800">
                    <span className="block truncate" title={d.item}>{d.item}</span>
                  </td>

                  {/* Owner */}
                  <td style={stickyCell(LEFT_OFFSETS[2], false, bg)} className="px-2 text-xs text-slate-600 whitespace-nowrap overflow-hidden">
                    <span className="block truncate">{d.owner ?? '—'}</span>
                  </td>

                  {/* Approval date */}
                  <td style={stickyCell(LEFT_OFFSETS[3], false, bg)} className="px-2 text-xs text-slate-600 whitespace-nowrap">
                    {formatDate(d.approval_date)}
                  </td>

                  {/* Due date */}
                  <td style={stickyCell(LEFT_OFFSETS[4], false, bg)} className="px-2 text-xs text-slate-600 whitespace-nowrap">
                    {formatDate(d.due_date)}
                  </td>

                  {/* Status */}
                  <td style={stickyCell(LEFT_OFFSETS[5], true, bg)} className="px-2">
                    <StatusPill status={d.status} dueDate={d.due_date} />
                  </td>

                  {/* ── Timeline cell ── */}
                  <td
                    colSpan={TOTAL_WEEKS}
                    style={{
                      position: 'relative',
                      padding: 0,
                      height: 36,
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {/* Week grid lines */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                      {WEEKS.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: WEEK_W,
                            flexShrink: 0,
                            height: '100%',
                            borderRight: '1px solid #f1f5f9',
                            background: i === todayWeekIdx ? 'rgba(254,226,226,0.35)' : 'transparent',
                          }}
                        />
                      ))}
                    </div>

                    {/* Today line */}
                    {todayX >= 0 && todayX <= ganttW && (
                      <div
                        style={{
                          position: 'absolute',
                          left: todayX,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: 'rgba(239,68,68,0.8)',
                          zIndex: 4,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* Bar (only when both dates present) */}
                    {hasBar && barW > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: barL!,
                          width: barW,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          height: 10,
                          background: barColor,
                          borderRadius: 5,
                          zIndex: 3,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* ◆ Approval date marker */}
                    {d1Visible && (
                      <span
                        style={{
                          position: 'absolute',
                          left: x1!,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: 10,
                          color: barColor,
                          zIndex: 5,
                          lineHeight: 1,
                          pointerEvents: 'none',
                        }}
                      >◆</span>
                    )}

                    {/* ■ Due date marker */}
                    {d2Visible && (
                      <span
                        style={{
                          position: 'absolute',
                          left: x2!,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: 11,
                          color: barColor,
                          zIndex: 5,
                          lineHeight: 1,
                          pointerEvents: 'none',
                        }}
                      >■</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
