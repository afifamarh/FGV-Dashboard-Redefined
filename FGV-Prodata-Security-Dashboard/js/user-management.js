/* Admin-only user CRUD. DELETE is implemented as a safe soft-deactivation in MySQL. */
(function(){
  const API_BASE = 'http://127.0.0.1:5000';
  const ALLOWED_ROLES = ['Admin', 'FGV Management', 'FELDA Management'];
  const $ = id => document.getElementById(id);
  function currentSession(){ try { return JSON.parse(localStorage.getItem('fgv_session') || sessionStorage.getItem('fgv_session') || 'null'); } catch (_) { return null; } }
  function isAdmin(){ const s=currentSession(); return !!s && s.role==='admin' && !!s.apiToken; }
  function escapeHtml(value){ return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function showFeedback(message, ok){ const box=$('users-feedback'); if(!box)return; box.textContent=message; box.style.display='block'; box.style.background=ok?'rgba(16,185,129,.12)':'rgba(239,68,68,.12)'; box.style.color=ok?'var(--success,#047857)':'var(--danger,#b91c1c)'; }
  async function api(path, options={}){
    const s=currentSession(); if(!isAdmin()) throw new Error('Admin session required. Please log in again.');
    const response=await fetch(API_BASE+path,{...options,headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.apiToken,...(options.headers||{})}});
    const data=await response.json().catch(()=>({success:false,message:'Invalid server response.'}));
    if(!response.ok || !data.success) throw new Error(data.message || 'Request failed.'); return data;
  }
  function renderUsers(users){
    const body=$('managed-users-tbody'); if(!body)return;
    if(!users.length){body.innerHTML='<tr><td colspan="7" class="muted">No users found.</td></tr>';return;}
    body.innerHTML=users.map(u=>`<tr>
      <td>${escapeHtml(u.id)}</td><td>${escapeHtml(u.full_name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.phone_number || u.phone || u.mobile || '—')}</td><td>${escapeHtml(u.role)}</td>
      <td><span class="badge ${u.is_active?'badge-success':'badge-muted'}">${u.is_active?'Active':'Inactive'}</span></td>
      <td style="white-space:nowrap;display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-secondary btn-sm" onclick="editManagedUser(${Number(u.id)})">Edit</button>${u.is_active?`<button type="button" class="btn btn-secondary btn-sm" onclick="deactivateManagedUser(${Number(u.id)})">Deactivate</button>`:`<button type="button" class="btn btn-secondary btn-sm" onclick="activateManagedUser(${Number(u.id)})">Activate</button>`}</td>
    </tr>`).join('');
  }
  window.loadManagedUsers=async function(){
    if(!isAdmin()){showFeedback('Admin access is required. Log out and sign in with an Admin account.',false);return;}
    const body=$('managed-users-tbody'); if(body)body.innerHTML='<tr><td colspan="7">Loading users…</td></tr>';
    try{const data=await api('/api/admin/users');const users=data.users||[];renderUsers(users);if($('users-total'))$('users-total').textContent=users.length;if($('users-active'))$('users-active').textContent=users.filter(u=>u.is_active).length;}
    catch(error){if(body)body.innerHTML=`<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;showFeedback(error.message,false);}
  };
  window.editManagedUser=async function(id){
    try{
      const list=await api('/api/admin/users'); const user=(list.users||[]).find(u=>Number(u.id)===Number(id)); if(!user)throw new Error('User not found.');
      const full_name=prompt('Edit full name:',user.full_name); if(full_name===null)return;
      const email=prompt('Edit email address:',user.email); if(email===null)return;
      const phone_number=prompt('Edit phone number:',user.phone_number||user.phone||user.mobile||''); if(phone_number===null)return;
      const role=prompt('Role (Admin, FGV Management, FELDA Management):',user.role); if(role===null)return;
      if(!ALLOWED_ROLES.includes(role.trim()))throw new Error('Role must be Admin, FGV Management, or FELDA Management.');
      const activeAnswer=prompt('Account status: type active or inactive',user.is_active?'active':'inactive'); if(activeAnswer===null)return;
      const is_active=activeAnswer.trim().toLowerCase()==='active'; if(!is_active && activeAnswer.trim().toLowerCase()!=='inactive')throw new Error('Status must be active or inactive.');
      const result=await api('/api/admin/users/'+id,{method:'PUT',body:JSON.stringify({full_name:full_name.trim(),email:email.trim(),phone_number:phone_number.trim(),role:role.trim(),is_active})});showFeedback(result.message,true);await window.loadManagedUsers();
    }catch(e){showFeedback(e.message,false);}
  };
  window.deactivateManagedUser=async function(id){if(!confirm('Deactivate this account? Its database record will be retained.'))return;try{const result=await api('/api/admin/users/'+id,{method:'DELETE'});showFeedback(result.message,true);await window.loadManagedUsers();}catch(e){showFeedback(e.message,false);}};
  window.activateManagedUser=async function(id){try{const list=await api('/api/admin/users');const user=(list.users||[]).find(u=>Number(u.id)===Number(id));if(!user)throw new Error('User not found.');const result=await api('/api/admin/users/'+id,{method:'PUT',body:JSON.stringify({full_name:user.full_name,email:user.email,phone_number:user.phone_number||user.phone||user.mobile||'',role:user.role,is_active:true})});showFeedback(result.message,true);await window.loadManagedUsers();}catch(e){showFeedback(e.message,false);}};
  const form=$('create-user-form');
  if(form)form.addEventListener('submit',async event=>{event.preventDefault();const name=$('new-user-name').value.trim(),email=$('new-user-email').value.trim().toLowerCase(),phone_number=$('new-user-phone')?.value.trim()||'',password=$('new-user-password').value,passwordConfirm=$('new-user-password-confirm').value,role=$('new-user-role').value;if(!name||!email||password.length<12||password!==passwordConfirm||!ALLOWED_ROLES.includes(role)){showFeedback(password!==passwordConfirm?'Password and retype password do not match.':'Complete all fields and use a password of at least 12 characters.',false);return;}const button=$('create-user-submit');button.disabled=true;button.textContent='Creating…';try{const result=await api('/api/admin/users',{method:'POST',body:JSON.stringify({full_name:name,email,phone_number,password,password_confirm:passwordConfirm,role})});showFeedback(result.message||'User created successfully.',true);form.reset();await window.loadManagedUsers();}catch(error){showFeedback(error.message,false);}finally{button.disabled=false;button.textContent='Create User';}});
})();
