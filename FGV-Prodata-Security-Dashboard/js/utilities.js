/* =====================================================================
   Keep an untouched copy of the page source (before icons are injected
   and before anything is rendered) so "Copy source code" / "Download
   HTML" always hand over a clean, re-runnable file.
===================================================================== */
const PRISTINE_SOURCE = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

/* =====================================================================
   19. UTILITY FUNCTIONS — ICONS (inline SVG, single stroke style, reused throughout)
===================================================================== */
const ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:#EAF0FF;width:18px;height:18px;"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 10-3 6.7"/><path d="M21 4v6h-6"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  bug: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="12" rx="4"/><path d="M12 2v4M8 9H4M8 14H3M8 18l-3 3M16 9h4M16 14h5M16 18l3 3"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/></svg>`,
  tool: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 005.4-5.4l-2.8 2.8-2-2 2.8-2.8z"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019 9c.11.35.29.68.51.99"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  shieldPlain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0112 20c-7 0-11-8-11-8a19 19 0 015.1-5.9M9.9 4.2A10.6 10.6 0 0112 4c7 0 11 8 11 8a18.9 18.9 0 01-3.2 4.4M1 1l22 22"/><path d="M14.1 14.1a3 3 0 10-4.2-4.2"/></svg>`,
  radar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>`,
  shieldCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  downloadFile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 21h16"/></svg>`,
};
const AUTH_ICON = (icon)=> `<span class="auth-input-icon" style="position:absolute;left:12px;display:flex;">${icon}</span>`;
document.body.innerHTML = document.body.innerHTML
  .replaceAll('__ICON_SHIELD__', ICONS.shield)
  .replaceAll('__ICON_SEARCH__', ICONS.search)
  .replaceAll('__ICON_BELL__', ICONS.bell)
  .replaceAll('__ICON_REFRESH__', ICONS.refresh)
  .replaceAll('__ICON_PLUS__', ICONS.plus)
  .replaceAll('__ICON_CHEVRON__', ICONS.down)
  .replaceAll('__ICON_SHIELDPLAIN__', ICONS.shieldPlain)
  .replaceAll('__ICON_MENU__', ICONS.menu)
  .replaceAll('__ICON_CHECK__', ICONS.check)
  .replaceAll('__ICON_X__', ICONS.x)
  .replaceAll('__ICON_INFO__', ICONS.info)
  .replaceAll('__ICON_ARROWLEFT__', ICONS.arrowLeft)
  .replaceAll('__ICON_USER_INPUT__', AUTH_ICON(ICONS.user))
  .replaceAll('__ICON_LOCK_INPUT__', AUTH_ICON(ICONS.lock))
  .replaceAll('__ICON_MAIL_INPUT__', AUTH_ICON(ICONS.mail))
  .replaceAll('__ICON_EYE_TOGGLE__', ICONS.eye)
  .replaceAll('__ICON_SUN__', ICONS.sun)
  .replaceAll('__ICON_MOON__', ICONS.moon)
  .replaceAll('__ICON_COPY__', ICONS.copy)
  .replaceAll('__ICON_DOWNLOAD__', ICONS.downloadFile)
  .replaceAll('__ICON_SHARE__', ICONS.share);

/* =====================================================================
   19. UTILITY FUNCTIONS — dates, escaping, storage
   Sample security data uses STORED timestamps (ISO strings below).
   Real user events (login, report generation, new records) use the
   browser's actual current time. Nothing uses Math.random().
===================================================================== */
const pad2 = n => String(n).padStart(2,'0');
function toDate(v){
  if(v instanceof Date) return v;
  if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v+'T00:00:00');
  return new Date(v);
}
function validDate(v){ const d = toDate(v); return v && !isNaN(d) ? d : null; }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/* Deterministic formatting (same output in every browser/locale): 20 Sep 2026, 08:12 */
function fmtDate(v){
  const d = validDate(v); if(!d) return '&mdash;';
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtShortDate(d){ return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]}`; }
function fmtDateTime(v){
  const d = validDate(v); if(!d) return '&mdash;';
  return `${fmtDate(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtRelative(v){
  const d = validDate(v); if(!d) return '&mdash;';
  const diff = Date.now() - d.getTime();
  if(diff >= 0 && diff < 60000) return 'Just now';
  if(diff >= 0 && diff < 3600000) return Math.floor(diff/60000) + ' min ago';
  if(diff >= 0 && diff < 86400000) return Math.floor(diff/3600000) + ' hr ago';
  return fmtDateTime(d);
}
function nowIso(){ return new Date().toISOString(); }
function nowStamp(){ return fmtDateTime(new Date()); }
function todayLocal(){ const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function nowLocal(){ const d = new Date(); return `${todayLocal()}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function maxDate(values){
  let best = null;
  values.forEach(v=>{ const d = validDate(v); if(d && (!best || d > best)) best = d; });
  return best;
}
function esc(str){
  return String(str==null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function readStore(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(e){ return fallback; }
}
function writeStore(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); } catch(e){ /* storage unavailable: keep in memory */ }
}
function pct(part, whole){ return whole ? Math.round(part/whole*100) : 0; }

/* =====================================================================
   19. UTILITY FUNCTIONS — badges, toast
===================================================================== */
function overallBadge(status){
  const map = {
    'Protected': ['badge-green','check'],
    'Attention Required': ['badge-amber','warn'],
    'Critical': ['badge-red','warn'],
    'Offline': ['badge-slate','x'],
  };
  const [cls,icon] = map[status] || ['badge-slate','x'];
  return `<span class="badge ${cls}">${ICONS[icon]}${status}</span>`;
}
function statusBadge(val){
  const good = ['Protected','Compliant','Low Risk','Operational','Completed'];
  const bad = ['At Risk','Non-Compliant','High Risk','Critical Risk'];
  let cls = 'badge-green', icon='check';
  if(bad.includes(val)){ cls='badge-red'; icon='warn'; }
  else if(val==='Offline'){ cls='badge-slate'; icon='x'; }
  else if(!good.includes(val)){ cls='badge-amber'; icon='warn'; }
  return `<span class="badge ${cls}">${ICONS[icon]}${val}</span>`;
}
function severityBadge(sev){
  const map = {Critical:'badge-red', High:'badge-amber', Medium:'badge-blue', Low:'badge-slate'};
  return `<span class="badge ${map[sev]||'badge-slate'}">${sev}</span>`;
}
function vulnStatusBadge(s){
  const map = {Open:'badge-red', 'In Progress':'badge-amber', Resolved:'badge-green'};
  return `<span class="badge ${map[s]||'badge-slate'}">${s}</span>`;
}
function remediationBadge(s){
  const map = {'Completed':'badge-green', 'In Progress':'badge-amber', 'Not Started':'badge-red'};
  return `<span class="badge ${map[s]||'badge-slate'}">${s}</span>`;
}
function complianceColor(p){
  if(p>=85) return 'var(--green)';
  if(p>=65) return 'var(--amber)';
  return 'var(--red)';
}
function uid(prefix, list){
  let n = list.length + 1;
  let id;
  do{ id = prefix + '-' + String(n).padStart(3,'0'); n++; } while(list.some(x=>x.id===id));
  return id;
}
function showToast(msg, type){
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast' + (type==='error' ? ' error' : '');
  t.setAttribute('role','status');
  t.innerHTML = (type==='error' ? ICONS.x : ICONS.check) + `<span>${msg}</span>`;
  root.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(8px)'; t.style.transition='all .2s'; setTimeout(()=>t.remove(),200); }, 2800);
}

