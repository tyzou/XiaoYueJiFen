(function () {
  const flashArea = document.querySelector('.flash-area') || createFlashArea();
  const scoreValue = document.querySelector('.score-value strong');
  const confirmDialog = createConfirmDialog();

  function createFlashArea() {
    const area = document.createElement('section');
    area.className = 'flash-area transient-flash-area';
    const shell = document.querySelector('.page-shell');
    if (shell) {
      const firstMain = shell.querySelector('main');
      shell.insertBefore(area, firstMain || null);
    }
    return area;
  }

  function showFlash(type, message) {
    if (!flashArea) {
      return;
    }
    flashArea.innerHTML = '';
    const item = document.createElement('div');
    item.className = `flash ${type}`;
    item.textContent = message;
    flashArea.appendChild(item);
    window.setTimeout(() => {
      item.remove();
    }, 2400);
  }

  function setSubmitting(form, submitting) {
    form.querySelectorAll('button').forEach((button) => {
      button.disabled = submitting;
    });
  }

  function createConfirmDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-panel">
        <div class="confirm-copy">
          <h2></h2>
          <p></p>
        </div>
        <div class="confirm-actions">
          <button class="ghost-button compact" type="button" data-confirm-cancel>取消</button>
          <button class="danger-button compact" type="button" data-confirm-ok>确认</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    return dialog;
  }

  function requestConfirm(title, detail) {
    return new Promise((resolve) => {
      const titleNode = confirmDialog.querySelector('h2');
      const detailNode = confirmDialog.querySelector('p');
      const cancelButton = confirmDialog.querySelector('[data-confirm-cancel]');
      const okButton = confirmDialog.querySelector('[data-confirm-ok]');

      titleNode.textContent = title || '确认操作';
      detailNode.textContent = detail || '确认后会立即生效。';

      function cleanup(result) {
        cancelButton.removeEventListener('click', onCancel);
        okButton.removeEventListener('click', onOk);
        confirmDialog.removeEventListener('cancel', onCancel);
        if (confirmDialog.open) {
          confirmDialog.close();
        }
        resolve(result);
      }

      function onCancel(event) {
        if (event) {
          event.preventDefault();
        }
        cleanup(false);
      }

      function onOk() {
        cleanup(true);
      }

      cancelButton.addEventListener('click', onCancel);
      okButton.addEventListener('click', onOk);
      confirmDialog.addEventListener('cancel', onCancel);

      if (typeof confirmDialog.showModal === 'function') {
        confirmDialog.showModal();
      } else {
        confirmDialog.setAttribute('open', '');
      }
      okButton.focus();
    });
  }

  document.querySelectorAll('.async-score-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const confirmTitle = form.dataset.confirmTitle;
      if (confirmTitle && !(await requestConfirm(confirmTitle, form.dataset.confirmDetail))) {
        return;
      }

      setSubmitting(form, true);
      try {
        const response = await fetch(form.action, {
          method: form.method || 'POST',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: new FormData(form)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.message || '操作失败。');
        }
        if (scoreValue && Number.isFinite(Number(result.currentScore))) {
          scoreValue.textContent = result.currentScore;
        }
        showFlash('success', result.message || '已保存。');
        if (!form.dataset.keepValues) {
          form.reset();
        }
      } catch (error) {
        showFlash('error', error.message || '操作失败。');
      } finally {
        setSubmitting(form, false);
      }
    });
  });
})();
