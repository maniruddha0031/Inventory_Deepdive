/* ============================================================
   Inventory Insight — Deep Dive (single store)
   Same structure as Schedule Insight's Deep Dive:
     range bar (time range + COUNT FREQUENCY) -> KPI tiles rolled up over
     every inventory count in the range -> breakdown table.
   Levels: Inventory · Category (Major / Minor) · Ingredient · Supplier
           Item · Supplier · DC · Menu Item · Exception
   Each inventory row opens an Inventory Breakdown pop-up with the events
   behind it (opening inventory, sales, supplier deliveries, transfers,
   menu mix, waste). Every number is aggregated from inv-deepdive-data.js
   leaf records; this file only filters, groups, sorts and renders.
   ============================================================ */

const IV_DIMS = ['inv','major','minor','ingredient','item','supplier','dc','menu','event'];
const IV_LABEL = { inv:'Inventory', major:'Major Category', minor:'Minor Category', ingredient:'Ingredient', item:'Supplier Item', supplier:'Supplier', dc:'DC', menu:'Menu Item', event:'Exception' };
const IV_PLURAL = { inv:'Inventories', major:'Major Categories', minor:'Minor Categories', ingredient:'Ingredients', item:'Supplier Items', supplier:'Suppliers', dc:'Distribution Centers', menu:'Menu Items', event:'Exceptions' };
const IV_FIELD = { inv:'invId', major:'type', minor:'category', ingredient:'ingredient', item:'itemId', supplier:'supplier', dc:'dc' };
/* Act. Usage % target by count frequency: a Monthly count covers every item
   (paper, dry goods, chemicals), a Daily count only the high-value proteins */
const IV_ACT_TARGET = { Daily:21.0, Weekly:28.0, Monthly:32.0 };

/* Exceptions: conditions one supplier item can hit in one count */
const IV_EVENTS = [
  { id:'highvar',  label:'High variance',   sub:'Actual vs ideal beyond the item\'s variance limit', tone:'#e11d48', bg:'#ffe4e6', w:'High variance' },
  { id:'negative', label:'Negative usage',  sub:'Closing count above opening + receipts — count error', tone:'#9f1239', bg:'#ffe4e6', w:'Negative usage' },
  { id:'waste',    label:'High waste',      sub:'Waste over 6% of the item\'s actual usage',         tone:'#d97706', bg:'#fef3c7', w:'High waste' },
  { id:'belowpar', label:'Below PAR',       sub:'Closing count under the minimum PAR level',         tone:'#dc2626', bg:'#fee2e2', w:'Below PAR' },
  { id:'price',    label:'Price alert',     sub:'Unit cost up more than 4% since the opening count', tone:'#be123c', bg:'#ffe4e6', w:'Price alert' },
  { id:'short',    label:'Short shipped',   sub:'Supplier delivered less than was ordered',          tone:'#0369a1', bg:'#e0f2fe', w:'Short shipped' },
  { id:'over',     label:'Overstock',       sub:'On hand well above max PAR',                        tone:'#0f766e', bg:'#ccfbf1', w:'Overstock' },
];
const ivEventDef = id => IV_EVENTS.find(e => e.id === id);
const ivEventPred = ev => r => invRecordWarnings(r).indexOf(ev.w) >= 0;

/* time range presets (day 1 = Jul 1, day 92 = Sep 30, 2026) */
const IV_PRESETS = [
  { id:'curmonth',  label:'Current month', start:63, end:92 },
  { id:'lastmonth', label:'Last month',    start:32, end:62 },
  { id:'last4w',    label:'Last 4 weeks',  start:65, end:92 },
  { id:'last8w',    label:'Last 8 weeks',  start:37, end:92 },
  { id:'last3m',    label:'Last 3 months', start:1,  end:92 },
];

const IV = {
  range:'last8w', customStart:null, customEnd:null, freq:'Monthly', catView:'major',
  dim:'inv', path:[], sort:null, q:'', menu:null, lastView:null, zoom:null, zoomPts:null, zoomBuckets:null, bd:null,
  hiddenCols:(function(){ try { return JSON.parse(localStorage.getItem('iv-dd-hidden-cols-v2')) || {}; } catch (e) { return {}; } })(),
};
let IV_GROUPS = [], IV_SPARKS = [], IV_TILES = [];

/* ============================================================
   Range + inventories in range
   ============================================================ */
function ivRange(){
  if (IV.range === 'custom') return { start:IV.customStart, end:IV.customEnd };
  const p = IV_PRESETS.find(x => x.id === IV.range) || IV_PRESETS[3];
  return { start:p.start, end:p.end };
}
const ivCalFmt = d => { const x = invDate(d); return String(x.getDate()).padStart(2, '0') + ' ' + INV_MONTHS[x.getMonth()] + ' ' + x.getFullYear(); };
const ivFreqCounts = () => INV_COUNTS.filter(c => c.freq === IV.freq);
function ivInvsBetween(a, b){ return ivFreqCounts().filter(c => c.day >= a && c.day <= b); }
function ivInvsInRange(){ const r = ivRange(); return ivInvsBetween(r.start, r.end); }
/* prior period = the same NUMBER of earlier counts of this frequency, so
   2 monthly counts compare with the 2 before them (like for like) */
function ivInvsPrior(){
  const cur = ivInvsInRange();
  if (!cur.length) return [];
  return ivFreqCounts().filter(c => c.day < cur[0].day).slice(-cur.length);
}
const ivSet = list => new Set(list.map(c => c.id));
const ivCount = id => INV_COUNTS.find(c => c.id === id);
const ivInvName = c => c.freq + ' - ' + invMDY(c.day);

/* ============================================================
   Record scoping
   ============================================================ */
function ivApplyItemPath(recs, path){
  let out = recs;
  path.forEach(p => {
    if (p.dim === 'menu') { const m = INV_MENU.find(x => x.id === p.id); out = out.filter(r => m.recipe[r.ingredient] != null); }
    else if (p.dim === 'event') { const pr = ivEventPred(ivEventDef(p.id)); out = out.filter(pr); }
    else out = out.filter(r => r[IV_FIELD[p.dim]] === p.id);
  });
  return out;
}
/* ingredients implied by the item-level pins: menu items are scoped to
   "menus that use these ingredients" */
function ivScopeIngs(path){
  const pins = path.filter(p => p.dim !== 'inv' && p.dim !== 'menu');
  if (!pins.length) return null;
  return Array.from(new Set(ivApplyItemPath(INV_RECORDS.filter(r => r.freq === IV.freq), pins).map(r => r.ingredient)));
}
function ivApplyMenuPath(recs, path){
  let out = recs;
  path.forEach(p => {
    if (p.dim === 'inv') out = out.filter(r => r.invId === p.id);
    else if (p.dim === 'menu') out = out.filter(r => r.menuId === p.id);
  });
  const ings = ivScopeIngs(path);
  if (ings) out = out.filter(r => { const m = INV_MENU.find(x => x.id === r.menuId); return ings.some(i => m.recipe[i] != null); });
  return out;
}
/* Menu Item rows (and Inventory rows under a pinned menu item) read the
   menu mix; everything else the inventory count roll-up */
function ivSource(dim, path){
  if (dim === 'menu') return 'menu';
  if (dim === 'inv' && path.some(p => p.dim === 'menu') && !path.some(p => p.dim !== 'menu' && p.dim !== 'inv')) return 'menu';
  return 'item';
}
function ivRecords(source, path, invSet){
  if (source === 'menu') return ivApplyMenuPath(INV_MENU_RECORDS.filter(r => invSet.has(r.invId)), path);
  return ivApplyItemPath(INV_RECORDS.filter(r => invSet.has(r.invId)), path);
}
function ivAgg(source, recs, path){ return source === 'menu' ? invMenuAggregate(recs, ivScopeIngs(path || IV.path)) : invAggregate(recs); }

/* ============================================================
   Grouping + labels
   ============================================================ */
function ivGroupBy(recs, dim){
  if (dim === 'event') return IV_EVENTS.map(ev => ({ meta:{ dim, id:ev.id }, records:recs.filter(ivEventPred(ev)) })).filter(g => g.records.length);
  const key = dim === 'menu' ? 'menuId' : IV_FIELD[dim];
  const m = new Map();
  recs.forEach(r => { const k = r[key]; if (!m.has(k)) m.set(k, { meta:{ dim, id:k }, records:[] }); m.get(k).records.push(r); });
  return Array.from(m.values());
}
const ivIng = id => INV_INGREDIENTS.find(i => i.id === id);
const ivCat = id => INV_CATEGORIES.find(c => c.id === id);
const ivSup = id => INV_SUPPLIERS.find(s => s.id === id);
const ivDc = id => INV_DCS.find(d => d.id === id);
const ivItem = id => INV_ITEMS.find(i => i.id === id);
const ivMenuItem = id => INV_MENU.find(m => m.id === id);
const ivDistinct = (recs, f) => new Set(recs.map(r => r[f])).size;

function ivRowLabel(g){
  const { dim, id } = g.meta, rs = g.records;
  if (dim === 'inv') {
    const c = ivCount(id);
    return { name:invMDY(c.day), sub:'Opening ' + invMDY(c.openDay) + ' · ' + c.days + (c.days > 1 ? ' days' : ' day') + (c.finBy ? ' · by ' + c.finBy : '') };
  }
  if (dim === 'major') { const n = INV_CATEGORIES.filter(c => c.type === id).length; return { name:id, sub:n + (n > 1 ? ' minor categories · ' : ' minor category · ') + ivDistinct(rs, 'itemId') + ' items' }; }
  if (dim === 'minor') { const c = ivCat(id); return { name:c.name, sub:c.type + ' · GL ' + c.gl + ' · ' + ivDistinct(rs, 'ingredient') + ' ingredients' }; }
  if (dim === 'ingredient') { const i = ivIng(id); return { name:i.name, sub:ivCat(i.cat).name + ' · ' + i.unit + ' · counted ' + i.freq.toLowerCase() }; }
  if (dim === 'item') { const it = ivItem(id); const s = ivSup(it.sup); return { name:it.name, sub:(s.short || s.name) + ' · #' + it.sku + ' · ' + it.packLbl }; }
  if (dim === 'supplier') { const s = ivSup(id); const n = ivDistinct(rs, 'dc'); return { name:s.name, sub:s.type + ' · ' + ivDistinct(rs, 'itemId') + ' items · ' + n + (n > 1 ? ' DCs' : ' DC') }; }
  if (dim === 'dc') { const d = ivDc(id); const s = ivSup(d.supplier); return { name:d.name, sub:(s.short || s.name) + ' · ' + d.days }; }
  if (dim === 'menu') { const m = ivMenuItem(id); return { name:m.name, sub:m.group + ' · $' + m.price.toFixed(2) + ' · ' + Object.keys(m.recipe).length + ' ingredients' }; }
  const ev = ivEventDef(id); return { name:ev.label, sub:ev.sub };
}

/* ============================================================
   Formatting
   ============================================================ */
function ivKpi(id){
  const k = INV_KPI_DEFS.find(x => x.id === id);
  return k && k.id === 'actPct' ? Object.assign({}, k, { target:IV_ACT_TARGET[IV.freq] }) : k;
}
function ivNum(v, d){ return Number(v).toLocaleString('en-US', { minimumFractionDigits:d, maximumFractionDigits:d }); }
function ivQty(v){ const a = Math.abs(v); return ivNum(v, a >= 1000 ? 0 : a >= 100 ? 1 : 2); }
function ivFmt(v, k, unit){
  const f = k.fmt;
  if (f === 'text') return v || '—';
  if (f === 'dollar') return (k.signed && v > 0 ? '+' : '') + siFmtDollar(v);
  if (f === 'percent' || f === 'pts') return (k.signed && v > 0 ? '+' : '') + v.toFixed(2) + '%';
  if (f === 'days') return v.toFixed(1) + ' days';
  if (f === 'count') return ivNum(v, 0);
  if (f === 'qty') return (k.signed && v > 0 ? '+' : '') + ivQty(v) + (unit ? ' ' + unit : '');
  if (f === 'unitcost') return '$' + (v < 0.1 ? v.toFixed(3) : v.toFixed(2)) + (unit ? '/' + unit : '');
  return String(v);
}
function ivCell(v, k, unit){
  if (k.fmt === 'qty') return (k.signed && v > 0 ? '+' : '') + ivQty(v) + `<span class="u">${unit || ''}</span>`;
  if (k.fmt === 'days') return v.toFixed(1) + '<span class="u">days</span>';
  if (k.fmt === 'unitcost') return '$' + (v < 0.1 ? v.toFixed(3) : v.toFixed(2)) + `<span class="u">/${unit || ''}</span>`;
  if (k.id === 'status') return v ? `<span class="iv-status ${v === 'Finalized' ? 'ok' : 'pending'}">${v}</span>` : '—';
  return ivFmt(v, k, unit);
}
function ivDelta(d, k, unit){
  const s = d >= 0 ? '+' : '-', a = Math.abs(d);
  if (k.fmt === 'dollar' || k.fmt === 'unitcost') return s + siFmtDollar(a);
  if (k.fmt === 'percent' || k.fmt === 'pts') return s + a.toFixed(2) + ' pts';
  if (k.fmt === 'days') return s + a.toFixed(1) + ' days';
  if (k.fmt === 'qty') return s + ivQty(a) + (unit ? ' ' + unit : '');
  return s + ivNum(a, 0);
}
function ivAxis(v, k){
  if (k.fmt === 'dollar') return Math.abs(v) >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v.toFixed(0);
  if (k.fmt === 'percent' || k.fmt === 'pts') return v.toFixed(1) + '%';
  if (k.fmt === 'unitcost') return '$' + v.toFixed(2);
  if (k.fmt === 'days') return v.toFixed(1) + 'd';
  return Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v * 10) / 10);
}
const ivHasTarget = k => typeof k.target === 'number';
const ivIsBad = (k, v) => ivHasTarget(k) && (k.lowerIsBad ? v < k.target : v > k.target);
const ivPct = v => v.toFixed(2) + '%';

/* ============================================================
   Columns per level. A spec is an id or { id, label, plain, sub }:
   plain = no trend line / comparison; sub = second line under the value
   (the "qty · $ | %" pairs of the HubWorks variance detail)
   ============================================================ */
const IV_SUB = {
  actQty:  a => siFmtDollar(a.actCost) + ' · ' + ivPct(a.actPct),
  theoQty: a => siFmtDollar(a.theoCost) + ' · ' + ivPct(a.theoPct),
  varQty:  a => (a.variance > 0 ? '+' : '') + siFmtDollar(a.variance) + ' · ' + ivPct(a.varPct),
  wasteQty:a => siFmtDollar(a.wasteCost),
  delvQty: a => siFmtDollar(a.purchases),
  status:  a => a.finBy ? 'by ' + a.finBy : a.status ? 'awaiting finalize' : '',
};
const IV_COLS = {
  inv:        ['netSales','purchases','actPct','theoPct','varPct','wasteCost','invValue'],
  invScoped:  ['actCost','actPct','theoCost','variance','varPct','purchases','wasteCost','invValue'],
  invQty:     [{ id:'unitCost', plain:true },{ id:'openQty', plain:true },{ id:'delvQty', sub:true },{ id:'closeQty', plain:true },{ id:'actQty', sub:true },{ id:'theoQty', sub:true },{ id:'varQty', sub:true },{ id:'wasteQty', sub:true },{ id:'invValue', label:'On Hand $' }],
  invMenu:    ['menuUnits','menuSales','salesMix','menuTheo','plateCost'],
  major:      ['itemCount',{ id:'invValue', label:'Inventory $' },'purchases','wasteCost','actCost','actPct','theoCost','variance','varPct'],
  minor:      ['itemCount',{ id:'invValue', label:'Inventory $' },'purchases','wasteCost','actCost','actPct','theoCost','variance','varPct'],
  ingredient: [{ id:'unitCost', plain:true },{ id:'openQty', plain:true },{ id:'delvQty', plain:true, sub:true },{ id:'trfInQty', plain:true },{ id:'trfOutQty', plain:true },{ id:'closeQty', plain:true },
               { id:'actQty', sub:true },{ id:'theoQty', sub:true },{ id:'varQty', sub:true },{ id:'wasteQty', sub:true },{ id:'invValue', label:'On Hand $' },'warnCount'],
  item:       ['unitCost','priceChg','delvQty','purchases','fillRate','closeQty',{ id:'parQty', plain:true },{ id:'sugOrder', plain:true },'variance','warnCount'],
  supplier:   ['itemCount','deliveries','purchases','fillRate','priceChg','priceImpact','actCost','wasteCost','invValue'],
  dc:         ['itemCount','deliveries','purchases','fillRate','priceChg','priceImpact','actCost','wasteCost','invValue'],
  menu:       ['menuUnits','menuSales','salesMix','menuTheo','plateCost'],
  event:      ['itemCount','actCost','variance','wasteCost','invValue','priceImpact','warnCount'],
};
function ivColSpecs(dim, path){
  path = path || IV.path;
  if (dim === 'inv') {
    if (ivSource('inv', path) === 'menu') return IV_COLS.invMenu;
    if (path.some(p => p.dim === 'ingredient' || p.dim === 'item')) return IV_COLS.invQty;
    if (path.some(p => p.dim !== 'inv')) return IV_COLS.invScoped;
    return IV_COLS.inv;
  }
  if (dim === 'menu' && ivScopeIngs(path)) return ['ingCost'].concat(IV_COLS.menu);
  return IV_COLS[dim];
}
function ivColKpis(dim){
  return ivColSpecs(dim).map(s => {
    const sp = typeof s === 'string' ? { id:s } : s, k = ivKpi(sp.id);
    return Object.assign({}, k, sp.label ? { label:sp.label } : {}, { plain:!!sp.plain || k.fmt === 'text', subFn:sp.sub ? IV_SUB[sp.id] : null });
  });
}
const ivColIds = dim => ivColSpecs(dim).map(s => typeof s === 'string' ? s : s.id);
const ivColVisible = id => !IV.hiddenCols[id];
function ivColDefs(){ return ivColKpis(IV.dim).map(k => ({ id:k.id, label:k.label })).concat([{ id:'drill', label:'Detailed view' }]); }

/* ============================================================
   Drill logic
   ============================================================ */
const ivIsMenuRow = g => g.records.length && g.records[0].menuId !== undefined;
function ivSingleValued(g, d){ const f = IV_FIELD[d]; return f ? ivDistinct(g.records, f) <= 1 : false; }
function ivBreakdownOptions(g){
  const dim = g.meta.dim;
  if (ivIsMenuRow(g)) return ['inv','menu','ingredient','major','minor','supplier','event'].filter(d => d !== dim && !(d === 'inv' && ivDistinct(g.records, 'invId') <= 1));
  return IV_DIMS.filter(d => d !== dim && !ivSingleValued(g, d));
}
const IV_DEFAULT_NEXT = { inv:null, major:'minor', minor:'ingredient', ingredient:'item', item:null, supplier:'dc', dc:'item', menu:'ingredient', event:'ingredient' };
function ivDefaultDrill(g){
  const dim = g.meta.dim, used = IV.path.map(p => p.dim).concat([dim]);
  if (ivIsMenuRow(g)) return used.indexOf('ingredient') < 0 ? 'ingredient' : null;
  if (dim === 'item') return null;
  const first = dim === 'inv' ? IV.catView : IV_DEFAULT_NEXT[dim];
  const chain = [first, 'minor', 'ingredient', 'item'].filter(Boolean);
  return chain.find(d => used.indexOf(d) < 0 && !ivSingleValued(g, d)) || null;
}
function ivBreakDownRow(i, target){
  const g = IV_GROUPS[i];
  if (!g) return;
  const { name } = ivRowLabel(g);
  const label = g.meta.dim === 'inv' ? ivInvName(ivCount(g.meta.id)) : name;
  IV.path = IV.path.concat([{ dim:g.meta.dim, id:g.meta.id, label }]).filter(p => p.dim !== target);
  if (target === 'major' || target === 'minor') IV.catView = target;
  IV.dim = target; IV.sort = null;
  ivRender();
}
function ivDrillRow(i){ const g = IV_GROUPS[i]; const t = g && ivDefaultDrill(g); if (t) ivBreakDownRow(i, t); }
function ivSetDim(d){ if (d === 'category') d = IV.catView; IV.dim = d; IV.path = []; IV.sort = null; ivRender(); }
function ivSetCatView(v){ IV.catView = v; if (IV.dim === 'major' || IV.dim === 'minor') { IV.dim = v; IV.path = IV.path.filter(p => p.dim !== v); } ivRender(); }
function ivJumpRoot(){ IV.dim = IV.path[0] ? IV.path[0].dim : IV.dim; IV.path = []; ivRender(); }
function ivJumpPath(i){ const next = IV.path[i + 1] ? IV.path[i + 1].dim : IV.dim; IV.path = IV.path.slice(0, i + 1); IV.dim = next; ivRender(); }
function ivResetDrill(){ IV.path = []; IV.dim = 'inv'; IV.sort = null; }
function ivSetRange(id){ IV_CAL.open = false; IV_CAL.pa = IV_CAL.pb = null; IV.range = id; ivResetDrill(); ivRender(); }
function ivSetFreq(f){ IV.freq = f; ivResetDrill(); ivRender(); }

/* ============================================================
   Row trend + comparisons (one point per inventory count)
   ============================================================ */
function ivRowCtx(g, name){
  const f = IV.path.filter(p => p.dim !== 'inv');
  if (g.meta.dim !== 'inv') f.push({ dim:g.meta.dim, id:g.meta.id, label:name });
  return f;
}
const ivTrendLen = () => IV.freq === 'Daily' ? 14 : 8;
function ivTrendInvs(g){
  const end = g && g.meta.dim === 'inv' ? ivCount(g.meta.id).day : ivRange().end;
  return ivFreqCounts().filter(c => c.day <= end).slice(-ivTrendLen());
}
function ivSeries(source, ctx, invs, k){
  return invs.map(c => {
    const recs = ivRecords(source, ctx, new Set([c.id]));
    return { c, label:invMonDay(c.day), full:ivInvName(c), value:recs.length ? ivAgg(source, recs, ctx)[k.id] : null };
  }).filter(p => p.value != null && isFinite(p.value));
}
function ivSmooth(pts, yMin, yMax){
  if (pts.length < 3) return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
  const c = v => Math.min(yMax, Math.max(yMin, v));
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${c(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${c(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function ivSparkHtml(points, k, color, title, sub, ctx, source, unit){
  const SW = 100, SH = 28, n = points.length;
  if (!n) return '';
  const vals = points.map(p => p.value);
  const idx = IV_SPARKS.push({ title, sub, kpiId:k.id, label:k.label, color, ctx, source, unit }) - 1;
  const lo0 = Math.min.apply(null, vals), hi0 = Math.max.apply(null, vals);
  if (hi0 === 0 && lo0 === 0) color = '#d1d5db';
  const pad = (hi0 - lo0) * 0.15 || Math.abs(hi0) * 0.1 || 1;
  const lo = (hi0 === 0 && lo0 === 0) ? 0 : lo0 - pad, hi = hi0 + pad;
  const X = i => n === 1 ? SW / 2 : (i / (n - 1)) * SW;
  const Y = v => SH - 2 - ((v - lo) / (hi - lo)) * (SH - 5);
  const line = n === 1 ? `M0,${Y(vals[0]).toFixed(1)} L${SW},${Y(vals[0]).toFixed(1)}` : ivSmooth(vals.map((v, i) => [X(i), Y(v)]), 1, SH - 1);
  const step = n === 1 ? SW : SW / (n - 1);
  const hits = points.map((p, i) => `<rect x="${Math.max(0, X(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${SH}" fill="transparent"><title>${p.full} · ${ivFmt(p.value, k, unit)}</title></rect>`).join('');
  return `<svg class="dd-spark" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" onclick="event.stopPropagation(); ivOpenZoom(${idx})">
    <defs><linearGradient id="ivs${idx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".14"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${line} L${SW},${SH} L0,${SH} Z" fill="url(#ivs${idx})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${hits}
  </svg>`;
}
/* inventory rows compare with the previous count of the same frequency;
   other rows with the prior range of the same length */
function ivPrior(g, source, ctx){
  if (g.meta.dim === 'inv') {
    const c = ivCount(g.meta.id), prev = ivFreqCounts().filter(x => x.day < c.day).pop();
    if (!prev) return { none:true, label:'previous count' };
    const recs = ivRecords(source, ctx, new Set([prev.id]));
    return { agg:ivAgg(source, recs, ctx), empty:!recs.length, label:ivInvName(prev) };
  }
  // drilled inside one inventory: compare with that inventory's previous count
  const pin = IV.path.find(p => p.dim === 'inv');
  if (pin) {
    const c = ivCount(pin.id), prev = ivFreqCounts().filter(x => x.day < c.day).pop();
    if (!prev) return { none:true, label:'previous count' };
    const recs = ivRecords(source, ctx, new Set([prev.id]));
    return { agg:ivAgg(source, recs, ctx), empty:!recs.length, label:ivInvName(prev) };
  }
  const pri = ivInvsPrior();
  if (!pri.length || pri.length !== ivInvsInRange().length) return { none:true, label:'prior period (not enough earlier counts)' };
  const recs = ivRecords(source, ctx, ivSet(pri));
  return { agg:ivAgg(source, recs, ctx), empty:!recs.length, label:'prior period (' + pri.length + ' ' + IV.freq.toLowerCase() + ' counts)' };
}
function ivCmpChip(k, cur, prior, unit){
  if (!prior || prior.none || prior.empty) return `<span class="dd-cmp na" title="No data for the ${prior ? prior.label : 'prior period'}">—</span>`;
  const prev = prior.agg[k.id], d = cur - prev, flat = Math.abs(d) < 0.005;
  let txt;
  if (k.fmt === 'percent' || k.fmt === 'pts') txt = Math.abs(d).toFixed(1) + ' pts';
  else if (prev) txt = Math.abs(d / prev * 100).toFixed(1) + '%';
  else txt = ivDelta(d, k, unit).replace(/^[+-]/, '');
  const tone = flat ? 'flat' : k.dir === 'up' ? (d > 0 ? 'good' : 'bad') : k.dir === 'down' ? (d > 0 ? 'bad' : 'good') : 'neutral';
  return `<span class="dd-cmp ${tone}" title="vs ${prior.label}: ${ivFmt(prev, k, unit)} (${ivDelta(d, k, unit)})">${flat ? '•' : d > 0 ? '▲' : '▼'} ${flat ? '0%' : txt}</span>`;
}

/* ============================================================
   Icons
   ============================================================ */
const IV_SVG = {
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  inv:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  category:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  major:'<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/>',
  minor:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  ingredient:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  item:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  supplier:'<path d="M1 3h13v13H1zM14 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  dc:'<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-8h10v8M7 17h10"/>',
  menu:'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  event:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  breakdown:'<path d="M5 3.5v17l2.5-1.6 2.5 1.6 2-1.6 2 1.6 2.5-1.6 2.5 1.6v-17z"/><path d="M9 8.5h6M9 12.5h6"/>',
};
const ivSvg = (n, s) => `<svg width="${s || 14}" height="${s || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IV_SVG[n]}</svg>`;
const IV_TONE = {
  inv:{ bg:'#DBEAFE', fg:'#1D4ED8' }, major:{ bg:'#E0F2FE', fg:'#0369A1' }, minor:{ bg:'#EDE9FE', fg:'#6D28D9' },
  ingredient:{ bg:'#DCFCE7', fg:'#15803D' }, item:{ bg:'#FEF3C7', fg:'#B45309' }, supplier:{ bg:'#E0E7FF', fg:'#4338CA' },
  dc:{ bg:'#F1F5F9', fg:'#475569' }, menu:{ bg:'#FFE4E6', fg:'#BE123C' }, event:{ bg:'#FEE2E2', fg:'#DC2626' }, breakdown:{ bg:'#CCFBF1', fg:'#0F766E' },
};
const IV_CAT_ICON = {
  seafood: { bg:'#e0f2fe', fg:'#0369a1', svg:'<path d="M6.5 12c3-5 9-6 13.5 0-4.5 6-10.5 5-13.5 0z"/><path d="M6.5 12 2 8.5v7z"/><circle cx="16" cy="11" r=".8" fill="currentColor"/>' },
  meat:    { bg:'#ffe4e6', fg:'#be123c', svg:'<path d="M15.4 15.6a6 6 0 1 0-7-7c-.6 2.1.1 3.8 1.6 5.4l-4.3 4.3a1.5 1.5 0 1 0 2 2l4.3-4.3c1.6 1.4 3.3 2.1 3.4-.4z"/>' },
  produce: { bg:'#dcfce7', fg:'#15803d', svg:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>' },
  dairy:   { bg:'#fef9c3', fg:'#a16207', svg:'<path d="M3 16 14 5l7 5-11 11z"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/><circle cx="10" cy="16" r=".8" fill="currentColor"/>' },
  tortilla:{ bg:'#ffedd5', fg:'#c2410c', svg:'<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M15 8h.01M10 15h.01M16 14h.01M12 11h.01"/>' },
  dry:     { bg:'#f5f5f4', fg:'#57534e', svg:'<path d="M6 3h12l1 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7z"/><path d="M5 7h14M10 12h4"/>' },
  sauce:   { bg:'#fee2e2', fg:'#b91c1c', svg:'<path d="M9 3h6M10 3v4l-3 4v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9l-3-4V3"/><path d="M7 14h10"/>' },
  bev:     { bg:'#e0e7ff', fg:'#4338ca', svg:'<path d="M5 6h14l-1.5 15h-11z"/><path d="M4 6h16M12 6l2-4"/>' },
  paper:   { bg:'#f3e8ff', fg:'#7e22ce', svg:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>' },
  chem:    { bg:'#ccfbf1', fg:'#0f766e', svg:'<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>' },
};
const IV_MAJOR_ICON = { 'Food':'seafood', 'Beverage':'bev', 'Paper & Packaging':'paper', 'Chemicals':'chem' };
const IV_MAJOR_TONE = { 'Food':{ bg:'#fee2e2', fg:'#b91c1c', svg:IV_CAT_ICON.meat.svg }, 'Beverage':IV_CAT_ICON.bev, 'Paper & Packaging':IV_CAT_ICON.paper, 'Chemicals':IV_CAT_ICON.chem };
const IV_MENU_TONE = { Tacos:'#c2410c', Burritos:'#b45309', Plates:'#0369a1', Sides:'#15803d', Kids:'#7c3aed', Beverage:'#4338ca' };

function ivIconBox(bg, fg, inner){ return `<span class="dd-row-ic" style="background:${bg};color:${fg}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`; }
function ivInitials(name){ return name.replace(/\(.*\)/, '').split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase(); }
function ivSupBadge(supId, small){ const s = ivSup(supId); return `<span class="iv-sup-badge${small ? ' sm' : ''}" style="background:${s.bg};color:${s.tone}">${ivInitials(s.short || s.name)}</span>`; }
function ivRowLead(g){
  const { dim, id } = g.meta;
  if (dim === 'inv') { const d = invDate(ivCount(id).day); return `<span class="dd-day-ic iv-f-${IV.freq.toLowerCase()}"><i>${INV_MONTHS[d.getMonth()]}</i><b>${d.getDate()}</b></span>`; }
  if (dim === 'major') { const t = IV_MAJOR_TONE[id] || IV_CAT_ICON.dry; return ivIconBox(t.bg, t.fg, t.svg); }
  if (dim === 'minor') { const c = IV_CAT_ICON[id]; return ivIconBox(c.bg, c.fg, c.svg); }
  if (dim === 'ingredient') { const c = IV_CAT_ICON[ivIng(id).cat]; return ivIconBox(c.bg, c.fg, c.svg); }
  if (dim === 'item' || dim === 'supplier') return ivSupBadge(dim === 'item' ? ivItem(id).sup : id);
  if (dim === 'dc') { const s = ivSup(ivDc(id).supplier); return ivIconBox(s.bg, s.tone, IV_SVG.dc); }
  if (dim === 'menu') return ivIconBox('#fff1f2', IV_MENU_TONE[ivMenuItem(id).group] || '#be123c', IV_SVG.menu);
  const ev = ivEventDef(id); return ivIconBox(ev.bg, ev.tone, IV_SVG.event);
}
function ivRowBadge(g, agg){
  const { dim } = g.meta;
  if (dim === 'inv' && ivSource('inv', IV.path) === 'item') {
    const c = ivCount(g.meta.id), k = ivKpi('actPct');
    // status (and finalizer, in the sub line) live in the name cell, as on the HubWorks summary
    let b = `<span class="iv-status ${c.status === 'Finalized' ? 'ok' : 'pending'}">${c.status}</span>`;
    if (!IV.path.length && agg.actPct - k.target >= k.thresholdPct) b += '<span class="dd-over-badge">Over</span>';
    if (c.missed > 0) b += `<span class="iv-miss-badge" title="${c.missed} scheduled ${c.freq.toLowerCase()} count${c.missed > 1 ? 's' : ''} missed — this count covers ${c.days} days">${c.missed} missed</span>`;
    return b;
  }
  if (dim === 'ingredient') { const i = ivIng(g.meta.id); if (agg.actQty < 0) return '<span class="dd-over-badge">Negative</span>'; if (agg.theoCost > 0 && Math.abs(agg.varIdeal) > i.varLimit && Math.abs(agg.variance) >= 15) return '<span class="dd-over-badge">High var</span>'; }
  if (dim === 'item' && agg.belowPar) return '<span class="dd-over-badge">Below PAR</span>';
  return '';
}

/* ============================================================
   Range bar: calendar · presets · count frequency
   ============================================================ */
const IV_CAL = { open:false, a:null, b:null, view:null, pa:null, pb:null };
const IV_MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function ivCalToggle(){
  if (IV_CAL.open) { IV_CAL.open = false; ivCalRender(); return; }
  const r = ivRange();
  IV_CAL.open = true; IV_CAL.a = IV_CAL.pa != null ? IV_CAL.pa : r.start; IV_CAL.b = IV_CAL.pb != null ? IV_CAL.pb : r.end;
  IV_CAL.view = new Date(2026, 7, 1);
  ivCalRender();
}
function ivCalRender(){
  const pop = document.getElementById('iv-cal-pop');
  if (pop) pop.innerHTML = IV_CAL.open ? ivCalPopHtml() : '';
  const pill = document.querySelector('.dd-cal-pill'); if (pill) pill.classList.toggle('open', IV_CAL.open);
}
function ivCalNav(step){ const v = IV_CAL.view; IV_CAL.view = new Date(v.getFullYear(), v.getMonth() + step, 1); ivCalRender(); }
function ivCalPick(d){
  if (IV_CAL.a == null || IV_CAL.b != null) { IV_CAL.a = d; IV_CAL.b = null; }
  else if (d < IV_CAL.a) { IV_CAL.b = IV_CAL.a; IV_CAL.a = d; }
  else IV_CAL.b = d;
  ivCalRender();
}
function ivCalDone(){
  const a = IV_CAL.a, b = IV_CAL.b == null ? IV_CAL.a : IV_CAL.b;
  if (a == null) return;
  IV_CAL.open = false;
  const r = ivRange();
  if (a === r.start && b === r.end) IV_CAL.pa = IV_CAL.pb = null; else { IV_CAL.pa = a; IV_CAL.pb = b; }
  ivRender();
}
function ivCalApply(){
  if (IV_CAL.pa == null) return;
  const a = IV_CAL.pa, b = IV_CAL.pb;
  IV_CAL.open = false; IV_CAL.pa = IV_CAL.pb = null;
  const match = IV_PRESETS.find(p => p.start === a && p.end === b);
  IV.range = match ? match.id : 'custom'; IV.customStart = a; IV.customEnd = b;
  ivResetDrill(); ivRender();
}
function ivCalMonthHtml(y, m){
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const a = IV_CAL.a, b = IV_CAL.b;
  const countDays = new Set(ivFreqCounts().map(c => c.day));
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="dd-cal-d empty"></span>';
  for (let d = 1; d <= days; d++) {
    const g = Math.round((new Date(y, m, d) - INV_DAY0) / 86400000);
    const off = g < 1 || g > INV_DAYS;
    const isA = g === a, isB = b != null && g === b, inR = b != null && g > a && g < b;
    const cls = ['dd-cal-d', off ? 'off' : '', isA ? 'sel start' : '', isB ? 'sel end' : '', inR ? 'in' : '', (isA && (b == null || b === a)) ? 'single' : '', countDays.has(g) ? 'iv-cnt' : ''].join(' ');
    cells += off ? `<span class="${cls}">${d}</span>` : `<button class="${cls}" onclick="ivCalPick(${g})"${countDays.has(g) ? ` title="${IV.freq} count"` : ''}>${d}</button>`;
  }
  return `<div class="dd-cal-month"><div class="dd-cal-mh">${IV_MONTH_FULL[m]} ${y}</div>
    <div class="dd-cal-wk">${['Mo','Tu','We','Th','Fr','Sa','Su'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="dd-cal-grid">${cells}</div></div>`;
}
function ivCalPopHtml(){
  const v = IV_CAL.view, n = new Date(v.getFullYear(), v.getMonth() + 1, 1);
  const a = IV_CAL.a, b = IV_CAL.b;
  const cnt = a != null && b != null ? ivInvsBetween(a, b).length : 0;
  const sel = a == null ? 'Pick a start date' : b == null ? `${ivCalFmt(a)} – pick an end date` : `${ivCalFmt(a)} – ${ivCalFmt(b)} · ${cnt} ${IV.freq.toLowerCase()} count${cnt === 1 ? '' : 's'}`;
  return `<div class="dd-cal-card"><div class="dd-cal-main">
    <div class="dd-cal-nav">
      <button onclick="ivCalNav(-1)" title="Previous month"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <button onclick="ivCalNav(1)" title="Next month"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
    </div>
    <div class="dd-cal-months">${ivCalMonthHtml(v.getFullYear(), v.getMonth())}${ivCalMonthHtml(n.getFullYear(), n.getMonth())}</div>
    <div class="dd-cal-foot"><span class="dd-cal-sel">${sel} <em class="iv-cal-note">Dotted days = ${IV.freq.toLowerCase()} inventory count dates</em></span>
      <button class="dd-cal-btn ghost" onclick="ivCalToggle()">Cancel</button>
      <button class="dd-cal-btn" onclick="ivCalDone()"${a == null ? ' disabled' : ''}>Done</button></div>
  </div></div>`;
}
function ivRangeBarHtml(){
  const r = ivRange();
  const s = IV_CAL.pa != null ? IV_CAL.pa : r.start, e = IV_CAL.pa != null ? IV_CAL.pb : r.end;
  return `<div class="dd-rangebar">
    <div class="iv-freqseg" role="radiogroup" aria-label="Count frequency">
      <span class="iv-freqseg-l">Count Frequency</span>
      ${INV_FREQS.map(f => `<button class="${IV.freq === f.id ? 'on' : ''}" role="radio" aria-checked="${IV.freq === f.id}" title="${f.sub}" onclick="ivSetFreq('${f.id}')">${f.id}</button>`).join('')}
    </div>
    <div class="dd-range-label dd-cal-wrap" onclick="event.stopPropagation()">
      <button class="dd-cal-pill${IV_CAL.open ? ' open' : ''}${IV_CAL.pa != null ? ' pending' : ''}" onclick="ivCalToggle()" title="Choose From and To dates">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/></svg>
        <span>${ivCalFmt(s)} – ${ivCalFmt(e)}</span>
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="dd-cal-pop" id="iv-cal-pop">${IV_CAL.open ? ivCalPopHtml() : ''}</div>
      <button class="dd-cal-go${IV_CAL.pa != null ? ' ready' : ''}" onclick="ivCalApply()" title="Load the selected dates">Go</button>
    </div>
    <div class="dd-presets">${IV_PRESETS.map(p => `<button class="dd-preset ${p.id === IV.range ? 'active' : ''}" onclick="ivSetRange('${p.id}')">${p.label}</button>`).join('')}</div>
  </div>`;
}

/* ============================================================
   KPI tiles: rolled up over every inventory count of the selected
   frequency in the range (independent of the drill below)
   ============================================================ */
const IV_TILE_ICON = {
  sales:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  dollar:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  percent:'<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  scale:'<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
  truck:'<path d="M1 3h13v13H1zM14 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',
  tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
};
function ivTileSpark(vals, color, i){
  const pts = (vals || []).filter(v => v != null && isFinite(v));
  if (pts.length < 2) return '<div class="kt-spark"></div>';
  const W = 100, H = 30, n = pts.length;
  const lo0 = Math.min.apply(null, pts), hi0 = Math.max.apply(null, pts);
  const pad = (hi0 - lo0) * 0.15 || Math.abs(hi0) * 0.1 || 1;
  const lo = lo0 - pad, hi = hi0 + pad;
  const line = pts.map((v, j) => ((j / (n - 1)) * W).toFixed(1) + ',' + (H - 2 - ((v - lo) / (hi - lo)) * (H - 4)).toFixed(1)).join(' ');
  return `<svg class="kt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="ivt${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="M0,${H} L${line.split(' ').join(' L')} L${W},${H} Z" fill="url(#ivt${i})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
function ivTilesHtml(){
  const invs = ivInvsInRange(), pri = ivInvsPrior();
  const recsOf = list => INV_RECORDS.filter(r => list.some(c => c.id === r.invId));
  const cur = invAggregate(recsOf(invs));
  // like for like only: the same number of earlier counts must exist
  const hasPrior = pri.length > 0 && pri.length === invs.length, p = hasPrior ? invAggregate(recsOf(pri)) : null;
  const trend = ivTrendInvs(null).map(c => invAggregate(INV_RECORDS.filter(r => r.invId === c.id)));
  const ser = id => trend.map(a => a[id]);
  const K = id => ivKpi(id), f = (v, id) => ivFmt(v, K(id)), NA = '—';
  const chg = id => hasPrior ? ivDelta(cur[id] - p[id], K(id)) : NA;
  const lb = K('actPct'), n = invs.length;
  const priceAlerts = new Set(recsOf(invs).filter(r => invRecordWarnings(r).indexOf('Price alert') >= 0).map(r => r.itemId)).size;
  const tiles = [
    { kpi:'netSales', label:'Sales $', icon:'sales', accent:'#0891b2', chipBg:'#e0f7fb', value:f(cur.netSales, 'netSales'),
      footL:'Avg. / Count', footLVal:n ? siFmtDollar(cur.netSales / n) : NA, footR:'Change', footRVal:chg('netSales') },
    { kpi:'actCost', label:'Actual Usage $', icon:'dollar', accent:'#8b4fbe', chipBg:'#f2eafb', value:f(cur.actCost, 'actCost'),
      footL:'Ideal $', footLVal:siFmtDollar(cur.theoCost), footR:'Change', footRVal:chg('actCost') },
    { kpi:'actPct', label:'Act. Usage %', icon:'percent', accent:'#f4685b', chipBg:'#fdeceb', value:f(cur.actPct, 'actPct'),
      badge: n && cur.actPct - lb.target >= lb.thresholdPct ? 'Over Target' : '',
      footL:'Target', footLVal:lb.target.toFixed(1) + '%', footR:'vs Ideal', footRVal:ivDelta(cur.actPct - cur.theoPct, lb) },
    { kpi:'theoCost', label:'Ideal Usage $', icon:'target', accent:'#12a37f', chipBg:'#e3f7f0', value:f(cur.theoCost, 'theoCost'),
      footL:'Ideal Usage %', footLVal:ivPct(cur.theoPct), footR:'Prior Period', footRVal:hasPrior ? siFmtDollar(p.theoCost) : NA },
    { kpi:'variance', label:'Variance $', icon:'scale', accent:'#e11d48', chipBg:'#ffe4e6', value:ivDelta(cur.variance, K('variance')),
      badge: cur.varPct > K('varPct').target ? 'Over' : '',
      footL:'Variance %', footLVal:ivPct(cur.varPct), footR:'High Var. Items', footRVal:String(cur.highVar) },
    { kpi:'purchases', label:'Deliveries $', icon:'truck', accent:'#4d8cf5', chipBg:'#eaf1fe', value:f(cur.purchases, 'purchases'),
      badge: cur.fillRate < K('fillRate').target ? 'Short Shipped' : '',
      footL:'Invoices', footLVal:String(cur.deliveries), footR:'Fill Rate', footRVal:cur.fillRate.toFixed(1) + '%' },
    { kpi:'wasteCost', label:'Waste $', icon:'trash', accent:'#d97706', chipBg:'#fef3c7', value:f(cur.wasteCost, 'wasteCost'),
      badge: hasPrior && cur.wastePct > p.wastePct * 1.05 ? 'Over' : '',
      footL:'Waste %', footLVal:ivPct(cur.wastePct), footR:'Prior Period', footRVal:hasPrior ? siFmtDollar(p.wasteCost) : NA },
    { kpi:'invValue', label:'Inv. Value', icon:'box', accent:'#4f46e5', chipBg:'#eef2ff', value:f(cur.invValue, 'invValue'),
      footL:'Opening Inv.', footLVal:siFmtDollar(cur.openValue), footR:'Change', footRVal:chg('invValue') },
    // supplier price moves: extra $ paid on what was received, and how many items crossed the price-alert rule
    { kpi:'priceImpact', label:'Price Impact $', icon:'tag', accent:'#be123c', chipBg:'#ffe4e6', value:(cur.priceImpact > 0 ? '+' : '') + siFmtDollar(cur.priceImpact),
      badge: priceAlerts ? priceAlerts + (priceAlerts === 1 ? ' Price Alert' : ' Price Alerts') : '',
      footL:'Price Change', footLVal:(cur.priceChg > 0 ? '+' : '') + cur.priceChg.toFixed(2) + '%', footR:'Prior Period', footRVal:hasPrior ? siFmtDollar(p.priceImpact) : NA },
  ];
  tiles.forEach(t => { t.series = ser(t.kpi); });
  IV_TILES = tiles;
  return tiles.map((t, i) => `<div class="kpi-card kt-click" style="--accent:${t.accent};--chip:${t.chipBg}" onclick="ivOpenTile(${i})" title="Click to view the ${t.label} trend">
    <div class="kt-head">
      <div class="kt-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IV_TILE_ICON[t.icon]}</svg></div>
      <div class="kt-tx"><div class="kt-top"><span class="label" title="${t.label}">${t.label}</span></div><div class="value">${t.value}</div></div>
    </div>
    <div class="kt-mid">${t.badge ? `<span class="badge-over">${t.badge}</span>` : '<span></span>'}${ivTileSpark(t.series, t.accent, i)}</div>
    <div class="foot">
      <div class="col"><div class="lbl" title="${t.footL}">${t.footL}</div><div class="val">${t.footLVal}</div></div>
      <div class="col r"><div class="lbl" title="${t.footR}">${t.footR}</div><div class="val">${t.footRVal}</div></div>
    </div>
  </div>`).join('');
}
/* ---- KPI tile -> trend pop-up: the Schedule deep dive's trend modal, ported
   as-is (trend-modal-engine.js + trend-modal.js adapter + trend-modal.css).
   Each tile is registered in the adapter's KPI_REGISTRY shape — label, value,
   % change, and its two footer figures as the supporting KPIs — then opened
   with the same engine call the Schedule app uses. ---- */
/* change shown in the pop-up header: latest count vs the one before it */
function ivTileChange(series){
  const s = (series || []).filter(v => v != null && isFinite(v));
  if (s.length < 2 || !s[s.length - 2]) return { txt:'0.0%', up:true };
  const pct = (s[s.length - 1] - s[s.length - 2]) / Math.abs(s[s.length - 2]) * 100;
  return { txt:(pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', up:pct >= 0 };
}
function ivRegisterTrendTiles(){
  if (typeof KPI_REGISTRY === 'undefined' || !window.registerTrendKpi) return [];
  if (typeof TM_DASH_LABELS !== 'undefined') TM_DASH_LABELS.iv = 'Inventory Deep Dive';
  const ids = [];
  IV_TILES.forEach((t, i) => {
    const id = 'iv-' + (t.kpi || i);
    const ch = ivTileChange(t.series);
    const footer = [[t.footL, t.footLVal], [t.footR, t.footRVal]]
      .filter(f => f[1] && f[1] !== '—' && !isNaN(parseFloat(String(f[1]).replace(/[,$%+]/g, ''))));
    KPI_REGISTRY[id] = { label:t.label, value:t.value, spark:'', cur:{ lw:ch.txt, lwUp:ch.up }, footer };
    const cfg = tmCfgFromTile(KPI_REGISTRY[id], id);
    cfg.color = t.accent;                       // keep each tile's own colour in the chart
    window.registerTrendKpi(id, cfg);
    ids.push(id);
  });
  if (typeof tmMetricCatalog !== 'undefined') tmMetricCatalog = null;   // rebuild "Add Metric" with current values
  return ids;
}
function ivOpenTile(i){
  if (!window.openLaborModal) return;
  const ids = ivRegisterTrendTiles();
  if (ids[i]) window.openLaborModal(ids[i], ids, false);
}

/* ============================================================
   Section header, dimension chips, toolbar
   ============================================================ */
function ivBreadcrumbHtml(){
  const path = IV.path;
  if (!path.length) return '';
  const tag = p => { const l = IV_LABEL[p.dim]; return p.dim === 'inv' || p.label.toLowerCase().indexOf(l.toLowerCase()) === 0 ? p.label : l + ': ' + p.label; };
  let h = `<div class="dd-drillbar"><div class="si-crumbs"><span class="dd-drill-lbl">Drilldown</span><span class="crumb" onclick="ivJumpRoot()">All ${IV_PLURAL[path[0].dim]}</span>`;
  path.forEach((p, i) => {
    h += '<span class="sep">›</span>';
    const l = i === 0 ? p.label : tag(p);
    h += i === path.length - 1 ? `<span class="crumb current">${l}</span>` : `<span class="crumb" onclick="ivJumpPath(${i})">${l}</span>`;
  });
  return h + `<span class="dd-drill-lvl">› ${IV_PLURAL[IV.dim]}</span></div>
    <button class="dd-clear-drill" onclick="ivJumpRoot()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>Clear drilldown</button></div>`;
}
const IV_CHIPS = [['inv','Inventory'],['category','Category'],['ingredient','Ingredient'],['item','Supplier Item'],['supplier','Supplier'],['dc','DC'],['menu','Menu Item'],['event','Exception']];
function ivDimChipsHtml(){
  const active = d => d === 'category' ? (IV.dim === 'major' || IV.dim === 'minor') : IV.dim === d;
  return `<div class="dd-dimchips iv-dimchips" role="tablist">${IV_CHIPS.map(([d, l]) =>
    (d === 'supplier' || d === 'menu' || d === 'event' ? '<span class="dd-dimsep"></span>' : '') +
    `<button class="dd-dimchip${d === 'event' ? ' ev' : ''}${active(d) ? ' active' : ''}" role="tab" aria-selected="${active(d)}" onclick="ivSetDim('${d}')">${ivSvg(d)}${l}</button>`).join('')}</div>
    <div class="iv-viewby" role="radiogroup" aria-label="Category view">
      <span>View By</span>
      <button class="${IV.catView === 'major' ? 'on' : ''}" onclick="ivSetCatView('major')">Major Category</button>
      <button class="${IV.catView === 'minor' ? 'on' : ''}" onclick="ivSetCatView('minor')">Minor Category</button>
    </div>`;
}
const IV_TB = {
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
  cols:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>', download:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  chev:'<path d="m6 9 6 6 6-6"/>', csv:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  xls:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>', copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
};
const ivTb = (n, s) => `<svg width="${s || 15}" height="${s || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IV_TB[n]}</svg>`;
function ivToolbarHtml(){
  const cols = ivColDefs(), shown = cols.filter(c => ivColVisible(c.id)).length, q = IV.q || '';
  return `<div class="dd-toolbar">
    <div class="dd-tb-search${q ? ' has-q' : ''}">${ivTb('search')}
      <input type="text" placeholder="Search ${IV_PLURAL[IV.dim].toLowerCase()}..." value="${q.replace(/"/g, '&quot;')}" oninput="ivFilterRows(this.value)">
      <button class="dd-tb-clear" title="Clear search" onclick="ivClearSearch()">${ivTb('x', 13)}</button></div>
    <div class="dd-tb-wrap">
      <button class="dd-tb-btn${IV.menu === 'cols' ? ' open' : ''}" onclick="event.stopPropagation(); ivToggleMenu('cols')">${ivTb('cols')}<span>Columns</span><em>${shown}/${cols.length}</em>${ivTb('chev', 13)}</button>
      ${IV.menu === 'cols' ? `<div class="dd-tb-menu cols" onclick="event.stopPropagation()">
        <div class="dd-tb-menu-h">Show columns<button onclick="ivShowAllCols()">Show all</button></div>
        <label class="dd-tb-col fixed"><span class="dd-tb-cb on">${ivTb('check', 11)}</span>${IV_LABEL[IV.dim]}<i>Always shown</i></label>
        ${cols.map(c => `<label class="dd-tb-col" onclick="ivToggleCol('${c.id}')"><span class="dd-tb-cb${ivColVisible(c.id) ? ' on' : ''}">${ivTb('check', 11)}</span>${c.label}</label>`).join('')}
      </div>` : ''}
    </div>
    <div class="dd-tb-wrap">
      <button class="dd-tb-btn primary${IV.menu === 'export' ? ' open' : ''}" onclick="event.stopPropagation(); ivToggleMenu('export')">${ivTb('download')}<span>Export</span>${ivTb('chev', 13)}</button>
      ${IV.menu === 'export' ? `<div class="dd-tb-menu export" onclick="event.stopPropagation()">
        <div class="dd-tb-menu-h">Export ${IV_PLURAL[IV.dim].toLowerCase()}</div>
        <button class="dd-tb-item" onclick="ivExport('csv')"><span class="ic csv">${ivTb('csv', 16)}</span><span><b>CSV file</b><i>Opens in Excel, Sheets, Numbers</i></span></button>
        <button class="dd-tb-item" onclick="ivExport('xlsx')"><span class="ic xls">${ivTb('xls', 16)}</span><span><b>Excel workbook</b><i>.xlsx with numeric cells</i></span></button>
        <button class="dd-tb-item" onclick="ivExport('copy')"><span class="ic copy">${ivTb('copy', 16)}</span><span><b>Copy to clipboard</b><i>Paste straight into a sheet</i></span></button>
        <div class="dd-tb-menu-f">Visible columns · rows matching search</div>
      </div>` : ''}
    </div>
  </div>`;
}
function ivSectionHtml(rows){
  const n = ivInvsInRange().length;
  const desc = IV.dim === 'inv'
    ? `${n} ${IV.freq.toLowerCase()} inventor${n === 1 ? 'y' : 'ies'} in this range · click a date to drill into its categories, or the receipt icon for its Inventory Breakdown`
    : IV.dim === 'item' ? `Supplier items are the counted leaf · ${rows} rows`
    : `Click a name to drill down, or an icon to break down by any level · ${rows} rows`;
  return `<div class="dd-section-row">
    <div class="dd-section"><div class="h">Breakdown by ${IV_LABEL[IV.dim].toLowerCase()}</div><div class="desc">${desc}</div></div>
    <div class="dd-tb-row">${ivToolbarHtml()}</div>
  </div>
  <div class="iv-dimrow">${ivDimChipsHtml()}</div>`;
}
function ivToggleMenu(m){ IV.menu = IV.menu === m ? null : m; ivRender(); }
function ivToggleCol(id){ IV.hiddenCols[id] = !IV.hiddenCols[id]; try { localStorage.setItem('iv-dd-hidden-cols-v2', JSON.stringify(IV.hiddenCols)); } catch (e) {} ivRender(); }
function ivShowAllCols(){ IV.hiddenCols = {}; try { localStorage.removeItem('iv-dd-hidden-cols-v2'); } catch (e) {} ivRender(); }
function ivClearSearch(){ const i = document.querySelector('#tab-deepdive .dd-tb-search input'); if (i) { i.value = ''; i.focus(); } ivFilterRows(''); }
function ivFilterRows(q){
  IV.q = q;
  const query = q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('#tab-deepdive .dd-table tbody tr').forEach(tr => {
    const hit = !query || (tr.getAttribute('data-rowname') || '').indexOf(query) >= 0;
    tr.style.display = hit ? '' : 'none'; if (hit && !tr.classList.contains('iv-cathead')) shown++;
  });
  const nm = document.querySelector('#tab-deepdive .dd-nomatch'); if (nm) nm.style.display = shown ? 'none' : '';
  const box = document.querySelector('#tab-deepdive .dd-tb-search'); if (box) box.classList.toggle('has-q', !!query);
}

/* ============================================================
   Sorting
   ============================================================ */
function ivSortTh(key, label, info, sortable){
  if (sortable === false) return `<th title="${(info || '').replace(/"/g, '')}">${label}</th>`;
  const s = IV.sort, on = s && s.key === key;
  return `<th class="dd-sortable${on ? ' sorted' : ''}" onclick="ivSortBy('${key}')" title="Sort by ${label}${info ? ' — ' + info.replace(/"/g, '') : ''}">${label}<span class="dd-sort-ic">${on ? (s.dir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>`;
}
function ivSortBy(key){
  const s = IV.sort, first = key === 'name' ? 'asc' : 'desc';
  if (!s || s.key !== key) IV.sort = { key, dir:first };
  else if (s.dir === first) IV.sort = { key, dir:first === 'asc' ? 'desc' : 'asc' };
  else IV.sort = null;
  ivRender();
}
function ivDefaultSort(groups, source){
  const dim = IV.dim;
  if (dim === 'inv') { groups.sort((a, b) => ivCount(b.meta.id).day - ivCount(a.meta.id).day); return; }
  if (dim === 'major') { const o = INV_TYPES; groups.sort((a, b) => o.indexOf(a.meta.id) - o.indexOf(b.meta.id)); return; }
  if (dim === 'event') { const o = IV_EVENTS.map(e => e.id); groups.sort((a, b) => o.indexOf(a.meta.id) - o.indexOf(b.meta.id)); return; }
  const key = source === 'menu' ? 'menuSales' : dim === 'supplier' || dim === 'dc' ? 'purchases' : 'actCost';
  groups.sort((a, b) => b.agg[key] - a.agg[key]);
}
function ivApplySort(groups){
  const s = IV.sort;
  if (!s) return;
  const sign = s.dir === 'asc' ? 1 : -1;
  if (s.key === 'name') {
    if (IV.dim === 'inv') groups.sort((a, b) => sign * (ivCount(a.meta.id).day - ivCount(b.meta.id).day));
    else groups.sort((a, b) => sign * ivRowLabel(a).name.localeCompare(ivRowLabel(b).name));
    return;
  }
  if (!ivColIds(IV.dim).includes(s.key)) return;
  groups.sort((a, b) => sign * (a.agg[s.key] - b.agg[s.key]));
}

/* ============================================================
   Table
   ============================================================ */
function ivContextCell(p){
  if (p.dim === 'supplier') return `<div class="dd-row-flex iv-ctx">${ivSupBadge(p.id, true)}<span>${p.label}</span></div>`;
  if (p.dim === 'event') { const ev = ivEventDef(p.id); return `<span class="dd-ctx-tag" style="background:${ev.bg};color:${ev.tone}">${p.label}</span>`; }
  if (p.dim === 'minor') { const c = IV_CAT_ICON[p.id]; return `<span class="dd-ctx-tag" style="background:${c.bg};color:${c.fg}">${p.label}</span>`; }
  if (p.dim === 'major') { const c = IV_MAJOR_TONE[p.id] || IV_CAT_ICON.dry; return `<span class="dd-ctx-tag" style="background:${c.bg};color:${c.fg}">${p.label}</span>`; }
  const t = IV_TONE[p.dim]; return `<span class="dd-ctx-tag" style="background:${t.bg};color:${t.fg}">${p.label}</span>`;
}
function ivWarnBreak(records){
  const c = {};
  records.forEach(r => invRecordWarnings(r).forEach(w => { c[w] = (c[w] || 0) + 1; }));
  const parts = Object.keys(c).map(w => w + ': ' + c[w]);
  return parts.length ? parts.join(' · ') : 'No warnings';
}
const IV_DRILL_PRIORITY = IV_DIMS;   // hierarchy order: Inventory → Major → Minor → Ingredient → Supplier Item → Supplier → DC → Menu → Exception
function ivDrillOrder(g){ const opts = ivBreakdownOptions(g); return IV_DRILL_PRIORITY.filter(d => opts.indexOf(d) >= 0); }
function ivDrillIcons(g, i){
  const all = ivDrillOrder(g);
  const isInv = g.meta.dim === 'inv';
  const room = isInv ? 2 : 4;
  const shown = all.length > room + 1 ? all.slice(0, room) : all, rest = all.slice(shown.length);
  const btn = d => {
    const t = IV_TONE[d];
    const title = d === 'event' ? 'View exceptions (variance, waste, PAR…)' : 'Break down by ' + IV_LABEL[d];
    return `<button class="dd-drill" title="${title}" style="background:${t.bg};color:${t.fg}" onclick="event.stopPropagation(); ivBreakDownRow(${i}, '${d}')">${ivSvg(d)}</button>`;
  };
  const bd = isInv ? `<button class="dd-drill iv-bd-btn" title="Inventory Breakdown — opening inventory, sales, deliveries, transfers, menu mix, waste" style="background:${IV_TONE.breakdown.bg};color:${IV_TONE.breakdown.fg}" onclick="event.stopPropagation(); ivOpenBreakdown('${g.meta.id}')">${ivSvg('breakdown')}</button>` : '';
  const more = rest.length ? `<button class="dd-drill iv-more" title="More breakdowns: ${rest.map(d => IV_LABEL[d]).join(', ')}" onclick="event.stopPropagation(); ivDrillMore(${i}, this)">+${rest.length}</button>` : '';
  return `<div class="dd-drills">${bd}${shown.map(btn).join('')}${more}</div>`;
}
function ivDrillMore(i, el){
  ivCloseMore();
  const g = IV_GROUPS[i];
  const all = ivDrillOrder(g), room = g.meta.dim === 'inv' ? 2 : 4;
  const rest = all.slice(all.length > room + 1 ? room : all.length);
  const pop = document.createElement('div');
  pop.id = 'iv-more-pop'; pop.className = 'dd-tb-menu iv-more-pop';
  pop.onclick = e => e.stopPropagation();
  pop.innerHTML = `<div class="dd-tb-menu-h">Break down by</div>` + rest.map(d => {
    const t = IV_TONE[d];
    return `<button class="dd-tb-item" onclick="ivCloseMore(); ivBreakDownRow(${i}, '${d}')"><span class="ic" style="background:${t.bg};color:${t.fg}">${ivSvg(d, 16)}</span><span><b>${IV_LABEL[d]}</b><i>${IV_PLURAL[d]} for ${ivRowLabel(g).name}</i></span></button>`;
  }).join('');
  document.body.appendChild(pop);
  const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  pop.style.top = (r.bottom + 6 + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
}
function ivCloseMore(){ const p = document.getElementById('iv-more-pop'); if (p) p.remove(); }

/* one metric cell */
function ivMetricCell(g, k, agg, ctx, invs, prior, source, unit, singleUnit, name, sub){
  const v = agg[k.id];
  if (k.fmt === 'qty' && !singleUnit) return `<td class="dd-metric-cell"><div class="v zero">—</div></td>`;
  if (k.fmt === 'text') return `<td class="dd-metric-cell iv-text">${ivCell(v, k, unit)}${k.subFn ? `<div class="iv-sub">${k.subFn(agg)}</div>` : ''}</td>`;
  let flag = false;
  const limit = singleUnit ? ivIng(g.records[0].ingredient).varLimit : null;
  if (k.id === 'varQty' && limit != null) flag = agg.actQty < 0 || (agg.theoCost > 0 && Math.abs(agg.varIdeal) > limit && Math.abs(agg.variance) >= 15);
  if (k.id === 'actQty' && agg.actQty < 0) flag = true;
  if (k.id === 'actPct' && g.meta.dim === 'inv' && !IV.path.length) flag = v - k.target >= k.thresholdPct;
  if (k.id === 'varPct' && g.meta.dim === 'inv' && !IV.path.length) flag = v > k.target;
  if ((k.id === 'belowPar' || k.id === 'highVar') && v > 0) flag = true;
  if (k.id === 'fillRate' && v < k.target) flag = true;
  if (k.id === 'closeQty' && agg.belowPar && singleUnit && IV.dim === 'item') flag = true;
  if (k.id === 'priceChg' && v > 4) flag = true;
  const color = flag || ivIsBad(k, v) ? '#B42318' : k.accent;
  const val = k.id === 'warnCount' ? `<span class="dd-warn-pill${v ? ' on' : ''}" title="${ivWarnBreak(g.records)}">${v ? '⚠ ' : ''}${v}</span>` : ivCell(v, k, unit);
  const subLine = k.subFn ? `<div class="iv-sub${flag && k.id === 'varQty' ? ' flag' : ''}">${k.subFn(agg)}</div>` : '';
  const spark = k.plain || k.id === 'warnCount' ? '' : ivSparkHtml(ivSeries(source, ctx, invs, k), k, color, name, sub, ctx, source, singleUnit ? unit : '');
  const cmp = k.plain ? '' : ivCmpChip(k, v, prior, singleUnit ? unit : '');
  const zero = k.id !== 'warnCount' && Math.abs(v) < 0.005;
  return `<td class="dd-metric-cell${k.plain ? ' iv-plain' : ''}"><div class="mc"><div class="mc-l"><div class="v${flag ? ' flag' : ''}${zero ? ' zero' : ''}">${val}</div>${subLine}${spark}</div>${cmp ? `<div class="mc-r">${cmp}</div>` : ''}</div></td>`;
}
/* category header row inside the Ingredient level (HubWorks variance detail
   groups ingredients under their category with its $ | % subtotal) */
function ivCatHeadHtml(catId, groups, kpis, ctxCount, showDrill){
  const recs = [].concat.apply([], groups.map(g => g.records));
  const a = invAggregate(recs);
  const name = ivCat(catId) ? ivCat(catId).name : catId;     // minor id or major name
  const cells = kpis.map(k => {
    let v = '';
    if (k.subFn) v = k.subFn(a);
    else if (k.fmt === 'dollar' || k.fmt === 'percent' || k.fmt === 'pts') v = ivFmt(a[k.id], k);
    else if (k.id === 'warnCount') v = a.warnCount ? '⚠ ' + a.warnCount : '';
    return `<td class="iv-cathead-v">${v}</td>`;
  }).join('');
  const names = groups.map(g => { const l = ivRowLabel(g); return l.name + ' ' + l.sub; }).join(' ').toLowerCase().replace(/"/g, '');
  return `<tr class="iv-cathead" data-rowname="${names} ${name.toLowerCase()}"><td class="iv-cathead-n">${name}<span>${groups.length} ingredient${groups.length > 1 ? 's' : ''}</span></td>${'<td></td>'.repeat(ctxCount)}${cells}${showDrill ? '<td class="dd-drill-cell"></td>' : ''}</tr>`;
}
function ivTableHtml(groups, source){
  const ctxCols = IV.path.filter(p => p.dim !== IV.dim && p.dim !== 'inv');   // the inventory is already in the breadcrumb
  const kpis = ivColKpis(IV.dim).filter(k => ivColVisible(k.id));
  const showDrill = ivColVisible('drill');
  const nameLbl = IV.dim === 'inv' ? 'Inv. Date' : IV.dim === 'ingredient' ? 'Item Name' : IV_LABEL[IV.dim];
  const thead = `<tr>${ivSortTh('name', nameLbl)}${ctxCols.map(p => `<th class="dd-ctx-th">${IV_LABEL[p.dim]}</th>`).join('')}${kpis.map(k => ivSortTh(k.id, k.label, k.info, k.fmt !== 'text')).join('')}${showDrill ? '<th class="iv-drill-th">Detailed view</th>' : ''}</tr>`;
  const rowHtml = (g, i) => {
    const agg = g.agg, { name, sub } = ivRowLabel(g);
    const unit = source === 'item' ? g.records[0].unit : '';
    const singleUnit = source === 'item' && ivDistinct(g.records, 'ingredient') === 1;
    const ctx = ivRowCtx(g, name), invs = ivTrendInvs(g), prior = ivPrior(g, source, ctx);
    const cells = kpis.map(k => ivMetricCell(g, k, agg, ctx, invs, prior, source, unit, singleUnit, IV.dim === 'inv' ? ivInvName(ivCount(g.meta.id)) : name, sub)).join('');
    const clickable = !!ivDefaultDrill(g);
    return `<tr class="${clickable ? 'clickable' : ''}" data-rowname="${(name + ' ' + sub).toLowerCase().replace(/"/g, '')}" ${clickable ? `onclick="ivDrillRow(${i})"` : ''}>
      <td class="dd-row-name"><div class="dd-row-flex">${ivRowLead(g)}<div><div class="nm">${name}${ivRowBadge(g, agg)}</div><div class="sub">${sub}</div></div></div></td>
      ${ctxCols.map(p => `<td class="dd-ctx-td">${ivContextCell(p)}</td>`).join('')}
      ${cells}
      ${showDrill ? `<td class="dd-drill-cell">${ivDrillIcons(g, i)}</td>` : ''}
    </tr>`;
  };
  let body = '';
  const catKey = IV.catView === 'major' && !IV.path.some(p => p.dim === 'major') ? 'type' : 'category';
  const cats = IV.dim === 'ingredient' && !IV.sort && source === 'item' ? Array.from(new Set(groups.map(g => g.records[0][catKey]))) : [];
  if (cats.length > 1) {
    // keep the default actual-$ order inside each category, categories by their actual $
    const byCat = {}; groups.forEach((g, i) => { (byCat[g.records[0][catKey]] = byCat[g.records[0][catKey]] || []).push({ g, i }); });
    const total = c => byCat[c].reduce((s, x) => s + x.g.agg.actCost, 0);
    cats.sort((a, b) => total(b) - total(a));
    cats.forEach(c => { body += ivCatHeadHtml(c, byCat[c].map(x => x.g), kpis, ctxCols.length, showDrill) + byCat[c].map(x => rowHtml(x.g, x.i)).join(''); });
  } else body = groups.map(rowHtml).join('');
  return `<div class="dd-table-wrap"><table class="dd-table${IV.dim === 'ingredient' ? ' iv-detail' : ''}"><thead>${thead}</thead><tbody>${body}</tbody></table>
    <div class="dd-nomatch" style="display:none">No ${IV_PLURAL[IV.dim].toLowerCase()} match your search. <button onclick="ivClearSearch()">Clear search</button></div></div>`;
}

/* ============================================================
   Inventory Breakdown pop-up: the events behind one inventory count
   (same sections as the HubWorks Inventory Breakdown tab)
   ============================================================ */
function ivOpenBreakdown(invId){ IV.bd = invId; ivRenderModal(); }
function ivBdCard(title, head, rows, foot, empty, extraCls){
  return `<div class="iv-bd-card${extraCls ? ' ' + extraCls : ''}">
    <div class="iv-bd-h">${title}</div>
    ${rows.length ? `<div class="iv-bd-scroll"><table class="iv-bd-t"><thead><tr>${head.map(h => `<th${h.r ? ' class="r"' : ''}>${h.l}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${head[i].r ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      ${foot ? `<tfoot><tr>${foot.map((c, i) => `<td${head[i].r ? ' class="r"' : ''}>${c}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`
      : `<div class="iv-bd-empty">${empty}</div>`}
  </div>`;
}
function ivBreakdownHtml(){
  const c = ivCount(IV.bd);
  if (!c) return '';
  const a = invAggregate(INV_RECORDS.filter(r => r.invId === c.id));
  const inPer = d => d > c.openDay && d <= c.day;
  const st = s => `<span class="iv-status ${s === 'Finalized' ? 'ok' : 'pending'}">${s}</span>`;
  const prevC = INV_COUNTS.find(x => x.freq === c.freq && x.day === c.openDay);
  const sales = []; for (let d = c.day; d > c.openDay; d--) sales.push([invMDY(d), invSalesUpdatedAt(d), siFmtDollar(INV_DAY_SALES[d])]);
  const invs = INV_INVOICES.filter(x => inPer(x.day)).sort((x, y) => y.day - x.day);
  const trf = INV_TRANSFERS.filter(x => inPer(x.day));
  const waste = INV_WASTE_LOGS.filter(x => inPer(x.day)).sort((x, y) => y.day - x.day);
  const mix = []; for (let d = c.day; d > c.openDay; d--) mix.push(invDayMenuMix(d));
  const sum = [['Sales($)', siFmtDollar(a.netSales)], ['Actual($)', siFmtDollar(a.actCost)], ['Actual Usage(%)', ivPct(a.actPct)], ['Ideal Usage($)', siFmtDollar(a.theoCost)],
    ['Ideal Usage(%)', ivPct(a.theoPct)], ['Variance($)', siFmtDollar(a.variance)], ['Variance(%)', ivPct(a.varPct)], ['Waste($)', siFmtDollar(a.wasteCost)], ['Inventory Value($)', siFmtDollar(a.invValue)]];
  const topReason = by => Object.keys(by).sort((x, y) => by[y] - by[x])[0];
  return `<div class="dd-modal-overlay" onclick="ivCloseModal()">
    <div class="dd-modal dz iv-bd" onclick="event.stopPropagation()">
      <div class="dz-head">
        <div class="dz-head-ic">${ivSvg('breakdown', 26)}</div>
        <div class="dz-head-tx"><div class="dz-title">Inventory Breakdown · ${ivInvName(c)}</div>
          <div class="dz-sub">Opening ${invMDY(c.openDay)} &nbsp;•&nbsp; ${c.days} days &nbsp;•&nbsp; ${a.itemCount} items counted &nbsp;•&nbsp; ${c.status}${c.finBy ? ' by ' + c.finBy : ''}${c.missed ? ` &nbsp;•&nbsp; <b class="iv-warn-t">${c.missed} scheduled count${c.missed > 1 ? 's' : ''} missed</b>` : ''}</div></div>
        <div class="dz-head-r"><button class="dz-x" onclick="ivCloseModal()" title="Close">×</button></div>
      </div>
      <div class="iv-bd-sum"><div class="iv-bd-h">Summary Breakdown</div>
        <div class="iv-bd-sum-g">${sum.map(s => `<div><span>${s[0]}</span><b>${s[1]}</b></div>`).join('')}</div></div>
      <div class="iv-bd-grid">
        ${ivBdCard('Opening Inventory', [{ l:'Date' }, { l:'Inventory Value($)', r:1 }, { l:'Status', r:1 }],
          [[invMDY(c.openDay), siFmtDollar(a.openValue), st(prevC ? prevC.status : 'Finalized')]], null, '')}
        ${ivBdCard('Sales', [{ l:'Date' }, { l:'Last Updated At' }, { l:'Sales($)', r:1 }], sales,
          ['Total', sales.length + ' days', siFmtDollar(c.sales)], 'No sales posted')}
        ${ivBdCard('Supplier Deliveries', [{ l:'Received Date' }, { l:'Invoice Number' }, { l:'Supplier' }, { l:'Amount($)', r:1 }, { l:'Status', r:1 }],
          invs.map(x => [invMDY(x.day), x.num, (ivSup(x.supplier).short || ivSup(x.supplier).name) + (x.short ? ' <span class="iv-short">Short</span>' : ''), siFmtDollar(x.amount), st(x.status)]),
          ['Total', invs.length + ' invoices', '', siFmtDollar(invs.reduce((s, x) => s + x.amount, 0)), ''], 'No deliveries received')}
        ${ivBdCard('Transfers', [{ l:'Transfer Date' }, { l:'Transfer ID' }, { l:'Type' }, { l:'Store' }, { l:'Amount($)', r:1 }, { l:'Status', r:1 }],
          trf.map(x => [invMDY(x.day), x.id, x.dir === 'in' ? 'Transfer In' : 'Transfer Out', x.store, (x.dir === 'out' ? '-' : '') + siFmtDollar(x.amount), st(x.status)]),
          null, 'No transfers in this period')}
        ${ivBdCard('Menu Mix', [{ l:'Menu Mix Date' }, { l:'Units Sold', r:1 }, { l:'Profit(%)', r:1 }, { l:'Status', r:1 }],
          mix.map(x => [invMDY(x.day), ivNum(x.units, 0), x.profit.toFixed(2), st(x.status)]), null, 'No menu mix posted')}
        ${ivBdCard('Waste', [{ l:'Waste Date' }, { l:'Waste ID' }, { l:'Top Reason' }, { l:'Amount($)', r:1 }, { l:'Status', r:1 }],
          waste.map(x => [invMDY(x.day), x.id, topReason(x.by), siFmtDollar(x.amount), st(x.status)]),
          ['Total', waste.length + ' entries', '', siFmtDollar(waste.reduce((s, x) => s + x.amount, 0)), ''], 'No waste logged')}
      </div>
    </div>
  </div>`;
}

/* ============================================================
   Export
   ============================================================ */
function ivExport(kind){
  const kpis = ivColKpis(IV.dim).filter(k => ivColVisible(k.id));
  const q = (IV.q || '').trim().toLowerCase();
  const unitLbl = { dollar:' ($)', percent:' (%)', pts:' (%)', days:' (days)', unitcost:' ($/unit)' };
  const withUnit = IV.dim === 'ingredient' || IV.dim === 'item';
  const isInv = IV.dim === 'inv';
  const header = [isInv ? 'Inv. Date' : IV_LABEL[IV.dim], 'Detail'].concat(withUnit ? ['Unit'] : [], isInv ? ['Count Frequency', 'Status', 'Finalized By'] : [], kpis.map(k => k.label + (unitLbl[k.fmt] || '')));
  const rows = IV_GROUPS.map(g => {
    const { name, sub } = ivRowLabel(g);
    if (q && (name + ' ' + sub).toLowerCase().indexOf(q) < 0) return null;
    const c = isInv ? ivCount(g.meta.id) : null;
    return [name, sub].concat(withUnit ? [g.records[0].unit] : [], c ? [c.freq, c.status, c.finBy] : [], kpis.map(k => k.fmt === 'text' ? (g.agg[k.id] || '') : Math.round(g.agg[k.id] * 100) / 100));
  }).filter(Boolean);
  IV.menu = null; ivRender();
  const r = ivRange();
  const iso = d => { const x = invDate(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const fname = ext => `inventory-deep-dive_${IV.freq.toLowerCase()}_${IV.dim}_${iso(r.start)}_to_${iso(r.end)}.${ext}`;
  if (kind === 'csv') {
    const esc = v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    ivDownload(new Blob(['﻿' + [header].concat(rows).map(x => x.map(esc).join(',')).join('\r\n')], { type:'text/csv;charset=utf-8' }), fname('csv'));
    ivToast(`Exported ${rows.length} rows to CSV`);
  } else if (kind === 'copy') {
    const tsv = [header].concat(rows).map(x => x.join('\t')).join('\n');
    const done = () => ivToast(`Copied ${rows.length} rows — paste into any sheet`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(done, () => ivCopyFallback(tsv, done)); else ivCopyFallback(tsv, done);
  } else {
    const write = () => {
      const ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
      ws['!cols'] = header.map((h, i) => ({ wch: i < 2 ? 30 : Math.max(12, h.length + 2) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, IV_PLURAL[IV.dim].slice(0, 31)); XLSX.writeFile(wb, fname('xlsx'));
      ivToast(`Exported ${rows.length} rows to Excel`);
    };
    if (window.XLSX) return write();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = write; s.onerror = () => ivToast('Could not load the Excel exporter — try CSV instead');
    document.head.appendChild(s);
  }
}
function ivDownload(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function ivCopyFallback(text, done){ const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { ivToast('Copy failed — use CSV instead'); } ta.remove(); }
function ivToast(msg){
  let t = document.getElementById('dd-toast');
  if (!t) { t = document.createElement('div'); t.id = 'dd-toast'; t.className = 'dd-toast'; document.body.appendChild(t); }
  t.innerHTML = ivTb('check', 14) + '<span>' + msg + '</span>';
  t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ============================================================
   Trend pop-up: one point per inventory count of the selected
   frequency; click a point to drill into that inventory
   ============================================================ */
const IV_ZI = {
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>', down:'<path d="M12 5v14M19 12l-7 7-7-7"/>', bars:'<path d="M12 20V10M18 20V4M6 20v-4"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', bulb:'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',
  dollar:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', percent:'<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>', store:'<path d="M4 9h16v11H4zM3 9l2-4h14l2 4"/><path d="M9 20v-6h6v6"/>',
};
const ivZi = (n, s) => `<svg width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IV_ZI[n] || IV_SVG[n]}</svg>`;
function ivOpenZoom(i){ const s = IV_SPARKS[i]; if (!s) return; IV.zoom = s; ivRenderModal(); }
function ivCloseModal(){ IV.zoom = null; IV.bd = null; ivRenderModal(); }
function ivRenderModal(){ const h = document.getElementById('iv-modal-host'); if (h) h.innerHTML = IV.bd ? ivBreakdownHtml() : ivZoomHtml(); }
function ivZoomHtml(){
  const z = IV.zoom;
  if (!z) return '';
  const k = Object.assign({}, ivKpi(z.kpiId), { label:z.label || ivKpi(z.kpiId).label }), unit = z.unit || '';
  const all = ivFreqCounts(), list = IV.freq === 'Daily' ? all.slice(-30) : all;
  const pts = ivSeries(z.source, z.ctx, list, k);
  IV.zoomBuckets = pts;
  const n = pts.length;
  if (!n) return '';
  const vals = pts.map(p => p.value), labels = pts.map(p => p.label);
  const W = 1000, H = 250, L = 8, R = 16, T = 14, B = 30;
  const thr = ivHasTarget(k) ? k.target : null;
  let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (thr != null) { lo = Math.min(lo, thr); hi = Math.max(hi, thr); }
  const lo0 = Math.min.apply(null, vals);
  const pad = hi > lo ? (hi - lo) * 0.18 : (Math.abs(hi) * 0.12 || 1);
  lo -= pad; hi += pad; if (lo < 0 && lo0 >= 0) lo = 0;
  const X = i => n === 1 ? L + (W - L - R) / 2 : L + (i / (n - 1)) * (W - L - R);
  const Y = v => (H - B) - Math.min(1, Math.max(0, (v - lo) / (hi - lo))) * (H - B - T);
  const step = n === 1 ? (W - L - R) : (W - L - R) / (n - 1);
  const last = vals[n - 1], first = vals[0], delta = last - first, deltaPct = first ? delta / Math.abs(first) * 100 : 0;
  const peak = Math.max.apply(null, vals), pIdx = vals.indexOf(peak), low = Math.min.apply(null, vals), lIdx = vals.indexOf(low);
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  const badDelta = k.dir === 'up' ? delta < 0 : k.dir === 'down' ? delta > 0 : false;
  const color = z.color === '#B42318' ? '#6D28D9' : z.color;
  const r = ivRange();
  IV.zoomPts = vals.map((v, i) => ({ x:X(i) / W * 100, y:Y(v), val:ivFmt(v, k, unit), label:pts[i].full, bad:ivIsBad(k, v) }));
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => { const gv = lo + (hi - lo) * f; return { y:Y(gv).toFixed(1), label:ivAxis(gv, k) }; });
  const poly = vals.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  const area = 'M' + X(0).toFixed(1) + ',' + (H - B) + ' L' + poly.split(' ').join(' L') + ' L' + X(n - 1).toFixed(1) + ',' + (H - B) + ' Z';
  const ri = pts.map((p, i) => p.c.day >= r.start && p.c.day <= r.end ? i : -1).filter(i => i >= 0);
  const band = ri.length ? `<rect x="${(X(ri[0]) - step / 2).toFixed(1)}" y="${T}" width="${(X(ri[ri.length - 1]) - X(ri[0]) + step).toFixed(1)}" height="${H - B - T}" fill="${color}" opacity=".06"/>` : '';
  const lp = IV.zoomPts[n - 1];
  const scope = z.ctx.length ? z.ctx.map(c => c.label).join(' · ') : INV_STORE;
  const icon = k.fmt === 'dollar' ? 'dollar' : k.fmt === 'percent' || k.fmt === 'pts' ? 'percent' : k.fmt === 'qty' ? 'box' : 'bars';
  const headIc = z.store ? 'store' : (z.ctx.length ? z.ctx[z.ctx.length - 1].dim : 'inv');
  const stat = (tone, ic, lbl, val, foot, extra) => `<div class="dz-stat ${tone}"><div class="dz-stat-ic">${ivZi(ic, 22)}</div><div class="dz-stat-body"><div class="dz-stat-lbl">${lbl}</div><div class="dz-stat-val"${extra || ''}>${val}</div>${foot}</div></div>`;
  const drillAttr = i => ` onclick="ivZoomDrill(${i})" title="Drill into ${pts[i].full}" style="cursor:pointer"`;
  const every = Math.max(1, Math.ceil(n / 12));
  return `<div class="dd-modal-overlay" onclick="ivCloseModal()">
    <div class="dd-modal dz" onclick="event.stopPropagation()">
      <div class="dz-head">
        <div class="dz-head-ic">${ivZi(headIc, 26)}</div>
        <div class="dz-head-tx"><div class="dz-title">${z.title}</div><div class="dz-sub">${(z.sub || '').split(' · ').join(' &nbsp;•&nbsp; ')}</div></div>
        <div class="dz-head-r"><button class="dz-x" onclick="ivCloseModal()" title="Close">×</button></div>
      </div>
      <div class="dz-stats">
        ${stat('purple', icon, 'Latest', ivFmt(last, k, unit), `<div class="dz-stat-foot">${pts[n - 1].full}</div>`)}
        ${stat(badDelta ? 'red' : 'green', delta >= 0 ? 'up' : 'down', 'Change', ivDelta(delta, k, unit), `<div class="dz-pill">${ivZi(delta >= 0 ? 'up' : 'down', 11)} ${Math.abs(deltaPct).toFixed(1)}%</div><div class="dz-stat-foot">vs ${labels[0]}</div>`)}
        ${stat('blue', 'bars', 'Average', ivFmt(avg, k, unit), `<div class="dz-stat-foot">per count · ${n} ${IV.freq.toLowerCase()} counts</div>`)}
        ${stat('pink', 'up', 'Highest', ivFmt(peak, k, unit), `<div class="dz-stat-foot">${labels[pIdx]}</div>`, drillAttr(pIdx))}
        ${stat('amber', 'down', 'Lowest', ivFmt(low, k, unit), `<div class="dz-stat-foot">${labels[lIdx]}</div>`, drillAttr(lIdx))}
      </div>
      <div class="dz-chart-card">
        <div class="dz-chart-head">
          <div class="dz-chart-ic">${ivZi(icon, 18)}</div>
          <div class="dz-chart-tx"><div class="dz-chart-title">${k.label} Trend <span class="dz-info" title="${(k.info || 'One point per inventory count').replace(/"/g, '')}">${ivZi('info', 14)}</span></div>
            <div class="dz-chart-sub">One point per ${IV.freq.toLowerCase()} inventory · ${scope} (${labels[0]} – ${labels[n - 1]}) · shaded = selected range</div></div>
          <div class="dz-legend"><span><i style="background:${color}"></i>${k.label}</span>${thr != null ? `<span><i class="dash"></i>Target ${ivFmt(thr, k, unit)}</span>` : ''}</div>
        </div>
        <div class="dz-plot-wrap">
          <div class="dz-yaxis">${grid.map(g => `<div style="top:${g.y}px">${g.label}</div>`).join('')}</div>
          <div class="dz-plot" onmouseleave="ivZoomHover(${n - 1})">
            <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
              <defs><linearGradient id="ivzFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>
              ${band}
              ${grid.map(g => `<line x1="${L}" y1="${g.y}" x2="${W - R}" y2="${g.y}" stroke="#eef0f5" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
              <path d="${area}" fill="url(#ivzFill)"/>
              ${thr != null ? `<line x1="${L}" y1="${Y(thr).toFixed(1)}" x2="${W - R}" y2="${Y(thr).toFixed(1)}" stroke="#B42318" stroke-width="1.2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>` : ''}
              <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
              ${vals.map((v, i) => `<rect x="${Math.max(0, X(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H - B}" fill="transparent" style="cursor:pointer" onmouseenter="ivZoomHover(${i})" onclick="ivZoomDrill(${i})"/>`).join('')}
            </svg>
            ${IV.zoomPts.map(p => `<span class="dz-dot${p.bad ? ' bad' : ''}" style="left:${p.x}%;top:${p.y}px;--c:${color}"></span>`).join('')}
            <span class="dz-hl" id="iv-hl" style="left:${lp.x}%;top:${lp.y}px;--c:${color}"></span>
            <div class="dz-tip" id="iv-tip" style="left:${lp.x}%;top:${lp.y}px"><b style="color:${color}">${lp.val}</b><span>${lp.label}</span></div>
            <div class="dz-xaxis">${pts.map((p, i) => i % every === 0 || i === n - 1 ? `<span style="left:${(X(i) / W * 100).toFixed(2)}%">${labels[i]}</span>` : '').join('')}</div>
          </div>
        </div>
      </div>
      <div class="dz-hint-line">${ivZi('bulb', 15)}<span>Hover any point for its exact value · click a point to drill into that inventory</span></div>
    </div>
  </div>`;
}
function ivZoomHover(i){
  const p = (IV.zoomPts || [])[i], tip = document.getElementById('iv-tip'), hl = document.getElementById('iv-hl');
  if (!p || !tip || !hl) return;
  hl.style.left = tip.style.left = p.x + '%'; hl.style.top = tip.style.top = p.y + 'px';
  tip.querySelector('b').textContent = p.val; tip.querySelector('span').textContent = p.label;
  tip.classList.toggle('flip', p.x > 82); tip.classList.toggle('flipl', p.x < 12);
}
/* point click: pin that inventory (keeping the row's filters), next level down */
function ivZoomDrill(i){
  const z = IV.zoom, b = (IV.zoomBuckets || [])[i];
  if (!z || !b) return;
  const r = ivRange();
  if (b.c.day < r.start || b.c.day > r.end) IV.range = 'last3m';
  const path = z.ctx.concat([{ dim:'inv', id:b.c.id, label:ivInvName(b.c) }]);
  const used = path.map(p => p.dim);
  const next = z.source === 'menu' && used.indexOf('menu') >= 0 ? 'ingredient' : [IV.catView, 'minor', 'ingredient', 'item'].find(d => used.indexOf(d) < 0) || 'event';
  IV.path = path; IV.dim = next; IV.zoom = null; IV.sort = null;
  ivRender();
}

/* ============================================================
   Main render
   ============================================================ */
function ivRender(){
  const root = document.getElementById('tab-deepdive');
  if (!root) return;
  ivCloseMore();
  const invs = ivInvsInRange();
  const source = ivSource(IV.dim, IV.path);
  const scoped = ivRecords(source, IV.path, ivSet(invs));
  const groups = ivGroupBy(scoped, IV.dim);
  groups.forEach(g => { g.agg = ivAgg(source, g.records); });
  ivDefaultSort(groups, source);
  ivApplySort(groups);
  IV_GROUPS = groups; IV_SPARKS = [];
  const view = IV.dim + '|' + JSON.stringify(IV.path) + '|' + IV.freq;
  if (IV.lastView && IV.lastView !== view) IV.q = '';
  IV.lastView = view;
  const empty = invs.length ? 'No inventory records for this selection.' : `No ${IV.freq.toLowerCase()} inventory was counted in this range — widen the range or pick another count frequency.`;
  root.innerHTML = `
    ${ivRangeBarHtml()}
    <div class="dd-kpirow">${ivTilesHtml()}</div>
    <div class="card" style="padding:16px 18px 10px;">
      ${IV.path.length ? ivBreadcrumbHtml() + '<div style="height:10px;"></div>' : ''}
      ${ivSectionHtml(groups.length)}
      ${groups.length ? ivTableHtml(groups, source) : `<div class="dd-empty-note">${empty}</div>`}
    </div>
    <div id="iv-modal-host"></div>`;
  IV.zoom = null; IV.bd = null;
  if (IV.q) ivFilterRows(IV.q);
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (IV.zoom || IV.bd) ivCloseModal();
    else if (IV.menu) { IV.menu = null; ivRender(); }
    else if (IV_CAL.open) { IV_CAL.open = false; ivCalRender(); }
  });
  window.addEventListener('scroll', ivCloseMore, true);
  document.addEventListener('click', () => {
    ivCloseMore();
    if (IV_CAL.open) { IV_CAL.open = false; ivCalRender(); }
    if (IV.menu) { IV.menu = null; ivRender(); }
  });
}
