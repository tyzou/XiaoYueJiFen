'use strict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getServerToday(now = new Date()) {
  return formatYmd(now);
}

function getRecentDays(now = new Date(), count = 3) {
  const result = [];
  const labels = ['今天', '昨天', '前天'];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    result.push({
      value: formatYmd(d),
      label: labels[i] ?? `${i}天前`,
      shortDate: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    });
  }
  return result;
}

function isYmd(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function isWithinRecentDays(value, now = new Date(), count = 3) {
  if (!isYmd(value)) return false;
  return getRecentDays(now, count).some((d) => d.value === value);
}

function buildTransactionDateTime(selectedDate, now = new Date()) {
  // selectedDate: 'YYYY-MM-DD'，now：服务端当前时刻
  // 输出：JS Date，日期 = selectedDate，时间 = now 的 HH:MM:SS（毫秒清零或保留均可）
  const [y, m, d] = selectedDate.split('-').map(Number);
  return new Date(
    y,
    m - 1,
    d,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
}

function resolveSelectedDate(raw, now = new Date()) {
  if (raw === undefined || raw === null || raw === '') return null; // 表示 "today"
  if (!isYmd(raw)) {
    throw new Error('日期格式不正确。');
  }
  if (!isWithinRecentDays(raw, now)) {
    throw new Error('所选日期不在最近 3 天内。');
  }
  return raw;
}

module.exports = {
  formatYmd,
  getServerToday,
  getRecentDays,
  isYmd,
  isWithinRecentDays,
  buildTransactionDateTime,
  resolveSelectedDate
};
