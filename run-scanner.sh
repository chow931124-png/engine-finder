#!/bin/bash
# 全A股扫描脚本 — 带重试+缓存
# 用法: ./run-scanner.sh [trend|pullback|all]

CACHE_FILE="/Users/chow/.claude/workflows/.market-cache.json"
CACHE_MAX_AGE=3600  # 1小时缓存
MODE=${1:-all}

# 检查缓存
if [ -f "$CACHE_FILE" ]; then
    CACHE_AGE=$(($(date +%s) - $(stat -f%m "$CACHE_FILE" 2>/dev/null || stat -c%Y "$CACHE_FILE" 2>/dev/null)))
    if [ "$CACHE_AGE" -lt "$CACHE_MAX_AGE" ]; then
        echo "📦 使用缓存数据($((CACHE_AGE/60))分钟前拉取)" >&2
        RAW=$(cat "$CACHE_FILE")
    fi
fi

# 拉取全量数据（最多重试5次）
if [ -z "$RAW" ]; then
    for i in 1 2 3 4 5; do
        echo "🔄 第${i}次尝试拉取全A股数据..." >&2
        RAW=$(curl -s --connect-timeout 15 --max-time 30 \
            "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f5,f6,f8,f9,f10,f12,f14,f15,f16,f20,f21,f24,f37,f62,f100" \
            2>/dev/null)
        if echo "$RAW" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null | grep -q .; then
            echo "$RAW" > "$CACHE_FILE"
            echo "✅ 拉取成功，已缓存" >&2
            break
        fi
        echo "⏳ 失败，等待${i}0秒后重试..." >&2
        sleep $((i*10))
    done
fi

if [ -z "$RAW" ]; then
    echo "❌ 5次重试均失败，请稍后再试" >&2
    exit 1
fi

# 用Python处理数据
python3 << PYEOF
import json, sys
raw = """$RAW"""

def safe(obj, key, default=None):
    v = obj.get(key)
    return v if v not in (None, '-', '') else default

try:
    data = json.loads(raw)
    items = data['data']['diff']
    total = data['data']['total']
except:
    print("JSON解析失败")
    sys.exit(1)

print(f"📊 全市场{total}只A股", file=sys.stderr)

# ============ 引擎3: 主升趋势 ============
if "$MODE" in ("all", "trend"):
    early, mid_ = [], []
    for item in items:
        name = str(safe(item,'f14',''))
        sym = str(safe(item,'f12',''))
        pct = safe(item,'f3',0) or 0
        turnover = safe(item,'f8',0) or 0
        vol_ratio = safe(item,'f10',0) or 0
        pe = safe(item,'f9',999) or 999
        cap = (safe(item,'f20',0) or 0) / 1e8
        roe = safe(item,'f37',0) or 0
        main_inflow = (safe(item,'f62',0) or 0) / 1e4
        if 'ST' in name: continue
        if cap < 30 or cap > 800: continue
        if turnover < 1: continue
        if pe <= 0 or pe > 500: continue

        score = 0
        if vol_ratio > 1.0: score += 15
        if turnover > 3: score += 10
        if 0 < pct < 5: score += 20
        elif 5 <= pct <= 9.5: score += 15
        if pe < 50: score += 15
        if roe > 10: score += 10
        if main_inflow > 0: score += 10

        entry = {"s":sym,"n":name,"pct":pct,"pe":round(pe,1),"to":round(turnover,1),"vr":round(vol_ratio,1),"cap":round(cap,0),"roe":round(roe,1),"inflow":round(main_inflow,1),"score":min(score,100)}
        if score >= 50: mid_.append(entry)
        elif score >= 35: early.append(entry)

    early.sort(key=lambda x:-x['score'])
    mid_.sort(key=lambda x:-x['score'])
    print(f"\n🔵 主升初期({len(early)}只):")
    for e in early[:15]: print(f"  {e['s']} {e['n']:<8s} +{e['pct']}% PE{e['pe']} 换手{e['to']}% {e['score']}分 {e.get('cap','')}亿")
    print(f"\n🟢 主升中继({len(mid_)}只):")
    for e in mid_[:15]: print(f"  {e['s']} {e['n']:<8s} +{e['pct']}% PE{e['pe']} 换手{e['to']}% {e['score']}分 {e.get('cap','')}亿")

# ============ 引擎5: 回调重启 ============
if "$MODE" in ("all", "pullback"):
    bounce, confirmed_ = [], []
    for item in items:
        name = str(safe(item,'f14',''))
        sym = str(safe(item,'f12',''))
        pct = safe(item,'f3',0) or 0
        turnover = safe(item,'f8',0) or 0
        vol_ratio = safe(item,'f10',0) or 0
        price = safe(item,'f2',0) or 0
        high60 = safe(item,'f24',0) or 0
        cap = (safe(item,'f20',0) or 0) / 1e8
        if 'ST' in name: continue
        if cap < 20 or cap > 1000: continue
        if turnover < 1.5: continue

        drawdown = round((1 - price/high60)*100, 1) if high60 and price else 0
        score = 0
        if vol_ratio > 1.3: score += 20
        if 1 <= pct <= 8: score += 15
        if 10 <= drawdown <= 35: score += 25
        elif 5 <= drawdown < 10: score += 15
        if turnover > 4: score += 10

        entry = {"s":sym,"n":name,"pct":pct,"dd":drawdown,"to":round(turnover,1),"vr":round(vol_ratio,1),"cap":round(cap,0),"price":price,"high60":high60,"score":min(score,100)}
        if score >= 55: confirmed_.append(entry)
        elif score >= 40: bounce.append(entry)

    bounce.sort(key=lambda x:-x['score'])
    confirmed_.sort(key=lambda x:-x['score'])
    print(f"\n🟡 回调反弹中({len(bounce)}只):")
    for e in bounce[:15]: print(f"  {e['s']} {e['n']:<8s} +{e['pct']}% 回撤{e['dd']}% 换手{e['to']}% {e['score']}分")
    print(f"\n🟢 企稳确认({len(confirmed_)}只):")
    for e in confirmed_[:15]: print(f"  {e['s']} {e['n']:<8s} +{e['pct']}% 回撤{e['dd']}% 换手{e['to']}% {e['score']}分")
PYEOF
