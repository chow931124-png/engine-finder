#!/usr/bin/env python3
"""
全A股扫描器 — 直接调用东方财富API，不依赖akshare。
支持四个引擎的筛选条件，输出JSON供dashboard使用。
"""

import json, sys, time
from urllib.request import urlopen, Request
from urllib.parse import quote
from datetime import datetime

EASTMONEY_URL = "https://push2.eastmoney.com/api/qt/clist/get"
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://data.eastmoney.com/"}

# 全A股 market filter
ALL_A_SHARES = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"

# 需要的字段
FIELDS = "f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24,f37,f38,f39,f40,f41,f45,f46,f48,f49,f50,f52,f57,f62,f100,f102,f103,f104,f105,f106,f115,f116,f117,f124,f127,f128,f129,f130,f131,f132,f133,f134,f135,f136,f137,f138,f139,f140,f141,f152,f167,f168,f169,f170,f171,f173,f174,f175,f184,f185,f186,f187,f188,f189,f190,f191,f192,f193,f194,f195,f196,f197"

def fetch_page(page=1, page_size=100):
    params = f"pn={page}&pz={page_size}&po=1&np=1&fltt=2&invt=2&fid=f3&fs={quote(ALL_A_SHARES)}&fields={quote(FIELDS)}"
    url = f"{EASTMONEY_URL}?{params}"
    for attempt in range(3):
        try:
            req = Request(url, headers=HEADERS)
            with urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt == 2:
                print(f"请求失败(第{attempt+1}次): {url[:100]}", file=sys.stderr)
            time.sleep(2)
    return None

def map_stock(item):
    """将API原始字段映射为可读字典"""
    try:
        return {
            "symbol": str(item.get("f12","")),
            "name": str(item.get("f14","")),
            "price": item.get("f2"),           # 最新价
            "change_pct": item.get("f3"),       # 涨跌幅%
            "change_amount": item.get("f4"),    # 涨跌额
            "volume": item.get("f5"),           # 成交量(手)
            "amount": item.get("f6"),           # 成交额(元)
            "amplitude": item.get("f7"),        # 振幅
            "turnover": item.get("f8"),         # 换手率%
            "pe_ttm": item.get("f9"),           # PE(TTM)
            "volume_ratio": item.get("f10"),    # 量比
            "high": item.get("f15"),            # 最高
            "low": item.get("f16"),             # 最低
            "open": item.get("f17"),            # 开盘
            "prev_close": item.get("f18"),      # 昨收
            "market_cap": item.get("f20"),      # 总市值
            "float_cap": item.get("f21"),       # 流通市值
            "pb": item.get("f23"),              # 市净率
            "high_60d": item.get("f24"),        # 60日最高
            "roe": item.get("f37"),             # ROE
            "main_inflow": item.get("f62"),     # 主力净流入
            "industry": str(item.get("f100","")),
            "revenue_growth": item.get("f105"), # 营收同比
            "profit_growth": item.get("f106"),  # 净利同比
        }
    except:
        return None

def pull_all_stocks(batch_size=200):
    """分页拉取全A股数据"""
    all_stocks = []
    page = 1
    while True:
        data = fetch_page(page, batch_size)
        if not data or not data.get("data"):
            break
        items = data["data"].get("diff", [])
        if not items:
            break
        for item in items:
            s = map_stock(item)
            if s and s["symbol"]:
                all_stocks.append(s)
        total = data["data"].get("total", 0)
        print(f"  已拉取 {len(all_stocks)}/{total} 只...", file=sys.stderr)
        if len(all_stocks) >= total:
            break
        page += 1
        time.sleep(0.5)  # 避免被限流
    return all_stocks

# ============================================================
# 引擎3: 主升趋势中继筛选
# ============================================================
def screen_trend(stocks):
    early, mid = [], []
    for s in stocks:
        try:
            pct = s["change_pct"] or 0
            turnover = s["turnover"] or 0
            vol_ratio = s["volume_ratio"] or 0
            pe = s["pe_ttm"] or 999
            cap = (s["market_cap"] or 0) / 1e8  # 亿

            # 基础过滤
            if not s["name"] or "ST" in str(s["name"]): continue
            if cap < 30 or cap > 800: continue  # 市值30-800亿
            if turnover < 1: continue  # 换手太低=无人关注
            if pe <= 0: continue

            # 趋势评分
            score = 0
            if vol_ratio > 1.0: score += 15
            if turnover > 3: score += 10
            if 0 < pct < 5: score += 20  # 温和上涨
            elif 5 <= pct <= 9.5: score += 15  # 强势但未涨停
            if pe < 50: score += 15
            if s["roe"] and s["roe"] > 10: score += 10

            entry = {
                "symbol": s["symbol"], "name": s["name"],
                "change_pct": round(pct, 2),
                "pe": round(pe, 1),
                "turnover": round(turnover, 2),
                "vol_ratio": round(vol_ratio, 2),
                "market_cap": round(cap, 0),
                "roe": round(s["roe"], 1) if s["roe"] else None,
                "main_inflow": round(s["main_inflow"]/1e4, 2) if s["main_inflow"] else None,
                "trend_score": min(score, 100),
                "industry": s.get("industry",""),
            }

            if score >= 50:
                mid.append(entry)
            elif score >= 35:
                early.append(entry)
        except:
            continue

    # 排序取Top
    early.sort(key=lambda x: x["trend_score"], reverse=True)
    mid.sort(key=lambda x: x["trend_score"], reverse=True)
    return {"early_stage": early[:30], "mid_stage": mid[:30]}

# ============================================================
# 引擎5: 回调结束重新启动筛选
# ============================================================
def screen_pullback(stocks):
    bounce, confirmed = [], []
    for s in stocks:
        try:
            pct = s["change_pct"] or 0
            turnover = s["turnover"] or 0
            vol_ratio = s["volume_ratio"] or 0
            amplitude = s["amplitude"] or 0
            high_60d = s.get("high_60d") or 0
            price = s["price"] or 0
            cap = (s["market_cap"] or 0) / 1e8

            if not s["name"] or "ST" in str(s["name"]): continue
            if cap < 20 or cap > 1000: continue
            if turnover < 1.5: continue

            # 计算距60日高点回撤
            drawdown = 0
            if high_60d and price:
                drawdown = round((1 - price/high_60d) * 100, 1)

            score = 0
            # 放量反弹信号
            if vol_ratio > 1.3: score += 20
            if 1 <= pct <= 8: score += 15  # 反弹中
            if 10 <= drawdown <= 35: score += 25  # 回调过10-35%最理想
            elif 5 <= drawdown < 10: score += 15
            if amplitude > 5: score += 10  # 有振幅=有分歧转一致
            if turnover > 4: score += 10

            entry = {
                "symbol": s["symbol"], "name": s["name"],
                "change_pct": round(pct, 2),
                "drawdown_60d": drawdown,
                "turnover": round(turnover, 2),
                "vol_ratio": round(vol_ratio, 2),
                "amplitude": round(amplitude, 2),
                "market_cap": round(cap, 0),
                "price": round(price, 2),
                "high_60d": round(high_60d, 2) if high_60d else None,
                "main_inflow": round(s["main_inflow"]/1e4, 2) if s["main_inflow"] else None,
                "bounce_score": min(score, 100),
                "industry": s.get("industry",""),
            }

            if score >= 55:
                confirmed.append(entry)
            elif score >= 40:
                bounce.append(entry)
        except:
            continue

    bounce.sort(key=lambda x: x["bounce_score"], reverse=True)
    confirmed.sort(key=lambda x: x["bounce_score"], reverse=True)
    return {"bouncing": bounce[:30], "confirmed": confirmed[:30]}

# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    print("📊 正在拉取全A股数据(约5500只)...", file=sys.stderr)
    stocks = pull_all_stocks()
    print(f"✅ 拉取完成: {len(stocks)}只", file=sys.stderr)

    result = {"timestamp": datetime.now().isoformat(), "total_stocks": len(stocks)}

    if mode in ("all", "trend"):
        print("🔍 引擎3: 筛选主升趋势中继...", file=sys.stderr)
        trend = screen_trend(stocks)
        result["trend"] = trend
        print(f"  主升初期: {len(trend['early_stage'])} | 主升中继: {len(trend['mid_stage'])}", file=sys.stderr)

    if mode in ("all", "pullback"):
        print("🔄 引擎5: 筛选回调结束重启...", file=sys.stderr)
        pb = screen_pullback(stocks)
        result["pullback"] = pb
        print(f"  回调反弹中: {len(pb['bouncing'])} | 企稳确认: {len(pb['confirmed'])}", file=sys.stderr)

    print(json.dumps(result, ensure_ascii=False, indent=2))
