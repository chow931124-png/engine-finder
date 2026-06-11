// ============================================================
// 三引擎共享工具模块
// 情绪周期 + 游资数据库 + 炸板模型 + 矛盾仲裁
// ============================================================

// ============================================================
// 1. 市场情绪周期判断
// ============================================================
const SENTIMENT_STAGES = {
  FREEZE:   { name:'冰点',   emoji:'❄️',  description:'恐慌蔓延，涨停<30只，连板几乎绝迹' },
  RECOVERY: { name:'回暖',  emoji:'🌤️',  description:'恐慌消退，首板开始出现，龙头试探' },
  CLIMAX:   { name:'高潮',  emoji:'🔥',  description:'涨停>80只，连板高度突破5板，情绪亢奋' },
  RETREAT:  { name:'退潮',  emoji:'🌊',  description:'高位票炸板频发，亏钱效应扩散' },
}

function detectSentimentStage(marketData) {
  const { upCount, downCount, limitUp, limitDown, maxConsecutive, consecutiveAdvanceRate, failRate, volume } = marketData

  // 退潮：高位炸板频发，晋级率极低
  if (failRate > 0.35 && consecutiveAdvanceRate < 0.3) return 'RETREAT'
  // 冰点：涨停极少，连板绝迹
  if (limitUp < 30 || maxConsecutive <= 2) return 'FREEZE'
  // 高潮：涨停多，连板高度突破5
  if (limitUp > 80 && maxConsecutive >= 5 && consecutiveAdvanceRate > 0.5) return 'CLIMAX'
  // 回暖：涨停恢复，但热度不高
  if (limitUp >= 30 && limitUp <= 80) return 'RECOVERY'
  // 默认回暖
  return 'RECOVERY'
}

function getStrategyByStage(stage) {
  const strategies = {
    FREEZE:   { e1:'🔬大胆建仓，好公司被错杀', e2:'🎯不跟庄，流动性差', e3:'🌍大胆埋伏，恐慌是机会', overall:'重仓优质标的' },
    RECOVERY: { e1:'🔬正常选股，关注首板',   e2:'🎯关注首板跟庄机会',  e3:'🌍继续埋伏未启动方向', overall:'正常仓位' },
    CLIMAX:   { e1:'🔬收紧标准，只选最优',  e2:'🎯快进快出T+1必走',   e3:'🌍只卖不买，等待退潮',  overall:'逐步减仓' },
    RETREAT:  { e1:'🔬只卖不买',             e2:'🎯空仓观望',          e3:'🌍观望，等待冰点',      overall:'空仓/轻仓' },
  }
  return strategies[stage]
}

// ============================================================
// 2. 游资席位数据库（8个席位）
// ============================================================
const SEAT_DB = {
  '紫阳东路': {
    id:'ziyangdonglu', seat:'国泰海通武汉紫阳东路', type:'顶级游资', style:'主线主买',
    data: { annualVolume:'419亿', t1Return:'+1.91%', t1WinRate:'59.78%', t3Return:'+2.21%', t5WinRate:'49.05%' },
    strategy: { holdDays:'T+1~T+3', entry:'次日平开/小高开<3%跟', exit:'T+3必须清仓', stopLoss:'-9%' },
    tags: ['AI算力','电力','光通信','小金属'],
  },
  '作手新一': {
    id:'zuoshouxinyi', seat:'国泰君安南京太平南路', type:'顶级游资', style:'龙头接力',
    data: { annualVolume:'~200亿', t1Return:'+2.3%', t1WinRate:'55%', t2Return:'+2.8%', t5WinRate:'45%' },
    strategy: { holdDays:'T+1~T+2', entry:'连板确认后追3板', exit:'不板就走', stopLoss:'-7%' },
    tags: ['题材龙头','连板接力','半导体','军工'],
  },
  '炒股养家': {
    id:'chaoguyangjia', seat:'华鑫证券上海分公司(多席位)', type:'顶级游资', style:'锁仓趋势',
    data: { annualVolume:'~300亿', t1Return:'+1.2%', t1WinRate:'52%', t10Return:'+5.8%', t5WinRate:'58%' },
    strategy: { holdDays:'T+5~T+10', entry:'趋势确认后分批建仓', exit:'趋势破位走', stopLoss:'-10%' },
    tags: ['趋势股','机构票','消费电子','新能源'],
  },
  '赵老哥': {
    id:'zhaolaoge', seat:'中国银河证券绍兴营业部', type:'顶级游资', style:'一日游',
    data: { annualVolume:'~150亿', t1Return:'+1.8%', t1WinRate:'58%', t3Return:'-0.5%', t5WinRate:'35%' },
    strategy: { holdDays:'T+1必走', entry:'首板打板', exit:'次日开盘即走', stopLoss:'-5%' },
    tags: ['首板','次新股','高送转','事件驱动'],
  },
  '章盟主': {
    id:'zhangmengzhu', seat:'国泰君安上海江苏路', type:'顶级游资', style:'大票趋势',
    data: { annualVolume:'~250亿', t1Return:'+1.5%', t1WinRate:'56%', t5Return:'+3.2%', t10WinRate:'52%' },
    strategy: { holdDays:'T+3~T+5', entry:'突破平台后追', exit:'滞涨或放量不涨走', stopLoss:'-8%' },
    tags: ['大市值','科技龙头','券商','中字头'],
  },
  '小鳄鱼': {
    id:'xiaoley', seat:'东方证券上海浦东新区银城中路', type:'一线游资', style:'趋势加速',
    data: { annualVolume:'~120亿', t1Return:'+1.6%', t1WinRate:'54%', t3Return:'+2.5%', t5WinRate:'48%' },
    strategy: { holdDays:'T+2~T+3', entry:'趋势中继突破', exit:'放量滞涨走', stopLoss:'-7%' },
    tags: ['趋势加速','科技','新能源','医药'],
  },
  '宁波桑田路': {
    id:'ningsangtian', seat:'国盛证券宁波桑田路', type:'一线游资', style:'妖股接力',
    data: { annualVolume:'~100亿', t1Return:'+2.5%', t1WinRate:'60%', t3Return:'+1.8%', t5WinRate:'38%' },
    strategy: { holdDays:'T+1~T+2', entry:'弱转强确认', exit:'炸板即走', stopLoss:'-10%' },
    tags: ['妖股','次新','连板','摘帽'],
  },
  '上塘路': {
    id:'shangtanglu', seat:'财通证券杭州上塘路', type:'一线游资', style:'首板挖掘',
    data: { annualVolume:'~80亿', t1Return:'+3.1%', t1WinRate:'62%', t3Return:'+0.8%', t5WinRate:'32%' },
    strategy: { holdDays:'T+1必走', entry:'首板打板(题材首日)', exit:'次日高开即走', stopLoss:'-5%' },
    tags: ['新题材首板','消息驱动','低价股'],
  },
}

function identifySeat(buyerName) {
  for (const [name, data] of Object.entries(SEAT_DB)) {
    if (buyerName.includes(name) || (data.seat && buyerName.includes(data.seat.substring(0, 6)))) {
      return { name, ...data }
    }
  }
  return null
}

function getStrategyForSeat(seatName, stockPrice, limitUpPosition) {
  const seat = SEAT_DB[seatName]
  if (!seat) return null
  return {
    ...seat.strategy,
    seatName,
    seatStyle: seat.style,
    historicalWinRate: seat.data.t1WinRate,
    adjustedStopLoss: seatName === '宁波桑田路' && limitUpPosition >= 4 ? '-12%' : seat.strategy.stopLoss,
    riskNote: limitUpPosition >= 5 ? '连板>5时游资撤退概率大幅提升' : null,
  }
}

// ============================================================
// 3. 炸板概率模型
// ============================================================
function calculateExplosionProbability(params) {
  const {
    sealAmount,      // 封单金额(亿)
    turnoverRate,    // 换手率(%)
    limitUpPosition, // 连板位置(1=首板, 2=2板...)
    volume,          // 成交额(亿)
    marketSentiment, // 市场情绪(FREEZE/RECOVERY/CLIMAX/RETREAT)
    hasSeatSelling,  // 龙虎榜是否有席位在卖
  } = params

  let score = 0
  const reasons = []

  // 因子1: 封单占比(封单/成交额)
  const sealRatio = sealAmount / (volume || 1)
  if (sealRatio > 0.5) { score += 0; reasons.push('封单充足') }
  else if (sealRatio > 0.2) { score += 10; reasons.push('封单一般') }
  else { score += 25; reasons.push('封单薄弱⚠️') }

  // 因子2: 换手率
  if (turnoverRate < 3) { score += 0; reasons.push('锁仓极好') }
  else if (turnoverRate < 8) { score += 8; reasons.push('换手正常') }
  else if (turnoverRate < 15) { score += 18; reasons.push('换手偏高⚠️') }
  else { score += 30; reasons.push('换手过大🔴') }

  // 因子3: 连板位置
  if (limitUpPosition <= 1) { score += 5 }
  else if (limitUpPosition <= 2) { score += 10 }
  else if (limitUpPosition <= 4) { score += 20; reasons.push('高位连板⚠️') }
  else { score += 35; reasons.push('极高连板🔴') }

  // 因子4: 市场情绪
  if (marketSentiment === 'CLIMAX') { score += 5 }
  else if (marketSentiment === 'RECOVERY') { score += 8 }
  else if (marketSentiment === 'FREEZE') { score += 15; reasons.push('情绪冰期🔴') }
  else if (marketSentiment === 'RETREAT') { score += 25; reasons.push('退潮期🔴') }

  // 因子5: 席位卖出信号
  if (hasSeatSelling) { score += 20; reasons.push('游资在卖⚠️') }

  // 映射到概率
  let probability
  if (score <= 10) probability = 5
  else if (score <= 25) probability = 15
  else if (score <= 40) probability = 35
  else if (score <= 60) probability = 55
  else probability = 75

  return {
    probability,
    score,
    riskLevel: probability < 15 ? '低' : probability < 35 ? '中' : probability < 55 ? '高' : '极高',
    reasons,
    recommendation: probability < 15 ? '🟢 可跟' : probability < 35 ? '🟡 谨慎跟' : probability < 55 ? '🟠 轻仓或不跟' : '🔴 不跟',
  }
}

// ============================================================
// 4. 三引擎矛盾仲裁
// ============================================================
function arbitrate(e1, e2, e3, sentiment) {
  const results = { e1: e1?.verdict || null, e2: e2?.verdict || null, e3: e3?.verdict || null }
  const { FREEZE, RECOVERY, CLIMAX, RETREAT } = { FREEZE:'FREEZE', RECOVERY:'RECOVERY', CLIMAX:'CLIMAX', RETREAT:'RETREAT' }

  // 规则1: 三流全pass + 宏观无风险
  if (e1?.verdict === 'pass' && e2?.verdict === 'pass' && e3?.macroRisk !== '高') {
    return { action:'重仓(6-8成)', priority:'🥇', reason:'三流共振无矛盾', conviction:'高' }
  }

  // 规则2: 引擎1pass但引擎3宏观风险高
  if (e1?.verdict === 'pass' && e3?.macroRisk === '高') {
    return { action:'降半仓(3-5成)', priority:'🥈', reason:'基本面好但宏观环境不利', conviction:'中' }
  }

  // 规则3: 引擎1fail但引擎2pass → 仅跟庄
  if ((e1?.verdict === 'fail' || e1?.verdict === 'conditional') && e2?.verdict === 'pass') {
    return { action:'仅跟庄(1-2成)', priority:'🥉', reason:'基本面有硬伤，仅投机', conviction:'低' }
  }

  // 规则4: 情绪退潮 OR 冰点
  if (sentiment === 'RETREAT') {
    return { action:'空仓/轻仓', priority:'—', reason:'情绪退潮期，控制风险', conviction:'—' }
  }
  if (sentiment === 'FREEZE' && e1?.verdict === 'pass') {
    return { action:'可建仓(5成)', priority:'🥇', reason:'冰点+基本面好=最佳建仓时机', conviction:'高' }
  }

  // 规则5: 情绪高潮 + 引擎2pass
  if (sentiment === 'CLIMAX') {
    return { action:'快进快出(1-2成)', priority:'🥉', reason:'高潮期追高风险大', conviction:'低' }
  }

  // 默认
  return { action:'正常仓位(3-5成)', priority:'🥈', reason:'正常市场环境', conviction:'中' }
}

// 导出
export { SENTIMENT_STAGES, detectSentimentStage, getStrategyByStage, SEAT_DB, identifySeat, getStrategyForSeat, calculateExplosionProbability, arbitrate }
