import type { PillStatus, StatusValue } from '@/types'

const TODAY = new Date('2026-06-12')

export function computePillStatus(
  status: StatusValue,
  dueDate: string | null
): PillStatus {
  if (status === 'done') return 'done'
  if (status === 'na') return 'na'

  if (!dueDate) return 'tbd'

  const due = new Date(dueDate)
  const diffDays = Math.ceil((due.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'passed'
  if (diffDays <= 14) return 'urgent'
  if (diffDays <= 45) return 'soon'
  return 'upcoming'
}

export const PILL_CONFIG: Record<PillStatus, { label: string; className: string }> = {
  done: { label: 'Done', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  na: { label: 'N/A', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  passed: { label: 'Passed', className: 'bg-red-100 text-red-700 border border-red-200' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700 border border-red-200' },
  soon: { label: 'Soon', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  upcoming: { label: 'Upcoming', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  tbd: { label: 'No date set', className: 'bg-slate-100 text-slate-400 border border-slate-200' },
}

export const STATUS_LABELS: Record<StatusValue, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
  na: 'N/A',
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return ''
  return `$${amount.toLocaleString()}`
}
