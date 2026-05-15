(function () {
  const dialog = document.getElementById('iconPickerDialog');
  const grid = document.getElementById('iconPickerGrid');
  const search = document.getElementById('iconPickerSearch');
  const closeButton = document.querySelector('[data-icon-picker-close]');
  const flashArea = document.querySelector('.flash-area') || createFlashArea();
  const confirmDialog = createConfirmDialog();
  const createToggle = document.querySelector('[data-create-toggle]');
  const createBody = document.querySelector('[data-create-body]');
  const editorList = document.querySelector('.quick-editor-list');
  const listCount = document.querySelector('.list-count');
  const metricValues = Array.from(document.querySelectorAll('.quick-admin-metrics strong'));
  let activeTrigger = null;
  let activeInput = null;

  const iconAliases = {
    'lucide:book-open': 'fluent-emoji-flat:open-book',
    'lucide:book': 'fluent-emoji-flat:books',
    'lucide:notebook-pen': 'fluent-emoji-flat:memo',
    'lucide:pencil': 'fluent-emoji-flat:pencil',
    'lucide:school': 'fluent-emoji-flat:school',
    'lucide:calculator': 'fluent-emoji-flat:abacus',
    'lucide:palette': 'fluent-emoji-flat:artist-palette',
    'lucide:music': 'fluent-emoji-flat:musical-notes',
    'lucide:trophy': 'fluent-emoji-flat:trophy',
    'lucide:medal': 'fluent-emoji-flat:sports-medal',
    'lucide:badge-check': 'fluent-emoji-flat:check-mark-button',
    'lucide:star': 'fluent-emoji-flat:glowing-star',
    'lucide:sparkles': 'fluent-emoji-flat:glowing-star',
    'lucide:heart': 'fluent-emoji-flat:red-heart',
    'lucide:smile': 'fluent-emoji-flat:smiling-face-with-smiling-eyes',
    'lucide:sun': 'fluent-emoji-flat:sun',
    'lucide:moon': 'fluent-emoji-flat:crescent-moon',
    'lucide:alarm-clock': 'fluent-emoji-flat:alarm-clock',
    'lucide:calendar-check': 'fluent-emoji-flat:tear-off-calendar',
    'lucide:house': 'fluent-emoji-flat:house',
    'lucide:brush-cleaning': 'fluent-emoji-flat:broom',
    'lucide:utensils': 'fluent-emoji-flat:fork-and-knife',
    'lucide:shirt': 'fluent-emoji-flat:t-shirt',
    'lucide:leaf': 'fluent-emoji-flat:leafy-green',
    'lucide:bike': 'fluent-emoji-flat:bicycle',
    'lucide:dumbbell': 'fluent-emoji-flat:person-running',
    'lucide:footprints': 'fluent-emoji-flat:person-running',
    'lucide:gamepad-2': 'fluent-emoji-flat:video-game',
    'lucide:tv': 'fluent-emoji-flat:television',
    'lucide:tablet': 'fluent-emoji-flat:mobile-phone',
    'lucide:message-circle': 'fluent-emoji-flat:speech-balloon',
    'lucide:hand-heart': 'fluent-emoji-flat:handshake',
    'lucide:thumbs-up': 'fluent-emoji-flat:thumbs-up',
    'lucide:target': 'fluent-emoji-flat:bullseye',
    'lucide:gift': 'fluent-emoji-flat:wrapped-gift',
    'lucide:piggy-bank': 'fluent-emoji-flat:money-bag',
    'lucide:coins': 'fluent-emoji-flat:coin',
    'lucide:apple': 'fluent-emoji-flat:green-apple',
    'lucide:cake': 'fluent-emoji-flat:birthday-cake',
    'lucide:ice-cream-bowl': 'fluent-emoji-flat:soft-ice-cream',
    'lucide:cloud-rain': 'fluent-emoji-flat:cloud-with-rain',
    'lucide:angry': 'fluent-emoji-flat:angry-face',
    'lucide:frown': 'fluent-emoji-flat:frowning-face',
    'lucide:snail': 'fluent-emoji-flat:snail',
    'lucide:trash-2': 'fluent-emoji-flat:wastebasket',
    'lucide:volume-2': 'fluent-emoji-flat:speaker-high-volume',
    'lucide:wifi-off': 'fluent-emoji-flat:warning',
    'lucide:circle-alert': 'fluent-emoji-flat:warning',
    'lucide:thumbs-down': 'fluent-emoji-flat:thumbs-down'
  };

  if (!dialog || !grid) {
    return;
  }

  if (createToggle && createBody) {
    createToggle.addEventListener('click', () => {
      const isOpen = !createBody.hidden;
      createBody.hidden = isOpen;
      createToggle.setAttribute('aria-expanded', String(!isOpen));
      createToggle.classList.toggle('open', !isOpen);
    });
  }

  const choices = Array.from(grid.querySelectorAll('.icon-choice'));

  function normalizeIcon(value) {
    return iconAliases[value] || value;
  }

  function isIconifyName(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
      if (!submitting && button.dataset.keepDisabled) {
        return;
      }
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

  function iconMarkup(value, className) {
    const normalizedValue = normalizeIcon(value || 'fluent-emoji-flat:glowing-star');
    if (isIconifyName(normalizedValue)) {
      const icon = document.createElement('iconify-icon');
      icon.className = className;
      icon.setAttribute('icon', normalizedValue);
      icon.setAttribute('aria-hidden', 'true');
      return icon.outerHTML;
    }
    const span = document.createElement('span');
    span.className = className;
    span.textContent = normalizedValue;
    return span.outerHTML;
  }

  function syncEditorSummary(form) {
    const editor = form.closest('.item-editor');
    if (!editor || form.action.endsWith('/delete')) {
      return;
    }
    const nameInput = form.querySelector('input[name="name"]');
    const pointsInput = form.querySelector('input[name="points"]');
    const sortInput = form.querySelector('input[name="sortOrder"]');
    const iconInput = form.querySelector('input[name="icon"]');
    const enabledInput = form.querySelector('input[name="enabled"]:checked');
    if (!nameInput || !pointsInput || !sortInput || !iconInput) {
      return;
    }
    const name = nameInput.value.trim();
    const points = Number(pointsInput.value);
    const sortOrder = sortInput.value;
    const icon = normalizeIcon(iconInput.value);
    const enabled = Boolean(enabledInput);
    const preview = editor.querySelector('.item-preview');
    const title = editor.querySelector('.item-preview h3');
    const meta = editor.querySelector('.item-preview h3 + span');
    const status = editor.querySelector('.status-pill');
    const type = editor.querySelector('.type-pill');
    const iconNode = editor.querySelector('.item-preview-icon');
    const deleteForm = editor.querySelector('.button-row.async-quick-form');
    const deleteButton = deleteForm?.querySelector('button[type="submit"]');

    if (preview) {
      preview.classList.toggle('add', points > 0);
      preview.classList.toggle('subtract', points < 0);
    }
    if (title) {
      title.textContent = name;
    }
    if (meta) {
      meta.textContent = `${points > 0 ? '+' : ''}${points} 分 · 位置 ${sortOrder}`;
    }
    if (status) {
      status.classList.toggle('enabled', enabled);
      status.classList.toggle('disabled', !enabled);
      status.textContent = enabled ? '启用中' : '已停用';
    }
    if (type) {
      type.classList.toggle('add', points > 0);
      type.classList.toggle('subtract', points < 0);
      type.textContent = points > 0 ? '加分' : '减分';
    }
    if (iconNode) {
      iconNode.outerHTML = iconMarkup(icon, 'item-preview-icon');
    }
    if (deleteForm) {
      deleteForm.dataset.confirmDetail = `${name} 将不再显示在首页。`;
    }
    if (deleteButton) {
      deleteButton.disabled = !enabled;
      if (enabled) {
        delete deleteButton.dataset.keepDisabled;
      } else {
        deleteButton.dataset.keepDisabled = '1';
      }
    }
    editor.classList.toggle('disabled', !enabled);
    hydrateEditorMetadata(editor);
  }

  function syncDeletedEditor(form) {
    if (!form.action.endsWith('/delete')) {
      return;
    }
    const editor = form.closest('.item-editor');
    if (!editor) {
      return;
    }
    const checkbox = editor.querySelector('input[name="enabled"]');
    const status = editor.querySelector('.status-pill');
    const deleteButton = form.querySelector('button[type="submit"]');
    editor.classList.add('disabled');
    if (checkbox) {
      checkbox.checked = false;
    }
    if (deleteButton) {
      deleteButton.dataset.keepDisabled = '1';
      deleteButton.disabled = true;
    }
    if (status) {
      status.classList.remove('enabled');
      status.classList.add('disabled');
      status.textContent = '已停用';
    }
    hydrateEditorMetadata(editor);
  }

  function readEditorData(editor) {
    const form = editor.querySelector('form.quick-item-form');
    if (!form) {
      return null;
    }
    const idMatch = form.action.match(/\/quick-items\/(\d+)$/);
    const id = Number(editor.dataset.itemId || (idMatch ? idMatch[1] : 0));
    const name = form.querySelector('input[name="name"]')?.value.trim() || '';
    const points = Number(form.querySelector('input[name="points"]')?.value || 0);
    const sortOrder = Number(form.querySelector('input[name="sortOrder"]')?.value || 0);
    const icon = normalizeIcon(form.querySelector('input[name="icon"]')?.value || '');
    const enabled = Boolean(form.querySelector('input[name="enabled"]')?.checked);
    return { id, name, points, sortOrder, icon, enabled };
  }

  function hydrateEditorMetadata(editor) {
    const data = readEditorData(editor);
    if (!data) {
      return;
    }
    editor.dataset.itemId = String(data.id);
    editor.dataset.enabled = data.enabled ? '1' : '0';
    editor.dataset.points = String(data.points);
    editor.dataset.sortOrder = String(data.sortOrder);
  }

  function compareEditors(left, right) {
    const leftEnabled = Number(left.dataset.enabled || 0);
    const rightEnabled = Number(right.dataset.enabled || 0);
    if (leftEnabled !== rightEnabled) {
      return rightEnabled - leftEnabled;
    }

    const leftSort = Number(left.dataset.sortOrder || 0);
    const rightSort = Number(right.dataset.sortOrder || 0);
    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    return Number(left.dataset.itemId || 0) - Number(right.dataset.itemId || 0);
  }

  function placeEditor(editor) {
    if (!editorList) {
      return;
    }
    hydrateEditorMetadata(editor);
    const editors = Array.from(editorList.querySelectorAll('.item-editor')).filter((item) => item !== editor);
    const before = editors.find((item) => compareEditors(editor, item) < 0);
    editorList.insertBefore(editor, before || null);
  }

  function updatePageSummary() {
    const editors = Array.from(document.querySelectorAll('.item-editor'));
    const data = editors.map(readEditorData).filter(Boolean);
    const enabled = data.filter((item) => item.enabled).length;
    const add = data.filter((item) => item.points > 0).length;
    const subtract = data.filter((item) => item.points < 0).length;
    const disabled = data.length - enabled;

    [enabled, add, subtract, disabled].forEach((value, index) => {
      if (metricValues[index]) {
        metricValues[index].textContent = value;
      }
    });

    if (listCount) {
      listCount.textContent = `${data.length} 项`;
    }
  }

  function removeEmptyMessage() {
    const empty = document.querySelector('.quick-manage-section > .empty');
    if (empty) {
      empty.remove();
    }
  }

  function getNextSortOrder() {
    const sortOrders = Array.from(document.querySelectorAll('.item-editor'))
      .map((editor) => Number(readEditorData(editor)?.sortOrder || 0))
      .filter((value) => Number.isFinite(value));
    return sortOrders.length ? Math.max(...sortOrders) + 10 : 10;
  }

  function resetCreateForm(form) {
    form.reset();
    const iconInput = form.querySelector('input[name="icon"]');
    const sortInput = form.querySelector('input[name="sortOrder"]');
    const trigger = form.querySelector('[data-icon-picker]');

    if (iconInput) {
      iconInput.value = normalizeIcon(iconInput.defaultValue || 'fluent-emoji-flat:open-book');
    }
    if (sortInput) {
      sortInput.value = getNextSortOrder();
    }
    if (trigger) {
      syncTrigger(trigger);
    }
  }

  function csrfToken() {
    return document.querySelector('input[name="_csrf"]')?.value || '';
  }

  function createEditorElement(item) {
    const id = Number(item.id);
    const points = Number(item.points);
    const sortOrder = Number(item.sort_order);
    const enabled = Boolean(Number(item.enabled));
    const icon = normalizeIcon(item.icon || '');
    const name = String(item.name || '');
    const typeClass = points > 0 ? 'add' : 'subtract';
    const typeLabel = points > 0 ? '加分' : '减分';
    const statusLabel = enabled ? '启用中' : '已停用';
    const selectedLabel = getLabelForIcon(icon);
    const details = document.createElement('details');

    details.className = `card item-editor ${enabled ? '' : 'disabled'}`.trim();
    details.dataset.itemId = String(id);
    details.dataset.enabled = enabled ? '1' : '0';
    details.dataset.points = String(points);
    details.dataset.sortOrder = String(sortOrder);
    details.innerHTML = `
      <summary class="item-editor-summary">
        <div class="item-preview ${typeClass}">
          ${iconMarkup(icon || (points > 0 ? '⭐' : '☁️'), 'item-preview-icon')}
          <div>
            <h3>${escapeHtml(name)}</h3>
            <span>${points > 0 ? '+' : ''}${points} 分 · 位置 ${sortOrder}</span>
          </div>
        </div>
        <div class="item-summary-actions">
          <div class="item-badges">
            <span class="status-pill ${enabled ? 'enabled' : 'disabled'}">${statusLabel}</span>
            <span class="type-pill ${typeClass}">${typeLabel}</span>
          </div>
          <span class="edit-toggle">编辑</span>
        </div>
      </summary>

      <form class="stack-form quick-item-form async-quick-form" method="post" action="/quick-items/${id}" autocomplete="off">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken())}">
        <div class="form-row">
          <label>
            <span>名称</span>
            <input type="text" name="name" maxlength="100" value="${escapeHtml(name)}" autocomplete="off" autocorrect="off" spellcheck="false" required>
          </label>
          <label>
            <span>图标</span>
            <input class="icon-value-input" type="hidden" name="icon" value="${escapeHtml(icon)}">
            <button class="icon-picker-trigger" type="button" data-icon-picker data-target-name="icon" aria-label="选择图标">
              ${iconMarkup(icon || (points > 0 ? '⭐' : '☁️'), 'selected-icon-preview')}
              <span class="selected-icon-name">${escapeHtml(selectedLabel)}</span>
            </button>
          </label>
        </div>
        <div class="form-row">
          <label>
            <span>积分</span>
            <input type="number" name="points" step="1" inputmode="numeric" value="${points}" autocomplete="off" required>
          </label>
          <label>
            <span>排序</span>
            <input type="number" name="sortOrder" step="1" inputmode="numeric" value="${sortOrder}" aria-label="排序，数字越小越靠前" autocomplete="off" required>
          </label>
        </div>
        <div class="form-footer">
          <label class="check-line">
            <input type="checkbox" name="enabled" value="1" ${enabled ? 'checked' : ''}>
            <span>首页展示</span>
          </label>
          <button class="primary-button compact" type="submit">保存</button>
        </div>
      </form>

      <form class="button-row async-quick-form" method="post" action="/quick-items/${id}/delete" data-confirm-title="停用快捷项" data-confirm-detail="${escapeHtml(name)} 将不再显示在首页。">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken())}">
        <button class="danger-button compact" type="submit" ${enabled ? '' : 'disabled'}>停用</button>
      </form>
    `;

    bindIconTrigger(details.querySelector('[data-icon-picker]'));
    details.querySelectorAll('.async-quick-form').forEach(bindQuickForm);
    return details;
  }

  function insertCreatedItem(item) {
    if (!editorList || !item) {
      return;
    }
    const editor = createEditorElement(item);
    removeEmptyMessage();
    editorList.appendChild(editor);
    placeEditor(editor);
    updatePageSummary();
  }

  function isCreateForm(form) {
    return Boolean(form.closest('.quick-create-panel'));
  }

  async function parseJsonResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (response.redirected) {
        throw new Error('页面已过期或登录状态已变化，请刷新后重试。');
      }
      throw new Error(response.ok ? '服务器返回格式异常，请刷新后重试。' : '操作失败。');
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('服务器返回格式异常，请刷新后重试。');
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.message || '操作失败。');
    }
    return result;
  }

  function getLabelForIcon(value) {
    const matched = choices.find((choice) => choice.dataset.iconValue === normalizeIcon(value));
    return matched ? matched.dataset.iconLabel : '自定义图标';
  }

  function setTriggerIcon(trigger, value, label) {
    const preview = trigger.querySelector('.selected-icon-preview');
    const labelNode = trigger.querySelector('.selected-icon-name');
    const normalizedValue = normalizeIcon(value);
    if (preview) {
      if (isIconifyName(normalizedValue)) {
        const icon = document.createElement('iconify-icon');
        icon.className = 'selected-icon-preview';
        icon.setAttribute('icon', normalizedValue);
        icon.setAttribute('aria-hidden', 'true');
        preview.replaceWith(icon);
      } else {
        const span = document.createElement('span');
        span.className = 'selected-icon-preview';
        span.textContent = normalizedValue || '⭐';
        preview.replaceWith(span);
      }
    }
    if (labelNode) {
      labelNode.textContent = label || getLabelForIcon(value);
    }
  }

  function syncTrigger(trigger) {
    const input = trigger.parentElement.querySelector(`input[name="${trigger.dataset.targetName}"]`);
    if (!input) {
      return;
    }
    const value = normalizeIcon(input.value);
    input.value = value;
    setTriggerIcon(trigger, value, getLabelForIcon(value));
  }

  function updateSelection(value) {
    const normalizedValue = normalizeIcon(value);
    choices.forEach((choice) => {
      choice.classList.toggle('selected', choice.dataset.iconValue === normalizedValue);
    });
  }

  function openPicker(trigger) {
    activeTrigger = trigger;
    activeInput = trigger.parentElement.querySelector(`input[name="${trigger.dataset.targetName}"]`);
    if (activeInput) {
      activeInput.value = normalizeIcon(activeInput.value);
    }
    updateSelection(activeInput ? activeInput.value : '');
    if (search) {
      search.value = '';
      filterChoices('');
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    if (search) {
      search.focus();
    }
  }

  function closePicker() {
    if (dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function filterChoices(term) {
    const keyword = term.trim().toLowerCase();
    choices.forEach((choice) => {
      const haystack = `${choice.dataset.iconLabel} ${choice.dataset.iconValue}`.toLowerCase();
      choice.hidden = keyword !== '' && !haystack.includes(keyword);
    });
  }

  function bindIconTrigger(trigger) {
    if (!trigger || trigger.dataset.iconPickerBound) {
      return;
    }
    trigger.dataset.iconPickerBound = '1';
    syncTrigger(trigger);
    trigger.addEventListener('click', () => openPicker(trigger));
  }

  function bindQuickForm(form) {
    if (!form || form.dataset.quickFormBound) {
      return;
    }
    form.dataset.quickFormBound = '1';
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
        const result = await parseJsonResponse(response);

        if (isCreateForm(form)) {
          insertCreatedItem(result.item);
          resetCreateForm(form);
        } else {
          syncEditorSummary(form);
          syncDeletedEditor(form);
          const editor = form.closest('.item-editor');
          if (editor) {
            placeEditor(editor);
          }
          updatePageSummary();
        }
        showFlash('success', result.message || '已保存。');
      } catch (error) {
        showFlash('error', error.message || '操作失败。');
      } finally {
        setSubmitting(form, false);
      }
    });
  }

  document.querySelectorAll('[data-icon-picker]').forEach(bindIconTrigger);

  choices.forEach((choice) => {
    choice.addEventListener('click', () => {
      const value = choice.dataset.iconValue;
      const label = choice.dataset.iconLabel;
      if (activeInput) {
        activeInput.value = value;
      }
      if (activeTrigger) {
        setTriggerIcon(activeTrigger, value, label);
      }
      closePicker();
    });
  });

  if (search) {
    search.addEventListener('input', () => filterChoices(search.value));
  }

  if (closeButton) {
    closeButton.addEventListener('click', closePicker);
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closePicker();
    }
  });

  document.querySelectorAll('.item-editor').forEach(hydrateEditorMetadata);
  document.querySelectorAll('.async-quick-form').forEach(bindQuickForm);
})();
