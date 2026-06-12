'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { computePillStatus, PILL_CONFIG, STATUS_LABELS, formatDate, formatCurrency } from '@/lib/utils'
import { WORKSTREAM_MAP, BUCKET_MAP, BUCKETS } from '@/data/workstreams'
import StatusPill from './StatusPill'
import type { Deadline, StatusValue, PillStatus } from '@/types'

const ALL_OWNERS = ['Ally', 'Ben', 'Chas', 'Adam', 'DeWayne', 'Ray', 'John', 'Mickey']

export default function DeadlinesTab() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOwner, setEditingOwner] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  // Filters
  const [filterOwner, setFilterOwner] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWorkstream, setFilterWorkstream] = useState('')
  const [filterBucket, setFilterBucket] = useState('')
  const [criticalOnly, setCriticalOnly] = useState(false)

  const fetchDeadlines = useCallback(async () => {
    const { data, error } = await supabase
      .from('deadlines')
      .select('*')
      .order('is_critical', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
    if (!error && data) setDeadlines(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDeadlines()

    const channel = supabase
      .channel('deadlines-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, () => {
        fetchDeadlines()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchDeadlines])

  const updateField = async (id: string, field: 'owner' | 'status', value: string) => {
    await supabase.from('deadlines').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
    if (field === 'owner') setEditingOwner(null)
    if (field === 'status') setEditingStatus(null)
  }

  const filtered = useMemo(() => {
    return deadlines.filter(d => {
      if (criticalOnly && !d.is_critical) return false
      if (filterOwner === '__unassigned') {
        if (d.owner && d.owner.trim() !== '') return false
      } else if (filterOwner && d.owner !== filterOwner) return false
      if (filterStatus && d.status !== filterStatus) return false
      if (filterWorkstream && d.workstream !== parseInt(filterWorkstream)) return false
      if (filterBucket && d.bucket !== parseInt(filterBucket)) return false
      return true
    })
  }, [deadlines, criticalOnly, filterOwner, filterStatus, filterWorkstream, filterBucket])

  const summary = useMemo(() => {
    const counts: Record<PillStatus, number> = { passed: 0, urgent: 0, soon: 0, upcoming: 0, done: 0, na: 0 }
    deadlines.forEach(d => {
      const pill = computePillStatus(d.status, d.due_date)
      counts[pill]++
    })
    return counts
  }, [deadlines])

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => {
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
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['passed', 'urgent', 'soon', 'upcoming'] as PillStatus[]).map(pill => (
          <div key={pill} className={`rounded-lg p-3 ${PILL_CONFIG[pill].className} flex flex-col`}>
            <span className="text-2xl font-bold">{summary[pill]}</span>
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">{PILL_CONFIG[pill].label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-lg px-4 py-3">
        <select
          className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={filterOwner}
          onChange={e => setFilterOwner(e.target.value)}
        >
          <option value="">All owners</option>
          <option value="__unassigned">Unassigned</option>
          {ALL_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={filterBucket}
          onChange={e => { setFilterBucket(e.target.value); setFilterWorkstream('') }}
        >
          <option value="">All buckets</option>
          {Object.entries(BUCKET_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select
          className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={filterWorkstream}
          onChange={e => setFilterWorkstream(e.target.value)}
        >
          <option value="">All workstreams</option>
          {BUCKETS.flatMap(b => b.workstreams).map(w => (
            <option key={w.id} value={w.id}>W{w.id} {w.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={e => setCriticalOnly(e.target.checked)}
            className="rounded border-slate-300 text-red-500 focus:ring-red-400"
          />
          Critical only
        </label>

        {(filterOwner || filterStatus || filterWorkstream || filterBucket || criticalOnly) && (
          <button
            className="text-xs text-slate-400 hover:text-slate-700 underline"
            onClick={() => { setFilterOwner(''); setFilterStatus(''); setFilterWorkstream(''); setFilterBucket(''); setCriticalOnly(false) }}
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">{filtered.length} of {deadlines.length}</span>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2.5 w-6"></th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-left px-3 py-2.5">Due Date</th>
              <th className="text-left px-3 py-2.5">Item</th>
              <th className="text-left px-3 py-2.5">Workstream</th>
              <th className="text-left px-3 py-2.5">Owner</th>
              <th className="text-right px-3 py-2.5">Amount</th>
              <th className="text-left px-3 py-2.5">Progress</th>
              <th className="text-left px-3 py-2.5 w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(d => (
              <>
                <tr
                  key={d.id}
                  className={`group hover:bg-slate-50 transition-colors ${d.is_critical ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-3 py-3 text-center">
                    {d.is_critical && <span title="Critical">🚩</span>}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={d.status} dueDate={d.due_date} />
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(d.due_date)}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900 max-w-xs">
                    {d.item}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                      W{d.workstream}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {editingOwner === d.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          autoFocus
                          className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                          defaultValue={d.owner || ''}
                          onChange={e => updateField(d.id, 'owner', e.target.value)}
                          onBlur={() => setEditingOwner(null)}
                        >
                          <option value="">— unassigned —</option>
                          {ALL_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ) : (
                      <button
                        className="text-slate-700 hover:text-slate-900 hover:underline cursor-pointer text-left"
                        onClick={() => setEditingOwner(d.id)}
                        title="Click to edit owner"
                      >
                        {d.owner || <span className="text-slate-300 italic">assign owner</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                    {formatCurrency(d.amount)}
                  </td>
                  <td className="px-3 py-3">
                    {editingStatus === d.id ? (
                      <select
                        autoFocus
                        className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                        defaultValue={d.status}
                        onChange={e => updateField(d.id, 'status', e.target.value as StatusValue)}
                        onBlur={() => setEditingStatus(null)}
                      >
                        {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                        onClick={() => setEditingStatus(d.id)}
                        title="Click to edit status"
                      >
                        {STATUS_LABELS[d.status]}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {d.notes && (
                      <button
                        onClick={() => toggleNotes(d.id)}
                        className="text-slate-400 hover:text-slate-700"
                        title={expandedNotes.has(d.id) ? 'Hide notes' : 'Show notes'}
                      >
                        {expandedNotes.has(d.id) ? '▲' : '▼'}
                      </button>
                    )}
                  </td>
                </tr>
                {d.notes && expandedNotes.has(d.id) && (
                  <tr key={`${d.id}-notes`} className="bg-slate-50">
                    <td colSpan={9} className="px-6 py-2 text-sm text-slate-600 italic border-b border-slate-100">
                      {d.notes}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">No items match the current filters.</div>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map(d => (
          <div key={d.id} className={`bg-white border rounded-lg p-4 space-y-2 ${d.is_critical ? 'border-red-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {d.is_critical && <span className="text-sm">🚩</span>}
                <StatusPill status={d.status} dueDate={d.due_date} />
                <span className="text-xs text-slate-400">{formatDate(d.due_date)}</span>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">W{d.workstream}</span>
            </div>
            <p className="font-medium text-slate-900 text-sm">{d.item}</p>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-xs">Owner:</span>
                {editingOwner === d.id ? (
                  <select
                    autoFocus
                    className="text-sm border border-slate-300 rounded px-1 py-0.5 focus:outline-none"
                    defaultValue={d.owner || ''}
                    onChange={e => updateField(d.id, 'owner', e.target.value)}
                    onBlur={() => setEditingOwner(null)}
                  >
                    <option value="">— unassigned —</option>
                    {ALL_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <button className="text-slate-700 hover:underline text-xs" onClick={() => setEditingOwner(d.id)}>
                    {d.owner || <span className="text-slate-300 italic">assign</span>}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-xs">Status:</span>
                {editingStatus === d.id ? (
                  <select
                    autoFocus
                    className="text-sm border border-slate-300 rounded px-1 py-0.5 focus:outline-none"
                    defaultValue={d.status}
                    onChange={e => updateField(d.id, 'status', e.target.value as StatusValue)}
                    onBlur={() => setEditingStatus(null)}
                  >
                    {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <button className="text-slate-700 hover:underline text-xs" onClick={() => setEditingStatus(d.id)}>
                    {STATUS_LABELS[d.status]}
                  </button>
                )}
              </div>
              {d.amount && <span className="text-xs font-medium text-slate-700">{formatCurrency(d.amount)}</span>}
            </div>
            {d.notes && (
              <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">{d.notes}</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No items match the current filters.</div>
        )}
      </div>
    </div>
  )
}
