// modal.js: Simple modal for import choice

function showImportModal(onReplace, onAppend) {
  // Remove existing modal if present
  const existing = document.getElementById('import-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'import-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div style="margin-bottom: 16px;">How do you want to import?</div>
      <button id="modal-replace" class="modal-btn modal-replace">Replace</button>
      <button id="modal-append" class="modal-btn modal-append">Append</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('modal-replace').onclick = () => {
    modal.remove();
    onReplace();
  };
  document.getElementById('modal-append').onclick = () => {
    modal.remove();
    onAppend();
  };
}