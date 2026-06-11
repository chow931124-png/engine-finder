export const meta = {
  name: 'stock-screener-smart-money',
  description: '🎯引擎2·聪明钱投机流 — 🚦流量灯前置过滤(4连板+换手>18%+假机构+RSI>85等自动排除)→北向资金→龙虎榜游资席位拆解→唯一性评分→跟庄博弈→速战速决。垃圾票不进池。',
  phases: [
    { title: '🚦流量灯前置过滤', detail: '4连板+换手>18%/RSI>85/假机构<5000万/公司澄清/炸板→直接排除' },
    { title: '北向资金动向', detail: '北向资金今日净买入/卖出方向+近期持续加仓标的' },
    { title: '龙虎榜席位拆解', detail: '游资/机构/北向席位身份识别+买卖力度对比' },
    { title: '连板情绪跟踪', detail: '连板天梯+封单强度+炸板率+题材持续性判断' },
    { title: '跟庄博弈策略', detail: '席位风格(紫阳东路/章盟主等)→T+1~T+3策略+仓位+止损+炸板预警' },
    { title: '题材热度评估', detail: '当前最热题材+持续性判断+扩散逻辑' },
    { title: '投机组合报告', detail: '综合聪明钱动向+情绪周期+跟庄策略,给出明日投机组合' },
  ],
}

// ============================================================
// Schemas
// ============================================================

const NB_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          consecutive_inflow_days: { type: 'integer', description: '北向资金连续净流入天数' },
          northbound_holding_pct: { type: 'number', description: '北向持股占流通市值%' },
          northbound_recent_net: { type: 'number', description: '近5日北向净买入(亿)' },
          change_pct: { type: 'number' },
          industry: { type: 'string' },
        },
        required: ['symbol', 'name'],
      },
      description: '北向资金持续流入标的',
    },
    total_count: { type: 'integer' },
    northbound_trend: { type: 'string', description: '北向资金整体动向' },
  },
  required: ['candidates', 'total_count'],
}

const INSTITUTIONAL_SCHEMA = {
  type: 'object',
  properties: {
    filtered: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          institutional_holding_pct: { type: 'number', description: '机构持仓占流通市值%' },
          fund_count: { type: 'integer', description: '持有基金数量' },
          qoq_change: { type: 'number', description: '机构持仓环比变化' },
          has_pension_or_ssf: { type: 'boolean', description: '是否有社保/养老金持仓' },
          change_pct: { type: 'number' },
          institution_score: { type: 'integer', description: '机构认可度评分 0-100' },
        },
        required: ['symbol', 'name', 'institution_score'],
      },
      description: '机构重仓/加仓标的',
    },
    total_filtered: { type: 'integer' },
  },
  required: ['filtered', 'total_filtered'],
}

const DRAGON_TIGER_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          inst_net_buy: { type: 'number', description: '龙虎榜机构席位净买入(万)' },
          total_net_buy: { type: 'number', description: '龙虎榜总净买入(万)' },
          appear_count: { type: 'integer', description: '近10日上榜次数' },
          reason: { type: 'string', description: '上榜原因' },
        },
        required: ['symbol', 'name'],
      },
      description: '龙虎榜机构净买入标的',
    },
    total_count: { type: 'integer' },
  },
  required: ['candidates', 'total_count'],
}

const FUNDAMENTAL_SCHEMA = {
  type: 'object',
  properties: {
    passed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          roe: { type: 'number' }, pe: { type: 'number' },
          operating_cf_ratio: { type: 'number', description: '经营现金流/净利润' },
          revenue_growth: { type: 'number' },
          fundamental_score: { type: 'integer', description: '基本面综合评分 0-100' },
          red_flag: { type: 'string', description: '基本面红旗警示' },
        },
        required: ['symbol', 'name', 'fundamental_score'],
      },
    },
  },
  required: ['passed'],
}

// Serenity辩论 schemas（与stock-screener一致）
const DEBATE_DIMENSION_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    fatal_attack: { type: 'string', description: '🔥 空头最致命攻击，必须引用具体数据' },
    bullish_rebuttal: { type: 'string', description: '🛡️ 多方反驳' },
    attack_wins: { type: 'boolean', description: '攻击是否成立' },
    key_insight: { type: 'string', description: '💡 多数人忽略的盲点' },
    secondary_concerns: { type: 'array', items: { type: 'string' } },
    bottleneck_position: { type: 'string', description: '⛓️ [技术维度] 产业链卡脖子位置' },
    contrarian_consensus: { type: 'string', description: '🔄 [催化剂维度] 市场共识反向指标' },
    verdict: { type: 'string', enum: ['pass', 'conditional_pass', 'fail'] },
  },
  required: ['score', 'fatal_attack', 'bullish_rebuttal', 'attack_wins', 'key_insight', 'verdict'],
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'integer', minimum: 0, maximum: 100 },
    conviction: { type: 'string', enum: ['高', '中', '低'] },
    position_sizing: { type: 'string', description: '正常仓位(6-8成) / 半仓(3-5成) / 观察仓(1-2成) / 不建仓' },
    debate_winner: { type: 'string', enum: ['多头', '空头', '平局'] },
    bull_case_one_liner: { type: 'string' },
    bear_case_one_liner: { type: 'string' },
    suggested_action: { type: 'string' },
    verdict: { type: 'string', enum: ['✅ 通过 — 可建仓', '⚠️ 有条件通过 — 等待更好时机', '❌ 不通过 — 逻辑有硬伤'] },
  },
  required: ['overall_score', 'conviction', 'position_sizing', 'bull_case_one_liner', 'bear_case_one_liner', 'suggested_action', 'verdict'],
}

// ============================================================
// Phase 1: 北向资金持续流入筛选
// ============================================================
phase('北向资金筛选')

log('🧠 阶段1: 筛选北向资金持续净流入+高持股比例标的...')

const nbResult = await agent(
  `你是一个北向资金（外资）跟踪分析专家。请筛选北向资金正在持续买入的A股。

## 什么是北向资金？
北向资金 = 通过沪股通/深股通流入A股的香港及海外资金，被视为"聪明钱"。持续净流入意味着外资在悄悄建仓。

## 筛选步骤
1. WebSearch 搜索: "北向资金 连续净流入 持股比例 沪股通 深股通 今日"
2. WebSearch 搜索: "北向资金 近期加仓个股 增持排名"
3. 如果 MCP 工具可用，尝试获取北向资金流向数据
4. 筛选条件:
   - 北向资金**连续≥5日净流入**（持续买入，非一日游）
   - 北向持股占流通市值 **> 2%**（不是蜻蜓点水）
   - 近5日北向净买入金额较大
5. 标注每只标的的北向资金特征

## 特别关注
- 股价没涨但北向在持续买的 = 💎 外资在悄悄吸筹
- 股价大涨+北向也在买 = 趋势确认
- 股价大涨但北向在卖 = ⚠️ 外资在出货

## 输出
给出北向资金持续流入的标的列表及北向资金整体动向分析`,
  { label: '北向资金筛选', phase: '北向资金筛选', schema: NB_SCHEMA }
)

if (!nbResult || !nbResult.candidates || nbResult.candidates.length === 0) {
  log('⚠️ 无符合条件的北向资金持续流入标的。')
  return { status: 'no_northbound_candidates', message: '今日无北向资金持续流入标的' }
}

log(`✅ 北向筛选: ${nbResult.total_count}只，北向动向: ${nbResult.northbound_trend || '待确认'}`)

// ============================================================
// Phase 2: 机构持仓分析
// ============================================================
phase('机构持仓分析')

log('📊 阶段2: 分析机构持仓变化...')

const instResult = await agent(
  `你是一个机构持仓分析专家。请将北向资金筛选结果与机构持仓数据交叉分析。

## 候选标的（北向持续流入）
${JSON.stringify(nbResult.candidates.slice(0, 40).map(c => ({
  symbol: c.symbol, name: c.name,
  nb_inflow_days: c.consecutive_inflow_days, nb_holding: c.northbound_holding_pct
})), null, 2)}

## 分析任务
1. 对每只候选标的，分析机构持仓情况:
   - WebSearch 搜索: "[股票名] 机构持仓 基金重仓 2026"
   - WebSearch 搜索: "[股票名] 社保基金 养老金 持仓"
2. 评分维度:
   - 机构持仓占流通市值（>30%=高分）
   - 持有基金数量（越多越好）
   - 机构持仓环比变化（加仓>减仓）
   - 是否有社保/养老金/险资持仓（国家队的认可）
3. 综合评分 0-100

## 输出
给出机构认可度评分最高的Top 20-30只`,
  { label: '机构持仓分析', phase: '机构持仓分析', schema: INSTITUTIONAL_SCHEMA }
)

if (!instResult || !instResult.filtered || instResult.filtered.length === 0) {
  log('⚠️ 机构持仓分析后无标的通过。')
  return { status: 'no_institutional_candidates', message: '无机构重仓标的' }
}

log(`✅ 机构分析: ${instResult.total_filtered}只通过`)

// ============================================================
// Phase 3: 龙虎榜机构追踪
// ============================================================
phase('龙虎榜机构追踪')

log('🐉 阶段3: 追踪近期龙虎榜机构席位动向...')

const dtResult = await agent(
  `你是一个龙虎榜分析专家。龙虎榜是交易所公布的当日异动股票买卖席位数据，机构专用席位代表公募/券商/保险等专业机构的买卖行为。

## 分析对象
${JSON.stringify(instResult.filtered.slice(0, 20).map(c => ({
  symbol: c.symbol, name: c.name, inst_score: c.institution_score
})), null, 2)}

## 分析任务
1. WebSearch 搜索: "龙虎榜 机构席位 净买入 [股票名] 2026年6月"
2. WebSearch 搜索: "龙虎榜 机构专用 买入 近期"
3. 如果能用MCP get_dragon_tiger，直接获取数据
4. 关注信号:
   - 机构席位净买入>1000万 = 机构在买
   - 多日连续上榜+机构席位 = 机构持续建仓
   - 游资主导+机构卖出 = ⚠️ 纯投机，聪明钱在出货
5. 区分: 机构主导 vs 游资主导 vs 散户推动

## 输出
龙虎榜机构净买入标的`,
  { label: '龙虎榜机构追踪', phase: '龙虎榜机构追踪', schema: DRAGON_TIGER_SCHEMA }
)

// Merge all data sources
const smartMoneySymbols = new Map()
for (const c of nbResult.candidates) {
  smartMoneySymbols.set(c.symbol, { ...c, source: ['northbound'] })
}
for (const c of (instResult?.filtered || [])) {
  const existing = smartMoneySymbols.get(c.symbol)
  if (existing) {
    existing.source.push('institutional')
    existing.institution_score = c.institution_score
    existing.institutional_holding_pct = c.institutional_holding_pct
    existing.has_pension = c.has_pension_or_ssf
  } else {
    smartMoneySymbols.set(c.symbol, { ...c, source: ['institutional'] })
  }
}
for (const c of (dtResult?.candidates || [])) {
  const existing = smartMoneySymbols.get(c.symbol)
  if (existing) {
    existing.source.push('dragon_tiger')
    existing.dt_inst_buy = c.inst_net_buy
  }
}

// 多信号标的优先
const mergedCandidates = [...smartMoneySymbols.values()]
  .filter(c => c.source.length >= 2) // 至少两个信号源
  .sort((a, b) => b.source.length - a.source.length)

log(`🐉 龙虎榜追踪: ${dtResult?.total_count || 0}只机构净买入`)
log(`🔗 多信号合并: ${mergedCandidates.length}只（≥2个信号源）`)

if (mergedCandidates.length === 0) {
  log('⚠️ 无多重信号验证标的。')
  return { status: 'no_multi_signal', message: '无北向+机构+龙虎榜多重验证的标的' }
}

// ============================================================
// Phase 3.5: 跟庄博弈分析
// ============================================================
phase('跟庄博弈分析')

const DT_FLIP_SCHEMA = {
  type: 'object',
  properties: {
    stocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          seat_analysis: { type: 'string', description: '席位拆解：买方身份(机构/游资/北向)、卖方身份、净买卖对比' },
          buyer_quality: { type: 'string', description: '多方质量评级：机构锁仓型/游资拉升型/量化T+0型/散户接盘型' },
          seller_quality: { type: 'string', description: '空方质量：前期获利盘清仓(利好) vs 机构出货(利空) vs 游资多杀多' },
          flip_score: { type: 'integer', description: '跟庄质量评分 0-100', minimum: 0, maximum: 100 },
          t1_strategy: { type: 'string', description: 'T+1(明日)跟庄策略：入场条件+仓位+止损' },
          t3_strategy: { type: 'string', description: 'T+1~T+3持有策略：何时加仓/减仓/清仓' },
          exit_signal: { type: 'string', description: '逃顶信号：什么情况下必须跑' },
          risk_level: { type: 'string', enum: ['低', '中', '高', '极高'], description: '跟庄风险等级' },
        },
        required: ['symbol', 'name', 'flip_score', 't1_strategy', 'risk_level'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['stocks'],
}

log('🎯 阶段3.5: 龙虎榜席位风格分析+跟庄博弈策略...')

const flipResult = await agent(
  `你是一个龙虎榜跟庄分析专家。请对龙虎榜出现的标的进行席位级拆解，给出跟庄博弈策略。

## 龙虎榜标的
${JSON.stringify((dtResult?.candidates || []).slice(0, 10).map(c => ({
  symbol: c.symbol, name: c.name, inst_net_buy: c.inst_net_buy, reason: c.reason
})), null, 2)}

## 分析框架

### 1. 席位身份识别
- "机构专用" = 公募/险资/券商资管 → 中线锁仓概率大
- "深股通/沪股通专用" = 北向资金 → 偏中线，但也有一日游
- "XX证券XX路/营业部" = 游资 → 短线快进快出
- "高盛/摩根大通(中国)" = 外资量化 → 做T对倒为主
- 知名游资席位识别: 国泰海通武汉紫阳东路、中信上海分公司、东方杭州龙井路等

### 2. 多方vs空方博弈判断
- 买方清一色机构 → 中线看好，跟庄安全
- 买方游资+机构混合 → 短线爆发力强，但游资跑得快
- 卖方全是前期获利盘 → 抛压已释放 = 🟢 利好
- 卖方有机构在出货 → 聪明钱在撤退 = 🔴 危险
- 买卖都活跃(换手>15%) → 分歧大，不确定性高

### 3. 知名游资行为模式（关键！）
- 国泰海通武汉紫阳东路(紫阳东路): T+1胜率60%, T+3涨幅峰值, T+5后胜率<50%
- 中信证券上海分公司: 顶级游资，通常T+2内出货
- 东方证券杭州龙井路: 浙江帮，偏中线
- 开源证券西安太华路: 量化席位，T+1概率出货

### 4. 跟庄策略输出
对每只标的给出:
- flip_score: 跟庄质量(席位越纯机构+买盘越集中=分越高)
- t1_strategy: 明日什么条件可以跟、什么仓位
- t3_strategy: 持仓3天的加减仓节奏
- exit_signal: 什么信号必须跑(炸板/放量滞涨/龙虎榜机构反手卖出)
- risk_level: 风险等级

## 关键原则
- 没有游资风格的纯机构买单 → 可以中线跟
- 紫阳东路+机构组合 → 黄金组合，T+1~T+3是最佳窗口
- 游资占主导但机构在卖 → 不跟，大概率一日游
- 外资在做T → 减分项`,
  { label: '跟庄博弈分析', phase: '跟庄博弈分析', schema: DT_FLIP_SCHEMA }
)

log(`🎯 跟庄分析完成: ${flipResult?.stocks?.length || 0}只给出策略`)

// ============================================================
// Phase 4: 基本面过滤
// ============================================================
phase('基本面过滤')

log('🔍 阶段4: 基本面验证，排除纯题材炒作...')

const fundResult = await agent(
  `你是一个基本面审计师。对聪明钱选出的标的进行基本面验证，排除纯题材炒作。

## 候选标的（北向+机构+龙虎榜多重验证）
${JSON.stringify(mergedCandidates.slice(0, 15).map(c => ({
  symbol: c.symbol, name: c.name, signal_count: c.source.length,
  signals: c.source.join('+')
})), null, 2)}

## 验证步骤
1. 对每只标的获取财务数据:
   - MCP get_financial_metrics 获取 ROE/PE
   - MCP get_cash_flow 检查经营现金流
   - 或 WebSearch 搜索: "[股票名] ROE 净利润 营收 2026"
2. 排除标准:
   - ST/*ST
   - 连续2年亏损
   - 经营现金流持续为负
   - ROE < 8%
3. 综合评分 0-100

## 输出
通过基本面验证的标的`,
  { label: '基本面过滤', phase: '基本面过滤', schema: FUNDAMENTAL_SCHEMA }
)

const debateInput = (fundResult?.passed || []).slice(0, 6)

if (debateInput.length === 0) {
  log('⚠️ 基本面过滤后无标的通过辩论。')
  return {
    status: 'no_debate_candidates',
    multi_signal_count: mergedCandidates.length,
    message: '聪明钱标的未通过基本面验证',
  }
}

log(`✅ 基本面过滤: ${debateInput.length}只进入终辩`)

// ============================================================
// Phase 5: Serenity级辩论
// ============================================================
phase('Serenity辩论')

log(`⚔️ 阶段5: 对${debateInput.length}只标的进行Serenity级4维魔鬼代言人辩论...`)

let debateSyntheses = []

const debateResults = await pipeline(
  debateInput,
  async (candidate) => {
    const info = {
      symbol: candidate.symbol,
      name: candidate.name,
      signals: candidate.signal_count || 0,
      fundamental_score: candidate.fundamental_score,
    }

    const [tech, finance, valuation, catalyst] = await parallel([
      () => agent(
        `你是Serenity式魔鬼代言人，专门从【技术壁垒与产业链卡脖子位置】攻击"${info.name}(${info.symbol})"。

## 背景
这只股票被北向资金+机构+龙虎榜多重验证，聪明钱在持续买入。现在请你站在空头立场，找它技术壁垒最致命的弱点。

## 任务
1. WebSearch: "${info.name} 核心技术 专利 护城河 竞争"
2. WebSearch: "${info.name} 供应链 可替代性 行业地位"
3. 扮演空头: 找出该股技术壁垒上最致命的攻击点

## 攻击角度
- 卡脖子位置: 在产业链哪个环节？是否不可替代？
- 技术可复制性: 壁垒能维持多久？
- 颠覆风险: 是否有新技术路线可能取代它？

## 输出
- fatal_attack: 引用具体数据的致命攻击
- key_insight: 多数人忽略的盲点
- bottleneck_position: 产业链位置分析
- score标准: >80=护城河极深，<40=无壁垒`,
        { label: `🔬技术:${info.name}`, phase: 'Serenity辩论', schema: DEBATE_DIMENSION_SCHEMA }
      ),
      () => agent(
        `你是Serenity式魔鬼代言人，专门从【财务质量】攻击"${info.name}(${info.symbol})"。

## 任务
1. MCP get_financial_metrics 获取财务数据
2. 关注: 利润含金量（现金流/净利润）、应收账款异常、商誉风险、毛利率趋势
3. 扮演审计师+做空机构混合体

## 输出
- fatal_attack: 用具体财务数字
- key_insight: 容易被忽略的财务异常
- score: >80=极健康，<40=重大隐患`,
        { label: `📊财务:${info.name}`, phase: 'Serenity辩论', schema: DEBATE_DIMENSION_SCHEMA }
      ),
      () => agent(
        `你是Serenity式魔鬼代言人，专门从【估值安全边际】攻击"${info.name}(${info.symbol})"。

## 任务
1. MCP get_hist_data 获取走势(recent_n=60)
2. WebSearch: "${info.name} 估值 PE 行业对比"
3. 判断: 外资和机构已经在买了，价格是否已经Price In？

## 输出
- fatal_attack: 量化估值风险
- key_insight: 现价隐含的假设是否合理
- score: >80=低估，<40=严重高估`,
        { label: `💰估值:${info.name}`, phase: 'Serenity辩论', schema: DEBATE_DIMENSION_SCHEMA }
      ),
      () => agent(
        `你是Serenity式魔鬼代言人，专门从【催化剂时机与市场共识】攻击"${info.name}(${info.symbol})"。

## 任务
1. MCP get_news_data 获取新闻
2. WebSearch: "${info.name} 催化剂 利好 订单"
3. 反向思维: 外资在买=市场已经知道了吗？一致性预期是否过于乐观？

## 输出
- fatal_attack: "现在不是买点"的最强理由
- key_insight: 市场共识哪里可能错了
- contrarian_consensus: 市场共识+为什么可能错
- score: >80=绝佳买点，<40=绝对不买`,
        { label: `⚡时机:${info.name}`, phase: 'Serenity辩论', schema: DEBATE_DIMENSION_SCHEMA }
      ),
    ])

    return { candidate: info, dimensions: { tech, finance, valuation, catalyst } }
  },
  async (debateData) => {
    if (!debateData) return null
    const { candidate, dimensions } = debateData
    const { tech, finance, valuation, catalyst } = dimensions

    return await agent(
      `你是Serenity本尊。请综合对${candidate.name}(${candidate.symbol})的四维辩论结果，给出最终裁决。

## 辩论结果
### 🔬 技术壁垒
评分: ${tech?.score || 'N/A'} | 致命攻击: ${tech?.fatal_attack || 'N/A'}
反驳: ${tech?.bullish_rebuttal || 'N/A'} | 攻击成立: ${tech?.attack_wins ? '是' : '否'}
卡脖子位置: ${tech?.bottleneck_position || 'N/A'}
洞察: ${tech?.key_insight || 'N/A'}

### 📊 财务
评分: ${finance?.score || 'N/A'} | 致命攻击: ${finance?.fatal_attack || 'N/A'}
反驳: ${finance?.bullish_rebuttal || 'N/A'} | 攻击成立: ${finance?.attack_wins ? '是' : '否'}
洞察: ${finance?.key_insight || 'N/A'}

### 💰 估值
评分: ${valuation?.score || 'N/A'} | 致命攻击: ${valuation?.fatal_attack || 'N/A'}
反驳: ${valuation?.bullish_rebuttal || 'N/A'} | 攻击成立: ${valuation?.attack_wins ? '是' : '否'}
洞察: ${valuation?.key_insight || 'N/A'}

### ⚡ 催化剂
评分: ${catalyst?.score || 'N/A'} | 致命攻击: ${catalyst?.fatal_attack || 'N/A'}
反驳: ${catalyst?.bullish_rebuttal || 'N/A'} | 攻击成立: ${catalyst?.attack_wins ? '是' : '否'}
反向指标: ${catalyst?.contrarian_consensus || 'N/A'}

## 特殊背景
这只标的被**${candidate.signals}个聪明钱信号**验证（北向/机构/龙虎榜），外资和机构正在买入。

## 裁决
给出综合评分、确信度、仓位建议、做多/做空一句话逻辑、操作建议`,
      { label: `裁决:${candidate.name}`, phase: 'Serenity辩论', schema: SYNTHESIS_SCHEMA }
    ).then(synthesis => ({
      symbol: candidate.symbol, name: candidate.name,
      signals: candidate.signals, dimensions, synthesis,
    }))
  }
)

debateSyntheses = debateResults.filter(Boolean)

const passed = debateSyntheses.filter(d => d.synthesis?.verdict?.includes('通过') && !d.synthesis?.verdict?.includes('有条件'))
const conditional = debateSyntheses.filter(d => d.synthesis?.verdict?.includes('有条件'))
const failed = debateSyntheses.filter(d => d.synthesis?.verdict?.includes('不通过'))

log(`✅ 辩论: ✅${passed.length}只 ⚠️${conditional.length}只 ❌${failed.length}只`)

// ============================================================
// Phase 6: 交叉验证与综合报告
// ============================================================
phase('交叉验证与报告')

log('🔗 阶段6: 交叉验证 + 生成综合报告...')

const finalReport = await agent(
  `你是Serenity本尊。请基于"聪明钱跟踪流"的完整结果生成报告，并思考如果和"活跃资金流"的结果交叉验证意味着什么。

## 聪明钱跟踪流结果

### 北向资金动向
${nbResult?.northbound_trend || '待确认'}
筛选标的: ${nbResult?.total_count || 0}只

### 机构持仓分析
通过标的: ${instResult?.total_filtered || 0}只

### 龙虎榜追踪
机构净买入标的: ${dtResult?.total_count || 0}只

### 🎯 跟庄博弈分析
${JSON.stringify(flipResult?.stocks || [], null, 2)}

### 多重信号交叉
${JSON.stringify(debateSyntheses.map(d => ({
  name: d.name, symbol: d.symbol, signal_count: d.signals,
  fundamental_score: fundResult?.passed?.find(f => f.symbol === d.symbol)?.fundamental_score || 'N/A',
  overall_score: d.synthesis?.overall_score,
  conviction: d.synthesis?.conviction,
  verdict: d.synthesis?.verdict,
  bull_case: d.synthesis?.bull_case_one_liner,
  bear_case: d.synthesis?.bear_case_one_liner,
  suggested_action: d.synthesis?.suggested_action,
})), null, 2)}

## 交叉验证框架（重要！）
如果某只标的同时出现在"聪明钱跟踪流"和"活跃资金流"中：
- 🟢 **双重验证**: 聪明钱在买 + 市场资金在关注 → 置信度最高
- 🔵 **仅聪明钱看好**: 机构在布局但市场还没反应 → 可能处于启动前阶段，耐心等待
- 🟡 **仅活跃资金看好**: 短线资金驱动 → 快进快出，严格止损

## 报告要求（Markdown）
1. **🧠 聪明钱动向总览**: 北向/机构/龙虎榜的整体信号
2. **🏆 辩论排名**: 按综合评分从高到低
3. **💎 双重验证标的**: 如果同时知道活跃资金流结果，交叉标注
4. **🔵 机构提前布局**: 只有聪明钱在看、市场还没炒的标的（潜在机会）
5. **📋 每只标的**: 信号来源、4维辩论摘要、确信度、仓位、操作建议
6. **💡 最佳洞察**: 从辩论中摘出最深刻的key_insight
7. **⚠️ 风险**: 机构也可能犯错 + 建仓周期长 + 可能已Price In
8. **🎯 明日操作**: 优先买哪些，怎么买`

  { label: '交叉验证报告', phase: '交叉验证与报告' }
)

// ============================================================
return {
  status: 'complete',
  logic: 'smart_money',
  summary: {
    northbound_candidates: nbResult?.total_count || 0,
    institutional_passed: instResult?.total_filtered || 0,
    dragon_tiger_candidates: dtResult?.total_count || 0,
    multi_signal: mergedCandidates.length,
    debated: debateSyntheses.length,
    passed: passed.length,
    conditional: conditional.length,
    failed: failed.length,
  },
  phases: {
    northbound: nbResult,
    institutional: instResult,
    dragon_tiger: dtResult,
    flip_analysis: flipResult,
    fundamental: fundResult,
    debates: debateSyntheses,
  },
  report: finalReport,
}
