'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { BUCKETS } from '@/data/workstreams'
import type { Deadline, Subtask, StatusValue } from '@/types'

const WS_TO_BUCKET: Record<number, number> = {}
BUCKETS.forEach(b => b.workstreams.forEach(w => { WS_TO_BUCKET[w.id] = b.id }))

export type DeadlineUpdate = Partial<Omit<Deadline, 'id' | 'updated_at'>>
export type SubtaskUpdate = Partial<Pick<Subtask, 'title' | 'done' | 'owner'>>

export function useDeadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [owners, setOwners] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [dlRes, stRes, tmRes] = await Promise.all([
      supabase.from('deadlines').select('*')
        .order('is_critical', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('subtasks').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('team_members').select('name')
        .order('sort_order', { ascending: true })
        .order('name',       { ascending: true }),
    ])
    if (dlRes.data) setDeadlines(dlRes.data)
    if (stRes.data) setSubtasks(stRes.data)
    if (tmRes.data) setOwners(tmRes.data.map((m: { name: string }) => m.name))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channels = [
      supabase.channel('hook-deadlines')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, fetchAll)
        .subscribe(),
      supabase.channel('hook-subtasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, fetchAll)
        .subscribe(),
      supabase.channel('hook-team')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, fetchAll)
        .subscribe(),
    ]
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [fetchAll])

  const updateDeadline = async (id: string, updates: DeadlineUpdate) => {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
    if (updates.workstream !== undefined) {
      payload.bucket = WS_TO_BUCKET[updates.workstream] ?? 1
    }
    await supabase.from('deadlines').update(payload).eq('id', id)
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, ...payload } : d))
  }

  const addDeadline = async (data: DeadlineUpdate): Promise<Deadline | null> => {
    const wsId = data.workstream ?? 1
    const row = {
      item: data.item ?? '',
      type: data.type ?? 'Vendor Deadline',
      workstream: wsId,
      bucket: WS_TO_BUCKET[wsId] ?? 1,
      status: (data.status ?? 'not_started') as StatusValue,
      is_critical: data.is_critical ?? false,
      due_date: data.due_date || null,
      approval_date: data.approval_date || null,
      owner: data.owner || null,
      amount: data.amount ?? null,
      notes: data.notes || null,
    }
    const { data: inserted, error } = await supabase.from('deadlines').insert(row).select().single()
    if (inserted && !error) {
      setDeadlines(prev =>
        [...prev, inserted].sort((a, b) => {
          if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        })
      )
      return inserted
    }
    return null
  }

  const deleteDeadline = async (id: string, item: string): Promise<boolean> => {
    if (!confirm(`Delete "${item}"? This cannot be undone.`)) return false
    await supabase.from('deadlines').delete().eq('id', id)
    setDeadlines(prev => prev.filter(d => d.id !== id))
    setSubtasks(prev => prev.filter(s => s.deadline_id !== id))
    return true
  }

  const addSubtask = async (deadlineId: string, title: string) => {
    const sortOrder = subtasks.filter(s => s.deadline_id === deadlineId).length + 1
    const { data } = await supabase.from('subtasks')
      .insert({ deadline_id: deadlineId, title, done: false, sort_order: sortOrder })
      .select().single()
    if (data) setSubtasks(prev => [...prev, data])
  }

  const updateSubtask = async (id: string, updates: SubtaskUpdate) => {
    await supabase.from('subtasks').update(updates).eq('id', id)
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const deleteSubtask = async (id: string) => {
    await supabase.from('subtasks').delete().eq('id', id)
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }

  const subtasksFor = (deadlineId: string) =>
    subtasks.filter(s => s.deadline_id === deadlineId)

  const addOwner = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || owners.includes(trimmed)) return
    setOwners(prev => [...prev, trimmed])
    await supabase.from('team_members').insert({ name: trimmed })
  }

  const removeOwner = async (name: string) => {
    setOwners(prev => prev.filter(o => o !== name))
    await supabase.from('team_members').delete().eq('name', name)
  }

  return {
    deadlines, subtasks, owners, loading,
    updateDeadline, addDeadline, deleteDeadline,
    addSubtask, updateSubtask, deleteSubtask,
    subtasksFor,
    addOwner, removeOwner,
  }
}
