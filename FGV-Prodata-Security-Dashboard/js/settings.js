/* =====================================================================
   15. SETTINGS — theme + notification preferences (persisted)
===================================================================== */
let uiTheme = localStorage.getItem('fgv_theme') || 'light';
let notifPrefs = Object.assign({security:true, vulnerability:true, endpoint:true}, readStore('fgv_notif_prefs', {}));
localStorage.removeItem('fgv_density');   // layout density was removed; clear any old saved value
/* Optional SCCM KPI cards: hidden by default, switched on in Settings (persisted like the other preferences). */
const SCCM_KPI_OPTIONAL = [['currentCompliance','Current Compliance'], ['target','Target'], ['pendingReboot','Pending Reboot'], ['deploymentSuccess','Deployment Success Rate'], ['hostnameMismatch','Hostname Mismatch']];
let sccmKpiPrefs = Object.assign({currentCompliance:false, target:false, pendingReboot:false, deploymentSuccess:false, hostnameMismatch:false}, readStore('fgv_sccm_kpi_prefs', {}));
function syncSccmKpiToggles(){
  SCCM_KPI_OPTIONAL.forEach(([k])=>{ const el = document.getElementById('sccm-kpi-pref-'+k); if(el){ el.checked = !!sccmKpiPrefs[k]; el.setAttribute('aria-checked', sccmKpiPrefs[k] ? 'true' : 'false'); } });
  const wrap = document.getElementById('sccm-kpi-settings'); if(wrap) wrap.style.display = canAccess('sccm') ? '' : 'none';
}
function setSccmKpiPref(key, val){
  sccmKpiPrefs[key] = !!val;
  writeStore('fgv_sccm_kpi_prefs', sccmKpiPrefs);
  syncSccmKpiToggles();
  if(document.getElementById('sccm-kpis')) renderSccmPage();
  const label = (SCCM_KPI_OPTIONAL.find(x=>x[0]===key)||[])[1] || key;
  showToast(`${label} card ${val ? 'shown' : 'hidden'}`,'ok');
}

/* Optional Kaspersky KPI cards (At Risk / Offline): shown by default, can be hidden in Settings (same pattern as the SCCM KPI preferences). */
const KAS_KPI_OPTIONAL = [['atRisk','At Risk'], ['offline','Offline']];
let kasKpiPrefs = Object.assign({atRisk:true, offline:true}, readStore('fgv_kas_kpi_prefs', {}));
function syncKasKpiToggles(){
  KAS_KPI_OPTIONAL.forEach(([k])=>{ const el = document.getElementById('kas-kpi-pref-'+k); if(el){ el.checked = !!kasKpiPrefs[k]; el.setAttribute('aria-checked', kasKpiPrefs[k] ? 'true' : 'false'); } });
  const wrap = document.getElementById('kas-kpi-settings'); if(wrap) wrap.style.display = canAccess('kaspersky') ? '' : 'none';
}
function setKasKpiPref(key, val){
  kasKpiPrefs[key] = !!val;
  writeStore('fgv_kas_kpi_prefs', kasKpiPrefs);
  syncKasKpiToggles();
  if(document.getElementById('kas-root')) renderKasPage();
  const label = (KAS_KPI_OPTIONAL.find(x=>x[0]===key)||[])[1] || key;
  showToast(`${label} card ${val ? 'shown' : 'hidden'}`,'ok');
}

function applyTheme(theme){
  uiTheme = (theme === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', uiTheme);
  localStorage.setItem('fgv_theme', uiTheme);
  updateThemeControlsUI();
  if(currentPage==='dashboard') renderDashboardCharts();
  if(currentPage==='hardening') renderHardeningChart();
}
function updateThemeControlsUI(){
  document.querySelectorAll('#theme-segmented [data-theme-btn]').forEach(b=>{
    b.classList.toggle('active', b.dataset.themeBtn === uiTheme);
    b.setAttribute('aria-pressed', b.dataset.themeBtn === uiTheme ? 'true' : 'false');
  });
}
function syncNotifToggles(){
  ['security','vulnerability','endpoint'].forEach(k=>{
    const el = document.getElementById('notif-pref-'+k);
    if(el){ el.checked = !!notifPrefs[k]; el.setAttribute('aria-checked', notifPrefs[k] ? 'true' : 'false'); }
  });
}
function setNotifPref(key, val){
  notifPrefs[key] = !!val;
  writeStore('fgv_notif_prefs', notifPrefs);
  syncNotifToggles();
  renderNotifPanel();
  const label = {security:'Security alerts', vulnerability:'Vulnerability alerts', endpoint:'Endpoint alerts'}[key];
  showToast(`${label} turned ${val ? 'on' : 'off'}`,'ok');
}
function saveSettings(){
  localStorage.setItem('fgv_theme', uiTheme);
  writeStore('fgv_notif_prefs', notifPrefs);
  writeStore('fgv_sccm_kpi_prefs', sccmKpiPrefs); writeStore('fgv_kas_kpi_prefs', kasKpiPrefs); showToast('Settings saved','ok');
}
function pushNotification({icon, tone, category, title, desc, action}){
  notifications.unshift({id:'n'+(notifSeq++), icon, tone, category:category||'general', title, desc, at:nowIso(), read:false, action:action||null});
  renderNotifPanel();
}

