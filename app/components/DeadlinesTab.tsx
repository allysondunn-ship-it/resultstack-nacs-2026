'use client'

import { useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useDeadlines } from '@/lib/useDeadlines'
import { computePillStatus, PILL_CONFIG, STATUS_LABELS, formatDate, formatCurrency } from '@/lib/utils'
import { BUCKETS, BUCKET_COLORS } from '@/data/workstreams'
import StatusPill from './StatusPill'
import SubtaskPanel from './SubtaskPanel'
import type { StatusValue, PillStatus, DeadlineType } from '@/types'

// ── Type field config ─────────────────────────────────────────────────────────
const DEADLINE_TYPES: DeadlineType[] = ['Vendor Deadline', 'Internal Action', 'Milestone']

const TYPE_STYLE: Record<DeadlineType, string> = {
  'Vendor Deadline': 'bg-amber-50 text-amber-700',
  'Internal Action': 'bg-sky-50 text-sky-700',
  'Milestone':       'bg-emerald-50 text-emerald-700',
}

const TYPE_SHORT: Record<DeadlineType, string> = {
  'Vendor Deadline': 'Vendor',
  'Internal Action': 'Internal',
  'Milestone':       'Milestone',
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

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

// ── Form default ──────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  item: '',
  type: 'Vendor Deadline' as DeadlineType,
  status: 'not_started' as StatusValue,
  due_date: '',
  approval_date: '',
  workstream: 1,
  owner: '',
  amount: '',
  category: '',
  is_critical: false,
  notes: '',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DeadlinesTab() {
  const {
    deadlines, owners, loading,
    updateDeadline, addDeadline, deleteDeadline,
    addSubtask, updateSubtask, deleteSubtask,
    subtasksFor,
  } = useDeadlines()

  type SortField = 'due_date' | 'approval_date' | 'item' | 'owner' | 'status' | 'amount' | 'type'
  const [sortField, setSortField] = useState<SortField>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const setSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  type EditField = 'item' | 'due_date' | 'approval_date' | 'status' | 'owner' | 'type'
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditField } | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({})
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [noteStatus, setNoteStatus] = useState<Record<string, 'saving' | 'saved'>>({})

  const [editingDetail, setEditingDetail] = useState<{ id: string; field: 'approval_date' | 'category' | 'amount' } | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [showTeamManager, setShowTeamManager] = useState(false)
  const [newName, setNewName] = useState('')
  const newNameInputRef = useRef<HTMLInputElement>(null)

  const [filterOwner, setFilterOwner] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterWorkstream, setFilterWorkstream] = useState('')
  const [filterBucket, setFilterBucket] = useState('')
  const [criticalOnly, setCriticalOnly] = useState(false)

  const hasActiveFilter = !!(filterOwner || filterStatus || filterType || filterWorkstream || filterBucket || criticalOnly)

  const filtered = useMemo(() => {
    const rows = deadlines.filter(d => {
      if (criticalOnly && !d.is_critical) return false
      if (filterOwner === '__unassigned') { if (d.owner?.trim()) return false }
      else if (filterOwner && d.owner !== filterOwner) return false
      if (filterStatus && d.status !== filterStatus) return false
      if (filterType && d.type !== filterType) return false
      if (filterWorkstream && d.workstream !== parseInt(filterWorkstream)) return false
      if (filterBucket && d.bucket !== parseInt(filterBucket)) return false
      return true
    })

    const cmp = (a: typeof rows[0], b: typeof rows[0]) => {
      if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1

      let av: string | number | null = null
      let bv: string | number | null = null
      if (sortField === 'due_date')           { av = a.due_date;                   bv = b.due_date }
      else if (sortField === 'approval_date') { av = a.approval_date;              bv = b.approval_date }
      else if (sortField === 'item')          { av = a.item.toLowerCase();         bv = b.item.toLowerCase() }
      else if (sortField === 'owner')         { av = a.owner?.toLowerCase() ?? null; bv = b.owner?.toLowerCase() ?? null }
      else if (sortField === 'status')        { av = a.status;                     bv = b.status }
      else if (sortField === 'amount')        { av = a.amount;                     bv = b.amount }
      else if (sortField === 'type')          { av = a.type;                       bv = b.type }

      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const result = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? result : -result
    }

    return [...rows].sort(cmp)
  }, [deadlines, criticalOnly, filterOwner, filterStatus, filterType, filterWorkstream, filterBucket, sortField, sortDir])

  const summary = useMemo(() => {
    const counts: Record<PillStatus, number> = { passed: 0, urgent: 0, soon: 0, upcoming: 0, done: 0, na: 0 }
    deadlines.forEach(d => counts[computePillStatus(d.status, d.due_date)]++)
    return counts
  }, [deadlines])

  const toggleRow = (id: string) => setExpandedRows(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const commitEdit = async (id: string, field: EditField, value: string) => {
    setEditingCell(null)
    if (field === 'status') await updateDeadline(id, { status: value as StatusValue })
    else if (field === 'type') await updateDeadline(id, { type: value as DeadlineType })
    else if (field === 'owner') await updateDeadline(id, { owner: value || null })
    else if (field === 'item') { if (value.trim()) await updateDeadline(id, { item: value.trim() }) }
    else if (field === 'due_date') await updateDeadline(id, { due_date: value || null })
    else if (field === 'approval_date') await updateDeadline(id, { approval_date: value || null })
  }

  const commitDetail = async (id: string, field: 'approval_date' | 'category' | 'amount', value: string) => {
    setEditingDetail(null)
    if (field === 'amount') await updateDeadline(id, { amount: value ? parseFloat(value) : null })
    else if (field === 'approval_date') await updateDeadline(id, { approval_date: value || null })
    else if (field === 'category') await updateDeadline(id, { category: value || null })
  }

  const handleNoteChange = (id: string, value: string) => {
    setLocalNotes(prev => ({ ...prev, [id]: value }))
    clearTimeout(noteTimers.current[id])
    noteTimers.current[id] = setTimeout(async () => {
      setNoteStatus(prev => ({ ...prev, [id]: 'saving' }))
      await updateDeadline(id, { notes: value || null })
      setNoteStatus(prev => ({ ...prev, [id]: 'saved' }))
      setTimeout(() => setNoteStatus(prev => { const n = { ...prev }; delete n[id]; return n }), 2000)
    }, 800)
  }

  const getNoteValue = (id: string, dbNotes: string | null) =>
    id in localNotes ? localNotes[id] : (dbNotes ?? '')

  const handleAddDeadline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.item.trim()) return
    setSaving(true)
    await addDeadline({
      item: form.item.trim(),
      type: form.type,
      status: form.status,
      due_date: form.due_date || null,
      approval_date: form.approval_date || null,
      workstream: form.workstream,
      owner: form.owner || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      category: form.category || null,
      is_critical: form.is_critical,
      notes: form.notes || null,
    })
    setForm(EMPTY_FORM)
    setShowAddForm(false)
    setSaving(false)
  }

  const addOwner = async () => {
    const name = newName.trim()
    if (!name) return
    await supabase.from('team_members').insert({ name, sort_order: owners.length + 1 })
    setNewName('')
    newNameInputRef.current?.focus()
  }
  const removeOwner = async (name: string) => {
    await supabase.from('team_members').delete().eq('name', name)
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

      {/* Filters + actions */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <select className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
            <option value="">All owners</option>
            <option value="__unassigned">Unassigned</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <select className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {DEADLINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={filterBucket} onChange={e => { setFilterBucket(e.target.value); setFilterWorkstream('') }}>
            <option value="">All buckets</option>
            {BUCKETS.map(b => <option key={b.id} value={b.id}>B{b.id} — {b.name}</option>)}
          </select>

          <select className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={filterWorkstream} onChange={e => setFilterWorkstream(e.target.value)}>
            <option value="">All workstreams</option>
            {BUCKETS.flatMap(b => b.workstreams).map(w => (
              <option key={w.id} value={w.id}>B{w.bucket} W{w.id} — {w.name}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={criticalOnly} onChange={e => setCriticalOnly(e.target.checked)}
              className="rounded border-slate-300 text-red-500 focus:ring-red-400" />
            Critical only
          </label>

          {hasActiveFilter && (
            <button className="text-xs text-slate-400 hover:text-slate-700 underline"
              onClick={() => { setFilterOwner(''); setFilterStatus(''); setFilterType(''); setFilterWorkstream(''); setFilterBucket(''); setCriticalOnly(false) }}>
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">{filtered.length} of {deadlines.length}</span>
            <button
              className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${showTeamManager ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}
              onClick={() => setShowTeamManager(v => !v)}>
              Manage team
            </button>
            <button
              className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${showAddForm ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setShowAddForm(v => !v)}>
              {showAddForm ? '✕ Cancel' : '+ Add Deadline'}
            </button>
          </div>
        </div>

        {/* Bucket legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-50 pt-2">
          {BUCKETS.map(b => (
            <span key={b.id} className="flex items-center gap-1.5 text-xs text-slate-400">
              <BucketDot bucket={b.id} />
              B{b.id} {b.name}
            </span>
          ))}
        </div>

        {/* Team manager */}
        {showTeamManager && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-2">Owner options synced for everyone.</p>
            <div className="flex flex-wrap gap-2 items-center">
              {owners.map(name => (
                <span key={name} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-2.5 py-1 rounded-full">
                  {name}
                  <button onClick={() => removeOwner(name)} className="text-slate-400 hover:text-red-500 transition-colors ml-0.5 text-xs">×</button>
                </span>
              ))}
              <form onSubmit={e => { e.preventDefault(); addOwner() }} className="flex items-center gap-1.5">
                <input ref={newNameInputRef} type="text" placeholder="Add name…" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="text-sm border border-slate-200 rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                <button type="submit" disabled={!newName.trim()}
                  className="text-sm bg-slate-800 text-white px-2.5 py-1 rounded hover:bg-slate-700 disabled:opacity-40 transition-colors">
                  Add
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Add Deadline form */}
      {showAddForm && (
        <form onSubmit={handleAddDeadline} className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-slate-900 text-sm">New Deadline</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Item name *</label>
              <input type="text" required value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                placeholder="What needs to happen?"
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DeadlineType }))}
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                {DEADLINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Payment, Submission…"
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Workstream</label>
              <select value={form.workstream} onChange={e => setForm(f => ({ ...f, workstream: parseInt(e.target.value) }))}
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                {BUCKETS.flatMap(b => b.workstreams).map(w => (
                  <option key={w.id} value={w.id}>B{w.bucket} W{w.id} — {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Owner</label>
              <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                <option value="">— unassigned —</option>
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusValue }))}
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Approval Date</label>
              <input type="date" value={form.approval_date} onChange={e => setForm(f => ({ ...f, approval_date: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any context, links, or reminders…"
              className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none h-16" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={form.is_critical} onChange={e => setForm(f => ({ ...f, is_critical: e.target.checked }))}
                className="rounded border-slate-300 text-red-500 focus:ring-red-400" />
              🚩 Mark as critical
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM) }}
                className="text-sm px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={!form.item.trim() || saving}
                className="text-sm px-4 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-40 transition-colors font-medium">
                {saving ? 'Saving…' : 'Add Deadline'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide select-none">
              <th className="px-3 py-2.5 w-5"></th>
              {([
                ['status', 'Status'],
                ['approval_date', 'Appr. Date'],
                ['due_date', 'Due Date'],
                ['item', 'Item'],
              ] as [SortField, string][]).map(([f, label]) => (
                <th key={f} className="text-left px-3 py-2.5">
                  <button className="flex items-center gap-1 hover:text-slate-800 transition-colors" onClick={() => setSort(f)}>
                    {label}
                    <span className="text-slate-300">{sortField === f ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </button>
                </th>
              ))}
              <th className="text-left px-3 py-2.5">W</th>
              <th className="text-left px-3 py-2.5">
                <button className="flex items-center gap-1 hover:text-slate-800 transition-colors" onClick={() => setSort('type')}>
                  Type <span className="text-slate-300">{sortField === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                </button>
              </th>
              <th className="text-left px-3 py-2.5">
                <button className="flex items-center gap-1 hover:text-slate-800 transition-colors" onClick={() => setSort('owner')}>
                  Owner <span className="text-slate-300">{sortField === 'owner' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                </button>
              </th>
              <th className="text-right px-3 py-2.5">
                <button className="flex items-center gap-1 hover:text-slate-800 transition-colors justify-end w-full" onClick={() => setSort('amount')}>
                  Amount <span className="text-slate-300">{sortField === 'amount' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                </button>
              </th>
              <th className="px-3 py-2.5 w-16"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filtered.map(d => {
              const subs = subtasksFor(d.id)
              const expanded = expandedRows.has(d.id)
              return (
                <>
                  <tr key={d.id} className={`group hover:bg-slate-50 transition-colors ${d.is_critical ? 'bg-red-50/30' : ''}`}>

                    {/* Flag */}
                    <td className="px-3 py-3 text-center text-sm">
                      {d.is_critical && '🚩'}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      {editingCell?.id === d.id && editingCell.field === 'status' ? (
                        <select autoFocus
                          className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                          defaultValue={d.status}
                          onChange={e => commitEdit(d.id, 'status', e.target.value)}
                          onBlur={() => setEditingCell(null)}>
                          {(Object.entries(STATUS_LABELS) as [StatusValue, string][]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <button onClick={() => setEditingCell({ id: d.id, field: 'status' })} title="Click to edit">
                          <StatusPill status={d.status} dueDate={d.due_date} />
                        </button>
                      )}
                    </td>

                    {/* Approval date */}
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {editingCell?.id === d.id && editingCell.field === 'approval_date' ? (
                        <input autoFocus type="date"
                          className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          defaultValue={d.approval_date ?? ''}
                          onChange={e => commitEdit(d.id, 'approval_date', e.target.value)}
                          onBlur={() => setEditingCell(null)} />
                      ) : (
                        <button className="hover:underline text-left" onClick={() => setEditingCell({ id: d.id, field: 'approval_date' })} title="Click to edit">
                          {formatDate(d.approval_date)}
                        </button>
                      )}
                    </td>

                    {/* Due date */}
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {editingCell?.id === d.id && editingCell.field === 'due_date' ? (
                        <input autoFocus type="date"
                          className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          defaultValue={d.due_date ?? ''}
                          onChange={e => commitEdit(d.id, 'due_date', e.target.value)}
                          onBlur={() => setEditingCell(null)} />
                      ) : (
                        <button className="hover:underline text-left" onClick={() => setEditingCell({ id: d.id, field: 'due_date' })} title="Click to edit">
                          {formatDate(d.due_date)}
                        </button>
                      )}
                    </td>

                    {/* Item */}
                    <td className="px-3 py-3 font-medium text-slate-900 max-w-xs">
                      {editingCell?.id === d.id && editingCell.field === 'item' ? (
                        <input autoFocus type="text"
                          className="w-full text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          defaultValue={d.item}
                          onBlur={e => commitEdit(d.id, 'item', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(d.id, 'item', (e.target as HTMLInputElement).value) }} />
                      ) : (
                        <button className="text-left hover:underline w-full" onClick={() => setEditingCell({ id: d.id, field: 'item' })} title="Click to edit">
                          {d.item}
                        </button>
                      )}
                    </td>

                    {/* Workstream tag with bucket dot */}
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                        <BucketDot bucket={d.bucket} />
                        W{d.workstream}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-3 py-3">
                      {editingCell?.id === d.id && editingCell.field === 'type' ? (
                        <select autoFocus
                          className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                          defaultValue={d.type}
                          onChange={e => commitEdit(d.id, 'type', e.target.value)}
                          onBlur={() => setEditingCell(null)}>
                          {DEADLINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <button className="text-left" onClick={() => setEditingCell({ id: d.id, field: 'type' })} title="Click to edit">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_STYLE[d.type] ?? 'bg-slate-50 text-slate-600'}`}>
                            {TYPE_SHORT[d.type] ?? d.type}
                          </span>
                        </button>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="px-3 py-3">
                      {editingCell?.id === d.id && editingCell.field === 'owner' ? (
                        <select autoFocus
                          className="text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                          defaultValue={d.owner ?? ''}
                          onChange={e => commitEdit(d.id, 'owner', e.target.value)}
                          onBlur={() => setEditingCell(null)}>
                          <option value="">— unassigned —</option>
                          {owners.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <button className="text-slate-700 hover:underline text-left" onClick={() => setEditingCell({ id: d.id, field: 'owner' })} title="Click to edit">
                          {d.owner || <span className="text-slate-300 italic">assign</span>}
                        </button>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                      {formatCurrency(d.amount)}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => toggleRow(d.id)}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${expanded ? 'bg-slate-100 border-slate-200 text-slate-700' : 'border-transparent text-slate-400 hover:border-slate-200 hover:text-slate-700'}`}
                          title={expanded ? 'Collapse' : 'Notes & subtasks'}>
                          {subs.length > 0 && !expanded
                            ? <span className="text-xs font-medium text-slate-500">{subs.length}↓</span>
                            : <span>{expanded ? '▲' : '▼'}</span>}
                        </button>
                        <button onClick={() => deleteDeadline(d.id, d.item)}
                          className="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete">
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded panel */}
                  {expanded && (
                    <tr key={`${d.id}-exp`} className="bg-slate-50/60">
                      <td colSpan={10} className="px-6 py-4">
                        <div className="grid gap-5 sm:grid-cols-2">
                          {/* Left: notes + details */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notes</span>
                              {noteStatus[d.id] === 'saving' && <span className="text-xs text-slate-400">Saving…</span>}
                              {noteStatus[d.id] === 'saved' && <span className="text-xs text-emerald-500">Saved</span>}
                            </div>
                            <textarea
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y min-h-[72px] placeholder-slate-300 bg-white"
                              placeholder="Notes…"
                              value={getNoteValue(d.id, d.notes)}
                              onChange={e => handleNoteChange(d.id, e.target.value)}
                            />
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <span className="block text-xs text-slate-400 mb-0.5">Amount</span>
                                {editingDetail?.id === d.id && editingDetail.field === 'amount' ? (
                                  <input autoFocus type="number" min="0" step="0.01"
                                    className="w-full text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none"
                                    defaultValue={d.amount ?? ''}
                                    onBlur={e => commitDetail(d.id, 'amount', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitDetail(d.id, 'amount', (e.target as HTMLInputElement).value) }} />
                                ) : (
                                  <button className="text-sm text-slate-700 hover:underline" onClick={() => setEditingDetail({ id: d.id, field: 'amount' })}>
                                    {d.amount != null ? formatCurrency(d.amount) : <span className="text-slate-300 italic">—</span>}
                                  </button>
                                )}
                              </div>
                              <div>
                                <span className="block text-xs text-slate-400 mb-0.5">Category</span>
                                {editingDetail?.id === d.id && editingDetail.field === 'category' ? (
                                  <input autoFocus type="text"
                                    className="w-full text-sm border border-slate-300 rounded px-1.5 py-1 focus:outline-none"
                                    defaultValue={d.category ?? ''}
                                    onBlur={e => commitDetail(d.id, 'category', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitDetail(d.id, 'category', (e.target as HTMLInputElement).value) }} />
                                ) : (
                                  <button className="text-sm text-slate-700 hover:underline" onClick={() => setEditingDetail({ id: d.id, field: 'category' })}>
                                    {d.category || <span className="text-slate-300 italic">—</span>}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: subtasks */}
                          <div>
                            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                              Subtasks {subs.length > 0 && <span className="font-normal normal-case">({subs.filter(s => s.done).length}/{subs.length} done)</span>}
                            </span>
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
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">No items match the current filters.</div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(d => {
          const subs = subtasksFor(d.id)
          const expanded = expandedRows.has(d.id)
          return (
            <div key={d.id} className={`bg-white border rounded-lg p-4 space-y-2.5 ${d.is_critical ? 'border-red-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {d.is_critical && <span>🚩</span>}
                  <StatusPill status={d.status} dueDate={d.due_date} />
                  <span className="text-xs text-slate-400">{formatDate(d.due_date)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_STYLE[d.type] ?? 'bg-slate-50 text-slate-600'}`}>
                    {TYPE_SHORT[d.type] ?? d.type}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                  <BucketDot bucket={d.bucket} />
                  W{d.workstream}
                </span>
              </div>
              <p className="font-medium text-slate-900 text-sm">{d.item}</p>
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="text-slate-400">Owner: <span className="text-slate-700">{d.owner || '—'}</span></span>
                {d.amount != null && <span className="font-medium text-slate-700">{formatCurrency(d.amount)}</span>}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <button onClick={() => toggleRow(d.id)} className="text-xs text-slate-500 hover:text-slate-700">
                  {subs.length > 0 ? `${subs.filter(s => s.done).length}/${subs.length} subtasks` : 'Add subtasks'} {expanded ? '▲' : '▼'}
                </button>
                <button onClick={() => deleteDeadline(d.id, d.item)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <TrashIcon />
                </button>
              </div>
              {expanded && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  {d.notes && <p className="text-xs text-slate-500 italic">{d.notes}</p>}
                  <SubtaskPanel
                    deadlineId={d.id}
                    subtasks={subs}
                    owners={owners}
                    onAdd={addSubtask}
                    onUpdate={updateSubtask}
                    onDelete={deleteSubtask}
                  />
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No items match the current filters.</div>
        )}
      </div>

    </div>
  )
}
