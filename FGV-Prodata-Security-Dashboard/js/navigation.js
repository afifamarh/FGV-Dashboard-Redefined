/* =====================================================================
   6. NAVIGATION — sidebar routing (goTo), page switching, global refresh
===================================================================== */
const NAV_ITEMS = [
  {key:'dashboard', label:'Dashboard', icon:'home'},
  {key:'endpoints', label:'Endpoint Security', icon:'monitor'},
  {key:'history', label:'Endpoint History', icon:'chart'},
  {key:'defender', label:'Microsoft Defender EDR', icon:'shieldPlain', tool:'defender'},
  {key:'sccm', label:'SCCM Patch Management', icon:'refresh', tool:'sccm'},
  {key:'vulnerabilities', label:'Vulnerability Management', icon:'bug'},
  {key:'hardening', label:'Security Hardening', icon:'sliders'},
  {key:'tools', label:'Security Tools', icon:'tool'},
  {key:'reports', label:'Reports', icon:'file'},
  {key:'settings', label:'Settings', icon:'gear'},
];
const PAGE_META = {
  dashboard:['Dashboard','Security posture overview'],
  endpoints:['Endpoint Security','Unified endpoint status from all four tools'],
  history:['Endpoint History','Centralized endpoint activity by role'],
  defender:['Microsoft Defender EDR','FGV endpoint protection, risk and exposure'],
  sccm:['SCCM Patch Management','Patch compliance, coverage and problems to resolve'],
  vulnerabilities:['Vulnerability Management','Track, prioritize and remediate findings'],
  hardening:['Security Hardening','Endpoint hardening posture and controls'],
  tools:['Security Tools','Microsoft Defender, SCCM, Kaspersky, Trend Micro Vision One'],
  reports:['Reports','Generate and export security reports'],
  settings:['Settings','Dashboard preferences'],
  users:['User Management','Admin account administration'],
};
let currentPage = 'dashboard';
function renderNav(){
  const nav = document.getElementById('nav');
  if(!nav) return;
  const session = (()=>{ try { return JSON.parse(localStorage.getItem('fgv_session') || sessionStorage.getItem('fgv_session') || 'null'); } catch (_) { return null; } })();
  const isAdminSession = !!session && session.role === 'admin' && !!session.apiToken;
  const items = NAV_ITEMS.filter(item=>!item.tool || canAccess(item.tool));
  if(isAdminSession) items.push({key:'users',label:'User Management',icon:'gear'});
  nav.innerHTML = items.map(item=>{
    let badge = '';
    if(item.key==='vulnerabilities'){
      const openCrit = unresolvedCritical();
      if(openCrit>0) badge = `<span class="nav-badge" title="${openCrit} unresolved critical vulnerabilities" onclick="event.stopPropagation();goTo('vulnerabilities',{severity:'Critical',status:'unresolved'})">${openCrit}</span>`;
    }
    return `<div class="nav-item ${item.key===currentPage?'active':''}" data-page="${item.key}" onclick="goTo('${item.key}')">${ICONS[item.icon]}<span>${item.label}</span>${badge}</div>`;
  }).join('');
}
function goTo(page, opts){
  if(page==='users'){
    const session = (()=>{ try { return JSON.parse(localStorage.getItem('fgv_session') || sessionStorage.getItem('fgv_session') || 'null'); } catch (_) { return null; } })();
    if(!session || session.role!=='admin' || !session.apiToken){ showToast('Admin access is required','warn'); return; }
  }
  const pageTool = {defender:'defender', sccm:'sccm', kaspersky:'kaspersky', trendmicro:'trendmicro'}[page];
  if(pageTool && !canAccess(pageTool)){ showToast('This page is not available for your role','warn'); page = 'dashboard'; opts = undefined; }
  currentPage = page;
  document.querySelectorAll('.page').forEach(p=>{ p.classList.remove('active'); p.hidden = (p.id !== 'page-'+page); });
  const targetPage = document.getElementById('page-'+page);
  if(!targetPage) return;
  targetPage.hidden = false;
  targetPage.classList.add('active');
  document.getElementById('topbar-title').textContent = PAGE_META[page][0];
  document.getElementById('topbar-sub').textContent = PAGE_META[page][1];
  closeNotifPanel();
  closeProfileMenu();
  closeSidebar();
  if(page==='endpoints') applyEndpointOptFilter(opts);
  if(page==='vulnerabilities') applyVulnOptFilter(opts);
  if(page==='hardening') hardeningFilter = (opts && opts.hardening) || 'all';
  deriveAll();
  renderNav();
  renderCurrentPage();
  window.scrollTo({top:0,behavior:'instant'});
}
function renderCurrentPage(){
  if(currentPage==='dashboard') renderDashboard();
  if(currentPage==='endpoints') renderEndpointsPage();
  if(currentPage==='history') renderHistoryPage();
  if(currentPage==='defender') renderDefenderPage();
  if(currentPage==='sccm') renderSccmPage();
  if(currentPage==='vulnerabilities') renderVulnPage();
  if(currentPage==='hardening') renderHardeningPage();
  if(currentPage==='tools') renderToolsPage();
  if(currentPage==='reports') renderReportsPage();
  if(currentPage==='settings') populateSettingsProfile();
}
/* Call after ANY data change: recomputes derived values, then refreshes
   the sidebar badge, notification bell and the page currently open. */
function refreshViews(){
  deriveAll();
  renderNav();
  renderNotifPanel();
  renderCurrentPage();
}

