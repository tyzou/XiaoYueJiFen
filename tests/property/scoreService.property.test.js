// Property test for scoreService write behavior under selectedDate.
// Connects to a dedicated MySQL test database `xiaoyue_jifen_test_<pid>` so
// it never pollutes the development DB. The DB is created in `beforeAll`,
// truncated/reset in `beforeEach`, and dropped in `afterAll`.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import mysql from 'mysql2/promise';

// Override MYSQL_DATABASE BEFORE requiring src/db.js & src/services/scoreService.js
const TEST_DB_NAME = `xiaoyue_jifen_test_${process.pid}`;
process.env.MYSQL_DATABASE = TEST_DB_NAME;

// These requires must come AFTER the env override above.
const { initializeDatabase, getPool } = require('../../src/db');
const {
  applyQuickItem,
  applyManualScore,
  listEnabledQuickItems
} = require('../../src/services/scoreService');
const { getRecentDays, getServerToday } = require('../../src/utils/dateUtils');
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

describe('scoreService property tests', () => {
  let quickItems;

  beforeAll(async () => {
    // Make sure no leftover from a previous failed run
    await dropTestDatabase();
    await initializeDatabase();
    quickItems = await listEnabledQuickItems();
    expect(quickItems.length).toBeGreaterThan(0);
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

  // Feature: recent-days-score-selection, Property 5: 对任意 source ∈ {quick, manual} 的请求与 getRecentDays(now) 内任一 value 作为 selectedDate 的输入，调用相应 API 成功后查询写入的流水，DATE(created_at) 必须等于 selectedDate。
  // Validates: Property 5, Requirements 2.2, 3.2, 7.1
  it(
    'Property 5: 合法 selectedDate 决定流水的日期部分',
    { timeout: 600000 },
    async () => {
      const recentDays = getRecentDays(new Date());
      const recentValueArb = fc.constantFrom(...recentDays.map((d) => d.value));
      const sourceArb = fc.constantFrom('quick', 'manual');
      const pointsDeltaArb = fc
        .integer({ min: -1000, max: 1000 })
        .filter((n) => n !== 0);
      const quickItemArb = fc.constantFrom(...quickItems.map((q) => q.id));
      const reasonArb = fc.constantFrom('property-5-test');

      await fc.assert(
        fc.asyncProperty(
          sourceArb,
          recentValueArb,
          pointsDeltaArb,
          quickItemArb,
          reasonArb,
          async (source, selectedDate, pointsDelta, quickItemId, reason) => {
            // We don't need a clean slate per iteration — the assertion only
            // inspects the most recently written row. The suite-level
            // beforeEach already reset state once before the property runs.
            if (source === 'quick') {
              await applyQuickItem(quickItemId, { selectedDate });
            } else {
              await applyManualScore(pointsDelta, reason, { selectedDate });
            }

            const [rows] = await getPool().query(
              `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, source
                 FROM score_transactions
                 ORDER BY id DESC
                 LIMIT 1`
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].source).toBe(source);
            expect(rows[0].d).toBe(selectedDate);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  // Feature: recent-days-score-selection, Property 11: 对任意起始 current_score = S0 与任意有限的 (selectedDate, pointsDelta) 序列（其中 selectedDate 全部合法、pointsDelta 全部合法），按顺序提交 /score/quick/:id 或 /score/manual 之后：settings.current_score = S0 + Σ pointsDelta_i；第 k 笔流水的 balance_after = S0 + Σ_{i ≤ k} pointsDelta_i，与 selectedDate 的取值（包括是否早于已存在流水）无关。
  // Validates: Property 11, Requirements 6.1, 6.2
  it(
    'Property 11: current_score 与 balance_after 与 selectedDate 取值无关',
    { timeout: 600000 },
    async () => {
      const recentDays = getRecentDays(new Date());
      const recentDateArb = fc.constantFrom(...recentDays.map((d) => d.value));
      const pointsDeltaArb = fc
        .integer({ min: -1000, max: 1000 })
        .filter((n) => n !== 0);
      const opsArb = fc.array(fc.tuple(recentDateArb, pointsDeltaArb), {
        minLength: 0,
        maxLength: 50
      });
      // Bound S0 to keep cumulative balances safely within JS-number range
      // given up to 50 × 1000 = 50000 absolute deltas.
      const s0Arb = fc.integer({ min: -1_000_000, max: 1_000_000 });

      await fc.assert(
        fc.asyncProperty(s0Arb, opsArb, async (s0, ops) => {
          // Reset state per iteration — Property 11 depends on cumulative state
          // starting from the chosen S0.
          await getPool().query(
            "UPDATE settings SET `value` = ? WHERE `key` = 'current_score'",
            [String(s0)]
          );
          await getPool().query('TRUNCATE TABLE score_transactions');

          for (const [selectedDate, pointsDelta] of ops) {
            await applyManualScore(pointsDelta, 'p11-test', { selectedDate });
          }

          const expectedFinal =
            s0 + ops.reduce((acc, [, delta]) => acc + delta, 0);

          const [settingsRows] = await getPool().query(
            "SELECT `value` FROM settings WHERE `key` = 'current_score'"
          );
          expect(Number(settingsRows[0].value)).toBe(expectedFinal);

          const [txRows] = await getPool().query(
            'SELECT balance_after FROM score_transactions ORDER BY id ASC'
          );
          expect(txRows).toHaveLength(ops.length);

          let running = s0;
          for (let k = 0; k < ops.length; k += 1) {
            running += ops[k][1];
            expect(Number(txRows[k].balance_after)).toBe(running);
          }
        }),
        { numRuns: 100 }
      );
    }
  );

  // Feature: recent-days-score-selection, Property 12: 对任意已写入流水序列 T = [t_1, …, t_n] 与任意后续合法操作（含 selectedDate 早于 t_n.created_at 的流水），新操作完成后对所有 i ∈ [1, n]：t_i.balance_after 与 t_i.created_at 保持不变。
  // Validates: Property 12, Requirements 6.3
  it(
    'Property 12: 已存在流水的 balance_after 与 created_at 永不被修改',
    { timeout: 600000 },
    async () => {
      const recentDays = getRecentDays(new Date());
      const recentDateArb = fc.constantFrom(...recentDays.map((d) => d.value));
      // 昨天 / 前天 — guaranteed earlier than (or equal to) any date in batch1.
      const earlyDateArb = fc.constantFrom(
        recentDays[1].value,
        recentDays[2].value
      );
      const pointsDeltaArb = fc
        .integer({ min: -1000, max: 1000 })
        .filter((n) => n !== 0);
      const batch1Arb = fc.array(fc.tuple(recentDateArb, pointsDeltaArb), {
        minLength: 1,
        maxLength: 15
      });
      const earlyOpArb = fc.tuple(earlyDateArb, pointsDeltaArb);
      const batch2RestArb = fc.array(fc.tuple(recentDateArb, pointsDeltaArb), {
        minLength: 0,
        maxLength: 14
      });

      await fc.assert(
        fc.asyncProperty(
          batch1Arb,
          earlyOpArb,
          batch2RestArb,
          async (batch1, earlyOp, batch2Rest) => {
            // Reset state per iteration — Property 12 inspects cumulative
            // state after a snapshot is taken.
            await getPool().query(
              "UPDATE settings SET `value` = '0' WHERE `key` = 'current_score'"
            );
            await getPool().query('TRUNCATE TABLE score_transactions');

            // Write first batch.
            for (const [selectedDate, pointsDelta] of batch1) {
              await applyManualScore(pointsDelta, 'p12-batch1', {
                selectedDate
              });
            }

            // Snapshot all existing rows.
            const [snapshotRows] = await getPool().query(
              'SELECT id, balance_after, created_at FROM score_transactions ORDER BY id ASC'
            );

            // Write second batch — first op uses an earlier selectedDate
            // (昨天 or 前天) to ensure at least one new row predates batch1's
            // latest row in the YMD sense.
            const batch2 = [earlyOp, ...batch2Rest];
            for (const [selectedDate, pointsDelta] of batch2) {
              await applyManualScore(pointsDelta, 'p12-batch2', {
                selectedDate
              });
            }

            // Re-query the original IDs and assert their snapshot is intact.
            const ids = snapshotRows.map((r) => r.id);
            const placeholders = ids.map(() => '?').join(',');
            const [afterRows] = await getPool().query(
              `SELECT id, balance_after, created_at FROM score_transactions
                WHERE id IN (${placeholders}) ORDER BY id ASC`,
              ids
            );

            expect(afterRows).toHaveLength(snapshotRows.length);
            for (let i = 0; i < snapshotRows.length; i += 1) {
              expect(afterRows[i].id).toBe(snapshotRows[i].id);
              expect(Number(afterRows[i].balance_after)).toBe(
                Number(snapshotRows[i].balance_after)
              );
              const beforeTs =
                snapshotRows[i].created_at instanceof Date
                  ? snapshotRows[i].created_at.getTime()
                  : new Date(snapshotRows[i].created_at).getTime();
              const afterTs =
                afterRows[i].created_at instanceof Date
                  ? afterRows[i].created_at.getTime()
                  : new Date(afterRows[i].created_at).getTime();
              expect(afterTs).toBe(beforeTs);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  // Feature: recent-days-score-selection, Property 6: 对任意 source ∈ {quick, manual} 的请求，当请求体中不含 selectedDate 或其值为空字符串时，调用相应 API 成功后写入的流水 DATE(created_at) 必须等于服务端处理该请求时刻的 Server_Today。
  // Validates: Property 6, Requirements 2.3, 3.3
  it(
    'Property 6: 缺省 selectedDate 等价于 Server_Today',
    { timeout: 600000 },
    async () => {
      const sourceArb = fc.constantFrom('quick', 'manual');
      const missingSelectedDateArb = fc.constantFrom(undefined, null, '');
      const pointsDeltaArb = fc
        .integer({ min: -1000, max: 1000 })
        .filter((n) => n !== 0);
      const quickItemArb = fc.constantFrom(...quickItems.map((q) => q.id));
      const reasonArb = fc.constantFrom('property-6-test');

      await fc.assert(
        fc.asyncProperty(
          sourceArb,
          missingSelectedDateArb,
          pointsDeltaArb,
          quickItemArb,
          reasonArb,
          async (source, selectedDate, pointsDelta, quickItemId, reason) => {
            const todayBefore = getServerToday(new Date());
            if (source === 'quick') {
              await applyQuickItem(quickItemId, { selectedDate });
            } else {
              await applyManualScore(pointsDelta, reason, { selectedDate });
            }
            const todayAfter = getServerToday(new Date());

            const [rows] = await getPool().query(
              `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, source
                 FROM score_transactions
                 ORDER BY id DESC
                 LIMIT 1`
            );
            expect(rows).toHaveLength(1);
            expect(rows[0].source).toBe(source);
            // Tolerate the rare case where a request straddles midnight.
            expect([todayBefore, todayAfter]).toContain(rows[0].d);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
