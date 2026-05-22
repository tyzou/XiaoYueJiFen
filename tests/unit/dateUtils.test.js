import { describe, it, expect } from 'vitest';
import {
  formatYmd,
  getServerToday,
  getRecentDays,
  isYmd,
  isWithinRecentDays,
  buildTransactionDateTime,
  resolveSelectedDate
} from '../../src/utils/dateUtils.js';

// 固定的"现在"用于断言：2025-01-12 10:30:00.000（本地时区）
function fixedNow() {
  return new Date(2025, 0, 12, 10, 30, 0, 0);
}

describe('formatYmd', () => {
  it('格式化为 YYYY-MM-DD 并对单位数月/日补零', () => {
    expect(formatYmd(new Date(2025, 0, 1))).toBe('2025-01-01');
    expect(formatYmd(new Date(2025, 8, 9))).toBe('2025-09-09');
    expect(formatYmd(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('对闰年 2024-02-29 正确格式化', () => {
    expect(formatYmd(new Date(2024, 1, 29))).toBe('2024-02-29');
  });
});

describe('getServerToday', () => {
  it('返回 now 的本地日历日 YYYY-MM-DD', () => {
    expect(getServerToday(fixedNow())).toBe('2025-01-12');
  });
});

describe('getRecentDays', () => {
  it('在固定 now=2025-01-12 时返回今天/昨天/前天', () => {
    const days = getRecentDays(fixedNow());
    expect(days).toHaveLength(3);
    expect(days[0]).toEqual({ value: '2025-01-12', label: '今天', shortDate: '01-12' });
    expect(days[1]).toEqual({ value: '2025-01-11', label: '昨天', shortDate: '01-11' });
    expect(days[2]).toEqual({ value: '2025-01-10', label: '前天', shortDate: '01-10' });
  });

  it('跨月边界：now=2025-03-01 时前天应为 2025-02-27', () => {
    const days = getRecentDays(new Date(2025, 2, 1, 8, 0, 0));
    expect(days.map((d) => d.value)).toEqual(['2025-03-01', '2025-02-28', '2025-02-27']);
    expect(days[2].shortDate).toBe('02-27');
  });

  it('跨年边界：now=2025-01-01 时前天应为 2024-12-30', () => {
    const days = getRecentDays(new Date(2025, 0, 1, 23, 59, 59));
    expect(days.map((d) => d.value)).toEqual(['2025-01-01', '2024-12-31', '2024-12-30']);
    expect(days[1].shortDate).toBe('12-31');
    expect(days[2].shortDate).toBe('12-30');
  });

  it('闰年边界：now=2024-03-01 时前天应为 2024-02-28（闰年向回退到 02-29）', () => {
    const days = getRecentDays(new Date(2024, 2, 1, 12, 0, 0));
    expect(days.map((d) => d.value)).toEqual(['2024-03-01', '2024-02-29', '2024-02-28']);
  });

  it('value 严格降序、长度恰好为 3', () => {
    const days = getRecentDays(fixedNow());
    expect(days[0].value > days[1].value).toBe(true);
    expect(days[1].value > days[2].value).toBe(true);
  });
});

describe('isYmd', () => {
  it('接受合法日期', () => {
    expect(isYmd('2025-01-12')).toBe(true);
    expect(isYmd('2024-02-29')).toBe(true);
  });

  it('拒绝格式不匹配或非合法日历日', () => {
    expect(isYmd('2025-1-1')).toBe(false);
    expect(isYmd('2025-13-01')).toBe(false);
    expect(isYmd('2025-02-30')).toBe(false);
    expect(isYmd('2024-13-01')).toBe(false);
    expect(isYmd('9999-99-99')).toBe(false);
    expect(isYmd('abcd-ef-gh')).toBe(false);
    expect(isYmd('')).toBe(false);
    expect(isYmd(null)).toBe(false);
    expect(isYmd(undefined)).toBe(false);
    expect(isYmd(20250112)).toBe(false);
  });
});

describe('isWithinRecentDays', () => {
  it('对今天/昨天/前天返回 true', () => {
    const now = fixedNow();
    expect(isWithinRecentDays('2025-01-12', now)).toBe(true);
    expect(isWithinRecentDays('2025-01-11', now)).toBe(true);
    expect(isWithinRecentDays('2025-01-10', now)).toBe(true);
  });

  it('对 3 天前及更早或未来日期返回 false', () => {
    const now = fixedNow();
    expect(isWithinRecentDays('2025-01-09', now)).toBe(false);
    expect(isWithinRecentDays('2025-01-13', now)).toBe(false);
    expect(isWithinRecentDays('2024-01-12', now)).toBe(false);
  });

  it('对格式非法值返回 false', () => {
    const now = fixedNow();
    expect(isWithinRecentDays('2025-13-40', now)).toBe(false);
    expect(isWithinRecentDays('not-a-date', now)).toBe(false);
  });
});

describe('buildTransactionDateTime', () => {
  it('日期部分采用 selectedDate，时间部分采用 now', () => {
    const now = new Date(2025, 0, 12, 10, 30, 45, 123);
    const built = buildTransactionDateTime('2025-01-10', now);
    expect(built.getFullYear()).toBe(2025);
    expect(built.getMonth()).toBe(0);
    expect(built.getDate()).toBe(10);
    expect(built.getHours()).toBe(10);
    expect(built.getMinutes()).toBe(30);
    expect(built.getSeconds()).toBe(45);
    expect(built.getMilliseconds()).toBe(123);
  });

  it('selectedDate = today 时等同于 now 的本地时刻', () => {
    const now = new Date(2025, 0, 12, 23, 59, 59, 0);
    const built = buildTransactionDateTime('2025-01-12', now);
    expect(formatYmd(built)).toBe('2025-01-12');
    expect(built.getHours()).toBe(23);
    expect(built.getMinutes()).toBe(59);
    expect(built.getSeconds()).toBe(59);
  });

  it('在跨月场景下日期部分仍正确', () => {
    const now = new Date(2025, 2, 1, 0, 0, 5, 0); // 2025-03-01 00:00:05
    const built = buildTransactionDateTime('2025-02-27', now);
    expect(formatYmd(built)).toBe('2025-02-27');
    expect(built.getHours()).toBe(0);
    expect(built.getSeconds()).toBe(5);
  });
});

describe('resolveSelectedDate 错误文案严格相等', () => {
  const now = fixedNow();

  it('缺省/null/空串返回 null', () => {
    expect(resolveSelectedDate(undefined, now)).toBe(null);
    expect(resolveSelectedDate(null, now)).toBe(null);
    expect(resolveSelectedDate('', now)).toBe(null);
  });

  it('合法且在最近 3 天内时返回原值', () => {
    expect(resolveSelectedDate('2025-01-12', now)).toBe('2025-01-12');
    expect(resolveSelectedDate('2025-01-11', now)).toBe('2025-01-11');
    expect(resolveSelectedDate('2025-01-10', now)).toBe('2025-01-10');
  });

  it('格式不正确时抛出 message 严格等于 "日期格式不正确。"', () => {
    const inputs = [
      '2025-1-1',
      '2025-13-01',
      '2025-02-30',
      '2024-13-01',
      '9999-99-99',
      'abcd-ef-gh',
      '20250112'
    ];
    for (const raw of inputs) {
      let err;
      try {
        resolveSelectedDate(raw, now);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('日期格式不正确。');
    }
  });

  it('合法但不在最近 3 天内时抛出 message 严格等于 "所选日期不在最近 3 天内。"', () => {
    const inputs = [
      '2025-01-09', // 3 天前
      '2025-01-13', // 明天（未来）
      '2024-12-31', // 远早
      '2099-01-01' // 远未来
    ];
    for (const raw of inputs) {
      let err;
      try {
        resolveSelectedDate(raw, now);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('所选日期不在最近 3 天内。');
    }
  });

  it('校验顺序：先判格式再判范围（格式非法优先报格式错）', () => {
    // 格式非法且也不在范围内，应优先抛"日期格式不正确。"
    let err;
    try {
      resolveSelectedDate('2025-13-40', now);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('日期格式不正确。');
  });
});
