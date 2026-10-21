/* =====================================================================
   11. SECURITY TOOLS — Defender / SCCM / Kaspersky / Trend Micro Vision One
===================================================================== */
function toolCardHtml(t){
  const s = toolStats(t);
  return `<div class="tool-card" tabindex="0" role="button" onclick="openToolDetail('${t.key}')" onkeydown="if(event.key==='Enter')openToolDetail('${t.key}')">
    <div class="tool-card-head">
      <div class="tool-mark tone-${t.tone}">${ICONS[t.icon]}</div>
      <div class="tool-name">${t.name}</div>
      <div class="tool-status-badge"><span class="badge badge-green">${ICONS.check}Online</span></div>
    </div>
    ${toolMetricsHtml(t, s)}
    <div class="tool-metric-row"><span class="k">Open findings</span><span class="v">${s.openFindings}</span></div>
    <button type="button" class="btn btn-secondary btn-sm" style="width:100%;justify-content:center;margin-top:12px;" onclick="event.stopPropagation();openToolDetail('${t.key}')">${ICONS.eye} View details</button>
  </div>`;
}
function toolFullName(key){ const t = securityTools.find(x=>x.key===key); return t ? t.name : key; }
function toolMetricRows(t, s){
  const N = endpoints.length;
  if(t.key==='defender') return [
    ['Protected endpoints', `${s.count('Protected')}/${N}`], ['At-risk endpoints', s.count('At Risk')], ['Offline endpoints', s.count('Offline')]];
  if(t.key==='sccm'){ const ps = patchSummary(); return [
    ['Managed endpoints', N], ['Compliant endpoints', `${ps.compliant}/${N}`], ['Patch compliance', fmtPct2(sccmSummary().compliancePct)]]; }
  if(t.key==='kaspersky') return [
    ['Protected endpoints', `${s.count('Protected')}/${N}`], ['At-risk endpoints', s.count('At Risk')]];
  return [
    ['Monitored endpoints', N], ['Low / medium risk', s.healthy], ['High / critical risk', s.affected.length]];
}
function toolMetricsHtml(t, s){
  s = s || toolStats(t);
  const rows = toolMetricRows(t, s).concat([[t.timeLabel, fmtDateTime(s.lastUpdate)]]);
  return rows.map(r=>`<div class="tool-metric-row"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('');
}
function renderToolsPage(){
  document.getElementById('tools-page-cards').innerHTML = securityTools.filter(t=>canAccess(t.key)).map(t=>toolCardHtml(t)).join('');
}
function openToolDetail(key){
  if(!canAccess(key)) return;
  deriveAll();
  const t = securityTools.find(x=>x.key===key);
  const s = toolStats(t);
  const rows = toolMetricRows(t, s);
  if(t.key==='sccm') rows.push(['Missing updates', patchSummary().missing]);
  if(t.key==='trendmicro') rows.push(['Critical risk endpoints', s.count('Critical Risk')]);
  openModal({
    title: t.name,
    wide:true,
    body: `
      <div class="detail-grid" style="margin-bottom:16px;">
        ${rows.map(r=>`<div class="detail-row"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('')}
        <div class="detail-row"><span class="k">Open findings</span><span class="v">${s.openFindings}</span></div>
        <div class="detail-row"><span class="k">Tool status</span><span class="v">${statusBadge(t.status)}</span></div>
        <div class="detail-row"><span class="k">${t.timeLabel}</span><span class="v">${fmtDateTime(s.lastUpdate)}</span></div>
      </div>
      <div class="section-label">Affected endpoints &mdash; ${t.affectedLabel} (${s.affected.length})</div>
      ${s.affected.length ? `<div class="table-scroll" style="max-height:280px;overflow-y:auto;"><table><thead><tr><th>Endpoint</th><th>${t.name} status</th><th>Endpoint status</th><th>${t.timeLabel}</th></tr></thead><tbody>
        ${s.affected.map(e=>`<tr><td><span class="link-cell" onclick="openEndpointDetail('${e.id}')">${e.id}</span></td><td>${statusBadge(e[t.field])}</td><td>${overallBadge(computeOverall(e))}</td><td>${fmtDateTime(e.lastSync[t.key])}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state">${ICONS.check}<div class="e1">No affected endpoints for this tool</div></div>`}
      <div class="form-hint" style="margin-top:14px;">${t.note} Values are calculated from the shared sample data; integration fields are illustrative and to be confirmed with actual ${t.name} data sources.</div>
    `,
    footer: `${t.key==='sccm' ? `<button class="btn btn-secondary" onclick="closeModal();goTo('sccm')">View Patch Compliance</button>` : ''}
      <button class="btn btn-primary" onclick="closeModal();goTo('endpoints',{tool:'${t.key}'})" ${s.affected.length?'':'disabled style="opacity:.55;cursor:not-allowed;"'}>View affected endpoints (${s.affected.length})</button>`
  });
}

/* =====================================================================
   22. MICROSOFT DEFENDER EDR (Step 3) — FGV side only.
   Pure calculation (defenderMetrics & friends) is kept separate from
   rendering. There is NO second dataset: everything is derived from the
   shared `endpoints` array, so CRUD edits and CSV imports flow through.
     Risk level     <- e.defender      (At Risk = High, Offline = Unknown, Protected = Low)
     Exposure level <- e.ext.exposure  (prototype/mock field: Low / Medium / High)
     Domain/Workgroup <- e.ext.domain  (prototype/mock field)
===================================================================== */
const DEF_EXPOSURE_POINTS = {High:60, Medium:30, Low:10};
const DEF_RISK_POINTS = {High:25, Unknown:10, Low:0};
function defRiskLevel(e){ return e.defender==='At Risk' ? 'High' : e.defender==='Offline' ? 'Unknown' : 'Low'; }
function defExposureLevel(e){ const v = e.ext && e.ext.exposure; return DEF_EXPOSURE_POINTS[v] ? v : 'Low'; }
/* Location rule (prototype/mock mapping, not the real FGV structure):
   FINAL RULE: Workgroup -> Branch; Domain containing FELHQR -> Wisma FGV HQ.
   No other location values exist. Every page uses getEndpointLocation(); change the rule here only. */
const LOC_HQ = 'Wisma FGV HQ', LOC_BRANCH = 'Branch';
function getEndpointLocation(e){
  if(defDomain(e)==='Workgroup') return LOC_BRANCH;
  return String((e.ext && e.ext.domainName) || '').toUpperCase().includes('FELHQR') ? LOC_HQ : '—';   // no rule for other domains: nothing is invented
}
function defDomain(e){ return (e.ext && e.ext.domain)==='Workgroup' ? 'Workgroup' : 'Domain-Joined'; }
/* Exposure score (0-105): exposure level 60/30/10 + risk level 25/10/0 +
   3 per unresolved vulnerability (max 5 counted) + 5 if Workgroup. */
function defExposureScore(e){
  return DEF_EXPOSURE_POINTS[defExposureLevel(e)] + DEF_RISK_POINTS[defRiskLevel(e)]
    + Math.min(e.vulnCount||0, 5)*3 + (defDomain(e)==='Workgroup' ? 5 : 0);
}
const DEF_LISTS = {
  all:          {title:'All Defender endpoints',       test:e=>true},
  domain:       {title:'Domain-Joined endpoints',      test:e=>defDomain(e)==='Domain-Joined'},
  workgroup:    {title:'Workgroup endpoints',          test:e=>defDomain(e)==='Workgroup'},
  highRisk:     {title:'High Risk endpoints',          test:e=>defRiskLevel(e)==='High'},
  unknownRisk:  {title:'Endpoints not reporting (risk unknown)', test:e=>defRiskLevel(e)==='Unknown'},
  lowRisk:      {title:'Low Risk endpoints',           test:e=>defRiskLevel(e)==='Low'},
  highExposure: {title:'High Exposure endpoints',      test:e=>defExposureLevel(e)==='High'},
  medExposure:  {title:'Medium Exposure endpoints',    test:e=>defExposureLevel(e)==='Medium'},
  lowExposure:  {title:'Low Exposure endpoints',       test:e=>defExposureLevel(e)==='Low'},
};
function defenderMetrics(){
  const count = k=> endpoints.filter(DEF_LISTS[k].test).length;
  const ranked = endpoints.slice().sort((a,b)=> defExposureScore(b)-defExposureScore(a) || a.id.localeCompare(b.id));
  return {
    total: endpoints.length, domain: count('domain'), workgroup: count('workgroup'),
    highRisk: count('highRisk'), unknownRisk: count('unknownRisk'), lowRisk: count('lowRisk'),
    highExposure: count('highExposure'), medExposure: count('medExposure'), lowExposure: count('lowExposure'),
    top5: ranked.slice(0,5),
  };
}
function defLevelBadge(level, kind){
  const bad = level==='High', mid = level==='Medium' || level==='Unknown';
  const cls = bad ? 'badge-red' : mid ? (kind==='risk' ? 'badge-slate' : 'badge-amber') : 'badge-green';
  return `<span class="badge ${cls}">${esc(level)}</span>`;
}
function defDomainBadge(d, e){
  const nm = '';
  return `<span class="badge ${d==='Workgroup'?'badge-amber':'badge-blue'}">${d}</span>${nm}`;
}
function defRowHtml(e){
  const x = e.ext || {};
  return `<tr class="def-row" onclick="openEndpointDetail('${esc(e.id)}')" title="Open endpoint details">
    <td><span class="link-cell">${esc(e.id)}</span></td>
    <td>${esc(x.ip||'—')}</td><td>${esc(getEndpointLocation(e))}</td>
    <td>${defDomainBadge(defDomain(e), e)}</td>
    <td>${statusBadge(e.defender)}</td>
    <td>${defLevelBadge(defRiskLevel(e),'risk')}</td>
    <td>${defLevelBadge(defExposureLevel(e),'exposure')}</td>
    <td>${fmtDateTime(e.lastSeen)}</td>
    <td>${overallBadge(computeOverall(e))}</td></tr>`;
}
const DEF_LIST_HEAD = '<tr><th>Hostname</th><th>IP address</th><th>Location</th><th>Domain / Workgroup</th><th>Defender status</th><th>Risk level</th><th>Exposure level</th><th>Last check-in</th><th>Endpoint status</th></tr>';
let defListState = null;
function openDefenderList(kind){
  deriveAll();
  const def = DEF_LISTS[kind]; if(!def) return;
  defListState = {kind, search:''};
  openModal({
    title: `${def.title} <span class="mock-tag">Prototype Data</span>`, wide:true,
    body:`
      <div class="table-toolbar" style="padding:0 0 10px;">
        <div class="search-box" style="flex:none;">${ICONS.search}<input type="text" id="def-list-search" placeholder="Search hostname, IP, location&hellip;" oninput="defListState.search=this.value;renderDefenderList()"></div>
        <span class="form-hint" id="def-list-count"></span>
      </div>
      <div class="table-scroll" style="max-height:52vh;overflow:auto;"><table><thead>${DEF_LIST_HEAD}</thead><tbody id="def-list-tbody"></tbody></table></div>
      <div class="form-hint" style="margin-top:10px;">Sorted by exposure ranking (highest first). Click a row for the full endpoint detail. Prototype data &mdash; not collected from the FGV environment.</div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  });
  const box = document.querySelector('#modal-overlay .modal-box'); if(box) box.classList.add('xwide');
  renderDefenderList();
}
function renderDefenderList(){
  const tb = document.getElementById('def-list-tbody'); if(!tb || !defListState) return;
  const q = defListState.search.trim().toLowerCase();
  const all = endpoints.filter(DEF_LISTS[defListState.kind].test);
  const rows = all.filter(e=>{ if(!q) return true; const x = e.ext||{};
    return [e.id, x.ip, getEndpointLocation(e)].some(v=>String(v||'').toLowerCase().includes(q)); })
    .sort((a,b)=> defExposureScore(b)-defExposureScore(a) || a.id.localeCompare(b.id));
  tb.innerHTML = rows.length ? rows.map(defRowHtml).join('')
    : `<tr><td colspan="10"><div class="empty-state">${ICONS.check}<div class="e1">No endpoints in this list</div></div></td></tr>`;
  document.getElementById('def-list-count').textContent = `${rows.length}${q?` of ${all.length}`:''} endpoint${rows.length===1?'':'s'}`;
}
function defKpiCard(label, value, sub, kind, sev){
  return `<div class="kpi-card ${sev||''}" role="button" tabindex="0" onclick="openDefenderList('${kind}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDefenderList('${kind}');}">
    <div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
}
function defBarRow(label, n, total, color, kind){
  return `<div class="def-bar-row" onclick="openDefenderList('${kind}')"><span class="def-bar-label">${label}</span>
    <div class="def-bar-track"><div class="def-bar-fill" style="width:${pct(n,total)}%;background:${color};"></div></div>
    <span class="def-bar-val">${n} <span style="font-weight:500;color:var(--text-faint);">(${pct(n,total)}%)</span></span></div>`;
}
function renderDefenderPage(){
  if(!document.getElementById('def-kpis')) return;
  const m = defenderMetrics(), N = m.total;
  document.getElementById('def-kpis').innerHTML =
    defKpiCard('Total Defender endpoints', N, 'All monitored FGV endpoints', 'all') +
    defKpiCard('Domain-Joined', m.domain, `${pct(m.domain,N)}% of endpoints`, 'domain') +
    defKpiCard('Workgroup', m.workgroup, `${pct(m.workgroup,N)}% of endpoints`, 'workgroup') +
    defKpiCard('High Risk', m.highRisk, 'Defender status: At Risk', 'highRisk') +
    defKpiCard('High Exposure', m.highExposure, 'Exposure level: High', 'highExposure');
  const dp = pct(m.domain,N), wp = N ? 100-dp : 0;
  document.getElementById('def-domain-panel').innerHTML = `
    <div class="panel-head"><div><h3>Domain-Joined vs Workgroup</h3><div class="panel-sub">Ratio across ${N} endpoints</div></div></div>
    <div class="def-split">
      ${m.domain?`<div class="seg-domain" style="width:${dp}%;" onclick="openDefenderList('domain')">${dp}%</div>`:''}
      ${m.workgroup?`<div class="seg-work" style="width:${wp}%;" onclick="openDefenderList('workgroup')">${wp}%</div>`:''}
    </div>
    <div class="def-legend">
      <span onclick="openDefenderList('domain')"><i class="def-dot" style="background:var(--blue);"></i>Domain-Joined <b>${m.domain}</b></span>
      <span onclick="openDefenderList('workgroup')"><i class="def-dot" style="background:var(--amber);"></i>Workgroup <b>${m.workgroup}</b></span>
    </div>
    <div class="form-hint" style="margin-top:10px;">Ratio: ${m.domain} domain-joined to ${m.workgroup} workgroup.</div>`;
  document.getElementById('def-dist-panel').innerHTML = `
    <div class="panel-head"><div><h3>Risk &amp; exposure distribution</h3><div class="panel-sub">Click a bar to list the endpoints</div></div></div>
    <div class="def-sub">Risk level (from Defender status)</div>
    ${defBarRow('High', m.highRisk, N, 'var(--red)', 'highRisk')}
    ${defBarRow('Unknown', m.unknownRisk, N, 'var(--text-faint)', 'unknownRisk')}
    ${defBarRow('Low', m.lowRisk, N, 'var(--green)', 'lowRisk')}
    <div class="def-sub">Exposure level</div>
    ${defBarRow('High', m.highExposure, N, 'var(--red)', 'highExposure')}
    ${defBarRow('Medium', m.medExposure, N, 'var(--amber)', 'medExposure')}
    ${defBarRow('Low', m.lowExposure, N, 'var(--green)', 'lowExposure')}`;
  document.getElementById('def-top5-panel').innerHTML = `
    <div class="panel-head"><div><h3>Top 5 Exposed Endpoints</h3>
      <div class="panel-sub">Ranked by exposure level, risk level, open vulnerabilities and Workgroup status</div></div></div>
    <div class="table-scroll"><table><thead><tr><th>#</th><th>Hostname</th><th>IP address</th><th>Location</th><th>Domain / Workgroup</th><th>Defender status</th><th>Risk</th><th>Exposure</th><th>Open vulnerabilities</th><th>Last check-in</th></tr></thead>
    <tbody>${m.top5.length ? m.top5.map((e,i)=>`<tr class="def-row" onclick="openEndpointDetail('${esc(e.id)}')" title="Open endpoint details">
      <td><b>${i+1}</b></td><td><span class="link-cell">${esc(e.id)}</span></td><td>${esc((e.ext||{}).ip||'—')}</td><td>${esc(getEndpointLocation(e))}</td>
      <td>${defDomainBadge(defDomain(e), e)}</td><td>${statusBadge(e.defender)}</td><td>${defLevelBadge(defRiskLevel(e),'risk')}</td><td>${defLevelBadge(defExposureLevel(e),'exposure')}</td>
      <td>${e.vulnCount}</td><td>${fmtDateTime(e.lastSeen)}</td></tr>`).join('')
      : `<tr><td colspan="10"><div class="empty-state">${ICONS.search}<div class="e1">No endpoints</div></div></td></tr>`}</tbody></table></div>`;
}


