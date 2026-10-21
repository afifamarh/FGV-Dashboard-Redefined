/* =====================================================================
   16. MODAL SUPPORT — generic open/close used by every form and detail view.
   Closing only removes the overlay it faded out, so "close this modal
   and open the next one" (e.g. View Profile -> Edit Profile) works.
===================================================================== */
function openModal({title, body, footer, wide}){
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box ${wide?'wide':''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()" aria-label="Close">${ICONS.close}</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>`;
  root.appendChild(ov);
  ov.addEventListener('mousedown', (e)=>{ if(e.target===ov) closeModal(); });
  requestAnimationFrame(()=> ov.classList.add('open'));
}
function closeModal(){
  const ov = document.getElementById('modal-overlay');
  if(!ov) return;
  ov.removeAttribute('id');
  ov.classList.remove('open');
  setTimeout(()=> ov.remove(), 160);
}
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){ closeModal(); closeNotifPanel(); closeProfileMenu(); }
});

