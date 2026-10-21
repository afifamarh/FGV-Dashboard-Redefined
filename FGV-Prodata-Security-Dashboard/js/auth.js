/* =====================================================================
   5. AUTHENTICATION — login, logout, forgot password -> reset -> login
   All auth steps are views INSIDE the login card, so nothing opens
   behind the login overlay and every step has a way back.
===================================================================== */
let resetRequest = null;   // password reset flow state
let pendingLogin = null;    // {email, remember} — waits for login OTP

/* ---- ROLE-BASED ACCESS (prototype-level UI visibility + routing only, not real security) ----
   ROLE_PERMISSIONS is the single place that decides which tools each role can see. */
const ROLE_ACCOUNTS = {
};
const ROLE_LABELS = {admin:'IT Security Admin', fgv:'FGV Management', felda:'FELDA Management'};
const ROLE_PERMISSIONS = {
  admin: {defender:true,  sccm:true,  kaspersky:true,  trendmicro:true},
  fgv:   {defender:true,  sccm:true,  kaspersky:false, trendmicro:false},
  felda: {defender:false, sccm:false, kaspersky:true,  trendmicro:true},
};
function getSessionRole(){
  try{
    const raw = localStorage.getItem('fgv_session') || sessionStorage.getItem('fgv_session');
    const r = raw && JSON.parse(raw).role;
    return ROLE_PERMISSIONS[r] ? r : null;
  }catch(e){ return null; }
}
function canAccess(tool){ const role=getSessionRole(); return !!(role && ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role][tool]); }
/* Role-filtered views of shared data (same permission table). Records not tied to a tool stay visible. */
function roleTools(){ return securityTools.filter(t=>canAccess(t.key)); }
function roleVulns(){ return vulnerabilities.filter(v=>{ const k = TOOL_BY_SOURCE[v.source]; return !k || canAccess(k); }); }
function roleControls(){ return hardeningControls.filter(c=>!c.tool || canAccess(c.tool)); }
function reportAllowed(key){ const r = REPORTS.find(x=>x.key===key); return !!r && (!r.tool || canAccess(r.tool)); }

function renderAuthDemo(){
  const box = document.getElementById('auth-demo');
  if(box){ box.hidden = true; box.textContent = ''; }
}
function restoreDemoPassword(){
  showAuthMessage('Demo login is disabled. Use an active account registered in MySQL.');
}
function showAuthView(view){
  ['login','login-otp','forgot','sent','reset','done'].forEach(v=>{
    document.getElementById('auth-view-'+v).hidden = (v !== view);
  });
  const focusMap = {login:'login-username', 'login-otp':'login-otp-code', forgot:'fp-email', sent:'fp-otp', reset:'rp-new'};
  if(focusMap[view]) setTimeout(()=>{ const el = document.getElementById(focusMap[view]); if(el) el.focus(); }, 30);
}
function showAuthMessage(text){
  document.getElementById('auth-message-text').textContent = text;
  document.getElementById('auth-message').classList.add('show');
  document.getElementById('auth-error').classList.remove('show');
}
function showAuthScreen(opts){
  opts = opts || {};
  pendingLogin = null;
  document.getElementById('auth-screen').classList.add('open');
  document.getElementById('login-form').reset();
  document.getElementById('auth-error').classList.remove('show');
  document.getElementById('auth-message').classList.remove('show');
  if(opts.loggedOut) showAuthMessage('You have been logged out.');
  renderAuthDemo();
  showAuthView('login');
}
async function attemptLogin(evt){
  if(evt) evt.preventDefault();
  const email = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const errBox = document.getElementById('auth-error');
  if(!email || !password){
    document.getElementById('auth-error-text').textContent = 'Enter your email and password.';
    errBox.classList.add('show'); document.getElementById('auth-message').classList.remove('show');
    return false;
  }
  const loginButton = document.querySelector('#login-form button[type="submit"]');
  if(loginButton){loginButton.disabled=true; loginButton.textContent='Checking...';}
  try{
    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password})
    });
    const data = await response.json();
    if(!response.ok || !data.success) throw new Error(data.message || 'Invalid email or password.');
    // Placeholder domains are local demo identities: backend returns a session directly, without email OTP.
    if(data.requires_otp === false && data.user){
      completeLogin(data.user, remember, 'Successful login with placeholder account (no email OTP)');
      return false;
    }
    if(!data.requires_otp) throw new Error(data.message || 'Login could not start email verification.');
    pendingLogin = {email: data.email || email, remember};
    document.getElementById('login-otp-email').textContent = pendingLogin.email;
    document.getElementById('login-otp-code').value = '';
    document.getElementById('login-otp-error').classList.remove('show');
    showAuthView('login-otp');
  }catch(error){
    document.getElementById('auth-error-text').textContent=error.message || 'Could not connect to the authentication server.';
    errBox.classList.add('show'); document.getElementById('auth-message').classList.remove('show');
  }finally{if(loginButton){loginButton.disabled=false; loginButton.textContent='Log in';}}
  return false;
}

function completeLogin(user, remember, auditMessage){
  const payload=JSON.stringify({username:user.email,email:user.email,name:user.name,role:user.role,apiToken:user.api_token || user.apiToken || '',ts:Date.now()});
  if(remember){localStorage.setItem('fgv_session',payload);sessionStorage.removeItem('fgv_session');}
  else{sessionStorage.setItem('fgv_session',payload);localStorage.removeItem('fgv_session');}
  if(typeof profile!=='undefined'){
    profile.name=user.name || profile.name; profile.email=user.email || profile.email;
    profile.role=ROLE_LABELS[user.role] || user.role; profile.lastLogin=nowIso();
    if(typeof persistProfile==='function') persistProfile();
  }
  pendingLogin=null;
  if(typeof auditLog==='function') auditLog('Login',auditMessage || 'Successful login');
  document.getElementById('auth-screen').classList.remove('open'); document.body.classList.remove('logged-out');
  updateProfileEverywhere(); goTo('dashboard'); showToast('Login successful','ok');
}

async function verifyLoginOtp(){
  const otpInput=document.getElementById('login-otp-code');
  const errorBox=document.getElementById('login-otp-error');
  const otp=otpInput.value.trim();
  if(!pendingLogin){ showAuthView('login'); return; }
  if(!/^\d{6}$/.test(otp)){ errorBox.textContent='Enter the 6-digit OTP.'; errorBox.classList.add('show'); return; }
  const btn=document.getElementById('verify-login-otp-btn');
  btn.disabled=true; btn.textContent='Verifying...';
  try{
    const response=await fetch('http://127.0.0.1:5000/api/auth/verify-login-otp',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:pendingLogin.email, otp})
    });
    const data=await response.json();
    if(!response.ok || !data.success || !data.user) throw new Error(data.message || 'OTP verification failed.');
    const user=data.user;
    completeLogin(user, pendingLogin.remember, 'Successful login with email OTP');
    pendingLogin=null;
  }catch(error){errorBox.textContent=error.message || 'Unable to verify OTP.';errorBox.classList.add('show');}
  finally{btn.disabled=false;btn.textContent='Verify and log in';}
}
function cancelLoginOtp(){ pendingLogin=null; document.getElementById('login-password').value=''; showAuthView('login'); }

function togglePasswordVisibility(){
  const input = document.getElementById('login-password');
  const btn = document.getElementById('pw-toggle-btn');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.innerHTML = showing ? ICONS.eye : ICONS.eyeOff;
  btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
}
function openForgotPassword(keepEmail){
  const input = document.getElementById('fp-email');
  if(!keepEmail) input.value = '';
  input.classList.remove('invalid');
  document.getElementById('fp-error').classList.remove('show');
  showAuthView('forgot');
}
function isCompanyEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); }
async function sendResetLink(evt){
  if(evt) evt.preventDefault();
  const input = document.getElementById('fp-email');
  const email = input.value.trim().toLowerCase();
  const err = document.getElementById('fp-error');
  if(!isCompanyEmail(email)){
    err.textContent = 'Enter a valid email address.';
    err.classList.add('show'); input.classList.add('invalid'); input.focus();
    return false;
  }
  err.classList.remove('show'); input.classList.remove('invalid');
  const btn = document.querySelector('#auth-view-forgot button[type="submit"]');
  if(btn){btn.disabled=true; btn.textContent='Sending OTP...';}
  try{
    const response = await fetch('http://127.0.0.1:5000/api/auth/forgot-password', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email})
    });
    const data = await response.json();
    if(!response.ok || !data.success) throw new Error(data.message || 'Could not send OTP.');
    resetRequest = {email, at:nowIso(), otp:null, verified:false};
    document.getElementById('fp-sent-text').textContent = `If an active account matches ${email}, an OTP has been sent. Check your inbox and spam folder. The code expires in 5 minutes.`;
    showAuthView('sent');
  }catch(error){
    err.textContent = error.message || 'Could not connect to the Flask server. Make sure app.py is running.';
    err.classList.add('show');
  }finally{
    if(btn){btn.disabled=false; btn.textContent='Send OTP';}
  }
  return false;
}
async function verifyResetOtp(){
  const otpInput = document.getElementById('fp-otp');
  const errorBox = document.getElementById('fp-otp-error');
  const otp = otpInput.value.trim();
  if(!resetRequest){openForgotPassword(); return;}
  if(!/^\d{6}$/.test(otp)){errorBox.textContent='Enter the 6-digit OTP.'; errorBox.classList.add('show'); return;}
  const btn = document.getElementById('verify-otp-btn');
  btn.disabled=true; btn.textContent='Verifying...';
  try{
    const response = await fetch('http://127.0.0.1:5000/api/auth/verify-otp', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:resetRequest.email, otp})
    });
    const data = await response.json();
    if(!response.ok || !data.success) throw new Error(data.message || 'OTP verification failed.');
    resetRequest.otp=otp; resetRequest.verified=true;
    errorBox.classList.remove('show');
    openResetPassword();
  }catch(error){errorBox.textContent=error.message || 'Unable to verify OTP.'; errorBox.classList.add('show');}
  finally{btn.disabled=false; btn.textContent='Verify OTP';}
}
function openResetPassword(){
  if(!resetRequest){ openForgotPassword(); return; }
  if(!resetRequest.verified){ showAuthView('sent'); return; }
  document.getElementById('rp-new').value = '';
  document.getElementById('rp-confirm').value = '';
  document.getElementById('rp-error').classList.remove('show');
  document.getElementById('rp-for-text').innerHTML = `Choose a new password for the account linked to <b>${esc(resetRequest.email)}</b>.`;
  updatePasswordRules();
  showAuthView('reset');
}
function passwordRuleState(){
  const pw = document.getElementById('rp-new').value;
  const confirm = document.getElementById('rp-confirm').value;
  return {len: pw.length>=8, mix: /[A-Za-z]/.test(pw) && /\d/.test(pw), match: pw.length>0 && pw===confirm};
}
function updatePasswordRules(){
  const s = passwordRuleState();
  document.querySelectorAll('#pw-rules li').forEach(li=> li.classList.toggle('ok', !!s[li.dataset.rule]));
}
async function submitPasswordReset(evt){
  if(evt) evt.preventDefault();
  const s = passwordRuleState();
  const err = document.getElementById('rp-error');
  let msg = '';
  if(!s.len) msg = 'Password must be at least 8 characters.';
  else if(!s.mix) msg = 'Password must contain at least one letter and one number.';
  else if(!s.match) msg = 'Passwords do not match.';
  else if(!resetRequest || !resetRequest.verified || !resetRequest.otp) msg = 'Verify your email OTP first.';
  if(msg){ err.textContent = msg; err.classList.add('show'); return false; }
  const btn = document.querySelector('#auth-view-reset button[type="submit"]');
  if(btn){btn.disabled=true; btn.textContent='Updating...';}
  try{
    const response = await fetch('http://127.0.0.1:5000/api/auth/reset-password', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:resetRequest.email, otp:resetRequest.otp, password:document.getElementById('rp-new').value})
    });
    const data = await response.json();
    if(!response.ok || !data.success) throw new Error(data.message || 'Password reset failed.');
    resetRequest = null;
    document.getElementById('done-text').textContent = data.message;
    showAuthView('done');
  }catch(error){err.textContent=error.message || 'Could not reset password.'; err.classList.add('show');}
  finally{if(btn){btn.disabled=false; btn.textContent='Update password';}}
  return false;
}
function backToLogin(afterReset){
  document.getElementById('auth-error').classList.remove('show');
  if(afterReset) showAuthMessage('Password updated. Log in with your new password.');
  else document.getElementById('auth-message').classList.remove('show');
  document.getElementById('login-password').value = '';
  
  showAuthView('login');
  if(afterReset) setTimeout(()=>document.getElementById('login-password').focus(), 40);
}
function checkSession(){
  return !!(localStorage.getItem('fgv_session') || sessionStorage.getItem('fgv_session'));
}
function confirmLogout(){
  closeProfileMenu();
  openModal({
    title:'Log out',
    body:`<div class="confirm-body">Are you sure you want to log out?</div>`,
    footer:`<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doLogout()">Log out</button>`
  });
}
function doLogout(){
  if(typeof auditLog==="function" && checkSession()) auditLog("Logout","User logged out");
  closeModal();
  localStorage.removeItem('fgv_session');
  sessionStorage.removeItem('fgv_session');
  document.body.classList.add('logged-out');
  showAuthScreen({loggedOut:true});
}

