/* ============================================================
   AI Hub — advanced root-cause drilldown screen.
   Left-rail KPI selector + right-detail column. For the selected
   KPI this opens the full 3-level tree:
     L1  the KPI itself — value, variance, supporting stats
     L2  the drivers behind it (expandable)
     L3  store / item level evidence tables (expandable)
   plus the AI root-cause narrative, ranked fixes and impact trend.
   Also: an "Ask the Agent" chat panel docked beside the detail column,
   opened on demand from the AI summary card (see ahbToggleChat()).
   Data: ai-hub-data.js (AHUB_KPI_DATA, AHUB_IMPACT_DATA).
   ============================================================ */
const AHUB = { idx: 0 };

/* KPIs with `hidden:true` in ai-hub-data.js stay in AHUB_KPI_DATA (so the
   data isn't lost) but are excluded from the rail and from selection —
   every indexed lookup goes through this instead of AHUB_KPI_DATA directly. */
function ahbVisibleKpis(){
  return AHUB_KPI_DATA.filter(k=>!k.hidden);
}

function buildAiHub(){
  const el = document.getElementById('content-aihub');
  if(!el) return;
  el.innerHTML = ahbShellHtml();
  ahbRenderDetail();
  if(window.lucide) lucide.createIcons();
}

/* ---------------- shell: top bar + rail + detail mount ---------------- */
function ahbShellHtml(){
  return `
  <div class="ahb-wrap">
    <div class="ahb-body">
      ${ahbRailHtml()}
      <div class="ahb-col">
        <div class="ahb-hero-mount" id="ahb-hero-mount"></div>
        <div class="ahb-lower">
          <div class="ahb-scroll" id="ahb-detail"></div>
          ${ahbChatShellHtml()}
        </div>
      </div>
    </div>
  </div>`;
}

function ahbDateLabel(){
  // follows the Insights tab date picker when one is set
  const d = (typeof SI_INS_STATE !== "undefined" && SI_INS_STATE.date) ? SI_INS_STATE.date : new Date();
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return mon + ' ' + d.getDate() + ', ' + d.getFullYear();
}

const AHB_SEV_LABEL = { al:'Alert', wn:'Warning', info:'Info' };

function ahbRailHtml(){
  const kpis = ahbVisibleKpis();
  const alerts = kpis.filter(k=>k.sev==='al');
  const warns  = kpis.filter(k=>k.sev==='wn');
  const alertNames = alerts.map(k=>k.label.replace(/ (Overage|Overrun|Overuse|Alert)$/,'')).join(', ');
  const alertPart = alerts.length ? `<b>${alerts.length}</b> ${alerts.length===1?'KPI is':'KPIs are'} in alert (${alertNames})` : `<b>0</b> KPIs are in alert`;
  const rows = kpis.map((k,i)=>`
    <div class="ahb-ra sev-${k.sev} ${AHUB.idx===i?'on':''}" onclick="ahbSelect(${i})">
      <div class="ahb-ra-top">
        <span class="ahb-ra-name">${k.label}</span>
        <span class="ahb-ra-tag">${AHB_SEV_LABEL[k.sev]||''}</span>
      </div>
      <div class="ahb-ra-val">${k.sbVal}</div>
      <div class="ahb-ra-var">${k.sbVar}</div>
      <div class="ahb-ra-tgt">${k.sbTgt}</div>
    </div>`).join('');
  return `<aside class="ahb-rail">
    <div class="ahb-rail-h">
      <div class="t"><i data-lucide="scan-search"></i>Flagged KPIs &middot; ${ahbDateLabel()}</div>
    </div>
    <div class="ahb-rail-k">Select a metric <b>${AHUB.idx+1}/${kpis.length}</b></div>
    <div class="ahb-rail-list">${rows}</div>
  </aside>`;
}

function ahbSelect(i){
  AHUB.idx = i;
  const el = document.getElementById('content-aihub');
  if(!el) return;
  el.querySelectorAll('.ahb-ra').forEach((r,ri)=> r.classList.toggle('on', ri===i));
  const k = el.querySelector('.ahb-rail-k b');
  if(k) k.textContent = (i+1)+'/'+ahbVisibleKpis().length;
  ahbRenderDetail();
  ahbCloseChat();
  ahbStopReadAloud();
  const sc = document.getElementById('ahb-detail');
  if(sc) sc.scrollTop = 0;
  if(window.lucide) lucide.createIcons();
}

/* ---------------- top: L1 hero + variance breakdown, fixed above the scroll ---------------- */
function ahbRenderHero(kpi){
  const heroMount = document.getElementById('ahb-hero-mount');
  if(!heroMount) return;
  heroMount.innerHTML = `
    <div class="ahb-hero sev-${kpi.sev}">
      <div class="ahb-hero-main">
        <div class="ahb-hero-l">
          <div class="ahb-hero-eyebrow">${kpi.l1.eyebrow}</div>
          <div class="ahb-hero-val">${kpi.l1.val}</div>
          <div class="ahb-hero-chip">${kpi.l1.chip}</div>
          ${kpi.l1.tgt ? `<div class="ahb-hero-tgt">${kpi.l1.tgt}</div>` : ''}
        </div>
        <div class="ahb-hero-stats">
          ${kpi.l1.stats.map(s=>`
            <div class="ahb-hero-stat">
              <div class="l">${s.lbl}</div>
              <div class="v ${s.cls}">${s.val}</div>
              <div class="n">${s.note}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="ahb-hero-variance">
        <div class="ahb-hero-variance-lbl"><i data-lucide="pie-chart"></i>What is driving the variance? <span class="ahb-sec-hint">${kpi.drivers.some(d=>d.seg) ? '— click a segment to jump to its drivers' : ''}</span></div>
        <div class="ahb-bbar">
          ${kpi.segs.map(s=>`<div class="ahb-bbar-seg ${s.key?'clickable':''}" style="flex:${s.pct};background:${s.col}" title="${s.lbl}: ${s.amt}${s.key?' — click to jump to drivers':''}" ${s.key?`onclick="ahbJumpToSeg('${s.key}')"`:''}>${s.pct>=12?s.pct+'%':''}</div>`).join('')}
        </div>
        <div class="ahb-bbar-legend">
          ${kpi.segs.map(s=>`
            <div class="ahb-bleg ${s.key?'clickable':''}" ${s.key?`onclick="ahbJumpToSeg('${s.key}')"`:''}>
              <span class="ahb-bleg-sw" style="background:${s.col}"></span>
              <span class="ahb-bleg-nm">${s.lbl}</span>
              <span class="ahb-bleg-am">${s.amt}</span>
              <span class="ahb-bleg-ov ${s.ovCls}">${s.ov}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ---------------- right side: AI summary → tree → fixes (scrolls under the fixed hero) ---------------- */
function ahbRenderDetail(){
  const mount = document.getElementById('ahb-detail');
  if(!mount) return;
  const kpi = ahbVisibleKpis()[AHUB.idx];
  const imp = AHUB_IMPACT_DATA[kpi.id];

  ahbRenderHero(kpi);

  mount.innerHTML = `
    <div class="ahb-ai">
      <div class="ahb-ai-ico"><i data-lucide="sparkles"></i></div>
      <div class="ahb-ai-tx">
        <div class="ahb-ai-lbl">AI Root Cause Summary</div>
        <div class="ahb-ai-body">${kpi.ai}</div>
      </div>
      <div class="ahb-ai-actions">
        <button class="ahb-ai-read" id="ahb-read-btn" onclick="ahbToggleReadAloud()" title="Read this summary aloud"><i data-lucide="volume-2"></i>Read Aloud</button>
        <button class="ahb-ai-ask" id="ahb-ask-btn" onclick="ahbToggleChat()" title="Ask the agent about this KPI"><i data-lucide="message-circle"></i>Ask the Agent</button>
      </div>
    </div>

    ${ahbChecksHtml(kpi)}

    ${ahbDriverGroupsHtml(kpi)}

    <div class="ahb-bottom">
      <div class="ahb-card">
        <div class="ahb-sec-label"><i data-lucide="circle-check-big"></i>Recommended actions — how this gets fixed</div>
        <div class="ahb-recs">
          ${kpi.recs.map((r,i)=>`
            <div class="ahb-rec">
              <span class="ahb-rec-n">${i+1}</span>
              <span class="ahb-rec-tx">${r}</span>
              <span class="ahb-rec-pri ${AHB_PRI_CLS[i]||'low'}">${AHB_PRI_LABEL[i]||'Low'}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="ahb-card">
        <div class="ahb-sec-label"><i data-lucide="activity"></i>Impact snapshot</div>
        <div class="ahb-imp-charts">
          ${imp ? imp.charts.map(c=>`
            <div class="ahb-imp-chart">
              <div class="t">${c.title}</div>
              <div class="n ${c.cls}">${c.lastVal}</div>
              ${ahbMiniBar(c.values, c.col)}
            </div>`).join('') : ''}
        </div>
        <div class="ahb-sec-label" style="margin-top:12px;">Today vs target</div>
        <div class="ahb-imp-vs">
          ${imp ? imp.vs.map(v=>`
            <div class="ahb-imp-vs-item">
              <span class="ahb-imp-vs-lbl">${v.lbl}</span>
              <span class="ahb-imp-vs-r">
                <span class="ahb-imp-vs-val">${v.val}</span>
                <span class="ahb-imp-vs-var ${v.cls}">${v.chg}</span>
              </span>
            </div>`).join('') : ''}
        </div>
      </div>
    </div>`;
  if(window.lucide) lucide.createIcons();
}

/* optional Mon–Sun strip (kpi.daily): one tile per day, tone = status */
function ahbDailyHtml(kpi){
  if(!kpi.daily || !kpi.daily.length) return '';
  return `
    <div class="ahb-card ahb-daily-card">
      <div class="ahb-sec-label"><i data-lucide="calendar-days"></i>Day by day &middot; Mon 09/01 – Sun 09/07</div>
      <div class="ahb-daily">
        ${kpi.daily.map(x=>`
          <div class="ahb-day ${x.c||'nm'}">
            <div class="d">${x.d}</div>
            <div class="v">${x.v}</div>
            <div class="s">${x.s||''}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* optional rule checks (kpi.checks): which inventory rules pass / breach */
function ahbChecksHtml(kpi){
  if(!kpi.checks || !kpi.checks.length) return '';
  return `
    <div class="ahb-card ahb-checks-card">
      <div class="ahb-sec-label"><i data-lucide="list-checks"></i>Inventory rule checks</div>
      <div class="ahb-checks">
        ${kpi.checks.map(c=>`
          <div class="ahb-check ${c.ok?'ok':'bad'}">
            <i data-lucide="${c.ok?'circle-check':'circle-alert'}"></i>
            <span class="l">${c.lbl}</span>
            <span class="v">${c.v}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

const AHB_PRI_LABEL = ['High','High','Medium','Medium','Low'];
const AHB_PRI_CLS   = ['high','high','med','med','low'];
const AHB_SEG_FALLBACK_LBL = { sales:'Sales' };
/* Rotating fallback palette for drivers with no matching breakdown segment
   (e.g. KPIs that don't define .seg on any driver) — keeps each tile
   visually distinct instead of every icon sharing one severity colour. */
const AHB_DRIVER_PALETTE = ['#1e3a8a','#0369a1','#0f766e','#b45309','#7c3aed','#be123c','#4d7c0f'];
const AHB_SALES_COLOR = '#0ea5e9';

function ahbHexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Each driver's icon/branch colour: reuses the matching breakdown-segment's
   colour when the driver links to one (.seg) so the same category reads as
   the same colour everywhere on the page; otherwise falls back to a
   rotating palette keyed by driver position. */
function ahbDriverColor(d, di, kpi){
  if(d.seg==='sales') return AHB_SALES_COLOR;
  if(d.seg && kpi && kpi.segs){
    const seg = kpi.segs.find(s=>s.key===d.seg);
    if(seg) return seg.col;
  }
  return AHB_DRIVER_PALETTE[di % AHB_DRIVER_PALETTE.length];
}

/* Splits the driver tree into a "cost drivers" group (linked back to the
   Labor $ breakdown segments) and, only when a KPI defines one, a distinct
   "why did the revenue side move" group — keeps the two lines of drilldown
   (cost vs. sales) visually separate instead of one flat list. Falls back
   to the original single-list layout for KPIs with no sales-side driver. */
function ahbDriverGroupsHtml(kpi){
  const pairs = kpi.drivers.map((d,i)=>[d,i]);
  const salesPairs = pairs.filter(([d])=> d.seg==='sales');
  const mainPairs  = pairs.filter(([d])=> d.seg!=='sales');
  let html = `
    <div class="ahb-sec-label ahb-sec-standalone"><i data-lucide="list-tree"></i>Drilldown analysis — expand a driver for store-level evidence</div>
    <div class="ahb-drivers">
      ${mainPairs.map(([d,di])=>ahbDriverHtml(d,di,kpi)).join('')}
    </div>`;
  if(salesPairs.length){
    html += `
    <div class="ahb-sales-panel">
      <div class="ahb-sec-label ahb-sec-standalone ahb-sec-sales"><i data-lucide="trending-down"></i>Revenue impact — why sales missed forecast</div>
      <div class="ahb-drivers">
        ${salesPairs.map(([d,di])=>ahbDriverHtml(d,di,kpi)).join('')}
      </div>
    </div>`;
  }
  return html;
}

function ahbJumpToSeg(segKey){
  const kpi = ahbVisibleKpis()[AHUB.idx];
  const di = kpi.drivers.findIndex(d=>d.seg===segKey);
  if(di<0) return;
  const el = document.getElementById('ahb-dc-'+di);
  if(!el) return;
  el.classList.add('open');
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.classList.add('ahb-dc-flash');
  setTimeout(()=> el.classList.remove('ahb-dc-flash'), 1000);
}

function ahbDriverHtml(d, di, kpi){
  const segLbl = d.seg ? ((kpi && kpi.segs && kpi.segs.find(s=>s.key===d.seg))?.lbl || AHB_SEG_FALLBACK_LBL[d.seg]) : null;
  const numHtml = d.icon ? `<i data-lucide="${d.icon}"></i>` : d.n;
  const color = ahbDriverColor(d, di, kpi);
  const tint = ahbHexToRgba(color, .05);
  return `
  <div class="ahb-dc" data-sev="${d.sev}" id="ahb-dc-${di}" style="background:linear-gradient(135deg,#fff,${tint} 75%);">
    <div class="ahb-dc-hdr" onclick="ahbToggleDriver(${di})">
      <span class="ahb-dc-num ${d.icon?'icon':''}" style="background:${color};color:#fff;">${numHtml}</span>
      <span class="ahb-dc-info">
        <span class="ahb-dc-name">${d.name}</span>
        <span class="ahb-dc-sub">${d.sub}</span>
      </span>
      <span class="ahb-dc-right">
        ${segLbl ? `<span class="ahb-dc-segtag">${segLbl}</span>` : ''}
        <span class="ahb-dc-impact ${d.impCls}">${d.impact}</span>
        ${d.sev!=='info' ? `<span class="ahb-dc-badge ${d.sev}">${AHB_SEV_LABEL[d.sev]}</span>` : ''}
      </span>
      <span class="ahb-dc-chev"><i data-lucide="chevron-down"></i></span>
    </div>
    <div class="ahb-dc-body">
      <div class="ahb-dc-insight">${d.insight}</div>
      ${d.factors ? ahbFactorsHtml(d.factors) : ''}
      ${(d.subs||[]).length ? `<div class="ahb-dc-children" style="border-color:${ahbHexToRgba(color,.35)};">${d.subs.map((s,si)=>ahbSubHtml(s, di, si, color)).join('')}</div>` : ''}
      ${d.fixRecs ? ahbFixRecsHtml(d.fixRecs) : ''}
    </div>
  </div>`;
}

function ahbFactorsHtml(factors){
  return `
  <div class="ahb-factors">
    <div class="ahb-factors-label">Why this happened</div>
    ${factors.map(f=>`
      <div class="ahb-factor-row">
        <span class="ahb-factor-impact">${f.impact}</span>
        <span class="ahb-factor-tx">
          <span class="ahb-factor-lbl">${f.label}</span>
          <span class="ahb-factor-detail">${f.detail}</span>
        </span>
      </div>`).join('')}
  </div>`;
}

function ahbFixRecsHtml(recs){
  return `
  <div class="ahb-fixrecs">
    <div class="ahb-factors-label">Recommended fixes</div>
    ${recs.map(r=>`<div class="ahb-fixrec"><i data-lucide="arrow-right"></i><span>${r}</span></div>`).join('')}
  </div>`;
}

function ahbSubHtml(s, di, si, color){
  return `
  <div class="ahb-sc" id="ahb-sc-${di}-${si}" style="border-left-color:${color};">
    <div class="ahb-sc-hdr" onclick="ahbToggleSub(${di},${si})">
      <span class="ahb-sc-dot" style="background:${color};"></span>
      <span class="ahb-sc-name">${s.name}</span>
      <span class="ahb-sc-count">${s.rows.length} ${s.rows.length===1?'row':'rows'}</span>
      <span class="ahb-sc-chev"><i data-lucide="chevron-down"></i></span>
    </div>
    <div class="ahb-sc-body">
      <table class="ahb-tbl">
        <thead><tr>${s.cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>
          ${s.rows.map(r=>`<tr>${r.map(cell=>
            (cell && typeof cell==='object')
              ? `<td class="${cell.c||''}">${cell.v}</td>`
              : `<td>${cell}</td>`
          ).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ---------------- expand / collapse ---------------- */
function ahbToggleDriver(di){
  const el = document.getElementById('ahb-dc-'+di);
  if(el) el.classList.toggle('open');
}
function ahbToggleSub(di, si){
  const el = document.getElementById('ahb-sc-'+di+'-'+si);
  if(el) el.classList.toggle('open');
}

/* ---------------- "Read Aloud" — text-to-speech for the AI Root Cause
   Summary, via the browser's built-in Web Speech API. Stops automatically
   when the KPI selection or dashboard tab changes, so it never keeps
   reading a summary that's no longer on screen. ---------------- */
let AHB_SPEAKING = false;

function ahbStripHtml(html){
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function ahbUpdateReadBtn(){
  const btn = document.getElementById('ahb-read-btn');
  if(!btn) return;
  btn.classList.toggle('active', AHB_SPEAKING);
  btn.innerHTML = AHB_SPEAKING ? '<i data-lucide="volume-x"></i>Stop' : '<i data-lucide="volume-2"></i>Read Aloud';
  if(window.lucide) lucide.createIcons();
}

function ahbToggleReadAloud(){
  if(!('speechSynthesis' in window)) return;
  if(AHB_SPEAKING){
    ahbStopReadAloud();
    return;
  }
  const kpi = ahbVisibleKpis()[AHUB.idx];
  const text = ahbStripHtml(kpi.ai);
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.onend = ahbStopReadAloud;
  utter.onerror = ahbStopReadAloud;
  window.speechSynthesis.speak(utter);
  AHB_SPEAKING = true;
  ahbUpdateReadBtn();
}

function ahbStopReadAloud(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  AHB_SPEAKING = false;
  ahbUpdateReadBtn();
}

/* ---------------- "Ask the Agent" — docked chat panel beside the detail
   column. Opens only on demand (button in the AI summary card); the
   detail column narrows automatically since the panel is a flex sibling
   that's display:none until opened. Seeded fresh per KPI — switching the
   rail selection closes it so it never shows stale context. ---------------- */
let AHB_CHAT_OPEN = false;

function ahbChatShellHtml(){
  return `
  <div class="ahb-chat" id="ahb-chat">
    <div class="ahb-chat-hdr">
      <div class="ahb-chat-hdr-ico"><i data-lucide="sparkles"></i></div>
      <div class="ahb-chat-hdr-tx">
        <div class="ahb-chat-hdr-t">Ask the Agent</div>
        <div class="ahb-chat-hdr-s" id="ahb-chat-hdr-s"></div>
      </div>
      <button class="ahb-chat-close" onclick="ahbCloseChat()" title="Close"><i data-lucide="x"></i></button>
    </div>
    <div class="ahb-chat-chips">
      <button class="ahb-chat-chip" onclick="ahbChatAsk('Why?')">Why?</button>
      <button class="ahb-chat-chip" onclick="ahbChatAsk('What should I do?')">What should I do?</button>
      <button class="ahb-chat-chip" onclick="ahbChatAsk('How big?')">How big?</button>
      <button class="ahb-chat-chip" onclick="ahbChatAsk('Show the report')">Show the report</button>
    </div>
    <div class="ahb-chat-thread" id="ahb-chat-thread"></div>
    <div class="ahb-chat-inputrow">
      <input type="text" id="ahb-chat-input" class="ahb-chat-input" placeholder="Ask anything about this signal…" onkeydown="if(event.key==='Enter') ahbChatSend();">
      <button class="ahb-chat-send" onclick="ahbChatSend()" title="Send"><i data-lucide="send"></i></button>
    </div>
  </div>`;
}

function ahbToggleChat(){
  const panel = document.getElementById('ahb-chat');
  if(!panel) return;
  AHB_CHAT_OPEN = !AHB_CHAT_OPEN;
  panel.classList.toggle('open', AHB_CHAT_OPEN);
  const btn = document.getElementById('ahb-ask-btn');
  if(btn) btn.classList.toggle('active', AHB_CHAT_OPEN);
  if(AHB_CHAT_OPEN && !panel.dataset.seeded){
    ahbSeedChat();
    panel.dataset.seeded = '1';
  }
  if(window.lucide) lucide.createIcons();
}

function ahbCloseChat(){
  AHB_CHAT_OPEN = false;
  const panel = document.getElementById('ahb-chat');
  if(panel){
    panel.classList.remove('open');
    panel.dataset.seeded = '';
  }
  const btn = document.getElementById('ahb-ask-btn');
  if(btn) btn.classList.remove('active');
  const thread = document.getElementById('ahb-chat-thread');
  if(thread) thread.innerHTML = '';
}

function ahbSeedChat(){
  const kpi = ahbVisibleKpis()[AHUB.idx];
  const hdrS = document.getElementById('ahb-chat-hdr-s');
  if(hdrS) hdrS.textContent = kpi.label + ' — ' + kpi.l1.val;
  const thread = document.getElementById('ahb-chat-thread');
  if(thread) thread.innerHTML = ahbChatBubble('ai', kpi.ai + ' Ask me why, what to do, or how big the impact is.');
}

function ahbChatEsc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function ahbChatBubble(role, html){
  if(role==='ai'){
    return `<div class="ahb-chat-msg ai"><div class="ahb-chat-avatar"><i data-lucide="sparkles"></i></div><div class="ahb-chat-bubble ai">${html}</div></div>`;
  }
  return `<div class="ahb-chat-msg user"><div class="ahb-chat-bubble user">${html}</div></div>`;
}

function ahbChatReply(text){
  const kpi = ahbVisibleKpis()[AHUB.idx];
  const t = text.toLowerCase();
  if(t.indexOf('why')!==-1) return kpi.ai;
  if(t.indexOf('what should')!==-1 || t.indexOf('do next')!==-1 || t.indexOf('recommend')!==-1){
    return 'Top recommended actions for <b>' + kpi.label + '</b>:<br>' + kpi.recs.slice(0,3).map((r,i)=>(i+1)+'. '+r).join('<br>');
  }
  if(t.indexOf('how big')!==-1 || t.indexOf('impact')!==-1){
    const top = kpi.drivers[0];
    return kpi.l1.eyebrow + ' is at <b>' + kpi.l1.val + '</b> (' + kpi.l1.chip + '). The largest driver is <b>' + top.name + '</b> at <b>' + top.impact + '</b>.';
  }
  if(t.indexOf('report')!==-1 || t.indexOf('show')!==-1){
    return 'The full drilldown is right here in this panel — drivers, store-level evidence and recommended fixes for <b>' + kpi.label + '</b>.';
  }
  const hit = kpi.drivers.find(d=> t.indexOf(d.name.toLowerCase().split(' ')[0])!==-1);
  if(hit) return hit.insight;
  return 'I can help with <b>' + kpi.label + '</b> — ask me <i>why</i> it\'s off, <i>what to do</i>, or <i>how big</i> the impact is.';
}

function ahbChatPush(text){
  const thread = document.getElementById('ahb-chat-thread');
  if(!thread) return;
  thread.insertAdjacentHTML('beforeend', ahbChatBubble('user', ahbChatEsc(text)));
  thread.scrollTop = thread.scrollHeight;
  const typingId = 'ahb-typing-' + Math.random().toString(36).slice(2);
  thread.insertAdjacentHTML('beforeend', `<div class="ahb-chat-msg ai" id="${typingId}"><div class="ahb-chat-avatar"><i data-lucide="sparkles"></i></div><div class="ahb-chat-bubble ai ahb-chat-typing"><span></span><span></span><span></span></div></div>`);
  thread.scrollTop = thread.scrollHeight;
  if(window.lucide) lucide.createIcons();
  setTimeout(()=>{
    const typingEl = document.getElementById(typingId);
    const reply = ahbChatReply(text);
    if(typingEl) typingEl.outerHTML = ahbChatBubble('ai', reply);
    thread.scrollTop = thread.scrollHeight;
    if(window.lucide) lucide.createIcons();
  }, 700);
}

function ahbChatAsk(text){ ahbChatPush(text); }

function ahbChatSend(){
  const input = document.getElementById('ahb-chat-input');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  ahbChatPush(text);
}

/* ---------------- tiny inline sparkline (no Chart.js needed) ---------------- */
function ahbMiniBar(values, col){
  const absMax = Math.max.apply(null, values.map(v=>Math.abs(v))) || 1;
  return `<div class="ahb-minibar">${values.map((v,i)=>{
    const h = Math.max(3, (Math.abs(v)/absMax)*30);
    const op = i===values.length-1 ? 1 : (0.3 + (i/values.length)*0.4).toFixed(2);
    return `<span style="height:${h.toFixed(1)}px;background:${col};opacity:${op}"></span>`;
  }).join('')}</div>`;
}
