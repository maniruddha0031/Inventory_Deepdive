/* ============================================================
   Inventory Insight — Tab 1: Insights (copied from Schedule Insight)
   Ported from Main_Insight.html's "New Insights UI" (the
   feature-flagged redesign) — left list (Daily/Weekly + cards),
   right detail (badge, title, kpi chips, Root Cause, a
   checklist/evidence-table card, Recommendation). Rendering logic
   below is a near-verbatim port; only the data (insights-nui-data.js)
   and container ids are Inventory Insight's own (inv-insights-data.js).
   ============================================================ */

const SI_INS_STATE = { tab:'daily', activeId: null };

/* ---- shared icon set (ported) ---- */
const SI_INS_ICONS = {
  chart:'<path d="M3 12h4v9H3zM10 7h4v14h-4zM17 3h4v18h-4z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  dollar:'<path d="M12 2v20M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><circle cx="17.5" cy="8.5" r="2.5"/><path d="M15.8 13.7c2.8.5 4.7 2.6 4.7 5.3"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M8 12h8M8 16h8M8 8h4"/>',
  bulb:'<path d="M9 18h6M10 22h4"/><path d="M12 2a6.5 6.5 0 0 0-3.8 11.8c.6.44.8 1 .8 1.7V17h6v-1.5c0-.7.2-1.26.8-1.7A6.5 6.5 0 0 0 12 2z"/>',
  calendar:'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  coffee:'<path d="M4 8h13v6a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 14z"/><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 2.5v2M10.5 2.5v2M14 2.5v2"/>',
  scale:'<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 11v6M14 11v6"/>',
  truck:'<path d="M1 4h14v12H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
};
function siInsIcon(name, size){
  size = size || 16;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SI_INS_ICONS[name] || SI_INS_ICONS.info}</svg>`;
}

/* ---- KPI chip visual heuristic (ported) ---- */
function siInsChipVisual(chip){
  const label = chip.l.toLowerCase();
  if (chip.c === 'neg') return { bg:'#fde0e0', fg:'#dc2626', ic:'alert' };
  if (label.includes('employee') || label.includes('transaction')) return { bg:'#fbe4f1', fg:'#db2777', ic:'users' };
  if (chip.c === 'pos') return { bg:'#d9f7e6', fg:'#059669', ic: label.includes('$') ? 'dollar' : 'trend' };
  if (label.includes('$')) return { bg:'#ede4ff', fg:'#7c3aed', ic:'dollar' };
  return { bg:'#dbeafe', fg:'#2563eb', ic:'chart' };
}

/* ---- evidence-table row palette + cell/subject helpers (ported) ---- */
const SI_INS_ROW_PALETTE = [
  { bg:'#fde0e0', fg:'#dc2626' },
  { bg:'#fef1d9', fg:'#c2790a' },
  { bg:'#d9f7e6', fg:'#0d8a4e' },
  { bg:'#dbeafe', fg:'#2563eb' },
  { bg:'#ede4ff', fg:'#7c3aed' },
];

function siInsParseSubject(label){
  const m = (label || '').match(/^(.*?)\s*—\s*(.+?)\s*\(([^)]+)\)\s*$/);
  return m ? { name: m[2].trim(), meta: m[3].trim() } : null;
}

function siInsCellVisual(raw, accent){
  const s = String(raw);
  if (/am|pm/i.test(s)) return `<span class="nui-pill nui-pill-time">${siInsIcon('calendar', 12)}${s}</span>`;
  const bare = s.replace(/[$,%]/g, '').trim();
  if (/^-?\d+(\.\d+)?\s?(min|mins|hr|hrs|pts)?$/i.test(bare)) {
    return `<span class="nui-pill" style="background:${accent.bg};color:${accent.fg}">${s}</span>`;
  }
  if (/^(yes|no|on track)$/i.test(s.trim())) {
    const pos = /yes/i.test(s);
    return `<span class="nui-pill" style="background:${pos ? '#d9f7e6' : '#eef0f6'};color:${pos ? '#0d8a4e' : '#6b7280'}">${s}</span>`;
  }
  return `<span class="nui-plain">${s}</span>`;
}

function siInsRenderChecklist(ins){
  return ins.tableRows.map(r => `
    <div class="nui-checklist-row">
      <div class="nui-check-icon">${siInsIcon('check', 12)}</div>
      <div><div class="nui-checklist-main">${r[0]}</div><div class="nui-checklist-sub">${r[1]}</div></div>
    </div>`).join('');
}

/* numeric value of an evidence cell ("15.58 hrs", "$448.13", "-8.0 hrs",
   "21.2%"), or null for text / rates / placeholders */
function siInsNum(s){
  s = String(s).trim();
  if (s === '—' || /\/hr|if |[a-z]{4,}/i.test(s.replace(/hrs?|pts/gi, ''))) return null;
  const m = s.replace(/[$,+]/g, '').match(/^(-?\d+(?:\.\d+)?)\s*(hrs?|pts|%)?$/i);
  return m ? parseFloat(m[1]) : null;
}

/* compact evidence table: hairline rows, right-aligned numbers, a tone
   stripe on problem rows, an inline magnitude bar on the key (last numeric)
   column, and a total row when the numbers are additive */
function siInsRenderModernTable(ins){
  const headers = ins.tableHeaders;
  const mergeRole = headers[0] === 'Employee' && headers[1] === 'Role';
  const visibleHeaders = mergeRole ? [headers[0], ...headers.slice(2)] : headers;
  const bodyRows = ins.tableRows.map(r => mergeRole ? [r[0], ...r.slice(2)] : r);
  const nCols = visibleHeaders.length;

  // column kinds: numeric (every row parses, '—' allowed) vs text
  const numeric = visibleHeaders.map((h, c) => c > 0 && bodyRows.every(r => r[c] === '—' || siInsNum(r[c]) !== null) && bodyRows.some(r => siInsNum(r[c]) !== null));
  const barCol = numeric.lastIndexOf(true);
  const barMax = barCol > 0 ? Math.max(...bodyRows.map(r => Math.abs(siInsNum(r[barCol]) || 0)), 0.0001) : 1;
  const gridCols = visibleHeaders.map((h, c) => c === 0 ? 'minmax(220px,1.6fr)' : c === barCol ? 'minmax(170px,1.3fr)' : numeric[c] ? 'minmax(96px,.8fr)' : 'minmax(130px,1fr)').join(' ');

  const leadIconFor = (idx) => {
    if (ins.tableRowIcon) return ins.tableRowIcon[idx] || 'alert';
    if (headers[0] === 'Employee') return 'users';
    if (headers[0] === 'Date' || headers[0] === 'Day') return 'calendar';
    return 'alert';
  };

  // optional per-row tone ('bad' = problem row, 'ok' = normal) so colour
  // carries meaning; falls back to the rotating palette when not provided
  const TONE = { bad: SI_INS_ROW_PALETTE[0], warn: SI_INS_ROW_PALETTE[1], good: SI_INS_ROW_PALETTE[2], ok: SI_INS_ROW_PALETTE[3] };
  const toneOf = idx => (ins.tableRowTone && ins.tableRowTone[idx]) || '';

  const textCell = (s) => {
    s = String(s);
    if (/\d\s*(am|pm)\b/i.test(s)) return `<span class="mt-time">${siInsIcon('clock', 11)}${s}</span>`;
    if (/^no\b/i.test(s)) return `<span class="mt-tag bad">${s}</span>`;
    if (/^yes\b/i.test(s)) return `<span class="mt-tag good">${s}</span>`;
    if (/^available/i.test(s)) return `<span class="mt-tag good">${s}</span>`;
    return `<span class="mt-text">${s}</span>`;
  };

  const headHtml = `<div class="mt-head" style="grid-template-columns:${gridCols}">${visibleHeaders.map((h, c) =>
    `<span class="${numeric[c] ? 'r' : ''}">${h}</span>`).join('')}</div>`;

  const rowsHtml = bodyRows.map((row, idx) => {
    const tone = toneOf(idx);
    const accent = TONE[tone] || SI_INS_ROW_PALETTE[idx % SI_INS_ROW_PALETTE.length];
    const desc = ins.tableRowDesc ? ins.tableRowDesc[idx] : (mergeRole ? ins.tableRows[idx][1] : '');
    const cells = row.map((val, c) => {
      if (c === 0) return `<div class="mt-lead">
          <span class="mt-ic" style="background:${accent.bg};color:${accent.fg}">${siInsIcon(leadIconFor(idx), 14)}</span>
          <div class="mt-lead-tx"><div class="mt-label">${val}</div>${desc ? `<div class="mt-desc">${desc}</div>` : ''}</div>
        </div>`;
      if (!numeric[c]) return `<div>${textCell(val)}</div>`;
      const n = siInsNum(val);
      if (c === barCol) {
        const pct = n === null ? 0 : Math.max(3, Math.abs(n) / barMax * 100);
        const hot = tone === 'bad' || tone === 'warn';
        return `<div class="mt-barcell"><span class="mt-num ${hot ? 'hot' : ''}" style="${hot ? `color:${accent.fg}` : ''}">${val}</span>
          <span class="mt-bar"><i style="width:${pct.toFixed(1)}%;background:${hot ? accent.fg : '#c7cde0'}"></i></span></div>`;
      }
      return `<div class="r"><span class="mt-num">${val}</span></div>`;
    }).join('');
    return `<div class="mt-row ${tone ? 't-' + tone : ''}" style="grid-template-columns:${gridCols}">${cells}</div>`;
  }).join('');

  // total row: only for hours / dollar columns (not %, pts, counts of staff or rates)
  // skip columns with a '—' placeholder: a partial sum would be misleading
  const additive = c => numeric[c] && bodyRows.every(r => r[c] !== '—' && /hrs|^\s*-?\$/.test(r[c]));
  let totalHtml = '';
  if (bodyRows.length >= 3 && visibleHeaders.some((h, c) => additive(c))) {
    const cells = visibleHeaders.map((h, c) => {
      if (c === 0) return `<div class="mt-total-lbl">Total</div>`;
      if (!additive(c)) return '<div></div>';
      const sum = bodyRows.reduce((s, r) => s + (siInsNum(r[c]) || 0), 0);
      const isMoney = /\$/.test(bodyRows.find(r => r[c] !== '—')[c]);
      const txt = isMoney ? (sum < 0 ? '-' : '') + '$' + Math.abs(sum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : sum.toFixed(2).replace(/\.?0+$/, m => m.includes('.') ? '' : m) + ' hrs';
      return `<div class="${c === barCol ? 'mt-barcell' : 'r'}"><span class="mt-num tot">${isMoney ? txt : (Math.round(sum * 100) / 100).toFixed(2) + ' hrs'}</span>${c === barCol ? '<span class="mt-bar ghost"></span>' : ''}</div>`;
    }).join('');
    totalHtml = `<div class="mt-row mt-total" style="grid-template-columns:${gridCols}">${cells}</div>`;
  }

  return `<div class="mt">${headHtml}${rowsHtml}${totalHtml}</div>`;
}

/* ---- shell + list + detail ---- */
/* left-panel mode buttons: AI Insights (Daily + Weekly list) | AI Hub (the
   AI Hub screen, moved in place — its own rail on the left, drilldown right) */
function siInsModeBarHtml(mode){
  const sparkle = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.6 11 8.2a3 3 0 0 0 2 2l3.6 1.1-3.6 1.1a3 3 0 0 0-2 2L9.9 18l-1.1-3.6a3 3 0 0 0-2-2L3.2 11.3l3.6-1.1a3 3 0 0 0 2-2z" fill="currentColor" fill-opacity=".18"/><path d="M18 3v4M16 5h4M19 16v3M17.5 17.5h3"/></svg>';
  const hub = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity=".18"/><circle cx="5" cy="5" r="1.8"/><circle cx="19" cy="5" r="1.8"/><circle cx="5" cy="19" r="1.8"/><circle cx="19" cy="19" r="1.8"/><path d="M6.4 6.4 9.9 9.9M17.6 6.4l-3.5 3.5M6.4 17.6l3.5-3.5M17.6 17.6l-3.5-3.5"/></svg>';
  const n = SI_INS_ALL.length;
  return `<div class="ins-modebar">
    <button class="ins-mode${mode === 'ins' ? ' active' : ''}" onclick="siInsSetMode('ins')" title="Daily & weekly inventory insights">
      <span class="ins-mode-ic">${sparkle}</span><span class="ins-mode-tx">AI Insights</span><em class="ins-mode-n">${n}</em></button>
    <button class="ins-mode${mode === 'hub' ? ' active' : ''}" onclick="siInsSetMode('hub')" title="KPI root-cause drilldown">
      <span class="ins-mode-ic">${hub}</span><span class="ins-mode-tx">AI Hub</span></button>
  </div>`;
}

/* ---- Insights date bar (Insights tab only, not Deep Dive): pick a date to
   load that week's AI Insights + AI Hub, and a Refresh button ---- */
const SI_INS_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function siInsIso(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function siInsWeekLabel(d){
  // the last weekly count on or before the date: weekly counts close on
  // Sunday and cover Mon – Sun (Sep 30 -> week of Sep 21 – Sep 27)
  const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const mon = new Date(sun); mon.setDate(sun.getDate() - 6);
  return SI_INS_MON[mon.getMonth()] + ' ' + mon.getDate() + ' – ' + SI_INS_MON[sun.getMonth()] + ' ' + sun.getDate() + ', ' + sun.getFullYear();
}
function siInsDateBarHtml(){
  const d = SI_INS_STATE.date;
  const t = SI_INS_STATE.updatedAt || new Date();
  const time = ((t.getHours() + 11) % 12 + 1) + ':' + String(t.getMinutes()).padStart(2, '0') + (t.getHours() < 12 ? ' AM' : ' PM');
  return `<div class="ins-datebar">
    <div class="ins-date-l">
      <span class="ins-date-lbl">${siInsIcon('calendar', 15)}Insights for</span>
      <input type="date" class="ins-date-in" min="2026-07-01" max="2026-09-30" value="${siInsIso(d)}" onkeydown="return false" onclick="this.showPicker && this.showPicker()" onchange="siInsSetDate(this.value)">
      <span class="ins-week-chip">Weekly count ${siInsWeekLabel(d)}</span>
    </div>
    <div class="ins-date-r">
      <span class="ins-updated">Last updated ${time}</span>
      <button class="ins-refresh${siInsRefreshesLeft() ? "" : " off"}" onclick="siInsManualRefresh()" title="${siInsRefreshesLeft()} of ${SI_INS_REFRESH_LIMIT} refreshes left today">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg>Refresh
      </button>
    </div>
  </div>`;
}
function siInsSetDate(iso){
  if (!iso) return;
  const [y, m, dd] = iso.split('-').map(Number);
  SI_INS_STATE.date = new Date(y, m - 1, dd);
  siInsRefresh();          // loading another week doesn't use up a refresh
}

/* ---- manual Refresh is rationed: a few per day (the real app limits how
   often users can regenerate insights). Count kept per calendar day. ---- */
const SI_INS_REFRESH_LIMIT = 3;
function siInsRefreshKey(){ return 'si-ins-refresh-' + siInsIso(new Date()); }
function siInsRefreshesUsed(){ try { return parseInt(localStorage.getItem(siInsRefreshKey()), 10) || 0; } catch (e) { return SI_INS_STATE._used || 0; } }
function siInsRefreshesLeft(){ return Math.max(0, SI_INS_REFRESH_LIMIT - siInsRefreshesUsed()); }

function siInsToast(msg){
  let t = document.getElementById('ins-toast');
  if (!t) { t = document.createElement('div'); t.id = 'ins-toast'; t.className = 'ins-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

function siInsManualRefresh(){
  const left = siInsRefreshesLeft();
  if (left <= 0) { siInsToast('No refreshes left today. You can refresh again tomorrow.'); return; }
  const used = siInsRefreshesUsed() + 1;
  try { localStorage.setItem(siInsRefreshKey(), String(used)); } catch (e) { SI_INS_STATE._used = used; }
  const remain = SI_INS_REFRESH_LIMIT - used;
  siInsRefresh(() => siInsToast(`Insights refreshed. ${remain === 0 ? 'No' : remain} refresh${remain === 1 ? '' : 'es'} left today.`));
}
/* rebuild both views for the chosen week (the AI Hub screen is handed back
   and rebuilt first, since it lives inside this tab while in AI Hub mode) */
function siInsRefresh(done){
  const btn = document.querySelector('.ins-refresh');
  if (btn) btn.classList.add('spin');
  setTimeout(() => {
    SI_INS_STATE.updatedAt = new Date();
    siInsReturnHub();
    if (typeof buildAiHub === 'function') buildAiHub();
    const keep = SI_INS_STATE.activeId;
    siRenderInsights();
    if (keep != null && SI_INS_STATE.mode !== 'hub') siInsSelect(keep);
    if (typeof done === "function") done();
  }, 450);
}

function siRenderInsights(){
  const root = document.getElementById('tab-insights');
  if (!root) return;
  if (!SI_INS_STATE.date) SI_INS_STATE.date = new Date(2026, 8, 30);  // latest count in the data (Wed Sep 30)
  root.innerHTML = `
    ${siInsDateBarHtml()}
    <div class="ins-shell" id="insShell">
      <div class="al nui-on">
        <div class="at at-mode">${siInsModeBarHtml('ins')}</div>
        <div class="ai-wrap" id="insItems"></div>
      </div>
      <div class="ad nui-on" id="insDetail"></div>
    </div>
    <div id="insHubHost" style="display:none"></div>
  `;
  SI_INS_STATE.tab = 'all';
  SI_INS_STATE.mode = SI_INS_STATE.mode || 'ins';
  SI_INS_STATE.activeId = SI_INS_ALL[0].id;
  siInsRenderItems();
  siInsRenderDetail(SI_INS_STATE.activeId);
  if (SI_INS_STATE.mode === 'hub') siInsSetMode('hub');
}

/* AI Hub mode borrows the #content-aihub node from the AI Hub tab (ids
   stay unique) and puts the mode buttons at the top of its rail */
function siInsSetMode(mode){
  SI_INS_STATE.mode = mode;
  const shell = document.getElementById('insShell'), host = document.getElementById('insHubHost');
  const hub = document.getElementById('content-aihub');
  if (!shell || !host) return;
  if (mode === 'hub' && hub) {
    host.appendChild(hub);
    shell.style.display = 'none';
    host.style.display = '';
    const rail = hub.querySelector('.ahb-rail');
    if (rail) {
      const old = rail.querySelector('.ins-modebar-wrap'); if (old) old.remove();
      rail.insertAdjacentHTML('afterbegin', `<div class="ins-modebar-wrap">${siInsModeBarHtml('hub')}</div>`);
    }
  } else {
    siInsReturnHub();
    host.style.display = 'none';
    shell.style.display = '';
  }
}

/* give #content-aihub back to the AI Hub tab (also called by siSwitchTab) */
function siInsReturnHub(){
  const hub = document.getElementById('content-aihub');
  const home = document.getElementById('tab-aihub');
  if (!hub || !home || hub.parentNode === home) return;
  const bar = hub.querySelector('.ins-modebar-wrap'); if (bar) bar.remove();
  home.appendChild(hub);
}

/* kept for compatibility: jumps to the first insight of a group */
function siInsSwitchTab(tab){
  const first = SI_INS_ALL.find(i => i.group === tab);
  if (first) siInsSelect(first.id);
}

function siInsItemHtml(it){

  return `
    <div class="nui-item ${it.badge} ${it.id === SI_INS_STATE.activeId ? 'active' : ''}" data-id="${it.id}" onclick="siInsSelect(${it.id})">
      <div class="nui-icon-circle">${siInsIcon(SI_INS_LIST_ICON[it.id] || 'info', 18)}</div>
      <div class="nui-body">
        <div class="nui-row-top">
          <span class="nui-badge">${it.badgeText}</span>
        </div>
        <div class="nui-title nui-title-short" title="${it.title.split(' — ')[0].replace(/"/g, '&quot;')}">${it.short}</div>
      </div>
      <div class="nui-chevron">${siInsIcon('chevron', 15)}</div>
    </div>`;
}

/* one list: DAILY group then WEEKLY group */
function siInsRenderItems(){
  const daily = SI_INS_ALL.filter(i => i.group === 'daily');
  const weekly = SI_INS_ALL.filter(i => i.group === 'weekly');
  const group = (label, list, first) => `
    <div class="ins-grp${first ? ' first' : ''}"><span>${label}</span><em>${list.length}</em></div>
    ${list.map(siInsItemHtml).join('')}`;
  document.getElementById('insItems').innerHTML = group('Daily', daily, true) + group('Weekly', weekly, false);
}

function siInsSelect(id){
  SI_INS_STATE.activeId = id;
  document.querySelectorAll('.nui-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.id, 10) === id));
  siInsRenderDetail(id);
}

/* right panel:
   - classic: shows only the selected insight
   - "New UI": stacks every insight of the current tab; scrolling the panel
     highlights the matching card on the left (scroll-spy), and clicking a
     card scrolls to its section */
function siInsRenderDetail(id){
  const d = document.getElementById('insDetail');
  if (!d) return;
  const newUi = document.body.classList.contains('si-newui');
  if (!newUi) {
    const ins = SI_INS_ALL.find(i => i.id === id);
    if (!ins) return;
    SI_INS_STATE.stackTab = null;
    d.innerHTML = siInsDetailHtml(ins);
    d.scrollTop = 0;
    return;
  }
  // (re)build the stack only when the tab changes or we come from classic mode
  let rebuilt = false;
  if (SI_INS_STATE.stackTab !== SI_INS_STATE.tab || !d.querySelector('.nui-stack')) {
    rebuilt = true;
    const list = SI_INS_ALL;   // stacked feed: Daily then Weekly
    d.innerHTML = `<div class="nui-stack">${list.map(ins =>
      `<section class="nui-stack-item" id="nui-sec-${ins.id}" data-id="${ins.id}">${siInsDetailHtml(ins)}</section>`).join('')}</div>`;
    SI_INS_STATE.stackTab = SI_INS_STATE.tab;
    if (!d._spyBound) { d.addEventListener('scroll', siInsOnDetailScroll, { passive: true }); d._spyBound = true; }
  }
  const sec = document.getElementById('nui-sec-' + id);
  if (sec) {
    SI_INS_STATE.spyLock = Date.now() + 800;   // don't let the scroll-spy fight a click-scroll
    const top = d.scrollTop + sec.getBoundingClientRect().top - d.getBoundingClientRect().top - 16;
    d.scrollTo({ top: Math.max(0, top), behavior: rebuilt ? 'auto' : 'smooth' });
  }
}

/* scroll-spy: the section whose top has passed ~25% of the panel is active */
function siInsOnDetailScroll(){
  if (!document.body.classList.contains('si-newui')) return;
  if (SI_INS_STATE.spyLock && Date.now() < SI_INS_STATE.spyLock) return;
  const d = document.getElementById('insDetail');
  const secs = d.querySelectorAll('.nui-stack-item');
  if (!secs.length) return;
  const line = d.getBoundingClientRect().top + d.clientHeight * 0.25;
  let active = secs[0];
  secs.forEach(s => { if (s.getBoundingClientRect().top <= line) active = s; });
  // at the very bottom, the last section wins even if it is short
  if (d.scrollTop + d.clientHeight >= d.scrollHeight - 4) active = secs[secs.length - 1];
  const id = parseInt(active.dataset.id, 10);
  if (id === SI_INS_STATE.activeId) return;
  SI_INS_STATE.activeId = id;
  document.querySelectorAll('.nui-item').forEach(el => {
    const on = parseInt(el.dataset.id, 10) === id;
    el.classList.toggle('active', on);
    if (on) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function siInsDetailHtml(ins){
  const sev = ins.badge; // sev-good | sev-warn | sev-alert | sev-info
  const shortTitle = ins.title.split(' — ')[0];
  const badgeIcon = sev === 'sev-good' ? 'trend' : sev === 'sev-info' ? 'info' : 'alert';

  const headHtml = `
    <div class="nui-dhead">
      <span class="nui-dbadge ${sev}">${siInsIcon(badgeIcon, 13)} ${ins.badgeText}</span>
      <span class="nui-dshort ${sev}">${ins.short}</span>
    </div>`;

  const primaryChip = ins.chips.find(c => c.c === 'pos' || c.c === 'neg');
  const pillClass = primaryChip ? primaryChip.c : 'neutral';
  const pillHtml = primaryChip ? `<span class="nui-dpill ${pillClass}">${primaryChip.v}</span>` : '';

  const bodyRowHtml = `
    <div class="nui-dbody-row">
      <div>
        <div class="nui-dtitle">${shortTitle}</div>
        <div class="nui-dsub">${ins.meta}</div>
      </div>
      <div class="nui-dgraphic ${sev}">
        ${pillHtml}
        <i style="height:40%"></i><i style="height:65%"></i><i style="height:50%"></i><i style="height:85%"></i>
      </div>
    </div>`;

  const chipsHtml = `<div class="nui-chips">${ins.chips.map(c => {
    const v = siInsChipVisual(c);
    return `<div class="nui-chip">
      <div class="nui-chip-icon" style="background:${v.bg};color:${v.fg}">${siInsIcon(v.ic, 18)}</div>
      <div class="nui-chip-body">
        <div class="nui-chip-label">${c.l}</div>
        <div class="nui-chip-value ${c.c}">${c.v}</div>
      </div>
    </div>`;
  }).join('')}</div>`;

  const rootCauseHtml = `
    <div class="nui-card rootcause">
      <div class="nui-card-head"><div class="nui-card-head-icon">${siInsIcon('target', 15)}</div><div class="nui-card-title">Root Cause</div></div>
      ${ins.rootPoints
        ? `<ul class="nui-root-list">${ins.rootPoints.map(p => `<li>${p}</li>`).join('')}</ul>`
        : `<div class="nui-rootcause-box">${ins.rootCause}</div>`}
    </div>`;

  let tableHtml = '';
  if (ins.tableHeaders) {
    const isChecklist = ins.tableHeaders.length === 2;
    const subj = siInsParseSubject(ins.tableLabel);
    const body = isChecklist ? siInsRenderChecklist(ins) : siInsRenderModernTable(ins);
    const headRowHtml = `
      <div class="nui-card-head-row">
        <div class="nui-card-head">
          <div class="nui-card-head-icon">${siInsIcon('doc', 14)}</div>
          <div>
            <div class="nui-card-title">${ins.tableLabel || 'Detail'}</div>
            ${ins.tableSub ? `<div class="nui-card-sub">${ins.tableSub}</div>` : ''}
          </div>
        </div>
        ${subj ? `<div class="nui-subject-chip"><div class="nui-subject-icon">${siInsIcon('users', 15)}</div><div><div class="nui-subject-name">${subj.name}</div><div class="nui-subject-meta">${subj.meta}</div></div></div>` : ''}
      </div>`;
    tableHtml = `<div class="nui-card check">${headRowHtml}${body}</div>`;
  }

  const recHtml = `
    <div class="nui-card rec">
      <div class="nui-card-head"><div class="nui-card-head-icon">${siInsIcon('bulb', 15)}</div><div class="nui-card-title">Recommendation</div></div>
      <div class="nui-rec-lead">${ins.recommendation}</div>
      ${ins.actions.map(a => `
        <div class="nui-action-row"><div class="nui-action-dot"></div><div class="nui-action-text"><strong>${a.title}:</strong> ${a.body}</div></div>`).join('')}
    </div>`;

  // "New UI" setting: Root Cause + Recommendation side by side, evidence below.
  // Off: the original stacked order (Root Cause → evidence → Recommendation).
  const newUi = document.body.classList.contains('si-newui');
  return newUi
    ? `<div class="nui-detail">${headHtml}${bodyRowHtml}${chipsHtml}<div class="nui-pair">${rootCauseHtml}${recHtml}</div>${tableHtml}</div>`
    : `<div class="nui-detail">${headHtml}${bodyRowHtml}${chipsHtml}${rootCauseHtml}${tableHtml}${recHtml}</div>`;
}

if (typeof window !== 'undefined') {
  window.siRenderInsights = siRenderInsights;
  window.siInsSwitchTab = siInsSwitchTab;
  window.siInsSetMode = siInsSetMode;
  window.siInsSetDate = siInsSetDate;
  window.siInsRefresh = siInsRefresh;
  window.siInsManualRefresh = siInsManualRefresh;
  window.siInsReturnHub = siInsReturnHub;
  window.siInsSelect = siInsSelect;
}
