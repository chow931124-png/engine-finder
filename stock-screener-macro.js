export const meta = {
  name: 'stock-screener-macro',
  description: '🌍引擎3·宏观事件驱动流 — 时事新闻→国家政策→国际大事→科技突破→产业拐点→提前埋伏。在大多数人还没反应过来之前找到机会。',
  phases: [
    { title: '全球宏观扫描', detail: '美联储/地缘/科技突破/大宗商品，找出影响A股的关键变量' },
    { title: '国内政策追踪', detail: '国务院/发改委/工信部最新政策+产业规划+大基金方向' },
    { title: '产业链趋势研判', detail: '哪些行业处于拐点？哪些在爆发前夜？' },
    { title: '标的映射', detail: '宏观→行业→个股，找到提前埋伏标的' },
    { title: '时机与风险', detail: '催化剂时间轴+风险收益比评估' },
    { title: '三流交叉汇总', detail: '活跃资金流×聪明钱流×宏观产业流，综合推荐' },
  ],
}

// ============================================================
// Schemas
// ============================================================

const MACRO_SCHEMA = {
  type: 'object',
  properties: {
    key_events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event: { type: 'string', description: '事件/政策名称' },
          impact_level: { type: 'string', enum: ['极高', '高', '中', '低'] },
          direction: { type: 'string', description: '对A股的影响方向和逻辑' },
          timeline: { type: 'string', description: '影响时间窗口' },
          affected_sectors: { type: 'array', items: { type: 'string' } },
        },
        required: ['event', 'impact_level', 'affected_sectors'],
      },
    },
    macro_summary: { type: 'string', description: '宏观环境一句话总结' },
  },
  required: ['key_events'],
}

const POLICY_SCHEMA = {
  type: 'object',
  properties: {
    policies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          policy: { type: 'string', description: '政策名称/内容' },
          department: { type: 'string', description: '发布部门' },
          sector_impact: { type: 'string', description: '受益板块和逻辑' },
          urgency: { type: 'string', enum: ['立即行动', '近期关注', '长期跟踪'] },
        },
        required: ['policy', 'sector_impact'],
      },
    },
    policy_direction: { type: 'string', description: '政策总体方向' },
  },
  required: ['policies'],
}

const INDUSTRY_SCHEMA = {
  type: 'object',
  properties: {
    inflection_points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: '行业名称' },
          stage: { type: 'string', enum: ['爆发前夜', '趋势启动', '加速期', '成熟期', '衰退期'] },
          catalyst: { type: 'string', description: '催化剂/拐点事件' },
          conviction: { type: 'string', enum: ['高', '中', '低'] },
        },
        required: ['industry', 'stage', 'catalyst'],
      },
    },
  },
  required: ['inflection_points'],
}

const STOCK_MAP_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          sector: { type: 'string' }, macro_link: { type: 'string', description: '与宏观/政策/产业的关联逻辑' },
          current_stage: { type: 'string', description: '当前处于什么阶段' },
          catalyst_timeline: { type: 'string', description: '催化剂大致时间' },
          ambition_level: { type: 'string', enum: ['提前埋伏', '趋势跟随', '右侧确认后追'] },
          position_pct: { type: 'string', description: '建议仓位%' },
          patience: { type: 'string', description: '需要等多久(天/周/月)' },
        },
        required: ['symbol', 'name', 'macro_link', 'ambition_level'],
      },
    },
  },
  required: ['candidates'],
}

// ============================================================
// Phase 1: 全球宏观扫描
// ============================================================
phase('全球宏观扫描')

log('🌍 阶段1: 扫描全球宏观事件，找出影响A股的关键变量...')

const macroResult = await agent(
  `你是一个全球宏观策略分析师。请扫描当前影响A股的最重要宏观事件。

## 搜索方向
1. WebSearch: "美联储 利率决议 2026年6月 降息 加息"
2. WebSearch: "全球半导体 AI 产业政策 地缘政治 2026年6月"
3. WebSearch: "大宗商品 铜 原油 稀土 价格走势 2026年6月"
4. WebSearch: "SpaceX IPO 美股 影响 A股 资金"

## 新增：美股技术面异动监测（重要！）
除了传统宏观事件，还要扫描以下美股技术面异动信号，它们直接影响A股映射板块：

### 📡 美股异动 → A股传导矩阵
| 美股触发信号 | 影响等级 | 影响窗口 | A股受影响板块 | 预期影响 |
|-------------|:-------:|:--------:|-------------|:--------:|
| NVDA 单日涨跌幅 > ±5% | 🔥🔥🔥 | T+0~T+1 | 光模块/算力/HBM | ±2%~±4% |
| SOX(费城半导体) > ±3% | 🔥🔥🔥 | T+0~T+2 | 半导体设备/材料 | ±1.5%~±3% |
| TSLA > ±5% | 🔥🔥 | T+0~T+1 | 汽车零部件/机器人 | ±2%~±3% |
| AAPL > ±4% | 🔥🔥 | T+0~T+1 | 消费电子链 | ±1.5%~±2.5% |
| VIX恐慌指数 > 30 | 🔥🔥🔥 | T+0~T+3 | 北向重仓股全体 | -0.5%~-1.5% |
| VIX恐慌指数 > 35 | 🔥🔥🔥🔥 | T+0~T+5 | 全市场+映射股额外承压 | -1%~-3% |
| 纳斯达克100单周跌 > 5% | 🔥🔥🔥🔥 | T+0~T+5 | AI/半导体/消费电子 | -2%~-5% |
| 美股半导体批量业绩预警 | 🔥🔥🔥🔥🔥 | T+0~T+20 | 全A股半导体板块 | -5%~-15% |

### 每日检查清单
在宏观扫描中，WebSearch查询：
- "NVDA stock price today" 或 "英伟达 股价 最新"
- "VIX fear index today"
- "费城半导体指数 SOX 最新"
- "SPCX SpaceX stock price" 或 "SpaceX 股价 最新"（商业航天估值锚）
- "COMEX copper gold price" 或 "铜价 金价 最新"（有色金属全球定价锚）
- 如上述触发异动，在key_events中必须包含该传导分析

## 分析框架
对每个事件判断:
- 对A股的影响方向(利好/利空/中性)
- 影响力度(极高/高/中/低)
- 时间窗口(短期1周 / 中期1月 / 长期3月+)
- 具体影响的A股板块

## 重点关注
- 货币政策拐点(美联储/欧央行/日央行/中国央行)
- 科技封锁/突破(芯片制裁/国产替代/新技术路线)
- 地缘冲突(供应链安全/资源国政策)
- 全球资金流向(美元强弱/新兴市场资金流动)
- **美股技术面异动**（NVDA/SOX/VIX/TSLA/AAPL/SPCX）的A股传导
- **全球大宗商品异动**（铜/金/铝价）→ A股有色金属映射

## 输出
列出5-8个最重要的宏观事件及影响分析。如果有美股技术面异动触发，必须将其作为key_events之一输出。`,
  { label: '全球宏观扫描', schema: MACRO_SCHEMA }
)

log(`🌍 宏观扫描: ${macroResult?.key_events?.length || 0}个关键事件`)

// ============================================================
// Phase 2: 国内政策追踪
// ============================================================
phase('国内政策追踪')

log('📜 阶段2: 追踪国内最新政策方向...')

const policyResult = await agent(
  `你是一个中国产业政策分析专家。追踪最新政策动向，找出将受益的产业。

## 搜索方向
1. WebSearch: "国务院 工信部 科技部 最新政策 2026年6月"
2. WebSearch: "国家大基金 三期 投资方向 半导体"
3. WebSearch: "十五五规划 产业政策 新质生产力 2026"
4. WebSearch: "AI 人工智能 政策 工信部 2026"

${macroResult?.key_events ? `
## 宏观背景（来自阶段1）
${macroResult.key_events.map(e => `- ${e.event} [${e.impact_level}] → ${e.affected_sectors?.join(', ')}`).join('\n')}
` : ''}

## 分析框架
- 政策级别: 国务院>发改委>工信部>地方
- 政策力度: 财政拨款金额/税收优惠/准入门槛变化
- 受益确定性: 直接受益(补贴对象) vs 间接受益(产业链配套)
- 时间紧迫性: 立即行动 vs 近期关注 vs 长期跟踪

## 输出
列出最重要的政策及受益板块`,
  { label: '国内政策追踪', schema: POLICY_SCHEMA }
)

log(`📜 政策追踪: ${policyResult?.policies?.length || 0}项关键政策`)

// ============================================================
// Phase 3: 产业链趋势研判
// ============================================================
phase('产业链趋势研判')

log('🔮 阶段3: 研判产业链拐点，找到爆发前夜的行业...')

const industryResult = await agent(
  `你是一个产业链趋势分析师。找出当前处于拐点的行业——不管是即将爆发还是即将见顶。

## 搜索方向
1. WebSearch: "半导体 产业链 景气度 库存周期 2026"
2. WebSearch: "AI应用 商业化 爆发 2026"
3. WebSearch: "新能源 光伏 锂电 储能 拐点 反转 2026"
4. WebSearch: "低空经济 商业航天 产业化 进展 2026"
5. WebSearch: "创新药 医疗器械 集采 政策拐点 2026"

${policyResult?.policies ? `
## 政策背景（来自阶段2）
${policyResult.policies.map(p => `- ${p.policy} → ${p.sector_impact}`).join('\n')}
` : ''}

## 分析框架
判断每个行业的生命周期阶段:
- 🟢 爆发前夜: 技术突破刚发生，市场还没反应过来 → **提前埋伏**
- 🔵 趋势启动: 龙头已启动，但板块内还有滞涨标的 → 趋势跟随
- 🟡 加速期: 全市场都在追 → 右侧确认后追
- 🔴 成熟/衰退期: 增速放缓/产能过剩 → 规避

## 输出
每个行业的阶段判断+催化剂+确信度`,
  { label: '产业链趋势研判', schema: INDUSTRY_SCHEMA }
)

log(`🔮 产业研判: ${industryResult?.inflection_points?.length || 0}个拐点行业`)

// ============================================================
// Phase 4: 标的映射
// ============================================================
phase('标的映射')

log('🗺️ 阶段4: 宏观→行业→个股，找出提前埋伏标的...')

const stockMapResult = await agent(
  `你是一个自上而下的投资组合经理。将宏观/政策/产业趋势映射到具体的A股标的。

## 产业趋势（来自阶段3）
${JSON.stringify(industryResult?.inflection_points || [], null, 2)}

## 映射要求
对每个处于"爆发前夜"或"趋势启动"的行业，找出2-3只最值得关注的A股标的:
1. WebSearch: "[行业名] A股 龙头 核心标的"
2. 选股逻辑: 行业地位>估值合理>资金关注>近期走势
3. 对每只标的标注:
   - ambition_level: 提前埋伏(还没涨) / 趋势跟随(刚启动) / 右侧确认(已经在涨)
   - position_pct: 建议仓位
   - patience: 需要等多久

## 提前埋伏标的特征
- 行业拐点明确但公司股价还没反应
- 机构刚开始覆盖/调研
- 基本面稳健(ROE>10%, 现金流为正)
- 市值中等(50-500亿)，非微盘股

## 输出
给出10-15只候选标的`,
  { label: '标的映射', schema: STOCK_MAP_SCHEMA }
)

log(`🗺️ 标的映射: ${stockMapResult?.candidates?.length || 0}只提前埋伏标的`)

// ============================================================
// Phase 5: 时机与风险
// ============================================================
phase('时机与风险')

log('⏰ 阶段5: 评估时机和风险收益比...')

const timingResult = await agent(
  `你是一个风险管理专家。对宏观产业流选出的标的进行时机和风险评估。

## 候选标的
${JSON.stringify((stockMapResult?.candidates || []).slice(0, 12).map(c => ({
  symbol: c.symbol, name: c.name, sector: c.sector,
  stage: c.current_stage, ambition: c.ambition_level,
  catalyst: c.catalyst_timeline, patience: c.patience,
})), null, 2)}

## 分析维度
1. **催化剂确定性**: 这个催化剂会不会来？概率多大？
2. **时间成本**: 提前埋伏需要拿多久？期间会承受多大波动？
3. **下行风险**: 如果催化剂不来，最坏会跌多少？
4. **上行空间**: 如果催化剂兑现，合理目标价是多少？
5. **仓位配比**: 提前埋伏标的总仓位不超过多少？

## 输出
- 每只标的的风险收益比评级(优/良/差)
- 建议的建仓节奏(一次性/分3批/定投)
- 需要规避的黑天鹅`,
  { label: '时机与风险' }
)

// ============================================================
// Phase 6: 三流交叉汇总
// ============================================================
phase('三流交叉汇总')

log('🔗 阶段6: 三流交叉汇总 — 宏观×聪明钱×活跃资金...')

const finalMacroReport = await agent(
  `你是Serenity本尊。请基于"宏观产业前瞻流"的完整结果，生成一份前瞻性投资报告。

## 宏观产业流结果

### 全球宏观
${macroResult?.macro_summary || ''}
${(macroResult?.key_events || []).map(e => `- ${e.event} [${e.impact_level}]: ${e.direction || ''} → ${e.affected_sectors?.join(', ')} | ${e.timeline || ''}`).join('\n')}

### 国内政策
${policyResult?.policy_direction || ''}
${(policyResult?.policies || []).map(p => `- ${p.policy} (${p.department}): ${p.sector_impact} [${p.urgency}]`).join('\n')}

### 产业链拐点
${(industryResult?.inflection_points || []).map(i => `- **${i.industry}** [${i.stage}]: ${i.catalyst} | 确信度: ${i.conviction}`).join('\n')}

### 标的映射
${JSON.stringify((stockMapResult?.candidates || []).map(c => ({
  name: c.name, symbol: c.symbol, sector: c.sector,
  ambition: c.ambition_level, position: c.position_pct, patience: c.patience
})), null, 2)}

### 时机与风险
${timingResult || ''}

## 三流交叉验证框架
如果一只标的**同时出现在三个工作流中**:
🟢🟢🟢 **三流共振**: 活跃资金在买 + 聪明钱在布局 + 宏观产业在风口 → 置信度最高

🟢🟢 两流共振:
- 宏观+活跃: 风口到了+市场在追 → 短线加速
- 宏观+聪明钱: 风口将至+机构提前布局 → 最佳埋伏时机
- 活跃+聪明钱: 短线+中线共振 → 趋势确认

🟢 单流信号: 适合特定策略(跟庄/埋伏/追涨)

## 报告要求(Markdown)
1. **🌍 宏观大图景**: 未来1-3个月影响A股的核心变量
2. **📜 政策主线**: 最重要的2-3条政策方向
3. **📡 美股映射监测**: 当前美股（NVDA/SOX/TSLA/AAPL/VIX）的技术面状态，以及对A股映射板块的传导判断。如果美股出现异动（见传导矩阵），标注影响等级和对应A股标的。
4. **🔮 行业拐点**: 爆发前夜的行业→提前埋伏方向
5. **🎯 提前埋伏标的**: 每只标的+宏观逻辑+催化剂时间+仓位+需要等多久
6. **🔗 三流交叉**: 如果你知道活跃资金流和聪明钱流的结果，标注交叉验证
7. **⚠️ 宏观风险**: 最大的不确定性来源（含美股异动风险）
8. **🏛️ 长期组合**: 如果只选3只提前埋伏，选谁？怎么配？`

  { label: '三流交叉汇总' }
)

// ============================================================
return {
  status: 'complete',
  logic: 'macro_foresight',
  summary: {
    macro_events: macroResult?.key_events?.length || 0,
    policies: policyResult?.policies?.length || 0,
    inflection_industries: industryResult?.inflection_points?.length || 0,
    candidates: stockMapResult?.candidates?.length || 0,
  },
  phases: {
    macro: macroResult,
    policy: policyResult,
    industry: industryResult,
    stock_map: stockMapResult,
    timing: timingResult,
  },
  report: finalMacroReport,
}
