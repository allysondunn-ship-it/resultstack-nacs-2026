'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useDeadlines } from '@/lib/useDeadlines'
import { formatDate } from '@/lib/utils'
import StatusPill from './StatusPill'
import { BUCKET_COLORS, BUCKETS } from '@/data/workstreams'

// ── Timeline constants ────────────────────────────────────────────────────────
const GANTT_START = new Date('2026-03-30T00:00:00')
const TODAY       = new Date('2026-06-12T00:00:00')
const WEEK_W      = 44
const TOTAL_WEEKS = 31
const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7
const ganttW      = TOTAL_WEEKS * WEEK_W

const WEEKS: Date[] = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
  const d = new Date(GANTT_START)
  d.setDate(d.getDate() + i * 7)
  return d
})

const todayX       = ((TODAY.getTime() - GANTT_START.getTime()) / MS_PER_WEEK) * WEEK_W
const todayWeekIdx = Math.floor((TODAY.getTime() - GANTT_START.getTime()) / MS_PER_WEEK)

function dateToX(s: string | null): number | null {
  if (!s) return null
  return ((new Date(s + 'T00:00:00').getTime() - GANTT_START.getTime()) / MS_PER_WEEK) * WEEK_W
}

function weekLabel(d: Date) { return `${d.getMonth() + 1}/${d.getDate()}` }

// ── Type display (matches DeadlinesTab) ───────────────────────────────────────
const TYPE_SHORT: Record<string, string> = {
  'Vendor Deadline': 'Vendor',
  'Internal Action': 'Internal',
  'Milestone':       'Milestone',
}
const TYPE_COLOR: Record<string, string> = {
  'Vendor Deadline': '#b45309',
  'Internal Action': '#0369a1',
  'Milestone':       '#047857',
}

// ── Fixed (non-resizable) flag column ─────────────────────────────────────────
const FLAG_W = 28

// ── Resizable column definitions ──────────────────────────────────────────────
type ResizableKey = 'item' | 'type' | 'workstream' | 'owner' | 'appr' | 'due' | 'status'

const COL_LABELS: Record<ResizableKey, string> = {
  item: 'Item', type: 'Type', workstream: 'WS',
  owner: 'Owner', appr: 'Appr. Date', due: 'Due Date', status: 'Status',
}
const COL_ORDER: ResizableKey[] = ['item', 'type', 'workstream', 'owner', 'appr', 'due', 'status']

const DEFAULT_WIDTHS: Record<ResizableKey, number> = {
  item: 200, type: 80, workstream: 56, owner: 80,
  appr: 85, due: 85, status: 90,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function BucketDot({ bucket }: { bucket: number }) {
  return (
    <span
      style={{ background: BUCKET_COLORS[bucket] ?? '#94a3b8' }}
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
    />
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GanttTab() {
  const { deadlines, loading } = useDeadlines()

  // ── Resizable column widths ──────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<ResizableKey, number>>(DEFAULT_WIDTHS)
  const colWidthsRef = useRef(colWidths)
  useEffect(() => { colWidthsRef.current = colWidths }, [colWidths])

  const leftOffsets = useMemo(() => {
    const offsets: Record<string, number> = { flag: 0 }
    let cum = FLAG_W
    COL_ORDER.forEach(key => { offsets[key] = cum; cum += colWidths[key] })
    return offsets
  }, [colWidths])

  const leftTotal = FLAG_W + COL_ORDER.reduce((s, k) => s + colWidths[k], 0)

  const startResize = useCallback((e: React.MouseEvent, key: ResizableKey) => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = colWidthsRef.current[key]
    const onMove = (ev: MouseEvent) => {
      setColWidths(prev => ({ ...prev, [key]: Math.max(44, startWidth + ev.clientX - startX) }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // ── Data ─────────────────────────────────────────────────────────────────────
  const rows = useMemo(() =>
    [...deadlines]
      .filter(d => d.due_date !== null)
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  , [deadlines])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  // ── Inline style factories (use leftOffsets from closure) ─────────────────────
  const headStyle = (left: number, isLast: boolean): CSSProperties => ({
    position: 'sticky', left, top: 0, zIndex: 30,
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    borderRight: isLast ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
  })

  const cellStyle = (left: number, isLast: boolean, bg: string): CSSProperties => ({
    position: 'sticky', left, zIndex: 10, background: bg,
    borderBottom: '1px solid #f1f5f9',
    borderRight: isLast ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
    overflow: 'hidden',
  })

  return (
    <div className="space-y-3">

      {/* Legend — 5 buckets */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 items-center bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700">
        {BUCKETS.map(b => (
          <span key={b.id} className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 28, height: 8, background: BUCKET_COLORS[b.id], borderRadius: 4 }} />
            {b.name}
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
            width: leftTotal + ganttW,
          }}
        >
          <colgroup>
            <col style={{ width: FLAG_W }} />
            {COL_ORDER.map(k => <col key={k} style={{ width: colWidths[k] }} />)}
            {WEEKS.map((_, i) => <col key={i} style={{ width: WEEK_W }} />)}
          </colgroup>

          {/* ── Header ── */}
          <thead>
            <tr style={{ height: 36 }}>
              {/* Flag — fixed, no drag handle */}
              <th style={headStyle(0, false)} />

              {/* Resizable left columns */}
              {COL_ORDER.map((key, i) => {
                const isLast = i === COL_ORDER.length - 1
                return (
                  <th
                    key={key}
                    style={headStyle(leftOffsets[key], isLast)}
                    className="px-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap select-none"
                  >
                    <span className="block overflow-hidden text-ellipsis">{COL_LABELS[key]}</span>
                    {/* Drag handle */}
                    <div
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 5, cursor: 'col-resize', zIndex: 2,
                      }}
                      onMouseDown={e => startResize(e, key)}
                    />
                  </th>
                )
              })}

              {/* Week headers */}
              {WEEKS.map((week, i) => (
                <th
                  key={i}
                  style={{
                    position: 'sticky', top: 0, zIndex: 20,
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
              const isPast   = new Date(d.due_date! + 'T00:00:00') < TODAY
              const barColor = BUCKET_COLORS[d.bucket] ?? '#94a3b8'
              const bg       = isPast ? '#f8fafc' : 'white'

              const x1 = dateToX(d.approval_date)
              const x2 = dateToX(d.due_date)

              const hasBar = x1 !== null && x2 !== null
              const barL   = hasBar ? Math.max(0, Math.min(x1!, x2!)) : null
              const barR   = hasBar ? Math.min(ganttW, Math.max(x1!, x2!)) : null
              const barW   = barL !== null && barR !== null ? Math.max(barR - barL, 2) : 0

              const d1Vis = x1 !== null && x1 >= -2 && x1 <= ganttW + 2
              const d2Vis = x2 !== null && x2 >= -2 && x2 <= ganttW + 2

              return (
                <tr
                  key={d.id}
                  style={{ height: 36, opacity: isPast ? 0.42 : 1 }}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  {/* Flag */}
                  <td style={cellStyle(0, false, bg)} className="px-1 text-center text-xs">
                    {d.is_critical && '🚩'}
                  </td>

                  {/* Item */}
                  <td style={cellStyle(leftOffsets.item, false, bg)} className="px-2 py-1 text-sm font-medium text-slate-800">
                    <span className="block truncate" title={d.item}>{d.item}</span>
                  </td>

                  {/* Type */}
                  <td style={cellStyle(leftOffsets.type, false, bg)} className="px-2 py-1">
                    <span
                      className="block truncate text-xs font-medium"
                      style={{ color: TYPE_COLOR[d.type] ?? '#64748b' }}
                      title={d.type}
                    >
                      {TYPE_SHORT[d.type] ?? d.type}
                    </span>
                  </td>

                  {/* Workstream */}
                  <td style={cellStyle(leftOffsets.workstream, false, bg)} className="px-2 py-1">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-1 py-0.5 rounded whitespace-nowrap">
                      <BucketDot bucket={d.bucket} />
                      W{d.workstream}
                    </span>
                  </td>

                  {/* Owner */}
                  <td style={cellStyle(leftOffsets.owner, false, bg)} className="px-2 py-1 text-xs text-slate-600">
                    <span className="block truncate">{d.owner ?? '—'}</span>
                  </td>

                  {/* Approval date */}
                  <td style={cellStyle(leftOffsets.appr, false, bg)} className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">
                    {formatDate(d.approval_date)}
                  </td>

                  {/* Due date */}
                  <td style={cellStyle(leftOffsets.due, false, bg)} className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">
                    {formatDate(d.due_date)}
                  </td>

                  {/* Status */}
                  <td style={cellStyle(leftOffsets.status, true, bg)} className="px-2 py-1">
                    <StatusPill status={d.status} dueDate={d.due_date} />
                  </td>

                  {/* ── Timeline ── */}
                  <td colSpan={TOTAL_WEEKS} style={{ position: 'relative', padding: 0, height: 36, borderBottom: '1px solid #f1f5f9' }}>

                    {/* Week grid lines */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                      {WEEKS.map((_, i) => (
                        <div key={i} style={{
                          width: WEEK_W, flexShrink: 0, height: '100%',
                          borderRight: '1px solid #f1f5f9',
                          background: i === todayWeekIdx ? 'rgba(254,226,226,0.35)' : 'transparent',
                        }} />
                      ))}
                    </div>

                    {/* Today line */}
                    {todayX >= 0 && todayX <= ganttW && (
                      <div style={{
                        position: 'absolute', left: todayX, top: 0, bottom: 0,
                        width: 2, background: 'rgba(239,68,68,0.8)', zIndex: 4, pointerEvents: 'none',
                      }} />
                    )}

                    {/* Bar */}
                    {hasBar && barW > 0 && (
                      <div style={{
                        position: 'absolute', left: barL!, width: barW,
                        top: '50%', transform: 'translateY(-50%)',
                        height: 10, background: barColor, borderRadius: 5,
                        zIndex: 3, pointerEvents: 'none',
                      }} />
                    )}

                    {/* ◆ Approval marker */}
                    {d1Vis && (
                      <span style={{
                        position: 'absolute', left: x1!, top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 10, color: barColor, zIndex: 5, lineHeight: 1, pointerEvents: 'none',
                      }}>◆</span>
                    )}

                    {/* ■ Due date marker */}
                    {d2Vis && (
                      <span style={{
                        position: 'absolute', left: x2!, top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 11, color: barColor, zIndex: 5, lineHeight: 1, pointerEvents: 'none',
                      }}>■</span>
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
