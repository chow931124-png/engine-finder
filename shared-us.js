// ============================================================
// 美股映射模块 — 美股→A股传导链数据
// ============================================================

// ============================================================
// 1. A股标的 ↔ 美股锚定映射表
// ============================================================
//
// 映射级别:
//   🔗 强映射 — 全球供应链直接绑定，美股龙头=A股定价锚
//   🔗 中映射 — 行业趋势相关，但A股有独立逻辑
//   ⚪ 弱映射 — 内需/政策驱动为主
//
// 使用方式: 引擎脚本中的 agent prompt 引用此表

const US_ANCHOR_MAP = {
  // ── AI算力/半导体 ──
  '海光信息':   { us: 'NVDA',  level: '🔗强', sector: 'AI算力GPU',    logic: '国产GPU唯一对标，NVDA业绩/趋势直接影响板块估值锚' },
  '中际旭创':   { us: 'NVDA',  level: '🔗强', sector: '光模块',       logic: '英伟达光模块核心供应商，NVDA订单预期=旭创业绩' },
  '天孚通信':   { us: 'NVDA',  level: '🔗强', sector: '光模块',       logic: '英伟达光引擎供应商，全球唯三能做' },
  '雅克科技':   { us: 'NVDA',  level: '🔗强', sector: 'HBM前驱体',    logic: 'SK海力士HBM前驱体供应商，HBM产能直接受益AI算力需求' },
  '工业富联':   { us: 'NVDA',  level: '🔗强', sector: 'AI服务器',     logic: '英伟达AI服务器主力代工厂' },
  '沪电股份':   { us: 'NVDA',  level: '🔗中', sector: 'PCB',          logic: 'AI服务器PCB供应商，受益AI资本开支' },
  '通富微电':   { us: 'AMD',   level: '🔗中', sector: '先进封装',    logic: 'AMD封装合作伙伴' },

  // ── 半导体设备/材料 ──
  '北方华创':   { us: 'SOX',   level: '🔗中', sector: '刻蚀/薄膜',   logic: '国产半导体设备龙头，全球半导体周期影响CAPEX' },
  '中微公司':   { us: 'SOX',   level: '🔗中', sector: '刻蚀',        logic: '国产刻蚀设备龙头，受全球半导体周期影响' },
  '盛美上海':   { us: 'SOX',   level: '🔗中', sector: '清洗设备',     logic: '国产清洗设备龙头，CAPEX周期敏感性' },
  '拓荆科技':   { us: 'SOX',   level: '🔗中', sector: '薄膜沉积',    logic: '国产薄膜沉积设备龙头' },
  '昊华科技':   { us: 'SOX',   level: '🔗中', sector: '电子特气',    logic: '半导体材料供应商，受全球半导体产线开工率影响' },

  // ── 存储 ──
  '兆易创新':   { us: 'MU',    level: '🔗中', sector: '存储芯片',    logic: 'NOR Flash+MCU，受存储周期影响，MU业绩指引是关键' },
  '澜起科技':   { us: 'MU',    level: '🔗中', sector: '内存接口',    logic: 'DDR5内存接口芯片，与美光/三星内存周期同步' },

  // ── 苹果产业链 ──
  '立讯精密':   { us: 'AAPL',  level: '🔗中', sector: '消费电子',    logic: '苹果核心代工厂，iPhone出货量直接决定业绩' },
  '歌尔股份':   { us: 'AAPL',  level: '🔗中', sector: '声学/VR',     logic: '苹果+Meta VR/声学供应商' },
  '蓝思科技':   { us: 'AAPL',  level: '🔗中', sector: '玻璃盖板',    logic: '苹果玻璃盖板供应商' },

  // ── 特斯拉/新能源车 ──
  '拓普集团':   { us: 'TSLA',  level: '🔗中', sector: '汽配',        logic: '特斯拉底盘/内饰核心供应商' },
  '三花智控':   { us: 'TSLA',  level: '🔗中', sector: '热管理',      logic: '特斯拉热管理系统供应商' },
  '旭升集团':   { us: 'TSLA',  level: '🔗中', sector: '铝合金压铸',  logic: '特斯拉铝合金压铸供应商' },

  // ── AI软件/应用 ──
  '金山办公':   { us: 'MSFT',  level: '🔗中', sector: 'AI办公',      logic: '对标Microsoft 365 Copilot，AI办公逻辑跟随微软' },
  '科大讯飞':   { us: 'MSFT',  level: '🔗弱', sector: 'AI语音',      logic: '国内AI语音龙头，微软Copilot间接映射' },

  // ── 内需/独立逻辑（不做美股映射） ──
  '中钨高新':   { us: null,    level: '⚪弱', sector: '钨全链',      logic: '钨资源定价，内需驱动' },
  '埃科光电':   { us: null,    level: '⚪弱', sector: '机器视觉',    logic: '国产替代，内需驱动' },
  '厦门钨业':   { us: null,    level: '⚪弱', sector: '钨钼',        logic: '钨资源定价，内需驱动' },
  '隆基绿能':   { us: null,    level: '⚪弱', sector: '光伏',        logic: '光伏全球产能过剩，独立供需周期' },
  '亿华通':     { us: null,    level: '⚪弱', sector: '氢能',        logic: '氢能政策驱动，国内独立' },
  '航发动力':   { us: null,    level: '⚪弱', sector: '军工发动机',  logic: '军工独立逻辑' },
  '绿的谐波':   { us: null,    level: '⚪弱', sector: '谐波减速器',  logic: '国产替代，国内机器人需求驱动' },
  '中科三环':   { us: null,    level: '⚪弱', sector: '稀土永磁',    logic: '稀土配额驱动' },
  '双星新材':   { us: null,    level: '⚪弱', sector: '复合铜箔',    logic: '锂电材料，内需驱动' },
  '天娱数科':   { us: null,    level: '⚪弱', sector: 'AI应用',      logic: '题材驱动，非基本面锚定' },
  '康强电子':   { us: null,    level: '⚪弱', sector: '引线框架',    logic: '半导体封装材料，但国产替代独立' },
  '拓维信息':   { us: null,    level: '⚪弱', sector: '算力租赁',    logic: '华为昇腾生态，题材驱动' },
}

// ============================================================
// 2. 美股趋势状态判定规则
// ============================================================
//
// 用于 agent prompt 中指示如何判断美股趋势
const US_TREND_RULES = `
## 美股趋势状态判定规则

判断对应美股龙头（NVDA/SOX/TSLA/AAPL/MSFT/AMD/MU）的当前趋势状态：

| 状态 | 判定条件 |
|------|---------|
| 🟢 上升趋势 | 股价站上MA20 且 MA20 > MA60 且 近5日无破位 |
| 🟡 震荡/盘整 | 股价在MA20和MA60之间纠缠 或 方向不明 |
| 🔴 下降趋势 | 股价跌破MA60 且 MA20 < MA60 或 形成下降通道 |

数据获取方式：WebSearch "NVDA 股价 均线 技术分析" 或 Yahoo Finance 查看
`

// ============================================================
// 3. 美股锚定修正分矩阵
// ============================================================
//
// 映射级别 × 美股趋势 → 修正分值
const US_ANCHOR_SCORE_MATRIX = {
  '🔗强': { '🟢上升': 10, '🟡震荡': 0, '🔴下降': -5, '未知': 0 },
  '🔗中': { '🟢上升': 5,  '🟡震荡': 0, '🔴下降': -3, '未知': 0 },
  '⚪弱': { '🟢上升': 0,  '🟡震荡': 0, '🔴下降': 0,  '未知': 0 },
}

// ============================================================
// 4. 美股异动 → A股传导矩阵
// ============================================================
//
// 用于引擎5的宏观事件触发
const US_EVENT_TRIGGER_MATRIX = [
  {
    trigger: 'NVDA 单日涨跌幅 > ±5%',
    level: '🔥🔥🔥',
    window: 'T+0~T+1',
    impacted: ['中际旭创', '天孚通信', '工业富联', '沪电股份'],
    expectedImpact: '±2%~±4%（同向）',
    note: 'NVDA是AI算力总龙头，极端行情传导当天有效',
  },
  {
    trigger: 'SOX(费城半导体) 单日 > ±3%',
    level: '🔥🔥🔥',
    window: 'T+0~T+2',
    impacted: ['北方华创', '中微公司', '盛美上海', '拓荆科技', '兆易创新'],
    expectedImpact: '±1.5%~±3%（同向）',
    note: '传导效率低于NVDA单票，但覆盖面更广',
  },
  {
    trigger: 'TSLA 单日 > ±5%',
    level: '🔥🔥',
    window: 'T+0~T+1',
    impacted: ['拓普集团', '三花智控', '旭升集团'],
    expectedImpact: '±2%~±3%（同向）',
    note: '新能源车链映射，传导效率中等',
  },
  {
    trigger: 'AAPL 单日 > ±4%',
    level: '🔥🔥',
    window: 'T+0~T+1',
    impacted: ['立讯精密', '歌尔股份', '蓝思科技'],
    expectedImpact: '±1.5%~±2.5%（同向）',
    note: '消费电子链映射，但A股立讯有独立逻辑时可能减弱',
  },
  {
    trigger: 'VIX(恐慌指数) > 30',
    level: '🔥🔥🔥',
    window: 'T+0~T+3',
    impacted: ['所有北向重仓股（茅台/宁德/美的/招商）'],
    expectedImpact: '-0.5%~-1.5%（系统性承压）',
    note: 'VIX>30=全球避险情绪飙升，外资重仓股集体承压',
  },
  {
    trigger: 'VIX(恐慌指数) > 35',
    level: '🔥🔥🔥🔥',
    window: 'T+0~T+5',
    impacted: ['全市场 + 强映射标的额外承压'],
    expectedImpact: '全市场-1%~-3%，映射标的额外-2%',
    note: 'VIX>35=市场极度恐慌，建议空仓或≤2成',
  },
  {
    trigger: '纳斯达克100 单周跌 > 5%',
    level: '🔥🔥🔥🔥',
    window: 'T+0~T+5',
    impacted: ['AI算力板块 + 半导体设备 + 消费电子'],
    expectedImpact: '-2%~-5%',
    note: '周级别调整传导更深，影响持续到下周',
  },
  {
    trigger: '美股半导体龙头批量业绩预警',
    level: '🔥🔥🔥🔥🔥',
    window: 'T+0~T+20',
    impacted: ['全A股半导体/AI/算力板块'],
    expectedImpact: '-5%~-15%',
    note: '产业链级的重新估值，影响持续数周',
  },
  {
    trigger: '美联储利率决议（鹰派超预期）',
    level: '🔥🔥🔥🔥🔥',
    window: 'T+0~T+20',
    impacted: ['高估值科技成长 > 银行保险 > 消费'],
    expectedImpact: '高估值科技-3%~-8%，银行保险+1%~+3%',
    note: '方向性逆转，影响持续到下次会议预期形成',
  },
  {
    trigger: '美联储利率决议（鸽派超预期）',
    level: '🔥🔥🔥🔥',
    window: 'T+0~T+20',
    impacted: ['科技成长全面反弹 >  BioTech > 新能源'],
    expectedImpact: '科技+3%~+8%',
    note: '流动性宽松预期利好高估值成长',
  },
]

// ============================================================
// 5. 空仓/减仓 — 美股量化触发规则
// ============================================================
const US_EMPTY_POSITION_RULES = `
## 美股量化空仓/减仓触发

当以下条件触发时，自动执行空仓/减仓操作（硬性约束）：

| # | 条件 | 操作 | 优先级 |
|---|------|------|-------|
| 1 | 纳斯达克单周累计跌幅 > 8% | 强制降至 ≤2 成仓位 | 🥇 |
| 2 | VIX 收盘价 > 35 | 暂停所有科技股开仓 | 🥇 |
| 3 | SOX 指数月跌幅 > 12% | A股映射标的全部减半仓 | 🥇 |
| 4 | 连续3个交易日北向资金单日净流出 > 50亿 | 外资重仓股权重降至 ≤5% | 🥈 |
| 5 | 隔夜美股科技板块（纳斯达克100）单日跌 > 4% | 次日不开新仓，观察半天 | 🥈 |

说明：以上为"已经发生了才触发"的硬性约束，不用于提前预判。
提前预判由引擎5（宏观事件）的美联储决议/财报日历承担。
`

// ============================================================
// 6. 流量灯 — 美股异动红灯规则
// ============================================================
const US_TRAFFIC_LIGHT_RULES = `
## 🚫 流量灯·美股异动红灯

在现有流量灯判定条件中增加以下维度：

### 触发条件（满足任意一条即亮红灯）
🔴 隔夜美股 SOX（费城半导体指数）单日跌幅 > 3%
🔴 隔夜 NVDA 单日跌幅 > 5%
🔴 隔夜 TSLA 单日跌幅 > 5%
🔴 VIX 收盘价 > 30

### 作用范围
- 红灯只作用于【强映射】和【中映射】标的（半导体/AI/光模块/HBM/消费电子/新能源车链）
- 内需/弱映射标的（军工/电力/消费/公用事业）不受影响

### 红灯生效规则
- 触发后自动计入该标的的红灯计数（+1）
- 生效时长：触发后 2 个交易日自动解除
- 与现有红灯规则叠加使用，不替代现有规则
`

// ============================================================
// 7. 辅助函数
// ============================================================

/**
 * 获取标的的美股映射级别
 * @param {string} stockName - A股名称
 * @returns {{ us: string, level: string, sector: string, logic: string }|null}
 */
function getUSAnchor(stockName) {
  return US_ANCHOR_MAP[stockName] || null
}

/**
 * 根据映射级别和美股趋势计算修正分
 * @param {string} level - 映射级别 ('🔗强'|'🔗中'|'⚪弱')
 * @param {string} trend - 美股趋势 ('🟢上升'|'🟡震荡'|'🔴下降')
 * @returns {number} 修正分值
 */
function getAnchorScore(level, trend) {
  const levelMap = US_ANCHOR_SCORE_MATRIX[level]
  if (!levelMap) return 0
  return levelMap[trend] || levelMap['未知']
}

/**
 * 获取某只标的的美股映射修正分（便捷方法）
 * @param {string} stockName - A股名称
 * @param {string} usTrend - 美股趋势
 * @returns {number}
 */
function getStockAnchorScore(stockName, usTrend) {
  const anchor = getUSAnchor(stockName)
  if (!anchor) return 0
  return getAnchorScore(anchor.level, usTrend)
}

/**
 * 检查美股是否触发红灯
 * @param {object} usMarket - { nvdaChange, soxChange, tslaChange, vixClose }
 * @param {string} stockLevel - 映射级别
 * @returns {{ triggered: boolean, reasons: string[] }}
 */
function checkTrafficLight(usMarket, stockLevel) {
  const reasons = []
  if (stockLevel === '⚪弱' || stockLevel === '⚪') return { triggered: false, reasons: [] }

  if (usMarket.soxChange && Math.abs(usMarket.soxChange) > 3 && usMarket.soxChange < 0) {
    reasons.push(`SOX跌${usMarket.soxChange.toFixed(1)}%>3%`)
  }
  if (usMarket.nvdaChange && Math.abs(usMarket.nvdaChange) > 5 && usMarket.nvdaChange < 0) {
    reasons.push(`NVDA跌${usMarket.nvdaChange.toFixed(1)}%>5%`)
  }
  if (usMarket.tslaChange && Math.abs(usMarket.tslaChange) > 5 && usMarket.tslaChange < 0) {
    reasons.push(`TSLA跌${usMarket.tslaChange.toFixed(1)}%>5%`)
  }
  if (usMarket.vixClose && usMarket.vixClose > 30) {
    reasons.push(`VIX=${usMarket.vixClose.toFixed(1)}>30`)
  }

  return { triggered: reasons.length > 0, reasons }
}

// ============================================================
// 导出
// ============================================================
export {
  US_ANCHOR_MAP,
  US_TREND_RULES,
  US_ANCHOR_SCORE_MATRIX,
  US_EVENT_TRIGGER_MATRIX,
  US_EMPTY_POSITION_RULES,
  US_TRAFFIC_LIGHT_RULES,
  getUSAnchor,
  getAnchorScore,
  getStockAnchorScore,
  checkTrafficLight,
}
