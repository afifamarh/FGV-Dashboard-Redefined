/* =====================================================================
   8. ENDPOINT SECURITY — table, search/filter, CRUD, read-only detail view
===================================================================== */
const ENDPOINT_FILTER_IDS = ['endpoint-search','filter-overall','filter-defender','filter-sccm','filter-kaspersky','filter-trendmicro','filter-os','filter-patch','filter-lastseen','filter-cfg'];

// Deterministic string hash used by endpoint-history demo categorisation.
// Keep this local helper available before buildEndpointHistory() calls it.
function hashStr(value) {
  const str = String(value ?? '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function applyEndpointOptFilter(opts){
  ENDPOINT_FILTER_IDS.forEach(id=> document.getElementById(id).value = '');
  endpointFlag = null;
  if(!opts) return;
  if(opts.overall) document.getElementById('filter-overall').value = opts.overall;
  if(opts.tool) document.getElementById('filter-'+opts.tool).value = '__affected';
  if(opts.sccm) document.getElementById('filter-sccm').value = opts.sccm;
  if(opts.flag) endpointFlag = opts.flag;
}
/* Last-seen buckets are measured against the latest check-in in the data (same reference the
   dashboard's "sample data as of" uses), so sample data and imports behave consistently. */
function endpointMatchesLastSeen(e, v){
  if(!v) return true;
  const d = validDate(e.lastSeen);
  if(v==='never') return !d;
  if(!d) return false;
  const ref = validDate(dataAsOf()); if(!ref) return false;
  const day = x=>new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  if(v==='today') return day(d)===day(ref);
  const within7 = (ref.getTime() - d.getTime()) <= 7*24*3600*1000;
  return v==='7d' ? within7 : !within7;
}
function refreshEndpointOsFilter(){
  const sel = document.getElementById('filter-os'); if(!sel) return;
  const cur = sel.value, vals = [...new Set(endpoints.map(e=>e.os).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">OS: all</option>` + vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value = vals.includes(cur) ? cur : '';
}
function endpointMatchesTool(e, toolKey, value){
  if(!value) return true;
  const t = securityTools.find(x=>x.key===toolKey);
  if(value==='__affected') return t.affected.includes(e[t.field]);
  return e[t.field] === value;
}
function endpointFlagMatches(e){
  if(!endpointFlag) return true;
  if(endpointFlag.type==='vulnerable') return e.vulnCount > 0;
  if(endpointFlag.type==='patchAttention') return patchSummary().attention.some(a=>a.e.id===e.id);
  if(endpointFlag.type==='control'){ const c = hardeningControls.find(x=>x.key===endpointFlag.key); return c ? !c.check(e) : true; }
  return true;
}
function endpointFlagLabel(){
  if(!endpointFlag) return '';
  if(endpointFlag.type==='vulnerable') return 'endpoints with unresolved vulnerabilities';
  if(endpointFlag.type==='patchAttention') return 'endpoints requiring patch attention';
  if(endpointFlag.type==='control'){ const c = hardeningControls.find(x=>x.key===endpointFlag.key); return c ? `endpoints failing &ldquo;${c.control}&rdquo;` : ''; }
  return '';
}
/* Pagination + sorting state for Endpoint Security. Rows are filtered
   over the FULL endpoints array, sorted, then sliced into one page —
   the filtered (pre-slice) length is what every count/KPI/banner uses,
   so numbers never reflect only the visible page. */
/* ---- Endpoint Configuration checklist (Step 2) -----------------------
   One definition per check: where its value comes from and how it maps to
   a display state. get(e) -> [state, tone]. Values come from the existing
   endpoint fields where those exist (mock:false) or from the clearly
   labelled prototype fields in e.ext (mock:true / 'partly'). The four
   tools stay separate: each check names its own source. These are
   prototype checklist options, NOT confirmed FGV requirements. */
const ENDPOINT_CHECK_GROUPS = ['Endpoint Security / Management','Windows Security Configuration','Endpoint Identity / Connectivity','Endpoint Risk / Compliance'];
const ENDPOINT_CHECKS = [
  {key:'defender', group:0, label:'Microsoft Defender / EDR', source:'Microsoft Defender', mock:'partly',
    get:e=> e.defender==='Offline' ? ['Unhealthy','warn'] : e.defender==='At Risk' ? ['High Risk','bad'] : e.ext.exposure==='High' ? ['High Exposure','bad'] : ['Healthy','ok']},
  {key:'sccmClient', group:0, label:'SCCM Client', source:'SCCM', mock:true,
    get:e=> ({Installed:['Installed','ok'], Missing:['Missing','bad'], Problem:['Problem','warn']})[e.ext.sccmClient] || ['Unknown','na']},
  {key:'patch', group:0, label:'Latest Security Patch', source:'SCCM', mock:false,
    get:e=> !(e.patch && e.patch.applicable>0) ? ['Unknown','na'] : e.sccm==='Compliant' ? ['Compliant','ok'] : ['Non-Compliant','bad']},
  {key:'kaspersky', group:0, label:'Kaspersky / Antivirus', source:'Kaspersky', mock:false,
    get:e=> e.kaspersky==='Protected' ? ['Protected','ok'] : e.kaspersky==='At Risk' ? ['Not Protected','bad'] : ['Unknown','na']},
  {key:'trendmicro', group:0, label:'Trend Micro / Vision One', source:'Trend Micro Vision One', mock:false,
    get:e=> ['Low Risk','Medium Risk'].includes(e.trendmicro) ? ['Protected','ok'] : ['High Risk','Critical Risk'].includes(e.trendmicro) ? ['Alert','bad'] : ['Unknown','na']},
  {key:'firewall', group:1, label:'Windows Firewall', source:'Endpoint configuration', mock:false,
    get:e=> e.config && e.config.firewall===true ? ['Enabled','ok'] : e.config && e.config.firewall===false ? ['Disabled','bad'] : ['Unknown','na']},
  {key:'windowsUpdate', group:1, label:'Windows Update', source:'Endpoint configuration', mock:true,
    get:e=> ({Enabled:['Enabled','ok'], Disabled:['Disabled','bad']})[e.ext.windowsUpdate] || ['Unknown','na']},
  {key:'bitlocker', group:1, label:'BitLocker / Device Encryption', source:'Endpoint configuration (full-disk encryption)', mock:false,
    get:e=> e.config && e.config.diskEncryption===true ? ['Enabled','ok'] : e.config && e.config.diskEncryption===false ? ['Disabled','bad'] : ['Unknown','na']},
  {key:'domain', group:2, label:'Domain Joined', source:'Endpoint identity', mock:true,
    get:e=> e.ext.domain==='Domain-Joined' ? ['Yes','ok'] : ['No','warn']},
  {key:'workgroup', group:2, label:'Workgroup', source:'Endpoint identity', mock:true,
    get:e=> e.ext.domain==='Workgroup' ? ['Yes','warn'] : ['No','ok']},
  {key:'agent', group:2, label:'Agent Healthy', source:'Endpoint agent', mock:true,
    get:e=> ({Healthy:['Healthy','ok'], Problem:['Problem','bad']})[e.ext.agentHealth] || ['Unknown','na']},
  {key:'lastSeen', group:2, label:'Last Check-in', source:'Latest check-in from any tool', mock:false,
    hint:e=> e.lastSeen ? fmtDateTime(e.lastSeen).replace(/&mdash;/g,'-') : 'No check-in recorded',
    get:e=>{ const ref = validDate(dataAsOf()), seen = validDate(e.lastSeen);
      if(!seen || !ref) return ['Unknown','na'];
      return (ref - seen)/86400000 > STALE_CHECK_DAYS ? ['Stale','warn'] : ['Recent','ok']; }},
  {key:'risk', group:3, label:'Endpoint Risk Status', source:'Endpoint status (derived)', mock:false,
    get:e=>{ const o = computeOverall(e); return [o, o==='Protected'?'ok':o==='Attention Required'?'warn':o==='Critical'?'bad':'na']; }},
  {key:'pendingReboot', group:3, label:'Pending Reboot', source:'SCCM', mock:true,
    get:e=> e.ext.pendingReboot ? ['Yes','warn'] : ['No','ok']},
  {key:'vuln', group:3, label:'Vulnerability Status', source:'Vulnerability records', mock:false,
    get:e=> e.vulnCount>0 ? ['Open','bad'] : ['Clear','ok']},
];
function cfgCheck(key){ return ENDPOINT_CHECKS.find(c=>c.key===key); }
function cfgBadge(e, c){
  const [state, tone] = c.get(e);
  const map = {ok:['badge-green','check'], warn:['badge-amber','warn'], bad:['badge-red','warn'], na:['badge-slate','x']};
  const [cls, icon] = map[tone] || map.na;
  return `<span class="badge ${cls}"${c.hint?` title="${esc(c.hint(e))}"`:''}>${ICONS[icon]}${esc(state)}</span>`;
}
const CFG_FILTERS = {
  compliant:     {label:'Patch: Compliant',               test:e=>e.sccm==='Compliant'},
  noncompliant:  {label:'Patch: Non-Compliant',           test:e=>e.sccm==='Non-Compliant'},
  missingAgent:  {label:'SCCM client missing',            test:e=>e.ext.sccmClient==='Missing'},
  pendingReboot: {label:'Pending reboot',                 test:e=>!!e.ext.pendingReboot},
  domain:        {label:'Domain-joined',                  test:e=>e.ext.domain==='Domain-Joined'},
  workgroup:     {label:'Workgroup',                      test:e=>e.ext.domain==='Workgroup'},
  atRisk:        {label:'At risk (endpoint status)',       test:e=>['Attention Required','Critical'].includes(computeOverall(e))},
  vulnerable:    {label:'Vulnerable (open vulnerabilities)', test:e=>e.vulnCount>0},
};
/* Which checks are shown as table columns (UI preference only, prototype localStorage). */
let cfgSelected = [];
let cfgPanelOpen = false;
function cfgSelectedChecks(){ return ENDPOINT_CHECKS.filter(c=>cfgSelected.includes(c.key)); }
function persistCfgSelected(){ writeStore('fgv_endpoint_cfg_columns', cfgSelected); }
function toggleCfgPanel(){ cfgPanelOpen = !cfgPanelOpen; renderCfgPanel(); }
function setCfgChecks(keys){
  cfgSelected = ENDPOINT_CHECKS.map(c=>c.key).filter(k=>keys.includes(k));
  if(String(endpointSort.key).startsWith('cfg_') && !cfgSelected.includes(endpointSort.key.slice(4))) endpointSort = {key:'id', dir:'asc'};
  persistCfgSelected(); renderEndpointsPage();
}
function toggleCfgCheck(key, on){
  setCfgChecks(on ? cfgSelected.concat(key) : cfgSelected.filter(k=>k!==key));
}
function toggleCfgGroup(gi, on){
  const keys = ENDPOINT_CHECKS.filter(c=>c.group===gi).map(c=>c.key);
  setCfgChecks(on ? cfgSelected.concat(keys) : cfgSelected.filter(k=>!keys.includes(k)));
}
function renderCfgPanel(){
  const box = document.getElementById('cfg-panel'), btn = document.getElementById('cfg-toggle');
  if(!box || !btn) return;
  btn.innerHTML = `${ICONS.filter} Configuration checks (${cfgSelected.length} of ${ENDPOINT_CHECKS.length} shown)`;
  box.style.display = cfgPanelOpen ? '' : 'none';
  if(!cfgPanelOpen) return;
  box.innerHTML = `
    <div class="cfg-panel-head">
      <h4>Endpoint configuration checks <span class="mock-tag">Prototype checklist</span></h4>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="setCfgChecks(ENDPOINT_CHECKS.map(c=>c.key))">Select all</button>
        <button class="btn btn-ghost btn-sm" onclick="setCfgChecks([])">Clear</button>
      </div>
    </div>
    <div class="cfg-groups">${ENDPOINT_CHECK_GROUPS.map((g,gi)=>{
      const items = ENDPOINT_CHECKS.filter(c=>c.group===gi);
      const all = items.every(c=>cfgSelected.includes(c.key));
      return `<div><div class="cfg-group-title"><label class="cfg-item" style="display:inline-flex;margin:0;"><input type="checkbox" ${all?'checked':''} onchange="toggleCfgGroup(${gi}, this.checked)"> ${g}</label></div>
        ${items.map(c=>`<label class="cfg-item"><input type="checkbox" data-cfg="${c.key}" ${cfgSelected.includes(c.key)?'checked':''} onchange="toggleCfgCheck('${c.key}', this.checked)"> ${c.label}${c.mock?'<span class="mock-tag">Mock</span>':''}</label>`).join('')}</div>`;
    }).join('')}</div>
    <div class="form-hint" style="margin-top:10px;">Tick any number of checks to show them as columns in the endpoint table. These are prototype options &mdash; not confirmed FGV requirements. Items tagged <b>Mock</b> use dummy values generated for the prototype; the rest read the existing sample data.</div>`;
}
function cfgCells(e){ return cfgSelectedChecks().map(c=>`<td>${cfgBadge(e,c)}</td>`).join(''); }
function cfgDetailHtml(e, row){
  const x = e.ext || {}, mock = '<span class="mock-tag">Mock</span>';
  return `
      <div class="section-label">Basic endpoint information <span class="mock-tag">Prototype Data</span></div>
      <div class="detail-grid">
        ${row('Hostname', esc(e.id))}
        ${row('IP address', esc(x.ip||'&mdash;')+mock)}
        ${row('Location', esc(getEndpointLocation(e))+mock)}
        ${row('Operating system', esc(e.os))}
        ${row('Last seen', fmtDateTime(e.lastSeen))}
        ${row('Domain / Workgroup', esc(x.domain||'&mdash;')+mock)}
        ${row('Endpoint status', overallBadge(computeOverall(e)))}
      </div>
      `;
}

let endpointPage = 1, endpointPageSize = 25, endpointLastFilterSig = null;
let endpointSort = {key:'id', dir:'asc'};
const ENDPOINT_SORT_ACCESSORS = {
  id: e=>e.id, defender: e=>e.defender, sccm: e=>e.sccm, kaspersky: e=>e.kaspersky,
  trendmicro: e=>e.trendmicro, overall: e=>computeOverall(e), hardening: e=>e.hardening, vulnCount: e=>e.vulnCount,
  lastSeen: e=>e.lastSeen || '',
};
ENDPOINT_CHECKS.forEach(c=>{ ENDPOINT_SORT_ACCESSORS['cfg_'+c.key] = e=>c.get(e)[0]; });
function sortRows(rows, sort, accessors){
  const acc = accessors[sort.key];
  if(!acc) return rows;
  return rows.slice().sort((a,b)=>{
    const av = acc(a), bv = acc(b);
    const cmp = (typeof av==='number' && typeof bv==='number') ? av-bv : String(av).localeCompare(String(bv));
    return sort.dir==='asc' ? cmp : -cmp;
  });
}
function sortEndpointsBy(key){
  if(endpointSort.key===key) endpointSort.dir = endpointSort.dir==='asc' ? 'desc' : 'asc';
  else endpointSort = {key, dir:'asc'};
  renderEndpointsPage();
}
function changeEndpointPage(delta){ endpointPage += delta; renderEndpointsPage(); }
function setEndpointPageSize(v){ endpointPageSize = parseInt(v,10) || 25; endpointPage = 1; renderEndpointsPage(); }
/* Role visibility for the Endpoint Security page: hides the column / filter of any tool the role
   cannot access. Rows are never removed (endpoint records carry no FGV/FELDA ownership field). */
function applyEndpointRoleVisibility(){
  const cols = ['defender','sccm','kaspersky','trendmicro'];
  const rows = document.querySelectorAll('#page-endpoints thead tr, #endpoint-tbody tr');
  cols.forEach((k,i)=>{
    const show = canAccess(k);
    rows.forEach(tr=>{ if(tr.children.length>1 && tr.children[i+1]) tr.children[i+1].style.display = show ? '' : 'none'; });
    const sel = document.getElementById('filter-'+k);
    if(sel){ sel.style.display = show ? '' : 'none'; if(!show && sel.value) sel.value = ''; }
  });
  const pf = document.getElementById('filter-patch');
  if(pf){ pf.style.display = canAccess('sccm') ? '' : 'none'; if(!canAccess('sccm') && pf.value) pf.value = ''; }
  const cfg = document.getElementById('filter-cfg');
  const sccmOpts = ['compliant','noncompliant','missingAgent','pendingReboot'];
  if(cfg){
    [...cfg.options].forEach(o=>{ if(sccmOpts.includes(o.value)){ o.hidden = !canAccess('sccm'); o.disabled = !canAccess('sccm'); } });
    if(!canAccess('sccm') && sccmOpts.includes(cfg.value)) cfg.value = '';
  }
}
function renderEndpointsPage(){
  const search = (document.getElementById('endpoint-search').value||'').toLowerCase();
  const fOverall = document.getElementById('filter-overall').value;
  const toolFilters = securityTools.map(t=>[t.key, document.getElementById('filter-'+t.key).value]);
  const fCfg = document.getElementById('filter-cfg').value;
  refreshEndpointOsFilter();
  const fOs = document.getElementById('filter-os').value, fPatch = document.getElementById('filter-patch').value, fSeen = document.getElementById('filter-lastseen').value;

  const filtered = endpoints.filter(e=>{
    const x = e.ext || {};
    if(search && !(e.id.toLowerCase().includes(search) || e.os.toLowerCase().includes(search) || String(x.ip||'').includes(search) || String(getEndpointLocation(e)).toLowerCase().includes(search))) return false;
    if(fCfg && !CFG_FILTERS[fCfg].test(e)) return false;
    if(fOverall && computeOverall(e)!==fOverall) return false;
    if(fOs && e.os!==fOs) return false;
    if(fPatch && e.sccmState!==fPatch) return false;
    if(!endpointMatchesLastSeen(e, fSeen)) return false;
    if(!toolFilters.every(([k,v])=>endpointMatchesTool(e,k,v))) return false;
    return endpointFlagMatches(e);
  });

  // Reset to page 1 whenever the filter/search criteria change (not on page/size changes)
  const sig = JSON.stringify({search, fOverall, toolFilters, endpointFlag, fCfg, fOs, fPatch, fSeen});
  if(sig !== endpointLastFilterSig){ endpointPage = 1; endpointLastFilterSig = sig; }

  const sorted = sortRows(filtered, endpointSort, ENDPOINT_SORT_ACCESSORS);
  const totalPages = Math.max(1, Math.ceil(sorted.length / endpointPageSize));
  endpointPage = Math.min(Math.max(1, endpointPage), totalPages);
  const startIdx = (endpointPage-1) * endpointPageSize;
  const rows = sorted.slice(startIdx, startIdx + endpointPageSize);

  const tbody = document.getElementById('endpoint-tbody');
  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="${10 + cfgSelected.length}"><div class="empty-state">${ICONS.search}<div class="e1">No endpoints match your filters</div><div style="margin-bottom:12px;">Try clearing filters or search terms.</div><button class="btn btn-secondary btn-sm" onclick="clearEndpointFilters()">Clear filters</button></div></td></tr>`;
  } else {
    tbody.innerHTML = rows.map(e=>`
      <tr>
        <td><span class="link-cell" onclick="openEndpointDetail('${e.id}')">${esc(e.id)}</span></td>
        <td>${statusBadge(e.defender)}</td>
        <td>${statusBadge(e.sccm)}</td>
        <td>${statusBadge(e.kaspersky)}</td>
        <td>${statusBadge(e.trendmicro)}</td>
        <td>${overallBadge(computeOverall(e))}</td>
        <td><b style="color:${complianceColor(e.hardening)}">${e.hardening}</b></td>
        <td>${e.vulnCount ? `<span class="link-cell" onclick="goTo('vulnerabilities',{search:'${e.id}', status:'unresolved'})">${e.vulnCount}</span>` : '0'}</td>
        <td>${fmtDateTime(e.lastSeen)}</td>
        ${cfgCells(e)}
        <td><div class="row-actions">
          <div class="icon-action" title="View" onclick="openEndpointDetail('${e.id}')">${ICONS.eye}</div>
          <div class="icon-action" title="Edit" onclick="openEndpointForm('${e.id}')">${ICONS.edit}</div>
          <div class="icon-action danger" title="Delete" onclick="confirmDeleteEndpoint('${e.id}')">${ICONS.trash}</div>
        </div></td>
      </tr>
    `).join('');
  }
  const rangeStart = sorted.length ? startIdx+1 : 0;
  const rangeEnd = Math.min(startIdx+endpointPageSize, sorted.length);
  document.getElementById('endpoint-count').textContent =
    `Showing ${rangeStart}\u2013${rangeEnd} of ${sorted.length} endpoints (${endpoints.length} total)`;
  document.getElementById('endpoint-page-indicator').textContent = `Page ${endpointPage} of ${totalPages}`;
  document.getElementById('endpoint-prev').disabled = endpointPage<=1;
  document.getElementById('endpoint-next').disabled = endpointPage>=totalPages;
  document.getElementById('endpoint-page-size').value = String(endpointPageSize);
  // header cells for the ticked configuration checks (inserted before Actions)
  const headRow = document.querySelector('#page-endpoints thead tr');
  headRow.querySelectorAll('th.cfg-th').forEach(t=>t.remove());
  cfgSelectedChecks().forEach(c=>{
    const th = document.createElement('th');
    th.className = 'cfg-th'; th.dataset.sort = 'cfg_'+c.key; th.textContent = c.label;
    th.onclick = ()=> sortEndpointsBy('cfg_'+c.key);
    headRow.insertBefore(th, headRow.lastElementChild);
  });
  renderCfgPanel();
  applyEndpointRoleVisibility();
  document.querySelectorAll('#page-endpoints thead th[data-sort]').forEach(th=>{
    th.classList.toggle('sorted-asc', endpointSort.key===th.dataset.sort && endpointSort.dir==='asc');
    th.classList.toggle('sorted-desc', endpointSort.key===th.dataset.sort && endpointSort.dir==='desc');
  });

  // Banner explaining exactly which filters are active
  const parts = [];
  if(search) parts.push(`search &ldquo;${esc(search)}&rdquo;`);
  if(fOverall) parts.push(`endpoint status <b>${fOverall}</b>`);
  toolFilters.forEach(([k,v])=>{
    if(!v) return;
    const t = securityTools.find(x=>x.key===k);
    parts.push(v==='__affected' ? `<b>${t.name}</b> affected endpoints (${t.affectedLabel})` : `${t.name}: <b>${v}</b>`);
  });
  if(fOs) parts.push(`OS <b>${esc(fOs)}</b>`);
  if(fPatch) parts.push(`patch status <b>${fPatch==='Unknown' ? 'State Unknown' : fPatch}</b>`);
  if(fSeen) parts.push(`last seen <b>${document.getElementById('filter-lastseen').selectedOptions[0].text}</b>`);
  if(endpointFlag) parts.push(`<b>${endpointFlagLabel()}</b>`);
  if(fCfg) parts.push(`configuration view <b>${CFG_FILTERS[fCfg].label}</b>`);
  const banner = document.getElementById('endpoint-filter-banner');
  banner.classList.toggle('show', parts.length>0);
  banner.innerHTML = parts.length ? `${ICONS.filter}<span class="fb-text">Showing ${parts.join(', ')} &mdash; ${sorted.length} of ${endpoints.length} endpoints.</span><button class="btn btn-secondary btn-sm" onclick="clearEndpointFilters()">Clear filters</button>` : '';
}
function clearEndpointFilters(){
  applyEndpointOptFilter(null);
  endpointPage = 1;
  renderEndpointsPage();
}
/* Read-only endpoint view. Timestamps come from the endpoint's stored
   lastSync record, so they match the tool cards and reports. */
function openEndpointDetail(id){
  deriveAll();
  const e = endpoints.find(x=>x.id===id);
  if(!e){ showToast('Endpoint not found','error'); return; }
  const overall = computeOverall(e);
  const openVulns = roleVulns().filter(v=>v.endpoint===e.id && v.status!=='Resolved');
  const failing = hardeningControls.filter(c=>!c.check(e) && (!c.tool || canAccess(c.tool)));
  const row = (k,v)=>`<div class="detail-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  openModal({
    title: `${esc(e.id)} <span style="font-weight:500;font-size:12.5px;color:var(--text-muted);margin-left:6px;">${esc(e.os)} &middot; read-only</span>`,
    wide:true,
    body:`
      ${cfgDetailHtml(e,row)}
      ${canAccess('defender') ? `<div class="section-label">Microsoft Defender</div>
      <div class="detail-grid">
        ${row('Protection status', statusBadge(e.defender))}
        ${row('Threat status', e.defender==='Protected' ? 'No active threats' : e.defender==='Offline' ? 'Not reporting' : 'Threat indicators present')}
        ${row('Last update', fmtDateTime(e.lastSync.defender))}
      </div>` : ''}
      ${canAccess('sccm') ? `<div class="section-label">SCCM</div>
      <div class="detail-grid">
        ${row('Client status', cfgBadge(e, cfgCheck('sccmClient')) + '<span class="mock-tag">Mock</span>')}
        ${row('Patch status', statusBadge(e.sccm))}
        ${row('Update compliance', `${e.patchCompliance ?? 0}% (${e.patch?.installed ?? 0}/${e.patch?.applicable ?? 0})`)}
        ${row('Missing updates', e.missingUpdates)}
        ${row('Last check', fmtDateTime(e.lastSync.sccm))}
      </div>` : ''}
      ${canAccess('kaspersky') ? `<div class="section-label">Kaspersky</div>
      <div class="detail-grid">
        ${row('Protection status', statusBadge(e.kaspersky))}
        ${row('Threat status', e.kaspersky==='Protected' ? 'Clean' : 'Active detection')}
        ${row('Last update', fmtDateTime(e.lastSync.kaspersky))}
      </div>` : ''}
      ${canAccess('trendmicro') ? `<div class="section-label">Trend Micro Vision One</div>
      <div class="detail-grid">
        ${row('Risk level', statusBadge(e.trendmicro))}
        ${row('Findings from this tool (unresolved)', vulnerabilities.filter(v=>v.endpoint===e.id && v.source==='Trend Micro Vision One' && v.status!=='Resolved').length)}
        ${row('Last activity', fmtDateTime(e.lastSync.trendmicro))}
      </div>` : ''}
      <div class="section-label">Overall security</div>
      <div class="detail-grid">
        ${row('Hardening score', `${e.hardening} / 100 (${e.passedControls}/${hardeningControls.length} controls)`)}
        ${row('Unresolved vulnerabilities', e.vulnCount)}
        ${canAccess('sccm') ? row('Patch compliance', e.patchCompliance+'%') : ''}
        ${row('Recommended action', overall==='Protected' ? 'None &mdash; monitor as usual' : overall==='Critical' ? 'Isolate and remediate immediately' : overall==='Offline' ? 'Reconnect device and verify agents' : 'Review and schedule remediation')}
      </div>
      <div class="section-label">Failing hardening controls (${failing.length})</div>
      ${failing.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${failing.map(c=>`<span class="badge badge-amber">${ICONS.warn}${c.control}</span>`).join('')}</div>` : `<div class="form-hint">All sample hardening controls are met.</div>`}
      <div class="section-label">Unresolved vulnerabilities (${openVulns.length})</div>
      ${openVulns.length ? `<div class="table-scroll"><table><thead><tr><th>ID</th><th>Severity</th><th>Description</th><th>Source</th><th>Status</th></tr></thead><tbody>
        ${openVulns.map(v=>`<tr><td><b>${v.id}</b></td><td>${severityBadge(v.severity)}</td><td class="cell-wrap">${esc(v.description)}</td><td>${v.source}</td><td>${vulnStatusBadge(v.status)}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="form-hint">No unresolved vulnerabilities for this endpoint.</div>`}
    `,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  });
}
function openEndpointForm(id){
  deriveAll();
  const editing = !!id;
  const e = editing ? endpoints.find(x=>x.id===id) : null;
  const cfg = e ? e.config : {firewall:true, diskEncryption:true, usbControl:true, passwordPolicy:true};
  const sel = (fid, opts, cur)=>`<select id="${fid}">${opts.map(v=>`<option ${cur===v?'selected':''}>${v}</option>`).join('')}</select>`;
  const selWith = (fid, opts, cur)=> sel(fid, (cur && !opts.includes(cur)) ? opts.concat(cur) : opts, cur);
  const probe = {id: editing ? e.id : (document.getElementById('f-id')?.value || 'NEW-ENDPOINT')};
  ensureExt(probe);
  const x = e ? e.ext : probe.ext;
  openModal({
    title: editing ? `Edit ${esc(id)}` : 'Add endpoint',
    wide:true,
    body:`
      <div class="form-grid">
        <div class="form-field"><label for="f-id">Endpoint name</label><input id="f-id" value="${editing?esc(e.id):''}" placeholder="FGV-PC-011" oninput="clearFieldError('f-id')">
          <div class="field-error" id="f-id-error"></div></div>
        <div class="form-field"><label for="f-os">Operating system</label>${sel('f-os',['Windows 11','Windows 10'], e&&e.os)}</div>
        <div class="form-field"><label for="f-defender">Microsoft Defender</label>${sel('f-defender',['Protected','At Risk','Offline'], e&&e.defender)}</div>
        <div class="form-field"><label for="f-kaspersky">Kaspersky</label>${sel('f-kaspersky',['Protected','At Risk'], e&&e.kaspersky)}</div>
        <div class="form-field"><label for="f-trendmicro">Trend Micro Vision One</label>${sel('f-trendmicro',['Low Risk','Medium Risk','High Risk','Critical Risk'], e&&e.trendmicro)}</div>
        <div class="form-field"></div>
        <div class="form-field"><label for="f-applicable">SCCM: applicable updates</label><input id="f-applicable" type="number" min="0" step="1" value="${editing?e.patch.applicable:24}" oninput="clearFieldError('f-installed')"></div>
        <div class="form-field"><label for="f-installed">SCCM: installed updates</label><input id="f-installed" type="number" min="0" step="1" value="${editing?e.patch.installed:24}" oninput="clearFieldError('f-installed')">
          <div class="field-error" id="f-installed-error"></div></div>
        
        <div class="form-field full"><div class="section-label" style="margin:6px 0 0;">Additional endpoint details <span class="mock-tag">Prototype Data</span></div>
          <div class="form-hint">Dummy values for prototype purposes only.</div></div>
        <div class="form-field"><label for="f-ip">IP address (dummy)</label><input id="f-ip" value="${esc(x.ip)}" placeholder="10.10.1.10" oninput="clearFieldError('f-ip')"><div class="field-error" id="f-ip-error"></div></div>
        <div class="form-field"><label for="f-loc">Organisation</label><select id="f-loc">${['FGV','FELDA'].map(v=>`<option ${x.location===v?'selected':''}>${v}</option>`).join('')}</select></div>
        <div class="form-field"><label for="f-domain">Domain / Workgroup</label>${sel('f-domain',['Domain-Joined','Workgroup'], x.domain)}</div>
        <div class="form-field"><label for="f-sccmclient">SCCM client</label>${sel('f-sccmclient',['Installed','Missing','Problem'], x.sccmClient)}</div>
        <div class="form-field"><label for="f-winupdate">Windows Update</label>${sel('f-winupdate',['Enabled','Disabled','Unknown'], x.windowsUpdate)}</div>
        <div class="form-field"><label for="f-agent">Agent health</label>${sel('f-agent',['Healthy','Problem','Unknown'], x.agentHealth)}</div>
        <div class="form-field"><label for="f-reboot">Pending reboot</label>${sel('f-reboot',['No','Yes'], x.pendingReboot?'Yes':'No')}</div>
        <div class="form-field"><label for="f-exposure">Defender exposure level</label>${sel('f-exposure',['Low','Medium','High'], x.exposure)}</div>
      </div>
      <div class="form-hint" style="margin-top:12px;">SCCM status, patch compliance, hardening score, open vulnerability count and endpoint status are calculated automatically. ${editing ? 'Stored tool timestamps are kept.' : 'Tool timestamps are set to the current browser time when the endpoint is added.'}</div>
    `,
    footer:`<button class="btn btn-ghost" onclick="openEndpointForm(${editing?`'${id}'`:'null'})">Reset</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEndpoint(${editing?`'${id}'`:'null'})">${editing?'Save changes':'Add endpoint'}</button>`
  });
  /* Location only offers FGV / FELDA; an existing endpoint with an older value shows blank (and keeps its value) until one is chosen */
  const locSel = document.getElementById('f-loc');
  if(locSel && editing && !['FGV','FELDA'].includes(x.location)) locSel.selectedIndex = -1;
}
function saveEndpoint(id){
  const name = document.getElementById('f-id').value.trim().toUpperCase();
  const applicable = Math.floor(Number(document.getElementById('f-applicable').value));
  const installed = Math.floor(Number(document.getElementById('f-installed').value));
  let ok = true;
  if(!name){ setFieldError('f-id','Endpoint name is required.'); ok = false; }
  else if(endpoints.some(x=>x.id===name && x.id!==id)){ setFieldError('f-id','An endpoint with this name already exists.'); ok = false; }
  const ipVal = document.getElementById('f-ip').value.trim();
  if(ipVal && !/^(\d{1,3})(\.\d{1,3}){3}$/.test(ipVal)){ setFieldError('f-ip','Enter a dummy IPv4 address like 10.10.1.10.'); ok = false; }
  if(!(applicable>=0) || !(installed>=0)){ setFieldError('f-installed','Enter whole numbers of 0 or more.'); ok = false; }
  else if(installed > applicable){ setFieldError('f-installed','Installed updates cannot exceed applicable updates.'); ok = false; }
  if(!ok){ showToast('Fix the highlighted fields','error'); return; }

  const config = {};
  Object.assign(config, (id ? (endpoints.find(x=>x.id===id)||{}).config : null) || {firewall:true, diskEncryption:true, usbControl:true, passwordPolicy:true});
  const now = nowLocal();
  const prevExt = id ? ((endpoints.find(x=>x.id===id)||{}).ext || {}) : {};
  const data = {
    id: name,
    os: document.getElementById('f-os').value,
    defender: document.getElementById('f-defender').value,
    kaspersky: document.getElementById('f-kaspersky').value,
    trendmicro: document.getElementById('f-trendmicro').value,
    patch: {applicable, installed},
    config,
    ext: {
      ip: ipVal, location: document.getElementById('f-loc').value || prevExt.location,
      domain: document.getElementById('f-domain').value, sccmClient: document.getElementById('f-sccmclient').value,
      windowsUpdate: document.getElementById('f-winupdate').value, agentHealth: document.getElementById('f-agent').value,
      pendingReboot: document.getElementById('f-reboot').value==='Yes', exposure: document.getElementById('f-exposure').value,
      complianceState: prevExt.complianceState || '', domainName: prevExt.domainName,
    },
    lastSync: {defender:now, sccm:now, kaspersky:now, trendmicro:now},
  };
  if(id){
    const idx = endpoints.findIndex(x=>x.id===id);
    const before = endpoints[idx];
    const overallBefore = computeOverall(before);
    data.lastSync = {...before.lastSync};
    if(name !== id) vulnerabilities.forEach(v=>{ if(v.endpoint===id) v.endpoint = name; });
    endpoints[idx] = data;
    deriveEndpoint(data);
    const overallAfter = computeOverall(data);
    showToast('Endpoint updated successfully','ok');
    if(notifPrefs.security && overallBefore==='Protected' && overallAfter!=='Protected'){
      pushNotification({icon:'shieldPlain', tone:'red', category:'security', title:'Security protection status requires review',
        desc:`${data.id} changed from Protected to ${overallAfter}`,
        action:()=>{ goTo('endpoints'); openEndpointDetail(data.id); }});
    }
  } else {
    endpoints.push(data);
    deriveEndpoint(data);
    showToast('Endpoint added successfully','ok');
    const overall = computeOverall(data);
    if(notifPrefs.endpoint && (overall==='Attention Required' || overall==='Critical')){
      pushNotification({icon:'warn', tone: overall==='Critical'?'red':'amber', category:'endpoint',
        title:'Endpoint requires attention', desc:`${data.id} was added with status: ${overall}`,
        action:()=>goTo('endpoints',{overall})});
    }
  }
  closeModal();
  refreshViews();
}
function confirmDeleteEndpoint(id){
  const linked = vulnerabilities.filter(v=>v.endpoint===id).length;
  openModal({
    title:'Delete endpoint',
    body:`<div class="confirm-body">Are you sure you want to delete <b>${esc(id)}</b>? ${linked ? `Its <b>${linked}</b> linked vulnerability record(s) will also be removed.` : ''} This action cannot be undone.</div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="deleteEndpoint('${id}')">Delete endpoint</button>`
  });
}
function deleteEndpoint(id){
  endpoints = endpoints.filter(x=>x.id!==id);
  vulnerabilities = vulnerabilities.filter(v=>v.endpoint!==id);
  closeModal();
  refreshViews();
  showToast('Endpoint deleted successfully','ok');
}

/* =====================================================================
   ENDPOINT HISTORY — separate, additive page. Sample/mock activity records are
   GENERATED from the existing endpoint data (nothing stored, nothing in the
   endpoint dataset is changed), so hostnames, tool statuses and timestamps stay
   consistent with Endpoint Security. Visibility reuses canAccess() (the same
   role permission table): a record shows only if its tool AND its location
   (FGV = Defender/SCCM, FELDA = Kaspersky/Trend Micro) are allowed for the role.
===================================================================== */
const HISTORY_ORG_TOOLS = {FGV:['defender','sccm'], FELDA:['kaspersky','trendmicro']};
/* Location comes from the endpoint's Location field when it is FGV or FELDA; older records that
   still have another value get a stable sample assignment so the demo has both organisations. */
function historyOrg(e){
  const l = e.ext && e.ext.location;
  if(l==='FGV' || l==='FELDA') return l;
  return hashStr(String(e.id)+'-org')%3===0 ? 'FELDA' : 'FGV';
}
function historyOrgAllowed(org){ return HISTORY_ORG_TOOLS[org].some(k=>canAccess(k)); }
function historyToolName(k){ const t = securityTools.find(x=>x.key===k); return t ? t.name : k; }
function historyLatest(k, e){
  if(k==='defender') return e.defender==='Protected' ? {activity:'Endpoint Seen', status:'Healthy'}
    : e.defender==='Offline' ? {activity:'Endpoint Offline', status:'Offline'} : {activity:'Threat Detected', status:'Warning'};
  if(k==='sccm') return e.sccmState==='Unknown' ? {activity:'Compliance Check', status:'Unknown'}
    : {activity:'Patch Check', status:e.sccmState};
  if(k==='kaspersky') return e.kaspersky==='Protected' ? {activity:'Security Scan', status:'Passed'} : {activity:'Threat Detected', status:'Warning'};
  return e.trendmicro==='Low Risk' ? {activity:'Endpoint Check', status:'Healthy'}
    : e.trendmicro==='Medium Risk' ? {activity:'Endpoint Check', status:'Warning'} : {activity:'Threat Detected', status:'Critical'};
}
const HISTORY_EARLIER = {
  defender:[['Security Scan','Passed'],['Policy Check','Passed']],
  sccm:[['Patch Updated','Completed'],['Policy Check','Passed']],
  kaspersky:[['Antivirus Updated','Completed'],['Policy Check','Passed']],
  trendmicro:[['Compliance Check','Passed'],['Policy Check','Passed']],
};
function buildEndpointHistory(){
  deriveAll();
  const out = [];
  endpoints.forEach(e=>{
    const h = hashStr(String(e.id));
    if((h>>>7)%5 !== 0) return;                    // small sample: roughly one endpoint in five
    const org = historyOrg(e);
    HISTORY_ORG_TOOLS[org].forEach((k,ti)=>{
      const base = validDate(e.lastSync && e.lastSync[k]); if(!base) return;
      const add = (ts, activity, status)=> out.push({ts, e, id:e.id, org, toolKey:k, tool:historyToolName(k), activity, status});
      const cur = historyLatest(k, e);
      add(base.getTime(), cur.activity, cur.status);
      const n = 1 + ((h>>>(3+ti))%2);
      for(let i=0;i<n;i++){
        const hours = 3 + ((h>>>(9+i*3))%20) + i*26;
        add(base.getTime() - hours*3600*1000, HISTORY_EARLIER[k][i][0], HISTORY_EARLIER[k][i][1]);
      }
    });
  });
  return out;
}
function historyStatusBadge(v){
  let cls = 'badge-amber', icon = 'warn';
  if(['Healthy','Passed','Compliant','Completed'].includes(v)){ cls='badge-green'; icon='check'; }
  else if(['Critical','Non-Compliant'].includes(v)){ cls='badge-red'; }
  else if(v==='Offline'){ cls='badge-slate'; icon='x'; }
  return `<span class="badge ${cls}">${ICONS[icon]}${v}</span>`;
}
let historySort = {key:'time', dir:'desc'}, historyPage = 1, historyRoleKey = null;
const HISTORY_PAGE_SIZE = 25;
const HISTORY_SORT_ACCESSORS = {time:r=>r.ts, endpoint:r=>r.id, status:r=>r.status};
function sortHistoryBy(key){
  if(historySort.key===key) historySort.dir = historySort.dir==='asc' ? 'desc' : 'asc';
  else historySort = {key, dir: key==='time' ? 'desc' : 'asc'};
  renderHistoryPage();
}
function changeHistoryPage(d){ historyPage += d; renderHistoryPage(); }
function clearHistoryFilters(){
  ['history-search','history-from','history-to','history-endpoint','history-location','history-tool','history-activity','history-status']
    .forEach(id=>{ document.getElementById(id).value = ''; });
  historyPage = 1; renderHistoryPage();
}
function historyYmd(ts){ const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function renderHistoryPage(){
  if(!document.getElementById('history-tbody')) return;
  if(historyRoleKey !== getSessionRole()){            // new login: start from a clean view (no filters carried over)
    historyRoleKey = getSessionRole();
    ['history-search','history-from','history-to','history-endpoint','history-location','history-tool','history-activity','history-status']
      .forEach(id=>{ document.getElementById(id).value = ''; });
    historySort = {key:'time', dir:'desc'}; historyPage = 1;
  }
  const all = buildEndpointHistory().filter(r=>historyOrgAllowed(r.org) && canAccess(r.toolKey));
  const fill = (id, allLabel, opts, single)=>{
    const sel = document.getElementById(id), cur = sel.value;
    sel.innerHTML = (single ? '' : `<option value="">${allLabel}</option>`) + opts.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
    sel.value = opts.some(o=>o[0]===cur) ? cur : (single && opts.length ? opts[0][0] : '');
  };
  const uniq = f=>[...new Set(all.map(f))].sort();
  const locs = ['FGV','FELDA'].filter(historyOrgAllowed);
  fill('history-endpoint', 'Endpoint: all', uniq(r=>r.id).map(v=>[v,v]));
  fill('history-location', 'Location: all', locs.map(v=>[v,v]), locs.length===1);
  fill('history-tool', 'Security tool: all', Object.keys(securityTools.reduce((m,t)=>(m[t.key]=1,m),{})).filter(canAccess).map(k=>[k,historyToolName(k)]));
  fill('history-activity', 'Activity: all', uniq(r=>r.activity).map(v=>[v,v]));
  fill('history-status', 'Status: all', uniq(r=>r.status).map(v=>[v,v]));

  // summary (role-visible records)
  const eps = new Map(); all.forEach(r=>eps.set(r.id, r.e));
  const ref = validDate(dataAsOf());
  const dayOf = d=>new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let today = 0, recent = 0, stale = 0, offline = 0;
  eps.forEach(e=>{
    const d = validDate(e.lastSeen);
    if(d && ref){
      if(dayOf(d)===dayOf(ref)) today++;
      if(ref.getTime()-d.getTime() <= 7*24*3600*1000) recent++; else stale++;
    }
    if(computeOverall(e)==='Offline') offline++;
  });
  const threats = all.filter(r=>/^Threat/.test(r.activity)).length;
  const card = (l,v,sub)=>`<div class="kpi-card static"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${sub}</div></div>`;
  document.getElementById('history-kpis').innerHTML =
    card('Total Activities', all.length, 'Sample records you can access') +
    card('Endpoints Seen Today', today, 'Latest check-in on the data date') +
    card('Recently Seen', recent, 'Seen within 7 days') +
    card('Not Seen Recently', stale, 'More than 7 days') +
    card('Offline Endpoints', offline, 'Endpoint status: Offline') +
    card('Security Events', threats, 'Threat activity');

  // filters (all combine)
  const q = (document.getElementById('history-search').value||'').trim().toLowerCase();
  const from = document.getElementById('history-from').value, to = document.getElementById('history-to').value;
  const fEp = document.getElementById('history-endpoint').value, fLoc = document.getElementById('history-location').value,
        fTool = document.getElementById('history-tool').value, fAct = document.getElementById('history-activity').value,
        fSt = document.getElementById('history-status').value;
  const rows = all.filter(r=>{
    if(q && !(r.id.toLowerCase().includes(q) || r.tool.toLowerCase().includes(q) || r.activity.toLowerCase().includes(q))) return false;
    const ymd = historyYmd(r.ts);
    if(from && ymd < from) return false;
    if(to && ymd > to) return false;
    if(fEp && r.id!==fEp) return false;
    if(fLoc && r.org!==fLoc) return false;
    if(fTool && r.toolKey!==fTool) return false;
    if(fAct && r.activity!==fAct) return false;
    if(fSt && r.status!==fSt) return false;
    return true;
  });
  const sorted = sortRows(rows, historySort, HISTORY_SORT_ACCESSORS);
  const pages = Math.max(1, Math.ceil(sorted.length / HISTORY_PAGE_SIZE));
  historyPage = Math.min(Math.max(1, historyPage), pages);
  const start = (historyPage-1)*HISTORY_PAGE_SIZE;
  const page = sorted.slice(start, start+HISTORY_PAGE_SIZE);
  document.getElementById('history-tbody').innerHTML = page.length ? page.map(r=>`
    <tr>
      <td>${fmtDateTime(new Date(r.ts))}</td>
      <td><span class="link-cell" onclick="openEndpointDetail('${esc(r.id)}')">${esc(r.id)}</span></td>
      <td>${r.org}</td><td>${esc(r.tool)}</td><td>${esc(r.activity)}</td>
      <td>${historyStatusBadge(r.status)}</td>
    </tr>`).join('')
    : `<tr><td colspan="6"><div class="empty-state">${ICONS.search}<div class="e1">No history records match your filters</div><div>Try clearing filters or search terms.</div></div></td></tr>`;
  document.getElementById('history-count').textContent =
    `Showing ${sorted.length ? start+1 : 0}\u2013${Math.min(start+HISTORY_PAGE_SIZE, sorted.length)} of ${sorted.length} activities (${all.length} available)`;
  document.getElementById('history-page-indicator').textContent = `Page ${historyPage} of ${pages}`;
  document.getElementById('history-prev').disabled = historyPage<=1;
  document.getElementById('history-next').disabled = historyPage>=pages;
  document.querySelectorAll('#page-history thead th[data-sort]').forEach(th=>{
    th.classList.toggle('sorted-asc', historySort.key===th.dataset.sort && historySort.dir==='asc');
    th.classList.toggle('sorted-desc', historySort.key===th.dataset.sort && historySort.dir==='desc');
  });
}

