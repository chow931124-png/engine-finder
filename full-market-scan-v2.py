#!/usr/bin/env python3
"""
全A股扫描器 — 腾讯股票API版本（海外可运行）
"""
import urllib.request, json, time, sys, os
from datetime import datetime

HEADERS = {"User-Agent": "Mozilla/5.0"}
TENCENT_URL = "https://qt.gtimg.cn/q="

# A股代码范围
RANGES = [
    ("sh", 600000, 605999, "上证主板"),
    ("sh", 688000, 689999, "科创板"),
    ("sz", 0, 3999, "深证主板"),
    ("sz", 300000, 301999, "创业板"),
    ("sz", 2000, 2999, "中小板"),
]

def query(codes):
    url = TENCENT_URL + ",".join(codes)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("gbk")
    except Exception as e:
        print(f"  ⚠️ 查询失败: {e}", file=sys.stderr)
        return None

def parse_line(line):
    """解析腾讯API返回的一行数据"""
    parts = line.split("~")
    if len(parts) < 4:
        return None
    try:
        name = parts[1]
        code = parts[2]
        price = float(parts[3]) if parts[3] else 0
        if price == 0 or not name:
            return None
        # 过滤退市/ST
        if any(kw in name for kw in ["退", "ST", "停止上市"]):
            return None

        prev_close = float(parts[4]) if parts[4] else price
        change_pct = round((price - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0
        high = float(parts[5]) if parts[5] else price
        low = float(parts[6]) if parts[6] else price
        volume = int(parts[7]) if parts[7] else 0
        amount = round(float(parts[9]) if parts[9] else 0, 2)
        turnover = float(parts[10]) if len(parts) > 10 and parts[10] else 0
        pe = float(parts[11]) if len(parts) > 11 and parts[11] else 0
        amplitude = float(parts[12]) if len(parts) > 12 and parts[12] else 0
        market_cap = round(float(parts[45]) if len(parts) > 45 and parts[45] else 0 / 1e8, 2)
        pb = float(parts[46]) if len(parts) > 46 and parts[46] else 0

        return {
            "code": code,
            "name": name,
            "price": price,
            "change_pct": change_pct,
            "high": high,
            "low": low,
            "volume": volume,
            "amount": amount,
            "turnover": turnover,
            "pe_ttm": pe,
            "amplitude": amplitude,
            "market_cap": market_cap,
            "pb": pb,
            "prev_close": prev_close,
        }
    except:
        return None

def scan_all():
    """全量扫描"""
    all_stocks = []
    total_checked = 0

    for prefix, start, end, label in RANGES:
        batch = []
        for i in range(start, end + 1):
            code_str = f"{prefix}{i:06d}" if prefix == "sh" or i >= 1000 else f"{prefix}{i:04d}"
            batch.append(code_str)
            total_checked += 1

            if len(batch) >= 80:
                text = query(batch)
                if text:
                    for line in text.strip().split("\n"):
                        s = parse_line(line)
                        if s:
                            all_stocks.append(s)
                print(f"  📊 {label}: 已扫描{total_checked}只, 找到{len(all_stocks)}只活跃", file=sys.stderr, end='\r')
                batch = []
                time.sleep(0.3)

        # 处理剩余
        if batch:
            text = query(batch)
            if text:
                for line in text.strip().split("\n"):
                    s = parse_line(line)
                    if s:
                        all_stocks.append(s)
        print(f"\n  ✅ {label}完成", file=sys.stderr)

    print(f"\n  📈 总计: 扫描{total_checked}只, 找到{len(all_stocks)}只活跃股票", file=sys.stderr)
    return all_stocks

def generate_dashboard(stocks):
    """生成dashboard-data.json"""
    today = datetime.now().strftime("%Y-%m-%d")

    data = {
        "lastUpdated": today,
        "market": {
            "shanghai": {"value": "--", "change": 0},
            "shenzhen": {"value": "--", "change": 0},
            "cyb": {"value": "--", "change": 0},
            "summary": f"全A股扫描 {len(stocks)} 只标的 | 腾讯数据源 {today}",
            "temperature": {
                "limitUp": "--", "limitDown": "--", "maxBoard": "--",
                "promotionRate": "--", "upRatio": "--", "blowRate": "--",
                "verdict": "自动模式", "detail": "全市场扫描", "icon": "🤖"
            }
        },
        "avoid": [],
        "operations": [], "tracking": [],
        "dataPool": {
            "strongSignal": [], "twoHit": [],
            "topInflow": "", "limitUp": "", "dragonTiger": "",
            "volumeBreakout": "", "pullback": "",
            "northbound": "", "institutionResearch": "",
            "hiddenChampion": "", "earningsForecast": "", "oversold": "",
            "specialNew": "", "highDividend": "", "superLargeOrder": ""
        },
        "engine1": {"top18": [], "chains": [], "debateTop5": [], "recommendations": []},
        "engine2": {"tripleConfirm": [], "doubleSignal": [], "singleSignal": []},
        "engine3": {"earlyStage": [], "midStage": [], "excluded": []},
        "engine4": {"pendingConfirm": [], "confirmed": [], "waiting": []},
        "engine5": {"prePosition": []},
        "sectorFlow": {"inflow": [], "outflow": [], "rotation": []}
    }

    # 筛选有意义的标的(min_cap > 10亿)
    active = [s for s in stocks if s.get("market_cap", 0) >= 10]

    # 引擎1: 综合评分
    scored = []
    for s in active:
        score = 0
        if s["pe_ttm"] and s["pe_ttm"] > 0:
            if s["pe_ttm"] < 30: score += 20
            elif s["pe_ttm"] < 60: score += 10
        if s["change_pct"] and s["change_pct"] > 2: score += 15
        if s["market_cap"] and s["market_cap"] > 100: score += 10
        if s["turnover"] and s["turnover"] > 3: score += 10
        if s["amplitude"] and s["amplitude"] > 3: score += 5
        scored.append((s, min(score, 100)))

    scored.sort(key=lambda x: -x[1])

    # TOP18
    data["engine1"]["top18"] = []
    for i, (s, sc) in enumerate(scored[:18]):
        data["engine1"]["top18"].append({
            "rank": i+1, "name": s["name"], "chain": "综合",
            "growth": f"+{s['change_pct']:.1f}%" if s["change_pct"] > 0 else f"{s['change_pct']:.1f}%",
            "peg": f"{s['pe_ttm']:.1f}" if s["pe_ttm"] > 0 else "—",
            "money": f"{s['amount']:.1f}亿" if s["amount"] > 0 else "—",
            "chainPos": "🟡", "score": sc,
            "judgment": "🟢" if sc >= 60 else "🟡",
            "style": "green" if sc >= 68 else ""
        })

    # 数据池: 主力流入TOP50 (腾讯API没有主力流入, 用量比替代)
    vol_ranked = sorted(active, key=lambda s: -(s.get("turnover", 0) or 0))
    data["dataPool"]["topInflow"] = "·".join([
        f"{s['name']}{s['turnover']:.1f}%" for s in vol_ranked[:50]
    ])

    # 涨停股
    limit_up = [s for s in active if s["change_pct"] >= 9.5]
    if limit_up:
        data["dataPool"]["limitUp"] = "·".join([
            f"{s['name']}+{s['change_pct']:.0f}%" for s in limit_up[:80]
        ])

    # 放量突破 (换手率高的)
    breakout = sorted(active, key=lambda s: -(s.get("turnover", 0) or 0))
    data["dataPool"]["volumeBreakout"] = "·".join([s["name"] for s in breakout[:40]])

    # 强信号
    data["dataPool"]["strongSignal"] = [
        {"name": s[0]["name"], "rounds": 3, "source": f"换手{s[0]['turnover']:.1f}%·PE{s[0]['pe_ttm']:.0f}"}
        for s in scored[:20] if s[1] >= 50
    ]

    # 引擎3
    early, mid = [], []
    for s, sc in scored:
        if sc < 30: continue
        entry = {
            "name": s["name"], "code": s["code"],
            "industry": "综合", "trend": sc,
            "valuation": f"PE{s['pe_ttm']:.0f}x" if s["pe_ttm"] else "—",
            "sentiment": f"🟢换手{s['turnover']:.1f}%",
            "diff": f"涨幅{s['change_pct']:.1f}%",
            "score": sc, "action": f"现价{round(s['price'],2)}/止损-8%"
        }
        if sc >= 50: mid.append(entry)
        else: early.append(entry)
    data["engine3"]["earlyStage"] = early[:30]
    data["engine3"]["midStage"] = mid[:30]

    # 引擎4
    pb_stocks = [s for s in active if s["change_pct"] < 3 and s["turnover"] > 2]
    pb_stocks.sort(key=lambda s: -(s.get("turnover", 0) or 0))
    confirmed = [{
        "name": s["name"], "code": s["code"],
        "direction": "综合", "signal": f"换手{s['turnover']:.1f}%·温和放量",
        "score": min(int(s.get("turnover", 0) or 0) * 10, 80),
        "action": "放量确认", "upside": "+15%"
    } for s in pb_stocks[:15]]
    data["engine4"]["confirmed"] = confirmed

    # 引擎5
    cheap_growth = [s for s in active if s["pe_ttm"] and 0 < s["pe_ttm"] < 40 and s["change_pct"] > -2]
    cheap_growth.sort(key=lambda s: s["pe_ttm"])
    data["engine5"]["prePosition"] = [{
        "name": s["name"], "logic": f"PE{s['pe_ttm']:.0f}x·低估值",
        "timeframe": "1-4周", "position": "0.5成", "stopLoss": "-8%"
    } for s in cheap_growth[:10]]

    # 板块 (腾讯无行业字段)
    sc = active[:5]
    data["sectorFlow"]["inflow"] = [
        {"sector": "活跃板块", "amount": f"{s['amount']:.1f}亿", "signal": "🟢", "detail": f"{s['name']}"}
        for s in sc
    ]
    data["sectorFlow"]["rotation"] = [
        {"stage": "🔥 当前活跃", "direction": "综合", "logic": "全市场扫描自动识别", "targets": "·".join([s[0]["name"] for s in scored[:5]])},
    ]

    return data

if __name__ == "__main__":
    print("📊 全A股扫描 (腾讯API)", file=sys.stderr)
    print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M')}", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    stocks = scan_all()

    if len(stocks) < 100:
        print(f"❌ 数据不足: 仅{len(stocks)}只", file=sys.stderr)
        sys.exit(1)

    print(f"\n🔍 生成仪表盘数据...", file=sys.stderr)
    dashboard = generate_dashboard(stocks)

    path = "dashboard-data.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 完成! 生成 {path}", file=sys.stderr)
    print(f"   扫描 {len(stocks)} 只活跃股票", file=sys.stderr)
    print(f"   文件大小: {os.path.getsize(path)//1024}KB", file=sys.stderr)
