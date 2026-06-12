export type StatusValue = 'not_started' | 'in_progress' | 'done' | 'na'

export interface Deadline {
  id: string
  due_date: string | null
  item: string
  workstream: number
  bucket: number
  owner: string | null
  amount: number | null
  status: StatusValue
  is_critical: boolean
  notes: string | null
  updated_at: string
}

export interface Decision {
  id: number
  decision: string
  deadline: string | null
  owner: string | null
  notes: string | null
  resolved: boolean
}

export type PillStatus = 'done' | 'na' | 'passed' | 'urgent' | 'soon' | 'upcoming'

export interface WorkstreamItem {
  id: string
  workstream_id: number
  text: string
  sort_order: number
  created_at: string
}

export interface WorkstreamSubitem {
  id: string
  item_id: string
  text: string
  sort_order: number
  created_at: string
}

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
