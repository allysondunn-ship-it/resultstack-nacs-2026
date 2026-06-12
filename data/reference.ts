export const MARITZ_PRODUCTS = [
  {
    product: 'SWAP App Package (3 activations, your devices)',
    early: 490,
    mid: 540,
    late: 590,
    recommended: true,
  },
  {
    product: 'SWAP Handheld Scanner (Freeman rental)',
    early: 430,
    mid: 490,
    late: 515,
    recommended: false,
  },
  {
    product: 'SWAP Tablet Rental',
    early: 490,
    mid: 540,
    late: 590,
    recommended: false,
  },
]

export const MARITZ_ADDONS = [
  { item: 'Extra activation', price: 149 },
  { item: 'Bluetooth printer', price: '100–150' },
  { item: 'Custom qualifiers', price: 99 },
  { item: 'Booth delivery', price: 150 },
]

export const MARITZ_CONTACT = {
  email: 'ExhibitorServices@maritz.com',
  phone: '877-623-3487',
}

export const COX_PRODUCTS = [
  {
    product: 'Business Starter',
    speed: '3 Mbps / 3 IP',
    advanced: 500,
    standard: 600,
  },
  {
    product: 'Business Select',
    speed: '10 Mbps / 10 IP',
    advanced: 750,
    standard: 900,
  },
  {
    product: 'Business Professional',
    speed: '20 Mbps / 20 IP',
    advanced: 1200,
    standard: 1440,
    budgeted: true,
  },
  {
    product: 'Wi-Fi Hotspot',
    speed: '5 Mbps / 10 users',
    advanced: 1750,
    standard: 2100,
  },
]

export const COX_CONTACT = {
  email: 'lvcc.orders@cox.com',
  phone: '855-519-2624',
  notes: 'Advanced rates end 2026-09-07. Routers/NAT not allowed on shared products. Within 72hrs = 20% expedite fee.',
}

export const NACS_ADS = [
  {
    category: 'Show Daily',
    deadlines: { space: '2026-08-28', materials: '2026-09-03' },
    options: [
      { option: '1/4 page', rate: 3250 },
      { option: 'Full page', rate: 7250 },
      { option: 'Back cover', rate: 11500 },
      { option: 'Branded content (3 days)', rate: 2000 },
    ],
  },
  {
    category: 'Onsite Guide',
    deadlines: { space: '2026-08-14', materials: '2026-08-21' },
    options: [
      { option: '1/6 page', rate: 1750 },
      { option: 'Full page', rate: 7000 },
      { option: 'Highlighted listing w/ logo', rate: 500 },
    ],
  },
  {
    category: 'Online Directory',
    deadlines: { space: 'ASAP for early-bird', materials: '' },
    options: [
      { option: 'Gold', rate: 750, earlyRate: 495 },
      { option: 'Platinum (budgeted)', rate: 1500, earlyRate: 995, budgeted: true },
      { option: 'Diamond', rate: 3000, earlyRate: 1995 },
    ],
  },
  {
    category: 'Other Digital',
    deadlines: { space: 'Ongoing', materials: '' },
    options: [
      { option: 'NACS Magazine (from)', rate: 1785 },
      { option: 'Tech category digital sponsorship / mo', rate: 2000 },
      { option: 'NACS Daily e-news (2-wk flight, from)', rate: 2600 },
    ],
  },
  {
    category: 'Priority Points for 2027',
    deadlines: { space: '', materials: '2026-10-31' },
    options: [
      { option: '$5K spend = 2 priority pts', rate: 5000 },
      { option: '$10K spend = 5 priority pts', rate: 10000 },
    ],
  },
]

export const COLLATERAL_VENDORS = [
  { item: 'Business Cards', vendor: 'Vistaprint', leadTime: '5–10d', budget: '$50–300' },
  { item: 'Business Cards', vendor: 'GotPrint', leadTime: '4–8d', budget: '$40–250' },
  { item: 'Business Cards', vendor: 'Moo', leadTime: '7–12d', budget: '$150–600' },
  { item: 'Brochures', vendor: 'PrintPlace', leadTime: '5–10d', budget: '$200–1,200' },
  { item: 'Brochures', vendor: 'UPrinting', leadTime: '5–10d', budget: '$250–1,500' },
  { item: 'Stickers', vendor: 'Sticker Mule', leadTime: '4–8d', budget: '$150–1,000' },
  { item: 'Stickers', vendor: 'Sticker Giant', leadTime: '5–10d', budget: '$200–1,200' },
  { item: 'Lanyards', vendor: '4imprint', leadTime: '10–15d', budget: '$400–2,500' },
  { item: 'Lanyards', vendor: 'Promo Direct', leadTime: '10–15d', budget: '$300–2,000' },
  { item: 'Pens', vendor: '4AllPromos', leadTime: '7–12d', budget: '$200–2,000' },
  { item: 'Notebooks', vendor: 'Positive Promotions', leadTime: '10–15d', budget: '$800–6,000' },
  { item: 'Water Bottles', vendor: '4imprint', leadTime: '10–20d', budget: '$1,250–10,000' },
  { item: 'Portable Chargers', vendor: 'Promo Direct', leadTime: '2–4wk', budget: '$900–9,000' },
  { item: 'PopSockets', vendor: '4AllPromos', leadTime: '10–15d', budget: '$900–5,000' },
  { item: 'Socks', vendor: 'Custom Ink', leadTime: '3–5wk', budget: '$1,200–6,000' },
  { item: 'Table Throw', vendor: 'Totally Promotional', leadTime: '2–3wk', budget: '$250–900' },
  { item: 'Booth Backdrop', vendor: 'UPrinting', leadTime: '2–4wk', budget: '$800–4,000' },
]

export const BOOTH_SPECS = {
  boothNumber: 'C6059',
  size: '10x10 linear',
  zone: 'Central Hall Technology',
  drape: {
    back: "Black & white, 8' height",
    sides: "Black, 3' height",
    aisle: 'Black carpet',
  },
  rules: [
    "Floor covering mandatory — order from Freeman",
    "Max height: 8' back wall (rear half only), 4' front half",
    "No hanging signs (linear booth ineligible)",
    "Min 2 staff at all times (priority-point penalty otherwise)",
    "No early teardown on final day — priority-point penalties",
  ],
  budgetBaseline: {
    total: 8402,
    breakdown: [
      { item: 'Booth space', amount: 3900 },
      { item: 'Wi-Fi (Business Professional)', amount: 1500 },
      { item: 'Furniture (Freeman)', amount: 1500 },
      { item: 'Online Directory Platinum (early-bird)', amount: 995 },
      { item: 'Lead Retrieval SWAP App (early-bird)', amount: 490 },
    ],
    excludes: 'Travel, collateral, advertising, additional lead retrieval add-ons',
  },
  freeman: {
    phone: '888-508-5054',
    website: 'freemanco.com',
    notes: 'Login required for pricing. Flooring & furnishings discount deadline 9/4.',
  },
}
