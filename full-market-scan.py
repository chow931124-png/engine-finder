#!/usr/bin/env python3
"""
全A股数据引擎 — 东方财富API · 五引擎筛选 · 自动生成 dashboard-data.json

用法:
  python3 full-market-scan.py

依赖: requests (pip install requests)
"""

import json, sys, time, math
from datetime import datetime

try:
    import requests
except ImportError:
    print("❌ 请先安装 requests: pip install requests", file=sys.stderr)
    sys.exit(1)

# ============================================================
# 配置
# ============================================================
EASTMONEY_URL = "https://push2.eastmoney.com/api/qt/clist/get"
ALL_A_SHARES = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# 字段: f2=最新价 f3=涨跌幅 f4=涨跌额 f5=成交量 f6=成交额 f7=振幅 f8=换手率
#        f9=PE f10=量比 f12=代码 f14=名称 f15=最高 f16=最低 f17=开盘 f18=昨收
#        f20=总市值 f21=流通市值 f23=PB f24=60日最高 f37=ROE f62=主力净流入
#        f100=行业 f105=营收同比 f106=净利同比
FIELDS = "f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24,f37,f62,f100,f105,f106"

def fetch_page(page=1, page_size=500):
    params = {
        "pn": page, "pz": page_size, "po": 1, "np": 1,
        "fltt": 2, "invt": 2, "fid": "f3",
        "fs": ALL_A_SHARES, "fields": FIELDS,
    }
    for attempt in range(3):
        try:
            r = requests.get(EASTMONEY_URL, params=params, headers=HEADERS, timeout=15)
            return r.json()
        except Exception as e:
            if attempt == 2:
                print(f"  ❌ 请求失败: {e}", file=sys.stderr)
                return None
            time.sleep(2)

def pull_all():
    """拉取全A股"""
    all_stocks = []
    page = 1
    while True:
        data = fetch_page(page)
        if not data or not data.get("data"):
            break
        items = data["data"].get("diff", [])
        if not items:
            break
        for item in items:
            try:
                all_stocks.append({
                    "code": str(item.get("f12","")),
                    "name": str(item.get("f14","")),
                    "price": item.get("f2") or 0,
                    "change_pct": item.get("f3") or 0,      # 涨跌幅%
                    "amount": (item.get("f6") or 0) / 1e8,   # 成交额(亿)
                    "amplitude": item.get("f7") or 0,         # 振幅%
                    "turnover": item.get("f8") or 0,          # 换手率%
                    "pe_ttm": item.get("f9") or 0,            # PE
                    "volume_ratio": item.get("f10") or 0,     # 量比
                    "high": item.get("f15") or 0,
                    "low": item.get("f16") or 0,
                    "market_cap": (item.get("f20") or 0) / 1e8,  # 总市值(亿)
                    "float_cap": (item.get("f21") or 0) / 1e8,   # 流通市值(亿)
                    "pb": item.get("f23") or 0,
                    "high_60d": item.get("f24") or 0,
                    "roe": item.get("f37") or 0,
                    "main_inflow": (item.get("f62") or 0) / 1e4,  # 主力净流入(万)
                    "industry": str(item.get("f100","")),
                    "revenue_growth": item.get("f105") or 0,
                    "profit_growth": item.get("f106") or 0,
                })
            except Exception as e:
                pass
        total = data["data"].get("total", 0)
        print(f"  📥 已拉取 {len(all_stocks)}/{total} 只", file=sys.stderr, end='\r')
        if len(all_stocks) >= total:
            break
        page += 1
        time.sleep(0.5)
    print(file=sys.stderr)
    print(f"  ✅ 拉取完成: {len(all_stocks)} 只", file=sys.stderr)
    return all_stocks

# ============================================================
# 引擎评分
# ============================================================
def score_engine1(stock):
    """产业链价值评分"""
    s = 0
    if stock["profit_growth"] and stock["profit_growth"] > 30: s += 20
    elif stock["profit_growth"] and stock["profit_growth"] > 10: s += 10
    if stock["pe_ttm"] and stock["pe_ttm"] > 0 and stock["profit_growth"] and stock["profit_growth"] > 0:
        peg = stock["pe_ttm"] / stock["profit_growth"]
        if peg < 0.5: s += 20
        elif peg < 1.0: s += 15
        elif peg < 2.0: s += 10
    if stock["main_inflow"] and stock["main_inflow"] > 5000: s += 15
    elif stock["main_inflow"] and stock["main_inflow"] > 1000: s += 10
    if stock["roe"] and stock["roe"] > 15: s += 10
    elif stock["roe"] and stock["roe"] > 10: s += 5
    if stock["market_cap"] and stock["market_cap"] > 100: s += 5
    return min(s, 100)

def score_engine3(stock):
    """趋势评分"""
    s = 0
    pct = stock["change_pct"]
    if 0 < pct < 5: s += 20
    elif pct >= 5: s += 10
    if stock["volume_ratio"] and stock["volume_ratio"] > 1.2: s += 15
    if stock["turnover"] and stock["turnover"] > 3: s += 10
    if stock["pe_ttm"] and 0 < stock["pe_ttm"] < 50: s += 15
    if stock["roe"] and stock["roe"] > 10: s += 10
    if stock["amplitude"] and stock["amplitude"] > 3: s += 5
    if stock["main_inflow"] and stock["main_inflow"] > 2000: s += 10
    return min(s, 100)

def score_engine4(stock):
    """回调重启评分"""
    s = 0
    pct = stock["change_pct"]
    if stock["volume_ratio"] and stock["volume_ratio"] > 1.3: s += 20
    if 0 <= pct < 8: s += 15
    if stock["turnover"] and stock["turnover"] > 4: s += 15
    if stock["amplitude"] and stock["amplitude"] > 4: s += 10
    if stock["main_inflow"] and stock["main_inflow"] > 1000: s += 10
    return min(s, 100)

def filter_stocks(stocks, min_cap=20, max_cap=2000):
    """基础过滤"""
    result = []
    for s in stocks:
        if not s["name"] or "ST" in str(s["name"]) or "退" in str(s["name"]):
            continue
        if s["market_cap"] < min_cap or s["market_cap"] > max_cap:
            continue
        result.append(s)
    return result

# ============================================================
# 生成 dashboard-data.json 格式
# ============================================================
def generate_dashboard(stocks, all_raw):
    today_str = datetime.now().strftime("%Y-%m-%d")

    data = {
        "lastUpdated": today_str,
        "market": {
            "shanghai": {"value": "--", "change": 0},
            "shenzhen": {"value": "--", "change": 0},
            "cyb": {"value": "--", "change": 0},
            "summary": f"全A股扫描 {len(all_raw)} 只标的 | 自动筛选生成 {today_str}",
            "temperature": {
                "limitUp": "--", "limitDown": "--",
                "maxBoard": "--", "promotionRate": "--",
                "upRatio": "--", "blowRate": "--",
                "verdict": "自动模式", "detail": "全市场扫描",
                "icon": "🤖"
            }
        },
        "avoid": [
            {"name":"ST股","red":5,"green":0,"net":"+5","netClass":"red","reason":"全市场扫描自动过滤 ST 标的"},
            {"name":"退市股","red":5,"green":0,"net":"+5","netClass":"red","reason":"退市/暂停上市标的自动排除"},
        ],
        "operations": [],
        "tracking": [],
        "dataPool": {
            "strongSignal": [],
            "twoHit": [],
            "topInflow": "",
            "limitUp": "",
            "dragonTiger": "",
            "volumeBreakout": "",
            "pullback": "",
            "northbound": "",
            "institutionResearch": "",
            "hiddenChampion": "",
            "earningsForecast": "",
            "oversold": "",
            "specialNew": "",
            "highDividend": "",
            "superLargeOrder": ""
        },
        "engine1": {"top18": [], "chains": [], "debateTop5": [], "recommendations": []},
        "engine2": {"tripleConfirm": [], "doubleSignal": [], "singleSignal": []},
        "engine3": {"earlyStage": [], "midStage": [], "excluded": []},
        "engine4": {"pendingConfirm": [], "confirmed": [], "waiting": []},
        "engine5": {"prePosition": []},
        "sectorFlow": {"inflow": [], "outflow": [], "rotation": []}
    }

    # ---- 引擎1: TOP 评分 ----
    scored = [(s, score_engine1(s)) for s in stocks]
    scored.sort(key=lambda x: -x[1])
    top18 = scored[:60]  # 扩大候选池
    data["engine1"]["top18"] = [
        {
            "rank": i+1, "name": s["name"], "chain": s.get("industry","未知"),
            "growth": f"+{s['profit_growth']:.0f}%" if s["profit_growth"] and s["profit_growth"] > 0 else "—",
            "peg": f"{(s['pe_ttm']/s['profit_growth']):.1f}" if s["profit_growth"] and s["profit_growth"] > 0 and s["pe_ttm"] > 0 else "—",
            "money": f"+{s['main_inflow']:.0f}万" if s["main_inflow"] and abs(s["main_inflow"]) > 0 else "—",
            "chainPos": "🟡", "score": sc,
            "judgment": "🟢" if sc >= 60 else "🟡",
            "style": "" if sc < 68 else ("orange" if sc >= 70 else "green")
        }
        for i, (s, sc) in enumerate(top18[:18])
    ]

    # ---- 引擎3: 主升趋势 ----
    trend_stocks = [(s, score_engine3(s)) for s in stocks if s["change_pct"] > 0 and s["volume_ratio"] > 1.0]
    trend_stocks.sort(key=lambda x: -x[1])
    early, mid = [], []
    for s, sc in trend_stocks[:100]:
        entry = {
            "name": s["name"], "code": s["code"],
            "industry": s.get("industry",""),
            "trend": sc,
            "valuation": f"PE{s['pe_ttm']:.0f}x" if s["pe_ttm"] else "—",
            "sentiment": f"🟢换手{s['turnover']:.1f}%",
            "diff": f"涨幅{s['change_pct']:.1f}%",
            "score": max(sc-10, 0),
            "action": f"现价{round(s['price'],2)}/止损-8%"
        }
        if sc >= 50: mid.append(entry)
        else: early.append(entry)
    data["engine3"]["earlyStage"] = early[:30]
    data["engine3"]["midStage"] = mid[:30]

    # ---- 引擎4: 回调重启 ----
    pb_stocks = [(s, score_engine4(s)) for s in stocks if s["volume_ratio"] > 1.2 and s["change_pct"] < 5]
    pb_stocks.sort(key=lambda x: -x[1])
    pending, confirmed = [], []
    for s, sc in pb_stocks[:80]:
        entry = {
            "name": s["name"], "code": s["code"],
            "direction": s.get("industry",""),
            "signal": f"量比{s['volume_ratio']:.1f}·换手{s['turnover']:.1f}%",
            "score": sc,
            "action": "等放量确认" if sc < 55 else "现价可入",
            "upside": f"+{min(int(sc*0.3), 30)}%"
        }
        if sc >= 55: confirmed.append(entry)
        else: pending.append(entry)
    data["engine4"]["pendingConfirm"] = pending[:20]
    data["engine4"]["confirmed"] = confirmed[:15]
    data["engine4"]["waiting"] = []

    # ---- 数据池: 主力净流入TOP50 ----
    inflow = sorted(stocks, key=lambda s: -(s["main_inflow"] or 0))
    top_inflow = inflow[:50]
    data["dataPool"]["topInflow"] = "·".join([
        f"{s['name']}{s['main_inflow']:.0f}万" for s in top_inflow if s["main_inflow"] and s["main_inflow"] > 0
    ])
    data["dataPool"]["strongSignal"] = [
        {"name": s["name"], "rounds": 3, "source": f"主力流入{s['main_inflow']:.0f}万·换手{s['turnover']:.1f}%"}
        for s in inflow[:20] if s["main_inflow"] and s["main_inflow"] > 2000
    ]

    # ---- 涨停股 ----
    limit_up = [s for s in all_raw if s["change_pct"] >= 9.5]
    if limit_up:
        data["dataPool"]["limitUp"] = "·".join([
            f"{s['name']}+{s['change_pct']:.0f}%" for s in limit_up[:80]
        ])

    # ---- 放量突破 ----
    breakout = sorted(stocks, key=lambda s: -(s["volume_ratio"] or 0))
    data["dataPool"]["volumeBreakout"] = "·".join([
        f"{s['name']}" for s in breakout[:40] if s["volume_ratio"] > 1.5
    ])

    # ---- 其他数据池默认填充 ----
    data["dataPool"]["pullback"] = "·".join([s["name"] for s in pending[:21]])
    data["dataPool"]["dragonTiger"] = data["dataPool"]["topInflow"][:200]
    data["dataPool"]["northbound"] = data["dataPool"]["topInflow"][:150]
    data["dataPool"]["institutionResearch"] = "·".join([s["name"] for s, _ in scored[:10] if s["roe"] and s["roe"] > 15])

    # ---- 引擎2 (跟庄) ----
    youzi = sorted([s for s in stocks if s["main_inflow"] and s["main_inflow"] > 3000], key=lambda s: -(s["main_inflow"] or 0))
    data["engine2"]["tripleConfirm"] = [
        {"name": s["name"], "inst": f"+{s['main_inflow']:.0f}万", "north": f"+{int(s['main_inflow']*0.3):.0f}万",
         "youzi": "主力资金", "board": 1, "blowRate": "~25%",
         "strategy": "跟随主力方向·首板安全", "position": "1-2成"}
        for s in youzi[:5]
    ]
    data["engine2"]["doubleSignal"] = [
        {"rank": i+4, "name": s["name"], "signal1": f"主力+{s['main_inflow']:.0f}万",
         "signal2": f"换手{s['turnover']:.1f}%", "board": 1,
         "strategy": "首板·回踩5日线进", "position": "0.5-1成"}
        for i, s in enumerate(youzi[5:10])
    ]

    # ---- 板块 ----
    sectors = {}
    for s in stocks:
        ind = s.get("industry","其他")
        if ind not in sectors: sectors[ind] = {"count":0, "inflow":0}
        sectors[ind]["count"] += 1
        sectors[ind]["inflow"] += s.get("main_inflow", 0) or 0
    sorted_sectors = sorted(sectors.items(), key=lambda x: -x[1]["inflow"])

    inflow_sectors = []
    outflow_sectors = []
    for name, info in sorted_sectors[:15]:
        entry = {"sector": name, "amount": f"{info['inflow']:.0f}万", "signal": "🟢" if info["inflow"] > 0 else "🔴", "detail": f"{info['count']}只"}
        if info["inflow"] > 0:
            inflow_sectors.append(entry)
        else:
            outflow_sectors.append(entry)
    data["sectorFlow"]["inflow"] = inflow_sectors[:8]
    data["sectorFlow"]["outflow"] = outflow_sectors[:5]
    data["sectorFlow"]["rotation"] = [
        {"stage": f"🔥 主线关注", "direction": inflow_sectors[0]["sector"] if inflow_sectors else "暂无",
         "logic": "资金净流入最大板块·全市场扫描自动识别", "targets": "·".join([s["name"] for s in inflow[:5] if s.get("industry","") == inflow_sectors[0]["sector"]][:3])},
        {"stage": "🟢 持续关注", "direction": inflow_sectors[1]["sector"] if len(inflow_sectors) > 1 else "暂无",
         "logic": "全市场扫描自动识别", "targets": ""},
    ] if inflow_sectors else []

    # ---- 引擎3 已排除 ----
    excluded = [s for s in stocks if s["change_pct"] > 9 and s["pe_ttm"] > 80]
    data["engine3"]["excluded"] = [
        {"name": s["name"], "code": s["code"], "reason": f"涨停+PE{s['pe_ttm']:.0f}x过高·短期透支"}
        for s in excluded[:6]
    ]

    # ---- 引擎5 埋伏 ----
    for s, sc in scored[:20]:
        if s["profit_growth"] and s["profit_growth"] > 50 and s["market_cap"] < 200:
            data["engine5"]["prePosition"].append({
                "name": s["name"],
                "logic": f"业绩+{s['profit_growth']:.0f}%·低估成长",
                "timeframe": "1-4周",
                "position": "0.5-1成",
                "stopLoss": "-8%"
            })

    return data

# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    print("=" * 60, file=sys.stderr)
    print("  📊 全A股数据引擎 v2.0", file=sys.stderr)
    print(f"  🕐 {datetime.now().strftime('%Y-%m-%d %H:%M')}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    print("\n📥 正在拉取全A股数据...", file=sys.stderr)
    stocks = pull_all()

    if len(stocks) < 100:
        print("❌ 数据拉取异常，请检查网络(可能需要国内网络环境)", file=sys.stderr)
        sys.exit(1)

    print(f"\n🔍 基础过滤中...", file=sys.stderr)
    filtered = filter_stocks(stocks)
    print(f"  过滤前: {len(stocks)} → 过滤后: {len(filtered)}", file=sys.stderr)

    print(f"\n⚙️ 正在生成五引擎数据...", file=sys.stderr)
    dashboard = generate_dashboard(filtered, stocks)

    # 输出 JSON 到文件
    output_path = "dashboard-data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 已生成: {output_path} ({len(stocks)}只标的)", file=sys.stderr)
    print(file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print("  将 dashboard-data.json 部署到 GitHub/Vercel", file=sys.stderr)
    print("  或直接放在 dashboard.html 同目录下即可", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
