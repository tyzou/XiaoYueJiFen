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

function pressEvent(type, x = 0, y = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y }
  });
  return event;
}

describe('transaction long press delete DOM behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div class="page-shell">
        <main>
          <section class="flash-area"></section>
          <article
            class="timeline-item deletable-transaction"
            data-deletable-transaction
            data-delete-url="/transactions/1/delete"
            data-csrf-token="csrf-token"
          >
            <div class="timeline-main"><strong>today manual</strong></div>
            <div class="timeline-points positive">+3</div>
          </article>
        </main>
      </div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it('opens confirm dialog after a 1000ms long press', () => {
    runAppActions();

    const item = document.querySelector('[data-deletable-transaction]');
    item.dispatchEvent(pressEvent('pointerdown'));
    expect(item.classList.contains('is-long-pressing')).toBe(true);
    vi.advanceTimersByTime(999);
    expect(document.querySelector('.confirm-dialog').hasAttribute('open')).toBe(false);
    expect(item.classList.contains('is-long-pressing')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(document.querySelector('.confirm-dialog').hasAttribute('open')).toBe(true);
    expect(item.classList.contains('is-long-pressing')).toBe(false);
    expect(document.querySelector('.confirm-copy h2').textContent).toBe('删除今日记录');
  });

  it('does not open confirm dialog for short press or scroll movement', () => {
    runAppActions();

    const item = document.querySelector('[data-deletable-transaction]');
    item.dispatchEvent(pressEvent('pointerdown'));
    vi.advanceTimersByTime(300);
    item.dispatchEvent(pressEvent('pointerup'));
    vi.advanceTimersByTime(700);
    expect(document.querySelector('.confirm-dialog').hasAttribute('open')).toBe(false);
    expect(item.classList.contains('is-long-pressing')).toBe(false);

    item.dispatchEvent(pressEvent('pointerdown', 0, 0));
    item.dispatchEvent(pressEvent('pointermove', 0, 24));
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.confirm-dialog').hasAttribute('open')).toBe(false);
    expect(item.classList.contains('is-long-pressing')).toBe(false);
  });

  it('cancels long press on page scroll', () => {
    runAppActions();

    const item = document.querySelector('[data-deletable-transaction]');
    item.dispatchEvent(pressEvent('pointerdown'));
    expect(item.classList.contains('is-long-pressing')).toBe(true);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(1000);

    expect(document.querySelector('.confirm-dialog').hasAttribute('open')).toBe(false);
    expect(item.classList.contains('is-long-pressing')).toBe(false);
  });
});
