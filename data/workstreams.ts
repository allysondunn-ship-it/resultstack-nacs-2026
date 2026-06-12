import type { Bucket } from '@/types'

export const BUCKETS: Bucket[] = [
  {
    id: 1,
    name: 'The Physical Show',
    workstreams: [
      { id: 1, name: 'NACS Logistics & Vendor Orders', bucket: 1 },
      { id: 2, name: 'Booth Build', bucket: 1 },
      { id: 3, name: 'Staffing, Travel & On-Site Ops', bucket: 1 },
    ],
  },
  {
    id: 2,
    name: 'The Marketing Engine',
    workstreams: [
      { id: 4, name: 'Targeting & List Building', bucket: 2 },
      { id: 5, name: 'Content, Collateral & Lead Magnets', bucket: 2 },
      { id: 6, name: 'Outbound & Pre-Show Demand Gen', bucket: 2 },
      { id: 7, name: 'Meeting Booking', bucket: 2 },
    ],
  },
  {
    id: 3,
    name: 'The Show Itself',
    workstreams: [
      { id: 8, name: 'Demo & In-Booth Experience', bucket: 3 },
      { id: 9, name: 'At-Show Execution & Off-Site Events', bucket: 3 },
    ],
  },
  {
    id: 4,
    name: 'After the Show',
    workstreams: [
      { id: 10, name: 'Post-Show Follow-Up', bucket: 4 },
      { id: 11, name: 'Performance Tracking', bucket: 4 },
    ],
  },
  {
    id: 5,
    name: 'Operating System',
    workstreams: [
      { id: 12, name: 'Budget, Cadence & Internal PM', bucket: 5 },
    ],
  },
]

export const WORKSTREAM_MAP: Record<number, string> = Object.fromEntries(
  BUCKETS.flatMap(b => b.workstreams.map(w => [w.id, w.name]))
)

export const BUCKET_MAP: Record<number, string> = Object.fromEntries(
  BUCKETS.map(b => [b.id, b.name])
)
