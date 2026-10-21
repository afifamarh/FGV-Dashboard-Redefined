/* =====================================================================
   7. DASHBOARD — KPIs, posture ring, security tool cards, charts
===================================================================== */
/* Global Executive KPI bar — company-wide headline strip. Pulls from the
   same shared mock arrays as the rest of the dashboard, nothing hardcoded.
   "Global Patching Rate" uses sccmSummary(): Compliant / (Total - Out of Coverage) x 100. */
function renderExecKpiBar(){
  const ps = patchSummary();
  const items = [
    {label:'Total Monitored Assets', value: endpoints.length.toLocaleString(),
      sub:'Sample endpoints in this prototype', action:()=>goTo('endpoints')},
    {tool:'sccm', label:'Global Patching Rate', value: fmtPct2(sccmSummary().compliancePct),
      sub:`Target ${SCCM_TARGET_PCT}% · SCCM Compliant ÷ (Total − Out of Coverage)`, action:()=>goTo('sccm')},
    {label:'Open Critical Vulnerabilities', value: unresolvedCritical(),
      sub:'Unresolved, Critical severity', action:()=>goTo('vulnerabilities',{severity:'Critical',status:'unresolved'})},
    {label:'Active SOC Tickets', value: activeSocTickets(),
      sub:`${socTickets.length} total tickets (mock)`, action:null},
  ].filter(it=>!it.tool || canAccess(it.tool));
  document.getElementById('exec-kpi-bar').innerHTML = items.map(it=>`
    <div class="exec-kpi-item${it.action?' clickable':''}"${it.action?' tabindex="0" role="button"':''}>
      <div class="exec-kpi-label">${it.label}</div>
      <div class="exec-kpi-value">${it.value}</div>
      <div class="exec-kpi-sub">${it.sub}</div>
    </div>
  `).join('');
  document.querySelectorAll('#exec-kpi-bar .exec-kpi-item').forEach((el,i)=>{
    const action = items[i].action;
    if(!action) return;
    el.onclick = action;
    el.onkeydown = (e)=>{ if(e.key==='Enter') action(); };
  });
}
function renderDashboard(){
  const total = endpoints.length;
  const counts = overallCounts();
  const vulnerableCount = endpoints.filter(e=>e.vulnCount>0).length;
  const ps = patchSummary();
  const score = fleetHardeningScore();
  dashboardViewedAt = dashboardViewedAt || nowIso();

  renderExecKpiBar();

  const kpis = [
    {label:'Protected Endpoints', value:counts.Protected, sub:`${pct(counts.Protected,total)}% of fleet`, tone:'green', icon:'shieldPlain', action:()=>goTo('endpoints',{overall:'Protected'})},
    {label:'Vulnerable Endpoints', value:vulnerableCount, sub:'With unresolved findings', tone:'red', icon:'bug', action:()=>goTo('endpoints',{flag:{type:'vulnerable'}})},
    {tool:'sccm', label:'Non-Compliant Endpoints', value:ps.nonCompliant, sub:'Flagged by SCCM', tone:'amber', icon:'warn', action:()=>goTo('endpoints',{sccm:'Non-Compliant'})},
    {tool:'sccm', label:'Patch Compliance', value:fmtPct2(sccmSummary().compliancePct), sub:`${ps.missing} missing updates`, tone:'blue', icon:'refresh', action:()=>openPatchCompliance()},
    {label:'Hardening Score', value:score, sub:'Out of 100, fleet', tone:'slate', icon:'sliders', action:()=>goTo('hardening')},
  ].filter(k=>!k.tool || canAccess(k.tool));
  document.getElementById('dashboard-kpis').innerHTML = kpis.map(k=>kpiCardHtml(k)).join('');
  bindKpiActions('dashboard-kpis', kpis);

  document.getElementById('posture-score').textContent = score;
  const circumference = 2*Math.PI*56;
  const ring = document.getElementById('posture-ring');
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference - (score/100)*circumference;
  ring.style.stroke = score>=85 ? '#4FD1A5' : score>=65 ? '#F2B84B' : '#F17E8A';
  document.getElementById('posture-status').textContent = score>=85 ? 'Strong' : score>=65 ? 'Needs attention' : 'At risk';
  document.getElementById('posture-stats').innerHTML = `
    <div class="posture-stat"><div class="n">${vulnerabilities.filter(v=>v.status!=='Resolved').length}</div><div class="l">Open vulnerabilities</div></div>
    <div class="posture-stat"><div class="n">${unresolvedCritical()}</div><div class="l">Critical, unresolved</div></div>
    ${canAccess('sccm') ? `<div class="posture-stat"><div class="n">${ps.nonCompliant}</div><div class="l">Non-compliant endpoints</div></div>` : ''}
  `;
  document.getElementById('dash-asof').innerHTML =
    `Sample tool data as of <b>${fmtDateTime(dataAsOf())}</b>. Dashboard refreshed ${fmtDateTime(dashboardViewedAt)}.`;

  document.getElementById('tool-cards').innerHTML = securityTools.filter(t=>canAccess(t.key)).map(t=>toolCardHtml(t)).join('');
  renderDashboardCharts();
}
function refreshDashboard(){
  dashboardViewedAt = nowIso();
  refreshViews();
  showToast('Dashboard recalculated from current data','ok');
}
function kpiCardHtml(k){
  return `<div class="kpi-card ${k.active?'active':''}" tabindex="0" role="button" aria-pressed="${k.active?'true':'false'}">
    <div class="kpi-top"><div class="kpi-label">${k.label}</div><div class="kpi-icon tone-${k.tone}">${ICONS[k.icon]}</div></div>
    <div class="kpi-value">${k.value}</div>
    ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
  </div>`;
}
function bindKpiActions(containerId, kpis){
  document.querySelectorAll('#'+containerId+' .kpi-card').forEach((n,i)=>{
    n.onclick = kpis[i].action;
    n.onkeydown = (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); kpis[i].action(); } };
  });
}

/* =====================================================================
   7b. PATCH COMPLIANCE — dedicated view (from Dashboard KPI, SCCM, reports)
===================================================================== */
function openPatchCompliance(){
  deriveAll();
  const ps = patchSummary();
  const cards = [
    {l:'Compliance (SCCM formula)', v:fmtPct2(sccmSummary().compliancePct), s:`Target ${SCCM_TARGET_PCT}% · see SCCM Patch Management`, go:`goTo('sccm')`},
    {l:'Update installation', v:ps.compliancePct+'%', s:`${ps.installed} of ${ps.applicable} updates installed`},
    {l:'Compliant endpoints', v:ps.compliant, s:`Meet the ${PATCH_SLA_THRESHOLD}% SLA`, go:`goTo('endpoints',{sccm:'Compliant'})`},
    {l:'Non-compliant endpoints', v:ps.nonCompliant, s:`Below the ${PATCH_SLA_THRESHOLD}% SLA`, go:`goTo('endpoints',{sccm:'Non-Compliant'})`},
    {l:'Missing updates', v:ps.missing, s:`Across ${endpoints.filter(e=>e.missingUpdates>0).length} endpoints`},
    {l:'Requiring attention', v:ps.attention.length, s:'Below SLA or stale check', go:`goTo('endpoints',{flag:{type:'patchAttention'}})`},
    {l:'Last patch check', v:`<span style="font-size:15px;">${fmtDateTime(ps.lastCheck)}</span>`, s:'Most recent SCCM evaluation'},
  ];
  openModal({
    title:'Patch compliance',
    wide:true,
    body:`
      <div class="mini-kpis">
        ${cards.map(c=>`<div class="mini-kpi ${c.go?'clickable':''}" ${c.go?`tabindex="0" role="button" onclick="closeModal();${c.go}" onkeydown="if(event.key==='Enter'){closeModal();${c.go}}"`:''}>
          <div class="l">${c.l}</div><div class="v">${c.v}</div><div class="s">${c.s}</div></div>`).join('')}
      </div>
      <div class="progress" style="margin-bottom:6px;" title="${ps.compliancePct}% of applicable updates installed"><span style="width:${ps.compliancePct}%;background:${complianceColor(ps.compliancePct)};"></span></div>
      <div class="form-hint" style="margin-bottom:16px;">Fleet-wide: ${ps.installed} of ${ps.applicable} applicable updates installed. An endpoint is compliant when at least ${PATCH_SLA_THRESHOLD}% of its updates are installed (proposed SLA).</div>
      <div class="section-label">Endpoints requiring attention (${ps.attention.length})</div>
      ${ps.attention.length ? `<div class="table-scroll" style="max-height:280px;overflow-y:auto;"><table>
        <thead><tr><th>Endpoint</th><th>Compliance</th><th>Missing updates</th><th>SCCM status</th><th>Last check</th><th>Reason</th></tr></thead>
        <tbody>${ps.attention.map(({e,reasons})=>`<tr>
          <td><span class="link-cell" onclick="openEndpointDetail('${e.id}')">${e.id}</span></td>
          <td><b style="color:${complianceColor(e.patchCompliance)}">${e.patchCompliance}%</b></td>
          <td>${e.missingUpdates}</td>
          <td>${statusBadge(e.sccm)}</td>
          <td>${fmtDateTime(e.lastSync.sccm)}</td>
          <td class="cell-wrap">${reasons.join('; ')}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty-state">${ICONS.check}<div class="e1">All endpoints meet the patch SLA</div></div>`}
    `,
    footer:`<button class="btn btn-secondary" onclick="exportReport('patch')">${ICONS.down} Export CSV</button>
      <button class="btn btn-secondary" onclick="exportReportXls('${key}')">Export Excel</button><button class="btn btn-secondary" onclick="exportReportPdf('${key}')">Export PDF</button>
      <button class="btn btn-primary" onclick="closeModal();goTo('endpoints',{flag:{type:'patchAttention'}})">View endpoints requiring attention</button>`
  });
}

/* =====================================================================
   SCCM PATCH MANAGEMENT PAGE — reads only sccmSummary() / SCCM_LISTS
===================================================================== */
function sccmStateBadge(s){ return `<span class="badge ${s==='Compliant'?'badge-green':s==='Unknown'?'badge-slate':'badge-red'}">${esc(s)}</span>`; }
const SCCM_LIST_HEAD = '<tr><th>Hostname</th><th>IP address</th><th>Location</th><th>Patch status</th><th>Update compliance</th><th>Missing updates</th><th>Pending reboot</th><th>SCCM client</th><th>Out of coverage</th><th>Last check</th></tr>';
let sccmListState = null;
function sccmRowHtml(e){
  const x = e.ext || {};
  return `<tr class="def-row" onclick="openEndpointDetail('${esc(e.id)}')" title="Open endpoint details">
    <td><span class="link-cell">${esc(e.id)}</span></td><td>${esc(x.ip||'—')}</td><td>${esc(getEndpointLocation(e))}</td>
    <td>${sccmStateBadge(e.sccmState)}</td><td>${e.patchCompliance}% (${e.patch?.installed ?? 0}/${e.patch?.applicable ?? 0})</td><td>${e.missingUpdates}</td>
    <td>${x.pendingReboot?'Yes':'No'}</td><td>${esc(x.sccmClient||'—')}</td><td>${isOutOfCoverage(e)?'Yes':'No'}</td><td>${fmtDateTime(e.lastSync&&e.lastSync.sccm)}</td></tr>`;
}
/* Calculation / explanation block shown at the top of every SCCM KPI modal (same detail-grid rows as the endpoint detail). */
function sccmCalcHtml(kind){
  const s = sccmSummary(), b = v=>`<b>${v}</b>`, row = (k,v)=>`<div class="detail-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const rowsByKind = {
    all: [row('Total Device', b(s.total)), row('Description', 'All SCCM devices')],
    compliant: [row('Compliant', b(s.compliant)), row('Description', `Devices whose SCCM patch state is Compliant: at least ${PATCH_SLA_THRESHOLD}% of applicable updates installed, or marked Compliant in the imported SCCM data.`)],
    totalNonCompliant: [row('Non-Compliant', b(s.nonCompliant)), row('State Unknown', b(s.unknown)),
      row('Calculation', `Non-Compliant + State Unknown<br>= ${s.nonCompliant} + ${s.unknown}<br>= ${b(s.totalNonCompliant)}`)],
    problemAll: [row('Total Device', b(s.total)), row('Compliant', b(s.compliant)),
      row('Problem', `Total Device - Compliant<br>= ${s.total} - ${s.compliant}<br>= ${b(s.problemAll)}`)],
    nonCompliant: [row('Non-Compliant', b(s.nonCompliant)), row('Description', `Devices below the ${PATCH_SLA_THRESHOLD}% update SLA, or marked Non-Compliant in the imported SCCM data.`)],
    unknown: [row('State Unknown', b(s.unknown)), row('Description', 'Devices whose SCCM patch state could not be determined (reported as Unknown). They are not counted as compliant.')],
    outOfCoverage: [row('Out of Coverage', b(s.outOfCoverage)), row('Total Device', b(s.total)),
      row('Calculation', `Within Coverage<br>= Total Device - Out of Coverage<br>= ${s.total} - ${s.outOfCoverage}<br>= ${b(s.within)}`),
      row('Description', 'Non-compliant devices outside SCCM coverage (prototype rule: external or 192.168.x.x IP address).')],
    problem: [row('Total Device', b(s.total)), row('Compliant', b(s.compliant)),
      row('Problem', `Total Device - Compliant<br>= ${s.total} - ${s.compliant}<br>= ${b(s.problemAll)}`),
      row('Out of Coverage', b(s.outOfCoverage)),
      row('Problem to Resolve', `Problem - Out of Coverage<br>= ${s.problemAll} - ${s.outOfCoverage}<br>= ${b(s.problem)}`)],
    pct: [row('Compliant', b(s.compliant)), row('Total Device', b(s.total)), row('Out of Coverage', b(s.outOfCoverage)),
      row('Within Coverage', `Total Device - Out of Coverage<br>= ${s.total} - ${s.outOfCoverage}<br>= ${b(s.within)}`),
      row('Total Percentage', s.within>0
        ? `Compliant / Within Coverage × 100<br>= ${s.compliant} / ${s.within} × 100<br>= ${b(fmtPct2f(s.compliancePct))}`
        : `Compliant / Within Coverage × 100<br>= ${b(fmtPct2f(0))} (no devices within coverage)`)],
  };
  const rows = rowsByKind[kind];
  return rows ? `<div class="detail-grid" style="margin-bottom:14px;">${rows.join('')}</div>` : '';
}
/* "Non-Compliant + State Unknown" modal: four clickable category bars first; the search box / asset table appear only after one is clicked.
   Populations reuse sccmSummary() and SCCM_LISTS (Problem = Total - Compliant; Within Coverage = Total - Out of Coverage; Problem to Resolve = Problem - Out of Coverage). */
const SCCM_NC_SUBS = [
  ['problem','Problem', SCCM_LISTS.totalNonCompliant.test, s=>s.problemAll, 'var(--red)', 'problemAll'],
  ['outOfCoverage','Out of Coverage (192.168.x.x)', SCCM_LISTS.outOfCoverage.test, s=>s.outOfCoverage, 'var(--amber)', 'outOfCoverage'],
  ['within','Within Coverage', e=>!SCCM_LISTS.outOfCoverage.test(e), s=>s.within, 'var(--green)', 'outOfCoverage'],
  ['toResolve','Problem to Resolve', SCCM_LISTS.problem.test, s=>s.problem, 'var(--blue)', 'problem'],
];
function sccmListTest(){
  const st = sccmListState;
  if(st.kind==='totalNonCompliant'){ const d = SCCM_NC_SUBS.find(x=>x[0]===st.sub); return d ? d[2] : (()=>false); }
  return SCCM_LISTS[st.kind].test;
}
function sccmListBlockHtml(){ return `
      <div class="table-toolbar" style="padding:0 0 10px;">
        <div class="search-box" style="flex:none;">${ICONS.search}<input type="text" id="sccm-list-search" placeholder="Search hostname, IP, location&hellip;" oninput="sccmListState.search=this.value;renderSccmList()"></div>
        <span class="form-hint" id="sccm-list-count"></span>
      </div>
      <div class="table-scroll" style="max-height:52vh;overflow:auto;"><table><thead>${SCCM_LIST_HEAD}</thead><tbody id="sccm-list-tbody"></tbody></table></div>
      <div class="form-hint" style="margin-top:10px;">Click a row for the full endpoint detail. Prototype data &mdash; not collected from the FGV environment.</div>`; }
function sccmNcModalHtml(){
  const s = sccmSummary(), N = s.total;
  const bars = SCCM_NC_SUBS.map(([k,label,test,count,color,calc])=>{
    const row = sccmBarRow(label, count(s), N, color, 'all').replace(/onclick="[^"]*"/,`role="button" tabindex="0" onclick="selectSccmSub('${k}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectSccmSub('${k}');}"`).replace('class="def-bar-row"',`class="def-bar-row" style="grid-template-columns:190px 1fr 90px;${sccmListState.sub===k?'font-weight:700;':''}"`);
    return row + (sccmListState.sub===k ? `<div style="margin:12px 0 14px;">${sccmCalcHtml(calc)}${sccmListBlockHtml()}</div>` : '');
  }).join('');
  return bars;
}
function selectSccmSub(k){
  sccmListState.sub = (sccmListState.sub===k) ? null : k; sccmListState.search = '';
  const w = document.getElementById('sccm-nc-wrap'); if(!w) return;
  w.innerHTML = sccmNcModalHtml();
  const box = document.querySelector('#modal-overlay .modal-box'); if(box) box.classList.toggle('xwide', !!sccmListState.sub);
  if(sccmListState.sub) renderSccmList();
}
function openSccmList(kind){
  deriveAll();
  const def = SCCM_LISTS[kind]; if(!def) return;
  sccmListState = {kind, search:'', sub:null};
  const nc = kind==='totalNonCompliant';
  const list = (def.noList||nc) ? '' : `
      <div class="table-toolbar" style="padding:0 0 10px;">
        <div class="search-box" style="flex:none;">${ICONS.search}<input type="text" id="sccm-list-search" placeholder="Search hostname, IP, location&hellip;" oninput="sccmListState.search=this.value;renderSccmList()"></div>
        <span class="form-hint" id="sccm-list-count"></span>
      </div>
      <div class="table-scroll" style="max-height:52vh;overflow:auto;"><table><thead>${SCCM_LIST_HEAD}</thead><tbody id="sccm-list-tbody"></tbody></table></div>
      <div class="form-hint" style="margin-top:10px;">Click a row for the full endpoint detail. Prototype data &mdash; not collected from the FGV environment.</div>`;
  openModal({
    title: `${def.title} <span class="mock-tag">Prototype Data</span>`, wide:true,
    body: sccmCalcHtml(kind) + (nc ? `<div id="sccm-nc-wrap">${sccmNcModalHtml()}</div>` : list),
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  });
  if(!def.noList && !nc){ const box = document.querySelector('#modal-overlay .modal-box'); if(box) box.classList.add('xwide'); }
  if(!nc) renderSccmList();
}
function renderSccmList(){
  const tb = document.getElementById('sccm-list-tbody'); if(!tb || !sccmListState) return;
  const q = sccmListState.search.trim().toLowerCase();
  const all = endpoints.filter(sccmListTest());
  const rows = all.filter(e=>{ if(!q) return true; const x = e.ext||{};
    return [e.id, x.ip, getEndpointLocation(e)].some(v=>String(v||'').toLowerCase().includes(q)); })
    .sort((a,b)=> a.id.localeCompare(b.id));
  tb.innerHTML = rows.length ? rows.map(sccmRowHtml).join('')
    : `<tr><td colspan="11"><div class="empty-state">${ICONS.check}<div class="e1">No assets in this list</div></div></td></tr>`;
  document.getElementById('sccm-list-count').textContent = `${rows.length}${q?` of ${all.length}`:''} asset${rows.length===1?'':'s'}`;
}
function sccmKpiCard(label, value, sub, kind){
  return kind
    ? `<div class="kpi-card" role="button" tabindex="0" onclick="openSccmList('${kind}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSccmList('${kind}');}">
        <div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`
    : `<div class="kpi-card static"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
}
function sccmBarRow(label, n, total, color, kind){
  return `<div class="def-bar-row" onclick="openSccmList('${kind}')"><span class="def-bar-label">${label}</span>
    <div class="def-bar-track"><div class="def-bar-fill" style="width:${pct(n,total)}%;background:${color};"></div></div>
    <span class="def-bar-val">${n} <span style="font-weight:500;color:var(--text-faint);">(${pct(n,total)}%)</span></span></div>`;
}
function renderSccmPage(){
  if(!document.getElementById('sccm-kpis')) return;
  deriveAll();
  const s = sccmSummary(), N = s.total;
  /* Four primary KPIs only (the four related items are the breakdown panel below); the optional cards (Settings) are appended last. All values come from sccmSummary(). */
  document.getElementById('sccm-kpis').innerHTML =
    sccmKpiCard('Total Device', N, 'All SCCM devices', 'all') +
    sccmKpiCard('Compliant', s.compliant, `${pct(s.compliant,N)}% of assets`, 'compliant') +
    sccmKpiCard('Non-Compliant + State Unknown', s.totalNonCompliant, '', 'totalNonCompliant') +
    sccmKpiCard('Total Percentage', fmtPct2f(s.compliancePct), 'Compliant / Within Coverage', 'pct') +
    (sccmKpiPrefs.currentCompliance ? sccmKpiCard('Current Compliance', fmtPct2(s.compliancePct), `${s.compliant} of ${s.within} assets in coverage`, '') : '') +
    (sccmKpiPrefs.target ? sccmKpiCard('Target', SCCM_TARGET_PCT + '%', s.meetsTarget ? 'Target met' : `${fmtPct2(SCCM_TARGET_PCT - s.compliancePct)} below target`, '') : '');
  document.getElementById('sccm-breakdown-panel').innerHTML = `
    <div class="panel-head"><div><h3>Non-Compliant + State Unknown breakdown</h3><div class="panel-sub">${s.totalNonCompliant} assets (${s.nonCompliant} + ${s.unknown}) &mdash; click a bar to list the assets</div></div></div>
    ${sccmBarRow('Non-Compliant', s.nonCompliant, N, 'var(--red)', 'nonCompliant')}
    ${sccmBarRow('State Unknown', s.unknown, N, 'var(--text-faint)', 'unknown')}
    ${sccmBarRow('Out of Coverage', s.outOfCoverage, N, 'var(--amber)', 'outOfCoverage')}
    <div title="Problem to Resolve = (Total Device - Compliant) - Out of Coverage: problem devices remaining after excluding devices outside SCCM coverage.">${sccmBarRow('Problem to Resolve', s.problem, N, 'var(--blue)', 'problem')}</div>
    <div class="form-hint" style="margin-top:10px;">Out of Coverage and Problem to Resolve are counted within Non-Compliant + State Unknown, so these bars overlap by design: Problem to Resolve = Problem - Out of Coverage.</div>`;
  const barPct = Math.max(0, Math.min(100, s.compliancePct));
  document.getElementById('sccm-target-panel').innerHTML = `
    <div class="panel-head"><div><h3>Compliance vs target</h3><div class="panel-sub">Assets in SCCM coverage only</div></div></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;">
      <div style="font-size:15px;font-weight:700;">Current Compliance: ${fmtPct2(s.compliancePct)}</div>
      <div style="font-size:15px;font-weight:700;">Target: ${SCCM_TARGET_PCT}%</div>
    </div>
    <div class="sccm-target-wrap"><div class="progress" style="height:12px;"><span style="width:${barPct}%;background:${s.meetsTarget?'var(--green)':'var(--amber)'};"></span></div>
      <div class="sccm-target-mark" style="left:${SCCM_TARGET_PCT}%;" title="Target ${SCCM_TARGET_PCT}%"></div></div>
    <div class="form-hint" style="margin-top:8px;">${s.meetsTarget ? 'The patching target is met.' : `${fmtPct2(SCCM_TARGET_PCT - s.compliancePct)} below the ${SCCM_TARGET_PCT}% target.`}</div>`;
}

