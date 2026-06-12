'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const DeadlinesTab = dynamic(() => import('./components/DeadlinesTab'), { ssr: false })
const WorkstreamsTab = dynamic(() => import('./components/WorkstreamsTab'), { ssr: false })
const GanttTab = dynamic(() => import('./components/GanttTab'), { ssr: false })
const DecisionsTab = dynamic(() => import('./components/DecisionsTab'), { ssr: false })
const ReferenceTab = dynamic(() => import('./components/ReferenceTab'), { ssr: false })

const TABS = [
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'workstreams', label: 'Workstreams' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'reference', label: 'Reference' },
] as const

type TabId = typeof TABS[number]['id']

// Days until Oct 6 from today (June 12, 2026)
const SHOW_DATE = new Date('2026-10-06')
const TODAY = new Date('2026-06-12')
const DAYS_UNTIL = Math.ceil((SHOW_DATE.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('deadlines')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="font-bold text-white tracking-tight">ResultStack</div>
              <span className="text-slate-500">·</span>
              <div className="text-slate-300 text-sm">NACS 2026 Booth</div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="text-slate-400">C6059 · Las Vegas · Oct 6–9</div>
              <span className="ml-3 bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full text-xs font-medium">
                {DAYS_UNTIL}d to show
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'deadlines' && <DeadlinesTab />}
        {activeTab === 'workstreams' && <WorkstreamsTab />}
        {activeTab === 'gantt' && <GanttTab />}
        {activeTab === 'decisions' && <DecisionsTab />}
        {activeTab === 'reference' && <ReferenceTab />}
      </main>
    </div>
  )
}
