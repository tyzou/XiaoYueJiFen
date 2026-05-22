(function () {
  const flashArea = document.querySelector('.flash-area') || createFlashArea();
  const scoreValue = document.querySelector('.score-value strong');
  const todayScoreValue = document.querySelector('[data-today-score-value]');
  const confirmDialog = createConfirmDialog();
  const dateInputs = Array.from(document.querySelectorAll('[data-date-selector] input[type="radio"]'));
  const selectedDateFields = Array.from(document.querySelectorAll('[data-selected-date-field]'));

  function syncSelectedDateFields() {
    const selected = dateInputs.find((input) => input.checked);
    if (!selected) {
      return;
    }
    selectedDateFields.forEach((field) => {
      field.value = selected.value;
    });
  }

  dateInputs.forEach((input) => {
    input.addEventListener('change', syncSelectedDateFields);
  });
  syncSelectedDateFields();

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

  function toUrlEncodedBody(form) {
    return new URLSearchParams(new FormData(form));
  }

  function setSubmitting(form, submitting) {
    form.querySelectorAll('button').forEach((button) => {
      button.disabled = submitting;
    });
  }

  function formatSignedScore(value) {
    const number = Number(value) || 0;
    return `${number >= 0 ? '+' : ''}${number}`;
  }

  function setTodayScore(value) {
    if (!todayScoreValue) {
      return;
    }
    const number = Number(value) || 0;
    todayScoreValue.textContent = formatSignedScore(number);
    todayScoreValue.classList.toggle('is-negative', number < 0);
  }

  function selectedDateIsToday() {
    const selected = dateInputs.find((input) => input.checked);
    return !selected || dateInputs.length === 0 || selected === dateInputs[0];
  }

  function scoreDeltaFromForm(form) {
    if (!selectedDateIsToday()) {
      return null;
    }
    if (form.action.includes('/score/manual')) {
      const value = Number(form.querySelector('input[name="pointsDelta"]')?.value);
      return Number.isFinite(value) ? value : null;
    }
    if (form.action.includes('/score/quick/')) {
      const value = Number(form.querySelector('.quick-button strong')?.textContent);
      return Number.isFinite(value) ? value : null;
    }
    return null;
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

  function setupTransactionLongPressDelete() {
    const items = Array.from(document.querySelectorAll('[data-deletable-transaction]'));
    if (items.length === 0) {
      return;
    }

    const longPressMs = 1000;
    const moveTolerance = 12;
    let activePress = null;

    function clearActivePress() {
      if (!activePress) {
        return;
      }
      window.clearTimeout(activePress.timer);
      activePress.item.classList.remove('is-long-pressing');
      activePress = null;
    }

    async function deleteTransaction(item) {
      if (!item.dataset.deleteUrl) {
        return;
      }
      const confirmed = await requestConfirm(
        '删除今日记录',
        '确定删除这条今日积分记录吗？积分会同步回退。'
      );
      if (!confirmed) {
        return;
      }

      item.classList.add('is-submitting');
      try {
        const body = new URLSearchParams();
        body.set('_csrf', item.dataset.csrfToken || '');
        const days = new URLSearchParams(window.location.search).get('days');
        if (days) {
          body.set('days', days);
        }

        const response = await fetch(item.dataset.deleteUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.message || '删除失败。');
        }
        showFlash('success', result.message || '积分记录已删除。');
        window.setTimeout(() => {
          window.location.reload();
        }, 300);
      } catch (error) {
        item.classList.remove('is-submitting');
        showFlash('error', error.message || '删除失败。');
      }
    }

    items.forEach((item) => {
      item.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) {
          return;
        }
        clearActivePress();
        const startX = event.clientX || 0;
        const startY = event.clientY || 0;
        item.classList.add('is-long-pressing');
        const timer = window.setTimeout(() => {
          if (!activePress || activePress.item !== item) {
            return;
          }
          item.classList.remove('is-long-pressing');
          activePress = null;
          deleteTransaction(item);
        }, longPressMs);
        activePress = { item, timer, startX, startY };
      });

      item.addEventListener('pointermove', (event) => {
        if (!activePress || activePress.item !== item) {
          return;
        }
        const dx = Math.abs((event.clientX || 0) - activePress.startX);
        const dy = Math.abs((event.clientY || 0) - activePress.startY);
        if (dx > moveTolerance || dy > moveTolerance) {
          clearActivePress();
        }
      });

      item.addEventListener('pointerup', clearActivePress);
      item.addEventListener('pointercancel', clearActivePress);
      item.addEventListener('pointerleave', clearActivePress);
      item.addEventListener('contextmenu', (event) => {
        event.preventDefault();
      });
    });

    window.addEventListener('scroll', clearActivePress, { passive: true });
  }

  setupTransactionLongPressDelete();

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
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: toUrlEncodedBody(form)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.message || '操作失败。');
        }
        if (scoreValue && Number.isFinite(Number(result.currentScore))) {
          scoreValue.textContent = result.currentScore;
        }
        if (Number.isFinite(Number(result.todayScore))) {
          setTodayScore(result.todayScore);
        } else {
          const delta = scoreDeltaFromForm(form);
          if (delta !== null && todayScoreValue) {
            setTodayScore(Number(todayScoreValue.textContent) + delta);
          }
        }
        showFlash('success', result.message || '已保存。');
        if (!form.dataset.keepValues) {
          form.reset();
          syncSelectedDateFields();
        }
      } catch (error) {
        showFlash('error', error.message || '操作失败。');
      } finally {
        setSubmitting(form, false);
      }
    });
  });
})();
