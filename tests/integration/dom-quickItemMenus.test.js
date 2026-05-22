import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const quickItemsScript = fs.readFileSync(
  path.join(__dirname, '../../public/quick-items.js'),
  'utf8'
);

function runQuickItemsScript() {
  window.eval(quickItemsScript);
}

function openMenu(menu) {
  menu.setAttribute('open', '');
  menu.dispatchEvent(new Event('toggle'));
}

describe('quick item more menu DOM behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="page-shell">
        <main class="quick-items-page">
          <section class="flash-area"></section>
          <dialog id="iconPickerDialog"><div id="iconPickerGrid"></div></dialog>
          <button data-icon-picker-close type="button">close</button>
          <button data-create-toggle type="button">create</button>
          <dialog data-create-dialog id="quickCreateDialog">
            <form data-quick-dialog-form data-mode="create" action="/quick-items">
              <input name="_csrf" value="csrf">
              <input name="name">
              <input name="points">
              <input name="sortOrder" value="10">
              <input name="icon" value="fluent-emoji-flat:open-book">
              <input name="enabled" type="checkbox" checked>
              <button data-icon-picker data-target-name="icon" type="button">
                <span class="selected-icon-preview"></span>
                <span class="selected-icon-name"></span>
              </button>
            </form>
          </dialog>
          <button data-create-close type="button">close create</button>
          <h2 data-dialog-title></h2>
          <p data-dialog-hint></p>
          <button data-submit-label></button>
          <span data-enabled-label></span>
          <button data-quick-tab="add" type="button"></button>
          <button data-quick-tab="subtract" type="button"></button>
          <div data-quick-panel="add">
            <div class="quick-editor-list" data-points-type="add">
              <article class="item-editor" data-item-id="1" data-name="a" data-points="1" data-icon="" data-sort-order="1" data-enabled="1">
                <details class="item-more-menu"><summary>...</summary><div class="item-more-actions"></div></details>
              </article>
              <article class="item-editor" data-item-id="2" data-name="b" data-points="2" data-icon="" data-sort-order="2" data-enabled="1">
                <details class="item-more-menu"><summary>...</summary><div class="item-more-actions"></div></details>
              </article>
            </div>
            <p class="quick-tab-empty" hidden></p>
          </div>
          <div data-quick-panel="subtract" hidden>
            <div class="quick-editor-list" data-points-type="subtract"></div>
            <p class="quick-tab-empty" hidden></p>
          </div>
          <span class="list-count"></span>
          <div class="quick-admin-metrics"><strong></strong><strong></strong><strong></strong><strong></strong></div>
        </main>
      </div>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps only one more menu open at a time', () => {
    runQuickItemsScript();
    const [first, second] = document.querySelectorAll('.item-more-menu');

    openMenu(first);
    expect(first.open).toBe(true);

    openMenu(second);
    expect(second.open).toBe(true);
    expect(first.open).toBe(false);
  });

  it('closes menus on outside click, Escape, and tab switch', () => {
    runQuickItemsScript();
    const [first] = document.querySelectorAll('.item-more-menu');

    openMenu(first);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(first.open).toBe(false);

    openMenu(first);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(first.open).toBe(false);

    openMenu(first);
    document.querySelector('[data-quick-tab="subtract"]').click();
    expect(first.open).toBe(false);
  });
});
