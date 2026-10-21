/* =====================================================================
   18. EXPORT / COPY / SHARE — makes the whole prototype portable: copy the
   full source to the clipboard, download it as a standalone .html file,
   or hand it off via the browser's native share sheet.
===================================================================== */
function arrayToCsv(rows){
  if(!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val)=>{
    const s = String(val==null ? '' : val);
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row=> lines.push(headers.map(h=>escape(row[h])).join(',')) );
  return lines.join('\r\n');
}
function downloadTextFile(filename, content, mime){
  const blob = new Blob([content], {type: mime || 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function escapeHtml(str){
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function getFullSourceCode(){
  return PRISTINE_SOURCE;   // clean source captured before rendering (see top of script)
}
function copyPrototypeCode(){
  const code = getFullSourceCode();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(()=>{
      showToast('Prototype code copied successfully','ok');
    }).catch(()=> legacyCopyCode(code));
  } else {
    legacyCopyCode(code);
  }
}
function legacyCopyCode(code){
  try{
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok){ showToast('Prototype code copied successfully','ok'); }
    else { showCodeFallbackModal(code); }
  } catch(e){
    showCodeFallbackModal(code);
  }
}
function showCodeFallbackModal(code){
  openModal({
    title:'Copy prototype code',
    wide:true,
    body:`<div class="form-hint" style="margin-bottom:10px;">Automatic clipboard copy isn&rsquo;t available in this browser context. Click inside the box below, select all (Ctrl/Cmd+A) and copy (Ctrl/Cmd+C) manually.</div>
      <textarea readonly onclick="this.select()" style="width:100%;height:280px;font-family:monospace;font-size:11px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);">${escapeHtml(code)}</textarea>`,
    footer:`<button class="btn btn-primary" onclick="closeModal()">Close</button>`
  });
}
async function downloadPrototypeHtml(){
  const code = getFullSourceCode();
  const filename = 'security-hardening-vulnerability-dashboard.html';
  try{
    if(window.claude && typeof window.claude.use === 'function'){
      const downloads = await window.claude.use('downloads');
      if(downloads){
        await downloads.save({filename, data: code});
        showToast('Prototype downloaded successfully','ok');
        return;
      }
    }
  } catch(e){ /* fall through to the standard browser download below */ }
  downloadTextFile(filename, code, 'text/html;charset=utf-8;');
  showToast('Prototype downloaded successfully','ok');
}
async function sharePrototype(){
  const code = getFullSourceCode();
  const filename = 'security-hardening-vulnerability-dashboard.html';
  const shareText = 'Security Hardening & Vulnerability Management Dashboard prototype (FGV Prodata Network & IT Security) — sample data only.';
  try{
    if(navigator.share){
      if(navigator.canShare && typeof window.File === 'function'){
        const file = new File([code], filename, {type:'text/html'});
        if(navigator.canShare({files:[file]})){
          await navigator.share({title:'FGV Prodata Security Dashboard Prototype', text: shareText, files:[file]});
          showToast('Prototype shared successfully','ok');
          return;
        }
      }
      await navigator.share({title:'FGV Prodata Security Dashboard Prototype', text: shareText});
      showToast('Shared via device share sheet','ok');
      return;
    }
  } catch(e){
    if(e && e.name === 'AbortError'){ return; }
  }
  showToast('Native sharing isn\'t supported here — copying the code instead','ok');
  copyPrototypeCode();
}

