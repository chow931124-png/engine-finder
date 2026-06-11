export const meta = {
  name: 'stock-screener-trend',
  description: '📈引擎3·主升趋势中继流 — 🚦流量灯→均线多头→量价配合(RSI<85/非炸板/非假机构)→估值空间→情绪溢价→唯一性评估。垃圾趋势股自动降权。',
  phases: [
    { title: '趋势标的初筛', detail: '均线多头+量价配合+市值适中，筛选上升趋势标的' },
    { title: '主升阶段判定', detail: '区分主升初期(刚启动) vs 主升中继(已在涨但未透支)' },
    { title: '估值空间评估', detail: 'PE/PEG+机构目标价+行业对比，判断剩余上涨空间' },
    { title: '情绪溢价比率', detail: '当前情绪溢价是否合理？是否已形成拥挤交易？' },
    { title: '预期差挖掘', detail: '市场预期 vs 实际可能超预期的方向' },
    { title: '趋势组合报告', detail: '主升初期+主升中继双栏输出，含评分+目标+止损' },
  ],
}

// ============================================================
// Schemas
// ============================================================

const TREND_SCREEN_SCHEMA = {
  type: 'object',
  properties: {
    early_stage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          sector: { type: 'string' }, market_cap: { type: 'number' },
          trend_strength: { type: 'integer', description: '趋势强度 0-100' },
          stage: { type: 'string', description: '主升初期/主升中继/主升末期' },
          key_catalyst: { type: 'string', description: '核心驱动逻辑' },
        },
        required: ['symbol', 'name', 'stage', 'key_catalyst'],
      },
      description: '主升初期：趋势刚确认，量价温和，多数人还没注意到',
    },
    mid_stage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          sector: { type: 'string' }, market_cap: { type: 'number' },
          trend_strength: { type: 'integer' },
          stage: { type: 'string' },
          current_gain: { type: 'string', description: '从起涨点至今涨幅' },
          remaining_upside: { type: 'string', description: '预计剩余空间' },
          key_catalyst: { type: 'string' },
        },
        required: ['symbol', 'name', 'remaining_upside', 'key_catalyst'],
      },
      description: '主升中继：已在涨但估值未透支+趋势完好+还有空间',
    },
    eliminated: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          reason: { type: 'string', description: '排除原因' },
        },
      },
      description: '已过度透支/主升末期，不纳入',
    },
  },
  required: ['early_stage', 'mid_stage'],
}

const VALUATION_SCHEMA = {
  type: 'object',
  properties: {
    stocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          current_pe: { type: 'number' }, industry_pe: { type: 'number' },
          peg: { type: 'number', description: 'PEG(越小越好)' },
          target_price: { type: 'number', description: '机构目标均价' },
          upside_pct: { type: 'number', description: '距目标价上涨空间%' },
          valuation_score: { type: 'integer', description: '估值空间评分 0-100' },
        },
        required: ['symbol', 'name', 'valuation_score', 'upside_pct'],
      },
    },
  },
  required: ['stocks'],
}

// ============================================================
// Phase 1: 趋势标的初筛
// ============================================================
phase('趋势标的初筛')

log('📈 阶段1: 筛选均线多头+量价配合+市值适中的上升趋势标的...')

const trendResult = await agent(
  `你是一个技术分析+趋势交易专家。请从A股中筛选处于上升趋势的标的。

## 筛选标准
1. WebSearch: "A股 均线多头排列 放量突破 上升趋势 2026年6月"
2. WebSearch: "A股 主升浪 量价配合 平台突破 强势股"
3. 如果MCP可用，用 get_hist_data 验证趋势

## 纳入标准（全部满足）
- 均线多头排列（MA5>MA10>MA20>MA50）
- 近5日量能温和放大（非异常巨量）
- 市值50-500亿（弹性空间大，排除大盘股和微盘股）
- RSI 50-85（非极度超买，但也不能太弱）
- MACD零轴上方或刚金叉

## 主升阶段判断
- 🔵 主升初期：均线刚多头排列（<2周），RSI 50-70，离起涨点<30%，大部分人还没注意
- 🟢 主升中继：已在涨20-60%，趋势完好，估值没透支，还有空间
- 🔴 主升末期：涨幅>100%或PE>行业3倍或RSI>90→排除

## 输出
初筛结果，分主升初期/主升中继/已排除三栏`,
  { label: '趋势标的初筛', schema: TREND_SCREEN_SCHEMA }
)

const allTrend = [
  ...(trendResult?.early_stage || []).map(c => ({ ...c, category: 'early' })),
  ...(trendResult?.mid_stage || []).map(c => ({ ...c, category: 'mid' })),
]

log(`📈 趋势筛选: 🔵主升初期${trendResult?.early_stage?.length || 0}只, 🟢主升中继${trendResult?.mid_stage?.length || 0}只, 🔴排除${trendResult?.eliminated?.length || 0}只`)

// ============================================================
// Phase 2: 主升阶段深度判定
// ============================================================
phase('主升阶段判定')

const stageResult = await agent(
  `对以下趋势标的进行主升阶段的深度判定。

## 候选标的
${JSON.stringify(allTrend.slice(0, 15).map(c => ({
  symbol: c.symbol, name: c.name, sector: c.sector, initial_stage: c.stage, catalyst: c.key_catalyst
})), null, 2)}

## 判定维度
1. MCP get_hist_data (recent_n=60, adjust=qfq) 查看走势形态
2. 判断：
   - 起涨点在哪？从起涨点涨了多少？
   - 过程中有没有充分调整？（横盘整理/回踩均线）
   - 当前是第几浪？（1浪启动/3浪主升/5浪冲顶）
3. WebSearch: "[股票名] 机构目标价 研报 2026"

## 主升初期 vs 中继 vs 末期
- 初期: 刚从底部起来<30%，均线从粘合→发散，量能从地量→温和放大
- 中继: 涨了30-60%但经过充分调整，再次放量突破，MACD二次金叉
- 末期: 涨>100%或高位放量滞涨→排除

请输出最终判定`,
  { label: '主升阶段判定' }
)

// ============================================================
// Phase 3: 估值空间评估
// ============================================================
phase('估值空间评估')

const valResult = await agent(
  `评估以下标的的估值和剩余上涨空间，同时考虑美股映射修正。

## 标的
${JSON.stringify(allTrend.slice(0, 12).map(c => ({ symbol: c.symbol, name: c.name, category: c.category })), null, 2)}

## 评估步骤
1. WebSearch: "[股票名] PE PB PEG 2026 行业对比"
2. WebSearch: "[股票名] 机构目标价 券商评级"
3. 计算: 距机构目标价的上涨空间%

## 评分标准
- PEG<0.5 = 极度低估 +30分
- PEG 0.5-1.0 = 合理偏低 +20分
- PEG 1.0-1.5 = 合理 +10分
- PEG>2 = 偏贵 -10分
- 距目标价>30% = +20分
- 距目标价<10% = -10分

## 📡 美股映射修正（重要！适用于以下标的）
如果标的属于以下美股映射范畴，需要在趋势强度上增加修正系数：

| A股标的 | 美股锚定 | 映射强度 |
|---------|---------|:--------:|
| 盛美上海/北方华创/中微公司/拓荆科技 | SOX(费城半导体) | 🔗中 |
| 昊华科技 | SOX(费城半导体) | 🔗中 |
| 中际旭创/天孚通信/工业富联/沪电股份 | NVDA | 🔗强/中 |
| 拓普集团/三花智控 | TSLA | 🔗中 |
| 立讯精密/歌尔股份 | AAPL | 🔗中 |
| 紫金矿业/洛阳钼业/江西铜业 | FCX/GDX(铜/金) | 🔗中 |
| 山东黄金 | GDX(金矿指数) | 🔗中 |
| 中国铝业 | AA(美国铝业) | 🔗中 |
| 中矿资源 | ALB(雅保) | 🔗中 |
| 信维通信/西部超导/蓝思科技 | SPCX(SpaceX) | 🔗中 |
| 中国卫通/中国卫星/新雷能/火炬电子/航天电子 | SPCX(SpaceX) | 🔗弱 |

### 修正规则
WebSearch "NVDA SOX TSLA AAPL SPCX GDX FCX AA 股价 均线 趋势 2026年6月" 获取美股趋势后执行：

| 映射强度 | 美股🟢上升 | 美股🟡震荡 | 美股🔴下降 |
|---------|:---------:|:---------:|:---------:|
| 🔗强映射 | 趋势强度×1.15 | 不变 | 趋势强度×0.85 |
| 🔗中映射 | 趋势强度×1.08 | 不变 | 趋势强度×0.92 |
| ⚪弱映射 | 不变 | 不变 | 不变 |

在valuation_score和upside_pct中体现这个修正。

输出估值评分和上涨空间`,
  { label: '估值空间评估', schema: VALUATION_SCHEMA }
)

// ============================================================
// Phase 4: 情绪溢价比率
// ============================================================
phase('情绪溢价比率')

const sentimentResult = await agent(
  `评估以下标的的情绪溢价——当前市场对它的热情是否合理？

## 标的
${JSON.stringify((valResult?.stocks || []).slice(0, 10).map(s => ({
  symbol: s.symbol, name: s.name, valuation_score: s.valuation_score, upside: s.upside_pct
})), null, 2)}

## 评估维度
1. WebSearch: "[股票名] 人气 关注度 散户"
2. 判断：
   - 是不是近期热点？→ 热点溢价但持续性存疑
   - 龙虎榜频繁出现？→ 游资在炒 → 情绪溢价高
   - 媒体/大V开始推了？→ 一致性预期形成 → 情绪溢价见顶信号
   - 还是在默默涨没人提？→ 情绪溢价低 → 最佳介入时机

## 情绪溢价比率
- 没人讨论默默涨 = 🟢 溢价低，理想介入
- 开始有人关注 = 🟡 溢价合理
- 到处都在推 = 🔴 溢价过高，警惕接盘

输出每只标的的情绪溢价评级`,
  { label: '情绪溢价比率' }
)

// ============================================================
// Phase 5: 预期差挖掘
// ============================================================
phase('预期差挖掘')

const expectationResult = await agent(
  `挖掘以下标的的预期差——市场预期 vs 可能超预期的方向。

## 标的
${JSON.stringify(allTrend.slice(0, 10).map(c => ({ symbol: c.symbol, name: c.name, catalyst: c.key_catalyst })), null, 2)}

## 分析方向
1. 市场目前的共识是什么？（基于研报/新闻/讨论热度）
2. 这个共识有没有可能太保守了？
3. 有没有市场还没注意到的增量逻辑？
   - 新产品/新客户/新产能即将落地？
   - 行业数据即将公布且可能超预期？
   - 政策催化还没被Price In？

## 输出
每只标的：市场共识 + 可能超预期的方向 + 预期差大小(大/中/小)`,
  { label: '预期差挖掘' }
)

// ============================================================
// Phase 6: 趋势组合报告
// ============================================================
phase('趋势组合报告')

const trendReport = await agent(
  `你是趋势交易专家。基于完整的"主升趋势中继流"分析，生成投资报告。

## 全部数据

### 趋势筛选
初筛: ${JSON.stringify(trendResult, null, 2)}

### 主升阶段判定
${stageResult || ''}

### 估值空间
${JSON.stringify(valResult, null, 2)}

### 情绪溢价
${sentimentResult || ''}

### 预期差
${expectationResult || ''}

## 报告要求(Markdown)

分成两个板块：

### 🔵 主升初期（刚启动，多数人还没注意）
| 标的 | 趋势强度 | 估值空间 | 情绪溢价 | 预期差 | 综合分 | 建议 |
每只标的：趋势确认点、理想入场位、止损位、预期收益

### 🟢 主升中继（已在涨，还有空间）
| 标的 | 已涨 | 剩余空间 | 估值 | 情绪 | 综合分 | 建议 |
每只：当前处于第几浪、要不要等回调、目标价、止损

### 🔴 已排除
哪些被排除？为什么？

### 📡 美股映射警示
如果候选标的中包含美股映射标的（盛美上海/北方华创/中际旭创/天孚通信/拓普集团等），需补充说明：
- 对应美股龙头（NVDA/SOX/TSLA）当前趋势状态
- 如果美股处于🔴下降趋势，映射标的趋势强度应打85-92折
- 如果美股处于🟢上升趋势，映射标的有额外加分

### ⚠️ 趋势交易纪律
- 趋势坏了(破20日线)→无条件走
- 放量滞涨→减仓
- 不要追高(远离5日线>8%不追)
- 美股映射标的需同时监控美股趋势——美股破位=A股映射标的趋势修正

## 综合排名
给出每只标的的综合评分(趋势+估值+情绪+预期)和操作优先级`,
  { label: '趋势组合报告' }
)

return {
  status: 'complete',
  logic: 'trend_continuation',
  summary: {
    early_stage: trendResult?.early_stage?.length || 0,
    mid_stage: trendResult?.mid_stage?.length || 0,
    eliminated: trendResult?.eliminated?.length || 0,
  },
  phases: {
    trend_screen: trendResult,
    stage_analysis: stageResult,
    valuation: valResult,
    sentiment: sentimentResult,
    expectation: expectationResult,
  },
  report: trendReport,
}
