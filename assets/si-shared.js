/* ============================================================
   Schedule Insight — shared formatting / sparkline helper
   Used by deepdive-render.js (the Insights tab is a verbatim port of
   Main_Insight.html's "new UI" and is self-contained; the AI Hub tab is a
   verbatim port of AI Dashboard/assets/ai-hub-render.js and is self-contained)
   ============================================================ */

function siFmtHours(v){ return Number(v).toFixed(2); }

function siFmtDollar(v){
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function siFmtPercent(v, decimals){
  return Number(v).toFixed(decimals == null ? 1 : decimals) + '%';
}

function siFmtByType(v, fmt){
  if (fmt === 'dollar') return siFmtDollar(v);
  if (fmt === 'percent') return siFmtPercent(v);
  if (fmt === 'hours') return siFmtHours(v) + ' hrs';
  return String(v);
}

/* tiny inline-SVG sparkline, ported from the Deep Dive reference's buildSpark() idea:
   scale a series to its own min/max, draw a polyline + dots, no chart library */
function siSparkline(series, opts){
  opts = opts || {};
  const w = opts.w || 120, h = opts.h || 28, pad = 3;
  const color = opts.color || '#4d8cf5';
  const min = Math.min.apply(null, series), max = Math.max.apply(null, series);
  const span = (max - min) || 1;
  const stepX = (w - pad * 2) / (series.length - 1 || 1);
  const pts = series.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" fill="${color}"/>`).join('');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

if (typeof window !== 'undefined') {
  window.siFmtHours = siFmtHours;
  window.siFmtDollar = siFmtDollar;
  window.siFmtPercent = siFmtPercent;
  window.siFmtByType = siFmtByType;
  window.siSparkline = siSparkline;
}
