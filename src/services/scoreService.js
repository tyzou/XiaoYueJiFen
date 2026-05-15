const { getPool, withTransaction } = require('../db');

async function getCurrentScore() {
  const [rows] = await getPool().query("SELECT `value` FROM settings WHERE `key` = 'current_score'");
  return Number(rows[0]?.value || 0);
}

async function listEnabledQuickItems() {
  const [rows] = await getPool().query(
    'SELECT id, name, points, type, icon, sort_order FROM quick_items WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
  );
  return rows;
}

async function listAllQuickItems() {
  const [rows] = await getPool().query(
    'SELECT id, name, points, type, icon, sort_order, enabled FROM quick_items ORDER BY enabled DESC, sort_order ASC, id ASC'
  );
  return rows;
}

async function listTransactions(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const [rows] = await getPool().query(
    `SELECT st.id, st.type, st.points_delta, st.reason, st.source, st.balance_after, st.created_at,
            qi.name AS quick_item_name, qi.icon AS quick_item_icon
       FROM score_transactions st
       LEFT JOIN quick_items qi ON qi.id = st.quick_item_id
      ORDER BY st.created_at DESC, st.id DESC
      LIMIT ?`,
    [safeLimit]
  );
  return rows;
}

async function getTransactionStats(days = 14) {
  const safeDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const [summaryRows] = await getPool().query(
    `SELECT
        COALESCE(SUM(CASE WHEN points_delta > 0 THEN points_delta ELSE 0 END), 0) AS total_add,
        COALESCE(SUM(CASE WHEN points_delta < 0 THEN ABS(points_delta) ELSE 0 END), 0) AS total_subtract,
        COALESCE(SUM(points_delta), 0) AS net_change,
        COUNT(*) AS transaction_count
       FROM score_transactions
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)`,
    [safeDays]
  );
  const [dailyRows] = await getPool().query(
    `SELECT
        DATE(created_at) AS day,
        COALESCE(SUM(CASE WHEN points_delta > 0 THEN points_delta ELSE 0 END), 0) AS add_points,
        COALESCE(SUM(CASE WHEN points_delta < 0 THEN ABS(points_delta) ELSE 0 END), 0) AS subtract_points,
        COALESCE(SUM(points_delta), 0) AS net_points
       FROM score_transactions
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [safeDays]
  );

  return {
    days: safeDays,
    summary: summaryRows[0] || {
      total_add: 0,
      total_subtract: 0,
      net_change: 0,
      transaction_count: 0
    },
    daily: dailyRows
  };
}

async function createScoreTransaction({ type, pointsDelta, reason, source, quickItemId = null }) {
  return withTransaction(async (connection) => {
    const [settingsRows] = await connection.query(
      "SELECT `value` FROM settings WHERE `key` = 'current_score' FOR UPDATE"
    );
    const currentScore = Number(settingsRows[0]?.value || 0);
    const balanceAfter = currentScore + pointsDelta;

    await connection.query("UPDATE settings SET `value` = ? WHERE `key` = 'current_score'", [
      String(balanceAfter)
    ]);

    await connection.query(
      `INSERT INTO score_transactions
        (type, points_delta, reason, source, quick_item_id, balance_after)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, pointsDelta, reason, source, quickItemId, balanceAfter]
    );

    return balanceAfter;
  });
}

async function applyQuickItem(id) {
  const [rows] = await getPool().query(
    'SELECT id, name, points, type, enabled FROM quick_items WHERE id = ?',
    [id]
  );
  const item = rows[0];

  if (!item || !item.enabled) {
    throw new Error('快捷项不存在或已停用。');
  }

  return createScoreTransaction({
    type: item.points >= 0 ? 'add' : 'subtract',
    pointsDelta: Number(item.points),
    reason: item.name,
    source: 'quick',
    quickItemId: item.id
  });
}

async function applyManualScore(pointsDelta, reason) {
  return createScoreTransaction({
    type: pointsDelta >= 0 ? 'add' : 'subtract',
    pointsDelta,
    reason,
    source: 'manual'
  });
}

async function adjustScore(targetScore, reason = '设置总积分') {
  return withTransaction(async (connection) => {
    const [settingsRows] = await connection.query(
      "SELECT `value` FROM settings WHERE `key` = 'current_score' FOR UPDATE"
    );
    const currentScore = Number(settingsRows[0]?.value || 0);
    const pointsDelta = targetScore - currentScore;

    await connection.query("UPDATE settings SET `value` = ? WHERE `key` = 'current_score'", [
      String(targetScore)
    ]);

    await connection.query(
      `INSERT INTO score_transactions
        (type, points_delta, reason, source, quick_item_id, balance_after)
       VALUES ('adjust', ?, ?, 'adjust', NULL, ?)`,
      [pointsDelta, reason, targetScore]
    );

    return targetScore;
  });
}

async function createQuickItem({ name, points, icon, sortOrder, enabled }) {
  const [result] = await getPool().query(
    'INSERT INTO quick_items (name, points, type, icon, sort_order, enabled) VALUES (?, ?, ?, ?, ?, ?)',
    [name, points, points >= 0 ? 'add' : 'subtract', icon, sortOrder, enabled ? 1 : 0]
  );
  return {
    id: result.insertId,
    name,
    points,
    type: points >= 0 ? 'add' : 'subtract',
    icon,
    sort_order: sortOrder,
    enabled: enabled ? 1 : 0
  };
}

async function updateQuickItem(id, { name, points, icon, sortOrder, enabled }) {
  await getPool().query(
    `UPDATE quick_items
        SET name = ?, points = ?, type = ?, icon = ?, sort_order = ?, enabled = ?
      WHERE id = ?`,
    [name, points, points >= 0 ? 'add' : 'subtract', icon, sortOrder, enabled ? 1 : 0, id]
  );
}

async function disableQuickItem(id) {
  await getPool().query('UPDATE quick_items SET enabled = 0 WHERE id = ?', [id]);
}

module.exports = {
  getCurrentScore,
  listEnabledQuickItems,
  listAllQuickItems,
  listTransactions,
  getTransactionStats,
  applyQuickItem,
  applyManualScore,
  adjustScore,
  createQuickItem,
  updateQuickItem,
  disableQuickItem
};
