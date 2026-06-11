export const meta = {
  name: 'stock-screener-pullback',
  description: '🔄引擎5·回调重启流 — 曾处上升趋势→回调缩量止跌→放量反弹信号→判定企稳状态。两栏：反弹待确认(🟡)+企稳已确认(🟢)',
  phases: [
    { title: '前期强势筛选', detail: '筛选曾处于上升趋势+近期回调10-35%的标的' },
    { title: '止跌信号检测', detail: '缩量止跌+均线支撑+关键位不破' },
    { title: '放量反弹确认', detail: '量比>1.3+阳线+主力资金回流' },
    { title: '企稳状态分级', detail: '反弹待确认(🟡) vs 企稳已确认(🟢) vs 还在回调(🔴)' },
    { title: '重启空间评估', detail: '反弹目标位+剩余空间+止损位+风险收益比' },
    { title: '回调组合报告', detail: '双栏输出+操作策略+止损止盈' },
  ],
}

// ============================================================
// Schemas
// ============================================================

const PULLBACK_SCREEN_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          peak_price: { type: 'number', description: '前期高点' },
          drawdown_pct: { type: 'number', description: '回调幅度%' },
          support_level: { type: 'string', description: '关键支撑位' },
          sector: { type: 'string' },
        },
        required: ['symbol', 'name', 'drawdown_pct'],
      },
    },
    total: { type: 'integer' },
  },
  required: ['candidates'],
}

const PULLBACK_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    bouncing: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          drawdown: { type: 'number' },
          bounce_signal: { type: 'string', description: '反弹信号描述' },
          confirm_needed: { type: 'string', description: '还需要什么确认' },
          bounce_score: { type: 'integer' },
          entry_plan: { type: 'string' },
          stop_loss: { type: 'string' },
        },
      },
      description: '🟡反弹待确认：出现止跌反弹信号但尚未企稳',
    },
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          drawdown: { type: 'number' },
          confirm_signal: { type: 'string', description: '企稳确认信号' },
          upside_target: { type: 'string', description: '反弹目标位' },
          remaining_space: { type: 'string', description: '剩余空间' },
          confirmed_score: { type: 'integer' },
          entry_plan: { type: 'string' },
          stop_loss: { type: 'string' },
        },
      },
      description: '🟢企稳已确认：放量突破+均线修复+主力回流',
    },
    still_falling: {
      type: 'array',
      items: { type: 'object', properties: { symbol: { type: 'string' }, name: { type: 'string' }, reason: { type: 'string' } } },
      description: '🔴还在回调，建议等待',
    },
  },
  required: ['bouncing', 'confirmed'],
}

// ============================================================
// Phase 1: 前期强势+回调筛选
// ============================================================
phase('前期强势筛选')

log('🔄 阶段1: 筛选前期强势+近期回调的标的...')

const screenResult = await agent(
  `你是一个回调交易专家。请筛选处于"上升趋势中的正常回调"阶段的A股标的。

## 筛选逻辑
不是所有下跌都叫回调。真正的回调：
- 前期处于上升趋势（均线多头或创过新高）
- 近期从高点回落10-35%（太浅不算回调，太深可能是趋势反转）
- 回调过程中成交量萎缩（缩量下跌=洗盘，非出货）
- 在关键均线或前低获得支撑

## 搜索步骤
1. WebSearch: "A股 前期强势股 缩量回调 止跌 2026年6月"
2. WebSearch: "A股 回调到位 放量反弹 支撑位"
3. WebSearch: "龙回头 上升趋势 缩量洗盘 企稳信号"
4. 如果 MCP get_hist_data 可用，抽查趋势确认
5. 也可以用全市场扫描脚本: bash run-scanner.sh pullback

## 纳入条件
- 距60日高点回调10-35%
- 近3日成交量明显萎缩（缩量止跌）
- 今日出现阳线（不管大小）
- 排除ST、排除跌停板

## 输出
候选列表，标注前期高点和回调幅度`,
  { label: '前期强势+回调筛选', schema: PULLBACK_SCREEN_SCHEMA }
)

if (!screenResult || !screenResult.candidates || screenResult.candidates.length === 0) {
  log('⚠️ 无符合条件的回调标的。市场可能整体强势或整体弱势。')
  return { status: 'no_candidates', message: '今日无符合条件的回调标的' }
}

log(`🔄 回调候选: ${screenResult.total}只`)

// ============================================================
// Phase 2: 止跌信号检测 + 放量反弹确认
// ============================================================
phase('止跌信号检测')

log('🔍 阶段2: 检测止跌信号+放量反弹确认...')

const pullbackResult = await agent(
  `你是回调交易专家。对候选标的进行止跌信号+放量反弹的双重判定。

## 候选标的
${JSON.stringify(screenResult.candidates.slice(0, 30).map(c => ({
  symbol: c.symbol, name: c.name, drawdown: c.drawdown_pct, support: c.support_level
})), null, 2)}

## 判定步骤
1. 对每只标的，用 MCP get_hist_data (recent_n=30) 查看：
   - 回调到哪条均线附近止跌了？（20日/50日/前低？）
   - 成交量是否萎缩？（缩量=洗盘，放量下跌=危险）
   - 今天是否为阳线？量比是否>1.3？
2. WebSearch: "[股票名] 资金流向 主力"
3. 判断：

### 🟢 企稳已确认
- 放量阳线(量比>1.3) + 站回5日线 + 主力资金净流入
- 或：突破下降趋势线 + MACD金叉
- 或：巨量长阳突破前期整理平台

### 🟡 反弹待确认
- 出现阳线但量能不足(量比0.8-1.3)
- 或：止跌但仍在均线下方
- 或：缩量小阳线，需要明天验证

### 🔴 还在回调
- 继续新低或放量下跌
- 或：跌破关键支撑位

## 输出
三栏分类+每只的操作建议`,
  { label: '止跌信号+放量确认', schema: PULLBACK_RESULT_SCHEMA }
)

log(`🔄 企稳确认: ${pullbackResult?.confirmed?.length || 0}只 | 反弹待确认: ${pullbackResult?.bouncing?.length || 0}只 | 还在回调: ${pullbackResult?.still_falling?.length || 0}只`)

// ============================================================
// Phase 3: 反弹空间评估
// ============================================================
phase('重启空间评估')

const spaceResult = await agent(
  `评估以下回调标的的反弹空间和风险收益比。

## 企稳确认标的
${JSON.stringify((pullbackResult?.confirmed || []).slice(0, 10), null, 2)}

## 反弹待确认标的
${JSON.stringify((pullbackResult?.bouncing || []).slice(0, 10), null, 2)}

## 评估维度
1. WebSearch: "[股票名] 目标价 压力位 反弹空间"
2. 计算反弹目标：
   - 第一目标：回调幅度的50%回弹位
   - 第二目标：前期高点
   - 第三目标：突破新高
3. 风险收益比：
   - 距止损位的距离 vs 距目标位的距离
   - 至少1:2才值得做

## 输出
每只标的的目标位+剩余空间+止损位+风险收益比`,
  { label: '反弹空间评估' }
)

// ============================================================
// Phase 4: 回调组合报告
// ============================================================
phase('回调组合报告')

const pullbackReport = await agent(
  `你是回调交易专家。基于完整的回调重启分析，生成投资报告。

## 全部数据

### 初筛
${JSON.stringify(screenResult, null, 2)}

### 止跌+放量判定
${JSON.stringify(pullbackResult, null, 2)}

### 反弹空间
${spaceResult || ''}

## 报告要求(Markdown)

### 🟡 反弹待确认
| 标的 | 回调幅度 | 反弹信号 | 还需确认什么 | 评分 | 操作 |
这些标的出现了止跌迹象但还没完全企稳——激进的可以先轻仓试探，稳健的等明天确认。

### 🟢 企稳已确认
| 标的 | 回调幅度 | 企稳确认 | 反弹目标 | 剩余空间 | 评分 | 操作 |
这些标的已经放量突破+站回均线+主力回流——大概率继续上涨。

### 🔴 还在回调（排除）
哪些标的还在跌？哪些是陷阱（放量下跌=出货）？

### ⚠️ 回调交易铁律
- 缩量止跌才安全，放量下跌不抄底
- 止损必须紧（-5%到-8%），抄底失败要认
- 反弹第一波最确定，第二波空间有限
- 优先选前期龙头回调（辨识度高，反弹力度大）`,
  { label: '回调组合报告' }
)

return {
  status: 'complete',
  logic: 'pullback_recovery',
  summary: {
    candidates: screenResult?.total || 0,
    bouncing: pullbackResult?.bouncing?.length || 0,
    confirmed: pullbackResult?.confirmed?.length || 0,
    still_falling: pullbackResult?.still_falling?.length || 0,
  },
  phases: {
    screen: screenResult,
    pullback: pullbackResult,
    space: spaceResult,
  },
  report: pullbackReport,
}
