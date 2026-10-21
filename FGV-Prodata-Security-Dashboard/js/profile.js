/* =====================================================================
   14. PROFILE — auto initials avatar, view / edit / reset, validation
===================================================================== */
/* "Ainaa Rahim" -> "AR", "John Smith" -> "JS", "Ainaa" -> "A",
   "Nur Ainaa Rahim" -> "NR" (first + last name). */
function initials(name){
  const parts = String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  const first = parts[0].charAt(0);
  if(parts.length===1) return first.toUpperCase();
  return (first + parts[parts.length-1].charAt(0)).toUpperCase();
}
function applyAvatar(el, name, sizeClass){
  if(!el) return;
  el.className = 'avatar' + (sizeClass ? ' '+sizeClass : '');
  el.textContent = initials(name);
  el.setAttribute('aria-label', 'Avatar for ' + (name||'user'));
}
function updateProfileEverywhere(){
  applyAvatar(document.getElementById('topbar-avatar'), profile.name);
  document.getElementById('topbar-name').textContent = profile.name;
  document.getElementById('topbar-role').textContent = checkSession() ? ROLE_LABELS[getSessionRole()] : profile.role;
  populateSettingsProfile();
}
function populateSettingsProfile(){
  applyAvatar(document.getElementById('settings-avatar'), profile.name, 'avatar-lg');
  const set = (id, val, html)=>{ const el = document.getElementById(id); if(el){ if(html) el.innerHTML = val; else el.textContent = val; } };
  set('settings-name', profile.name);
  set('settings-role', profile.role);
  set('settings-email', profile.email);
  set('settings-phone', profile.phone);
  set('settings-status', profile.status);
  set('settings-lastlogin', profile.lastLogin ? fmtDateTime(profile.lastLogin) : 'No login recorded yet', true);
  set('settings-created', fmtDateTime(profile.created), true);
  set('proto-last-updated', fmtDate(PROTOTYPE_BUILD), true);
  syncSccmKpiToggles();
  syncKasKpiToggles();
  updateThemeControlsUI();
  syncNotifToggles();
}
function renderProfileMenu(){
  document.getElementById('profile-menu').innerHTML = `
    <div class="profile-menu-item" onclick="openViewProfile()">${ICONS.eye}<span>View Profile</span></div>
    <div class="profile-menu-item" onclick="openEditProfile()">${ICONS.edit}<span>Edit Profile</span></div>
    <div class="profile-menu-item" onclick="goToSettingsFromMenu()">${ICONS.gear}<span>Settings</span></div>
    <div class="profile-menu-divider"></div>
    <div class="profile-menu-item danger" onclick="confirmLogout()">${ICONS.logout}<span>Logout</span></div>
  `;
}
function toggleProfileMenu(){ document.getElementById('profile-menu').classList.toggle('open'); }
function closeProfileMenu(){ document.getElementById('profile-menu').classList.remove('open'); }
function goToSettingsFromMenu(){ closeProfileMenu(); goTo('settings'); }

function openViewProfile(){
  closeProfileMenu();
  openModal({
    title:'Profile',
    body:`
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
        <div class="avatar avatar-lg">${esc(initials(profile.name))}</div>
        <div>
          <div style="font-weight:700;font-size:16px;">${esc(profile.name)}</div>
          <div style="font-size:12.5px;color:var(--text-muted);">${esc(profile.role)}</div>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-row"><span class="k">Organization</span><span class="v">${esc(profile.org)}</span></div>
        <div class="detail-row"><span class="k">Email</span><span class="v">${esc(profile.email)}</span></div>
        <div class="detail-row"><span class="k">Phone</span><span class="v">${esc(profile.phone)}</span></div>
        <div class="detail-row"><span class="k">Account status</span><span class="v"><span class="badge badge-green">${ICONS.check}${esc(profile.status)}</span></span></div>
        <div class="detail-row"><span class="k">Last login</span><span class="v">${profile.lastLogin ? fmtDateTime(profile.lastLogin) : '&mdash;'}</span></div>
        <div class="detail-row"><span class="k">Account created</span><span class="v">${fmtDateTime(profile.created)}</span></div>
      </div>
      <div class="form-hint" style="margin-top:14px;">Last login is recorded from this browser&rsquo;s clock each time you log in. Account created was generated on first use of this prototype in this browser.</div>
    `,
    footer:`<button class="btn btn-primary" onclick="openEditProfile()">${ICONS.edit} Edit profile</button>`
  });
}
function openEditProfile(){
  closeProfileMenu();
  openModal({
    title:'Edit profile',
    wide:true,
    body:`
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
        <div class="avatar avatar-lg" id="edit-avatar-preview"></div>
        <div>
          <div style="font-weight:700;font-size:15px;" id="edit-name-preview"></div>
          <div class="form-hint" style="margin-top:2px;">Your avatar uses your initials and updates automatically when you change your name.</div>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-field full"><label for="p-name">Full name</label>
          <input id="p-name" autocomplete="name" oninput="onProfileNameInput()">
          <div class="field-error" id="p-name-error">Full name is required.</div></div>
        <div class="form-field"><label for="p-role">Role</label><input id="p-role" readonly aria-readonly="true" title="Role is managed by an administrator"></div>
        <div class="form-field"><label for="p-email">Email</label>
          <input id="p-email" type="email" autocomplete="email" placeholder="name@example.com" oninput="clearFieldError('p-email')">
          <div class="form-hint">Enter a valid email address where you can receive messages.</div>
          <div class="field-error" id="p-email-error">Enter a valid email address.</div></div>
        <div class="form-field full"><label for="p-phone">Phone number</label>
          <input id="p-phone" type="tel" placeholder="+60 12-345 6789" oninput="clearFieldError('p-phone')">
          <div class="form-hint">Must start with +60 (Malaysia), e.g. +60 12-345 6789.</div>
          <div class="field-error" id="p-phone-error">Phone number must start with +60 followed by 8&ndash;10 digits.</div></div>
      </div>
    `,
    footer:`<button class="btn btn-ghost" onclick="resetProfileForm()">Reset</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProfile()">Save changes</button>`
  });
  fillProfileForm(profile);
}
function fillProfileForm(p){
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-role').value = p.role;
  document.getElementById('p-email').value = p.email;
  document.getElementById('p-phone').value = p.phone;
  ['p-name','p-email','p-phone'].forEach(clearFieldError);
  onProfileNameInput();
}
function onProfileNameInput(){
  const name = document.getElementById('p-name').value;
  applyAvatar(document.getElementById('edit-avatar-preview'), name, 'avatar-lg');
  document.getElementById('edit-name-preview').textContent = name.trim() || 'Your name';
  clearFieldError('p-name');
}
function resetProfileForm(){
  fillProfileForm(profile);
  showToast('Form restored to your saved profile','ok');
}
function setFieldError(id, msg){
  const input = document.getElementById(id), err = document.getElementById(id+'-error');
  if(input) input.classList.add('invalid');
  if(err){ if(msg) err.textContent = msg; err.classList.add('show'); }
}
function clearFieldError(id){
  const input = document.getElementById(id), err = document.getElementById(id+'-error');
  if(input) input.classList.remove('invalid');
  if(err) err.classList.remove('show');
}
function isMalaysiaPhone(v){ return /^\+60\d{8,10}$/.test(String(v).replace(/[\s-]/g,'')); }
function isValidProfileEmail(v){
  const email = String(v || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
async function saveProfile(){
  const name = document.getElementById('p-name').value.trim().replace(/\s+/g,' ');
  const email = document.getElementById('p-email').value.trim().toLowerCase();
  const phone = document.getElementById('p-phone').value.trim();
  let ok = true;
  if(!name){ setFieldError('p-name','Full name is required.'); ok = false; }
  if(!isValidProfileEmail(email)){ setFieldError('p-email', email ? 'Enter a valid email address.' : 'Email is required.'); ok = false; }
  if(!phone.startsWith('+60')){ setFieldError('p-phone','Phone number must start with +60.'); ok = false; }
  else if(!isMalaysiaPhone(phone)){ setFieldError('p-phone','Phone number must be +60 followed by 8–10 digits.'); ok = false; }
  if(!ok){ showToast('Fix the highlighted fields before saving','error'); return; }

  // Identify the logged-in account using the email stored after successful MFA.
  const rawSession = localStorage.getItem('fgv_session') || sessionStorage.getItem('fgv_session');
  let session;
  try { session = rawSession ? JSON.parse(rawSession) : null; } catch (_) { session = null; }
  const currentEmail = String(session && (session.email || session.username) || '').trim().toLowerCase();
  if(!currentEmail){ showToast('Your session is missing. Please log in again.','error'); return; }

  const saveButton = document.querySelector('.modal-footer .btn-primary') || document.querySelector('#modal-footer .btn-primary');
  if(saveButton){ saveButton.disabled = true; saveButton.textContent = 'Saving...'; }
  try {
    const response = await fetch('http://127.0.0.1:5000/api/profile', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({current_email: currentEmail, name, email, phone})
    });
    const result = await response.json();
    if(!response.ok || !result.success) throw new Error(result.message || 'Could not save profile.');

    profile.name = result.user.name || name;
    profile.email = result.user.email || email;
    if(result.user.phone !== undefined && result.user.phone !== null) profile.phone = result.user.phone;
    // Keep the current browser session aligned with the account's new email/name.
    session.email = profile.email;
    session.username = profile.email;
    session.name = profile.name;
    const updatedSession = JSON.stringify(session);
    if(localStorage.getItem('fgv_session')) localStorage.setItem('fgv_session', updatedSession);
    else sessionStorage.setItem('fgv_session', updatedSession);
    persistProfile();
    updateProfileEverywhere();
    closeModal();
    showToast(result.message || 'Profile updated successfully.', 'ok');
  } catch(error) {
    showToast(error.message || 'Could not save profile. Check the Flask server.', 'error');
  } finally {
    if(saveButton){ saveButton.disabled = false; saveButton.textContent = 'Save changes'; }
  }
}

