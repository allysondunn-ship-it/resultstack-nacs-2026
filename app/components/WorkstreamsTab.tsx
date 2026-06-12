'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useDeadlines } from '@/lib/useDeadlines'
import { BUCKETS } from '@/data/workstreams'
import { formatDate, formatCurrency, STATUS_LABELS } from '@/lib/utils'
import StatusPill from './StatusPill'
import SubtaskPanel from './SubtaskPanel'
import type { StatusValue } from '@/types'

export default function WorkstreamsTab() {
  const {
    deadlines, owners, loading,
    updateDeadline,
    addSubtask, updateSubtask, deleteSubtask,
    subtasksFor,
  } = useDeadlines()

  // Workstream notes (local to this tab — stored in workstream_notes table)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [noteStatus, setNoteStatus] = useState<Record<number, 'saving' | 'saved'>>({})
  const noteTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const [openBuckets, setOpenBuckets] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [openWorkstreams, setOpenWorkstreams] = useState<Set<number>>(new Set())

  // Inline editing: status and owner per row
  type EditField = 'status' | 'owner'
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditField } | null>(null)

  // Fetch workstream notes
  const fetchNotes = useCallback(async () => {
    const { data } = await supabase.from('workstream_notes').select('*')
    if (data) {
      const map: Record<number, string> = {}
      data.forEach((r: { workstream_id: number; notes: string }) => { map[r.workstream_id] = r.notes })
      setNotes(map)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
    const channel = supabase.channel('ws-notes-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workstream_notes' }, (payload) => {
        const r = payload.new as { workstream_id: number; notes: string }
        if (r) setNotes(prev => ({ ...prev, [r.workstream_id]: r.notes }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchNotes])

  const handleNoteChange = (wsId: number, value: string) => {
    setNotes(prev => ({ ...prev, [wsId]: value }))
    clearTimeout(noteTimers.current[wsId])
    noteTimers.current[wsId] = setTimeout(async () => {
      setNoteStatus(prev => ({ ...prev, [wsId]: 'saving' }))
      await supabase.from('workstream_notes').upsert(
        { workstream_id: wsId, notes: value, updated_at: new Date().toISOString() },
        { onConflict: 'workstream_id' }
      )
      setNoteStatus(prev => ({ ...prev, [wsId]: 'saved' }))
      setTimeout(() => setNoteStatus(prev => { const n = { ...prev }; delete n[wsId]; return n }), 2000)
    }, 800)
  }

  const commitEdit = async (id: string, field: EditField, value: string) => {
    setEditingCell(null)
    if (field === 'status') await updateDeadline(id, { status: value as StatusValue })
    else if (field === 'owner') await updateDeadline(id, { owner: value || null })
  }

  const toggleBucket = (id: number) => setOpenBuckets(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleWorkstream = (id: number) => setOpenWorkstreams(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {BUCKETS.map(bucket => {
        const bucketOpen = openBuckets.has(bucket.id)
        const bucketDeadlines = deadlines.filter(d => d.bucket === bucket.id)

        return (
          <div key={bucket.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              onClick={() => toggleBucket(bucket.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded font-mono">B{bucket.id}</span>
                <span className="font-semibold">{bucket.name}</span>
                <span className="text-slate-400 text-sm">{bucketDeadlines.length} items</span>
              </div>
              <span className="text-slate-400 text-sm">{bucketOpen ? '▲' : '▼'}</span>
            </button>

            {bucketOpen && (
              <div className="divide-y divide-slate-100">
                {bucket.workstreams.map(ws => {
                  const wsOpen = openWorkstreams.has(ws.id)
                  const wsDeadlines = deadlines.filter(d => d.workstream === ws.id)
                  const doneCount = wsDeadlines.filter(d => d.status === 'done').length

                  return (
                    <div key={ws.id}>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        onClick={() => toggleWorkstream(ws.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">W{ws.id}</span>
                          <span className="font-medium text-slate-800 text-sm">{ws.name}</span>
                          <span className="text-xs text-slate-400">{doneCount}/{wsDeadlines.length} done</span>
                        </div>
                        <span className="text-slate-400 text-sm">{wsOpen ? '▲' : '▼'}</span>
                      </button>

                      {wsOpen && (
                        <div className="px-4 pb-5 space-y-5">

                          {/* Deadlines for this workstream */}
                          {wsDeadlines.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No deadlines in this workstream yet. Add one from the Deadlines tab.</p>
                          ) : (
                            <div className="space-y-3">
                              {wsDeadlines.map(d => {
                                const subs = subtasksFor(d.id)
                                return (
                                  <div key={d.id} className={`border rounded-lg p-3 ${d.is_critical ? 'border-red-200 bg-red-50/20' : 'border-slate-200 bg-white'}`}>
                                    {/* Header row */}
                                    <div className="flex items-start gap-2 flex-wrap">
                                      {d.is_critical && <span className="text-xs flex-shrink-0">🚩</span>}
                                      {/* Status (editable) */}
                                      {editingCell?.id === d.id && editingCell.field === 'status' ? (
                                        <select autoFocus
                                          className="text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none bg-white"
                                          defaultValue={d.status}
                                          onChange={e => commitEdit(d.id, 'status', e.target.value)}
                                          onBlur={() => setEditingCell(null)}>
                                          {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <button onClick={() => setEditingCell({ id: d.id, field: 'status' })} title="Click to change status">
                                          <StatusPill status={d.status} dueDate={d.due_date} />
                                        </button>
                                      )}
                                      <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(d.due_date)}</span>
                                      <span className="font-medium text-slate-900 text-sm flex-1">{d.item}</span>
                                      {/* Owner (editable) */}
                                      {editingCell?.id === d.id && editingCell.field === 'owner' ? (
                                        <select autoFocus
                                          className="text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none bg-white ml-auto"
                                          defaultValue={d.owner ?? ''}
                                          onChange={e => commitEdit(d.id, 'owner', e.target.value)}
                                          onBlur={() => setEditingCell(null)}>
                                          <option value="">— unassigned —</option>
                                          {owners.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      ) : (
                                        <button
                                          className="text-xs text-slate-500 hover:underline ml-auto flex-shrink-0"
                                          onClick={() => setEditingCell({ id: d.id, field: 'owner' })}
                                          title="Click to change owner"
                                        >
                                          {d.owner || <span className="text-slate-300 italic">assign</span>}
                                        </button>
                                      )}
                                      {d.amount != null && (
                                        <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{formatCurrency(d.amount)}</span>
                                      )}
                                    </div>

                                    {/* Subtasks — always visible when they exist, or add prompt */}
                                    <div className="mt-2.5 ml-1 border-t border-slate-100 pt-2.5">
                                      <SubtaskPanel
                                        deadlineId={d.id}
                                        subtasks={subs}
                                        owners={owners}
                                        onAdd={addSubtask}
                                        onUpdate={updateSubtask}
                                        onDelete={deleteSubtask}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Notes for this workstream */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Workstream Notes</span>
                              {noteStatus[ws.id] === 'saving' && <span className="text-xs text-slate-400">Saving…</span>}
                              {noteStatus[ws.id] === 'saved' && <span className="text-xs text-emerald-500">Saved</span>}
                            </div>
                            <textarea
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y min-h-[72px] placeholder-slate-300"
                              placeholder="Notes, links, decisions, context for this workstream…"
                              value={notes[ws.id] ?? ''}
                              onChange={e => handleNoteChange(ws.id, e.target.value)}
                            />
                          </div>

                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
