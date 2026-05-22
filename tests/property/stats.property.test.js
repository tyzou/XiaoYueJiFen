// Property test for getTransactionStats daily-bucket behavior under selectedDate.
// Connects to a dedicated MySQL test database `xiaoyue_jifen_test_stats_<pid>`
// (distinct from the scoreService property test DB so the two suites can run
// in parallel without colliding). The DB is created in `beforeAll`,
// truncated/reset in `beforeEach`, and dropped in `afterAll`.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import mysql from 'mysql2/promise';

// Override MYSQL_DATABASE BEFORE requiring src/db.js & src/services/scoreService.js
const TEST_DB_NAME = `xiaoyue_jifen_test_stats_${process.pid}`;
process.env.MYSQL_DATABASE = TEST_DB_NAME;

// These requires must come AFTER the env override above.
const { initializeDatabase, getPool } = require('../../src/db');
const {
  applyManualScore,
  getTransactionStats
} = require('../../src/services/scoreService');
const { getRecentDays, formatYmd } = require('../../src/utils/dateUtils');
const { db: dbConfig } = require('../../src/config');

async function dropTestDatabase() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  } finally {
    await conn.end();
  }
}

// Mirrors MySQL's `created_at >= DATE_SUB(CURRENT_DATE, INTERVAL days DAY)` filter
// at the day-granularity level. selectedDate is within the window iff
// selectedDate-as-date >= today - days (calendar-day arithmetic, local time).
function dayInWindow(selectedDate, days, now) {
  const [y, m, d] = selectedDate.split('-').map(Number);
  const sd = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - days
  );
  return sd.getTime() >= cutoff.getTime();
}

// Normalize the `day` field returned by getTransactionStats to a YYYY-MM-DD
// string. mysql2 may return it as a JS Date or as a string depending on
// driver/version.
function normalizeDay(value) {
  if (value instanceof Date) return formatYmd(value);
  return String(value).slice(0, 10);
}

describe('stats property tests', () => {
  beforeAll(async () => {
    // Make sure no leftover from a previous failed run.
    await dropTestDatabase();
    await initializeDatabase();
  }, 60000);

  afterAll(async () => {
    try {
      await getPool().end();
    } catch (_) {
      // ignore
    }
    await dropTestDatabase();
  }, 60000);

  beforeEach(async () => {
    await getPool().query(
      "UPDATE settings SET `value` = '0' WHERE `key` = 'current_score'"
    );
    await getPool().query('TRUNCATE TABLE score_transactions');
  });

  // Feature: recent-days-score-selection, Property 13: 对任意由若干 (selectedDate, pointsDelta) 写入产生的流水集合，对任意 days ∈ [1, 90]，getTransactionStats(days).daily 中 day = D 的桶的 add_points / subtract_points / net_points 必须等于所有 selectedDate = D 且 D 落在最近 days 天窗口内的流水按符号汇总的结果；尤其当某笔流水的 selectedDate = '昨天' 或 '前天' 时，它必须出现在该日的桶里、而不是 Server_Today 的桶里。
  // Validates: Property 13, Requirements 7.2, 7.3
  it(
    'Property 13: getTransactionStats 按 Selected_Date 归类',
    { timeout: 600000 },
    async () => {
      const recentDays = getRecentDays(new Date());
      const recentValueArb = fc.constantFrom(
        ...recentDays.map((d) => d.value)
      );
      const pointsDeltaArb = fc
        .integer({ min: -1000, max: 1000 })
        .filter((n) => n !== 0);
      const opsArb = fc.array(fc.tuple(recentValueArb, pointsDeltaArb), {
        minLength: 1,
        maxLength: 30
      });
      const daysArb = fc.integer({ min: 1, max: 90 });

      await fc.assert(
        fc.asyncProperty(opsArb, daysArb, async (ops, days) => {
          // Reset state per iteration — Property 13 inspects the full table
          // contents through getTransactionStats.
          await getPool().query(
            "UPDATE settings SET `value` = '0' WHERE `key` = 'current_score'"
          );
          await getPool().query('TRUNCATE TABLE score_transactions');

          for (const [selectedDate, pointsDelta] of ops) {
            await applyManualScore(pointsDelta, 'p13-test', { selectedDate });
          }

          // Capture `now` AFTER all writes so the JS-side window calculation
          // matches the MySQL-side CURRENT_DATE used by getTransactionStats.
          const now = new Date();

          // Compute expected daily buckets in JS by grouping ops by
          // selectedDate, filtering those that fall within the window.
          const expected = new Map();
          for (const [selectedDate, delta] of ops) {
            if (!dayInWindow(selectedDate, days, now)) continue;
            const cur =
              expected.get(selectedDate) || { add: 0, sub: 0, net: 0 };
            if (delta > 0) cur.add += delta;
            else cur.sub += -delta;
            cur.net += delta;
            expected.set(selectedDate, cur);
          }

          const result = await getTransactionStats(days);

          // Build the actual map keyed by YYYY-MM-DD.
          const actual = new Map();
          for (const row of result.daily) {
            const dayStr = normalizeDay(row.day);
            actual.set(dayStr, {
              add: Number(row.add_points),
              sub: Number(row.subtract_points),
              net: Number(row.net_points)
            });
          }

          // Same set of days, and per-day add/sub/net all match.
          expect(actual.size).toBe(expected.size);
          for (const [dayStr, exp] of expected) {
            const act = actual.get(dayStr);
            expect(act).toBeDefined();
            expect(act.add).toBe(exp.add);
            expect(act.sub).toBe(exp.sub);
            expect(act.net).toBe(exp.net);
          }

          // Explicitly verify the "昨天/前天 lands in its own bucket, not in
          // Server_Today's bucket" requirement: any deltas written with
          // selectedDate = yesterday or day-before-yesterday must contribute
          // to that day's bucket and never inflate today's bucket.
          const todayValue = recentDays[0].value;
          const yesterdayValue = recentDays[1].value;
          const dbyValue = recentDays[2].value;

          for (const earlier of [yesterdayValue, dbyValue]) {
            if (earlier === todayValue) continue; // safety
            if (!dayInWindow(earlier, days, now)) continue;

            const earlierOps = ops.filter(([d]) => d === earlier);
            if (earlierOps.length === 0) continue;

            const expectedAdd = earlierOps
              .filter(([, dd]) => dd > 0)
              .reduce((s, [, dd]) => s + dd, 0);
            const expectedSub = earlierOps
              .filter(([, dd]) => dd < 0)
              .reduce((s, [, dd]) => s + -dd, 0);
            const expectedNet = earlierOps.reduce((s, [, dd]) => s + dd, 0);

            const earlierBucket = actual.get(earlier);
            expect(earlierBucket).toBeDefined();
            expect(earlierBucket.add).toBe(expectedAdd);
            expect(earlierBucket.sub).toBe(expectedSub);
            expect(earlierBucket.net).toBe(expectedNet);

            // And those deltas must NOT have leaked into today's bucket.
            const todayOps = ops.filter(([d]) => d === todayValue);
            const todayExpectedNet = todayOps.reduce(
              (s, [, dd]) => s + dd,
              0
            );
            const todayBucket = actual.get(todayValue);
            if (todayOps.length === 0) {
              expect(todayBucket).toBeUndefined();
            } else {
              expect(todayBucket).toBeDefined();
              expect(todayBucket.net).toBe(todayExpectedNet);
            }
          }
        }),
        { numRuns: 100 }
      );
    }
  );
});
