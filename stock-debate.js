export const meta = {
  name: 'stock-debate',
  description: 'Serenity式AI选股辩论 — 4维度魔鬼代言人交叉拷问，只有通过全部辩论的标的才值得建仓',
  phases: [
    { title: '技术壁垒辩论', detail: '产业链卡脖子位置、技术颠覆风险、替代威胁' },
    { title: '财务基本面辩论', detail: '利润质量、现金流健康度、造假粉饰迹象' },
    { title: '估值安全边际辩论', detail: '估值透支程度、安全边际、同业对比' },
    { title: '催化剂时机辩论', detail: 'Price In程度、催化剂确定性、入场时机' },
    { title: '综合裁决', detail: '汇总4维辩论结果，给出最终建仓建议' },
  ],
}

const SYMBOL = typeof args === 'string' ? args : '600522'
const STOCK_NAME = typeof args === 'string' ? args : '中天科技'

const DEBATE_SCHEMA = {
  type: 'object',
  properties: {
    score: {
      type: 'integer',
      description: '该维度综合评分 0-100（0=完全无法通过，100=完美通过）',
      minimum: 0,
      maximum: 100,
    },
    fatal_attack: {
      type: 'string',
      description: '🔥 最致命的攻击论点——站在空头角度，如果只用一个理由否定这只股票，是什么？必须具体，不能泛泛而谈。',
    },
    bullish_rebuttal: {
      type: 'string',
      description: '🛡️ 多方对致命攻击的 rebuttal——Serenity会如何反驳？这个反驳是否足够有力？',
    },
    attack_wins: {
      type: 'boolean',
      description: '攻击是否成立？（true=空头胜出，这个维度有硬伤；false=多方反驳有效，通过考验）',
    },
    secondary_concerns: {
      type: 'array',
      items: { type: 'string' },
      description: '其他次要注意/风险点，2-3条',
    },
    key_insight: {
      type: 'string',
      description: '该维度最深刻的洞察——一条你没考虑到的关键信息',
    },
    verdict: {
      type: 'string',
      enum: ['pass', 'conditional_pass', 'fail'],
      description: '判决：pass=通过，conditional_pass=有条件通过，fail=不通过',
    },
  },
  required: ['score', 'fatal_attack', 'bullish_rebuttal', 'attack_wins', 'verdict', 'key_insight'],
  additionalProperties: false,
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'integer', description: '综合加权评分 0-100', minimum: 0, maximum: 100 },
    verdict: {
      type: 'string',
      enum: ['✅ 通过 — 可建仓', '⚠️ 有条件通过 — 等待更好时机', '❌ 不通过 — 逻辑有硬伤'],
      description: '最终裁决',
    },
    conviction: { type: 'string', enum: ['高', '中', '低'], description: '确信度' },
    bull_case_one_liner: { type: 'string', description: '做多核心逻辑，一句话' },
    bear_case_one_liner: { type: 'string', description: '做空/不买核心逻辑，一句话' },
    suggested_action: { type: 'string', description: '具体操作建议（仓位、时机、止损）' },
    debate_winner: { type: 'string', enum: ['多头', '空头', '平局'], description: '辩论胜方' },
    report: { type: 'string', description: '完整辩论报告，Markdown格式，500字以内' },
  },
  required: ['overall_score', 'verdict', 'conviction', 'bull_case_one_liner', 'bear_case_one_liner', 'suggested_action', 'debate_winner', 'report'],
  additionalProperties: false,
}

// ============================================================
// Phase: 4维度并发辩论
// ============================================================
phase('技术壁垒辩论')
phase('财务基本面辩论')
phase('估值安全边际辩论')
phase('催化剂时机辩论')

const techPrompt =
`你是Serenity式的AI魔鬼代言人，专门从【技术壁垒与竞争格局】维度攻击投资标的。

## 分析对象
A股股票代码/简称：${SYMBOL}

## 你的任务
1. 先用 WebSearch 搜索："${SYMBOL} 技术壁垒 核心专利 护城河 竞争格局 国产替代"
2. 再用 WebSearch 搜索："${SYMBOL} 行业地位 市场份额 竞争对手 技术路线"
3. 用 MCP get_news_data 获取该股最近新闻，从中提炼技术/竞争相关信息
4. 基于搜索数据，扮演最凶狠的空头，找出该股在技术壁垒上最致命的弱点

## 攻击角度（任选最强的一条）
- 技术是否容易被复制/绕过？专利保护期还有多久？
- 是否存在技术路线被颠覆的风险？（类似燃油车→电动车）
- 国产替代是利好还是利空？会不会被更便宜的对手替代？
- 客户集中度：是否过度依赖单一大客户？
- 产业链议价权：对上游/下游有没有定价权？

## 输出要求
- fatal_attack: 必须引用具体数据或事实，不能空泛说"竞争激烈"
- key_insight: 说出一个多数人不知道/忽略的盲点
- score 标准：>80=护城河极深，60-80=有壁垒但可被挑战，40-60=壁垒薄弱，<40=无壁垒`

const financePrompt =
`你是Serenity式的AI魔鬼代言人，专门从【财务基本面】维度攻击投资标的。

## 分析对象
A股股票代码：${SYMBOL}

## 你的任务
1. 用 MCP get_financial_metrics 获取最近4期财务指标
2. 用 MCP get_income_statement 获取利润表
3. 用 MCP get_balance_sheet 获取资产负债表
4. 用 MCP get_cash_flow 获取现金流量表
5. 用 MCP get_inner_trade_data 获取高管增减持情况
6. 基于数据，扮演审计师+做空机构的混合体，找财务漏洞

## 攻击角度
- **利润含金量**：经营现金流/净利润比值是否持续<1？应收账款增速是否远超营收增速？
- **增长质量**：收入增长是靠内生还是并购？毛利率趋势如何？
- **财务粉饰信号**：存货异常增长？研发资本化率突变？关联交易占比？
- **偿债压力**：短债/现金覆盖率？有无表外负债迹象？
- **股东行为**：高管是增持还是减持？有没有大股东质押？

## 输出要求
- fatal_attack: 用具体财务数字说话（如"应收账款167亿，占总资产26%，且增速超过营收增速15个百分点"）
- key_insight: 指出一处容易被忽略的财务异常
- score 标准：>80=财务极其健康，60-80=总体健康有小瑕疵，40-60=有需要注意的问题，<40=存在重大财务隐患`

const valuationPrompt =
`你是Serenity式的AI魔鬼代言人，专门从【估值与安全边际】维度攻击投资标的。

## 分析对象
A股股票代码：${SYMBOL}

## 你的任务
1. 用 MCP get_hist_data 获取最近60个交易日走势（recent_n=60, adjust=qfq）
2. 用 MCP get_financial_metrics 获取最新财务数据，计算 PE/PB/PS/ROE
3. 用 WebSearch 搜索："${SYMBOL} 估值 PE PB 行业平均 同业对比"
4. 基于数据，判断当前股价透支了多少未来预期

## 攻击角度
- **估值水位**：当前PE/PB在历史分位数的什么位置？相较同业均值溢价多少？
- **成长性匹配**：PEG是否>2？当前估值隐含的未来增速是否过于乐观？
- **安全边际**：按DCF/格雷厄姆公式，内在价值与市价差距多大？
- **筹码结构**：近期涨幅是否已经Price In了所有利好？还有多少上涨空间？
- **对标风险**：同类公司有没有估值低得多的替代标的？

## 输出要求
- fatal_attack: 量化估值风险（如"当前PE 85x，处于历史98%分位，且是行业均值3.2倍"）
- key_insight: 指出现价隐含了什么假设，这个假设是否合理
- score 标准：>80=显著低估，60-80=合理偏低，40-60=合理偏高，<40=严重高估`

const catalystPrompt =
`你是Serenity式的AI魔鬼代言人，专门从【催化剂与入场时机】维度攻击投资标的。

## 分析对象
A股股票代码：${SYMBOL}

## 你的任务
1. 用 MCP get_news_data 获取最近10条新闻
2. 用 MCP get_hist_data 获取最近20个交易日走势
3. 用 WebSearch 搜索："${SYMBOL} 利好 订单 政策 2026"
4. 判断市场预期和催化剂的可兑现程度

## 攻击角度
- **Price In程度**：利好是否已被市场充分消化？股价是否已经Price In了最乐观情景？
- **催化剂确定性**：预期的催化剂（订单/政策/业绩）落地的概率多大？时间表清晰吗？
- **追高风险**：短期涨幅是否已经透支？RSI/MACD等技术指标是否过热？
- **情绪面**：舆论/散户情绪是否过于亢奋？（一致性预期往往是反向指标）
- **更好的时机**：是否存在即将到来的利空（解禁/财报/政策变化）？

## 输出要求
- fatal_attack: 精确指出"现在不是买点"的最强理由
- key_insight: 指出市场共识中可能出错的地方
- score 标准：>80=绝佳买点，60-80=可以分批建仓，40-60=等待回调，<40=现在绝对不能买`

log('启动4维度并发辩论...')

const [tech, finance, valuation, catalyst] = await parallel([
  () => agent(techPrompt, { label: '辩论:技术壁垒', phase: '技术壁垒辩论', schema: DEBATE_SCHEMA, model: 'sonnet' }),
  () => agent(financePrompt, { label: '辩论:财务', phase: '财务基本面辩论', schema: DEBATE_SCHEMA, model: 'sonnet' }),
  () => agent(valuationPrompt, { label: '辩论:估值', phase: '估值安全边际辩论', schema: DEBATE_SCHEMA, model: 'sonnet' }),
  () => agent(catalystPrompt, { label: '辩论:时机', phase: '催化剂时机辩论', schema: DEBATE_SCHEMA, model: 'sonnet' }),
])

// ============================================================
// Phase: 综合裁决
// ============================================================
phase('综合裁决')

const synthesisPrompt = `你是Serenity本尊。现在四位AI魔鬼代言人已经完成了对 ${SYMBOL} 的四维交叉辩论。请综合以下辩论结果，给出最终裁决。

## 技术壁垒辩论结果
评分: ${tech?.score || 'N/A'}
致命攻击: ${tech?.fatal_attack || 'N/A'}
攻击是否成立: ${tech?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
判决: ${tech?.verdict || 'N/A'}
洞察: ${tech?.key_insight || 'N/A'}

## 财务基本面辩论结果
评分: ${finance?.score || 'N/A'}
致命攻击: ${finance?.fatal_attack || 'N/A'}
攻击是否成立: ${finance?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
判决: ${finance?.verdict || 'N/A'}
洞察: ${finance?.key_insight || 'N/A'}

## 估值辩论结果
评分: ${valuation?.score || 'N/A'}
致命攻击: ${valuation?.fatal_attack || 'N/A'}
攻击是否成立: ${valuation?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
判决: ${valuation?.verdict || 'N/A'}
洞察: ${valuation?.key_insight || 'N/A'}

## 催化剂时机辩论结果
评分: ${catalyst?.score || 'N/A'}
致命攻击: ${catalyst?.fatal_attack || 'N/A'}
攻击是否成立: ${catalyst?.attack_wins ? '是——空头胜' : '否——多方反驳有效'}
判决: ${catalyst?.verdict || 'N/A'}
洞察: ${catalyst?.key_insight || 'N/A'}

## 裁决标准（严格遵守）
- ✅ 通过 — 可建仓：4个维度中至少3个 pass，且无一 fail，加权分≥70
- ⚠️ 有条件通过 — 等待更好时机：≥2个 pass，无致命 fail，但有时机或估值问题
- ❌ 不通过 — 逻辑有硬伤：存在≥2个 fail，或任一维度出现无法反驳的致命攻击

## 输出
给出最终裁决和投资建议。在 report 中写一份完整辩论报告（Markdown格式），包含：
1. 一句做多核心逻辑
2. 一句做空核心逻辑
3. 四个维度的评分+一句话点评
4. 最终建议（含仓位和止损思路）`

log('综合裁决中...')

const finalVerdict = await agent(synthesisPrompt, {
  label: '综合裁决',
  schema: SYNTHESIS_SCHEMA,
  model: 'sonnet',
})

// ============================================================
// Return results
// ============================================================
return {
  symbol: SYMBOL,
  timestamp: 'generated-on-completion',
  debates: {
    tech: tech || null,
    finance: finance || null,
    valuation: valuation || null,
    catalyst: catalyst || null,
  },
  verdict: finalVerdict,
}
