import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const styles = fs.readFileSync(path.join(__dirname, '../../public/styles.css'), 'utf8');

describe('transaction long press delete styles', () => {
  it('keeps long press feedback quiet without the red orbit effect', () => {
    expect(styles).toContain('.timeline-item.deletable-transaction.is-long-pressing');
    expect(styles).not.toContain('@keyframes transaction-delete-orbit');
    expect(styles).not.toContain('.timeline-item.deletable-transaction.is-long-pressing::after');
    expect(styles).not.toContain('animation: transaction-delete-orbit');
    expect(styles).toContain('-webkit-tap-highlight-color: transparent');
    expect(styles).toContain('-webkit-touch-callout: none');
  });

  it('centers the confirmation dialog', () => {
    expect(styles).toContain('.confirm-dialog');
    expect(styles).toContain('margin: auto');
    expect(styles).not.toContain('align-self: end');
    expect(styles).not.toContain('margin-bottom: 84px');
  });
});
