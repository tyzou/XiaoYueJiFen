import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appActionsScript = fs.readFileSync(
  path.join(__dirname, '../../public/app-actions.js'),
  'utf8'
);

function runAppActions() {
  window.eval(appActionsScript);
}

describe('home date selector DOM behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div class="page-shell">
        <main>
          <section class="flash-area"></section>
          <div class="score-value"><strong>0</strong></div>
          <span data-today-score-value>+0</span>
          <fieldset data-date-selector>
            <label><input type="radio" name="scoreDateSelection" value="2025-01-12" checked><span>今天</span></label>
            <label><input type="radio" name="scoreDateSelection" value="2025-01-11"><span>昨天</span></label>
            <label><input type="radio" name="scoreDateSelection" value="2025-01-10"><span>前天</span></label>
          </fieldset>
          <form class="async-score-form" action="/score/quick/1" method="post" data-keep-values="1">
            <input type="hidden" name="selectedDate" value="2025-01-12" data-selected-date-field>
            <button class="quick-button" type="submit"><strong>+2</strong></button>
          </form>
          <form class="async-score-form" action="/score/manual" method="post">
            <input type="hidden" name="selectedDate" value="2025-01-12" data-selected-date-field>
            <input name="pointsDelta" value="5">
            <input name="reason" value="test">
            <button type="submit">manual</button>
          </form>
          <form class="async-score-form" action="/score/adjust" method="post" data-keep-values="1">
            <input type="hidden" name="selectedDate" value="adjust-should-not-sync">
            <button type="submit">adjust</button>
          </form>
        </main>
      </div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it('切换日期会同步快捷和手动记录 hidden 字段，不影响设置总积分表单', () => {
    runAppActions();

    document.querySelector('input[value="2025-01-11"]').checked = true;
    document
      .querySelector('input[value="2025-01-11"]')
      .dispatchEvent(new Event('change', { bubbles: true }));

    const syncedFields = Array.from(document.querySelectorAll('[data-selected-date-field]'));
    expect(syncedFields.map((field) => field.value)).toEqual([
      '2025-01-11',
      '2025-01-11'
    ]);
    expect(document.querySelector('form[action="/score/adjust"] input[name="selectedDate"]').value).toBe(
      'adjust-should-not-sync'
    );
  });

  it('手动表单提交成功并 reset 后，hidden 字段仍保持当前选择', async () => {
    runAppActions();

    document.querySelector('input[value="2025-01-10"]').checked = true;
    document
      .querySelector('input[value="2025-01-10"]')
      .dispatchEvent(new Event('change', { bubbles: true }));

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, message: '已保存。', currentScore: 5 })
    }));

    const manualForm = document.querySelector('form[action="/score/manual"]');
    manualForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(manualForm.querySelector('[data-selected-date-field]').value).toBe('2025-01-10');
  });

  it('当天提交会同步今日积分，非当天提交不会计入今日积分', async () => {
    runAppActions();

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, message: '已保存。', currentScore: 5 })
    }));

    const manualForm = document.querySelector('form[action="/score/manual"]');
    manualForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-today-score-value]').textContent).toBe('+5');

    document.querySelector('input[value="2025-01-11"]').checked = true;
    document
      .querySelector('input[value="2025-01-11"]')
      .dispatchEvent(new Event('change', { bubbles: true }));

    const quickForm = document.querySelector('form[action="/score/quick/1"]');
    quickForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-today-score-value]').textContent).toBe('+5');
  });
});
