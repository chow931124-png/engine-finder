// A股五引擎选股系统 — 交易记录 API
// 使用 Vercel KV (Redis) 持久化存储
// 后台设置：Vercel Dashboard → Storage → Create KV Database → 链接到此项目

import { kv } from '@vercel/kv';

const TRADES_KEY = 'trades';

export default async function handler(req, res) {
  // CORS 头（允许前端跨域调用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      case 'GET':
        return await getTrades(req, res);
      case 'POST':
        return await addTrade(req, res);
      case 'PUT':
        return await updateTrade(req, res);
      case 'DELETE':
        return await deleteTrade(req, res);
      default:
        return res.status(405).json({ error: '方法不允许' });
    }
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 获取所有交易记录
async function getTrades(req, res) {
  const trades = await kv.get(TRADES_KEY) || [];

  // 如果传了 ?stats=true，额外返回统计数据
  if (req.query.stats === 'true') {
    const stats = computeStats(trades);
    return res.json({ trades, stats });
  }

  return res.json(trades);
}

// 添加交易
async function addTrade(req, res) {
  const { name, symbol, direction, entryPrice, exitPrice, entryDate, exitDate, position, engine, stopLoss } = req.body;

  if (!name) return res.status(400).json({ error: '标的名称不能为空' });

  const trades = await kv.get(TRADES_KEY) || [];

  const trade = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    symbol: symbol || '',
    direction: direction || '做多',
    entryPrice: entryPrice ? Number(entryPrice) : null,
    exitPrice: exitPrice ? Number(exitPrice) : null,
    entryDate: entryDate || new Date().toISOString().slice(0, 10),
    exitDate: exitDate || null,
    position: position || '',
    engine: engine || '',
    stopLoss: stopLoss || '',
    status: exitPrice ? 'closed' : 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 计算盈亏
  if (trade.exitPrice && trade.entryPrice) {
    trade.pnl = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2);
  } else {
    trade.pnl = null;
  }

  trades.unshift(trade);
  await kv.set(TRADES_KEY, trades);

  return res.status(201).json(trade);
}

// 更新交易
async function updateTrade(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: '缺少交易 ID' });

  const trades = await kv.get(TRADES_KEY) || [];
  const idx = trades.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: '交易不存在' });

  const updated = { ...trades[idx], ...req.body, id: trades[idx].id, updatedAt: new Date().toISOString() };

  // 重新计算盈亏
  if (updated.exitPrice && updated.entryPrice) {
    updated.pnl = ((updated.exitPrice - updated.entryPrice) / updated.entryPrice * 100).toFixed(2);
    if (updated.exitPrice) updated.status = 'closed';
  } else {
    updated.pnl = null;
  }

  trades[idx] = updated;
  await kv.set(TRADES_KEY, trades);

  return res.json(updated);
}

// 删除交易
async function deleteTrade(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: '缺少交易 ID' });

  const trades = await kv.get(TRADES_KEY) || [];
  const filtered = trades.filter(t => t.id !== id);
  if (filtered.length === trades.length) return res.status(404).json({ error: '交易不存在' });

  await kv.set(TRADES_KEY, filtered);
  return res.json({ success: true });
}

// ====== 统计引擎 ======
function computeStats(trades) {
  const closed = trades.filter(t => t.status === 'closed');
  const open = trades.filter(t => t.status === 'open');
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl <= 0);

  const winRate = closed.length > 0 ? (wins.length / closed.length * 100).toFixed(1) : 0;
  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl || 0), 0).toFixed(2);

  // 按引擎分组统计
  const byEngine = {};
  for (const t of closed) {
    const key = t.engine || '未分类';
    if (!byEngine[key]) byEngine[key] = { total: 0, wins: 0, pnlSum: 0 };
    byEngine[key].total++;
    if (t.pnl > 0) byEngine[key].wins++;
    byEngine[key].pnlSum += parseFloat(t.pnl || 0);
  }

  const engineStats = Object.entries(byEngine).map(([engine, st]) => ({
    engine,
    total: st.total,
    winRate: (st.wins / st.total * 100).toFixed(1),
    avgPnl: (st.pnlSum / st.total).toFixed(2),
    pnlSum: st.pnlSum.toFixed(2),
  })).sort((a, b) => b.winRate - a.winRate);

  return {
    total: trades.length,
    open: open.length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: winRate + '%',
    totalPnl: (totalPnl > 0 ? '+' : '') + totalPnl + '%',
    avgPnl: closed.length > 0 ? ((totalPnl / closed.length) > 0 ? '+' : '') + (totalPnl / closed.length).toFixed(2) + '%' : '0%',
    bestEngine: engineStats.length > 0 ? engineStats[0] : null,
    byEngine: engineStats,
    // 优化建议（简单规则引擎）
    suggestions: generateSuggestions(winRate, engineStats, trades.length),
  };
}

function generateSuggestions(winRate, engineStats, totalTrades) {
  const suggestions = [];

  if (totalTrades < 5) {
    suggestions.push('📊 数据不足（<5笔），继续积累交易记录');
    return suggestions;
  }

  if (winRate >= 70) {
    suggestions.push('🎯 总胜率' + winRate + '%——表现优秀，可适当加大仓位');
  } else if (winRate >= 50) {
    suggestions.push('📈 总胜率' + winRate + '%——表现中等，关注亏损交易的共性模式');
  } else {
    suggestions.push('⚠️ 总胜率' + winRate + '%——偏低，建议暂停交易复盘再战');
  }

  // 引擎优化
  if (engineStats.length > 0) {
    const best = engineStats[0];
    const worst = engineStats[engineStats.length - 1];

    if (best.winRate >= 70) {
      suggestions.push('🔬 推荐优先使用「' + best.engine + '」，胜率' + best.winRate + '%，' + (best.avgPnl > 0 ? '均盈+' + best.avgPnl + '%' : ''));
    }
    if (worst.winRate < 40 && engineStats.length > 1) {
      suggestions.push('🚫 建议减少/暂停使用「' + worst.engine + '」，胜率仅' + worst.winRate + '%');
    }
  }

  return suggestions;
}
