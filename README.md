# 🧠 A股五引擎选股系统

## 项目简介

基于Claude Code的A股量化选股系统，五个引擎互补交叉验证：

| 引擎 | 功能 | 时间维度 |
|------|------|---------|
| 🔬 引擎1 | Serenity深度辩论·产业链唯一性评分 | 中长期 |
| 🎯 引擎2 | 聪明钱投机·龙虎榜跟庄·流量灯过滤 | T+1~T+3 |
| 📈 引擎3 | 主升趋势中继·均线多头+量价配合 | 1-4周 |
| 🔄 引擎4 | 回调重启·缩量止跌+放量企稳 | 1-4周 |
| 🌍 引擎5 | 宏观事件驱动·政策+科技+国际大事 | 1周-3月+ |

### 核心机制

- 🚦 **流量灯过滤**: 4连板+换手>18%/RSI>85/假机构/公司澄清 → 自动排除
- 🔑 **唯一性评分**: A股有没有替代品？找不到=加分
- 📊 **预测概率**: 主力资金+龙虎榜+技术突破 → 明日上涨概率
- ⚖️ **矛盾仲裁**: 情绪周期+宏观风险 → 自动调仓

---

## 安装步骤

### 1. 安装 Claude Code

VSCode 扩展商店搜索 "Claude Code" → 安装

### 2. 配置 MCP 数据源

在用户目录创建 `~/.mcp.json`：

```json
{
  "mcpServers": {
    "akshare-one": {
      "command": "uvx",
      "args": ["akshare-one-mcp"]
    }
  }
}
```

### 3. 复制工作流文件

将本文件夹内所有文件复制到：

```
~/.claude/workflows/
```

### 4. 打开仪表盘

```bash
open ~/.claude/workflows/dashboard.html
```

### 5. 每日更新

在 Claude Code 对话中说：

> "更新今天的股票筛选"

系统自动跑13轮搜索→更新全部引擎→刷新仪表盘。

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `dashboard.html` | 主仪表盘·浏览器打开 |
| `stock-screener.js` | 引擎1·深度辩论 |
| `stock-screener-smart-money.js` | 引擎2·聪明钱投机 |
| `stock-screener-trend.js` | 引擎3·趋势中继 |
| `stock-screener-pullback.js` | 引擎4·回调重启 |
| `stock-screener-macro.js` | 引擎5·宏观驱动 |
| `stock-debate.js` | 单标辩论引擎 |
| `shared-utils.js` | 共享模块(情绪+游资+炸板+仲裁) |
| `performance.js` | 绩效分析+自动优化 |
| `trade-log.json` | 交易记录(盈亏跟踪) |
| `hard-filter-rules.md` | 流量灯过滤规则 |
| `universal-ranker.md` | 统一评分模型 |

---

## 注意事项

- 引擎工作流需要 **Claude Sonnet 模型**才能一键运行（DeepSeek不兼容子agent）
- 日常分析用DeepSeek完全OK，手动搜索+仪表盘更新
- 东财API盘后可能限流，WebSearch为主要数据源(13轮搜索覆盖~700只)
- 仪表盘每天更新后刷新浏览器即可看到最新数据

## ⚠️ 风险声明

本系统仅供学习参考，不构成投资建议。A股有风险，入市需谨慎。
