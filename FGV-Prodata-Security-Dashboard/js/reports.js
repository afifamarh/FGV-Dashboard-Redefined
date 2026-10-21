/* =====================================================================
   12. REPORTS — View / Generate / Export (CSV), all from shared data
===================================================================== */
const REPORTS = [
  {key:'endpoint', title:'Endpoint Security Report', desc:'Summary of endpoint status across Defender, SCCM, Kaspersky and Trend Micro Vision One.'},
  {key:'vuln', title:'Vulnerability Report', desc:'All open, in-progress and resolved vulnerabilities by severity and endpoint.'},
  {key:'hardening', title:'Security Hardening Report', desc:'Sample hardening control compliance and affected endpoints.'},
  {key:'patch', title:'Patch Compliance Report', tool:'sccm', desc:`Fleet-wide patch and update compliance against the proposed ${PATCH_SLA_THRESHOLD}% SLA.`},
  {key:'tools', title:'Security Tool Status Report', desc:'Operational status, coverage and last update for each core security tool.'},
];
function renderReportsPage(){
  renderImportPanel();
  document.getElementById('report-cards').innerHTML = REPORTS.filter(r=>reportAllowed(r.key)).map(r=>`
    <div class="report-card">
      <div class="report-card-head">
        <div class="report-icon">${ICONS.file}</div>
        <div class="report-title">${r.title}</div>
      </div>
      <div class="report-desc">${r.key==='endpoint' && roleTools().length<securityTools.length ? `Summary of endpoint status across ${roleTools().map(t=>t.name).join(', ')}.` : r.desc}</div>
      <div class="form-hint" style="margin-top:0;">Live preview from current prototype data</div>
      <div class="report-actions" style="flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewReport('${r.key}')">${ICONS.eye} View</button>
        <button class="btn btn-primary btn-sm" onclick="exportReport('${r.key}')">${ICONS.down} Export CSV</button>
      </div>
    </div>
  `).join('');
}
function reportSummary(key){
  deriveAll();
  if(key==='endpoint'){
    const c = overallCounts();
    return `${endpoints.length} endpoints monitored${roleTools().length<securityTools.length ? ` (${roleTools().map(t=>t.name).join(', ')})` : ''}. ${c.Protected} protected, ${c['Attention Required']} require attention, ${c.Critical} critical, ${c.Offline} offline. Fleet hardening score ${fleetHardeningScore()}/100.`;
  }
  if(key==='vuln'){
    const rv = roleVulns(), c = vulnSeverityCounts(rv);
    return `${rv.length} vulnerabilities recorded &mdash; ${c.Critical} critical, ${c.High} high, ${c.Medium} medium, ${c.Low} low. ${rv.filter(v=>v.status==='Resolved').length} resolved; ${rv.filter(v=>v.severity==='Critical' && v.status!=='Resolved').length} critical still unresolved.`;
  }
  if(key==='hardening'){
    const rc = roleControls(), stats = rc.map(controlStats);
    return `${rc.length===hardeningControls.length ? `Fleet hardening score ${fleetHardeningScore()}/100 across ` : 'Across '}${rc.length} sample controls. ${stats.filter(s=>s.band==='compliant').length} compliant, ${stats.filter(s=>s.band==='attention').length} need attention, ${stats.filter(s=>s.band==='noncompliant').length} non-compliant.`;
  }
  if(key==='patch'){
    const ps = patchSummary();
    const ss = sccmSummary();
    return `SCCM compliance ${fmtPct2(ss.compliancePct)} (target ${SCCM_TARGET_PCT}%): ${ss.compliant} compliant of ${ss.denominator} assets in coverage; ${ss.problem} problem(s) to resolve. ${ps.compliancePct}% of applicable updates installed (${ps.installed}/${ps.applicable}). ${ps.compliant} compliant and ${ps.nonCompliant} non-compliant endpoint(s); ${ps.missing} missing updates; ${ps.attention.length} endpoint(s) require attention. Last patch check ${fmtDateTime(ps.lastCheck)}.`;
  }
  const stats = roleTools().map(toolStats);
  return `${stats.length===securityTools.length ? 'All four core security tools' : 'Your security tools'} report operational status. Latest data: ${stats.map(s=>`${s.tool.name} ${fmtDateTime(s.lastUpdate)}`).join('; ')}.`;
}
function reportRows(key){
  deriveAll();
  const plain = v => { const d = validDate(v); return d ? fmtDateTime(v).replace('&mdash;','') : ''; };
  if(key==='endpoint'){
    return endpoints.map(e=>{
      const row = {Endpoint:e.id, OS:e.os, Defender:e.defender, SCCM:e.sccm, Kaspersky:e.kaspersky,
        'Trend Micro':e.trendmicro, 'Overall Status':computeOverall(e), 'Hardening Score':e.hardening,
        'Patch Compliance %':e.patchCompliance, 'Open Vulnerabilities':e.vulnCount, 'Last Seen':plain(e.lastSeen)};
      if(!canAccess('defender')) delete row.Defender;
      if(!canAccess('sccm')){ delete row.SCCM; delete row['Patch Compliance %']; }
      if(!canAccess('kaspersky')) delete row.Kaspersky;
      if(!canAccess('trendmicro')) delete row['Trend Micro'];
      return row;
    });
  }
  if(key==='vuln'){
    return roleVulns().map(v=>({ID:v.id, Severity:v.severity, Endpoint:v.endpoint, Description:v.description,
      Source:v.source, 'Detected Date':plain(v.detected), Status:v.status}));
  }
  if(key==='hardening'){
    return roleControls().map(controlStats).map(s=>({Control:s.control.control, Source:s.control.source,
      'Expected Status':s.control.expected, 'Current Status':s.current, 'Compliance %':s.compliance,
      'Affected Endpoints':s.failing.length, 'Affected List':s.failing.map(e=>e.id).join(' '),
      'Remediation Status':s.remediationStatus, Remediation:s.failing.length ? s.control.remediation : 'No action required',
      'Last Evaluated':plain(dataAsOf()), 'Sample / Proposed':'Yes'}));
  }
  if(key==='patch'){
    const att = patchSummary().attention;
    return endpoints.map(e=>{
      const a = att.find(x=>x.e.id===e.id);
      return {Endpoint:e.id, 'Applicable Updates':e.patch.applicable, 'Installed Updates':e.patch.installed,
        'Missing Updates':e.missingUpdates, 'Patch Compliance %':e.patchCompliance, 'SCCM Status':e.sccm,
        'Last Check':plain(e.lastSync.sccm), 'Requires Attention':a ? a.reasons.join('; ') : 'No'};
    });
  }
  return roleTools().map(toolStats).map(s=>({Tool:s.tool.name, Status:s.tool.status,
    'Healthy Endpoints':s.healthy, 'Affected Endpoints':s.affected.length, 'Open Findings':s.openFindings,
    'Last Update':plain(s.lastUpdate)}));
}
function showReportModal(key){
  if(!reportAllowed(key)){ showToast('This report is not available for your role','error'); return; }
  const r = REPORTS.find(x=>x.key===key);
  const rows = reportRows(key);
  openModal({
    title: r.title,
    wide:true,
    body:`<div class="section-label">Summary</div><div class="confirm-body" style="margin-bottom:14px;">${reportSummary(key)}</div>
      <div class="form-hint" style="margin-bottom:14px;">Live preview from current prototype data. Sample tool data as of ${fmtDateTime(dataAsOf())}.</div>
      <div class="section-label">Report data (${rows.length} rows)</div>
      <div class="table-scroll" style="max-height:280px;overflow-y:auto;">
        ${rows.length ? `<table><thead><tr>${Object.keys(rows[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row=>`<tr>${Object.values(row).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : `<div class="empty-state"><div class="e1">No data to report</div></div>`}
      </div>
      <div class="form-hint" style="margin-top:10px;">Sample report from prototype data. In production, this would be generated from approved FGV Prodata data sources.</div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="exportReport('${key}')">${ICONS.down} Export CSV</button>`
  });
}
function viewReport(key){ showReportModal(key); }
function exportReport(key){
  if(!reportAllowed(key)){ showToast('This report is not available for your role','error'); return; }
  const r = REPORTS.find(x=>x.key===key);
  const rows = reportRows(key);
  if(!rows.length){ showToast('Nothing to export for this report','error'); return; }
  const now = new Date();
  const csv = `# ${r.title}\r\n# Exported ${fmtDateTime(now)} (browser time); sample data as of ${fmtDateTime(dataAsOf())}\r\n` + arrayToCsv(rows);
  const filename = `fgv-prodata-${key}-report-${todayLocal()}.csv`;
  downloadTextFile(filename, csv, 'text/csv;charset=utf-8;');
  showToast(`"${r.title}" exported as ${filename}`, 'ok');
}

