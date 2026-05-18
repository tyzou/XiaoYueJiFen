(function () {
  const dialog = document.getElementById('iconPickerDialog');
  const grid = document.getElementById('iconPickerGrid');
  const search = document.getElementById('iconPickerSearch');
  const closeButton = document.querySelector('[data-icon-picker-close]');
  const flashArea = document.querySelector('.flash-area') || createFlashArea();
  const confirmDialog = createConfirmDialog();
  const createToggle = document.querySelector('[data-create-toggle]');
  const createDialog = document.querySelector('[data-create-dialog]');
  const createCloseButton = document.querySelector('[data-create-close]');
  const quickDialogForm = document.querySelector('[data-quick-dialog-form]');
  const quickDialogTitle = document.querySelector('[data-dialog-title]');
  const quickDialogHint = document.querySelector('[data-dialog-hint]');
  const quickSubmitLabel = document.querySelector('[data-submit-label]');
  const quickEnabledLabel = document.querySelector('[data-enabled-label]');
  const editorLists = Array.from(document.querySelectorAll('.quick-editor-list'));
  const quickTabs = Array.from(document.querySelectorAll('[data-quick-tab]'));
  const quickPanels = Array.from(document.querySelectorAll('[data-quick-panel]'));
  const listCount = document.querySelector('.list-count');
  const metricValues = Array.from(document.querySelectorAll('.quick-admin-metrics strong'));
  let activeTrigger = null;
  let activeInput = null;
  let editingEditor = null;

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

  function setDialogMode(mode) {
    if (!quickDialogForm) {
      return;
    }
    const isEdit = mode === 'edit';
    quickDialogForm.dataset.mode = isEdit ? 'edit' : 'create';
    quickDialogForm.action = isEdit && editingEditor
      ? `/quick-items/${editingEditor.dataset.itemId}`
      : '/quick-items';
    if (quickDialogTitle) {
      quickDialogTitle.textContent = isEdit ? '编辑快捷项' : '新增快捷项';
    }
    if (quickDialogHint) {
      quickDialogHint.textContent = isEdit ? '修改后会同步更新首页快捷按钮。' : '选择一个图标，首页更容易识别。';
    }
    if (quickSubmitLabel) {
      quickSubmitLabel.textContent = isEdit ? '保存' : '新增快捷项';
    }
    if (quickEnabledLabel) {
      quickEnabledLabel.textContent = isEdit ? '首页展示' : '立即启用';
    }
  }

  function setCreateOpen(isOpen) {
    if (!createDialog) {
      return;
    }
    if (isOpen) {
      if (typeof createDialog.showModal === 'function') {
        createDialog.showModal();
      } else {
        createDialog.setAttribute('open', '');
      }
      const firstField = createDialog.querySelector('input[name="name"]');
      if (firstField) {
        firstField.focus();
      }
    } else if (createDialog.open && typeof createDialog.close === 'function') {
      createDialog.close();
    } else {
      createDialog.removeAttribute('open');
    }
    if (createToggle) {
      createToggle.setAttribute('aria-expanded', String(isOpen));
      createToggle.classList.toggle('open', isOpen);
    }
  }

  function isBackdropClick(event, targetDialog) {
    if (event.target !== targetDialog) {
      return false;
    }
    const rect = targetDialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }

  if (createToggle && createDialog) {
    createToggle.addEventListener('click', () => {
      if (!createDialog.open && quickDialogForm) {
        editingEditor = null;
        resetCreateForm(quickDialogForm);
        setDialogMode('create');
      }
      setCreateOpen(!createDialog.open);
    });
  }

  if (createCloseButton) {
    createCloseButton.addEventListener('click', () => setCreateOpen(false));
  }

  if (createDialog) {
    createDialog.addEventListener('close', () => setCreateOpen(false));
    createDialog.addEventListener('click', (event) => {
      if (isBackdropClick(event, createDialog)) {
        setCreateOpen(false);
      }
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

  function toUrlEncodedBody(form) {
    return new URLSearchParams(new FormData(form));
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

  function readFormData(form) {
    const name = form.querySelector('input[name="name"]')?.value.trim() || '';
    const points = Number(form.querySelector('input[name="points"]')?.value || 0);
    const sortOrder = Number(form.querySelector('input[name="sortOrder"]')?.value || 0);
    const icon = normalizeIcon(form.querySelector('input[name="icon"]')?.value || '');
    const enabled = Boolean(form.querySelector('input[name="enabled"]')?.checked);
    return { name, points, sortOrder, icon, enabled };
  }

  function writeFormData(form, data) {
    const nameInput = form.querySelector('input[name="name"]');
    const pointsInput = form.querySelector('input[name="points"]');
    const sortInput = form.querySelector('input[name="sortOrder"]');
    const iconInput = form.querySelector('input[name="icon"]');
    const enabledInput = form.querySelector('input[name="enabled"]');
    const trigger = form.querySelector('[data-icon-picker]');

    if (nameInput) {
      nameInput.value = data.name || '';
    }
    if (pointsInput) {
      pointsInput.value = data.points || '';
    }
    if (sortInput) {
      sortInput.value = data.sortOrder || '';
    }
    if (iconInput) {
      iconInput.value = normalizeIcon(data.icon || 'fluent-emoji-flat:open-book');
    }
    if (enabledInput) {
      enabledInput.checked = data.enabled !== false;
    }
    if (trigger) {
      syncTrigger(trigger);
    }
  }

  function syncEditorSummary(editor, data) {
    if (!editor) {
      return;
    }
    const { name, points, sortOrder, icon, enabled } = data;
    const preview = editor.querySelector('.item-preview');
    const title = editor.querySelector('.item-preview h3');
    const meta = editor.querySelector('.item-preview h3 + span');
    const type = editor.querySelector('.type-pill');
    const iconNode = editor.querySelector('.item-preview-icon');
    const deleteForm = editor.querySelector('form[action$="/delete"]');
    const toggleForm = editor.querySelector('[data-toggle-form]');
    const toggle = editor.querySelector('[data-enabled-toggle]');
    const switchLabel = editor.querySelector('.switch-label');

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
    if (type) {
      type.classList.toggle('add', points > 0);
      type.classList.toggle('subtract', points < 0);
      type.textContent = points > 0 ? '加分' : '减分';
    }
    if (iconNode) {
      iconNode.outerHTML = iconMarkup(icon, 'item-preview-icon');
    }
    if (deleteForm) {
      deleteForm.dataset.confirmDetail = `${name} 将从快捷项列表移除，历史流水会保留。`;
    }
    if (toggleForm) {
      writeFormData(toggleForm, data);
    }
    if (toggle) {
      toggle.checked = enabled;
    }
    if (switchLabel) {
      switchLabel.textContent = enabled ? '启用' : '禁用';
    }
    editor.classList.toggle('disabled', !enabled);
    editor.dataset.name = name;
    editor.dataset.points = String(points);
    editor.dataset.sortOrder = String(sortOrder);
    editor.dataset.icon = icon;
    editor.dataset.enabled = enabled ? '1' : '0';
    editor.dataset.pointsType = points > 0 ? 'add' : 'subtract';
  }

  function syncDeletedEditor(form) {
    if (!form.action.endsWith('/delete')) {
      return;
    }
    const editor = form.closest('.item-editor');
    if (!editor) {
      return;
    }
    editor.remove();
    updatePageSummary();
  }

  function readEditorData(editor) {
    if (!editor) {
      return null;
    }
    const id = Number(editor.dataset.itemId || 0);
    const name = editor.dataset.name || '';
    const points = Number(editor.dataset.points || 0);
    const sortOrder = Number(editor.dataset.sortOrder || 0);
    const icon = normalizeIcon(editor.dataset.icon || '');
    const enabled = editor.dataset.enabled === '1';
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
    editor.dataset.pointsType = data.points > 0 ? 'add' : 'subtract';
    editor.dataset.icon = data.icon;
    editor.dataset.name = data.name;
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
    const targetList = getEditorListFor(editor);
    if (!targetList) {
      return;
    }
    hydrateEditorMetadata(editor);
    const editors = Array.from(targetList.querySelectorAll('.item-editor')).filter((item) => item !== editor);
    const before = editors.find((item) => compareEditors(editor, item) < 0);
    targetList.insertBefore(editor, before || null);
    updateTabEmptyStates();
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

    updateTabCounts(data);
    updateTabEmptyStates();
  }

  function removeEmptyMessage() {
    const empty = document.querySelector('.quick-manage-section > .empty');
    if (empty) {
      empty.remove();
    }
  }

  function getPointsType(points) {
    return Number(points) > 0 ? 'add' : 'subtract';
  }

  function getEditorListFor(editor) {
    const data = readEditorData(editor);
    const type = getPointsType(data?.points || editor.dataset.points || 0);
    return document.querySelector(`.quick-editor-list[data-points-type="${type}"]`);
  }

  function updateTabCounts(data) {
    const source = data || Array.from(document.querySelectorAll('.item-editor')).map(readEditorData).filter(Boolean);
    const counts = {
      add: source.filter((item) => item.points > 0).length,
      subtract: source.filter((item) => item.points < 0).length
    };

    Object.entries(counts).forEach(([type, count]) => {
      const node = document.querySelector(`[data-tab-count="${type}"]`);
      if (node) {
        node.textContent = count;
      }
    });
  }

  function updateTabEmptyStates() {
    quickPanels.forEach((panel) => {
      const list = panel.querySelector('.quick-editor-list');
      const empty = panel.querySelector('.quick-tab-empty');
      if (empty && list) {
        empty.hidden = list.querySelectorAll('.item-editor').length > 0;
      }
    });
  }

  function activateTab(type) {
    quickTabs.forEach((tab) => {
      const active = tab.dataset.quickTab === type;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    quickPanels.forEach((panel) => {
      const active = panel.dataset.quickPanel === type;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
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

  function openEditDialog(editor) {
    if (!quickDialogForm || !editor) {
      return;
    }
    editingEditor = editor;
    const data = readEditorData(editor);
    writeFormData(quickDialogForm, data);
    setDialogMode('edit');
    setCreateOpen(true);
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
    const article = document.createElement('article');

    article.className = `card item-editor ${enabled ? '' : 'disabled'}`.trim();
    article.dataset.itemId = String(id);
    article.dataset.name = name;
    article.dataset.enabled = enabled ? '1' : '0';
    article.dataset.points = String(points);
    article.dataset.icon = icon;
    article.dataset.sortOrder = String(sortOrder);
    article.dataset.pointsType = typeClass;
    article.innerHTML = `
      <div class="item-editor-summary">
        <div class="item-preview ${typeClass}">
          ${iconMarkup(icon || (points > 0 ? '⭐' : '☁️'), 'item-preview-icon')}
          <div>
            <h3>${escapeHtml(name)}</h3>
            <span>${points > 0 ? '+' : ''}${points} 分 · 位置 ${sortOrder}</span>
          </div>
        </div>
        <div class="item-summary-actions">
          <div class="item-controls">
            <form class="quick-toggle-form async-quick-form" method="post" action="/quick-items/${id}" data-toggle-form>
              <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken())}">
              <input type="hidden" name="name" value="${escapeHtml(name)}">
              <input type="hidden" name="points" value="${points}">
              <input type="hidden" name="icon" value="${escapeHtml(icon)}">
              <input type="hidden" name="sortOrder" value="${sortOrder}">
              <label class="switch-control">
                <input type="checkbox" name="enabled" value="1" data-enabled-toggle ${enabled ? 'checked' : ''}>
                <span class="switch-track" aria-hidden="true">
                  <span class="switch-thumb"></span>
                </span>
                <span class="switch-label">${enabled ? '启用' : '禁用'}</span>
              </label>
            </form>
            <span class="type-pill ${typeClass}">${typeLabel}</span>
          </div>
          <div class="item-action-buttons">
            <button class="edit-toggle" type="button" data-edit-item>编辑</button>
            <form class="inline-delete-form async-quick-form" method="post" action="/quick-items/${id}/delete" data-confirm-title="删除快捷项" data-confirm-detail="${escapeHtml(name)} 将从快捷项列表移除，历史流水会保留。">
              <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken())}">
              <button class="danger-button compact" type="submit">删除</button>
            </form>
          </div>
        </div>
      </div>
    `;

    bindEditButton(article.querySelector('[data-edit-item]'));
    article.querySelectorAll('[data-enabled-toggle]').forEach(bindEnabledToggle);
    article.querySelectorAll('.async-quick-form').forEach(bindQuickForm);
    return article;
  }

  function insertCreatedItem(item) {
    if (!editorLists.length || !item) {
      return;
    }
    const editor = createEditorElement(item);
    removeEmptyMessage();
    placeEditor(editor);
    activateTab(getPointsType(item.points));
    updatePageSummary();
  }

  function isCreateForm(form) {
    return form.dataset.mode === 'create';
  }

  function isEditForm(form) {
    return form.dataset.mode === 'edit';
  }

  function isToggleForm(form) {
    return Boolean(form.closest('.item-editor') && form.dataset.toggleForm !== undefined);
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

  function bindEditButton(button) {
    if (!button || button.dataset.editBound) {
      return;
    }
    button.dataset.editBound = '1';
    button.addEventListener('click', () => {
      openEditDialog(button.closest('.item-editor'));
    });
  }

  function bindEnabledToggle(toggle) {
    if (!toggle || toggle.dataset.toggleBound) {
      return;
    }
    toggle.dataset.toggleBound = '1';
    toggle.addEventListener('change', () => {
      const form = toggle.closest('form');
      if (!form) {
        return;
      }
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });
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
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: toUrlEncodedBody(form)
        });
        const result = await parseJsonResponse(response);

        if (isCreateForm(form)) {
          insertCreatedItem(result.item);
          resetCreateForm(form);
          setCreateOpen(false);
        } else if (isEditForm(form)) {
          const data = readFormData(form);
          syncEditorSummary(editingEditor, data);
          if (editingEditor) {
            placeEditor(editingEditor);
            activateTab(editingEditor.dataset.pointsType);
          }
          updatePageSummary();
          setCreateOpen(false);
        } else if (isToggleForm(form)) {
          const editor = form.closest('.item-editor');
          const data = readFormData(form);
          syncEditorSummary(editor, data);
          if (editor) {
            placeEditor(editor);
            activateTab(editor.dataset.pointsType);
          }
          updatePageSummary();
        } else {
          syncDeletedEditor(form);
          updatePageSummary();
        }
        showFlash('success', result.message || '已保存。');
      } catch (error) {
        if (isToggleForm(form)) {
          const editor = form.closest('.item-editor');
          const data = readEditorData(editor);
          if (data) {
            writeFormData(form, data);
          }
        }
        showFlash('error', error.message || '操作失败。');
      } finally {
        setSubmitting(form, false);
      }
    });
  }

  document.querySelectorAll('[data-icon-picker]').forEach(bindIconTrigger);
  quickTabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.quickTab));
  });

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
    if (isBackdropClick(event, dialog)) {
      closePicker();
    }
  });

  document.querySelectorAll('.item-editor').forEach(hydrateEditorMetadata);
  updatePageSummary();
  document.querySelectorAll('[data-edit-item]').forEach(bindEditButton);
  document.querySelectorAll('[data-enabled-toggle]').forEach(bindEnabledToggle);
  document.querySelectorAll('.async-quick-form').forEach(bindQuickForm);
})();
