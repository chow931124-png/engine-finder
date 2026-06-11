export const meta = {
  name: 'stock-screener',
  description: '🔬引擎1·Serenity深度辩论选股 — 自上而下(十五五政策→产业链闭环→关键节点)+自下而上(全市场活跃标的→资金面)→4+1维魔鬼代言人辩论(卡脖子+致命攻击+多方反驳+洞察+反向指标+📡美股映射)→确信度仓位映射。两条路径交叉验证，只选能扛住空头最狠攻击的标的。🚦流量灯前置·美股锚定分修正。',
  phases: [
    { title: '十五五产业链分析', detail: '十五五政策方向→产业链闭环→关键卡脖子节点→对应标的池' },
    { title: '全市场活跃标的初筛', detail: '自下而上：按成交活跃度筛选，捕获上升趋势标的' },
    { title: '双路径交叉', detail: '自上而下标的池 ∩ 自下而上活跃标的 → 优先辩论候选' },
    { title: '资金面筛选+分类', detail: '大单资金流入+情绪龙头/基本面硬核/混合型分类' },
    { title: 'AI标的分类', detail: '深度分类确认' },
    { title: '持有周期分析', detail: '判断超短线/波段/长期持有' },
    { title: '4+1维魔鬼代言人辩论', detail: 'Serenity级深度：4维传统辩论 + 📡美股映射锚定分析' },
    { title: '综合裁决与报告', detail: '产业链位置评估+确信度→仓位映射+美股锚定分修正，完整投资报告' },
  ],
}

// ============================================================
// Schemas
// ============================================================

const CANDIDATE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: '股票代码' },
          name: { type: 'string', description: '股票名称' },
          change_pct: { type: 'number', description: '涨跌幅%' },
          current_price: { type: 'number', description: '当前价' },
          turnover_rate: { type: 'number', description: '换手率%' },
          volume_ratio: { type: 'number', description: '量比' },
          amount: { type: 'number', description: '成交额(亿)' },
          market_cap: { type: 'number', description: '市值(亿)' },
          trend_note: { type: 'string', description: '近期趋势描述（上升/震荡/下跌）' },
        },
        required: ['symbol', 'name'],
      },
      description: '市场活跃标的列表（不限涨幅，涵盖上升趋势标的）',
    },
    total_count: { type: 'integer' },
    top_sectors: { type: 'array', items: { type: 'string' }, description: '活跃板块' },
    market_note: { type: 'string', description: '今日市场特征一句话' },
  },
  required: ['candidates', 'total_count'],
}

const MONEY_FLOW_SCHEMA = {
  type: 'object',
  properties: {
    filtered: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          name: { type: 'string' },
          change_pct: { type: 'number' },
          main_net_inflow: { type: 'number', description: '主力净流入(万元)' },
          super_large_net_inflow: { type: 'number', description: '超大单净流入(万元)' },
          large_net_inflow: { type: 'number', description: '大单净流入(万元)' },
          money_flow_score: { type: 'integer', description: '资金面评分 0-100' },
          money_flow_note: { type: 'string', description: '资金面一句话点评' },
        },
        required: ['symbol', 'name', 'money_flow_score'],
      },
      description: '资金面筛选后的标的 (Top 20-30)',
    },
    total_filtered: { type: 'integer' },
  },
  required: ['filtered', 'total_filtered'],
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    sentiment_leaders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          change_pct: { type: 'number' }, money_flow_score: { type: 'integer' },
          reason: { type: 'string' }, hot_topic: { type: 'string' },
        },
        required: ['symbol', 'name', 'reason'],
      },
    },
    fundamental_hard: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          change_pct: { type: 'number' }, money_flow_score: { type: 'integer' },
          reason: { type: 'string' }, roe: { type: 'number' }, pe: { type: 'number' },
        },
        required: ['symbol', 'name', 'reason'],
      },
    },
    hybrid: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          change_pct: { type: 'number' }, money_flow_score: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['symbol', 'name', 'reason'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['sentiment_leaders', 'fundamental_hard', 'hybrid'],
}

const HOLDING_SCHEMA = {
  type: 'object',
  properties: {
    ultra_short: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          category: { type: 'string' },
          entry_plan: { type: 'string' }, stop_loss: { type: 'string' },
          target_return: { type: 'string' },
        },
        required: ['symbol', 'name', 'entry_plan'],
      },
    },
    swing: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          category: { type: 'string' },
          entry_plan: { type: 'string' }, catalyst: { type: 'string' },
          target_return: { type: 'string' },
        },
        required: ['symbol', 'name', 'entry_plan'],
      },
    },
    long_term: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          category: { type: 'string' },
          core_logic: { type: 'string' }, valuation_view: { type: 'string' },
        },
        required: ['symbol', 'name', 'core_logic'],
      },
    },
  },
  required: ['ultra_short', 'swing', 'long_term'],
}

// Serenity级深度辩论 — 单维度输出schema
const DEBATE_DIMENSION_SCHEMA = {
  type: 'object',
  properties: {
    score: {
      type: 'integer', description: '该维度综合评分 0-100',
      minimum: 0, maximum: 100,
    },
    fatal_attack: {
      type: 'string',
      description: '🔥 空头最致命攻击——如果只用一个理由否定这只股票，是什么？必须引用具体数据，不能泛泛而谈。',
    },
    bullish_rebuttal: {
      type: 'string',
      description: '🛡️ 多方反驳——Serenity会如何反驳这个致命攻击？这个反驳是否足够有力？',
    },
    attack_wins: {
      type: 'boolean',
      description: '攻击是否成立？true=空头胜出（这个维度有硬伤），false=多方反驳有效（通过考验）',
    },
    key_insight: {
      type: 'string',
      description: '💡 这个维度最深刻的洞察——一条多数人不知道或忽略的盲点。必须让人看完觉得"原来如此"。',
    },
    secondary_concerns: {
      type: 'array', items: { type: 'string' },
      description: '其他次要风险/关注点，2-3条',
    },
    // 技术壁垒维度专用
    bottleneck_position: {
      type: 'string',
      description: '⛓️ [仅技术壁垒维度] 产业链卡脖子位置分析：该公司在供应链的哪个环节？是否不可替代？上游谁卡它？它卡下游谁？',
    },
    // 催化剂维度专用
    contrarian_consensus: {
      type: 'string',
      description: '🔄 [仅催化剂维度] 反向指标：当前市场共识是什么？这个共识为什么可能是错的？一致性预期往往是反向指标。',
    },
    verdict: {
      type: 'string', enum: ['pass', 'conditional_pass', 'fail'],
      description: '判决：pass=通过，conditional_pass=有条件通过，fail=不通过',
    },
  },
  required: ['score', 'fatal_attack', 'bullish_rebuttal', 'attack_wins', 'key_insight', 'verdict'],
}

// 综合裁决schema
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'integer', description: '加权综合评分 0-100', minimum: 0, maximum: 100 },
    conviction: {
      type: 'string', enum: ['高', '中', '低'],
      description: '确信度：高=可重仓，中=正常仓位，低=轻仓或观察',
    },
    position_sizing: {
      type: 'string',
      description: '建议仓位：正常仓位(6-8成) / 半仓(3-5成) / 观察仓(1-2成) / 不建仓',
    },
    debate_winner: {
      type: 'string', enum: ['多头', '空头', '平局'],
      description: '辩论胜方',
    },
    bull_case_one_liner: { type: 'string', description: '做多核心逻辑，一句话' },
    bear_case_one_liner: { type: 'string', description: '做空/不买核心逻辑，一句话' },
    suggested_action: { type: 'string', description: '具体操作建议（含仓位、时机、止损思路）' },
    key_risk: { type: 'string', description: '最需要警惕的一个风险' },
    verdict: {
      type: 'string',
      enum: ['✅ 通过 — 可建仓', '⚠️ 有条件通过 — 等待更好时机', '❌ 不通过 — 逻辑有硬伤'],
      description: '最终裁决',
    },
  },
  required: ['overall_score', 'conviction', 'position_sizing', 'bull_case_one_liner', 'bear_case_one_liner', 'suggested_action', 'verdict'],
}

// ============================================================
// Phase 0: 十五五政策→产业链闭环→关键节点标的池
// ============================================================
phase('十五五产业链分析')

const POLICY_CHAIN_SCHEMA = {
  type: 'object',
  properties: {
    focus_chains: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chain_name: { type: 'string', description: '产业链名称' },
          policy_source: { type: 'string', description: '政策来源(十五五/工信部/大基金等)' },
          upstream: { type: 'string', description: '上游(材料/设备)' },
          midstream: { type: 'string', description: '中游(制造/封装)' },
          downstream: { type: 'string', description: '下游(应用/集成)' },
          bottleneck_node: { type: 'string', description: '卡脖子节点——哪个环节国内最弱/最不可替代？' },
          pricing_power_node: { type: 'string', description: '定价权节点——哪个环节议价权最强？' },
          candidate_stocks: { type: 'array', items: { type: 'object', properties: { symbol: { type: 'string' }, name: { type: 'string' }, position: { type: 'string' } } } },
        },
        required: ['chain_name', 'bottleneck_node', 'candidate_stocks'],
      },
      description: '十五五重点产业链及关键节点标的',
    },
    top_down_summary: { type: 'string', description: '自上而下核心结论' },
  },
  required: ['focus_chains'],
}

log('🏛️ 阶段0: 十五五政策→产业链闭环分析→关键节点标的池...')

const policyChainResult = await agent(
  `你是一个国家战略+产业链分析专家。从"十五五"国家战略出发，找到产业链关键卡脖子节点上的A股标的。

## 分析框架：政策 → 产业链闭环 → 关键节点 → 标的

### 第一步：确认十五五核心方向
1. WebSearch: "十五五规划 六大新兴支柱产业 集成电路 低空经济 2026"
2. WebSearch: "十五五 六大未来产业 量子 具身智能 6G 2026"
3. WebSearch: "国家大基金 三期 投资方向 半导体 2026"
4. WebSearch: "工信部 2026年 重点工作 集成电路 AI 通信"

### 第二步：产业链闭环拆解
对每个重点方向，拆成：上游(材料/设备)→中游(制造/封装)→下游(应用/集成)

例：HBM产业链
上游: 前驱体(雅克科技)/硅微粉/封装基板 →中游: HBM制造(SK海力士)/封装(通富微电) →下游: AI服务器/数据中心

### 第三步：找关键节点
- **卡脖子节点**：国内产业链最薄弱的环节，谁突破了谁就是下一个雅克科技
- **定价权节点**：产业链中谁说了算？谁的利润率最高？
- **稀缺性节点**：A股唯一/唯二的标的

### 第四步：映射到A股标的
每个关键节点找2-3只A股标的

## 重点覆盖的产业链（至少15条，必须全部覆盖）

### 十五五六大新兴支柱产业
1. **集成电路**: HBM/先进封装/前驱体/光刻胶/设备/材料/EDA/IP → 国产替代全链条
2. **低空经济**: eVTOL/无人机/飞控/碳纤维/适航认证/运营
3. **新型储能**: 固态电池/钠离子电池/液流电池/压缩空气储能
4. **智能机器人**: 减速器/伺服电机/传感器/控制器/具身智能
5. **航空航天**: 商业航天/火箭/卫星/spacex产业链
6. **生物医药**: 创新药/细胞基因治疗/AI制药/ CXO

### 十五五六大未来产业
7. **6G/卫星互联网**: 基站/天线/光芯片/卫星制造/地面终端
8. **量子科技**: 量子计算/量子通信/量子精密测量
9. **具身智能**: 人形机器人/灵巧手/机器视觉/运动控制
10. **氢能与核聚变**: 电解槽/储氢/燃料电池/超导材料
11. **脑机接口**: 电极/芯片/算法/临床应用
12. **生物制造**: 合成生物学/基因编辑/生物基材料

### 其他国家级重点方向
13. **光伏/新能源**: 硅料/硅片/电池片/组件/逆变器/钙钛矿 → 全球绝对龙头，关注技术迭代
14. **新能源车/锂电**: 锂矿/正极/负极/电解液/隔膜/动力电池/智能驾驶
15. **电力/电网**: 特高压/智能电网/虚拟电厂/充电桩 → 国网招标放量
16. **AI算力(国产)**: CPU/GPU/NPU/服务器/光模块/液冷 → 国产替代核心
17. **数据要素/信创**: 数据库/操作系统/ERP/数据交易
18. **军工/国防**: 发动机/高温合金/精确制导/信息化

## 输出
每条产业链：上游/中游/下游/卡脖子节点/定价权节点/关键标的`,
  { label: '十五五产业链分析', schema: POLICY_CHAIN_SCHEMA }
)

log(`🏛️ 产业链分析: ${policyChainResult?.focus_chains?.length || 0}条产业链, 合计${policyChainResult?.focus_chains?.reduce((sum, c) => sum + (c.candidate_stocks?.length || 0), 0) || 0}只关键标的`)

// Build top-down candidate pool
const topDownSymbols = new Set()
const topDownStocks = []
if (policyChainResult?.focus_chains) {
  for (const chain of policyChainResult.focus_chains) {
    for (const s of (chain.candidate_stocks || [])) {
      if (!topDownSymbols.has(s.symbol)) {
        topDownSymbols.add(s.symbol)
        topDownStocks.push({ ...s, chain: chain.chain_name, bottleneck: chain.bottleneck_node })
      }
    }
  }
}

// ============================================================
// Phase 1: 自下而上 — 全市场活跃标的初筛
// ============================================================
phase('全市场活跃标的初筛')

log('📊 阶段1: 获取全A股活跃标的（不限涨幅，捕获上升趋势中的震荡标的）...')

const screenResult = await agent(
  `你是一个A股量化筛选助手。请执行以下任务：

## 筛选理念
**不再限制涨跌幅。** 很多处于上升趋势的股票偶尔会震荡或小幅回调，但它们才是真正的潜力标的。我们要用"市场关注度"而非"今日涨幅"来筛选。

## 步骤
1. 使用 MCP 工具 \`get_realtime_data\` (source="eastmoney_direct") 获取全A股实时行情
2. 如果上面的方法不行，尝试用 \`get_realtime_data\` (source="eastmoney")
3. 如果MCP工具不可用，用 WebSearch 搜索 "今日A股 成交额排名 换手率 活跃个股"
4. 按以下条件筛选活跃标的：
   - **换手率 > 2%**（市场在关注）
   - **量比 > 1.0**（今天比昨天活跃）
   - **成交额 > 1亿**（排除无人问津的仙股）
5. 注意：**不限制涨跌幅**，跌的、平的、涨的都纳入（只要够活跃）
6. 对每只标的标注近期趋势：上升趋势/震荡整理/下跌趋势

## 筛选规则
- 仅保留A股（代码以 0/3/6 开头）
- 排除ST/*ST
- 如果有超过200只，按成交额从大到小保留前200只

## 输出
给出候选列表及今日市场特征`,
  { label: '全市场活跃标的初筛', phase: '全市场活跃标的初筛', schema: CANDIDATE_SCHEMA }
)

if (!screenResult || !screenResult.candidates || screenResult.candidates.length === 0) {
  log('⚠️ 今日市场极为冷清，无活跃标的。')
  return { status: 'no_candidates', message: '今日无符合条件的活跃标的' }
}

log(`✅ 初筛完成: ${screenResult.total_count}只活跃标的，市场特征: ${screenResult.market_note || '待确认'}`)

// ============================================================
// Phase 2.5: 双路径交叉 — 自上而下 ∩ 自下而上
// ============================================================
phase('双路径交叉')

const crossSymbols = new Set()
const crossStocks = []
let bottomUpSymbols = new Set((screenResult?.candidates || []).map(c => c.symbol))

for (const s of (screenResult?.candidates || [])) {
  if (topDownSymbols.has(s.symbol)) {
    if (!crossSymbols.has(s.symbol)) {
      crossSymbols.add(s.symbol)
      const td = topDownStocks.find(t => t.symbol === s.symbol)
      crossStocks.push({ ...s, chain: td?.chain || '', bottleneck: td?.bottleneck || '待分析', cross: true })
    }
  }
}

log(`🔗 双路径交叉: ${crossStocks.length}只标的既在十五五产业链关键节点上+又今日市场活跃`)

// Merge: 交叉标的优先，然后补自上而下标的，再补自下而上标的
const priorityStocks = [
  ...crossStocks,
  ...topDownStocks.filter(t => !crossSymbols.has(t.symbol)),
  ...(screenResult?.candidates || []).filter(c => !crossSymbols.has(c.symbol) && !topDownSymbols.has(c.symbol))
].slice(0, 50)

// ============================================================
// Phase 3: 资金面筛选+分类
// ============================================================
phase('资金面筛选+分类')

log(`💰 阶段2: 对${Math.min(screenResult.candidates.length, 50)}只活跃标的进行资金面分析...`)

const moneyFlowResult = await agent(
  `你是一个资金流向分析专家。请分析以下活跃标的的资金面情况。

## 候选列表（按成交额排序，不限涨跌幅）
${JSON.stringify(screenResult.candidates.slice(0, 50).map(c => ({
  symbol: c.symbol, name: c.name, change_pct: c.change_pct,
  turnover_rate: c.turnover_rate, amount: c.amount, trend: c.trend_note
})), null, 2)}

## 分析任务
1. 对每只候选股票，尝试获取资金流向数据：
   - 优先使用 \`get_money_flow\` (cn-financial MCP) 获取主力净流入
   - 如果不可用，用 \`get_hist_data\` (akshare-one) 分析近期量价关系
   - 也可 WebSearch 搜索 "今日 A股 主力资金 净流入 排名"
2. **重点关注**：
   - 主力净流入 > 0 的标的（无论今天是涨是跌）
   - 超大单+大单净流入占比高的（聪明钱在买）
   - 处于上升趋势但今日小幅回调 + 主力仍在流入的 = 💎 最佳候选
3. 警惕信号：
   - 主力净流出但股价上涨 = 拉高出货
   - 主力净流入但股价下跌 = 可能在压价吸筹（需结合趋势判断）

## 评分标准 (0-100)
- 90-100: 主力大额净流入+超大单主导+量价健康
- 70-89: 主力净流入+资金结构合理
- 50-69: 主力小幅流入或量价配合一般
- <50: 主力流出或量价背离

## 输出
给出资金面评分最高的Top 20-30只标的及资金面点评`,
  { label: '资金面筛选', phase: '资金面筛选', schema: MONEY_FLOW_SCHEMA }
)

if (!moneyFlowResult || !moneyFlowResult.filtered || moneyFlowResult.filtered.length === 0) {
  log('⚠️ 资金面筛选后无标的通过。')
  return { status: 'no_candidates_after_money_flow', initial_candidates: screenResult.total_count, message: '所有候选均未通过资金面筛选' }
}

log(`✅ 资金面筛选完成: ${moneyFlowResult.total_filtered}只通过`)

// ============================================================
// Phase 3: AI标的分类
// ============================================================
phase('AI标的分类')

log(`🏷️ 阶段3: 对${moneyFlowResult.total_filtered}只标的进行智能分类...`)

const classifyResult = await agent(
  `你是一个A股投资分析师。请对以下资金面优秀的标的进行智能分类。

## 候选列表
${JSON.stringify(moneyFlowResult.filtered, null, 2)}

## 分类标准（三分类）

### 🔥 情绪龙头
- 特征：高换手(>5%)、龙虎榜常客/连板基因、游资主导、题材驱动、技术面强势突破
- 操作：快进快出，严格止损，吃情绪溢价

### 🏔️ 基本面硬核
- 特征：ROE>15%、PE合理、经营现金流/净利润>1、机构重仓、业绩确定、行业龙头
- 操作：低吸持有，基本面为锚

### 🔀 混合型
- 特征：有一定基本面支撑 + 同时有资金异动或题材催化
- 操作：波段操作，基本面为锚+技术面择时

## 分析步骤
1. 对每只标的，用 MCP 获取：\`get_financial_metrics\`(ROE/PE)、\`get_news_data\`(题材催化)
2. WebSearch 搜索个股近期题材/概念热度
3. 分类，每类最多保留前5只

## 输出
给出三类标的及分类理由`,
  { label: 'AI标的分类', phase: 'AI标的分类', schema: CLASSIFY_SCHEMA }
)

const allClassified = [
  ...(classifyResult?.sentiment_leaders || []).map(c => ({ ...c, category: 'sentiment_leader' })),
  ...(classifyResult?.fundamental_hard || []).map(c => ({ ...c, category: 'fundamental_hard' })),
  ...(classifyResult?.hybrid || []).map(c => ({ ...c, category: 'hybrid' })),
]

log(`✅ 分类完成: 🔥情绪龙头${classifyResult?.sentiment_leaders?.length || 0}只, 🏔️基本面${classifyResult?.fundamental_hard?.length || 0}只, 🔀混合${classifyResult?.hybrid?.length || 0}只`)

// ============================================================
// Phase 4: 持有周期分析
// ============================================================
phase('持有周期分析')

log('⏱️ 阶段4: 分析持有周期...')

const holdingResult = await agent(
  `你是一个交易策略分析师。请对以下标的判断最适合的持有周期。

## 待分析标的
${JSON.stringify(allClassified, null, 2)}

## 持有周期定义

### ⚡ 超短线 (1-3天)
- 适用于：情绪龙头、事件驱动、技术突破、高弹性
- 必须有明确的技术止损位
- 目标收益：2-5%

### 📅 波段 (1-4周)
- 适用于：趋势明确、有催化剂时间表、基本面无重大问题
- 目标收益：5-15%

### 🏛️ 长期 (1月+)
- 适用于：ROE>15%、估值合理、护城河明确、成长确定
- 目标收益：15%+

## 分析步骤
1. 用 MCP \`get_hist_data\` (recent_n=20) 看短期走势
2. 判断当前处于趋势的什么阶段
3. 给出入场计划、止损策略、目标收益

## 输出
按三个持有周期分类输出`,
  { label: '持有周期分析', phase: '持有周期分析', schema: HOLDING_SCHEMA }
)

log(`✅ 持有周期: ⚡超短${holdingResult?.ultra_short?.length || 0}只, 📅波段${holdingResult?.swing?.length || 0}只, 🏛️长期${holdingResult?.long_term?.length || 0}只`)

// ============================================================
// Phase 5: Serenity级4维度魔鬼代言人辩论
// ============================================================
phase('4维魔鬼代言人辩论')

// 辩论候选：每类取前2，去重，最多6只
const seen = new Set()
const debateCandidates = []
for (const c of [
  ...(holdingResult?.ultra_short || []).slice(0, 2),
  ...(holdingResult?.swing || []).slice(0, 2),
  ...(holdingResult?.long_term || []).slice(0, 2),
]) {
  if (!seen.has(c.symbol)) { seen.add(c.symbol); debateCandidates.push(c) }
}

let debateSyntheses = []

if (debateCandidates.length === 0) {
  log('⚠️ 无可辩论标的，跳过辩论')
} else {
  log(`⚔️ 阶段5: 对${debateCandidates.length}只标的进行Serenity级4维度深度辩论...`)
  log('  每只标的 = 4个魔鬼代言人并发攻击 + 综合裁决')

  // 对每只标的，4维度并发辩论 + 综合裁决，用pipeline实现流式
  const debateResults = await pipeline(
    debateCandidates,
    // Stage 1: 4维度并发辩论
    async (candidate) => {
      const info = {
        symbol: candidate.symbol,
        name: candidate.name,
        category: candidate.category,
        plan: candidate.entry_plan || candidate.core_logic || '',
      }

      // 美股映射表（内联，供各维度参考）
      const US_ANCHOR_MAP_LOOKUP = {
        '海光信息': 'NVDA(🔗强) 国产GPU唯一对标',
        '中际旭创': 'NVDA(🔗强) 英伟达光模块核心供应商',
        '天孚通信': 'NVDA(🔗强) 英伟达光引擎供应商',
        '雅克科技': 'NVDA(🔗强) SK海力士HBM前驱体',
        '工业富联': 'NVDA(🔗强) AI服务器主力代工',
        '沪电股份': 'NVDA(🔗中) AI服务器PCB',
        '通富微电': 'AMD(🔗中) 先进封装',
        '北方华创': 'SOX(🔗中) 半导体设备龙头',
        '中微公司': 'SOX(🔗中) 刻蚀设备',
        '盛美上海': 'SOX(🔗中) 清洗设备',
        '拓荆科技': 'SOX(🔗中) 薄膜沉积',
        '昊华科技': 'SOX(🔗中) 电子特气',
        '兆易创新': 'MU(🔗中) 存储芯片',
        '澜起科技': 'MU(🔗中) 内存接口',
        '立讯精密': 'AAPL(🔗中) 消费电子',
        '歌尔股份': 'AAPL(🔗中) 声学/VR',
        '拓普集团': 'TSLA(🔗中) 汽配',
        '三花智控': 'TSLA(🔗中) 热管理',
        '金山办公': 'MSFT(🔗中) AI办公',
        // ── 有色金属/资源（全球统一定价） ──
        '紫金矿业': 'GDX(🔗中) 全球铜金龙头',
        '山东黄金': 'GDX(🔗中) 黄金',
        '洛阳钼业': 'FCX(🔗中) 铜钴矿',
        '中国铝业': 'AA(🔗中) 电解铝',
        '中矿资源': 'ALB(🔗中) 锂矿',
        '江西铜业': 'FCX(🔗中) 铜',
        // ── 商业航天/SpaceX链 ──
        '信维通信': 'SPCX(🔗中) 星链终端核心器件',
        '西部超导': 'SPCX(🔗中) 火箭特种材料',
        '蓝思科技': 'SPCX(🔗中) 航天结构件',
        '中国卫通': 'SPCX(🔗弱) 卫星运营/估值锚',
        '中国卫星': 'SPCX(🔗弱) 卫星制造/情绪联动',
        '新雷能':   'SPCX(🔗弱) 航天电源',
        '火炬电子': 'SPCX(🔗弱) 航天电子',
        '航天电子': 'SPCX(🔗弱) 测控通信',
      }
      const usAnchorInfo = US_ANCHOR_MAP_LOOKUP[info.name] || null

      const [tech, finance, valuation, catalyst, usAnchor] = await parallel([
        // 🔬 技术壁垒魔鬼代言人
        () => agent(
          `你是Serenity式的AI魔鬼代言人，专门从【技术壁垒与产业链卡脖子位置】维度攻击"${info.name}(${info.symbol})"。

## 信息收集（必须全部完成，每个搜索至少看3条结果）
1. WebSearch: "${info.name} ${info.symbol} 核心技术 专利 护城河 国产替代 供应链"
2. WebSearch: "${info.name} 行业地位 市场份额 竞争对手 排名"
3. WebSearch: "${info.name} ${info.symbol} 技术路线 颠覆风险 替代方案"
4. WebSearch: "${info.name} 客户集中度 前5大客户 供应商依赖"
5. 如果MCP get_news_data可用，调取近期技术/竞争相关新闻

## 攻击角度（至少覆盖5个，每个引用具体数据）

### ⛓️ 卡脖子位置
- 在产业链的哪个环节？上游(供应商)谁卡它？它卡下游(客户)谁？
- 这个位置的国产化率是多少？如果<30%说明有空间，如果>80%说明已内卷
- 有没有"离了它整个链条转不动"的节点？这个节点能维持多久？

### 🔬 技术壁垒可复制性
- 技术壁垒是什么类型的？(专利壁垒/工艺壁垒/认证壁垒/规模壁垒/生态壁垒)
- 专利数量？核心专利还有多少年到期？
- 一个新进入者需要多长时间+多少钱才能达到同等技术水平？
- 有没有开源替代方案在逼近？

### ⚡ 技术颠覆风险
- 是否存在下一代技术可能完全绕过当前技术路线？
- 国际巨头(默克/应用材料/NVIDIA等)有没有在研发替代方案？
- 中美科技脱钩对这个公司是利好还是利空？(国产替代=利好，但设备/材料断供=利空)

### 🏗️ 产能与扩张
- 当前产能利用率多少？扩产计划是否过于激进？
- 行业整体是否在产能过剩周期？如果全行业都在扩产，1-2年后会不会价格战？

### 👥 客户/供应商结构
- 前5大客户集中度多少？>50%说明深度绑定但风险也大
- 关键客户有没有在自研替代方案？(比如华为自研芯片替代高通)
- 供应商是否单一？如果断供有无替代方案？

### 💪 议价权
- 毛利率趋势是上升还是下降？下降=议价权在流失
- 能不能把成本上涨转嫁给下游？如果能=有定价权，不能=被动挨打
- 行业集中度(CR3/CR5)？寡头垄断才有议价权，碎片化行业没有

## 输出要求（每条攻击必须引用具体数据来源）
- fatal_attack: 🔥选取最致命的一条，引用具体数字(如"核心专利将在2028年到期，届时国产替代品价格只有它的1/3")
- bottleneck_position: ⛓️分析产业链位置，明确写出"上游被谁卡，下游卡了谁"
- key_insight: 💡说出一个多数人忽略的盲点——必须是查阅多份资料后才能发现的深层逻辑
- score标准: >85=护城河极深(全球前三+不可替代)，70-85=有壁垒但存在挑战，50-70=壁垒薄弱可被替代，<50=无壁垒`,
          { label: `🔬技术:${info.name}`, phase: '4维魔鬼代言人辩论', schema: DEBATE_DIMENSION_SCHEMA }
        ),
        // 📊 财务质量魔鬼代言人
        () => agent(
          `你是Serenity式的AI魔鬼代言人，专门从【财务质量与盈利真实性】维度攻击"${info.name}(${info.symbol})"。

## 信息收集（必须全部完成）
1. MCP get_financial_metrics 获取最近4-6期财务指标
2. MCP get_income_statement / get_balance_sheet / get_cash_flow 获取三张表
3. MCP get_inner_trade_data 获取高管增减持记录
4. WebSearch: "${info.name} ${info.symbol} 财报分析 财务风险 应收账款 商誉"
5. WebSearch: "${info.name} 大股东质押 减持 定增 融资"

## 攻击角度（至少覆盖6个，每个引用具体财务数字）

### 💸 利润含金量（核心）
- 经营现金流/净利润比值连续几期<1？如果<0.5说明利润全是纸面数字
- 应收账款增速 vs 营收增速：应收增速远超营收增速=利润在客户手里，没到自己兜里
- 应收账龄结构：1年以上应收占比多少？坏账计提是否充足？

### 📈 增长质量
- 收入增长是靠内生(量价齐升)还是靠并购(一次性并表)？
- 如果靠并购，商誉有多少？商誉/净资产>30%说明收购溢价过高，减值风险大
- 毛利率趋势：连续3季下降？如果是，说明要么成本涨了要么价格战了

### 🚩 粉饰信号（做空报告最爱挖的点）
- 存货异常增长但营收没跟上？可能产品滞销在仓库
- 研发资本化率突然提高？可以把费用变成资产，虚增利润
- 关联交易占比多少？关联方应收账款是否异常？
- 审计意见是否为"标准无保留"？如果是"带强调事项段"就要警惕

### 💣 偿债压力
- 短期借款+一年内到期负债 / 货币资金 > 1？说明短债还不起
- 利息保障倍数(EBIT/利息费用) < 3？可能在借新还旧
- 有没有表外负债？(对外担保/明股实债/对赌协议)

### 👔 股东行为（比财报更真实）
- 大股东质押比例>50%？爆仓风险
- 高管在增持还是减持？减持有没有发公告？
- 最近有没有定增/配股？定增价格和现价差距多大？

### 🏭 行业对比
- ROE/毛利率和同行比处于什么位置？低于行业均值说明竞争力不够
- 经营现金流/营收和同行比？远低于同行=收款能力差

## 输出要求
- fatal_attack: 🔥选最致命的一条，用具体数字(如"经营现金流净额-2.1亿 vs 净利润2亿，利润含金量=0。应收/利润=811%，钱都在客户手里")
- key_insight: 💡指出一处多数人看财报会忽略的异常
- score标准: >85=财务极其健康(现金流充沛+零负债+高ROE)，70-85=健康有小问题，50-70=存在值得注意的风险，<50=重大财务隐患`,
          { label: `📊财务:${info.name}`, phase: '4维魔鬼代言人辩论', schema: DEBATE_DIMENSION_SCHEMA }
        ),
        // 💰 估值魔鬼代言人
        () => agent(
          `你是Serenity式的AI魔鬼代言人，专门从【估值与安全边际】维度攻击"${info.name}(${info.symbol})"。

## 你的任务
1. 用 MCP get_hist_data 获取最近60个交易日走势(recent_n=60, adjust=qfq)
2. 用 MCP get_financial_metrics 获取最新财务数据，计算PE/PB/PS/ROE
3. 用 WebSearch 搜索："${info.name} 估值 PE PB 行业平均 同业对比"
4. 判断当前股价透支了多少未来预期

## 攻击角度
- **估值水位**：当前PE/PB在历史分位数的什么位置？相较同业均值溢价多少？
- **成长性匹配**：PEG是否>2？当前估值隐含的未来增速是否过于乐观？
- **安全边际**：内在价值与市价差距多大？
- **筹码结构**：近期涨幅是否已Price In了所有利好？
- **对标风险**：同类公司有没有估值低得多的替代标的？

## 输出要求
- fatal_attack: 量化估值风险（如"PE 85x，处于历史98%分位，行业均值3.2倍"）
- key_insight: 指出现价隐含了什么假设，这个假设是否合理
- score标准: >80=显著低估，60-80=合理偏低，40-60=合理偏高，<40=严重高估`,
          { label: `💰估值:${info.name}`, phase: '4维魔鬼代言人辩论', schema: DEBATE_DIMENSION_SCHEMA }
        ),
        // ⚡ 催化剂时机魔鬼代言人
        () => agent(
          `你是Serenity式的AI魔鬼代言人，专门从【催化剂时机与市场共识】维度攻击"${info.name}(${info.symbol})"。

## 信息收集（必须全部完成）
1. MCP get_news_data 获取最近20条新闻
2. MCP get_hist_data 获取最近20-60个交易日走势(recent_n=60)
3. WebSearch: "${info.name} 利好 催化剂 订单 政策 2026"
4. WebSearch: "${info.name} 风险 利空 解禁 减持 业绩预告"
5. WebSearch: "${info.name} 市场情绪 散户 讨论热度 媒体关注"

## 攻击角度（至少覆盖6个）

### 🎯 Price In程度
- 当前股价涨了多少？从起涨点算，已经透支了多少预期？
- 列举市场上已知的3-5个利好——这些利好有多少已经被Price In了？市场是否已经定价了"最乐观情景"？
- 如果催化剂兑现但幅度不及预期，股价会怎样？(利好出尽是利空)

### 📅 催化剂确定性
- 预期的催化剂是什么？(政策/订单/业绩/产品发布/技术突破)
- 落地概率多大？时间表清晰吗？有没有被推迟的风险？
- 历史上类似的催化剂对股价实际影响多大？第一次刺激通常最大，后面的边际递减
- 如果催化剂迟迟不来，时间成本是多少？(资金被锁+机会成本)

### 📉 技术面过热
- RSI是否>80？MACD是否出现顶背离？布林带是否突破上轨？
- 近5日涨幅是否过大(>20%)？短期获利盘是否积累太多？
- 如果从技术面看，当前处于"追高"位置还是"回调到位"位置？

### 🧠 市场情绪与反向指标
- 舆论/散户/媒体的情绪处于什么状态？一边倒看多=危险信号
- 龙虎榜最近是散户在买还是机构在买？散户接盘是顶部特征
- 券商研报的评级变化？如果"几乎所有券商都推荐买入"——往往是反指
- 有没有知名大V/公众号在推这个票？被大V推过的票短期容易见顶

### ⚠️ 潜在利空（埋伏的雷）
- 近期有没有限售股解禁？量多大？
- 有没有业绩预告窗口？如果业绩不及预期会跌多少？
- 有没有监管/政策风险？(比如被列入实体清单/行业整顿/价格管控)
- 大股东/高管有没有减持计划？

### ⏰ 有没有更好的时机
- 如果等1-2周再买，会错过什么？会避开什么？
- 当前大盘环境是否适合买入？如果大盘在调整中，个股很难独善其身
- 有没有"等回踩5日线/20日线再买"的可能？追高的代价 vs 等回调的收益

## 输出要求
- fatal_attack: 🔥精确指出"现在不是买点"或者"如果不买会错过什么"，必须引用具体时间节点和数据
- key_insight: 💡指出市场共识中最可能出错的地方——"所有人都认为X，但实际可能Y"
- contrarian_consensus: 🔄明确写出：当前市场共识是______，但历史规律/数据表明______，所以这个共识可能错在______
- score标准: >85=绝佳买点(催化剂即将兑现+技术面回调到位+情绪中性)，70-85=可分批建仓，50-70=等待更好时机，<50=现在绝对不能买`,
          { label: `⚡时机:${info.name}`, phase: '4维魔鬼代言人辩论', schema: DEBATE_DIMENSION_SCHEMA }
        ),
        // 📡 美股映射锚定分析
        () => agent(
          `你是Serenity式的AI魔鬼代言人，专门从【📡 美股映射与全球定价锚】维度分析"${info.name}(${info.symbol})"。

## 美股映射信息
${usAnchorInfo ? `${info.name} 在美股映射表中的映射关系: ${usAnchorInfo}` : `${info.name} 无美股映射（内需/政策驱动为主），本维度自动赋分 0 分。`}

## 分析任务
${usAnchorInfo ? `
1. WebSearch: "NVDA 股价 最新 今日 2026年6月" 获取英伟达最新走势
2. WebSearch: "费城半导体指数 SOX 最新 走势"
3. WebSearch: "${info.name} 海外营收占比 出口 境外业务"

## 映射强度判定
- 如果这只标的的业绩直接依赖美股龙头（供应商/代工），映射为🔗强
- 如果只是行业趋势相关，映射为🔗中
- 如果以内需/政策驱动为主，映射为⚪弱

## 评分标准（基于 美股趋势 × 映射级别 矩阵）

| 映射级别 | 美股🟢上升 | 美股🟡震荡 | 美股🔴下降 |
|---------|:---------:|:---------:|:---------:|
| 🔗强映射 | +10 | 0 | -5 |
| 🔗中映射 | +5 | 0 | -3 |
| ⚪弱映射 | 0 | 0 | 0 |

## 判断美股趋势
- 🟢 上升: MA20>MA60，股价在MA20上方，近5日无破位
- 🟡 震荡: MA20和MA60纠缠或方向不明
- 🔴 下降: 股价在MA60下方，MA20<MA60或形成下降通道

## 输出要求
- fatal_attack: 🔥美股映射的最大风险（美股回调对A股标的的传导冲击）
- key_insight: 💡美股对这只标的的"隐性定价"——有多少涨幅是美股带的？多少是自己的？
- score标准: 基于映射矩阵的修正分，如果无映射=0，强映射+美股上升=10，强映射+美股下降=-5` :
`
本维度的判断规则：无需进一步分析，直接输出 score=0，verdict="pass"，fatal_attack="无美股映射，内需驱动"，key_insight="内需独立逻辑，不受美股影响"。

直接按规则输出即可。`},
          { label: `📡美股:${info.name}`, phase: '4维魔鬼代言人辩论', schema: DEBATE_DIMENSION_SCHEMA }
        ),
      ])

      return { candidate: info, dimensions: { tech, finance, valuation, catalyst, usAnchor } }
    },
    // Stage 2: 综合裁决
    async (debateData) => {
      if (!debateData) return null
      const { candidate, dimensions } = debateData
      const { tech, finance, valuation, catalyst, usAnchor } = dimensions

      const synthesis = await agent(
        `你是Serenity本尊。五位魔鬼代言人已完成对 ${candidate.name}(${candidate.symbol}) 的四+一维交叉辩论（传统4维 + 📡美股映射锚定分）。请给出最终裁决，注意美股映射分作为修正系数影响总分。

## 辩论结果

## 辩论结果

### 🔬 技术壁垒与卡脖子位置
评分: ${tech?.score || 'N/A'}
致命攻击: ${tech?.fatal_attack || 'N/A'}
多方反驳: ${tech?.bullish_rebuttal || 'N/A'}
攻击成立: ${tech?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
卡脖子位置: ${tech?.bottleneck_position || '未分析'}
洞察: ${tech?.key_insight || 'N/A'}
判决: ${tech?.verdict || 'N/A'}

### 📊 财务质量
评分: ${finance?.score || 'N/A'}
致命攻击: ${finance?.fatal_attack || 'N/A'}
多方反驳: ${finance?.bullish_rebuttal || 'N/A'}
攻击成立: ${finance?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
洞察: ${finance?.key_insight || 'N/A'}
判决: ${finance?.verdict || 'N/A'}

### 💰 估值安全边际
评分: ${valuation?.score || 'N/A'}
致命攻击: ${valuation?.fatal_attack || 'N/A'}
多方反驳: ${valuation?.bullish_rebuttal || 'N/A'}
攻击成立: ${valuation?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
洞察: ${valuation?.key_insight || 'N/A'}
判决: ${valuation?.verdict || 'N/A'}

### ⚡ 催化剂与市场共识
评分: ${catalyst?.score || 'N/A'}
致命攻击: ${catalyst?.fatal_attack || 'N/A'}
多方反驳: ${catalyst?.bullish_rebuttal || 'N/A'}
攻击成立: ${catalyst?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
反向指标: ${catalyst?.contrarian_consensus || '未分析'}
洞察: ${catalyst?.key_insight || 'N/A'}
判决: ${catalyst?.verdict || 'N/A'}

### 📡 美股映射锚定分（修正系数）
评分: ${usAnchor?.score || '0'}
致命攻击: ${usAnchor?.fatal_attack || 'N/A'}
多方反驳: ${usAnchor?.bullish_rebuttal || 'N/A'}
攻击成立: ${usAnchor?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
洞察: ${usAnchor?.key_insight || 'N/A'}
判决: ${usAnchor?.verdict || 'N/A'}

## 裁决标准
- ✅ 通过 — 可建仓：传统4维≥3个pass，无一fail，加权分≥70，且美股映射分不是严重负分
- ⚠️ 有条件通过：≥2个pass，无致命fail，但时机/估值/美股映射有瑕疵
- ❌ 不通过：≥2个fail 或 存在无法反驳的致命攻击 或 美股映射分=-5且无国内对冲逻辑

## 美股映射分修正规则（重要）
- +10分：强映射+美股上升趋势 → 加分，但注意估值溢价风险
- +5分：中映射+美股上升 → 小幅加分
- -5分：强映射+美股下降 → significant risk, 除非有国产替代对冲否则建议不通过
- -3分：中映射+美股下降 → 注意风险
- 0分：无映射或震荡 → 不影响

## 确信度→仓位映射
- 高确信 → 正常仓位(6-8成)
- 中确信 → 半仓(3-5成)
- 低确信 → 观察仓(1-2成)
- 美股映射分=-5 且无国内对冲逻辑 → 不建仓

## 输出
给出综合评分、确信度、仓位建议、一句做多逻辑、一句做空逻辑、具体操作建议、最需警惕的风险。注意：综合评分应该在传统4维基础上，考虑美股映射分的修正。`,
        {
          label: `裁决:${candidate.name}`,
          phase: '4维魔鬼代言人辩论',
          schema: SYNTHESIS_SCHEMA,
        }
      )

      return {
        symbol: candidate.symbol,
        name: candidate.name,
        category: candidate.category,
        dimensions,
        synthesis,
      }
    }
  )

  debateSyntheses = debateResults.filter(Boolean)

  const passed = debateSyntheses.filter(d => d.synthesis?.verdict?.includes('通过') && !d.synthesis?.verdict?.includes('有条件'))
  const conditional = debateSyntheses.filter(d => d.synthesis?.verdict?.includes('有条件'))
  const failed = debateSyntheses.filter(d => d.synthesis?.verdict?.includes('不通过'))

  log(`✅ 辩论完成: ✅通过${passed.length}只, ⚠️有条件${conditional.length}只, ❌不通过${failed.length}只`)
}

// ============================================================
// Phase 6: 综合报告
// ============================================================
phase('综合裁决与报告')

log('📝 阶段6: 生成综合报告...')

const reportPrompt = `你是Serenity本尊。基于以下A股筛选+辩论流水线结果，生成一份专业投资报告。

## 筛选摘要
- 活跃标的: ${screenResult?.total_count || 0}只
- 资金面通过: ${moneyFlowResult?.total_filtered || 0}只
- 分类: 🔥情绪${classifyResult?.sentiment_leaders?.length || 0}只 / 🏔️基本面${classifyResult?.fundamental_hard?.length || 0}只 / 🔀混合${classifyResult?.hybrid?.length || 0}只
- 持有周期: ⚡超短${holdingResult?.ultra_short?.length || 0}只 / 📅波段${holdingResult?.swing?.length || 0}只 / 🏛️长期${holdingResult?.long_term?.length || 0}只

## 辩论结果（Serenity级深度辩论）
${JSON.stringify(debateSyntheses.map(d => ({
  symbol: d.symbol, name: d.name,
  dimensions: {
    tech: d.dimensions?.tech ? { score: d.dimensions.tech.score, attack_wins: d.dimensions.tech.attack_wins, key_insight: d.dimensions.tech.key_insight } : null,
    finance: d.dimensions?.finance ? { score: d.dimensions.finance.score, attack_wins: d.dimensions.finance.attack_wins, key_insight: d.dimensions.finance.key_insight } : null,
    valuation: d.dimensions?.valuation ? { score: d.dimensions.valuation.score, attack_wins: d.dimensions.valuation.attack_wins, key_insight: d.dimensions.valuation.key_insight } : null,
    catalyst: d.dimensions?.catalyst ? { score: d.dimensions.catalyst.score, attack_wins: d.dimensions.catalyst.attack_wins, key_insight: d.dimensions.catalyst.key_insight } : null,
  },
  synthesis: d.synthesis,
})), null, 2)}

## 报告要求（Markdown格式）

1. **📊 今日市场特征** (2-3句)
2. **🏆 综合排名** (按辩论评分从高到低排列所有标的)
3. **🔥 短线机会** — 每只：代码名称、入场/止损/目标、辩论致命攻击摘要
4. **📅 波段机会** — 每只：催化剂时间窗、入场逻辑、确信度
5. **🏛️ 长期价值** — 每只：核心理由、估值判断、仓位建议
6. **💡 今日最佳洞察** — 从辩论中摘出2-3条最深刻的key_insight
7. **⚠️ 风险警示** — 整体市场风险 + 个股特定风险
8. **🎯 最终推荐** — 如果今天只能买1-2只，选谁？为什么？`

const finalReport = await agent(reportPrompt, {
  label: '综合报告',
  phase: '综合裁决与报告',
})

// ============================================================
// Return
// ============================================================
return {
  status: 'complete',
  summary: {
    active_candidates: screenResult?.total_count || 0,
    money_flow_passed: moneyFlowResult?.total_filtered || 0,
    classified: {
      sentiment_leaders: classifyResult?.sentiment_leaders?.length || 0,
      fundamental_hard: classifyResult?.fundamental_hard?.length || 0,
      hybrid: classifyResult?.hybrid?.length || 0,
    },
    debated: debateSyntheses.length,
    passed: debateSyntheses.filter(d => d.synthesis?.verdict?.includes('通过') && !d.synthesis?.verdict?.includes('有条件')).length,
    conditional: debateSyntheses.filter(d => d.synthesis?.verdict?.includes('有条件')).length,
    failed: debateSyntheses.filter(d => d.synthesis?.verdict?.includes('不通过')).length,
  },
  phases: {
    screening: screenResult,
    money_flow: moneyFlowResult,
    classification: classifyResult,
    holding: holdingResult,
    debates: debateSyntheses,
  },
  report: finalReport,
}
