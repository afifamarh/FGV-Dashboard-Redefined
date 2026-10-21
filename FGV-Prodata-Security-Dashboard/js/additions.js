/* =====================================================================
   22. REQUIREMENT ADDITIONS (prototype) — Kaspersky page, Trend Micro /
   CRAM page, Audit Trail, Excel/PDF export, SCCM extras.
   ALL DATA BELOW IS FICTIONAL SAMPLE DATA (DEMO- names, CVE-2099-* IDs,
   generic locations). Nothing here is real FGV/FELDA data.
===================================================================== */
function sessionUser(){ try{ const r = localStorage.getItem('fgv_session')||sessionStorage.getItem('fgv_session'); return (r&&JSON.parse(r).username)||'admin'; }catch(e){ return 'admin'; } }
ROLE_PERMISSIONS.admin.audit = true; ROLE_PERMISSIONS.fgv.audit = false; ROLE_PERMISSIONS.felda.audit = false;
NAV_ITEMS.splice(NAV_ITEMS.findIndex(n=>n.key==='sccm')+1, 0,
  {key:'kaspersky', label:'Kaspersky XDR', icon:'shieldCheck', tool:'kaspersky'},
  {key:'trendmicro', label:'Trend Micro / CRAM', icon:'radar', tool:'trendmicro'});
NAV_ITEMS.splice(NAV_ITEMS.findIndex(n=>n.key==='reports')+1, 0, {key:'audit', label:'Audit Trail', icon:'file', tool:'audit'});
PAGE_META.kaspersky = ['Kaspersky XDR','Asset distribution, HQ / Branch / Server classification and location (sample data)'];
PAGE_META.trendmicro = ['Trend Micro Vision One / CRAM','SOC monitoring and CRAM server vulnerabilities (sample data)'];
PAGE_META.audit = ['Audit Trail','Login, upload, override and export activity'];
const _goTo = goTo;
goTo = function(p,o){ if(p==='audit' && !canAccess('audit')){ showToast('This page is not available for your role','warn'); p='dashboard'; o=undefined; } _goTo(p,o); };
const _rcp = renderCurrentPage;
renderCurrentPage = function(){ _rcp(); if(currentPage==='kaspersky') renderKasPage(); if(currentPage==='trendmicro') renderTmPage(); if(currentPage==='audit') renderAuditPage(); };
const tagc = (t,c)=>`<span style="padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:600;color:var(--${c});background:var(--${c}-bg);">${esc(t)}</span>`;
const tblWrap = (head, rows, empty)=>`<div class="table-scroll"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${head.length}"><div class="empty-state"><div class="e1">${empty||'No records'}</div></div></td></tr>`}</tbody></table></div>`;
const selOpts = (arr,all)=>`<option value="">${all}</option>`+arr.map(v=>`<option>${esc(v)}</option>`).join('');

/* ---------- Audit Trail ---------- */
let auditLogs = readStore('fgv_audit_log', null);
if(!auditLogs){ auditLogs = [
  {timestamp:'2026-09-14T08:02:00', userId:'admin.demo', role:'IT Security Admin', action:'Login', detail:'Sample entry'},
  {timestamp:'2026-09-14T08:10:00', userId:'admin.demo', role:'IT Security Admin', action:'CSV Upload', detail:'Sample entry: demo-sccm-weekly.csv'},
  {timestamp:'2026-09-14T08:11:00', userId:'admin.demo', role:'IT Security Admin', action:'Data Override', detail:'Sample entry: SCCM dataset replaced'},
  {timestamp:'2026-09-14T08:25:00', userId:'admin.demo', role:'IT Security Admin', action:'Export (PDF)', detail:'Sample entry: Patch report'},
  {timestamp:'2026-09-14T08:40:00', userId:'admin.demo', role:'IT Security Admin', action:'Logout', detail:'Sample entry'}].reverse(); writeStore('fgv_audit_log', auditLogs); }
function auditLog(action, detail, user, role){
  auditLogs.unshift({timestamp:nowIso(), userId:user||sessionUser(), role:role||ROLE_LABELS[getSessionRole()], action, detail:detail||''});
  if(auditLogs.length>500) auditLogs.length = 500;
  writeStore('fgv_audit_log', auditLogs);
  if(typeof currentPage!=='undefined' && currentPage==='audit') renderAuditPage();
}
const _rih = recordImportHistory;
function auditActionFilterOpts(){ return [...new Set(auditLogs.map(l=>l.action))]; }
function auditRows(){
  const a = (document.getElementById('aud-action')||{}).value||'', q = ((document.getElementById('aud-q')||{}).value||'').toLowerCase();
  return auditLogs.filter(l=>(!a||l.action===a) && (!q||[l.userId,l.role,l.detail].some(v=>String(v).toLowerCase().includes(q))));
}
function renderAuditPage(){
  const root = document.getElementById('aud-root'); if(!root) return;
  const keep = {a:(document.getElementById('aud-action')||{}).value||'', q:(document.getElementById('aud-q')||{}).value||''};
  const rows = auditRows();
  root.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Activity log (${rows.length} of ${auditLogs.length})</h3><div class="panel-sub">Stored in this browser for the prototype; production would write to the local database</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><select class="filter-select" id="aud-action" onchange="renderAuditPage()">${selOpts(auditActionFilterOpts(),'All actions')}</select>
    <input class="filter-select" id="aud-q" placeholder="Search user / detail" value="${esc(keep.q)}" oninput="renderAuditPage()">
    </div><div class="btn-row"><button class="btn btn-secondary" onclick="exportAudit('csv')">CSV</button><button class="btn btn-secondary" onclick="exportAudit('xls')">Excel</button><button class="btn btn-secondary" onclick="exportAudit('pdf')">PDF</button></div></div>
    ${tblWrap(['Timestamp','User ID','Role','Action','Detail'], rows.slice(0,200).map(l=>`<tr><td>${esc(fmtDateTime(l.timestamp))}</td><td>${esc(l.userId)}</td><td>${esc(l.role)}</td><td>${tagc(l.action, /Failed/.test(l.action)?'red':/Override/.test(l.action)?'amber':/Login|Logout/.test(l.action)?'slate':'green')}</td><td>${esc(l.detail)}</td></tr>`),'No matching activity')}</div>`;
  document.getElementById('aud-action').value = keep.a;
  const q = document.getElementById('aud-q'); if(keep.q){ q.focus(); q.setSelectionRange(q.value.length,q.value.length); }
}
function exportAudit(kind){
  const rows = auditRows().map(l=>({Timestamp:l.timestamp,'User ID':l.userId,Role:l.role,Action:l.action,Detail:l.detail}));
  exportRows(kind,'Audit Trail',rows,'audit-trail');
}

/* ---------- Excel / PDF export (local, no libraries) ---------- */
function rowsToHtmlTable(rows){ const h = Object.keys(rows[0]||{}); return `<table border="1" cellspacing="0" cellpadding="4"><thead><tr>${h.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${h.map(k=>`<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
function exportRows(kind, title, rows, base){
  if(!rows.length){ showToast('Nothing to export','error'); return; }
  const stamp = `Exported ${fmtDateTime(new Date())} by ${sessionUser()} (sample data)`;
  const html = `<html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;font-size:12px}th{background:#eee}</style></head><body><h2>${esc(title)}</h2><p>${esc(stamp)}</p>${rowsToHtmlTable(rows)}<p>&copy; Copyright FGV Holdings Berhad / Network &amp; IT Security. All Rights Reserved.</p></body></html>`;
  const name = `fgv-prodata-${base}-${todayLocal()}`;
  if(kind==='csv') showToast('Report exported successfully.','ok'), downloadTextFile(name+'.csv', `# ${title}\r\n# ${stamp}\r\n`+arrayToCsv(rows), 'text/csv;charset=utf-8;');
  else if(kind==='xls'){ downloadTextFile(name+'.xls', html, 'application/vnd.ms-excel'); showToast('Report exported successfully.','ok'); }
  else { const fr = document.createElement('iframe'); fr.style.cssText='position:fixed;width:0;height:0;border:0;'; document.body.appendChild(fr);
    fr.srcdoc = html.replace('</body>','<script>window.onload=function(){window.print();}<\/script></body>'); setTimeout(()=>fr.remove(),60000); showToast('Use "Save as PDF" in the print dialog','ok'); }
  auditLog('Export ('+kind.toUpperCase()+')', title+' — '+rows.length+' rows');
}
function exportReportXls(k){ if(!reportAllowed(k)) return showToast('This report is not available for your role','error'); exportRows('xls', REPORTS.find(x=>x.key===k).title, reportRows(k), k+'-report'); }
function exportReportPdf(k){ if(!reportAllowed(k)) return showToast('This report is not available for your role','error'); exportRows('pdf', REPORTS.find(x=>x.key===k).title, reportRows(k), k+'-report'); }
const _er = exportReport;
exportReport = function(k){ _er(k); if(reportAllowed(k)) auditLog('Export (CSV)', 'Report: '+k); };

/* ---------- Kaspersky (sample dataset) ---------- */
const KAS_LOCS = [LOC_HQ, LOC_BRANCH];
/* 1,200 deterministic sample assets. No Math.random(): every value derives from the index, so DEMO-KAS-0001 is identical on every load.
   The first 36 rows follow the agreed pattern table (OS / location / department); later rows repeat that pattern with a
   deterministic department shift. IP: 10.{10|20|30}.{block}.{101-104} is unique per asset. Location is only Wisma FGV HQ or Branch. */
const KAS_DEPTS = ['IT Security','Network Operations','IT Infrastructure','Finance','Human Resources','Administration','Operations','Procurement'];
const KAS_OS = ['Windows 11','Windows 10','Windows Server 2022','Windows Server 2019'];
const KAS_PATTERN = [[0,1,0],[2,1,1],[3,1,2],[0,1,3],[1,0,5],[0,0,3],[1,0,4],[0,0,6],[2,1,2],[0,0,6],[1,0,3],[3,1,1],
  [0,1,0],[1,1,4],[2,1,1],[0,1,7],[1,0,5],[0,0,3],[1,0,6],[0,0,4],[3,1,2],[0,0,3],[1,0,5],[0,1,0],
  [2,1,1],[0,1,3],[1,0,6],[0,0,5],[1,0,4],[0,0,3],[3,1,2],[0,0,7],[1,0,6],[0,1,0],[2,1,1],[1,0,5]];   // [os index, 1 = Wisma FGV HQ / 0 = Branch, department index]
// Real-data-only mode: no generated Kaspersky assets.
 // Populate this array only from a verified Kaspersky import.
let kasData = [];
let kasSort = {key:'id',dir:1};
const kasTone = s=>({Protected:'green','At Risk':'red',Offline:'slate','Updates Pending':'amber'}[s]);
function renderKasPage(){
  const r = document.getElementById('kas-root'); if(!r) return;
  const n = f=>kasData.filter(f).length, N = kasData.length;
  const bars = ['HQ','Branch','Server'].map(c=>sccmBarRow(c, n(e=>e.cls===c), N, 'var(--blue)', 'all').replace(/onclick="[^"]*"/,''));
  r.innerHTML = `<div class="def-kpis">${kpiBtn('Total Kaspersky Assets',N,'Sample FELDA assets',"kasKpiModal('all')")}${['HQ','Branch','Server'].map(c=>kpiBtn(c,n(e=>e.cls===c),pct(n(e=>e.cls===c),N)+'% of assets',`kasKpiModal('${c}')`)).join('')}${kasKpiPrefs.atRisk ? kpiBtn('At Risk',n(e=>e.status==='At Risk'),'Needs attention',"kasKpiModal('At Risk')") : ''}${kasKpiPrefs.offline ? kpiBtn('Offline',n(e=>e.status==='Offline'),'Not reporting',"kasKpiModal('Offline')") : ''}</div>
  <div class="grid-2" style="margin-bottom:18px;"><div class="panel"><div class="panel-head"><div><h3>Asset distribution by classification</h3></div></div>${bars.join('')}</div>
  <div class="panel"><div class="panel-head"><div><h3>Distribution by location</h3><div class="panel-sub">Click a bar to filter the table</div></div></div>${KAS_LOCS.map(l=>sccmBarRow(l,n(e=>e.loc===l),N,'var(--green)','all').replace(/onclick="[^"]*"/,`onclick="kasLocModal('${l}')"`)).join('')}</div></div>
  <div class="panel"><div class="panel-head"><div><h3>Kaspersky endpoints</h3><div class="panel-sub" id="kas-count"></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;">
  <select class="filter-select" id="kas-cls" onchange="kasTable()">${selOpts(['HQ','Branch','Server'],'All classifications')}</select><select class="filter-select" id="kas-loc" onchange="kasTable()">${selOpts(KAS_LOCS,'All locations')}</select>
  <select class="filter-select" id="kas-st" onchange="kasTable()">${selOpts(['Protected','At Risk','Offline','Updates Pending'],'All statuses')}</select><input class="filter-select" id="kas-q" placeholder="Search asset, IP, OS, department" oninput="kasTable()"></div></div><div id="kas-table"></div></div>`;
  kasTable();
}
function kasSortBy(k){ kasSort = {key:k, dir: kasSort.key===k ? -kasSort.dir : 1}; kasTable(); }
let kasPage = 0, kasSig = '';
function kasGo(p){ kasPage = p; kasTable(); }
function kasTable(){
  const c=document.getElementById('kas-cls').value, l=document.getElementById('kas-loc').value, q=document.getElementById('kas-q').value.toLowerCase().trim(), st=document.getElementById('kas-st').value;
  const sig=[c,l,st,q,kasSort.key,kasSort.dir].join('|'); if(sig!==kasSig){ kasSig=sig; kasPage=0; }   // any filter/sort change returns to page 1
  const rows = kasData.filter(e=>(!c||e.cls===c)&&(!l||e.loc===l)&&(!st||e.status===st)&&(!q||[e.id,e.ip,e.os,e.department,e.company,e.loc].some(v=>String(v).toLowerCase().includes(q)))).sort((a,b)=>String(a[kasSort.key]).localeCompare(String(b[kasSort.key]))*kasSort.dir);
  const PER=25, pages=Math.max(1,Math.ceil(rows.length/PER)); if(kasPage>=pages) kasPage=pages-1;
  document.getElementById('kas-count').textContent = `${rows.length} of ${kasData.length} imported assets \u2014 click a header to sort`;
  const hd = [['id','Asset'],['cls','Class'],['loc','Location'],['status','Status'],['threats','Threats'],['lastScan','Last Scan']].map(([k,t])=>`<span style="cursor:pointer" onclick="kasSortBy('${k}')">${t}${kasSort.key===k?(kasSort.dir>0?' \u25B2':' \u25BC'):''}</span>`);
  const pager = rows.length>PER ? `<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;margin-top:10px;"><span class="form-hint">Showing ${kasPage*PER+1}\u2013${Math.min(rows.length,(kasPage+1)*PER)} of ${rows.length} \u00B7 page ${kasPage+1} of ${pages}</span><button class="btn btn-secondary btn-sm" ${kasPage?'':'disabled'} onclick="kasGo(${kasPage-1})">Previous</button><button class="btn btn-secondary btn-sm" ${kasPage<pages-1?'':'disabled'} onclick="kasGo(${kasPage+1})">Next</button></div>` : '';
  document.getElementById('kas-table').innerHTML = tblWrap(hd, rows.slice(kasPage*PER,(kasPage+1)*PER).map(e=>`<tr style="cursor:pointer" onclick="kasDetail('${e.id}')"><td>${e.id}</td><td>${e.cls}</td><td>${e.loc}</td><td>${tagc(e.status,kasTone(e.status))}</td><td>${e.threats}</td><td>${e.lastScan}</td></tr>`), 'No matching assets') + pager;
}
function kasKpiModal(k){ const rows = k==='all' ? kasData : kasData.filter(e=>e.cls===k||e.status===k), title = k==='all' ? 'Total Kaspersky Assets' : k==='At Risk'||k==='Offline' ? k+' assets' : k+' assets';
  openModal({title:`${title} (${rows.length})`, wide:true, body:`<div style="max-height:400px;overflow-y:auto;">${tblWrap(['Asset ID','IP Address','OS','Location','Company','Department'],rows.map(e=>`<tr style="cursor:pointer" onclick="kasDetail('${e.id}')"><td>${e.id}</td><td>${e.ip}</td><td>${e.os}</td><td>${e.loc}</td><td>${e.company}</td><td>${e.department}</td></tr>`),'No assets')}</div><div class="form-hint" style="margin-top:10px;">Click an asset for its details. Fictional sample records.</div>`, footer:'<button class="btn btn-secondary" onclick="closeModal()">Close</button>'}); }
function kasLocModal(l){ const rows = kasData.filter(e=>e.loc===l);
  openModal({title:`${l} assets (${rows.length})`, wide:true, body:`<div style="max-height:400px;overflow-y:auto;">${tblWrap(['Asset ID','IP Address','OS','Location','Company','Department'],rows.map(e=>`<tr style="cursor:pointer" onclick="kasDetail('${e.id}')"><td>${e.id}</td><td>${e.ip}</td><td>${e.os}</td><td>${e.loc}</td><td>${e.company}</td><td>${e.department}</td></tr>`),'No assets')}</div><div class="form-hint" style="margin-top:10px;">Click an asset for its details. Fictional sample records.</div>`, footer:'<button class="btn btn-secondary" onclick="closeModal()">Close</button>'}); }
function kasDetail(id){ const e = kasData.find(x=>x.id===id); if(!e) return;
  openModal({title:e.id, body:[['Asset ID',e.id],['IP Address',e.ip],['OS',e.os],['Location',e.loc],['Company',e.company],['Department',e.department]].map(([k,v])=>`<div class="detail-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')+'<div class="form-hint" style="margin-top:10px;">Fictional sample record.</div>', footer:'<button class="btn btn-secondary" onclick="closeModal()">Close</button>'}); }

/* ---------- Trend Micro Vision One / CRAM (sample dataset) ---------- */
// Real-data-only mode: no generated servers or placeholder CVE identifiers.
 // Populate these arrays only from verified Trend Micro Vision One / CRAM imports.
let TM_CVES = [];
let tmServers = [];
const tmTone = r=>({Critical:'red',High:'amber',Medium:'slate',Low:'green'}[r]);
function renderTmPage(){
  const r = document.getElementById('tm-root'); if(!r) return;
  const n = f=>tmServers.filter(f).length, act = socTickets.filter(t=>t.status!=='Closed'), trend = act.filter(t=>t.tool==='Trend Micro Vision One');
  r.innerHTML = `<div class="def-kpis">${sccmKpiCard('SOC Monitoring','24/7','Sample status: Operational','')}${sccmKpiCard('Active SOC Tickets',act.length,trend.length+' from Vision One (sample)','')}${sccmKpiCard('CRAM Servers',tmServers.length,'180-server reference scope (sample records)','')}${sccmKpiCard('Critical Risk',n(s=>s.risk==='Critical'),'Servers','')}${sccmKpiCard('High Risk',n(s=>s.risk==='High'),'Servers','')}${sccmKpiCard('No Patch Available',n(s=>!s.fix),'Servers with a sample open CVE','')}</div>
  <div class="grid-2" style="margin-bottom:18px;"><div class="panel"><div class="panel-head"><div><h3>24/7 SOC alerts</h3><div class="panel-sub">Active tickets (sample)</div></div></div>${tblWrap(['ID','Alert','Priority','Status'],act.slice(0,8).map(t=>`<tr><td>${t.id}</td><td class="cell-wrap">${esc(t.title)}</td><td>${t.priority}</td><td>${t.status}</td></tr>`))}</div>
  <div class="panel"><div class="panel-head"><div><h3>Top sample CVEs</h3><div class="panel-sub">Placeholder IDs (CVE-2099-*), not real vulnerabilities</div></div></div>${tblWrap(['CVE','CVSS','Description','Servers'],TM_CVES.map(c=>`<tr><td>${c.id}</td><td>${c.cvss}</td><td>${c.name}</td><td>${tmServers.filter(s=>s.top.id===c.id).length}</td></tr>`))}</div></div>
  <div class="panel"><div class="panel-head"><div><h3>CRAM server vulnerability information</h3><div class="panel-sub" id="tm-count"></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><select class="filter-select" id="tm-risk" onchange="tmTable()">${selOpts(['Critical','High','Medium','Low'],'All risk levels')}</select><input class="filter-select" id="tm-q" placeholder="Search server / CVE" oninput="tmTable()"></div></div><div id="tm-table"></div></div>`;
  tmTable();
}
function tmTable(){
  const k=document.getElementById('tm-risk').value, q=document.getElementById('tm-q').value.toLowerCase(), o={Critical:0,High:1,Medium:2,Low:3};
  const rows = tmServers.filter(s=>(!k||s.risk===k)&&(!q||s.id.toLowerCase().includes(q)||s.top.id.toLowerCase().includes(q))).sort((a,b)=>o[a.risk]-o[b.risk]||a.id.localeCompare(b.id));
  document.getElementById('tm-count').textContent = `${rows.length} of ${tmServers.length} imported servers (showing first 40, highest risk first)`;
  document.getElementById('tm-table').innerHTML = tblWrap(['Server','OS','Risk','Open CVEs','Top CVE','CVSS','Fix available'], rows.slice(0,40).map(s=>`<tr style="cursor:pointer" onclick="tmServerDetail('${s.id}')"><td>${s.id}</td><td>${s.os}</td><td>${tagc(s.risk,tmTone(s.risk))}</td><td>${s.cves}</td><td>${s.top.id}</td><td>${s.top.cvss}</td><td>${s.fix?'Yes':'No'}</td></tr>`),'No matching servers');
}

/* ---------- SCCM extras: Pending Reboot, Hostname Mismatch, Deployment Success ---------- */
SCCM_LISTS.pendingReboot = {title:'Pending reboot assets', test:e=>!!(e.ext&&e.ext.pendingReboot)};
const isHostMismatch = e=>hashStr(e.id+'-hm')%11===0;
const DEMO_DEPLOYS = [['DEMO Monthly Security Updates — Sep',120,108,6,6],['DEMO Critical Hotfix Wave 1',60,57,2,1],['DEMO Servers Cumulative Update',40,33,5,2],['DEMO Office Apps Update',80,74,4,2],['DEMO Driver Baseline',30,24,4,2]].map(([name,t,s,f,p])=>({name,t,s,f,p}));
const deploySuccess = ()=>{ const t=DEMO_DEPLOYS.reduce((a,d)=>a+d.t,0), s=DEMO_DEPLOYS.reduce((a,d)=>a+d.s,0); return pct(s,t); };
function openDeployList(){ openModal({title:'Deployment success (sample deployments)', wide:true, body:tblWrap(['Deployment','Targeted','Succeeded','Failed','In progress','Success %'],DEMO_DEPLOYS.map(d=>`<tr><td>${d.name}</td><td>${d.t}</td><td>${d.s}</td><td>${d.f}</td><td>${d.p}</td><td>${pct(d.s,d.t)}%</td></tr>`))+'<div class="form-hint" style="margin-top:10px;">Fictional sample deployments.</div>', footer:'<button class="btn btn-secondary" onclick="closeModal()">Close</button>'}); }
function openHostMismatch(){ const rows = endpoints.filter(isHostMismatch);
  openModal({title:`Hostname mismatch (${rows.length} sample assets)`, wide:true, body:tblWrap(['Asset (SCCM name)','Defender / directory name','IP','SCCM state'],rows.map(e=>`<tr><td>${esc(e.id)}</td><td>${esc(e.id)}-SAMPLE-RENAMED</td><td>${esc((e.ext&&e.ext.ip)||'')}</td><td>${esc(e.sccmState||'')}</td></tr>`),'No mismatches')+'<div class="form-hint" style="margin-top:10px;">Sample rule for the prototype: names that differ between tools are flagged.</div>', footer:'<button class="btn btn-secondary" onclick="closeModal()">Close</button>'}); }
const _rsp = renderSccmPage;
renderSccmPage = function(){ _rsp(); const k = document.getElementById('sccm-kpis'); if(!k) return;
  const add = h=>k.insertAdjacentHTML('beforeend', h);
  if(sccmKpiPrefs.pendingReboot) add(sccmKpiCard('Pending Reboot', endpoints.filter(SCCM_LISTS.pendingReboot.test).length, 'Patched, awaiting restart', 'pendingReboot'));
  if(sccmKpiPrefs.deploymentSuccess) add(`<div onclick="" style="display:contents">`+sccmKpiCard('Deployment Success Rate', deploySuccess()+'%', 'Sample deployments — click for detail', '').replace('class="kpi-card static"',`class="kpi-card" role="button" tabindex="0" onclick="openDeployList()"`)+`</div>`);
  if(sccmKpiPrefs.hostnameMismatch) add(sccmKpiCard('Hostname Mismatch', endpoints.filter(isHostMismatch).length, 'Name differs between tools', '').replace('class="kpi-card static"',`class="kpi-card" role="button" tabindex="0" onclick="openHostMismatch()"`)); };



/* ---------- General Data Import -> security-page extraction ----------
   Reads records saved by General Data Import from the existing Flask/MySQL API.
   This adapter is deliberately header-driven: it only maps fields that are
   present in the imported records and never creates placeholder assets/CVEs.
*/
let _generalToolDataLoaded = false;
let _generalToolDataLoading = false;
const _gNorm = value => String(value == null ? '' : value).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g,'').replace(/[^a-z0-9]/g,'');
function _gField(row, aliases){
  const entries = Object.entries(row || {});
  for(const alias of aliases){
    const target = _gNorm(alias);
    const found = entries.find(([key,value]) => _gNorm(key)===target && value!==null && String(value).trim()!=='');
    if(found) return String(found[1]).trim();
  }
  return '';
}
function _gNumber(value){ const m=String(value==null?'':value).match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; }
function _gRisk(value){
  const v=String(value||'').toLowerCase();
  if(v.includes('critical')) return 'Critical';
  if(v.includes('high') || v.includes('severe')) return 'High';
  if(v.includes('medium') || v.includes('moderate')) return 'Medium';
  if(v.includes('low') || v.includes('info')) return 'Low';
  return '';
}
function _gKasStatus(value){
  const v=String(value||'').toLowerCase();
  if(/offline|inactive|not reporting|disconnected/.test(v)) return 'Offline';
  if(/at risk|critical|infected|threat|non.?compliant|high risk|detected/.test(v)) return 'At Risk';
  if(/update pending|pending update/.test(v)) return 'Updates Pending';
  if(/protect|secure|normal|ok|healthy|clean|compliant/.test(v)) return 'Protected';
  return '';
}
function _gLocation(value){
  const v=String(value||'').trim();
  if(!v) return '';
  if(/wisma.*fgv|\bhq\b|head.?office|headquarters/i.test(v)) return 'Wisma FGV HQ';
  if(/branch/i.test(v)) return 'Branch';
  return v;
}
function _mapGeneralRowsToTools(batches){
  const all=[];
  // Keep the newest batch per source file name; multiple different imports remain available.
  const seenBatch=new Set();
  (batches||[]).forEach(batch=>{
    if(String(batch.module_key||'')!=='general') return;
    const fileKey=String(batch.file_name||batch.id);
    if(seenBatch.has(fileKey)) return;
    seenBatch.add(fileKey);
    (batch.records||[]).forEach(item=>{ if(item && item.data && typeof item.data==='object') all.push({row:item.data,batch}); });
  });
  const kasById=new Map(), tmById=new Map(), cveById=new Map();
  all.forEach(({row,batch})=>{
    const id=_gField(row,['hostname','host name','computer name','device name','asset name','asset id','endpoint','server name','server','machine name','name']);
    const ip=_gField(row,['ip address','ip','ipv4 address']);
    const os=_gField(row,['operating system','os name','os','platform']);
    const statusRaw=_gField(row,['protection status','kaspersky status','security status','device status','status','health status','protection state']);
    const kasStatus=_gKasStatus(statusRaw);
    // General Data Import stores the hierarchy in `Full group name`.
    // Example: Managed devices/Menara/Felda/Tingkat 02/Tingkat 2 - Tadika
    // Desired display: Location=Menara, Company=Felda,
    // Department=Tingkat 02 / Tingkat 2 - Tadika.
    const fullGroup=_gField(row,['full group name','fullgroupname','group name','group path']);
    const groupParts=String(fullGroup||'').split('/').map(part=>part.trim()).filter(Boolean);
    if(groupParts.length && /^managed devices$/i.test(groupParts[0])) groupParts.shift();
    const explicitLoc=_gField(row,['location','site','office','branch','office location']);
    const loc=_gLocation(explicitLoc || groupParts[0] || '');
    const company=_gField(row,['company','organisation','organization','entity','business unit']) || (groupParts[1]||'');
    const explicitDept=_gField(row,['department','team','business function']);
    const dept=groupParts.length>2 ? groupParts.slice(2).join(' / ') : explicitDept;
    const threatRaw=_gField(row,['threats','threat count','detected threats','active threats']);
    const lastScan=_gField(row,['last scan','last scanned','last scan time','last seen','last update']);
    const hasKasSignals=!!(kasStatus || ip || os || loc || company || dept || threatRaw || lastScan);
    if(id && hasKasSignals){
      const classification=/server/i.test(os+' '+_gField(row,['device type','asset type','type']))?'Server':(/wisma.*fgv|\bhq\b|head.?office/i.test(loc)?'HQ':'Branch');
      kasById.set(id.toUpperCase(),{
        id, ip, os:os||'Not provided', loc:loc||'Not provided', cls:classification,
        status:kasStatus||'Unknown', threats:_gNumber(threatRaw) ?? 0,
        lastScan:lastScan||'Not provided', company:company||'Not provided', department:dept||'Not provided'
      });
    }

    const riskRaw=_gField(row,['risk level','risk','severity','risk rating','server risk']);
    const risk=_gRisk(riskRaw);
    const cveId=_gField(row,['cve id','cve','vulnerability id','vulnerability']);
    const cvssRaw=_gField(row,['cvss score','cvss','cvss v3 score','score']);
    const description=_gField(row,['description','vulnerability description','cve description','finding','issue','title']);
    const fixRaw=_gField(row,['fix available','patch available','remediation available','fix status','patch status']);
    const hasTmSignals=!!(risk || cveId || cvssRaw || /trend micro|vision one|cram/i.test(String(batch.file_name||'')));
    if(id && hasTmSignals){
      const cvss=_gNumber(cvssRaw);
      const fix=/^(yes|true|1|available|fixed|ready)$/i.test(fixRaw);
      const normalizedRisk=risk|| (cvss!==null ? _gRisk(cvss>=9?'Critical':cvss>=7?'High':'Medium') : 'Low');
      const old=tmById.get(id.toUpperCase())||{id,os:os||'Not provided',risk:normalizedRisk,cves:0,top:{id:'',cvss:0,name:'No CVE details provided'},fix:false};
      if(risk) old.risk=risk;
      if(cveId){
        const score=cvss===null?0:cvss;
        old.cves+=1;
        if(!old.top.id || score>old.top.cvss) old.top={id:cveId,cvss:score,name:description||'Description not provided'};
        if(!cveById.has(cveId)) cveById.set(cveId,{id:cveId,cvss:score,name:description||'Description not provided'});
      }
      old.fix=old.fix||fix;
      tmById.set(id.toUpperCase(),old);
    }
  });
  kasData=Array.from(kasById.values());
  tmServers=Array.from(tmById.values());
  TM_CVES=Array.from(cveById.values()).sort((a,b)=>b.cvss-a.cvss);
}
async function loadGeneralToolData(force){
  if(_generalToolDataLoading || (_generalToolDataLoaded && !force)) return;
  _generalToolDataLoading=true;
  try{
    const response=await fetch('http://127.0.0.1:5000/api/import-batches?module_key=general');
    if(!response.ok) throw new Error('Import API returned HTTP '+response.status);
    const result=await response.json();
    if(!result.success || !Array.isArray(result.batches)) throw new Error(result.message||'Invalid import API response');
    _mapGeneralRowsToTools(result.batches);
    _generalToolDataLoaded=true;
    if(typeof currentPage!=='undefined' && currentPage==='kaspersky') renderKasPage();
    if(typeof currentPage!=='undefined' && currentPage==='trendmicro') renderTmPage();
  }catch(err){
    console.error('Could not extract General Data Import into security pages:',err);
    if(typeof showToast==='function') showToast('Could not read imported data from MySQL. Check Flask/API and imported column names.','error');
  }finally{ _generalToolDataLoading=false; }
}
const _kasRenderWithGeneralData=renderKasPage;
renderKasPage=function(){
  _kasRenderWithGeneralData();
  if(!_generalToolDataLoaded) loadGeneralToolData(false);
};
const _tmRenderWithGeneralData=renderTmPage;
renderTmPage=function(){
  _tmRenderWithGeneralData();
  if(!_generalToolDataLoaded) loadGeneralToolData(false);
};
