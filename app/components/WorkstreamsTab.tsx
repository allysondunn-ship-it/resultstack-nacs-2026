'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BUCKETS } from '@/data/workstreams'
import { formatDate, formatCurrency } from '@/lib/utils'
import StatusPill from './StatusPill'
import type { Deadline, WorkstreamItem, WorkstreamSubitem } from '@/types'

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className ?? 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className ?? 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function WorkstreamsTab() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [items, setItems] = useState<WorkstreamItem[]>([])
  const [subitems, setSubitems] = useState<WorkstreamSubitem[]>([])
  const [loading, setLoading] = useState(true)

  const [openBuckets, setOpenBuckets] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [openWorkstreams, setOpenWorkstreams] = useState<Set<number>>(new Set())

  const [noteStatus, setNoteStatus] = useState<Record<number, 'saving' | 'saved'>>({})
  const noteTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const [newItemText, setNewItemText] = useState<Record<number, string>>({})
  const [newSubitemText, setNewSubitemText] = useState<Record<string, string>>({})

  const fetchAll = useCallback(async () => {
    const [dlRes, notesRes, itemsRes, subitemsRes] = await Promise.all([
      supabase.from('deadlines').select('*').order('due_date', { ascending: true }),
      supabase.from('workstream_notes').select('*'),
      supabase.from('workstream_items').select('*').order('sort_order').order('created_at'),
      supabase.from('workstream_subitems').select('*').order('sort_order').order('created_at'),
    ])
    if (dlRes.data) setDeadlines(dlRes.data)
    if (notesRes.data) {
      const map: Record<number, string> = {}
      notesRes.data.forEach(r => { map[r.workstream_id] = r.notes })
      setNotes(map)
    }
    if (itemsRes.data) setItems(itemsRes.data)
    if (subitemsRes.data) setSubitems(subitemsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    const channels = [
      supabase.channel('ws-deadlines')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, fetchAll)
        .subscribe(),
      supabase.channel('ws-notes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workstream_notes' }, (payload) => {
          const r = payload.new as { workstream_id: number; notes: string }
          setNotes(prev => ({ ...prev, [r.workstream_id]: r.notes }))
        })
        .subscribe(),
      supabase.channel('ws-items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workstream_items' }, fetchAll)
        .subscribe(),
      supabase.channel('ws-subitems')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workstream_subitems' }, fetchAll)
        .subscribe(),
    ]

    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [fetchAll])

  // Notes — debounced save, 800ms
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

  // Items
  const addItem = async (wsId: number) => {
    const text = (newItemText[wsId] ?? '').trim()
    if (!text) return
    const sort_order = items.filter(i => i.workstream_id === wsId).length + 1
    const { data } = await supabase
      .from('workstream_items')
      .insert({ workstream_id: wsId, text, sort_order })
      .select()
      .single()
    if (data) setItems(prev => [...prev, data])
    setNewItemText(prev => ({ ...prev, [wsId]: '' }))
  }

  const deleteItem = async (id: string, text: string) => {
    if (!confirm(`Delete "${text}"? Its subitems will also be removed.`)) return
    await supabase.from('workstream_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setSubitems(prev => prev.filter(s => s.item_id !== id))
  }

  // Subitems
  const addSubitem = async (itemId: string) => {
    const text = (newSubitemText[itemId] ?? '').trim()
    if (!text) return
    const sort_order = subitems.filter(s => s.item_id === itemId).length + 1
    const { data } = await supabase
      .from('workstream_subitems')
      .insert({ item_id: itemId, text, sort_order })
      .select()
      .single()
    if (data) setSubitems(prev => [...prev, data])
    setNewSubitemText(prev => ({ ...prev, [itemId]: '' }))
  }

  const deleteSubitem = async (id: string) => {
    await supabase.from('workstream_subitems').delete().eq('id', id)
    setSubitems(prev => prev.filter(s => s.id !== id))
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
                <span className="text-slate-400 text-sm">{bucketDeadlines.length} deadlines</span>
              </div>
              <span className="text-slate-400 text-sm">{bucketOpen ? '▲' : '▼'}</span>
            </button>

            {bucketOpen && (
              <div className="divide-y divide-slate-100">
                {bucket.workstreams.map(ws => {
                  const wsOpen = openWorkstreams.has(ws.id)
                  const wsDeadlines = deadlines.filter(d => d.workstream === ws.id)
                  const wsItems = items.filter(i => i.workstream_id === ws.id)
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
                          <span className="text-xs text-slate-400">{doneCount}/{wsDeadlines.length} deadlines done</span>
                          {wsItems.length > 0 && (
                            <span className="text-xs text-slate-400">&middot; {wsItems.length} item{wsItems.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <span className="text-slate-400 text-sm">{wsOpen ? '▲' : '▼'}</span>
                      </button>

                      {wsOpen && (
                        <div className="px-4 pb-5 space-y-5">

                          {/* Deadlines */}
                          {wsDeadlines.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Deadlines</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                      <th className="text-left py-1.5 pr-3 w-4"></th>
                                      <th className="text-left py-1.5 pr-3">Status</th>
                                      <th className="text-left py-1.5 pr-3">Due Date</th>
                                      <th className="text-left py-1.5 pr-3">Item</th>
                                      <th className="text-left py-1.5 pr-3">Owner</th>
                                      <th className="text-right py-1.5">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {wsDeadlines.map(d => (
                                      <tr key={d.id} className={d.is_critical ? 'bg-red-50/30' : ''}>
                                        <td className="py-2 pr-3 text-center">
                                          {d.is_critical && <span title="Critical" className="text-xs">🚩</span>}
                                        </td>
                                        <td className="py-2 pr-3"><StatusPill status={d.status} dueDate={d.due_date} /></td>
                                        <td className="py-2 pr-3 text-slate-500 whitespace-nowrap text-xs">{formatDate(d.due_date)}</td>
                                        <td className="py-2 pr-3 text-slate-800 font-medium">{d.item}</td>
                                        <td className="py-2 pr-3 text-slate-600">{d.owner || <span className="text-slate-300 italic">—</span>}</td>
                                        <td className="py-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(d.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notes</h4>
                              {noteStatus[ws.id] === 'saving' && <span className="text-xs text-slate-400">Saving…</span>}
                              {noteStatus[ws.id] === 'saved' && <span className="text-xs text-emerald-500">Saved</span>}
                            </div>
                            <textarea
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y min-h-[80px] text-slate-700 placeholder-slate-300"
                              placeholder="Add notes, links, context, decisions for this workstream…"
                              value={notes[ws.id] ?? ''}
                              onChange={e => handleNoteChange(ws.id, e.target.value)}
                            />
                          </div>

                          {/* Items */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Items</h4>
                            <div className="space-y-1">
                              {wsItems.map(item => {
                                const itemSubitems = subitems.filter(s => s.item_id === item.id)
                                return (
                                  <div key={item.id} className="group/item">
                                    {/* Item row */}
                                    <div className="flex items-start gap-2 py-1">
                                      <span className="text-slate-300 mt-1 text-xs flex-shrink-0">•</span>
                                      <span className="text-slate-800 text-sm flex-1">{item.text}</span>
                                      <button
                                        onClick={() => deleteItem(item.id, item.text)}
                                        className="flex-shrink-0 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100 mt-0.5"
                                        title="Delete item"
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>

                                    {/* Subitems */}
                                    <div className="ml-4 space-y-0.5">
                                      {itemSubitems.map(sub => (
                                        <div key={sub.id} className="group/sub flex items-start gap-2 py-0.5">
                                          <span className="text-slate-200 mt-1 text-xs flex-shrink-0">↳</span>
                                          <span className="text-slate-600 text-sm flex-1">{sub.text}</span>
                                          <button
                                            onClick={() => deleteSubitem(sub.id)}
                                            className="flex-shrink-0 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover/sub:opacity-100 mt-0.5"
                                            title="Delete subitem"
                                          >
                                            <TrashIcon />
                                          </button>
                                        </div>
                                      ))}

                                      {/* Add subitem */}
                                      <form
                                        onSubmit={e => { e.preventDefault(); addSubitem(item.id) }}
                                        className="flex items-center gap-1.5 pt-0.5"
                                      >
                                        <span className="text-slate-200 text-xs flex-shrink-0">↳</span>
                                        <input
                                          type="text"
                                          placeholder="Add subitem…"
                                          value={newSubitemText[item.id] ?? ''}
                                          onChange={e => setNewSubitemText(prev => ({ ...prev, [item.id]: e.target.value }))}
                                          className="text-sm border-b border-slate-200 focus:border-slate-400 outline-none px-1 py-0.5 flex-1 placeholder-slate-300 bg-transparent"
                                        />
                                        {(newSubitemText[item.id] ?? '').trim() && (
                                          <button
                                            type="submit"
                                            className="text-xs text-slate-500 hover:text-slate-800 flex-shrink-0"
                                          >
                                            <PlusIcon />
                                          </button>
                                        )}
                                      </form>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Add item */}
                              <form
                                onSubmit={e => { e.preventDefault(); addItem(ws.id) }}
                                className="flex items-center gap-2 pt-1"
                              >
                                <span className="text-slate-300 text-xs flex-shrink-0">•</span>
                                <input
                                  type="text"
                                  placeholder="Add item…"
                                  value={newItemText[ws.id] ?? ''}
                                  onChange={e => setNewItemText(prev => ({ ...prev, [ws.id]: e.target.value }))}
                                  className="text-sm border-b border-slate-200 focus:border-slate-400 outline-none px-1 py-0.5 flex-1 placeholder-slate-300 bg-transparent"
                                />
                                {(newItemText[ws.id] ?? '').trim() && (
                                  <button
                                    type="submit"
                                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 flex-shrink-0"
                                  >
                                    <PlusIcon /> Add
                                  </button>
                                )}
                              </form>
                            </div>
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
