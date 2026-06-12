'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Decision } from '@/types'

export default function DecisionsTab() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDecisions = useCallback(async () => {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .order('resolved', { ascending: true })
      .order('id', { ascending: true })
    if (!error && data) setDecisions(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDecisions()
    const channel = supabase
      .channel('decisions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, fetchDecisions)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchDecisions])

  const toggleResolved = async (id: number, current: boolean) => {
    await supabase.from('decisions').update({ resolved: !current }).eq('id', id)
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, resolved: !current } : d))
  }

  const open = decisions.filter(d => !d.resolved)
  const resolved = decisions.filter(d => d.resolved)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  const DecisionCard = ({ d }: { d: Decision }) => (
    <div className={`bg-white border rounded-lg p-4 transition-all ${d.resolved ? 'border-slate-100 opacity-60' : 'border-slate-200 shadow-sm'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => toggleResolved(d.id, d.resolved)}
          className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
            d.resolved
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 hover:border-emerald-400'
          }`}
          title={d.resolved ? 'Mark unresolved' : 'Mark resolved'}
        >
          {d.resolved && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <span className="text-xs font-mono text-slate-400 mr-2">#{d.id}</span>
              <span className={`font-semibold text-slate-900 ${d.resolved ? 'line-through text-slate-400' : ''}`}>
                {d.decision}
              </span>
            </div>
            {d.resolved && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                Resolved
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
            {d.deadline && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-xs">Deadline:</span>
                <span className="text-slate-700 font-medium text-xs">{d.deadline}</span>
              </div>
            )}
            {d.owner && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-xs">Owner:</span>
                <span className="text-slate-700 text-xs">{d.owner}</span>
              </div>
            )}
          </div>
          {d.notes && (
            <p className="mt-2 text-xs text-slate-500 border-t border-slate-50 pt-2">{d.notes}</p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-slate-900">Open Decisions</h2>
          <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">{open.length}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {open.map(d => <DecisionCard key={d.id} d={d} />)}
          {open.length === 0 && <p className="text-slate-400 text-sm italic">All decisions resolved!</p>}
        </div>
      </div>

      {resolved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-slate-500">Resolved</h2>
            <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">{resolved.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {resolved.map(d => <DecisionCard key={d.id} d={d} />)}
          </div>
        </div>
      )}
    </div>
  )
}
