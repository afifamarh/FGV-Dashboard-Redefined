/* =====================================================================
   23. REFINEMENTS — Trend Micro interactions, import management
   (Delete Imported Data / Delete History / Restore Previous). Sample data only.
===================================================================== */
const kpiBtn = (l,v,s,fn)=>`<div class="kpi-card" role="button" tabindex="0" onclick="${fn}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${fn}}"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${s}</div></div>`;
const closeFoot = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';
const tmCveRisk = c=>c>=9?'Critical':c>=7?'High':'Medium';
const tmSrvList = sv=>sv.slice(0,3).map(s=>s.id).join(', ')+(sv.length>3?` +${sv.length-3} more`:'');
const TM_ASSETS = ['Web service','Database engine','Remote access service','File sharing service','Backup agent','Mail gateway','Management console','Runtime library'];
const TM_TEAMS = ['SOC Tier 1','SOC Tier 2','Network Security','Endpoint Security'];
const tmNum = s=>parseInt(String(s.id).slice(-3),10);
const tmAsset = (s,c)=>TM_ASSETS[TM_CVES.indexOf(c||s.top)%8];
const tmVer = s=>{ const n=tmNum(s), b=`${2+n%3}.${n%10}.`; return [b+(n%7), b+(n%7+1)]; };
const tmFixStatus = s=>['Ready to deploy','Scheduled','Pending approval'][tmNum(s)%3];
function tmServersModal(){
  openModal({title:`CRAM servers (${tmServers.length})`, wide:true, body:`<div style="max-height:380px;overflow-y:auto;">${tblWrap(['Server','OS','Risk','Open CVEs','Top CVE','CVSS','Fix available'],[...tmServers].sort((a,b)=>({Critical:0,High:1,Medium:2,Low:3}[a.risk]-{Critical:0,High:1,Medium:2,Low:3}[b.risk])||a.id.localeCompare(b.id)).map(s=>`<tr style="cursor:pointer" onclick="tmServerDetail('${s.id}')"><td>${s.id}</td><td>${s.os}</td><td>${tagc(s.risk,tmTone(s.risk))}</td><td>${s.cves}</td><td>${s.top.id}</td><td>${s.top.cvss}</td><td>${s.fix?'Yes':'No'}</td></tr>`))}</div><div class="form-hint" style="margin-top:10px;">Click a server for details. Fictional sample records (read-only).</div>`, footer:closeFoot}); }
function tmServerDetail(id){ const s = tmServers.find(x=>x.id===id); if(!s) return;
  openModal({title:s.id, body:[['Operating system',s.os],['Risk',s.risk],['Open CVEs (sample)',s.cves],['Top CVE',s.top.id],['CVSS',s.top.cvss],['Description',s.top.name],['Affected asset',tmAsset(s)],['Remediation',s.fix?'Fix available — '+tmFixStatus(s)+' (v'+tmVer(s)[0]+' → v'+tmVer(s)[1]+')':'No fix available yet']].map(([k,v])=>`<div class="detail-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')+'<div class="form-hint" style="margin-top:10px;">Fictional sample record (read-only).</div>', footer:closeFoot}); }
function tmFilterRisk(r){ document.getElementById('tm-risk').value=r; document.getElementById('tm-q').value=''; tmTable(); document.getElementById('tm-table').scrollIntoView({behavior:'smooth'}); showToast('Showing '+tmServers.filter(s=>s.risk===r).length+' '+r+' risk servers','ok'); }
function tmTicketsModal(){ const act = []; // No SOC tickets are shown until real SOC records are mapped from an import.
  openModal({title:`Active SOC tickets (${act.length})`, wide:true, body:`<div style="max-height:380px;overflow-y:auto;">${tblWrap(['Ticket ID','Severity','Status','Affected Asset','Issue','Created','Assigned Team'],act.map((t,i)=>{ const m=(t.title.match(/\b(?:FGV-PC-\d+|DEMO-[A-Z]+-\d+)\b/)||[])[0]; return `<tr><td>${t.id}</td><td>${t.priority}</td><td>${t.status}</td><td>${m||tmServers[(i*17)%tmServers.length].id}</td><td class="cell-wrap">${esc(t.title)}</td><td>${t.opened}</td><td>${TM_TEAMS[i%TM_TEAMS.length]}</td></tr>`; }))}</div><div class="form-hint" style="margin-top:10px;">Source tools: ${[...new Set(act.map(t=>t.tool))].map(esc).join(', ')}. Sample tickets (read-only).</div>`, footer:closeFoot}); }
function tmCveRowsHtml(id){
  const rows = tmServers.filter(s=>!id||s.top.id===id).sort((a,b)=>b.top.cvss-a.top.cvss||a.id.localeCompare(b.id));
  return `<div class="form-hint" style="margin-bottom:8px;">${rows.length} affected servers</div><div style="max-height:340px;overflow-y:auto;">${tblWrap(['CVE ID','Severity','Risk Level','Affected Asset','Server','Description','Fix / Remediation'],rows.map(s=>`<tr style="cursor:pointer" onclick="tmServerDetail('${s.id}')"><td>${s.top.id}</td><td>${tagc(tmCveRisk(s.top.cvss),tmTone(tmCveRisk(s.top.cvss)))} ${s.top.cvss}</td><td>${tagc(s.risk,tmTone(s.risk))}</td><td>${tmAsset(s)}</td><td>${s.id}</td><td class="cell-wrap">${s.top.name}</td><td>${s.fix?'Fix available \u2014 '+tmFixStatus(s):'No fix available yet'}</td></tr>`))}</div>`; }
function tmCveFilterModal(v){ document.getElementById('tm-cve-body').innerHTML = tmCveRowsHtml(v); }
function tmCveModal(){
  openModal({title:`Open CVEs (${tmServers.reduce((a,s)=>a+s.cves,0)} across ${tmServers.length} sample servers)`, wide:true, body:`<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;"><select class="filter-select" id="tm-cve-sel" onchange="tmCveFilterModal(this.value)"><option value="">All CVEs</option>${TM_CVES.map(c=>`<option value="${c.id}">${c.id} (CVSS ${c.cvss})</option>`).join('')}</select><button class="btn btn-secondary btn-sm" onclick="tmFilterCve(document.getElementById('tm-cve-sel').value)">Show in server table</button></div><div id="tm-cve-body">${tmCveRowsHtml('')}</div><div class="form-hint" style="margin-top:10px;">Placeholder CVE IDs, fictional data. Click a server for details.</div>`, footer:closeFoot}); }
function tmFilterCve(id){ closeModal(); document.getElementById('tm-q').value=id; document.getElementById('tm-risk').value=''; tmTable(); document.getElementById('tm-table').scrollIntoView({behavior:'smooth'}); showToast('Showing servers affected by '+id,'ok'); }
function tmFixModal(){ const r = tmServers.filter(s=>s.fix).sort((a,b)=>b.top.cvss-a.top.cvss||a.id.localeCompare(b.id));
  openModal({title:`Fix available (${r.length} of ${tmServers.length} sample servers)`, wide:true, body:`<div style="max-height:380px;overflow-y:auto;">${tblWrap(['Asset','CVE','Severity','Available Fix','Current Version','Fixed Version','Remediation Status'],r.map(s=>{ const v=tmVer(s); return `<tr style="cursor:pointer" onclick="tmServerDetail('${s.id}')"><td>${s.id} <span class="form-hint">${tmAsset(s)}</span></td><td>${s.top.id}</td><td>${tagc(tmCveRisk(s.top.cvss),tmTone(tmCveRisk(s.top.cvss)))}</td><td>DEMO-PATCH-${s.top.id.slice(-4)}</td><td>${v[0]}</td><td>${v[1]}</td><td>${tmFixStatus(s)}</td></tr>`; }))}</div><div class="form-hint" style="margin-top:10px;">Fictional sample data. Click a row for server details.</div>`, footer:closeFoot}); }
const _rtm = renderTmPage;
renderTmPage = function(){ _rtm(); const k = document.querySelector('#tm-root .def-kpis'); if(!k) return;
  const act = [];
  k.innerHTML = sccmKpiCard('SOC Monitoring',0,'No imported SOC status','')
   + kpiBtn('Active SOC Tickets',act.length,'No imported SOC tickets','tmTicketsModal()')
   + kpiBtn('Open CVEs',tmServers.reduce((a,s)=>a+s.cves,0),'Click to view CVEs','tmCveModal()')
   + kpiBtn('Fix Available',tmServers.filter(s=>s.fix).length,'Servers — click to view','tmFixModal()')
   + kpiBtn('Critical Risk Servers',tmServers.filter(s=>s.risk==='Critical').length,'Click to filter table',"tmFilterRisk('Critical')")
   + kpiBtn('CRAM Servers',tmServers.length,'Click to view servers','tmServersModal()'); };

/* ---- Import management ---- */
let prevSnap = readStore('fgv_prev_snapshot', null);
const _ovr = overrideDataset;
overrideDataset = function(moduleKey, staged){
  try{ prevSnap = {when:nowIso(), module:moduleKey, file:(pendingImport&&pendingImport.fileName)||'previous import', endpoints:JSON.parse(JSON.stringify(endpoints)), datasets:JSON.parse(JSON.stringify(importDatasets))}; localStorage.setItem('fgv_prev_snapshot', JSON.stringify(prevSnap)); }catch(e){ prevSnap = null; }
  _ovr(moduleKey, staged);
};
function importVersionsHtml(){
  const cur = Object.keys(importDatasets).filter(k=>!isEntityKey(k)).map(k=>{ const h=importHistory.find(x=>x.id===importDatasets[k].importId); return h?`${esc(h.module)}: ${esc(h.fileName)}`:null; }).filter(Boolean);
  return `<div class="form-hint" style="margin-bottom:12px;"><b>Current dataset:</b> ${cur.length?cur.join(' · '):'No imported data available — showing built-in sample data'}<br><b>Previous version:</b> ${prevSnap?`before ${esc(prevSnap.module)} import, saved ${esc(fmtDateTime(prevSnap.when))}`:'none available'}</div>`;
}
function confirmDlg(title, msg, label, fn){ openModal({title, body:`<div class="confirm-body">${msg}</div>`, footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" style="background:var(--red);border-color:var(--red);" onclick="closeModal();${fn}()">${label}</button>`}); }
function deleteImportedData(){
  let hasOverride = false; try{ hasOverride = !!localStorage.getItem('fgv_endpoints_override'); }catch(e){}
  const keys = Object.keys(importDatasets).filter(k=>!isEntityKey(k));   // main-entity datasets are deleted one by one in their own list
  if(!keys.length && !hasOverride){ showToast('No imported data available \u2014 nothing to delete.','warn'); return; }
  const names = keys.map(k=>{ const h = importHistory.find(x=>x.id===importDatasets[k].importId); return esc(h ? h.module+': '+h.fileName : k); });
  const rows = keys.reduce((a,k)=>a+((importDatasets[k].rows||[]).length),0);
  confirmDlg('Delete Imported Data?', `This will permanently remove the current imported dataset${names.length?` (<b>${names.join('; ')}</b>, ${rows} rows)`:''} from the dashboard, which returns to the built-in <b>sample data</b>. <b>Import History will not be deleted</b> (use Delete History for that); the Audit Trail is kept. Main-entity datasets (FELDA, FGV, …) are not touched — delete those from their own list. You can bring the data back with Restore Previous.`, 'Delete Data', 'doDeleteImportedData'); }
function doDeleteImportedData(){
  const bkEndpoints = endpoints, bkDatasets = importDatasets, bkSnap = prevSnap;
  let rawE = null, rawD = null;
  try{ rawE = localStorage.getItem('fgv_endpoints_override'); rawD = localStorage.getItem('fgv_import_datasets'); }catch(e){}
  try{
    const snap = {when:nowIso(), module:'all', file:'deleted data', endpoints:JSON.parse(JSON.stringify(endpoints)), datasets:JSON.parse(JSON.stringify(importDatasets))};
    try{ localStorage.setItem('fgv_prev_snapshot', JSON.stringify(snap)); }catch(e){}   // restore stays available in this session even if storage is full
    const keepEnt = {}; Object.keys(importDatasets).filter(isEntityKey).forEach(k=>keepEnt[k]=importDatasets[k]);
    localStorage.removeItem('fgv_endpoints_override'); localStorage.removeItem('fgv_import_datasets');
    if(Object.keys(keepEnt).length) localStorage.setItem('fgv_import_datasets', JSON.stringify(keepEnt));   // main-entity datasets stay
    if(localStorage.getItem('fgv_endpoints_override')!==null || (!Object.keys(keepEnt).length && localStorage.getItem('fgv_import_datasets')!==null)) throw new Error('storage not cleared');
    endpoints = JSON.parse(JSON.stringify(SAMPLE_ENDPOINTS_SNAPSHOT));   // built-in sample roster
    importDatasets = keepEnt; prevSnap = snap;
    auditLog('Data Delete','Imported datasets removed; sample data restored');
    refreshViews(); renderImportPanel();
    showToast('Imported data deleted successfully. The dashboard is now showing the built-in sample data.','ok');
  }catch(err){
    endpoints = bkEndpoints; importDatasets = bkDatasets; prevSnap = bkSnap;
    try{ if(rawE!==null) localStorage.setItem('fgv_endpoints_override', rawE); if(rawD!==null) localStorage.setItem('fgv_import_datasets', rawD); }catch(e){}
    try{ refreshViews(); renderImportPanel(); }catch(e){}
    showToast('Failed to delete imported data.','error');
  }
}
function deleteImportHistory(){ const keep = new Set(Object.values(importDatasets).map(d=>d.importId)), n = importHistory.filter(h=>!keep.has(h.id)).length;
  if(!n){ showToast('No removable history: remaining entries belong to the current dataset','warn'); return; }
  confirmDlg('Delete import history?', `This deletes <b>${n}</b> import history entries. Entries for the current datasets (needed for View Data), the imported data itself and the Audit Trail are <b>not</b> affected.`, 'Delete history', 'doDeleteImportHistory'); }
function doDeleteImportHistory(){ const keep = new Set(Object.values(importDatasets).map(d=>d.importId)), n = importHistory.length;
  importHistory = importHistory.filter(h=>keep.has(h.id)); persistImportHistory(); auditLog('History Delete', (n-importHistory.length)+' import history entries deleted'); renderImportPanel(); showToast('Import history deleted','ok'); }
function restorePrevious(){ if(!prevSnap){ showToast('No previous version to restore','warn'); return; }
  confirmDlg('Restore previous version?', `This restores the data as it was before the <b>${esc(prevSnap.module)}</b> change (${esc(fmtDateTime(prevSnap.when))}). The current data will be replaced. Import history is kept.`, 'Restore previous version', 'doRestorePrevious'); }
function doRestorePrevious(){ const s = prevSnap; endpoints = s.endpoints; importDatasets = Object.assign({}, Object.fromEntries(Object.entries(s.datasets).filter(([k])=>!isEntityKey(k))), Object.fromEntries(Object.entries(importDatasets).filter(([k])=>isEntityKey(k)))); writeStore('fgv_endpoints_override', endpoints); persistImportDatasets();
  prevSnap = null; localStorage.removeItem('fgv_prev_snapshot'); auditLog('Data Restore','Previous version restored ('+s.module+')'); refreshViews(); renderImportPanel(); showToast('Previous dataset restored successfully.','ok'); }
const _rip = renderImportPanel;
renderImportPanel = function(){ _rip(); const b = document.querySelector('#import-panel .panel-head .btn-primary'); if(!b) return;
  const grp = document.createElement('div'); grp.className='btn-row'; b.parentNode.insertBefore(grp,b); grp.appendChild(b);
  grp.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary btn-sm" onclick="restorePrevious()" ${prevSnap?'':'disabled style="opacity:.55;cursor:not-allowed;"'}>Restore Previous</button><button class="btn btn-secondary btn-sm" onclick="deleteImportedData()">Delete Imported Data</button><button class="btn btn-secondary btn-sm" onclick="deleteImportHistory()">Delete History</button>`);
  const lab = document.querySelector('#import-panel .section-label'); if(lab) lab.insertAdjacentHTML('beforebegin', importVersionsHtml()); };

