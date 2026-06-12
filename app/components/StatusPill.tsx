'use client'

import { computePillStatus, PILL_CONFIG } from '@/lib/utils'
import type { StatusValue } from '@/types'

interface Props {
  status: StatusValue
  dueDate: string | null
}

export default function StatusPill({ status, dueDate }: Props) {
  const pill = computePillStatus(status, dueDate)
  const config = PILL_CONFIG[pill]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  )
}
