/* =====================================================================
   10. SECURITY HARDENING — clickable KPIs, filtered controls table, chart
===================================================================== */
const HARDENING_FILTER_LABELS = {all:'All controls', compliant:'Compliant controls (85% and above)', attention:'Controls needing attention (65–84%)', noncompliant:'Non-compliant controls (below 65%)'};
function renderHardeningPage(){
  const stats = hardeningControls.map(controlStats);
  const score = fleetHardeningScore();
  const n = band => stats.filter(s=>s.band===band).length;
  const kpis = [
    {key:'all', label:'Overall Hardening Score', value:score, sub:`${hardeningControls.length} controls, ${endpoints.length} endpoints`, tone:'blue', icon:'sliders'},
    {key:'compliant', label:'Compliant Controls', value:n('compliant'), sub:'85% of endpoints or more', tone:'green', icon:'check'},
    {key:'attention', label:'Needs Attention', value:n('attention'), sub:'65&ndash;84% of endpoints', tone:'amber', icon:'warn'},
    {key:'noncompliant', label:'Non-Compliant Controls', value:n('noncompliant'), sub:'Below 65% of endpoints', tone:'red', icon:'x'},
  ].map(k=>({...k, active: hardeningFilter===k.key, action:()=>setHardeningFilter(k.key, true)}));
  document.getElementById('hardening-kpis').innerHTML = kpis.map(kpiCardHtml).join('');
  bindKpiActions('hardening-kpis', kpis);

  const rows = stats.filter(s=> hardeningFilter==='all' || s.band===hardeningFilter)
                    .sort((a,b)=> hardeningFilter==='all' ? 0 : a.compliance-b.compliance);
  const tbody = document.getElementById('hardening-tbody');
  tbody.innerHTML = rows.length ? rows.map(s=>`
    <tr class="clickable" onclick="openControlDetail('${s.control.key}')" title="View affected endpoints">
      <td><b>${s.control.control}</b><div class="form-hint" style="margin-top:2px;">${s.control.source}</div></td>
      <td class="cell-wrap">${s.control.expected}</td>
      <td>${s.current}</td>
      <td><b style="color:${complianceColor(s.compliance)}">${s.compliance}%</b></td>
      <td>${s.failing.length ? `<span class="link-cell">${s.failing.length} endpoint${s.failing.length>1?'s':''}</span>` : '0'}</td>
      <td class="remediation-cell">${remediationBadge(s.remediationStatus)}<div class="r-text">${s.failing.length ? s.control.remediation : 'No action required'}</div></td>
    </tr>`).join('')
    : `<tr><td colspan="6"><div class="empty-state">${ICONS.check}<div class="e1">No controls in this category</div><div style="margin-bottom:12px;">Every control currently falls into another band.</div><button class="btn btn-secondary btn-sm" onclick="setHardeningFilter('all')">Show all controls</button></div></td></tr>`;

  const banner = document.getElementById('hardening-filter-banner');
  banner.classList.toggle('show', hardeningFilter!=='all');
  banner.innerHTML = hardeningFilter!=='all' ? `${ICONS.filter}<span class="fb-text">Showing <b>${HARDENING_FILTER_LABELS[hardeningFilter]}</b> &mdash; ${rows.length} of ${stats.length} controls.</span><button class="btn btn-secondary btn-sm" onclick="setHardeningFilter('all')">Show all controls</button>` : '';
  renderHardeningChart();
}
function setHardeningFilter(key, scroll){
  hardeningFilter = key;
  renderHardeningPage();
  if(scroll){
    const el = document.getElementById('hardening-note');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }
}
function openControlDetail(key){
  deriveAll();
  const c = hardeningControls.find(x=>x.key===key);
  if(!c) return;
  const s = controlStats(c);
  const row = (k,v)=>`<div class="detail-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  openModal({
    title: `${c.control} <span class="proposed-tag">Sample control</span>`,
    wide:true,
    body:`
      <div class="detail-grid" style="margin-bottom:16px;">
        ${row('Data source', c.source)}
        ${row('Expected status', c.expected)}
        ${row('Current status', s.current)}
        ${row('Compliance', `<b style="color:${complianceColor(s.compliance)}">${s.compliance}%</b>`)}
        ${row('Remediation status', remediationBadge(s.remediationStatus))}
        ${row('Remediation', s.failing.length ? c.remediation : 'No action required')}
      </div>
      <div class="section-label">Affected endpoints (${s.failing.length})</div>
      ${s.failing.length ? `<div class="table-scroll" style="max-height:280px;overflow-y:auto;"><table><thead><tr><th>Endpoint</th><th>Overall status</th><th>Hardening score</th><th>Last seen</th></tr></thead><tbody>
        ${s.failing.map(e=>`<tr><td><span class="link-cell" onclick="openEndpointDetail('${e.id}')">${esc(e.id)}</span></td><td>${overallBadge(computeOverall(e))}</td><td><b style="color:${complianceColor(e.hardening)}">${e.hardening}</b></td><td>${fmtDateTime(e.lastSeen)}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state">${ICONS.check}<div class="e1">All endpoints meet this control</div></div>`}
      <div class="form-hint" style="margin-top:12px;">Proposed sample control for prototype demonstration only &mdash; not an actual FGV Prodata policy.</div>
    `,
    footer: s.failing.length ? `<button class="btn btn-primary" onclick="closeModal();goTo('endpoints',${c.tool ? `{tool:'${c.tool}'}` : `{flag:{type:'control',key:'${c.key}'}}`})">View in Endpoint Security</button>` : ''
  });
}

