'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MARITZ_PRODUCTS, MARITZ_ADDONS, MARITZ_CONTACT,
  COX_PRODUCTS, COX_CONTACT,
  NACS_ADS,
  COLLATERAL_VENDORS,
  BOOTH_SPECS,
} from '@/data/reference'
import { supabase } from '@/lib/supabase'

type BudgetItem = { id: string; name: string; amount: number; created_at: string }

export default function ReferenceTab() {
  const [search, setSearch] = useState('')
  const [openSection, setOpenSection] = useState<string | null>(null)

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')

  const fetchBudgetItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) setBudgetItems(data)
  }, [])

  useEffect(() => {
    fetchBudgetItems()
    const channel = supabase
      .channel('budget-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_items' }, fetchBudgetItems)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchBudgetItems])

  const addBudgetItem = async () => {
    const parsed = parseFloat(newAmount)
    if (!newName.trim() || isNaN(parsed)) return
    await supabase.from('budget_items').insert({ name: newName.trim(), amount: parsed })
    setNewName('')
    setNewAmount('')
  }

  const deleteBudgetItem = async (id: string) => {
    await supabase.from('budget_items').delete().eq('id', id)
  }

  const budgetTotal = budgetItems.reduce((sum, item) => sum + item.amount, 0)

  const formatCurrency = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const s = search.toLowerCase()

  const matchText = (text: string) => !s || text.toLowerCase().includes(s)

  const toggleSection = (id: string) => {
    setOpenSection(prev => prev === id ? null : id)
  }

  const SectionHeader = ({ id, title, badge }: { id: string; title: string; badge?: string }) => (
    <button
      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border-b border-slate-200 transition-colors text-left"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-900">{title}</span>
        {badge && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{badge}</span>}
      </div>
      <span className="text-slate-400 text-sm">{openSection === id ? '▲' : '▼'}</span>
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        />
      </div>

      {/* Maritz Lead Retrieval */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="maritz" title="Maritz Lead Retrieval" badge="Decision #4 — Highest priority" />
        {openSection === 'maritz' && (
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <strong>Recommended: SWAP App Package $490</strong> — early-bird pricing ends July 28, 2026.
              Price steps to $540 by 9/8, then $590 after.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left py-2 pr-4">Product</th>
                    <th className="text-right py-2 pr-4">Thru 7/28</th>
                    <th className="text-right py-2 pr-4">Thru 9/8</th>
                    <th className="text-right py-2">After 9/8</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {MARITZ_PRODUCTS.filter(p => matchText(p.product)).map(p => (
                    <tr key={p.product} className={p.recommended ? 'bg-amber-50/50' : ''}>
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {p.product}
                        {p.recommended && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">★ Recommended</span>}
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold text-emerald-700">${p.early}</td>
                      <td className="py-2 pr-4 text-right text-slate-600">${p.mid}</td>
                      <td className="py-2 text-right text-slate-500">${p.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add-ons</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MARITZ_ADDONS.map(a => (
                  <div key={a.item} className="bg-slate-50 rounded p-2.5">
                    <div className="text-xs text-slate-500">{a.item}</div>
                    <div className="font-semibold text-slate-800">${a.price}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-slate-600 flex gap-4 flex-wrap">
              <a href={`mailto:${MARITZ_CONTACT.email}`} className="text-blue-600 hover:underline">{MARITZ_CONTACT.email}</a>
              <span>{MARITZ_CONTACT.phone}</span>
            </div>
          </div>
        )}
      </div>

      {/* Cox Internet */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="cox" title="Cox Internet — LVCC" badge="Advance rates end 9/7" />
        {openSection === 'cox' && (
          <div className="p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <strong>Budgeted at $1,500 ≈ Business Professional (advanced rate).</strong> Final decision pending demo bandwidth needs.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left py-2 pr-4">Product</th>
                    <th className="text-left py-2 pr-4">Speed / IPs</th>
                    <th className="text-right py-2 pr-4">Advanced (thru 9/7)</th>
                    <th className="text-right py-2">Standard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {COX_PRODUCTS.filter(p => matchText(p.product)).map(p => (
                    <tr key={p.product} className={p.budgeted ? 'bg-blue-50/40' : ''}>
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {p.product}
                        {p.budgeted && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Budgeted</span>}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 text-xs">{p.speed}</td>
                      <td className="py-2 pr-4 text-right font-semibold text-emerald-700">${p.advanced}</td>
                      <td className="py-2 text-right text-slate-500">${p.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 rounded p-3">{COX_CONTACT.notes}</div>
            <div className="text-sm text-slate-600 flex gap-4 flex-wrap">
              <a href={`mailto:${COX_CONTACT.email}`} className="text-blue-600 hover:underline">{COX_CONTACT.email}</a>
              <span>{COX_CONTACT.phone}</span>
            </div>
          </div>
        )}
      </div>

      {/* Freeman */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="freeman" title="Freeman — Booth Services" badge="Discount deadline 9/4" />
        {openSection === 'freeman' && (
          <div className="p-4 space-y-3 text-sm text-slate-700">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <p className="font-medium text-slate-900 mb-1">Note: Pricing is login-gated at freemanco.com</p>
              <p className="text-slate-600">Flooring (deadline 9/4), Furnishings (9/4), Electrical (9/4).</p>
              <p className="text-slate-500 italic mt-1">Hanging Signs deadline 8/14 — N/A for our 10x10 linear booth.</p>
            </div>
            <div className="flex gap-4 flex-wrap">
              <span className="font-medium">Phone:</span>
              <span>{BOOTH_SPECS.freeman.phone}</span>
              <span className="font-medium">Website:</span>
              <span className="text-blue-600">{BOOTH_SPECS.freeman.website}</span>
            </div>
          </div>
        )}
      </div>

      {/* NACS Advertising */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="ads" title="NACS Advertising Options" badge="Big budget decision — Decision #7" />
        {openSection === 'ads' && (
          <div className="p-4 space-y-5">
            {NACS_ADS.filter(cat => matchText(cat.category) || cat.options.some(o => matchText(o.option))).map(cat => (
              <div key={cat.category}>
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-slate-800">{cat.category}</h4>
                  {cat.deadlines.space && (
                    <span className="text-xs text-slate-400">Space close: {cat.deadlines.space}</span>
                  )}
                  {cat.deadlines.materials && (
                    <span className="text-xs text-slate-400">Materials: {cat.deadlines.materials}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {cat.options.filter(o => matchText(o.option)).map(o => (
                    <div key={o.option} className={`rounded-lg p-3 border ${('budgeted' in o && o.budgeted) ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-xs text-slate-500 mb-1">{o.option}</div>
                      <div className="font-bold text-slate-900">${o.rate.toLocaleString()}</div>
                      {'earlyRate' in o && typeof o.earlyRate === 'number' && (
                        <div className="text-xs text-emerald-600 font-medium">Early-bird: ${o.earlyRate.toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-3">
              💡 NACS Magazine from $1,785 unlocks 50% off Show Daily + Onsite Guide.
              Paid advertising ≥$5K earns 2027 priority points ($5K=2pts, $10K=5pts) — deadline Oct 31.
            </div>
          </div>
        )}
      </div>

      {/* Collateral Vendors */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="collateral" title="Booth Collateral Vendors" />
        {openSection === 'collateral' && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left py-2 pr-4">Item</th>
                    <th className="text-left py-2 pr-4">Vendor</th>
                    <th className="text-left py-2 pr-4">Lead Time</th>
                    <th className="text-left py-2">Budget Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {COLLATERAL_VENDORS.filter(v => matchText(v.item) || matchText(v.vendor)).map((v, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{v.item}</td>
                      <td className="py-2 pr-4 text-slate-600">{v.vendor}</td>
                      <td className="py-2 pr-4 text-slate-500 text-xs">{v.leadTime}</td>
                      <td className="py-2 text-slate-600">{v.budget}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Budget Builder */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="budget" title="Budget Builder" />
        {openSection === 'budget' && (
          <div className="p-4 space-y-3">
            {budgetItems.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No budget items yet — add one below.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {budgetItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 gap-3">
                    <span className="text-sm text-slate-800 flex-1 min-w-0 truncate">{item.name}</span>
                    <span className="text-sm font-medium text-slate-900 tabular-nums">{formatCurrency(item.amount)}</span>
                    <button
                      onClick={() => deleteBudgetItem(item.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors text-base leading-none flex-shrink-0"
                      title="Remove"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add row */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Item name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBudgetItem()}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <input
                type="number"
                placeholder="Amount"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBudgetItem()}
                className="w-28 px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                onClick={addBudgetItem}
                disabled={!newName.trim() || isNaN(parseFloat(newAmount))}
                className="px-3 py-1.5 text-sm font-medium bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-900 text-sm">Total</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">{formatCurrency(budgetTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Booth Specs */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <SectionHeader id="booth" title="Booth Specs & Rules" badge="C6059 · 10×10 Linear · Tech Zone" />
        {openSection === 'booth' && (
          <div className="p-4 space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Booth Details</h4>
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <div><span className="text-slate-400">Number:</span> <span className="font-semibold">{BOOTH_SPECS.boothNumber}</span></div>
                  <div><span className="text-slate-400">Size:</span> {BOOTH_SPECS.size}</div>
                  <div><span className="text-slate-400">Zone:</span> {BOOTH_SPECS.zone}</div>
                  <div><span className="text-slate-400">Back drape:</span> {BOOTH_SPECS.drape.back}</div>
                  <div><span className="text-slate-400">Side drape:</span> {BOOTH_SPECS.drape.sides}</div>
                  <div><span className="text-slate-400">Aisle:</span> {BOOTH_SPECS.drape.aisle}</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Rules</h4>
                <ul className="space-y-1.5">
                  {BOOTH_SPECS.rules.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-700">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-2">Budget Baseline</h4>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="space-y-1 mb-2">
                  {BOOTH_SPECS.budgetBaseline.breakdown.map(b => (
                    <div key={b.item} className="flex justify-between text-sm">
                      <span className="text-slate-600">{b.item}</span>
                      <span className="font-medium">${b.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total baseline</span>
                  <span>${BOOTH_SPECS.budgetBaseline.total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Excludes: {BOOTH_SPECS.budgetBaseline.excludes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
