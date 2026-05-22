import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatYmd, getRecentDays } from '../../src/utils/dateUtils.js';

describe('dateUtils property tests', () => {
  // Feature: recent-days-score-selection, Property 1: 对任意 JS Date 实例 now，getRecentDays(now) 返回的数组长度恰好为 3，且第 i 项满足：value 等于 formatYmd(now - i 个自然日)、label 依次为 '今天'/'昨天'/'前天'、shortDate 等于该日期的 MM-DD 形式，并且 value 严格降序排列。
  // Validates: Property 1, Requirements 1.2, 1.3
  it('Property 1: getRecentDays(now) 返回结构与顺序对任意 now 都成立', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
        (now) => {
          const days = getRecentDays(now);
          const expectedLabels = ['今天', '昨天', '前天'];

          // 长度恰好为 3
          expect(days).toHaveLength(3);

          for (let i = 0; i < 3; i += 1) {
            // 第 i 项 = now 减去 i 个自然日（按本地日历日回退）
            const expectedDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - i
            );
            const expectedValue = formatYmd(expectedDate);
            const expectedShort = expectedValue.slice(5); // MM-DD

            expect(days[i].value).toBe(expectedValue);
            expect(days[i].label).toBe(expectedLabels[i]);
            expect(days[i].shortDate).toBe(expectedShort);
          }

          // value 严格降序
          expect(days[0].value > days[1].value).toBe(true);
          expect(days[1].value > days[2].value).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('dateUtils property tests - Property 9', () => {
  // Feature: recent-days-score-selection, Property 9: 对任意满足 ^\d{4}-\d{2}-\d{2}$ 且能被解析为合法日历日、但不属于 getRecentDays(now) 三个 value 之一的字符串 s，调用 resolveSelectedDate(s, now) 必抛 Error，其 message 严格等于 '所选日期不在最近 3 天内。'；并且通过 HTTP 提交时响应 status === 400 且 body.message 等于该文案，且 score_transactions 表与 settings.current_score 在请求前后保持不变。
  // Validates: Property 9, Requirements 5.1, 5.2
  it('Property 9: 越界但格式合法的 selectedDate 在 resolveSelectedDate 中必抛固定文案', async () => {
    const { resolveSelectedDate, formatYmd, getRecentDays } = await import(
      '../../src/utils/dateUtils.js'
    );

    fc.assert(
      fc.property(
        // now 限定在中段年份，确保 ±offsetDays 后仍保持 4 位年份
        fc.date({ min: new Date('2010-01-01'), max: new Date('2090-12-31') }),
        // offsetDays >= 3 表示 ≥ 3 天前；<= -1 表示未来（> 0 天之后）
        fc.oneof(
          fc.integer({ min: 3, max: 1000 }),
          fc.integer({ min: -1000, max: -1 })
        ),
        (now, offsetDays) => {
          const target = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - offsetDays
          );
          const s = formatYmd(target);

          // 前置条件：s 匹配 ^\d{4}-\d{2}-\d{2}$ 且为合法日历日
          expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);

          // 前置条件：s 不属于 getRecentDays(now) 的三个 value
          const recentValues = getRecentDays(now).map((d) => d.value);
          expect(recentValues).not.toContain(s);

          // 行为：必抛 Error，message 严格相等
          let caught;
          try {
            resolveSelectedDate(s, now);
          } catch (err) {
            caught = err;
          }
          expect(caught).toBeInstanceOf(Error);
          expect(caught.message).toBe('所选日期不在最近 3 天内。');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('dateUtils property tests - Property 10', () => {
  // Feature: recent-days-score-selection, Property 10: 对任意不匹配 ^\d{4}-\d{2}-\d{2}$ 的字符串，或匹配该格式但不能被解析为合法日历日（如 2025-02-30、2024-13-01、9999-99-99）的字符串 s，调用 resolveSelectedDate(s, now) 必抛 Error，其 message 严格等于 '日期格式不正确。'；并且通过 HTTP 提交时响应 status === 400 且 body.message 等于该文案，且 score_transactions 表与 settings.current_score 在请求前后保持不变。
  // Validates: Property 10, Requirements 5.3
  it('Property 10: 格式非法的 selectedDate 在 resolveSelectedDate 中必抛固定文案', async () => {
    const { resolveSelectedDate, isYmd } = await import(
      '../../src/utils/dateUtils.js'
    );

    // 随机字符串生成器：过滤掉空串与"合法 YMD"，仅保留格式非法的字符串
    const randomInvalidString = fc
      .string()
      .filter((s) => s !== '' && !isYmd(s));

    // 显式预设：覆盖典型的格式非法 / 非合法日历日案例
    // 注：'' 不属于"格式非法"语义（设计中视为缺省 → null），故不放入预设
    const explicitInvalid = fc.constantFrom(
      '2025-13-01',
      '2025-02-30',
      'abcd-ef-gh',
      '2025-1-1',
      '9999-99-99'
    );

    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
        fc.oneof(randomInvalidString, explicitInvalid),
        (now, s) => {
          // 前置条件：s 不是空串且不能通过 isYmd（即格式非法或非合法日历日）
          expect(s).not.toBe('');
          expect(isYmd(s)).toBe(false);

          // 行为：必抛 Error，message 严格相等
          let caught;
          try {
            resolveSelectedDate(s, now);
          } catch (err) {
            caught = err;
          }
          expect(caught).toBeInstanceOf(Error);
          expect(caught.message).toBe('日期格式不正确。');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('dateUtils property tests - Property 14', () => {
  // Feature: recent-days-score-selection, Property 14: 对任意时刻 t1、selectedDate s 与时刻 t2，若 s ∈ getRecentDays(t1).value 集合 且 t2 - t1 ≥ 4 天（即 s 已不在 getRecentDays(t2).value 集合 中），则 isWithinRecentDays(s, t2) === false，resolveSelectedDate(s, t2) 抛 '所选日期不在最近 3 天内。'。
  // Validates: Property 14, Requirements 9.1, 9.2
  it('Property 14: 跨日 ≥ 4 天后老 selectedDate 自动失效', async () => {
    const { getRecentDays, isWithinRecentDays, resolveSelectedDate } =
      await import('../../src/utils/dateUtils.js');

    fc.assert(
      fc.property(
        // t1 限定在安全范围，确保 t2 = t1 + Δ（Δ ≤ 1000 天）仍在合理边界内
        fc.date({ min: new Date('2010-01-01'), max: new Date('2080-12-31') }),
        // Δ ≥ 4 天，保证 s ∈ getRecentDays(t1) 必不在 getRecentDays(t2) 中
        fc.integer({ min: 4, max: 1000 }),
        // 从 getRecentDays(t1) 的 3 个值中任选其一
        fc.integer({ min: 0, max: 2 }),
        (t1, deltaDays, indexAtT1) => {
          const t2 = new Date(
            t1.getFullYear(),
            t1.getMonth(),
            t1.getDate() + deltaDays,
            t1.getHours(),
            t1.getMinutes(),
            t1.getSeconds(),
            t1.getMilliseconds()
          );

          const t1Recent = getRecentDays(t1).map((d) => d.value);
          const t2Recent = getRecentDays(t2).map((d) => d.value);
          const s = t1Recent[indexAtT1];

          // 前置条件：s 属于 getRecentDays(t1) 的 value 集合
          expect(t1Recent).toContain(s);
          // 前置条件：s 已不在 getRecentDays(t2) 的 value 集合中
          expect(t2Recent).not.toContain(s);

          // 行为 1：isWithinRecentDays(s, t2) === false
          expect(isWithinRecentDays(s, t2)).toBe(false);

          // 行为 2：resolveSelectedDate(s, t2) 抛 '所选日期不在最近 3 天内。'
          let caught;
          try {
            resolveSelectedDate(s, t2);
          } catch (err) {
            caught = err;
          }
          expect(caught).toBeInstanceOf(Error);
          expect(caught.message).toBe('所选日期不在最近 3 天内。');
        }
      ),
      { numRuns: 100 }
    );
  });
});
