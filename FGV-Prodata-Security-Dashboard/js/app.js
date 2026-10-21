/* =====================================================================
   20. EVENT LISTENERS — global header search
===================================================================== */
document.getElementById('global-search').addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){
    const q = e.target.value.trim();
    if(!q) return;
    const ql = q.toLowerCase();
    if(/^vuln/i.test(q) || roleVulns().some(v=>v.id.toLowerCase()===ql || v.description.toLowerCase().includes(ql)) && !endpoints.some(en=>en.id.toLowerCase().includes(ql))){
      goTo('vulnerabilities',{search:q});
    } else if(roleTools().some(t=>t.name.toLowerCase().includes(ql))){
      goTo('tools');
      openToolDetail(roleTools().find(t=>t.name.toLowerCase().includes(ql)).key);
    } else {
      goTo('endpoints');
      document.getElementById('endpoint-search').value = q;
      renderEndpointsPage();
    }
  }
});

/* =====================================================================
   20. EVENT LISTENERS — table search/filter inputs
===================================================================== */
ENDPOINT_FILTER_IDS.forEach(id=>{
  document.getElementById(id).addEventListener('input', renderEndpointsPage);
  document.getElementById(id).addEventListener('change', renderEndpointsPage);
});
VULN_FILTER_IDS.forEach(id=>{
  document.getElementById(id).addEventListener('input', renderVulnPage);
  document.getElementById(id).addEventListener('change', renderVulnPage);
});
let resizeTimer = null;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=> Object.values(charts).forEach(c=>c.resize()), 120);
});

/* =====================================================================
   20. EVENT LISTENERS — app bootstrap / initial render
===================================================================== */
ensureAccountCreated();
deriveAll();
(function fillLiveNotificationText(){
  const ps = patchSummary();
  const n3 = notifications.find(n=>n.id==='n3');
  if(n3) n3.desc = `${ps.nonCompliant} endpoint(s) below the ${PATCH_SLA_THRESHOLD}% patch SLA; ${ps.missing} updates missing`;
})();
document.documentElement.setAttribute('data-theme', uiTheme);
renderNav();
renderNotifPanel();
renderProfileMenu();
updateProfileEverywhere();
if(checkSession()){
  document.body.classList.remove('logged-out');
  goTo('dashboard');
} else {
  document.body.classList.add('logged-out');
  showAuthScreen({loggedOut:false});
}
