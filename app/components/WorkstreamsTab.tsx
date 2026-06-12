'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BUCKETS } from '@/data/workstreams'
import { formatDate, formatCurrency, STATUS_LABELS } from '@/lib/utils'
import StatusPill from './StatusPill'
import type { Deadline } from '@/types'

export default function WorkstreamsTab() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [openBuckets, setOpenBuckets] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [openWorkstreams, setOpenWorkstreams] = useState<Set<number>>(new Set())

  const fetchDeadlines = useCallback(async () => {
    const { data, error } = await supabase.from('deadlines').select('*').order('due_date', { ascending: true })
    if (!error && data) setDeadlines(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDeadlines()
    const channel = supabase
      .channel('ws-deadlines')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, fetchDeadlines)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchDeadlines])

  const toggleBucket = (id: number) => {
    setOpenBuckets(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleWorkstream = (id: number) => {
    setOpenWorkstreams(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
                          <span className="text-xs text-slate-400">
                            {doneCount}/{wsDeadlines.length} done
                          </span>
                        </div>
                        <span className="text-slate-400 text-sm">{wsOpen ? '▲' : '▼'}</span>
                      </button>

                      {wsOpen && (
                        <div className="px-4 pb-4">
                          {wsDeadlines.length === 0 ? (
                            <p className="text-sm text-slate-400 italic py-2">No items in this workstream.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    <th className="text-left py-2 pr-3 w-4"></th>
                                    <th className="text-left py-2 pr-3">Status</th>
                                    <th className="text-left py-2 pr-3">Due Date</th>
                                    <th className="text-left py-2 pr-3">Item</th>
                                    <th className="text-left py-2 pr-3">Owner</th>
                                    <th className="text-right py-2">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {wsDeadlines.map(d => (
                                    <tr key={d.id} className={d.is_critical ? 'bg-red-50/30' : ''}>
                                      <td className="py-2 pr-3 text-center">
                                        {d.is_critical && <span title="Critical" className="text-xs">🚩</span>}
                                      </td>
                                      <td className="py-2 pr-3">
                                        <StatusPill status={d.status} dueDate={d.due_date} />
                                      </td>
                                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{formatDate(d.due_date)}</td>
                                      <td className="py-2 pr-3 text-slate-800 font-medium">{d.item}</td>
                                      <td className="py-2 pr-3 text-slate-600">{d.owner || <span className="text-slate-300 italic">—</span>}</td>
                                      <td className="py-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(d.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
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
