/* =====================================================================
   21. CSV IMPORT & OVERRIDE — simulates a weekly Defender / SCCM /
   Kaspersky / Trend Micro Vision One CSV export being uploaded and used
   to override the matching fields on the shared `endpoints` array.
   Browser-only for this prototype: parseCSV() reads the file text,
   validateCsvColumns() checks required columns before ANY data changes,
   and nothing in `endpoints` is touched until the user explicitly
   confirms the preview (stageImportRows() only ever builds a staging
   object, it never mutates `endpoints`). Kept deliberately separate
   from rendering so this block can later be swapped for real
   browser -> local backend -> local database calls without touching
   the functions that read from `endpoints`.
   Persistence (prototype only, NOT the final database):
     fgv_endpoints_override — endpoint roster after any confirmed import
     fgv_import_history     — the Import History log below
     fgv_import_datasets    — raw rows + original columns of the CURRENT import
                              per module (older imports are replaced, see below)
===================================================================== */
const IMPORT_MODULES = [
  {key:'defender', label:'Microsoft Defender', hostnameKeys:['hostname','assetname','asset'],
    aliases:{status:['status','risklevel']}},
  {key:'sccm', label:'SCCM', hostnameKeys:['hostname','assetname','asset'],
    aliases:{applicable:['applicableupdates'], missing:['missingupdates']}},   // optional prototype fields: see stageImportRows()
  {key:'kaspersky', label:'Kaspersky', hostnameKeys:['hostname','assetname','asset'],
    aliases:{status:['status']}},
  {key:'trendmicro', label:'Trend Micro Vision One / CRAM', hostnameKeys:['hostname','servername','assetname'],
    aliases:{risk:['risklevel','severity']}},
];
/* Main entities (Name / IP address / OS / Full group name files). Chosen by the user in the import dialog, never guessed. */
const ENTITY_MODULES = [
  {key:'ent-felda', label:'FELDA', entity:true, hostnameKeys:['name'], aliases:{}},
  {key:'ent-fgv', label:'FGV', entity:true, hostnameKeys:['name'], aliases:{}},
  {key:'ent-fgv-global', label:'FELDA Global Ventures', entity:true, hostnameKeys:['name'], aliases:{}},
  {key:'ent-felda-inv', label:'FELDA Investment', entity:true, hostnameKeys:['name'], aliases:{}},
];
IMPORT_MODULES.push(...ENTITY_MODULES);
const isEntityKey = k=>String(k).indexOf('ent-')===0;
function importModule(key){
  if(key==='general') return {key:'general', label:'General Data Import', general:true, hostnameKeys:[], aliases:{}};
  return IMPORT_MODULES.find(m=>m.key===key);
}
function moduleLabelOf(key){ const m = importModule(key); return m ? m.label : key; }
function getCurrentUser(){ return {userId: sessionUser(), name: profile.name, role: ROLE_LABELS[getSessionRole()]}; }

/* ---- parseCSV(): small RFC4180-ish parser — quoted fields, embedded
   commas/newlines, doubled "" escapes. Mirrors arrayToCsv() above. ---- */
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){ if(text[i+1] === '"'){ field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if(c === '"'){ inQuotes = true; }
    else if(c === ','){ row.push(field); field = ''; }
    else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  while(rows.length && rows[rows.length-1].every(c=>c.trim()==='')) rows.pop();
  if(!rows.length) return {headers:[], records:[]};
  const headers = rows[0].map(h=>h.trim());
  const records = rows.slice(1).filter(r=>r.some(c=>c.trim()!=='')).map(r=>{
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (r[i]!=null ? r[i].trim() : ''));
    return obj;
  });
  return {headers, records};
}
function normHeader(h){ return String(h||'').trim().toLowerCase().replace(/[\s_/-]+/g,''); }
/* Flexible Excel header matching. ONLY used while flexImport is true (Excel .xlsx/.xls imports); CSV / TXT / PDF keep the exact matching above.
   Headers are normalised (case, spaces, _ - brackets, punctuation) and each expected name also accepts its common variants. */
let flexImport = false;
const flexNorm = h=>String(h||'').toLowerCase().replace(/\(.*?\)|\[.*?\]|\{.*?\}/g,'').replace(/[^a-z0-9]+/g,'');
const FLEX_SYN = [
  ['hostname','host','computername','computer','devicename','device','assetname','asset','servername','server','machinename','machine','endpointname','endpoint','nodename','pcname','systemname','name'],
  ['status','risklevel','risk','state','compliancestatus','compliancestate','patchstatus','protectionstatus','healthstatus','securitystatus','devicestatus','riskstatus'],
  ['risklevel','severity','risk','riskrating','status'],
  ['applicableupdates','applicable','requiredupdates','updatesapplicable','updatesrequired','totalupdates'],
  ['missingupdates','missing','updatesmissing','pendingupdates','updatesnotinstalled','notinstalledupdates'],
  ['ipaddress','ip','ipv4','ipv4address','ipaddr'],
  ['os','operatingsystem','osname','osversion','platform'],
  ['location','site','office','branch'],
  ['pendingreboot','rebootpending','rebootrequired','needsreboot'],
  ['compliancestate','patchstatus','compliancestatus','status','state'],
];
const FLEX_KNOWN = new Set([].concat(...FLEX_SYN, ['domain','domainworkgroup','domainstatus','domainname','exposurelevel','exposure','sccmclientstatus','clientstatus','sccmclient','lastseen','lastscan']));
function flexExpand(keys){
  const out = keys.slice();
  keys.forEach(k=> FLEX_SYN.forEach(g=>{ if(g.includes(k)) g.forEach(x=>{ if(!out.includes(x)) out.push(x); }); }));
  return out;
}
function findHeaderFor(headers, aliasKeys){
  const map = {};
  if(flexImport){ headers.forEach(h=>{ const n = flexNorm(h); if(n && !map[n]) map[n] = h; }); aliasKeys = flexExpand(aliasKeys); }
  else headers.forEach(h=> map[normHeader(h)] = h);
  for(const key of aliasKeys){ if(map[key]) return map[key]; }
  return null;
}
function validateCsvColumns(moduleKey, headers){
  if(importModule(moduleKey).entity) return validateEntityColumns(headers);
  const m = importModule(moduleKey);
  const hostnameHeader = findHeaderFor(headers, m.hostnameKeys);
  const missing = [];
  if(!hostnameHeader) missing.push('Hostname (or Asset Name / Server Name)');
  if(flexImport) return {ok: !!hostnameHeader, missing, hostnameHeader};   // Excel: other columns are optional - whatever is missing is simply not imported
  if(moduleKey==='defender' || moduleKey==='kaspersky'){
    if(!findHeaderFor(headers, m.aliases.status)) missing.push('Status (or Risk Level)');
  }
  if(moduleKey==='sccm'){
    if(!findHeaderFor(headers, m.aliases.applicable)) missing.push('Applicable Updates');
    if(!findHeaderFor(headers, m.aliases.missing)) missing.push('Missing Updates');
  }
  if(moduleKey==='trendmicro'){
    if(!findHeaderFor(headers, m.aliases.risk)) missing.push('Risk Level (or Severity)');
  }
  return {ok: missing.length===0, missing, hostnameHeader};
}
function normalizeProtectionStatus(raw){
  const v = String(raw||'').trim().toLowerCase();
  if(['offline','inactive','not reporting','disconnected'].includes(v)) return 'Offline';
  if(['at risk','high','critical','infected','alert','non-compliant','noncompliant'].includes(v)) return 'At Risk';
  return 'Protected';
}
function normalizeTrendRisk(raw){
  const v = String(raw||'').trim().toLowerCase();
  if(v.includes('critical')) return 'Critical Risk';
  if(v.includes('high')) return 'High Risk';
  if(v.includes('medium')) return 'Medium Risk';
  return 'Low Risk';
}
/* Builds a STAGING object only — endpoints[] is never touched here. */
function stageImportRows(moduleKey, headers, records){
  if(importModule(moduleKey).entity) return stageEntityRows(headers, records);
  const m = importModule(moduleKey);
  const hostnameHeader = findHeaderFor(headers, m.hostnameKeys);
  const statusHeader = (moduleKey==='defender'||moduleKey==='kaspersky') ? findHeaderFor(headers, m.aliases.status) : null;
  const riskHeader = moduleKey==='trendmicro' ? findHeaderFor(headers, m.aliases.risk) : null;
  const applicableHeader = moduleKey==='sccm' ? findHeaderFor(headers, m.aliases.applicable) : null;
  const missingHeader = moduleKey==='sccm' ? findHeaderFor(headers, m.aliases.missing) : null;
  const seen = new Set();
  let duplicates = 0;
  const staged = [];
  records.forEach(r=>{
    const hostname = (r[hostnameHeader]||'').trim();
    if(!hostname) return;
    const key = hostname.toUpperCase();
    if(seen.has(key)) duplicates++;
    seen.add(key);
    const rec = {hostname};
    if(moduleKey==='defender'){
      if(statusHeader) rec.defender = normalizeProtectionStatus(r[statusHeader]);
      /* Prototype-friendly optional mapping (real Defender export column names still to be confirmed):
         a separate Risk Level column of High/Critical marks the endpoint At Risk; Exposure Level,
         Domain/Workgroup, IP and Location are copied only when those columns exist. */
      const riskH = findHeaderFor(headers, ['risklevel']);
      if(riskH && riskH!==statusHeader && rec.defender!=='Offline' && normalizeProtectionStatus(r[riskH])==='At Risk') rec.defender = 'At Risk';
      const val = keys=>{ const h = findHeaderFor(headers, keys); return h ? String(r[h]||'').trim() : ''; };
      const ext = {};
      const ex = val(['exposurelevel','exposure']).toLowerCase();
      if(/high|critical/.test(ex)) ext.exposure = 'High'; else if(/med|moderate/.test(ex)) ext.exposure = 'Medium'; else if(/low|none|minimal/.test(ex)) ext.exposure = 'Low';
      const dm = val(['domainworkgroup','domainstatus','domain','joinstate']);
      const dn = val(['domainname','detecteddomain']);
      if(/work\s*group/i.test(dm)) ext.domain = 'Workgroup';
      else if(/domain/i.test(dm) || dn) ext.domain = 'Domain-Joined';
      else if(/^[A-Za-z0-9-]{2,20}$/.test(dm)) { ext.domain = 'Domain-Joined'; ext.domainName = dm.toUpperCase(); }   // value is the domain name itself, e.g. FELHQR
      if(dn && ext.domain==='Domain-Joined') ext.domainName = dn.toUpperCase();
      const ip = val(['ipaddress','ip']); if(/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) ext.ip = ip;
      
      const loc = val(['location']); if(loc) ext.location = loc;
      if(Object.keys(ext).length) rec.ext = ext;
    }
    if(moduleKey==='kaspersky' && statusHeader) rec.kaspersky = normalizeProtectionStatus(r[statusHeader]);
    if(moduleKey==='trendmicro' && riskHeader) rec.trendmicro = normalizeTrendRisk(r[riskHeader]);
    if(moduleKey==='sccm'){
      if(applicableHeader && missingHeader){
        const applicable = Math.max(0, parseInt(r[applicableHeader],10) || 0);
        const missing = Math.min(applicable, Math.max(0, parseInt(r[missingHeader],10) || 0));
        rec.patch = {applicable, installed: applicable - missing};
      }
      /* Optional prototype fields (NOT a confirmed production SCCM export schema): IP Address, Patch Status /
         Compliance State, Location, Pending Reboot, SCCM Client Status. Copied only when present. */
      const val = keys=>{ const h = findHeaderFor(headers, keys); return h ? String(r[h]||'').trim() : ''; };
      const ext = {};
      const ip = val(['ipaddress','ip']); if(/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) ext.ip = ip;
      
      const loc = val(['location']); if(loc) ext.location = loc;
      const pr = val(['pendingreboot','rebootpending']).toLowerCase(); if(pr) ext.pendingReboot = /^(yes|y|true|1|pending)$/.test(pr);
      const cl = val(['sccmclientstatus','clientstatus','sccmclient']).toLowerCase();
      if(cl) ext.sccmClient = /miss|not install|none/.test(cl) ? 'Missing' : /problem|error|fail|unhealthy|inactive/.test(cl) ? 'Problem' : 'Installed';
      const st = val(['compliancestate','patchstatus','compliancestatus']).toLowerCase().replace(/[\s_-]+/g,'');
      rec.complianceState = st==='compliant' ? 'Compliant' : (st==='noncompliant' ? 'Non-Compliant' : (st==='unknown' || st==='stateunknown' ? 'Unknown' : ''));
      if(Object.keys(ext).length) rec.ext = ext;
    }
    if(flexImport){   // Excel only: copy OS (and IP for the tools that did not already read it) when those columns really exist
      const oh = findHeaderFor(headers, ['os']); const ov = oh ? String(r[oh]||'').trim() : ''; if(ov) rec.os = ov;
      if(moduleKey==='kaspersky' || moduleKey==='trendmicro'){ const ih = findHeaderFor(headers, ['ipaddress']); const iv = ih ? String(r[ih]||'').trim() : ''; if(/^\d{1,3}(\.\d{1,3}){3}$/.test(iv)) rec.ext = {ip:iv}; }
    }
    // de-dupe within this file: keep the LAST row for a repeated hostname
    const existingIdx = staged.findIndex(s=>s.hostname.toUpperCase()===key);
    if(existingIdx>-1) staged[existingIdx] = rec; else staged.push(rec);
  });
  return {staged, duplicates};
}
/* The only function that mutates endpoints[] for an import. Upserts by
   hostname: updates only the fields owned by this module on a match,
   creates a minimal new endpoint (safe prototype defaults for the
   OTHER modules' fields) when the hostname isn't already tracked. */
function overrideDataset(moduleKey, staged){
  const now = nowIso();
  staged.forEach(r=>{
    let e = endpoints.find(x=>x.id.toUpperCase()===r.hostname.toUpperCase());
    const isNew = !e;
    if(!e){
      e = {
        id: r.hostname, os: r.os || 'Unknown',
        defender:'Unknown', kaspersky:'Unknown', trendmicro:'Unknown', sccm:'Unknown',
        patch:null, config:{}, lastSync:{},
      };
      endpoints.push(e);
    }
    if(r.os) e.os = r.os;   // only present for Excel imports whose file has an OS column
    if(moduleKey==='defender'){ if(r.defender!==undefined) e.defender = r.defender; if(r.ext){ ensureExt(e); Object.assign(e.ext, r.ext); } }
    if(moduleKey==='kaspersky'){ if(r.kaspersky!==undefined) e.kaspersky = r.kaspersky; if(r.ext){ ensureExt(e); Object.assign(e.ext, r.ext); } }
    if(moduleKey==='trendmicro'){ if(r.trendmicro!==undefined) e.trendmicro = r.trendmicro; if(r.ext){ ensureExt(e); Object.assign(e.ext, r.ext); } }
    if(moduleKey==='sccm'){
      if(r.patch) e.patch = {applicable:r.patch.applicable, installed:r.patch.installed};
      ensureExt(e);
      if(r.ext) Object.assign(e.ext, r.ext);
      /* '' = derive from update counts. A NEW device whose file gave neither update counts nor a state is recorded as Unknown (nothing is invented). */
      e.ext.complianceState = r.complianceState || (!r.patch && isNew ? 'Unknown' : (!r.patch ? (e.ext.complianceState||'') : ''));
    }
    e.lastSync = e.lastSync || {};
    e.lastSync[moduleKey] = now;
  });
  deriveAll();
  writeStore('fgv_endpoints_override', endpoints);
}

/* ---- Import History (prototype stand-in for the future Audit Trail) ---- */
let importHistory = readStore('fgv_import_history', []);
function persistImportHistory(){ writeStore('fgv_import_history', importHistory); }
function recordImportHistory(entry){
  const user = getCurrentUser();
  const rec = {
    id: uid('IMPORT', importHistory),
    timestamp: nowIso(),
    userId: user.userId, userName: user.name, role: user.role,
    action: 'CSV Import',
    module: entry.module, moduleKey: entry.moduleKey || '', fileName: entry.fileName,
    recordCount: entry.recordCount, status: entry.status, note: entry.note || '',
  };
  if(entry.status==='Imported'){
    rec.datasetId = rec.id;                       // reference into fgv_import_datasets
    rec.columnCount = entry.columnCount || 0;
    rec.duplicates = entry.duplicates || 0;
  }
  auditLog("CSV Upload", rec.module+" — "+rec.fileName+" ("+rec.status+", "+rec.recordCount+" rows)");
  importHistory.unshift(rec);
  persistImportHistory();
  renderImportHistory();
  return rec;
}

/* ---- Imported dataset store (prototype only — NOT the final database) ----
   Retention rule: only the CURRENT dataset per module is kept (a new
   confirmed import for the same module replaces it, exactly like the
   override of the live data). Import History keeps every event. Rows are
   stored as arrays in column order to keep localStorage small. */
let importDatasets = readStore('fgv_import_datasets', {});
function persistImportDatasets(){
  try{ localStorage.setItem('fgv_import_datasets', JSON.stringify(importDatasets)); return true; }
  catch(e){ return false; }
}
function saveImportedDataset(rec, moduleKey, headers, records){
  const prev = importDatasets[moduleKey];
  if(prev){
    const prevRec = importHistory.find(h=>h.id===prev.importId);
    if(prevRec){ prevRec.superseded = true; prevRec.supersededBy = rec.id; }
  }
  importDatasets[moduleKey] = {
    importId: rec.id, columns: headers.slice(),
    rows: records.map(r=> headers.map(h=> r[h]==null ? '' : String(r[h]))),
  };
  if(!persistImportDatasets()){
    // browser storage full/unavailable: keep history, drop the viewable copy
    delete importDatasets[moduleKey];
    rec.note = 'Imported data applied, but the rows are too large to keep in browser storage for viewing.';
    showToast('Imported, but the data is too large to keep for the viewer in browser storage.', 'error');
  }
  persistImportHistory();
  renderImportHistory();
}
function getImportedDataset(importId){
  const h = importHistory.find(x=>x.id===importId);
  if(!h || h.status!=='Imported') return null;

  // MySQL-backed imports are keyed by their unique batch/import ID so older
  // batches remain viewable too. Legacy tool imports still use moduleKey.
  const byImportId = importDatasets[importId];
  if(byImportId && byImportId.importId===importId){
    return {record:h, dataset:byImportId};
  }
  const byModule = importDatasets[h.moduleKey];
  return (byModule && byModule.importId===importId) ? {record:h, dataset:byModule} : null;
}
function importStatusBadge(s){
  const map = {Imported:'badge-green', Failed:'badge-red', Cancelled:'badge-amber'};
  return `<span class="badge ${map[s]||'badge-slate'}">${s}</span>`;
}
function importActionCell(h){
  if(h.status!=='Imported') return '<span class="form-hint">&mdash;</span>';
  if(getImportedDataset(h.id)){
    return `<button class="btn btn-secondary btn-sm" onclick="openImportedData('${h.id}')">${ICONS.eye} View Data</button>`;
  }
  const why = h.superseded ? 'Replaced by a newer import of this module; only the current dataset is kept in this prototype.' : 'Imported rows were not retained for this entry.';
  return `<span class="badge badge-slate" title="${esc(why)}">${h.superseded ? 'Replaced' : 'Not retained'}</span>`;
}
function renderImportHistory(){
  const tbody = document.getElementById('import-history-tbody');
  if(!tbody) return;
  if(!importHistory.length){
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${ICONS.file}<div class="e1">No imports yet</div><div class="e2">Successful, failed and cancelled CSV imports will be logged here.</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = importHistory.map(h=>`
    <tr>
      <td>${fmtDateTime(h.timestamp)}</td>
      <td>${esc(h.userName)}<div class="form-hint" style="margin-top:2px;">${esc(h.userId)}</div></td>
      <td>${esc(h.role)}</td>
      <td>${esc(h.module)}</td>
      <td>${esc(h.fileName)}</td>
      <td style="text-align:right;">${h.recordCount}</td>
      <td>${importStatusBadge(h.status)}${getImportedDataset(h.id)?' <span class="badge badge-blue">Current</span>':''}${h.note?`<div class="form-hint" style="margin-top:3px;">${esc(h.note)}</div>`:''}</td>
      <td>${importActionCell(h)}</td>
    </tr>
  `).join('');
}

/* ---- Imported Data Viewer: actual rows + original columns of one import ---- */
let ivState = null;
function openImportedData(importId){
  const found = getImportedDataset(importId);
  if(!found){ showToast('This imported dataset is no longer available.', 'error'); return; }
  const h = found.record, ds = found.dataset;
  ivState = {importId, search:'', sortCol:-1, sortDir:'asc', page:1, pageSize:10};
  openModal({
    title:'Imported Data', wide:true,
    body:`
      <div class="iv-banner">
        <span class="badge badge-blue">Imported Data</span>
        <span class="badge badge-green">Current ${esc(h.module)} dataset</span>
        <span class="iv-src">Source: <b>${esc(h.fileName)}</b></span>
      </div>
      <div class="detail-grid">
        <div class="detail-row"><span class="k">Module</span><span class="v">${esc(h.module)}</span></div>
        <div class="detail-row"><span class="k">Source file</span><span class="v">${esc(h.fileName)}</span></div>
        <div class="detail-row"><span class="k">Imported by</span><span class="v">${esc(h.userName)}</span></div>
        <div class="detail-row"><span class="k">User ID</span><span class="v">${esc(h.userId)}</span></div>
        <div class="detail-row"><span class="k">Role</span><span class="v">${esc(h.role)}</span></div>
        <div class="detail-row"><span class="k">Imported at</span><span class="v">${fmtDateTime(h.timestamp)}</span></div>
        <div class="detail-row"><span class="k">Records</span><span class="v">${h.recordCount}${h.duplicates?` unique hostnames &mdash; file has ${h.recordCount+h.duplicates} rows incl. ${h.duplicates} duplicate hostname row(s), last value applied`:''}</span></div>
        <div class="detail-row"><span class="k">Import status</span><span class="v">${esc(h.status)}</span></div>
        <div class="detail-row"><span class="k">Dataset ID</span><span class="v">${esc(h.datasetId || h.id)}</span></div>
        <div class="detail-row"><span class="k">Columns</span><span class="v">${ds.columns.length}</span></div>
      </div>
      <div class="iv-cols"><b>Column names:</b> ${ds.columns.map(esc).join(' &middot; ')}</div>
      <div class="table-toolbar" style="padding:0 0 10px;">
        <div class="search-box" style="flex:none;">
          ${ICONS.search}
          <input type="text" id="iv-search" placeholder="Search imported data&hellip;" oninput="ivSetSearch(this.value)">
        </div>
      </div>
      <div class="table-scroll iv-table-wrap"><table><thead id="iv-thead"></thead><tbody id="iv-tbody"></tbody></table></div>
      <div class="pagination" style="padding:10px 0 0;">
        <span id="iv-count"></span>
        <div class="pg-btns">
          <select class="filter-select" id="iv-page-size" onchange="ivSetPageSize(this.value)">
            <option value="10" selected>10 / page</option><option value="25">25 / page</option>
            <option value="50">50 / page</option><option value="100">100 / page</option>
          </select>
          <button class="btn btn-ghost btn-sm" id="iv-prev" onclick="ivGoPage(ivState.page-1)">&lsaquo; Prev</button>
          <span id="iv-pages" class="pg-btns"></span>
          <button class="btn btn-ghost btn-sm" id="iv-next" onclick="ivGoPage(ivState.page+1)">Next &rsaquo;</button>
        </div>
      </div>
      <div class="form-hint" style="margin-top:10px;">Prototype only &mdash; imported rows are kept in this browser's localStorage, which is not secure storage and not the final database.</div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  });
  const box = document.querySelector('#modal-overlay .modal-box');
  if(box) box.classList.add('xwide');
  renderImportedData();
}
function ivSetSearch(v){ ivState.search = v; ivState.page = 1; renderImportedData(); }
function ivSetPageSize(v){ ivState.pageSize = parseInt(v,10)||10; ivState.page = 1; renderImportedData(); }
function ivGoPage(p){ ivState.page = p; renderImportedData(); }
function ivSort(i){
  if(ivState.sortCol===i) ivState.sortDir = ivState.sortDir==='asc' ? 'desc' : 'asc';
  else { ivState.sortCol = i; ivState.sortDir = 'asc'; }
  ivState.page = 1; renderImportedData();
}
function ivCompare(a, b){
  const na = parseFloat(a), nb = parseFloat(b);
  if(a!=='' && b!=='' && !isNaN(na) && !isNaN(nb) && String(na)===a.trim() && String(nb)===b.trim()) return na-nb;
  return String(a).localeCompare(String(b), undefined, {numeric:true, sensitivity:'base'});
}
function renderImportedData(){
  const found = ivState && getImportedDataset(ivState.importId);
  const tbody = document.getElementById('iv-tbody');
  if(!found || !tbody) return;
  const ds = found.dataset, s = ivState;
  const q = s.search.trim().toLowerCase();
  let rows = q ? ds.rows.filter(r=> r.some(c=> String(c).toLowerCase().includes(q))) : ds.rows.slice();
  if(s.sortCol>=0){
    const dir = s.sortDir==='asc' ? 1 : -1;
    rows.sort((a,b)=> dir*ivCompare(a[s.sortCol], b[s.sortCol]));
  }
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / s.pageSize));
  s.page = Math.min(Math.max(1, s.page), totalPages);
  const start = (s.page-1) * s.pageSize;
  const pageRows = rows.slice(start, start + s.pageSize);
  document.getElementById('iv-thead').innerHTML = '<tr>' + ds.columns.map((c,i)=>
    `<th data-sort="${i}" class="${s.sortCol===i?(s.sortDir==='asc'?'sorted-asc':'sorted-desc'):''}" onclick="ivSort(${i})">${esc(c)||'(blank)'}</th>`).join('') + '</tr>';
  tbody.innerHTML = pageRows.length
    ? pageRows.map(r=>'<tr>' + r.map(c=>`<td>${esc(c)}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${ds.columns.length}"><div class="empty-state">${ICONS.search}<div class="e1">No imported rows match your search</div></div></td></tr>`;
  const from = total ? start+1 : 0, to = Math.min(start + s.pageSize, total);
  document.getElementById('iv-count').textContent =
    `Showing ${from}\u2013${to} of ${total} records` + (q ? ` (${ds.rows.length} total)` : '');
  // page numbers: first, last and a window around the current page
  const nums = [];
  for(let p=1; p<=totalPages; p++){
    if(p===1 || p===totalPages || Math.abs(p-s.page)<=1) nums.push(p);
    else if(nums[nums.length-1] !== '…') nums.push('…');
  }
  document.getElementById('iv-pages').innerHTML = nums.map(p=> p==='…'
    ? '<span class="form-hint">&hellip;</span>'
    : `<button class="btn btn-ghost btn-sm pg-num ${p===s.page?'active':''}" onclick="ivGoPage(${p})">${p}</button>`).join('');
  document.getElementById('iv-prev').disabled = s.page<=1;
  document.getElementById('iv-next').disabled = s.page>=totalPages;
}

/* ---- Main-entity datasets (Name | IP address | OS | Full group name), CSV or Excel ---- */
const ENTITY_COLUMNS = ['Name','IP address','OS','Full group name','Location','Company','Floor','Department'];
const dashVal = v=>{ v = (v==null) ? '' : String(v).trim(); return (v && !/^(undefined|null|nan)$/i.test(v)) ? v : '-'; };
/* "Managed devices/Menara/FELDA/Tingkat 01/Tingkat 01 - Pejabat CEO" -> Location / Company / Floor / Department.
   The group name may be incomplete, so each part falls back to "-" and the number of "/" sections is never assumed. */
function parseGroupName(full) {
  let parts = (full == null ? '' : String(full))
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  // Remove "Managed devices" prefix.
  if (parts.length && /^managed devices$/i.test(parts[0])) {
    parts = parts.slice(1);
  }

  const value = v => v || '-';

  return {
    location: value(parts[0]),
    company: value(parts[1]),
    department: value(parts.slice(2).join(' / '))
  };
}
function validateEntityColumns(headers){
  const need = [['Name',['name']],['IP address',['ipaddress']],['OS',['os']],['Full group name',['fullgroupname']]];
  const missing = need.filter(([,k])=>!findHeaderFor(headers,k)).map(([l])=>l);
  return {ok:missing.length===0, missing, hostnameHeader:findHeaderFor(headers,['name'])};
}
function stageEntityRows(headers, records){
  const hN=findHeaderFor(headers,['name']), hI=findHeaderFor(headers,['ipaddress']), hO=findHeaderFor(headers,['os']), hG=findHeaderFor(headers,['fullgroupname']);
  const staged = [], seen = new Set(); let duplicates = 0;
  records.forEach(r=>{
    const name = String(r[hN]||'').trim(); if(!name) return;
    const key = name.toUpperCase(); if(seen.has(key)) duplicates++; seen.add(key);
    const g = parseGroupName(r[hG]);
    const rec = {hostname:name, ip:dashVal(r[hI]), os:dashVal(r[hO]), groupName:dashVal(r[hG]), location:g.location, company:g.company, floor:g.floor, department:g.department};
    const i = staged.findIndex(s=>s.hostname.toUpperCase()===key);
    if(i>-1) staged[i] = rec; else staged.push(rec);   // repeated name inside one file: last row kept (same rule as the other imports)
  });
  return {staged, duplicates};
}
function showEntityPreview(){
  const p = pendingImport, m = importModule(p.module), user = getCurrentUser(), sample = p.staged.slice(0,5);
  openModal({
    title:'Preview import', wide:true,
    body:`
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="detail-row"><span class="k">Main entity</span><span class="v">${esc(m.label)}</span></div>
        <div class="detail-row"><span class="k">File name</span><span class="v">${esc(p.fileName)}</span></div>
        <div class="detail-row"><span class="k">Format</span><span class="v">${esc(p.format||"")}</span></div>
        <div class="detail-row"><span class="k">Records detected</span><span class="v">${p.staged.length}${p.duplicates?` (${p.duplicates} duplicate name row(s) &mdash; last value kept)`:''}</span></div>
        <div class="detail-row"><span class="k">Import date/time</span><span class="v">${fmtDateTime(nowIso())} (browser time)</span></div>
        <div class="detail-row"><span class="k">Imported by</span><span class="v">${esc(user.name)} &middot; ${esc(user.role)}</span></div>
      </div>
      <div class="section-label">Preview (first ${sample.length} of ${p.staged.length} records)</div>
      <div class="table-scroll" style="max-height:220px;overflow-y:auto;margin-bottom:10px;">
        <table><thead><tr><th>Name</th><th>IP address</th><th>OS</th><th>Full group name</th><th>Location</th><th>Company</th><th>Floor</th><th>Department</th></tr></thead>
        <tbody>${sample.map(r=>`<tr><td>${esc(r.hostname)}</td><td>${esc(r.ip)}</td><td>${esc(r.os)}</td><td>${esc(r.groupName)}</td><td>${esc(r.location)}</td><td>${esc(r.company)}</td><td>${esc(r.floor)}</td><td>${esc(r.department)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="form-hint">Confirming stores this file as the <b>${esc(m.label)}</b> dataset (replacing any earlier ${esc(m.label)} import). The other main entities, the security-tool data and Import History are not affected. Missing parts of a Full group name are shown as "-". The file is read in your browser only.</div>`,
    footer:`<button class="btn btn-secondary" onclick="cancelImport()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmImport()">${ICONS.check} Confirm import</button>`
  });
}
function confirmEntityImport(){
  const p = pendingImport, m = importModule(p.module); if(!p) return;
  const recs = p.staged.map(s=>({'Name':s.hostname,'IP address':s.ip,'OS':s.os,'Full group name':s.groupName,'Location':s.location,'Company':s.company,'Floor':s.floor,'Department':s.department}));
  auditLog('Data Import', m.label+' dataset imported from '+p.fileName+' ('+p.staged.length+' rows)');
  const rec = recordImportHistory({module:m.label, moduleKey:p.module, fileName:p.fileName, recordCount:p.staged.length, status:'Imported', columnCount:ENTITY_COLUMNS.length, duplicates:p.duplicates});
  saveImportedDataset(rec, p.module, ENTITY_COLUMNS, recs);
  pendingImport = null; closeModal(); refreshViews(); renderImportPanel();
  if(importDatasets[p.module]) showToast(`${esc(m.label)} data imported successfully. ${p.staged.length} records.`, 'ok');   // (saveImportedDataset already shows an error if the browser could not keep the rows)
}
function entityDatasetsHtml(){
  const rows = ENTITY_MODULES.map(m=>{ const ds = importDatasets[m.key], h = ds && importHistory.find(x=>x.id===ds.importId);
    return `<tr><td>${esc(m.label)}</td><td style="text-align:right;">${ds?ds.rows.length:'-'}</td><td>${h?esc(h.fileName):'-'}</td><td>${h?fmtDateTime(h.timestamp):'-'}</td><td>${ds&&h?`<button class="btn btn-secondary btn-sm" onclick="openImportedData('${ds.importId}')">${ICONS.eye} View</button> <button class="btn btn-secondary btn-sm" onclick="deleteEntityData('${m.key}')">Delete</button>`:'<span class="form-hint">No imported data available</span>'}</td></tr>`; }).join('');
  return `<div class="section-label">Imported datasets (main entities)</div><div class="table-scroll" style="margin-bottom:14px;"><table><thead><tr><th>Main entity</th><th>Records</th><th>Source file</th><th>Imported</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function deleteEntityData(key){ const m = importModule(key), ds = importDatasets[key];
  if(!ds){ showToast('No imported '+m.label+' data available \u2014 nothing to delete.','warn'); return; }
  confirmDlg(`Delete imported ${m.label} data?`, `This will remove the currently imported <b>${esc(m.label)}</b> dataset (${ds.rows.length} records) from the dashboard. The other main entities, the security-tool data and Import History are not affected.`, 'Delete', `(()=>doDeleteEntityData('${key}'))`); }
function doDeleteEntityData(key){ const m = importModule(key), bk = importDatasets[key];
  try{
    delete importDatasets[key];
    if(!persistImportDatasets()) throw new Error('storage');
    auditLog('Data Delete', m.label+' imported dataset removed');
    renderImportHistory(); renderImportPanel();
    showToast(`Imported ${esc(m.label)} data deleted successfully.`,'ok');
  }catch(err){
    importDatasets[key] = bk; try{ persistImportDatasets(); }catch(e){}
    renderImportHistory(); renderImportPanel();
    showToast(`Failed to delete imported ${esc(m.label)} data.`,'error');
  }
}

/* ---- File readers. EVERY format is read locally in the browser and converted to the SAME {headers, records} shape that
   parseCSV() returns, so CSV / Excel / PDF / TXT all share one validate -> preview -> confirm path. Nothing is uploaded. ---- */
const IMPORT_FORMAT_LABELS = {csv:'CSV file', xlsx:'Excel Workbook (.xlsx)', xls:'Excel 97-2003 Workbook (.xls)', pdf:'PDF document', txt:'Text file'};
const IMPORT_KIND_NOUN = {csv:'CSV', xlsx:'Excel', xls:'Excel', pdf:'PDF', txt:'text'};
const IMPORT_EXT_KIND = {csv:'csv', xlsx:'xlsx', xlsm:'xlsx', xls:'xls', pdf:'pdf', txt:'txt', tsv:'txt', text:'txt'};
const IMPORT_MIME_KIND = {'text/csv':'csv', 'application/csv':'csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx', 'application/vnd.ms-excel':'xls', 'application/pdf':'pdf', 'text/plain':'txt', 'text/tab-separated-values':'txt'};
/* Detects the parser from the real file extension first, then the MIME type (Windows reports .csv as application/vnd.ms-excel, so the
   extension wins). Returns null for anything unsupported. Add a new format = add one entry above and one reader below. */
function detectImportType(file){
  const m = /\.([A-Za-z0-9]+)$/.exec(file.name || '');
  const ext = m ? m[1].toLowerCase() : '';
  if(IMPORT_EXT_KIND[ext]) return IMPORT_EXT_KIND[ext];
  if(!ext || !/^(docx?|pptx?|png|jpe?g|gif|zip|exe|json|xml|html?)$/.test(ext)) return IMPORT_MIME_KIND[String(file.type||'').toLowerCase()] || null;
  return null;
}
function importError(code, message){ const e = new Error(message || code); e.code = code; return e; }
/* Rows (arrays of cells) -> {headers, records}. The header row is the first row with 2+ filled cells (skips title lines above it);
   empty rows are dropped and every value is converted to a trimmed string. */
function rowsToTable(rows){
  const cells = rows.map(r=>Array.from(r||[], v=>v==null ? '' : String(v).trim()));
  const filled = cells.filter(r=>r.some(c=>c!==''));
  if(!filled.length) return {headers:[], records:[]};
  let hi = filled.findIndex(r=>r.filter(c=>c!=='').length>=2); if(hi<0) hi = 0;
  const idx = [], headers = [];
  filled[hi].forEach((h,i)=>{ if(h!==''){ idx.push(i); headers.push(h); } });
  const records = filled.slice(hi+1).map(r=>{ const o = {}; headers.forEach((h,k)=>{ const v = r[idx[k]]; o[h] = v!=null ? v : ''; }); return o; });
  return {headers, records};
}
/* Excel (.xlsx and legacy .xls): SheetJS is bundled inline above (global XLSX). */
function parseXLSX(buf){   /* picks the most relevant worksheet and header row automatically */
  if(typeof XLSX==='undefined' || !XLSX.read || !XLSX.utils) throw importError('lib', 'The bundled Excel reader (SheetJS) is not available');
  const u8 = new Uint8Array(buf), zip = u8[0]===0x50 && u8[1]===0x4B, ole = u8[0]===0xD0 && u8[1]===0xCF, markup = u8[0]===0x3C;   // .xlsx = ZIP, .xls = OLE2 (or an HTML/XML table export)
  if(!zip && !ole && !markup) throw importError('xlsx', 'not an Excel workbook');
  let wb;
  try{ wb = XLSX.read(u8, {type:'array', cellDates:false}); }
  catch(e){ throw importError('xlsx', 'workbook could not be read'); }
  const names = (wb && wb.SheetNames) || [];
  /* Use the worksheet (and header row) with the most recognisable column names; fall back to the first sheet that has data. */
  let best = null;
  names.forEach((nm, si)=>{
    const ws = wb.Sheets[nm]; if(!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:'', blankrows:false});
    const data = rows.filter(r=>Array.from(r||[]).some(c=>String(c==null?'':c).trim()!==''));
    if(!data.length) return;
    let hi = -1, hs = 0;
    rows.slice(0,40).forEach((r,i)=>{ const sc = Array.from(r||[]).filter(c=>FLEX_KNOWN.has(flexNorm(c))).length; if(sc>hs){ hs = sc; hi = i; } });
    const cand = {rows: hi>0 ? rows.slice(hi) : rows, score: hs, size: data.length, si};
    if(!best || cand.score>best.score || (cand.score===best.score && cand.size>best.size)) best = cand;
  });
  if(!best) return {headers:[], records:[]};
  return rowsToTable(best.rows);
}
/* TXT: tab / comma / semicolon / pipe / 2+ spaces. A delimiter is accepted only when most lines split into the same 2+ columns. */
function parseTxtTable(text){
  const lines = String(text||'').replace(/^\uFEFF/,'').split(/\r\n|\n|\r/).filter(l=>l.trim()!=='');
  if(lines.length<2) throw importError('struct', 'not enough lines');
  const tries = [['\t', l=>l.split('\t')], [',', l=>l.split(',')], [';', l=>l.split(';')], ['|', l=>l.split('|')], ['  ', l=>l.trim().split(/\s{2,}/)]];
  for(const [d, split] of tries){
    const counts = lines.slice(0,200).map(l=>split(l).length), freq = {};
    counts.forEach(c=>freq[c]=(freq[c]||0)+1);
    const mode = +Object.keys(freq).sort((x,y)=>freq[y]-freq[x])[0];
    if(mode>=2 && freq[mode]/counts.length>=0.6){
      const t = d===',' ? parseCSV(lines.join('\n')) : rowsToTable(lines.map(split));
      if(t.headers.length>=2 && t.records.length) return t;
    }
  }
  throw importError('struct', 'no table structure');
}
/* PDF: PDF.js is bundled inline (two text blocks) and started lazily from a local blob: URL - no network, no OCR service. */
let pdfJsReady = null;
function ensurePdfJs(){
  if(pdfJsReady) return pdfJsReady;
  pdfJsReady = new Promise((res, rej)=>{
    try{
      if(!window.PDFJS_WORKER_SOURCE) throw importError('lib', 'The bundled PDF reader is not available');
      const api = window['pdfjs-dist/build/pdf']; if(!api) throw importError('lib', 'The PDF reader failed to start');
      api.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([window.PDFJS_WORKER_SOURCE], {type:'text/javascript'}));
      res(api);
    }catch(e){ pdfJsReady = null; rej(e); }
  });
  return pdfJsReady;
}
async function parsePDF(buf){
  const api = await ensurePdfJs();
  let doc; try{ doc = await api.getDocument({data:new Uint8Array(buf), isEvalSupported:false}).promise; }
  catch(e){ console.error('PDF open failed:', e); throw importError('pdf', 'invalid pdf'); }
  const lines = []; let chars = 0;
  for(let p=1;p<=doc.numPages;p++){
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = tc.items.filter(it=>it.str && it.str.trim()!=='').map(it=>({s:it.str.trim(), x:it.transform[4], y:it.transform[5], w:it.width||0, h:Math.abs(it.height)||Math.abs(it.transform[3])||10}));
    items.forEach(it=>chars += it.s.length);
    items.sort((a,b)=>b.y-a.y || a.x-b.x);
    let cur = null;
    items.forEach(it=>{ if(cur && Math.abs(it.y-cur.y) <= Math.max(2, it.h*0.5)) cur.items.push(it); else { cur = {y:it.y, items:[it]}; lines.push(cur); } });
  }
  if(chars < 5) throw importError('scanned', 'no text layer');
  /* each visual line -> cells; a gap wider than ~0.8 x the font height starts a new cell (a table column) */
  const rows = lines.map(L=>{ L.items.sort((a,b)=>a.x-b.x); const cs = []; let prevEnd = null;
    L.items.forEach(it=>{ if(prevEnd!=null && it.x-prevEnd <= Math.max(6, it.h*0.8)){ const c = cs[cs.length-1]; c.s += (it.x-prevEnd>1 ? ' ' : '') + it.s; } else cs.push({x:it.x, s:it.s}); prevEnd = it.x + it.w; });
    return cs; });
  const hi = rows.findIndex(r=>r.length>=2); if(hi<0) throw importError('struct', 'no table structure');
  const head = rows[hi], headers = head.map(c=>c.s), hx = head.map(c=>c.x), recs = [];
  const colOf = x=>{ let k = 0; hx.forEach((v,i)=>{ if(v <= x+8) k = i; }); return k; };
  rows.slice(hi+1).forEach(r=>{
    if(r.length===headers.length && r.every((c,i)=>c.s.toLowerCase()===headers[i].toLowerCase())) return;      // header repeated on the next page
    if(r.length===1){ const k = colOf(r[0].x); if(k>0 && recs.length){ const last = recs[recs.length-1]; last[headers[k]] = (last[headers[k]]+' '+r[0].s).trim(); } return; }   // wrapped text continues the previous row; stray single cells (page numbers) are skipped
    const o = {}; headers.forEach(h=>o[h]=''); r.forEach(c=>{ const h = headers[colOf(c.x)]; o[h] = (o[h]+' '+c.s).trim(); }); recs.push(o);
  });
  return {headers, records:recs};
}

/* ---- UI: select module + file -> validate -> preview -> confirm ---- */
function renderImportPanel(){
  const box = document.getElementById('import-panel');
  if(!box) return;
  box.innerHTML = `
    <div class="panel" style="margin-bottom:18px;">
      <div class="panel-head">
        <div><h3>Data Import</h3><div class="panel-sub">Upload a weekly CSV export from Microsoft Defender, SCCM, Kaspersky or Trend Micro Vision One to update the matching sample data</div></div>
        <button class="btn btn-primary btn-sm" onclick="openImportCsv()">${ICONS.upload} Import</button>
      </div>
      <div class="form-hint" style="margin-bottom:14px;">Prototype only &mdash; the CSV is read in your browser and never leaves this device. The production system will read these exports via a local server and database instead of browser storage.</div>
      <div class="section-label">Import history</div>
      <div class="table-scroll">
        <table><thead><tr><th>Date/Time</th><th>User</th><th>Role</th><th>Module</th><th>File</th><th>Records</th><th>Status</th><th>Action</th></tr></thead>
        <tbody id="import-history-tbody"></tbody></table>
      </div>
    </div>`;
  renderImportHistory();
  loadGeneralImportsFromMySQL();
}

/* Hydrate General Data Import history/viewer from MySQL on every panel render.
   The existing prototype stores other modules in localStorage; General imports are DB-backed. */
async function loadGeneralImportsFromMySQL(){
  try{
    const response = await fetch('http://127.0.0.1:5000/api/import-batches?module_key=general');
    if(!response.ok) throw new Error('Import history API returned HTTP '+response.status);
    const result = await response.json();
    if(!result.success || !Array.isArray(result.batches)) throw new Error(result.message || 'Invalid import history response');

    // Replace only DB-backed General Data Import history. Keep other module history.
    importHistory = importHistory.filter(h => h.moduleKey !== 'general');
    const currentUser = getCurrentUser();
    const batches = result.batches;

    batches.forEach(batch => {
      const id = 'MYSQL-' + batch.id;
      const rawRows = Array.isArray(batch.records) ? batch.records : [];
      const records = rawRows.map(row => {
        if(row && row.data && typeof row.data === 'object') return row.data;
        if(row && typeof row.data === 'string'){
          try { const parsed = JSON.parse(row.data); return parsed && typeof parsed === 'object' ? parsed : {value: parsed}; }
          catch(_) { return {value: row.data}; }
        }
        if(row && typeof row === 'object') return row;
        return {};
      });
      const headers = Array.isArray(batch.columns) && batch.columns.length
        ? batch.columns
        : [...new Set(records.flatMap(record => Object.keys(record)))];

      const historyRecord = {
        id, timestamp: batch.imported_at || '', userId: currentUser.userId,
        userName: currentUser.name, role: currentUser.role, action: 'Database Import',
        module: 'General Data Import', moduleKey: 'general', fileName: batch.file_name || 'Imported file',
        recordCount: Number(batch.record_count || records.length), status: 'Imported',
        note: 'Loaded from MySQL', datasetId: id, columnCount: headers.length, duplicates: 0
      };
      importHistory.push(historyRecord);

      // Keep each MySQL batch under its own ID instead of retaining only the
      // newest general dataset. This makes every DB batch's View Data action work.
      if(records.length && headers.length){
        importDatasets[id] = {
          importId:id,
          columns:headers,
          rows:records.map(record => headers.map(header => record[header] == null ? '' : String(record[header])))
        };
      }
    });

    importHistory.sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    renderImportHistory();
  }catch(err){
    console.error('Could not load General Data Import from MySQL:', err);
    const tbody = document.getElementById('import-history-tbody');
    if(tbody && !importHistory.length){
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="e1">Unable to load database imports</div><div class="e2">Check Flask and open the browser console for details.</div></div></td></tr>`;
    }
  }
}

let pendingImport = null;
function openImportCsv(){
  openModal({
    title:'Import',
    body:`
      <div class="form-hint" style="margin-bottom:14px;">Choose a security tool to update its matching endpoint fields, or choose General Data Import to store a dataset with any column names. Supported formats: CSV, Excel, PDF or TXT. Nothing is saved until you review the preview and confirm. General Data Import sends the confirmed rows to your local Flask API and MySQL database.</div>
      <div class="form-grid">
        <div class="form-field full">
          <label>Import data for</label>
          
<select id="import-module"><optgroup label="Security tool exports">${IMPORT_MODULES.filter(m=>!m.entity).map(m=>`<option value="${m.key}">${esc(m.label)}</option>`).join('')}</optgroup>
  <optgroup label="Other data">
    <option value="general">General Data Import</option>
  </optgroup>
</select>

        </div>
        <div class="form-field full">
          <label>File</label>
          <input type="file" id="import-file" onchange="onImportFileChosen(this)">
          <div class="form-hint" id="import-file-hint">No file selected.</div>
        </div>
      </div>
      <div class="field-error" id="import-error"></div>
    `,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>`
  });
}
function onImportFileChosen(input){
  const file = input.files && input.files[0];
  const hint = document.getElementById('import-file-hint');
  const err = document.getElementById('import-error');
  err.classList.remove('show');
  if(!file) return;
  hint.textContent = file.name;
  const moduleKey = document.getElementById('import-module').value;
  const kind = detectImportType(file);                       // from file extension, then MIME type
  const inlineError = msg=>{ err.textContent = msg; err.classList.add('show'); };
  if(!kind){
    inlineError('Unsupported file format. The file could not be imported.');
    recordImportHistory({module:moduleLabelOf(moduleKey), moduleKey, fileName:file.name, recordCount:0, status:'Failed', note:'Unsupported file format'});
    return;
  }
  const noun = IMPORT_KIND_NOUN[kind];
  const failed = (note, msg)=>{ recordImportHistory({module:moduleLabelOf(moduleKey), moduleKey, fileName:file.name, recordCount:0, status:'Failed', note}); showImportFailed(file.name, moduleKey, msg); };
  const reader = new FileReader();
  reader.onerror = ()=>inlineError('This file could not be read. No data has been changed.');
  reader.onload = ()=>{
    Promise.resolve().then(()=>{
      if(kind==='csv') return parseCSV(String(reader.result||''));
      if(kind==='txt') return parseTxtTable(String(reader.result||''));
      if(kind==='xlsx' || kind==='xls') return parseXLSX(reader.result);
      return parsePDF(reader.result);
    }).then(parsed=>processImportParsed(moduleKey, file.name, parsed, kind)).catch(e=>{
      console.error('Import failed ('+kind+'):', e);          // real cause stays visible in the browser console
      const code = e && e.code;
      if(code==='scanned') failed('Unreadable PDF (no text)', 'Unable to extract readable data from this PDF. The PDF may be scanned or image-based.');
      else if(code==='struct' && kind==='pdf') failed('No table found in PDF', 'Unable to import this file. Required columns were not found.');
      else if(code==='struct') failed('No table structure in text file', 'Unable to detect structured data in this text file.');
      else if(kind==='pdf') failed('Unreadable PDF', 'Unable to read this PDF file. Please check that it is a valid, unprotected .pdf document.');
      else if(kind==='xlsx' || kind==='xls') failed('Unreadable Excel file', 'Unable to read this Excel file - it may be corrupted, password-protected, or not a real '+(kind==='xls' ? '.xls' : '.xlsx')+' workbook. No data has been changed.');
      else failed('Unreadable '+noun+' file', 'Unable to read this '+noun+' file.');
    });
  };
  if(kind==='csv' || kind==='txt') reader.readAsText(file); else reader.readAsArrayBuffer(file);
}
function processImportText(moduleKey, fileName, text){ processImportParsed(moduleKey, fileName, parseCSV(text), 'csv'); }
function processImportParsed(moduleKey, fileName, parsed, kind){
  const k0 = kind || detectImportType({name:fileName}) || 'csv';
  flexImport = (k0==='xlsx' || k0==='xls');
  try{ return processImportParsedCore(moduleKey, fileName, parsed, kind); } finally { flexImport = false; }
}
function processImportParsedCore(moduleKey, fileName, parsed, kind){
  kind = kind || detectImportType({name:fileName}) || 'csv';
  const {headers, records} = parsed, ft = IMPORT_KIND_NOUN[kind] || 'CSV', isEnt = !!importModule(moduleKey).entity;
  if(!headers.length || !records.length){
    recordImportHistory({module:moduleLabelOf(moduleKey), moduleKey, fileName, recordCount:0, status:'Failed', note:'Empty '+ft+' file'});
    showImportFailed(fileName, moduleKey, `This ${ft} file has no data rows.`);
    return;
  }
  // General Data Import accepts arbitrary headers and does not run security-tool validation.
  if(moduleKey==='general'){
    pendingImport = {module:'general', fileName, staged:records, duplicates:0, headers, records, kind, flex:flexImport, format:IMPORT_FORMAT_LABELS[kind]||''};
    showGeneralImportPreview();
    return;
  }
  const check = validateCsvColumns(moduleKey, headers);
  if(!check.ok){
    recordImportHistory({module:moduleLabelOf(moduleKey), moduleKey, fileName, recordCount:0, status:'Failed', note:'Missing required column(s): '+check.missing.join(', ')});
    if(flexImport) return showImportFailed(fileName, moduleKey, `No column identifying the device (Hostname, Computer Name, Device Name, Asset Name, Server Name or similar) could be recognised in this ${ft} file, so the rows cannot be matched to assets.<br><span class="form-hint">Columns found: <b>${esc(headers.join(', '))}</b></span>`);
    showImportFailed(fileName, moduleKey, isEnt
      ? `Unable to import this file. Required columns were not found.<br><span class="form-hint">Missing: <b>${esc(check.missing.join(', '))}</b></span>`
      : `Required column${check.missing.length>1?'s':''} missing from this ${ft} file: <b>${esc(check.missing.join(', '))}</b>.`);
    return;
  }
  const {staged, duplicates} = stageImportRows(moduleKey, headers, records);
  if(!staged.length){
    recordImportHistory({module:moduleLabelOf(moduleKey), moduleKey, fileName, recordCount:0, status:'Failed', note:'No rows with a valid '+(isEnt?'name':'hostname')});
    showImportFailed(fileName, moduleKey, `No rows with a valid ${isEnt?'name':'hostname'} were found in this ${ft} file.`);
    return;
  }
  pendingImport = {module:moduleKey, fileName, staged, duplicates, headers, records, kind, flex:flexImport, format:IMPORT_FORMAT_LABELS[kind]||''};
  showImportPreview();
}
function showImportFailed(fileName, moduleKey, message){
  openModal({
    title:'Import failed',
    body:`<div class="confirm-body" style="color:var(--red);font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px;">${ICONS.warn} Import failed</div>
      <div class="form-hint" style="margin-bottom:10px;font-size:13px;color:var(--text);">${message}</div>
      <div class="form-hint">File: <b>${esc(fileName)}</b> &middot; Module: <b>${esc(moduleLabelOf(moduleKey))}</b></div>
      <div class="form-hint" style="margin-top:10px;">No data has been changed. Existing ${esc(moduleLabelOf(moduleKey))} data is intact.</div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="closeModal();openImportCsv();">Try another file</button>`
  });
  showToast('Import failed &mdash; see details', 'error');
  renderImportHistory();
}
function showGeneralImportPreview(){
  const p = pendingImport;
  if(!p) return;
  const sample = p.records.slice(0,5);
  const headers = p.headers;
  openModal({
    title:'Preview General Data Import',
    wide:true,
    body:`
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="detail-row"><span class="k">Import type</span><span class="v">General Data Import</span></div>
        <div class="detail-row"><span class="k">File name</span><span class="v">${esc(p.fileName)}</span></div>
        <div class="detail-row"><span class="k">Format</span><span class="v">${esc(p.format||'')}</span></div>
        <div class="detail-row"><span class="k">Records detected</span><span class="v">${p.records.length}</span></div>
        <div class="detail-row"><span class="k">Columns detected</span><span class="v">${headers.length}</span></div>
        <div class="detail-row"><span class="k">Import date/time</span><span class="v">${fmtDateTime(nowIso())}</span></div>
      </div>
      <div class="iv-cols"><b>Detected columns:</b> ${headers.map(h=>esc(h)||'(blank)').join(' &middot; ')}</div>
      <div class="section-label">Preview (first ${sample.length} of ${p.records.length} records)</div>
      <div class="table-scroll" style="max-height:300px;overflow:auto;margin-bottom:10px;">
        <table><thead><tr>${headers.map(h=>`<th>${esc(h)||'(blank)'}</th>`).join('')}</tr></thead>
        <tbody>${sample.map(r=>`<tr>${headers.map(h=>`<td>${esc(r[h]==null?'':String(r[h]))}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </div>
      <div class="form-hint">This import keeps the original column names and values. It will be saved as a separate General Data Import dataset; it will not override endpoint security status or change Defender, SCCM, Kaspersky, Trend Micro, or main-entity datasets. Confirming requires the local Flask API and MySQL database to be running.</div>`,
    footer:`<button class="btn btn-secondary" onclick="cancelImport()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmImport()">${ICONS.check} Save to MySQL</button>`
  });
}
function showImportPreview(){
  if(!pendingImport) return;
  if(pendingImport.module==='general') return showGeneralImportPreview();
  if(importModule(pendingImport.module).entity) return showEntityPreview();
  const p = pendingImport, m = importModule(p.module), user = getCurrentUser();
  const sampleRows = p.staged.slice(0,5);
  const fieldLabel = {defender:'Status', kaspersky:'Status', trendmicro:'Risk level', sccm:'Installed / Applicable'}[p.module];
  const fieldVal = r => p.module==='sccm' ? (r.patch ? `${r.patch.installed} / ${r.patch.applicable}` : '—') : (r[p.module]!==undefined ? r[p.module] : '—');
  openModal({
    title:'Preview import', wide:true,
    body:`
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="detail-row"><span class="k">Module</span><span class="v">${esc(m.label)}</span></div>
        <div class="detail-row"><span class="k">File name</span><span class="v">${esc(p.fileName)}</span></div>
        <div class="detail-row"><span class="k">Format</span><span class="v">${esc(p.format||"")}</span></div>
        <div class="detail-row"><span class="k">Records detected</span><span class="v">${p.staged.length}${p.duplicates?` (${p.duplicates} duplicate hostname row(s) &mdash; last value kept)`:''}</span></div>
        <div class="detail-row"><span class="k">Import date/time</span><span class="v">${fmtDateTime(nowIso())} (browser time)</span></div>
        <div class="detail-row"><span class="k">Imported by</span><span class="v">${esc(user.name)} &middot; ${esc(user.role)}</span></div>
      </div>
      <div class="section-label">Preview (first ${sampleRows.length} of ${p.staged.length} records)</div>
      <div class="table-scroll" style="max-height:220px;overflow-y:auto;margin-bottom:10px;">
        <table><thead><tr><th>Hostname</th><th>${fieldLabel}</th></tr></thead>
        <tbody>${sampleRows.map(r=>`<tr><td>${esc(r.hostname)}</td><td>${esc(fieldVal(r))}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="form-hint">Confirming will replace ${esc(m.label)} data on every matching endpoint (by hostname) with the values from this file, and add any new hostnames as additional endpoints. Existing data stays unchanged until you confirm.${p.module==='defender' ? ' For Defender, optional Risk Level, Exposure Level, Domain/Workgroup, Domain Name, IP and Location columns also update the Defender EDR view (prototype mapping &mdash; real column names to be confirmed).' : ''}${p.module==='sccm' ? ' For SCCM, optional IP Address, Compliance State / Patch Status, Location, Pending Reboot and SCCM Client Status columns also update the SCCM Patch Management view (prototype mapping &mdash; real column names to be confirmed).' : ''}</div>
    `,
    footer:`<button class="btn btn-secondary" onclick="cancelImport()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmImport()">${ICONS.check} Confirm import</button>`
  });
}
function cancelImport(){
  const p = pendingImport;
  if(p) recordImportHistory({module:moduleLabelOf(p.module), moduleKey:p.module, fileName:p.fileName, recordCount:p.staged.length, status:'Cancelled'});
  pendingImport = null;
  closeModal();
  showToast('Import cancelled &mdash; existing data unchanged.', 'ok');
}
async function confirmImport(){
  flexImport = !!(pendingImport && pendingImport.flex);
  try{ return await confirmImportCore(); } finally { flexImport = false; }
}
async function confirmGeneralImport(){
  const p = pendingImport;
  if(!p) return;
  const user = getCurrentUser();
  try{
    const response = await fetch('http://127.0.0.1:5000/api/import-excel', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        moduleKey:'general',
        fileName:p.fileName,
        records:p.records
      })
    });
    const result = await response.json().catch(()=>({}));
    if(!response.ok || result.success===false){
      throw new Error(result.message || result.error || `MySQL API request failed (${response.status})`);
    }

    // Only record a successful import in the dashboard after the API accepts it.
    const rec = recordImportHistory({
      module:'General Data Import',
      moduleKey:'general',
      fileName:p.fileName,
      recordCount:p.records.length,
      status:'Imported',
      columnCount:p.headers.length,
      duplicates:0,
      note:'Saved to the local Flask API/MySQL database.'
    });
    saveImportedDataset(rec, 'general', p.headers, p.records);
    // Merge inventory columns into the shared endpoint list without inventing security statuses.
    const headerMap = {};
    p.headers.forEach(h => { headerMap[String(h).toLowerCase().replace(/[^a-z0-9]/g,'')] = h; });
    const pick = (row, keys) => { for(const key of keys){ const h=headerMap[key]; if(h && row[h]!=null && String(row[h]).trim()!=='') return String(row[h]).trim(); } return ''; };
    p.records.forEach(row => {
      const hostname = pick(row, ['name','hostname','devicename','computername','assetname']);
      if(!hostname) return;
      let endpoint = endpoints.find(e => String(e.id||'').toUpperCase()===hostname.toUpperCase());
      if(!endpoint){ endpoint={id:hostname, os:'Unknown', defender:'Unknown', kaspersky:'Unknown', trendmicro:'Unknown', sccm:'Unknown', patch:null, config:{}, lastSync:{}}; endpoints.push(endpoint); }
      const os = pick(row, ['os','operatingsystem','osname','osversion']); if(os) endpoint.os=os;
      const ip = pick(row, ['ipaddress','ip','ipv4','ipv4address']); if(ip){ ensureExt(endpoint); endpoint.ext.ip=ip; }
      const group = pick(row, ['fullgroupname','groupname','group','domain']); if(group){ ensureExt(endpoint); endpoint.ext.groupName=group; }
    });
    deriveAll();
    writeStore('fgv_endpoints_override', endpoints);
    refreshViews();
    auditLog('Data Import', 'General dataset saved from '+p.fileName+' ('+p.records.length+' rows) by '+user.name);
    pendingImport = null;
    closeModal();
    renderImportPanel();
    showToast('General data saved to MySQL. Reloading the database-backed import list…', 'ok');
  }catch(err){
    console.error('General data import failed:', err);
    showToast('Could not save General Data Import to MySQL. Check that Flask is running on port 5000 and that /api/import-excel is available. No successful import was recorded.', 'error');
    const hint = document.getElementById('general-import-error');
    if(hint) hint.textContent = err.message || 'Request failed';
  }
}
async function confirmImportCore(){
  if(pendingImport && pendingImport.module==='general') return confirmGeneralImport();
  if(pendingImport && importModule(pendingImport.module).entity) return confirmEntityImport();
  const p = pendingImport;
  if(!p) return;
  const m = importModule(p.module), user = getCurrentUser();

  // Capture the hostname header while Excel's flexible header matching is active.
  const hostH = findHeaderFor(p.headers, m.hostnameKeys);
  const rawRecords = p.records.filter(r => hostH && String(r[hostH] == null ? '' : r[hostH]).trim());

  // Persist security-tool imports to MySQL BEFORE updating the visible endpoint data.
  // This keeps a failed API request from looking like a successful import.
  try{
    const response = await fetch('http://127.0.0.1:5000/api/import-excel', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        moduleKey:p.module,
        fileName:p.fileName,
        records:rawRecords
      })
    });
    const result = await response.json().catch(()=>({}));
    if(!response.ok || result.success===false){
      throw new Error(result.message || result.error || `MySQL API request failed (${response.status})`);
    }

    // Keep the API batch identifier for traceability in the local import history.
    const note = `Saved to MySQL (batch ${result.batchId}).`;
    overrideDataset(p.module, p.staged);
    auditLog('Data Override', moduleLabelOf(p.module)+' dataset imported from '+p.fileName+' ('+p.staged.length+' rows)');
    const rec = recordImportHistory({
      module:m.label, moduleKey:p.module, fileName:p.fileName,
      recordCount:p.staged.length, status:'Imported',
      columnCount:p.headers.length, duplicates:p.duplicates, note
    });
    rec.mysqlBatchId = result.batchId;
    persistImportHistory();
    saveImportedDataset(rec, p.module, p.headers, rawRecords);
    pendingImport = null;
    closeModal();
    refreshViews();
    showToast(`${esc(m.label)} data saved to MySQL and applied to matching endpoints. ${p.staged.length} records processed.`, 'ok');
  }catch(err){
    console.error(`${m.label} import failed:`, err);
    showToast(`Could not save ${esc(m.label)} import to MySQL. Existing dashboard data was not changed. Check Flask on port 5000 and try again.`, 'error');
    const hint = document.getElementById('general-import-error');
    if(hint) hint.textContent = err.message || 'Request failed';
  }
}

/* Restore the newest saved security-tool batch after reload. Older prototype
   imports remain available in localStorage and are used only when MySQL has no
   batch for that module. This never deletes or replaces any database records. */
async function restoreSecurityToolImportsFromMySQL(){
  const keys = ['defender','sccm','kaspersky','trendmicro'];
  let applied = 0;
  for(const key of keys){
    try{
      const response = await fetch(`http://127.0.0.1:5000/api/import-batches?module_key=${encodeURIComponent(key)}`);
      if(!response.ok) throw new Error(`API ${response.status}`);
      const result = await response.json();
      const batches = Array.isArray(result.batches) ? result.batches : [];
      const batch = batches[0]; // API returns newest first
      if(batch && Array.isArray(batch.records) && batch.records.length){
        const records = batch.records.map(row => {
  if (!row || row.data == null) return {};

  if (typeof row.data === 'object' && !Array.isArray(row.data)) {
    return row.data;
  }

  if (typeof row.data === 'string') {
    try {
      const parsed = JSON.parse(row.data);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch (error) {
      console.warn('Could not parse imported record:', error);
      return {};
    }
  }

  return {};
});
        const headers = [...new Set(records.flatMap(r=>Object.keys(r)))];
        if(headers.length){
          flexImport = /\.(xlsx|xls)$/i.test(String(batch.file_name||''));
          try{
            const stagedResult = stageImportRows(key, headers, records);
            const staged = Array.isArray(stagedResult) ? stagedResult : stagedResult.staged;
            if(staged && staged.length){
              overrideDataset(key, staged);
              applied++;
            } else {
              console.warn(`Saved ${key} batch ${batch.id} contained no rows with a recognized hostname; it was left untouched.`);
            }
          } finally { flexImport = false; }
        }
      } else {
        // Compatibility fallback for imports made before security-tool batches were saved in MySQL.
        const legacy = importDatasets[key];
        if(legacy && Array.isArray(legacy.columns) && Array.isArray(legacy.rows)){
          const records = legacy.rows.map(row=>{
            const obj={}; legacy.columns.forEach((h,i)=>obj[h]=row[i]==null?'':String(row[i])); return obj;
          });
          flexImport = !!(legacy.columns.length && /\.(xlsx|xls)$/i.test(String((importHistory.find(h=>h.id===legacy.importId)||{}).fileName||'')));
          try{
            const stagedResult = stageImportRows(key, legacy.columns, records);
            const staged = Array.isArray(stagedResult) ? stagedResult : stagedResult.staged;
            if(staged && staged.length){ overrideDataset(key, staged); applied++; }
          } finally { flexImport = false; }
        }
      }
    }catch(err){
      // Do not block dashboard rendering if the local API is temporarily unavailable.
      console.warn(`Could not restore ${key} imports from MySQL:`, err);
    }
  }
  if(applied) refreshViews();
}

// Run after page scripts and the initial endpoint array have loaded.
if(document.readyState==='complete'){
  restoreSecurityToolImportsFromMySQL();
}else{
  window.addEventListener('load', restoreSecurityToolImportsFromMySQL, {once:true});
}

