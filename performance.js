// ============================================================
// 三引擎选股系统 绩效分析+自动优化规则引擎
// 每天更新 trade-log.json 后运行，自动发现模式并产出优化建议
// ============================================================

const OPTIMIZATION_RULES = []

// ============================================================
// 1. 按引擎统计胜率 → 调整仓位权重
// ============================================================
function analyzeByEngine(trades) {
  const completed = trades.filter(t => t.status === 'closed')
  const engines = {}
  for (const t of completed) {
    for (const e of t.engine) {
      if (!engines[e]) engines[e] = { wins: 0, total: 0, returns: [] }
      engines[e].total++
      if (t.pnl > 0) engines[e].wins++
      engines[e].returns.push(t.pnl)
    }
  }
  for (const [name, data] of Object.entries(engines)) {
    data.winRate = data.total > 0 ? data.wins / data.total : null
    data.avgReturn = data.returns.length > 0 ? data.returns.reduce((a, b) => a + b, 0) / data.returns.length : null
  }
  return engines
}

function genEngineWeightRules(engineStats) {
  const rules = []
  for (const [name, stats] of Object.entries(engineStats)) {
    if (stats.total < 5) continue  // 样本太小不判断
    if (stats.winRate >= 0.7) {
      rules.push({ type: 'engine_weight', target: name, action: 'increase', reason: `${name} 胜率${(stats.winRate*100).toFixed(0)}%≥70%，建议提高仓位权重`, confidence: '高' })
    } else if (stats.winRate <= 0.4) {
      rules.push({ type: 'engine_weight', target: name, action: 'decrease', reason: `${name} 胜率${(stats.winRate*100).toFixed(0)}%≤40%，建议降低仓位权重或暂停`, confidence: '高' })
    }
  }
  return rules
}

// ============================================================
// 2. 按市场情绪统计 → 退潮期自动限仓
// ============================================================
function analyzeBySentiment(trades) {
  const completed = trades.filter(t => t.status === 'closed')
  const sentiments = {}
  for (const t of completed) {
    const s = t.marketSentiment || '未知'
    if (!sentiments[s]) sentiments[s] = { wins: 0, total: 0, returns: [] }
    sentiments[s].total++
    if (t.pnl > 0) sentiments[s].wins++
    sentiments[s].returns.push(t.pnl)
  }
  for (const [name, data] of Object.entries(sentiments)) {
    data.winRate = data.total > 0 ? data.wins / data.total : null
    data.avgReturn = data.returns.length > 0 ? data.returns.reduce((a, b) => a + b, 0) / data.returns.length : null
  }
  return sentiments
}

function genSentimentRules(sentimentStats) {
  const rules = []
  // 引擎2在退潮期
  if (sentimentStats['退潮'] && sentimentStats['退潮'].total >= 3) {
    const engine2Retreat = sentimentStats['退潮']  // 需要在byEngine+Sentiment交叉统计
    if (engine2Retreat && engine2Retreat.winRate <= 0.4) {
      rules.push({ type: 'sentiment_block', target: 'engine2', condition: '退潮', action: 'disable', reason: '引擎2在退潮期胜率≤40%，建议自动禁用', confidence: '高' })
    }
  }
  // 冰点期间
  if (sentimentStats['冰点'] && sentimentStats['冰点'].total >= 3 && sentimentStats['冰点'].winRate <= 0.4) {
    rules.push({ type: 'sentiment_warn', condition: '冰点', action: 'reduce_all', reason: '冰点期整体胜率偏低，建议所有引擎降半仓', confidence: '中' })
  }
  // 高潮期间
  if (sentimentStats['高潮'] && sentimentStats['高潮'].total >= 3 && sentimentStats['高潮'].winRate >= 0.6) {
    rules.push({ type: 'sentiment_ok', condition: '高潮', action: 'normal', reason: '高潮期胜率良好，正常交易', confidence: '中' })
  }
  return rules
}

// ============================================================
// 3. PEG过滤 → PEG<2.5硬过滤
// ============================================================
function analyzeByPEG(trades) {
  const completed = trades.filter(t => t.status === 'closed' && t.peg != null)
  if (completed.length < 5) return null

  const highPEG = completed.filter(t => t.peg > 2.5)
  const lowPEG = completed.filter(t => t.peg <= 2.5)

  const highWinRate = highPEG.length > 0 ? highPEG.filter(t => t.pnl > 0).length / highPEG.length : null
  const lowWinRate = lowPEG.length > 0 ? lowPEG.filter(t => t.pnl > 0).length / lowPEG.length : null

  return { highPEG: { count: highPEG.length, winRate: highWinRate }, lowPEG: { count: lowPEG.length, winRate: lowWinRate } }
}

function genPEGRules(pegStats) {
  const rules = []
  if (pegStats && pegStats.highPEG.count >= 3 && pegStats.highPEG.winRate <= 0.4) {
    rules.push({ type: 'peg_filter', threshold: 2.5, action: 'hard_block', reason: `PEG>2.5的票胜率${(pegStats.highPEG.winRate*100).toFixed(0)}%≤40%，建议PEG>2.5直接跳过不辩论`, confidence: '高' })
  }
  return rules
}

// ============================================================
// 4. 游资风格 → 最优持有周期
// ============================================================
function analyzeBySeatStyle(trades) {
  const completed = trades.filter(t => t.status === 'closed' && t.seatStyle)
  const seats = {}
  for (const t of completed) {
    const style = t.seatStyle
    if (!seats[style]) seats[style] = { wins: [], holdingDays: [] }
    if (t.exitDate) {
      const days = (new Date(t.exitDate) - new Date(t.date)) / 86400000
      seats[style].holdingDays.push(days)
    }
    seats[style].wins.push(t.pnl > 0)
  }
  for (const [name, data] of Object.entries(seats)) {
    data.winRate = data.wins.length > 0 ? data.wins.filter(w => w).length / data.wins.length : null
    data.avgHoldingDays = data.holdingDays.length > 0 ? data.holdingDays.reduce((a, b) => a + b, 0) / data.holdingDays.length : null
  }
  return seats
}

function genSeatRules(seatStats) {
  const rules = []
  for (const [name, stats] of Object.entries(seatStats)) {
    if (stats.avgHoldingDays && stats.avgHoldingDays <= 3 && name.includes('紫阳')) {
      rules.push({ type: 'seat_strategy', target: name, action: 'set_hold_days', value: Math.round(stats.avgHoldingDays), reason: `${name} 最佳持有周期约${Math.round(stats.avgHoldingDays)}天，建议默认T+${Math.round(stats.avgHoldingDays)}走`, confidence: '中' })
    }
  }
  return rules
}

// ============================================================
// 5. 产业链统计 → 调整权重
// ============================================================
function analyzeByChain(trades) {
  const completed = trades.filter(t => t.status === 'closed' && t.chain)
  const chains = {}
  for (const t of completed) {
    const c = t.chain
    if (!chains[c]) chains[c] = { wins: 0, total: 0, returns: [] }
    chains[c].total++
    if (t.pnl > 0) chains[c].wins++
    chains[c].returns.push(t.pnl)
  }
  for (const [name, data] of Object.entries(chains)) {
    data.winRate = data.total > 0 ? data.wins / data.total : null
    data.avgReturn = data.returns.length > 0 ? data.returns.reduce((a, b) => a + b, 0) / data.returns.length : null
  }
  return chains
}

function genChainRules(chainStats) {
  const rules = []
  for (const [name, stats] of Object.entries(chainStats)) {
    if (stats.total < 3) continue
    if (stats.winRate <= 0.3) {
      rules.push({ type: 'chain_weight', target: name, action: 'reduce', reason: `${name} 链胜率${(stats.winRate*100).toFixed(0)}%≤30%，建议降低权重或等右侧信号`, confidence: '高' })
    } else if (stats.winRate >= 0.7) {
      rules.push({ type: 'chain_weight', target: name, action: 'increase', reason: `${name} 链胜率${(stats.winRate*100).toFixed(0)}%≥70%，建议提高权重`, confidence: '高' })
    }
  }
  return rules
}

// ============================================================
// 主函数：跑所有分析，产出所有优化建议
// ============================================================
function analyze(trades, currentSentiment) {
  const completed = trades.filter(t => t.status === 'closed')
  if (completed.length < 5) {
    return { status: 'insufficient_data', message: `仅有${completed.length}笔已完成交易，需要≥5笔才能产出有意义的优化建议`, stats: { totalTrades: trades.length, completed: completed.length } }
  }

  const engineStats = analyzeByEngine(trades)
  const chainStats = analyzeByChain(trades)
  const sentimentStats = analyzeBySentiment(trades)
  const pegStats = analyzeByPEG(trades)
  const seatStats = analyzeBySeatStyle(trades)

  const allRules = [
    ...genEngineWeightRules(engineStats),
    ...genSentimentRules(sentimentStats),
    ...genPEGRules(pegStats),
    ...genSeatRules(seatStats),
    ...genChainRules(chainStats),
  ]

  // 按置信度排序
  allRules.sort((a, b) => (b.confidence === '高' ? 1 : 0) - (a.confidence === '高' ? 1 : 0))

  // 当前情绪阶段的应用建议
  const currentAdvice = currentSentiment ? getStrategyByStage(currentSentiment) : null

  return {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    dataPoints: completed.length,
    stats: { engineStats, chainStats, sentimentStats, pegStats, seatStats, currentSentiment, currentAdvice },
    rules: allRules,
  }
}

// 情绪阶段策略
function getStrategyByStage(stage) {
  const s = { FREEZE:'冰点', RECOVERY:'回暖', CLIMAX:'高潮', RETREAT:'退潮' }
  const strategies = {
    FREEZE:   '所有引擎可正常选股，冰点是逆向建仓最佳时机',
    RECOVERY: '引擎1正常+引擎2关注首板+引擎3正常+引擎4继续埋伏',
    CLIMAX:   '引擎1收紧标准+引擎2快进快出+引擎3不追高+引擎4只卖不买',
    RETREAT:  '引擎2建议禁用+其他引擎降半仓',
  }
  return strategies[stage] || '正常'
}

// ============================================================
// 简化版：仅基于现有数据产出一个"当前阶段建议"
// ============================================================
function quickAnalyze(trades) {
  const completed = trades.filter(t => t.status === 'closed')
  const pending = trades.filter(t => t.status === 'pending')

  return {
    totalTrades: trades.length,
    completed: completed.length,
    pending: pending.length,
    overallWinRate: completed.length > 0 ? completed.filter(t => t.pnl > 0).length / completed.length : null,
    avgReturn: completed.length > 0 ? (completed.reduce((s, t) => s + (t.pnl || 0), 0) / completed.length) : null,
    bestTrade: completed.length > 0 ? completed.reduce((a, b) => (b.pnl || 0) > (a.pnl || 0) ? b : a) : null,
    worstTrade: completed.length > 0 ? completed.reduce((a, b) => (b.pnl || 0) < (a.pnl || 0) ? b : a) : null,
  }
}

// 导出（Node.js环境）
if (typeof module !== 'undefined') {
  module.exports = { analyze, quickAnalyze, analyzeByEngine, analyzeByChain, analyzeBySentiment, analyzeByPEG, analyzeBySeatStyle }
}
