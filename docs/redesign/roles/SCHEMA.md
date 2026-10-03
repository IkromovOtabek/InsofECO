# Role dashboard spec — write ONE JSON file per role: <ROLE>.json (e.g. DIRECTOR.json)
All visible text in Uzbek (Latin). Keep labels short — phone width is 300px. Numbers are realistic SAMPLE values for a mid-size concrete / gas-block / reinforced-concrete (JBI) factory in Tashkent, in so'm, m³, dona, reys, km.

{
  "role": "DIRECTOR",                 // key
  "name": "Direktor",                 // display name
  "group": "Rahbariyat va moliya",    // your domain group name (given in your prompt)
  "overline": "Direktor · Insof Beton",
  "title": "Dashboard",               // or a better role-specific page title, <= 18 chars
  "periods": ["Bugun","Hafta","Oy"],  // 0-4 period chips, or [] if role works per-shift/today only
  "hero": { "label": "Sof foyda", "value": "74,2", "unit": "mln so'm",
            "delta": { "text": "12%", "dir": "up", "tone": "success" },   // dir up|down ; tone success|warning|danger|info|brand
            "spark": [41,48,44,57,53,62,66,74] },                         // exactly 8 numbers, or null
  "kpis": [ // exactly 4
    { "label": "Tushum", "value": "312 mln", "delta": "+8%", "tone": "success", "icon": "wallet", "module": "Brand" }
  ],
  "chart": { // one main chart, or null
    "type": "bars",                    // bars (1-2 series, grouped) | hbars (ranked list of up to 5 items, 1 series)
    "title": "Tushum va xarajat", "unit": "mln so'm",
    "labels": ["Du","Se","Ch","Pa","Ju","Sh","Ya"],   // bars: 5-8 labels ; hbars: up to 5 item names
    "series": [ { "name": "Tushum", "data": [182,204,176,231,248,196,214] }, { "name": "Xarajat", "data": [140,152,149,170,176,151,160] } ]
  },
  "breakdown": { "title": "Mahsulotlar ulushi", "items": [ { "label": "Beton", "value": 52 } ] },  // 2-4 items summing to 100, or null
  "progress": { "title": "Oylik reja", "value": 72, "caption": "10 400 / 14 500 m³ · 9 kun qoldi" },  // or null
  "attention": [ // 2-3 items: things needing action now
    { "title": "Tasdiq kutmoqda", "sub": "Buyurtma va to'lovlar", "badge": { "text": "5", "tone": "warning" }, "value": null, "icon": "check", "module": "Production" }
  ],
  "quick": [ // exactly 4 quick actions; FIRST is the primary action of this role
    { "label": "Tasdiqlash", "icon": "check", "module": "Brand" }
  ],
  "tabs": [ // 4 or 5 bottom tab-bar buttons; first = this dashboard; labels <= 9 chars
    { "label": "Asosiy", "icon": "home" }
  ],
  "rationale": "2-3 sentences in Uzbek: why these metrics and tabs matter for this role's daily decisions.",
  "data": "1-2 sentences: which numbers already exist in the API/mobile code (name the module/endpoint) and which need a new endpoint."
}

ALLOWED icon names (use only these):
home, list, chat, user, bell, wallet, cash, truck, box, factory, users, plus, search, check, phone, nav, trend, chart, clock, alert, wrench, calendar, map, cart, file, layers, fuel, hardhat, clipboard, shield, star, settings, scan, route, package, receipt
ALLOWED module values: Brand, Production, Logistics, Warehouse
