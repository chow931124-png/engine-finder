#!/usr/bin/env python3
"""
全A股扫描器 v3.0 — 五引擎独立评分系统
腾讯股票API + 独立评分逻辑 + 各引擎间区分度最大化
"""
import urllib.request, json, time, sys, os
from datetime import datetime

HEADERS = {"User-Agent": "Mozilla/5.0"}
TENCENT_URL = "https://qt.gtimg.cn/q="

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
    except:
        return None

def parse_line(line):
    """解析腾讯API返回的股票数据，含60日最高价"""
    parts = line.split("~")
    if len(parts) < 4:
        return None
    try:
        name = parts[1]
        code = parts[2]
        price = float(parts[3]) if parts[3] else 0
        if price == 0 or not name:
            return None
        if any(kw in name for kw in ["退", "ST", "停止上市"]):
            return None

        prev_close = float(parts[4]) if parts[4] else price
        change_pct = round((price - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0
        high = float(parts[5]) if parts[5] else price
        low = float(parts[6]) if parts[6] else price
        volume = int(parts[7]) if parts[7] else 0           # 成交量(手)
        amount = round(float(parts[9]) if parts[9] else 0, 2)  # 成交额(万)
        turnover = float(parts[10]) if len(parts) > 10 and parts[10] else 0  # 换手率%
        pe = float(parts[11]) if len(parts) > 11 and parts[11] else 0
        amplitude = float(parts[12]) if len(parts) > 12 and parts[12] else 0  # 振幅%
        market_cap = float(parts[45]) if len(parts) > 45 and parts[45] else 0  # 总市值
        pb = float(parts[46]) if len(parts) > 46 and parts[46] else 0
        high_60d = float(parts[48]) if len(parts) > 48 and parts[48] else 0  # 60日最高

        return {
            "code": code, "name": name,
            "price": price, "change_pct": change_pct,
            "high": high, "low": low,
            "volume": volume, "amount": amount,
            "turnover": turnover, "pe_ttm": pe,
            "amplitude": amplitude, "market_cap": market_cap,
            "pb": pb, "high_60d": high_60d,
            "prev_close": prev_close,
        }
    except:
        return None

def scan_all():
    """全量扫描A股"""
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
                        if s: all_stocks.append(s)
                print(f"  📊 {label}: {len(all_stocks)}只活跃", file=sys.stderr, end='\r')
                batch = []
                time.sleep(0.3)
        if batch:
            text = query(batch)
            if text:
                for line in text.strip().split("\n"):
                    s = parse_line(line)
                    if s: all_stocks.append(s)
        print(f"\n  ✅ {label} 完成", file=sys.stderr)
    print(f"\n  📈 总计: {len(all_stocks)}只活跃股票", file=sys.stderr)
    return all_stocks

# ============================================================
# 五引擎独立评分系统
# ============================================================

def engine1_score(s):
    """🔬 引擎1：基本面价值评分
    核心逻辑：低估值 + 价值发现 + 大盘稳健
    指标: PE(负相关), PB, 市值稳定性, 涨幅 умеренность
    """
    sc = 0
    # PE估值（核心）
    if s["pe_ttm"] and s["pe_ttm"] > 0:
        if s["pe_ttm"] < 15: sc += 30
        elif s["pe_ttm"] < 25: sc += 24
        elif s["pe_ttm"] < 40: sc += 16
        elif s["pe_ttm"] < 60: sc += 8
    # PB市净率
    if s["pb"] and s["pb"] > 0:
        if s["pb"] < 1.5: sc += 15
        elif s["pb"] < 3: sc += 10
        elif s["pb"] < 5: sc += 5
    # 市值(中大盘偏好)
    if s["market_cap"] > 500: sc += 15
    elif s["market_cap"] > 100: sc += 10
    elif s["market_cap"] > 30: sc += 5
    # 波动率低(稳健)
    if s["amplitude"] and 1 < s["amplitude"] < 5: sc += 10
    # 温和上涨(价值发现)
    if s["change_pct"] and 0 < s["change_pct"] < 4: sc += 10
    elif s["change_pct"] and -2 < s["change_pct"] <= 0: sc += 5
    # 换手适中
    if s["turnover"] and 1 < s["turnover"] < 8: sc += 10
    # 成交活跃度
    if s["amount"] and s["amount"] > 5000: sc += 10
    elif s["amount"] and s["amount"] > 1000: sc += 5
    return min(sc, 100)


def engine2_score(s):
    """🎯 引擎2：聪明钱资金面评分
    核心逻辑：主力资金活跃 + 放量 + 高换手 + 振幅大
    指标: 成交额, 换手率, 振幅, 涨幅, 量价配合
    """
    sc = 0
    # 成交额(大资金入场信号)
    if s["amount"] and s["amount"] > 10000: sc += 20
    elif s["amount"] and s["amount"] > 5000: sc += 15
    elif s["amount"] and s["amount"] > 2000: sc += 10
    elif s["amount"] and s["amount"] > 500: sc += 5
    # 换手率(游资活跃信号)
    if s["turnover"] and s["turnover"] > 8: sc += 20
    elif s["turnover"] and s["turnover"] > 5: sc += 15
    elif s["turnover"] and s["turnover"] > 3: sc += 10
    elif s["turnover"] and s["turnover"] > 1: sc += 5
    # 振幅(多空博弈)
    if s["amplitude"] and s["amplitude"] > 6: sc += 15
    elif s["amplitude"] and s["amplitude"] > 4: sc += 10
    elif s["amplitude"] and s["amplitude"] > 2: sc += 5
    # 量价配合：放量上涨
    if s["turnover"] and s["turnover"] > 3 and s["change_pct"] and s["change_pct"] > 2: sc += 15
    # 价格方向
    if s["change_pct"] and s["change_pct"] > 3: sc += 10
    elif s["change_pct"] and s["change_pct"] > 0: sc += 5
    # 成交量放大(手数)
    if s["volume"] and s["volume"] > 500000: sc += 10
    elif s["volume"] and s["volume"] > 100000: sc += 5
    # 中小盘偏好(游资偏好)
    if s["market_cap"] and 20 < s["market_cap"] < 200: sc += 10
    return min(sc, 100)


def engine3_score(s):
    """📈 引擎3：主升趋势评分
    核心逻辑：上升趋势 + 量价配合 + 未过热
    指标: 涨幅(温和), 换手+量比, PE未透支, 振幅健康
    """
    sc = 0
    # 涨幅适中(正在涨但没涨完)
    if s["change_pct"] and 2 < s["change_pct"] < 7: sc += 25
    elif s["change_pct"] and 0 < s["change_pct"] <= 2: sc += 15
    elif s["change_pct"] and 7 <= s["change_pct"] < 9.5: sc += 10  # 快涨停了，追高风险
    # 量能配合
    if s["turnover"] and s["turnover"] > 3: sc += 15
    elif s["turnover"] and s["turnover"] > 1.5: sc += 10
    if s["volume"] and s["volume"] > 50000: sc += 5
    # PE未透支
    if s["pe_ttm"] and s["pe_ttm"] > 0:
        if s["pe_ttm"] < 30: sc += 15
        elif s["pe_ttm"] < 50: sc += 10
        elif s["pe_ttm"] < 80: sc += 5
    # 振幅健康(有弹性但不失控)
    if s["amplitude"] and 2 < s["amplitude"] < 6: sc += 10
    # 市值适中(趋势股偏好)
    if s["market_cap"] and 50 < s["market_cap"] < 500: sc += 10
    elif s["market_cap"] and 30 < s["market_cap"] <= 50: sc += 5
    # 成交额适中(非庄股)
    if s["amount"] and s["amount"] > 1000: sc += 10
    elif s["amount"] and s["amount"] > 300: sc += 5
    # 涨停排除(连板后风险大)
    if s["change_pct"] and s["change_pct"] >= 9.5: sc -= 20
    return max(min(sc, 100), 0)


def engine4_score(s):
    """🔄 引擎4：回调重启评分
    核心逻辑：曾强势→回撤充分→止跌→放量反弹
    指标: 回撤深度, 换手止跌, 放量信号, PE合理
    """
    # 计算距前高回撤
    if s["high_60d"] and s["high_60d"] > 0 and s["price"] > 0:
        drawdown = round((1 - s["price"] / s["high_60d"]) * 100, 1)
    else:
        drawdown = s["change_pct"] if s["change_pct"] < 0 else 0

    sc = 0
    # 回撤深度(10-35%最理想)
    if 10 <= drawdown <= 35: sc += 30
    elif 5 <= drawdown < 10: sc += 20
    elif 35 < drawdown <= 50: sc += 15  # 超跌但可能继续跌
    elif drawdown > 50: sc += 5  # 超跌严重，等企稳再评估

    # 开始止跌(跌幅收窄或转正)
    if s["change_pct"] and s["change_pct"] > 0: sc += 15  # 今天反弹
    elif s["change_pct"] and -2 < s["change_pct"] <= 0: sc += 10  # 跌幅收窄
    elif s["change_pct"] and -5 < s["change_pct"] <= -2: sc += 5

    # 放量信号
    if s["turnover"] and s["turnover"] > 4: sc += 15
    elif s["turnover"] and s["turnover"] > 2: sc += 10
    elif s["turnover"] and s["turnover"] > 1: sc += 5

    # 振幅(分歧转一致)
    if s["amplitude"] and s["amplitude"] > 4: sc += 10
    elif s["amplitude"] and s["amplitude"] > 2: sc += 5

    # PE合理(回调后价值凸显)
    if s["pe_ttm"] and 0 < s["pe_ttm"] < 50: sc += 15
    elif s["pe_ttm"] and s["pe_ttm"] < 100: sc += 5

    # 市值(中小盘弹性大)
    if s["market_cap"] and 20 < s["market_cap"] < 300: sc += 10
    elif s["market_cap"] and 10 < s["market_cap"] <= 20: sc += 5

    return min(sc, 100)


def engine5_score(s):
    """🌍 引擎5：低估埋伏评分
    核心逻辑：低估值/低关注 + 有安全边际 + 等待催化
    指标: PE极低, 换手低(无人问津), PB低, 下跌有限
    """
    sc = 0
    # PE极低(安全边际)
    if s["pe_ttm"] and s["pe_ttm"] > 0:
        if s["pe_ttm"] < 10: sc += 30
        elif s["pe_ttm"] < 20: sc += 25
        elif s["pe_ttm"] < 30: sc += 20
        elif s["pe_ttm"] < 50: sc += 10

    # PB破净或接近
    if s["pb"] and s["pb"] > 0:
        if s["pb"] < 1: sc += 20  # 破净
        elif s["pb"] < 1.5: sc += 15
        elif s["pb"] < 3: sc += 8

    # 低关注度(换手低)
    if s["turnover"] and s["turnover"] < 2: sc += 15
    elif s["turnover"] and s["turnover"] < 4: sc += 8

    # 下跌空间有限
    if s["change_pct"] and -3 < s["change_pct"] < 1: sc += 10
    elif s["change_pct"] and s["change_pct"] <= -3: sc += 5  # 已跌，反弹空间

    # 大市值(防御)
    if s["market_cap"] and s["market_cap"] > 200: sc += 10
    elif s["market_cap"] and s["market_cap"] > 50: sc += 5

    # 红利潜力(PB低+PE低)
    if s["pb"] and s["pe_ttm"] and s["pb"] < 1.5 and s["pe_ttm"] < 20: sc += 10

    # 高股息(0振幅接近于0, 稳定)
    if s["amplitude"] and s["amplitude"] < 2: sc += 5

    return min(sc, 100)


# ============================================================
# 各个引擎排序与输出
# ============================================================

def tag_stock(s, scores, engine_mark):
    """给标的打上引擎标签"""
    return {
        "name": s["name"], "code": s["code"],
        "price": round(s["price"], 2),
        "change_pct": s["change_pct"],
        "pe": round(s["pe_ttm"], 1) if s["pe_ttm"] else 0,
        "pb": round(s["pb"], 2) if s["pb"] else 0,
        "turnover": s["turnover"],
        "amount": s["amount"],
        "market_cap": round(s["market_cap"] / 1e8, 1) if s["market_cap"] else 0,
        "amplitude": s["amplitude"],
        "score": scores,
        "engine": engine_mark,
    }

def generate_dashboard(stocks):
    today = datetime.now().strftime("%Y-%m-%d")

    # 计算每个引擎的独立评分
    e1 = [(s, engine1_score(s)) for s in stocks]
    e2 = [(s, engine2_score(s)) for s in stocks]
    e3 = [(s, engine3_score(s)) for s in stocks]
    e4 = [(s, engine4_score(s)) for s in stocks]
    e5 = [(s, engine5_score(s)) for s in stocks]

    e1.sort(key=lambda x: -x[1])
    e2.sort(key=lambda x: -x[1])
    e3.sort(key=lambda x: -x[1])
    e4.sort(key=lambda x: -x[1])
    e5.sort(key=lambda x: -x[1])

    # 找出"多引擎共振"的标的（>=3个引擎高分）
    all_tagged = []
    for s in stocks:
        scores = {
            "e1": engine1_score(s),
            "e2": engine2_score(s),
            "e3": engine3_score(s),
            "e4": engine4_score(s),
            "e5": engine5_score(s),
        }
        high = sum(1 for v in scores.values() if v >= 60)
        all_tagged.append((s, scores, high))
    all_tagged.sort(key=lambda x: -x[2])

    data = {
        "lastUpdated": today,
        "market": {
            "shanghai": {"value": "--", "change": 0},
            "shenzhen": {"value": "--", "change": 0},
            "cyb": {"value": "--", "change": 0},
            "summary": f"全A股 {len(stocks)} 只 · 腾讯数据 · 五引擎独立评分 {today}",
            "temperature": {
                "limitUp": "--", "limitDown": "--", "maxBoard": "--",
                "promotionRate": "--", "upRatio": "--", "blowRate": "--",
                "verdict": "自动扫描", "detail": "五引擎独立评分", "icon": "🤖"
            }
        },
        "avoid": [],
        "operations": [],
        "tracking": [],
        "dataPool": {
            "strongSignal": [],
            "twoHit": [
                {"name": s["name"], "signal": f"引擎1={sc['e1']}·引擎2={sc['e2']}·引擎3={sc['e3']}"}
                for s, sc, _ in all_tagged[:20] if sc["e1"] >= 50 or sc["e2"] >= 50
            ],
            "topInflow": "·".join([f"{s['name']}(换手{s['turnover']:.1f}%)" for s, _ in e2[:50] if s["turnover"] > 2]),
            "limitUp": "",
            "dragonTiger": "·".join([f"{s['name']}+{s['change_pct']:.1f}%" for s, _ in e2[:20] if s["change_pct"] > 5]),
            "volumeBreakout": "·".join([f"{s['name']}" for s, _ in e3[:40]]),
            "pullback": "·".join([f"{s['name']}" for s, _ in e4[:21]]),
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

    # ---- 引擎1: TOP 基本面价值 ----
    top_e1 = [tag_stock(s, sc, "引擎1") for s, sc in e1[:18]]
    data["engine1"]["top18"] = [{
        "rank": i+1, "name": t["name"],
        "chain": f"PE{t['pe']}x/PB{t['pb']}",
        "growth": f"{t['change_pct']:+.1f}%",
        "peg": f"{t['pe']:.1f}" if t["pe"] else "—",
        "money": f"{t['amount']:.0f}万" if t["amount"] else "—",
        "chainPos": "🟡", "score": t["score"],
        "judgment": "🟢" if t["score"] >= 65 else "🟡",
        "style": "green" if t["score"] >= 65 else ""
    } for i, t in enumerate(top_e1)]

    # 引擎1: 辩论/推荐用前5
    data["engine1"]["debateTop5"] = [{
        "rank": ["🥇","🥈","🥉","4","5"][i],
        "name": t["name"], "score": t["score"], "verdict": "pass",
        "chain": f"PE{t['pe']}x·PB{t['pb']}·市值{t['market_cap']:.0f}亿",
        "attack": "",
        "rebuttal": "",
        "insight": f"换手{t['turnover']:.1f}%·振幅{t['amplitude']:.1f}%·涨幅{t['change_pct']:+.1f}%",
        "conviction": "高" if t["score"] >= 70 else "中",
        "position": f"{min(t['score']//10, 6)}成",
        "entry": f"现价{t['price']}",
        "stopLoss": f"-{min(t['score']*0.15, 10):.0f}%"
    } for i, t in enumerate(top_e1[:5])]

    data["engine1"]["recommendations"] = [{
        "priority": ["🥇","🥈","🥉","4","💎"][i],
        "name": t["name"], "score": t["score"],
        "conviction": "高" if t["score"] >= 70 else "中",
        "position": f"{min(t['score']//10, 6)}成",
        "entry": f"现价{t['price']}",
        "logic": f"PE{t['pe']}x·PB{t['pb']}·市值{t['market_cap']:.0f}亿"
    } for i, t in enumerate(top_e1[:5])]

    # 数据池: 强信号 = 多引擎共振
    data["dataPool"]["strongSignal"] = [
        {"name": s["name"], "rounds": h, "source": f"引擎1={sc['e1']}·2={sc['e2']}·3={sc['e3']}"}
        for s, sc, h in all_tagged[:20] if h >= 3
    ]

    # 涨停股
    limit_ups = [s for s in stocks if s["change_pct"] >= 9.5]
    if limit_ups:
        data["dataPool"]["limitUp"] = "·".join([f"{s['name']}+{s['change_pct']:.1f}%" for s in limit_ups[:80]])

    # ---- 引擎2: 聪明钱 ----
    top_e2 = [tag_stock(s, sc, "引擎2") for s, sc in e2[:15]]
    # 三方共振(=高评分)
    data["engine2"]["tripleConfirm"] = [{
        "name": t["name"],
        "inst": f"成交{t['amount']:.0f}万" if t["amount"] > 0 else "—",
        "north": f"换手{t['turnover']:.1f}%" if t["turnover"] else "—",
        "youzi": f"振幅{t['amplitude']:.1f}%",
        "board": 1, "blowRate": "~25%",
        "strategy": f"放量{t['turnover']:.1f}%·关注持续性",
        "position": f"{min(t['score']//15, 2)}成"
    } for i, t in enumerate(top_e2[:3]) if t["score"] >= 55]
    data["engine2"]["doubleSignal"] = [{
        "rank": i+4, "name": t["name"],
        "signal1": f"成交{t['amount']:.0f}万" if t["amount"] > 0 else "活跃",
        "signal2": f"换手{t['turnover']:.1f}%" if t["turnover"] else "活跃",
        "board": 1,
        "strategy": "关注量能持续性·首板安全",
        "position": "0.5-1成"
    } for i, t in enumerate(top_e2[3:10]) if t["score"] >= 40]

    # ---- 引擎3: 主升趋势 ----
    early, mid = [], []
    for t in [tag_stock(s, sc, "引擎3") for s, sc in e3]:
        entry = {
            "name": t["name"], "code": t["code"],
            "industry": "综合",
            "trend": t["score"],
            "valuation": f"PE{t['pe']}x",
            "sentiment": f"换手{t['turnover']:.1f}%",
            "diff": f"涨幅{t['change_pct']:+.1f}%",
            "score": max(t["score"] - 10, 0) if t["change_pct"] > 5 else t["score"],
            "action": f"现价{t['price']}/止损-8%"
        }
        if t["score"] >= 55: mid.append(entry)
        else: early.append(entry)
    data["engine3"]["earlyStage"] = early[:30]
    data["engine3"]["midStage"] = mid[:30]

    # 已排除(涨停+高PE)
    data["engine3"]["excluded"] = [
        {"name": s["name"], "code": s["code"],
         "reason": f"涨幅{s['change_pct']:.1f}%·PE{s['pe_ttm']:.0f}·追高风险"}
        for s, _ in e3[:200] if s["change_pct"] >= 9.5 and s["pe_ttm"] > 50
    ][:6]

    # ---- 引擎4: 回调重启 ----
    pending, confirmed = [], []
    for t in [tag_stock(s, sc, "引擎4") for s, sc in e4]:
        entry = {
            "name": t["name"], "code": t["code"],
            "direction": "综合",
            "signal": f"换手{t['turnover']:.1f}%·振幅{t['amplitude']:.1f}%",
            "score": t["score"],
            "action": "可关注" if t["score"] >= 50 else "等确认",
            "upside": f"+{min(t['score']//2, 25)}%"
        }
        if t["score"] >= 55: confirmed.append(entry)
        else: pending.append(entry)
    data["engine4"]["pendingConfirm"] = pending[:20]
    data["engine4"]["confirmed"] = confirmed[:15]

    # 还在回调
    data["engine4"]["waiting"] = [
        {"name": s["name"], "status": f"回撤中·PE{s['pe_ttm']:.0f}"}
        for s, _ in e4[-20:] if s["change_pct"] < -3
    ][:3]

    # ---- 引擎5: 低估埋伏 ----
    data["engine5"]["prePosition"] = [{
        "name": t["name"],
        "logic": f"PE{t['pe']}x·PB{t['pb']}·低估值安全边际",
        "timeframe": "1-4周",
        "position": "0.5-1成" if t["score"] >= 70 else "0.5成",
        "stopLoss": "-8%"
    } for t in [tag_stock(s, sc, "引擎5") for s, sc in e5[:10]] if t["score"] >= 40]

    # ---- 板块 ----
    # 用成交额作为板块活跃度的粗略代理
    top_by_amount = sorted(stocks, key=lambda s: -(s["amount"] or 0))
    data["sectorFlow"]["inflow"] = [
        {"sector": "资金活跃", "amount": f"{s['amount']:.0f}万", "signal": "🟢", "detail": f"{s['name']}·换手{s['turnover']:.1f}%"}
        for s in top_by_amount[:6]
    ]
    data["sectorFlow"]["outflow"] = [
        {"sector": "缩量", "amount": f"{s['amount']:.0f}万", "signal": "🔴", "detail": f"{s['name']}·涨幅{s['change_pct']:+.1f}%"}
        for s in top_by_amount[-5:] if s["amount"] > 0
    ]
    # 五引擎综合轮动
    engines_desc = {
        "引擎1(价值)": e1[0][0]["name"] if e1 else "暂无",
        "引擎2(资金)": e2[0][0]["name"] if e2 else "暂无",
        "引擎3(趋势)": e3[0][0]["name"] if e3 else "暂无",
        "引擎4(回调)": e4[0][0]["name"] if e4 else "暂无",
        "引擎5(低估)": e5[0][0]["name"] if e5 else "暂无",
    }
    data["sectorFlow"]["rotation"] = [
        {"stage": k, "direction": v, "logic": "五引擎独立评分排名第一", "targets": v}
        for k, v in engines_desc.items()
    ]

    return data


if __name__ == "__main__":
    print("📊 全A股五引擎扫描 v3.0", file=sys.stderr)
    print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M')}", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    stocks = scan_all()
    if len(stocks) < 100:
        print(f"❌ 数据不足: {len(stocks)}只", file=sys.stderr)
        sys.exit(1)

    print(f"\n🔍 五引擎独立评分中...", file=sys.stderr)

    # 打印各引擎评分分布
    for name, fn in [("引擎1(价值)", engine1_score), ("引擎2(资金)", engine2_score),
                     ("引擎3(趋势)", engine3_score), ("引擎4(回调)", engine4_score),
                     ("引擎5(低估)", engine5_score)]:
        scores = [fn(s) for s in stocks]
        avg = sum(scores) / len(scores)
        top3 = sorted(stocks, key=lambda s: -fn(s))[:3]
        print(f"  {name}: 均值{avg:.1f} 第一={top3[0]['name']}({fn(top3[0]):.0f})", file=sys.stderr)

    dashboard = generate_dashboard(stocks)

    path = "dashboard-data.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 完成! {len(stocks)}只→生成{dashboard['dataPool']['strongSignal']}",
          file=sys.stderr)
    print(f"   文件: {path} ({os.path.getsize(path)//1024}KB)", file=sys.stderr)

    # 打印多引擎共振
    print(f"\n📌 多引擎共振(≥3引擎高分):", file=sys.stderr)
    for s in stocks:
        sc = {"e1": engine1_score(s), "e2": engine2_score(s),
              "e3": engine3_score(s), "e4": engine4_score(s), "e5": engine5_score(s)}
        high = sum(1 for v in sc.values() if v >= 60)
        if high >= 3:
            print(f"  {s['name']}: {sc}", file=sys.stderr)
