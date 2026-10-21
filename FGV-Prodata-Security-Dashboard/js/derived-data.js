/* =====================================================================
   3b. DERIVED DATA — every computed number lives here
===================================================================== */
/* ---- Prototype/mock endpoint attributes (Step 2) --------------------
   FGV does not necessarily export these fields; they exist only so the
   Endpoint Configuration checklist has something to show. They live in
   ONE optional object on the existing endpoint record (e.ext), are filled
   deterministically from the hostname when missing (so CSV-added endpoints
   and older saved data keep working), and never override real values. ---- */

function ensureExt(e){
  if(!e.ext || typeof e.ext!=='object') e.ext = {};
  // Real-data mode: do not generate dummy IPs, domains, locations, exposure or agent status.
}
function deriveEndpoint(e){
  ensureExt(e);
  const patch = e.patch && typeof e.patch==='object' ? e.patch : null;
  const hasPatchCounts = !!patch && patch.applicable != null && patch.installed != null;
  if(hasPatchCounts){
    const applicable = Math.max(0, Number(patch.applicable)||0);
    const installed = Math.min(applicable, Math.max(0, Number(patch.installed)||0));
    e.patchCompliance = applicable > 0 ? Math.round(installed/applicable*100) : null;
    e.missingUpdates = applicable - installed;
    const cs = e.ext.complianceState;
    e.sccmState = (cs==='Unknown' || cs==='Compliant' || cs==='Non-Compliant') ? cs
      : (applicable > 0 ? (e.patchCompliance >= PATCH_SLA_THRESHOLD ? 'Compliant' : 'Non-Compliant') : 'Unknown');
    e.sccm = e.sccmState==='Compliant' ? 'Compliant' : (e.sccmState==='Non-Compliant' ? 'Non-Compliant' : 'Unknown');
  } else {
    e.patchCompliance = null;
    e.missingUpdates = null;
    e.sccmState = e.ext.complianceState || 'Unknown';
    e.sccm = e.sccmState==='Compliant' ? 'Compliant' : (e.sccmState==='Non-Compliant' ? 'Non-Compliant' : 'Unknown');
  }
  e.vulnCount = vulnerabilities.filter(v=>v.endpoint===e.id && v.status!=='Resolved').length;
  const hasConfigData = !!e.config && Object.values(e.config).some(v=>typeof v==='boolean');
  e.passedControls = hasConfigData ? hardeningControls.filter(c=>c.check(e)).length : null;
  e.hardening = hasConfigData && hardeningControls.length ? Math.round(e.passedControls / hardeningControls.length * 100) : null;
  const last = maxDate(Object.values(e.lastSync||{}));
  e.lastSeen = last ? last.toISOString() : null;
}
function deriveAll(){ endpoints.forEach(deriveEndpoint); }

function computeOverall(e){
  const known = [e.defender, e.sccm, e.kaspersky, e.trendmicro].some(v=>v && v!=='Unknown');
  if(!known) return 'Unknown';
  if(e.defender==='Offline') return 'Offline';
  const risky = [e.defender==='At Risk', e.sccm==='Non-Compliant', e.kaspersky==='At Risk',
                 e.trendmicro==='High Risk', e.trendmicro==='Critical Risk'];
  const riskCount = risky.filter(Boolean).length;
  if(e.trendmicro==='Critical Risk' || riskCount>=3) return 'Critical';
  if(riskCount>=1) return 'Attention Required';
  return 'Protected';
}
function overallCounts(){
  const c = {Protected:0,'Attention Required':0,Critical:0,Offline:0};
  endpoints.forEach(e=> c[computeOverall(e)]++ );
  return c;
}
/* Fleet hardening score = passed control checks / all control checks.
   Identical to the average of per-control compliance, so the dashboard
   ring, dashboard KPI and Security Hardening page always agree. */
function fleetHardeningScore(){
  const total = endpoints.length * hardeningControls.length;
  if(!total) return 0;
  return Math.round(endpoints.reduce((s,e)=>s+e.passedControls,0) / total * 100);
}
function complianceBand(p){ return p>=85 ? 'compliant' : p>=65 ? 'attention' : 'noncompliant'; }
function controlStats(c){
  const failing = endpoints.filter(e=>!c.check(e));
  const passing = endpoints.length - failing.length;
  const compliance = pct(passing, endpoints.length);
  return {control:c, failing, passing, compliance, band:complianceBand(compliance),
    current:`Met on ${passing} of ${endpoints.length} endpoints`,
    remediationStatus: failing.length ? c.remediationStatus : 'Completed'};
}
function vulnSeverityCounts(list){
  const c = {Critical:0,High:0,Medium:0,Low:0};
  (list||vulnerabilities).forEach(v=>{ if(c[v.severity]!=null) c[v.severity]++; });
  return c;
}
function unresolvedCritical(){ return vulnerabilities.filter(v=>v.severity==='Critical' && v.status!=='Resolved').length; }

function toolAffected(t){ return endpoints.filter(e=>t.affected.includes(e[t.field])); }
function toolStats(t){
  const affected = toolAffected(t);
  const last = maxDate(endpoints.map(e=>e.lastSync && e.lastSync[t.key]));
  return {
    tool:t, affected,
    healthy: endpoints.length - affected.length,
    lastUpdate: last ? last.toISOString() : null,
    openFindings: vulnerabilities.filter(v=>v.source===t.name && v.status!=='Resolved').length,
    count: val => endpoints.filter(e=>e[t.field]===val).length,
  };
}
function patchSummary(){
  const applicable = endpoints.reduce(
  (s, e) => s + Number(e.patch?.applicable ?? 0),
  0
);

const missing = endpoints.reduce(
  (s, e) => s + Number(e.missingUpdates ?? 0),
  0
);
  const latest = maxDate(endpoints.map(e=>e.lastSync && e.lastSync.sccm));
  const staleCutoff = latest ? latest.getTime() - STALE_CHECK_DAYS*86400000 : 0;
  const attention = endpoints.map(e=>{
    const reasons = [];
    if(e.sccm==='Non-Compliant') reasons.push(`Below ${PATCH_SLA_THRESHOLD}% SLA`);
    const chk = validDate(e.lastSync && e.lastSync.sccm);
    if(chk && chk.getTime() < staleCutoff) reasons.push(`No SCCM check in ${STALE_CHECK_DAYS}+ days`);
    return {e, reasons};
  }).filter(x=>x.reasons.length);
  return {
    compliancePct: applicable ? Math.round((applicable-missing)/applicable*100) : null,
    applicable, installed: applicable-missing, missing,
    compliant: endpoints.filter(e=>e.sccm==='Compliant').length,
    nonCompliant: endpoints.filter(e=>e.sccm==='Non-Compliant').length,
    attention,
    lastCheck: latest ? latest.toISOString() : null,
  };
}
/* =====================================================================
   SCCM PATCH MANAGEMENT — single source of truth (supervisor formula)
   Problem             = Total Device - Compliant   |   Within Coverage = Total Device - Out of Coverage
   Problem to Resolve  = Problem - Out of Coverage
   Total Percentage    = Compliant / Within Coverage x 100   (Non-Compliant + State Unknown is a related breakdown only)
   Target              = 80%
   Every SCCM number on screen (SCCM page, Global Patching Rate, dashboard
   KPI, patch compliance view, tool card, report) comes from sccmSummary().
   Prototype rules only: not confirmed as the production SCCM schema/rules.
===================================================================== */
const SCCM_TARGET_PCT = 80;
/* Prototype rule (pending supervisor confirmation): an endpoint is outside SCCM coverage when its
   IP is a 192.168.x.x address or any other non-corporate/external (public) address. Private
   corporate ranges (10.x, 172.16-31.x) count as inside coverage. Change ONLY this function. */
function isOutOfCoverage(e){
  const ip = String((e.ext && e.ext.ip) || '').trim();
  if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;       // no valid IP: not classified as out of coverage
  if(ip.indexOf('192.168.')===0) return true;
  const a = +ip.split('.')[0], b = +ip.split('.')[1];
  const privateRange = a===10 || (a===172 && b>=16 && b<=31) || a===127 || (a===169 && b===254);
  return !privateRange;                                          // external / public IP
}
/* Assumption: an Out of Coverage asset is counted only when it is also Non-Compliant or State Unknown
   (assets outside coverage are assumed not to report as compliant). That keeps Out of Coverage a subset
   of Total Non-Compliant, so it is subtracted once and never exceeds the denominator. */
const SCCM_LISTS = {
  all:               {title:'Total Device',            test:e=>true},
  compliant:         {title:'Compliant',           test:e=>e.sccmState==='Compliant'},
  nonCompliant:      {title:'Non-Compliant',       test:e=>e.sccmState==='Non-Compliant'},
  unknown:           {title:'State Unknown',       test:e=>e.sccmState==='Unknown'},
  totalNonCompliant: {title:'Non-Compliant + State Unknown', test:e=>e.sccmState!=='Compliant'},
  outOfCoverage:     {title:'Out of Coverage',     test:e=>e.sccmState!=='Compliant' && isOutOfCoverage(e)},
  problem:           {title:'Problem to Resolve',         test:e=>e.sccmState!=='Compliant' && !isOutOfCoverage(e)},
};
SCCM_LISTS.pct = {title:'Total Percentage', test:e=>false, noList:true};   // calculation-only detail (no device list)
function sccmSummary(list){
  list = list || endpoints;
  const n = k => list.filter(SCCM_LISTS[k].test).length;
  const total = list.length, compliant = n('compliant'), nonCompliant = n('nonCompliant'), unknown = n('unknown');
  const totalNonCompliant = nonCompliant + unknown;
  const outOfCoverage = n('outOfCoverage');
  const problemAll = total - compliant;                    // Problem = Total Device - Compliant
  const within = total - outOfCoverage;                    // Within Coverage = Total Device - Out of Coverage
  const problem = problemAll - outOfCoverage;              // Problem to Resolve = Problem - Out of Coverage
  const denominator = within;
  const hasPatchEvidence = list.some(e=>e.patch && Number(e.patch.applicable)>0);
  const compliancePct = hasPatchEvidence && within > 0 ? compliant / within * 100 : null;   // Total Percentage = Compliant / Within Coverage x 100
  return {total, compliant, nonCompliant, unknown, totalNonCompliant, outOfCoverage, problemAll, within, problem, problemToResolve: problem, denominator,
    compliancePct, target: SCCM_TARGET_PCT, meetsTarget: compliancePct >= SCCM_TARGET_PCT,
    outsideIpCompliant: list.filter(e=>e.sccmState==='Compliant' && isOutOfCoverage(e)).length};
}
function fmtPct2(v){ return Number((+v||0).toFixed(2)) + '%'; }
function fmtPct2f(v){ return (+v||0).toFixed(2) + '%'; }   // always two decimals (SCCM Total Percentage)

function dataAsOf(){
  const d = maxDate(endpoints.flatMap(e=>Object.values(e.lastSync||{})));
  return d ? d.toISOString() : null;
}
function weekStart(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay()+6)%7));   // Monday
  return x;
}
/* Weekly count of NEW vulnerabilities by detected date, for the 8 weeks
   ending with the week of the most recent detection. */
function vulnTrendSeries(){
  const latest = maxDate(vulnerabilities.map(v=>v.detected)) || new Date();
  const end = weekStart(latest);
  const weeks = [];
  for(let i=7;i>=0;i--){
    const s = new Date(end); s.setDate(s.getDate() - i*7);
    const e = new Date(s); e.setDate(e.getDate() + 7);
    weeks.push({start:s, end:e, count:0});
  }
  vulnerabilities.forEach(v=>{
    const d = validDate(v.detected); if(!d) return;
    const w = weeks.find(w=> d >= w.start && d < w.end);
    if(w) w.count++;
  });
  return weeks;
}

