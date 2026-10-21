/* =====================================================================
   17. CHART FUNCTIONS — Chart.js setup, theme-aware colors, click interactions
   maintainAspectRatio:false makes every chart fill its (centered) panel,
   so there is no leftover blank space beside a shrunken canvas.
===================================================================== */
let charts = {};
const CHART_READY = typeof Chart !== 'undefined';
if(CHART_READY){
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.responsive = true;
  Chart.defaults.font.family = "'Inter',sans-serif";
}
const SEV_COLORS = {Critical:'#B4222E', High:'#C97A12', Medium:'#2457C5', Low:'#8B95A7'};
function hexA(hex, a){
  const n = parseInt(hex.slice(1),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }
function chartTheme(){
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return { dark, grid: dark ? 'rgba(255,255,255,0.08)' : '#EEF1F6', text: dark ? '#9AA6BE' : '#5B6472', strong: dark ? '#E7ECF5' : '#182233' };
}
function chartFont(size){ return {family:"'Inter',sans-serif", size:size||11.5}; }
function chartCanvas(id){
  const el = document.getElementById(id);
  if(!el) return null;
  if(!CHART_READY){
    el.parentElement.innerHTML = `<div class="chart-fallback">Charts need the Chart.js library (loaded from cdnjs). Check your internet connection and reload.</div>`;
    return null;
  }
  return el;
}
/* Small inline plugins (no extra libraries) */
const doughnutCenterText = {
  id:'doughnutCenterText',
  afterDraw(chart, args, opts){
    if(!opts || opts.text==null) return;
    const meta = chart.getDatasetMeta(0); if(!meta.data.length) return;
    const {x, y} = meta.data[0];
    const ctx = chart.ctx; ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.color; ctx.font = "800 24px 'Inter',sans-serif"; ctx.fillText(opts.text, x, y-8);
    ctx.fillStyle = opts.subColor; ctx.font = "500 11px 'Inter',sans-serif"; ctx.fillText(opts.sub||'', x, y+13);
    ctx.restore();
  }
};
const barValueLabels = {
  id:'barValueLabels',
  afterDatasetsDraw(chart, args, opts){
    if(!opts || !opts.enabled) return;
    const ctx = chart.ctx;
    const di = opts.datasetIndex || 0;
    const meta = chart.getDatasetMeta(di); if(meta.hidden) return;
    meta.data.forEach((bar, i)=>{
      const label = opts.format ? opts.format(i) : chart.data.datasets[di].data[i];
      ctx.save();
      ctx.fillStyle = opts.color; ctx.font = "600 11.5px 'Inter',sans-serif";
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, (opts.atEnd ? chart.chartArea.right : bar.x) + 8, bar.y);
      ctx.restore();
    });
  }
};

function renderDashboardCharts(){
  const ct = chartTheme();
  const legend = {position:'bottom', align:'center', labels:{color:ct.text, font:chartFont(), padding:14, usePointStyle:true, pointStyle:'circle'}};

  // 1. Endpoint security status (doughnut)
  const statusCounts = overallCounts();
  const statusKeys = Object.keys(statusCounts);
  destroyChart('status');
  let el = chartCanvas('chart-status');
  if(el) charts.status = new Chart(el, {
    type:'doughnut',
    data:{ labels:statusKeys, datasets:[{ data:statusKeys.map(k=>statusCounts[k]),
      backgroundColor:['#1B7A4C','#C97A12','#B4222E','#8B95A7'], borderWidth:0, hoverOffset:6 }]},
    options:{ cutout:'66%', layout:{padding:6},
      plugins:{ legend,
        doughnutCenterText:{text:String(endpoints.length), sub:'endpoints', color:ct.strong, subColor:ct.text},
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw} of ${endpoints.length} (${pct(c.raw, endpoints.length)}%)`}} },
      onClick:(evt, els)=>{ if(els.length) goTo('endpoints', {overall: statusKeys[els[0].index]}); } },
    plugins:[doughnutCenterText]
  });

  // 2. Vulnerabilities by severity (stacked: unresolved + resolved = KPI total)
  const sevKeys = ['Critical','High','Medium','Low'];
  const unresolved = vulnSeverityCounts(vulnerabilities.filter(v=>v.status!=='Resolved'));
  const resolved = vulnSeverityCounts(vulnerabilities.filter(v=>v.status==='Resolved'));
  destroyChart('severity');
  el = chartCanvas('chart-severity');
  if(el) charts.severity = new Chart(el, {
    type:'bar',
    data:{ labels:sevKeys, datasets:[
      {label:'Unresolved', data:sevKeys.map(k=>unresolved[k]), backgroundColor:sevKeys.map(k=>SEV_COLORS[k]), borderRadius:6, maxBarThickness:56, stack:'s'},
      {label:'Resolved', data:sevKeys.map(k=>resolved[k]), backgroundColor:sevKeys.map(k=>hexA(SEV_COLORS[k], ct.dark?0.35:0.25)), borderRadius:6, maxBarThickness:56, stack:'s'},
    ]},
    options:{
      plugins:{legend:{display:false},
        tooltip:{mode:'index', intersect:false, callbacks:{footer:items=>`Total: ${items.reduce((s,i)=>s+i.raw,0)}`}}},
      scales:{ x:{stacked:true, ticks:{color:ct.text,font:chartFont()}, grid:{display:false}},
               y:{stacked:true, beginAtZero:true, ticks:{precision:0,color:ct.text,font:chartFont()}, grid:{color:ct.grid}} },
      onClick:(evt, els)=>{ if(els.length) goTo('vulnerabilities', {severity: sevKeys[els[0].index]}); }
    }
  });

  // 3. Security tool coverage (healthy vs affected, per tool)
  const visibleTools = roleTools();
  const stats = visibleTools.map(toolStats);
  destroyChart('coverage');
  el = chartCanvas('chart-coverage');
  if(el) charts.coverage = new Chart(el, {
    type:'bar',
    data:{ labels:visibleTools.map(t=>t.name), datasets:[
      {label:'Healthy', data:stats.map(s=>s.healthy), backgroundColor:'#2457C5', borderRadius:4, maxBarThickness:30, stack:'c'},
      {label:'Affected', data:stats.map(s=>s.affected.length), backgroundColor:ct.dark?'rgba(232,96,107,0.55)':'rgba(180,34,46,0.35)', borderRadius:4, maxBarThickness:30, stack:'c'},
    ]},
    options:{ indexAxis:'y', layout:{padding:{right:12}},
      plugins:{ legend,
        tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw} of ${endpoints.length} endpoints`}} },
      scales:{ x:{stacked:true, beginAtZero:true, max:endpoints.length||1, ticks:{precision:0,color:ct.text,font:chartFont()}, grid:{color:ct.grid}},
               y:{stacked:true, ticks:{color:ct.text,font:chartFont()}, grid:{display:false}} },
      onClick:(evt, els)=>{ if(els.length) openToolDetail(visibleTools[els[0].index].key); }
    }
  });

  // 4. Vulnerability trend (computed from detected dates)
  const weeks = vulnTrendSeries();
  const labels = weeks.map(w=>fmtShortDate(w.start));
  destroyChart('trend');
  el = chartCanvas('chart-trend');
  if(el) charts.trend = new Chart(el, {
    type:'line',
    data:{ labels, datasets:[{
      label:'New vulnerabilities', data:weeks.map(w=>w.count), borderColor:'#2457C5', backgroundColor:'rgba(36,87,197,0.12)',
      fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#2457C5', pointHoverRadius:7,
    }]},
    options:{ plugins:{legend:{display:false},
        tooltip:{callbacks:{title:items=>'Week of '+fmtDate(weeks[items[0].dataIndex].start),
                            label:c=>` ${c.raw} new vulnerabilit${c.raw===1?'y':'ies'}`}}},
      scales:{ y:{beginAtZero:true, ticks:{precision:0,color:ct.text,font:chartFont()}, grid:{color:ct.grid}},
               x:{ticks:{color:ct.text,font:chartFont()}, grid:{display:false}} },
      onClick:(evt, els)=>{ if(els.length){ const w = weeks[els[0].index]; goTo('vulnerabilities', {week:{start:w.start, end:w.end}}); } }
    }
  });
}

function renderHardeningChart(){
  const ct = chartTheme();
  const stats = hardeningControls.map(controlStats);
  destroyChart('hardening');
  const el = chartCanvas('chart-hardening');
  if(!el) return;
  const bandColor = {compliant:'#1B7A4C', attention:'#C97A12', noncompliant:'#B4222E'};
  charts.hardening = new Chart(el, {
    type:'bar',
    data:{ labels:stats.map(s=>s.control.control),
      datasets:[{ data:stats.map(s=>s.compliance), backgroundColor:stats.map(s=>bandColor[s.band]), borderRadius:6, maxBarThickness:30, barPercentage:0.75, categoryPercentage:0.85 }]},
    options:{ indexAxis:'y', layout:{padding:{right:120, left:4}},
      plugins:{ legend:{display:false},
        barValueLabels:{enabled:true, atEnd:true, color:ct.strong, format:i=>`${stats[i].compliance}%  (${stats[i].passing}/${endpoints.length})`},
        tooltip:{callbacks:{label:c=>` ${stats[c.dataIndex].compliance}% compliant, ${stats[c.dataIndex].failing.length} affected endpoint(s)`}} },
      scales:{ x:{beginAtZero:true, max:100, ticks:{color:ct.text,font:chartFont(), callback:v=>v+'%'}, grid:{color:ct.grid}},
               y:{ticks:{color:ct.text,font:chartFont(12)}, grid:{display:false}} },
      onClick:(evt, els)=>{ if(els.length) openControlDetail(stats[els[0].index].control.key); }
    },
    plugins:[barValueLabels]
  });
}

