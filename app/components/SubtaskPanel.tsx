'use client'

import { useState } from 'react'
import type { Subtask } from '@/types'
import type { SubtaskUpdate } from '@/lib/useDeadlines'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

interface Props {
  deadlineId: string
  subtasks: Subtask[]
  owners: string[]
  onAdd: (deadlineId: string, title: string) => Promise<void>
  onUpdate: (id: string, updates: SubtaskUpdate) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function SubtaskPanel({ deadlineId, subtasks, owners, onAdd, onUpdate, onDelete }: Props) {
  const [newTitle, setNewTitle] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    await onAdd(deadlineId, title)
    setNewTitle('')
  }

  return (
    <div className="space-y-1.5">
      {subtasks.map(sub => (
        <div key={sub.id} className="flex items-center gap-2 group/sub">
          <input
            type="checkbox"
            checked={sub.done}
            onChange={e => onUpdate(sub.id, { done: e.target.checked })}
            className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 flex-shrink-0 cursor-pointer"
          />
          <span className={`text-sm flex-1 min-w-0 ${sub.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
            {sub.title}
          </span>
          {owners.length > 0 && (
            <select
              value={sub.owner ?? ''}
              onChange={e => onUpdate(sub.id, { owner: e.target.value || null })}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300 max-w-[90px] flex-shrink-0"
            >
              <option value="">—</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          <button
            onClick={() => onDelete(sub.id)}
            className="opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
            title="Delete subtask"
          >
            <TrashIcon />
          </button>
        </div>
      ))}

      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-0.5">
        <span className="text-slate-300 text-xs flex-shrink-0 w-4 text-center">+</span>
        <input
          type="text"
          placeholder="Add subtask…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          className="text-sm border-b border-slate-200 focus:border-slate-400 outline-none py-0.5 flex-1 min-w-0 placeholder-slate-300 bg-transparent"
        />
        {newTitle.trim() && (
          <button type="submit" className="text-xs font-medium text-slate-500 hover:text-slate-900 flex-shrink-0 transition-colors">
            Add
          </button>
        )}
      </form>
    </div>
  )
}
