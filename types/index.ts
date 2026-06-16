export type StatusValue = 'not_started' | 'in_progress' | 'done' | 'na'
export type DeadlineType = 'Vendor Deadline' | 'Internal Action' | 'Milestone'

export interface Deadline {
  id: string
  due_date: string | null
  approval_date: string | null
  item: string
  type: DeadlineType
  workstream: number
  bucket: number
  owner: string | null
  amount: number | null
  status: StatusValue
  is_critical: boolean
  committed: boolean
  notes: string | null
  updated_at: string
}

export interface Subtask {
  id: string
  deadline_id: string
  title: string
  done: boolean
  owner: string | null
  sort_order: number
  created_at: string
}

export interface Decision {
  id: number
  decision: string
  deadline: string | null
  owner: string | null
  notes: string | null
  resolved: boolean
}

export type PillStatus = 'done' | 'na' | 'passed' | 'urgent' | 'soon' | 'upcoming' | 'tbd'

export interface Workstream {
  id: number
  name: string
  bucket: number
}

export interface Bucket {
  id: number
  name: string
  workstreams: Workstream[]
}
