'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { computePillStatus, PILL_CONFIG, STATUS_LABELS, formatDate, formatCurrency } from '@/lib/utils'
import { BUCKET_MAP, BUCKETS } from '@/data/workstreams'
import StatusPill from './StatusPill'
import type { Deadline, StatusValue, PillStatus } from '@/types'

export default function DeadlinesTab() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [owners, setOwners] = useState<string[]>([])
  const [editingOwner, setEditingOwner] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  // Team manager UI
  const [showTeamManager, setShowTeamManager] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingName, setAddingName] = useState(false)
  const newNameInputRef = useRef<HTMLInputElement>(null)

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

  const fetchOwners = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('name')
      .order('sort_order', { ascending: true })
    if (!error && data) setOwners(data.map(r => r.name))
  }, [])

  useEffect(() => {
    fetchDeadlines()
    fetchOwners()

    const deadlineChannel = supabase
      .channel('deadlines-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, fetchDeadlines)
      .subscribe()

    const teamChannel = supabase
      .channel('team-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, fetchOwners)
      .subscribe()

    return () => {
      supabase.removeChannel(deadlineChannel)
      supabase.removeChannel(teamChannel)
    }
  }, [fetchDeadlines, fetchOwners])

  const deleteDeadline = async (id: string, item: string) => {
    if (!confirm(`Delete "${item}"? This cannot be undone.`)) return
    await supabase.from('deadlines').delete().eq('id', id)
    setDeadlines(prev => prev.filter(d => d.id !== id))
  }

  const updateField = async (id: string, field: 'owner' | 'status', value: string) => {
    await supabase.from('deadlines').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
    if (field === 'owner') setEditingOwner(null)
    if (field === 'status') setEditingStatus(null)
  }

  const addOwner = async () => {
    const name = newName.trim()
    if (!name) return
    setAddingName(true)
    const maxOrder = owners.length
    const { error } = await supabase
      .from('team_members')
      .insert({ name, sort_order: maxOrder + 1 })
    if (!error) {
      setNewName('')
      await fetchOwners()
    }
    setAddingName(false)
    newNameInputRef.current?.focus()
  }

  const removeOwner = async (name: string) => {
    await supabase.from('team_members').delete().eq('name', name)
    await fetchOwners()
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

  const OwnerSelect = ({ id, currentOwner, mobile }: { id: string; currentOwner: string | null; mobile?: boolean }) => (
    <select
      autoFocus
      className={`border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white ${mobile ? 'text-xs' : 'text-sm'}`}
      defaultValue={currentOwner || ''}
      onChange={e => updateField(id, 'owner', e.target.value)}
      onBlur={() => setEditingOwner(null)}
    >
      <option value="">— unassigned —</option>
      {owners.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

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
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
          >
            <option value="">All owners</option>
            <option value="__unassigned">Unassigned</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
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

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">{filtered.length} of {deadlines.length}</span>
            <button
              className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${showTeamManager ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}
              onClick={() => setShowTeamManager(v => !v)}
            >
              Manage team
            </button>
          </div>
        </div>

        {/* Team manager — inline, only when open */}
        {showTeamManager && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-2">Owner options shown in all dropdowns. Changes sync for everyone immediately.</p>
            <div className="flex flex-wrap gap-2 items-center">
              {owners.map(name => (
                <span key={name} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-2.5 py-1 rounded-full">
                  {name}
                  <button
                    onClick={() => removeOwner(name)}
                    className="text-slate-400 hover:text-red-500 transition-colors ml-0.5 text-xs leading-none"
                    title={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <form
                onSubmit={e => { e.preventDefault(); addOwner() }}
                className="flex items-center gap-1.5"
              >
                <input
                  ref={newNameInputRef}
                  type="text"
                  placeholder="Add name…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="text-sm border border-slate-200 rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button
                  type="submit"
                  disabled={!newName.trim() || addingName}
                  className="text-sm bg-slate-800 text-white px-2.5 py-1 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </form>
            </div>
          </div>
        )}
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
                      <OwnerSelect id={d.id} currentOwner={d.owner} />
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
                    <div className="flex items-center gap-2">
                      {d.notes && (
                        <button
                          onClick={() => toggleNotes(d.id)}
                          className="text-slate-400 hover:text-slate-700"
                          title={expandedNotes.has(d.id) ? 'Hide notes' : 'Show notes'}
                        >
                          {expandedNotes.has(d.id) ? '▲' : '▼'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteDeadline(d.id, d.item)}
                        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete row"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </button>
                    </div>
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
                  <OwnerSelect id={d.id} currentOwner={d.owner} mobile />
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
            <div className="flex justify-end border-t border-slate-100 pt-2">
              <button
                onClick={() => deleteDeadline(d.id, d.item)}
                className="text-slate-300 hover:text-red-500 transition-colors"
                title="Delete row"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No items match the current filters.</div>
        )}
      </div>
    </div>
  )
}
