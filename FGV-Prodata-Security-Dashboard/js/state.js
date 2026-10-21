/* =====================================================================
   4. APPLICATION STATE — profile (persisted), preferences, UI filters
===================================================================== */
const DEFAULT_PROFILE = {
  name:'Ainaa Rahim',
  role:'IT Security Analyst',
  org:'FGV Prodata',
  email:'ainaa.rahim@fgvholdings.com',
  phone:'+60 12-345 6789',
  status:'Active',
  lastLogin:null,   // set from the browser clock on every successful login
  created:null,     // generated once on first run, then kept in localStorage
};
let profile = Object.assign({}, DEFAULT_PROFILE, readStore('fgv_profile', {}));
function persistProfile(){ writeStore('fgv_profile', profile); }
function ensureAccountCreated(){
  if(!profile.created){ profile.created = nowIso(); persistProfile(); }
}

let dashboardViewedAt = null;                        // browser time of last dashboard render / refresh
let endpointFlag = null;                             // extra endpoint filter: {type:'vulnerable'|'patchAttention'|'control', key}
let vulnWeekFilter = null;                           // {start: Date, end: Date}
let hardeningFilter = 'all';                         // all | compliant | attention | noncompliant

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

