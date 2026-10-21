/* =====================================================================
   13. NOTIFICATIONS — bell panel, read/unread, delete, clear all, category filtering
===================================================================== */
function visibleNotifications(){
  return notifications.filter(n => (!n.tool || canAccess(n.tool)) && (n.category==='general' || notifPrefs[n.category] !== false));
}
function renderNotifPanel(){
  const list = document.getElementById('notif-list');
  const visible = visibleNotifications();
  if(!visible.length){
    list.innerHTML = `<div class="empty-state">${ICONS.bell}<div class="e1">No notifications</div><div>${notifications.length ? 'The remaining notification types are turned off in Settings.' : 'You&rsquo;re all caught up.'}</div></div>`;
  } else {
    list.innerHTML = visible.map(n=>`
      <div class="notif-item ${n.read?'read':'unread'}" data-notif-id="${n.id}">
        <div class="notif-dot-ind"></div>
        <div class="notif-icon tone-${n.tone}" onclick="event.stopPropagation();openNotification('${n.id}')">${ICONS[n.icon]}</div>
        <div class="notif-text" onclick="openNotification('${n.id}')">
          <div class="n1">${n.title}</div><div class="n2">${n.desc}</div><div class="n2">${fmtRelative(n.at)}</div>
        </div>
        <button class="notif-delete" title="Delete notification" onclick="event.stopPropagation();deleteNotification('${n.id}')">${ICONS.close}</button>
      </div>
    `).join('');
  }
  const unread = visible.filter(n=>!n.read).length;
  const dot = document.getElementById('notif-dot');
  if(unread){ dot.style.display='flex'; dot.textContent = unread>9 ? '9+' : String(unread); }
  else { dot.style.display='none'; }
}
function openNotification(id){
  const n = notifications.find(x=>x.id===id);
  if(!n) return;
  n.read = true;
  closeNotifPanel();
  if(typeof n.action === 'function') n.action();
  renderNotifPanel();
}
function deleteNotification(id){
  notifications = notifications.filter(x=>x.id!==id);
  renderNotifPanel();
}
function clearAllNotifications(){
  notifications = [];
  renderNotifPanel();
  showToast('All notifications cleared','ok');
}
function toggleNotifPanel(){
  closeProfileMenu();
  document.getElementById('notif-panel').classList.toggle('open');
  renderNotifPanel();   // refresh relative times ("5 min ago")
}
function closeNotifPanel(){
  document.getElementById('notif-panel').classList.remove('open');
}
document.getElementById('notif-bell').addEventListener('click', (e)=>{ e.stopPropagation(); toggleNotifPanel(); });
document.getElementById('mark-all-read').addEventListener('click', ()=>{
  notifications.forEach(n=>n.read=true);
  renderNotifPanel();
  showToast('All notifications marked as read','ok');
});
document.addEventListener('click', (e)=>{
  const panel = document.getElementById('notif-panel');
  const bell = document.getElementById('notif-bell');
  if(panel.classList.contains('open') && !panel.contains(e.target) && !bell.contains(e.target)) closeNotifPanel();
});
document.getElementById('profile-trigger').addEventListener('click', (e)=>{ e.stopPropagation(); closeNotifPanel(); toggleProfileMenu(); });
document.addEventListener('click', (e)=>{
  const menu = document.getElementById('profile-menu');
  const trigger = document.getElementById('profile-trigger');
  if(menu.classList.contains('open') && !menu.contains(e.target) && !trigger.contains(e.target)) closeProfileMenu();
});

