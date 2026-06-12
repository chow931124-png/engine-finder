// ============================================================
// A股三引擎选股系统 — 盘中数据自动更新脚本
// 输出: market-data.json (给 dashboard.html 加载)
// ============================================================

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'market-data.json');

async function fetchText(url, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return await r.text();
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// ============================================================
// 1. 大盘指数（腾讯行情）
// ============================================================
async function fetchIndices() {
  const text = await fetchText('https://qt.gtimg.cn/q=sh000001,sz399001,sz399006');
  if (!text) return null;

  const indices = {};
  const lines = text.split(';').filter(l => l.includes('='));
  for (const line of lines) {
    const m = line.match(/^v_(\w+)="(.+)/);
    if (!m) continue;
    const parts = m[2].split('~');
    const code = m[1];
    const cur = parseFloat(parts[3]);
    const prev = parseFloat(parts[4]);
    const changePct = prev > 0 ? ((cur - prev) / prev * 100).toFixed(2) : '0';

    const names = { sh000001:'上证指数', sz399001:'深证成指', sz399006:'创业板指' };
    const key = { sh000001:'sh', sz399001:'sz', sz399006:'cy' };

    if (key[code]) {
      indices[key[code]] = { name: names[code], price: cur.toFixed(2), changePct };
    }

    // 成交额（腾讯parts[8]是成交额，单位万）
    if (code === 'sh000001') {
      const amountYuan = parseFloat(parts[8] || '0') * 10000;
      indices.volume = amountYuan > 0 ? (amountYuan / 1e8).toFixed(2) + '亿' : null;
    }
  }
  return indices;
}

// ============================================================
// 2. 涨跌家数（东方财富市场概览）
// ============================================================
async function fetchLimitUpDown() {
  // 东方财富涨停池
  const upText = await fetchText(
    'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f12,f14'
  );
  const dnText = await fetchText(
    'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:4&fields=f12,f14'
  );
  // 东方财富上涨/下跌家数（沪深京）
  const allText = await fetchText(
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=1.000001'
  );

  // 上涨/下跌家数从另一个接口
  const riseFallText = await fetchText(
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14,f104,f105,f106,f107&secids=1.000001'
  );

  let rise = null, fall = null;
  if (riseFallText) {
    try {
      const j = JSON.parse(riseFallText);
      const d = j?.data?.diff?.[0];
      if (d) {
        rise = d.f104;
        fall = d.f105;
      }
    } catch {}
  }

  let limitUp = 0, limitDown = 0;
  try { if (upText) { const j = JSON.parse(upText); limitUp = j?.data?.total || 0; } } catch {}
  try { if (dnText) { const j = JSON.parse(dnText); limitDown = j?.data?.total || 0; } } catch {}

  return { limitUp, limitDown, rise, fall };
}

// ============================================================
// 3. 板块资金流向（东方财富行业板块TOP5）
// ============================================================
async function fetchSectorFlow() {
  const text = await fetchText(
    'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:2&fields=f12,f14,f62,f184'
  );
  if (!text) return [];
  try {
    const j = JSON.parse(text);
    return (j?.data?.diff || []).map(item => ({
      name: item.f14,
      netInflow: ((item.f62 || 0) / 1e8).toFixed(2) + '亿',
      changePct: (item.f184 || 0).toFixed(2) + '%',
    }));
  } catch { return []; }
}

// ============================================================
// 主函数
// ============================================================
async function main() {
  console.log('📡 更新市场数据...');
  const [indices, limitData, sectorFlow] = await Promise.all([
    fetchIndices(), fetchLimitUpDown(), fetchSectorFlow()
  ]);

  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const d = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const isTrading = now.getHours() >= 9 && now.getHours() < 15;

  const data = {
    updatedAt: now.toISOString(),
    updatedAtCN: `${d} ${h}:${m}`,
    isTrading,
    indices: indices ? {
      sh: indices.sh,
      sz: indices.sz,
      cy: indices.cy,
      volume: indices.volume,
    } : null,
    marketTemp: {
      limitUp: limitData?.limitUp || 0,
      limitDown: limitData?.limitDown || 0,
      rise: limitData?.rise || 0,
      fall: limitData?.fall || 0,
    },
    sectorFlow,
    status: indices?.sh ? 'ok' : 'error',
  };

  writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log(`✅ ${data.updatedAtCN} ${isTrading?'盘中':'盘后'}`);
  console.log(`   上证: ${indices?.sh?.price} (${indices?.sh?.changePct}%)`);
  console.log(`   涨停/跌停: ${limitData?.limitUp}/${limitData?.limitDown} | 涨/跌: ${limitData?.rise}/${limitData?.fall}`);
  if (indices?.volume) console.log(`   成交: ${indices.volume}`);
}

main().catch(e => { console.error('❌ 失败:', e.message); process.exit(1); });
