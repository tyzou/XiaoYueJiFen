const express = require('express');
const {
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
} = require('../services/scoreService');
const { requireAuth } = require('../middleware');
const { normalizeQuickIcon } = require('../icons');

const router = express.Router();

function parseInteger(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`${fieldName}不能为空。`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName}必须是整数。`);
  }
  return parsed;
}

function normalizeReason(value, fallback) {
  const reason = String(value || '').trim();
  if (reason.length > 255) {
    throw new Error('原因最多 255 个字符。');
  }
  return reason || fallback;
}

function normalizeIcon(value) {
  const icon = normalizeQuickIcon(value);
  if (icon.length > 80) {
    throw new Error('图标值最多 80 个字符。');
  }
  return icon;
}

function wantsJson(req) {
  return req.xhr || String(req.get('accept') || '').includes('application/json');
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [currentScore, quickItems] = await Promise.all([
      getCurrentScore(),
      listEnabledQuickItems()
    ]);

    res.render('index', {
      title: '小月积分',
      currentScore,
      addItems: quickItems.filter((item) => item.points >= 0),
      subtractItems: quickItems.filter((item) => item.points < 0)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/score/quick/:id', async (req, res) => {
  try {
    const balanceAfter = await applyQuickItem(req.params.id);
    req.flash('success', '积分已更新。');
    if (wantsJson(req)) {
      return res.json({ ok: true, message: '积分已更新。', currentScore: balanceAfter });
    }
  } catch (error) {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    req.flash('error', error.message);
  }
  res.redirect('/');
});

router.post('/score/manual', async (req, res) => {
  try {
    const pointsDelta = parseInteger(req.body.pointsDelta, '积分');
    if (pointsDelta === 0) {
      throw new Error('积分不能为 0。');
    }
    const reason = normalizeReason(req.body.reason, '手动调整');

    const balanceAfter = await applyManualScore(pointsDelta, reason);
    req.flash('success', '手动积分已记录。');
    if (wantsJson(req)) {
      return res.json({ ok: true, message: '手动积分已记录。', currentScore: balanceAfter });
    }
  } catch (error) {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    req.flash('error', error.message);
  }
  res.redirect('/');
});

router.post('/score/adjust', async (req, res) => {
  try {
    const targetScore = parseInteger(req.body.targetScore, '目标总积分');
    const reason = normalizeReason(req.body.reason, '设置总积分');

    const balanceAfter = await adjustScore(targetScore, reason);
    req.flash('success', '总积分已校准。');
    if (wantsJson(req)) {
      return res.json({ ok: true, message: '总积分已校准。', currentScore: balanceAfter });
    }
  } catch (error) {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    req.flash('error', error.message);
  }
  res.redirect('/');
});

router.get('/quick-items', async (req, res, next) => {
  try {
    const quickItems = await listAllQuickItems();
    res.render('quick-items', {
      title: '快捷项管理',
      quickItems
    });
  } catch (error) {
    next(error);
  }
});

router.post('/quick-items', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('快捷项名称不能为空。');
    }
    if (name.length > 100) {
      throw new Error('快捷项名称最多 100 个字符。');
    }

    const points = parseInteger(req.body.points, '积分');
    if (points === 0) {
      throw new Error('快捷项积分不能为 0。');
    }

    const item = await createQuickItem({
      name,
      points,
      icon: normalizeIcon(req.body.icon),
      sortOrder: parseInteger(req.body.sortOrder || 0, '排序'),
      enabled: Boolean(req.body.enabled)
    });
    req.flash('success', '快捷项已新增。');
    if (wantsJson(req)) {
      return res.status(201).json({ ok: true, message: '快捷项已新增。', item });
    }
  } catch (error) {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    req.flash('error', error.message);
  }
  res.redirect('/quick-items');
});

router.post('/quick-items/:id', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      throw new Error('快捷项名称不能为空。');
    }
    if (name.length > 100) {
      throw new Error('快捷项名称最多 100 个字符。');
    }

    const points = parseInteger(req.body.points, '积分');
    if (points === 0) {
      throw new Error('快捷项积分不能为 0。');
    }

    await updateQuickItem(req.params.id, {
      name,
      points,
      icon: normalizeIcon(req.body.icon),
      sortOrder: parseInteger(req.body.sortOrder || 0, '排序'),
      enabled: Boolean(req.body.enabled)
    });
    req.flash('success', '快捷项已保存。');
    if (wantsJson(req)) {
      return res.json({ ok: true, message: '快捷项已保存。' });
    }
  } catch (error) {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    req.flash('error', error.message);
  }
  res.redirect('/quick-items');
});

router.post('/quick-items/:id/delete', async (req, res) => {
  try {
    await disableQuickItem(req.params.id);
    req.flash('success', '快捷项已停用。');
    if (wantsJson(req)) {
      return res.json({ ok: true, message: '快捷项已停用。' });
    }
  } catch (error) {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    req.flash('error', error.message);
  }
  res.redirect('/quick-items');
});

router.get('/transactions', async (req, res, next) => {
  try {
    const [transactions, transactionStats] = await Promise.all([
      listTransactions(300),
      getTransactionStats(14)
    ]);
    res.render('transactions', {
      title: '积分流水',
      transactions,
      transactionStats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
