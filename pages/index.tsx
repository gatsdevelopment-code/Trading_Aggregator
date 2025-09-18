import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Page wraps the App with ssr: false to avoid window/document on server side.
 */
function App() {

// --------------------------- i18n -------------------------------------------
 type Lang = 'ru' | 'en';
 const DICT: Record<Lang, any> = {
  en: {
    constructor: 'Constructor', stats: 'Statistics', history: 'History',
    addBook: 'Add book', live: 'live', offline: 'offline', sim: 'sim',
    lastPrice: 'Last price', open: 'Open', low: 'Low', high: 'High', vol: 'Avg Volatility',
    signal: 'Traffic Light', legend: 'Green=buy, Red=sell, Yellow=neutral', developed: 'Developed by GATS',
    depth: 'Depth', minUsd: 'Min USD', exchange: 'Exchange', symbol: 'Symbol', sort: 'Sort', byUsd: 'by USD', byCoin: 'by Coin',
    explainTitle: 'Signal breakdown', explainText: 'score = weighted sum of order‑book imbalance (imb), 1m momentum (mom), and spread penalty (spr).',
    horizons: 'Outlook', h4: '4h', h1d: 'Day', h1w: 'Week', h1m: 'Month',
    tvNote: 'HARSI requires TradingView library; widget shows RSI and Heikin‑Ashi candles where possible.',
    currency: 'Currency', bigWall: 'Big‑wall threshold', bollPeriod: 'Boll Period', bollMult: 'Boll Mult'
  },
  ru: {
    constructor: 'Конструктор', stats: 'Статистика', history: 'История',
    addBook: 'Добавить стакан', live: 'онлайн', offline: 'оффлайн', sim: 'сим',
    lastPrice: 'Последняя цена', open: 'Открытие', low: 'Минимум', high: 'Максимум', vol: 'Средняя волатильность',
    signal: 'Светофор', legend: 'Зелёный=покупка, Красный=продажа, Жёлтый=нейтрально', developed: 'Developed by GATS',
    depth: 'Глубина', minUsd: 'Мин USD', exchange: 'Биржа', symbol: 'Символ', sort: 'Сортировка', byUsd: 'по USD', byCoin: 'по монете',
    explainTitle: 'Расшифровка сигнала', explainText: 'score = взвешенная сумма дисбаланса стакана (imb), минутного импульса цены (mom) и штрафа за спред (spr).',
    horizons: 'Прогноз', h4: '4 часа', h1d: 'День', h1w: 'Неделя', h1m: 'Месяц',
    tvNote: 'Для HARSI нужен TradingView Library; виджет показывает RSI и свечи Heikin‑Аshi, если доступно.',
    currency: 'Валюта', bigWall: 'Порог крупной стены', bollPeriod: 'Период Боллинджера', bollMult: 'Множитель Боллинджера'
  }
 };

// --------------------------- theme -----------------------------------------
 type Theme = 'dark' | 'light';
 function useTheme(): [Theme, (t: Theme)=>void] {
  const [theme, setTheme] = useState<Theme>(() => (typeof window !== 'undefined' ? (localStorage.getItem('theme') as Theme) : 'dark') || 'dark');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light'); else root.classList.remove('light');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);
  return [theme, setTheme];
 }

// --------------------------- currency --------------------------------------
 type Currency = 'USD' | 'AUD' | 'RUB' | 'BTC';
 const DEFAULT_RATES: Record<Exclude<Currency,'USD'>, number> = {
  AUD: 1.5, // demo fallback
  RUB: 90,
  BTC: 1/50000
 };
 function useFxRates(){
  const [rates,setRates]=useState(DEFAULT_RATES);
  useEffect(()=>{
    let abort=false;
    async function fetchRates(){
      try{
        const r=await fetch('https://api.exchangerate.host/latest?base=USD&symbols=AUD,RUB');
        const j=await r.json();
        const aud=j?.rates?.AUD||rates.AUD;
        const rub=j?.rates?.RUB||rates.RUB;
        const r2=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const j2=await r2.json();
        const btc=1/(j2?.bitcoin?.usd||50000);
        if(!abort) setRates({AUD:aud,RUB:rub,BTC:btc});
      }catch{}
    }
    fetchRates();
    const iv=setInterval(fetchRates,60000);
    return ()=>{abort=true; clearInterval(iv)};
  },[]);
  return rates;
 }

// --------------------------- signal ----------------------------------------
 type Signal = { color: 'green'|'red'|'yellow', score: number, comment: string };
 function computeSignal(args: { bidUSD: number; askUSD: number; momentum: number; spreadBps: number }): Signal {
  const { bidUSD, askUSD, momentum, spreadBps } = args;
  const imb = (bidUSD - askUSD) / Math.max(1, bidUSD + askUSD);
  let score = 0;
  score += imb * 0.6;
  score += Math.max(-1, Math.min(1, momentum)) * 0.35;
  score -= Math.min(spreadBps / 20, 0.15);
  let color: Signal['color'] = 'yellow';
  if (score > 0.15) color = 'green'; else if (score < -0.15) color = 'red';
  return { color, score, comment: `imb=${imb.toFixed(2)}, mom=${momentum.toFixed(2)}, spr=${spreadBps.toFixed(1)}bps` };
 }

// Unit tests (console)
(function runTests(){
  try{
    console.groupCollapsed('computeSignal tests');
    const green = computeSignal({ bidUSD: 200, askUSD: 100, momentum: 0.3, spreadBps: 5 });
    console.assert(green.color === 'green', 'green when bid>>ask & momentum>0', green);
    const red = computeSignal({ bidUSD: 50, askUSD: 200, momentum: -0.4, spreadBps: 5 });
    console.assert(red.color === 'red', 'red when ask>>bid & momentum<0', red);
    const yellow = computeSignal({ bidUSD: 100, askUSD: 100, momentum: 0.0, spreadBps: 1 });
    console.assert(yellow.color === 'yellow', 'yellow near balance', yellow);
    const wideSpread = computeSignal({ bidUSD: 150, askUSD: 100, momentum: 0.2, spreadBps: 200 });
    console.assert(wideSpread.color !== 'green', 'huge spread penalizes score', wideSpread);
    const negMom = computeSignal({ bidUSD: 180, askUSD: 170, momentum: -0.8, spreadBps: 2 });
    console.assert(negMom.color !== 'green', 'negative momentum reduces score', negMom);
    console.groupEnd();
  }catch(e){ console.error('Unit tests failed to run', e); }
})();

// --------------------------- data model ------------------------------------
 type Exchange = 'Binance' | 'Bitfinex' | 'Coinbase';
 type Symbol = 'BTC' | 'ETH' | 'XRP';
 type BookRow = { price: number; amount: number };
 type Book = { bids: BookRow[]; asks: BookRow[]; ts: number; price?: number };
 type BookCfg = { id: string; exchange: Exchange; symbol: Symbol; depth: number; minUSD: number };

 function rnd(seed: number){ let s = Math.sin(seed) * 10000; return s - Math.floor(s); }
 function genBook(mid: number, depth = 20, seed = 1): Book {
  const bids: BookRow[] = []; const asks: BookRow[] = [];
  for (let i=0;i<depth;i++){
    const pB = mid - i * (0.5 + rnd(seed+i)*1.5);
    const pA = mid + i * (0.5 + rnd(seed+100+i)*1.5);
    bids.push({ price: Math.max(1, pB), amount: +(0.1 + rnd(seed+200+i)*3).toFixed(4) });
    asks.push({ price: Math.max(1, pA), amount: +(0.1 + rnd(seed+300+i)*3).toFixed(4) });
  }
  return { bids, asks, ts: Date.now(), price: mid };
 }

// --------------------------- WS adapters -----------------------------------
 function connectBinance(symbol: Symbol, onBook:(b:Book)=>void, onPrice:(px:number)=>void){
  try{ const s=(symbol+'USDT').toLowerCase(); const url=`wss://stream.binance.com:9443/stream?streams=${s}@depth20@100ms/${s}@trade`; const ws=new WebSocket(url);
    ws.onmessage=(ev)=>{ const msg=JSON.parse(ev.data); if(!msg||!msg.stream||!msg.data) return; if(msg.stream.endsWith('@trade')) onPrice(+msg.data.p); else { const d=msg.data; onBook({ bids:(d.b||d.bids||[]).slice(0,50).map((x:any)=>({price:+x[0],amount:+x[1]})), asks:(d.a||d.asks||[]).slice(0,50).map((x:any)=>({price:+x[0],amount:+x[1]})), ts:d.E }); } };
    return ws; } catch { return null; }
 }
 function connectBitfinex(symbol: Symbol, onBook:(b:Book)=>void, onPrice:(px:number)=>void){
  try{ const url='wss://api-pub.bitfinex.com/ws/2'; const ws=new WebSocket(url); let chanBook=-1,chanTrades=-1; const sym=`t${symbol}USD`;
    ws.onopen=()=>{ ws.send(JSON.stringify({event:'subscribe',channel:'book',symbol:sym,prec:'P0',freq:'F0',len:25})); ws.send(JSON.stringify({event:'subscribe',channel:'trades',symbol:sym})); };
    ws.onmessage=(ev)=>{ const data=JSON.parse(ev.data); if(data?.event==='subscribed'){ if(data.channel==='book') chanBook=data.chanId; if(data.channel==='trades') chanTrades=data.chanId; return; } if(Array.isArray(data)){ const [chan,payload]=data; if(chan===chanBook){ if(payload==='hb') return; if(Array.isArray(payload[0])){ const bids:BookRow[]=[],asks:BookRow[]=[]; payload.forEach((r:any)=>{ const [price,count,amount]=r; if(amount>0) bids.push({price,amount:Math.abs(amount)}); else asks.push({price,amount:Math.abs(amount)}); }); onBook({bids,asks,ts:Date.now()}); } } if(chan===chanTrades){ if(payload==='hb') return; if(payload[0]==='tu'||payload[0]==='te'){ const [, [id,ts,px,qty]]=data; onPrice(px); } } } };
    return ws; } catch { return null; }
 }
 function connectCoinbase(symbol: Symbol, onBook:(b:Book)=>void, onPrice:(px:number)=>void){
  try{ const ws=new WebSocket('wss://ws-feed.exchange.coinbase.com'); const product=`${symbol}-USD`; const bids=new Map<number,number>(),asks=new Map<number,number>();
    const toRows=(m:Map<number,number>)=>Array.from(m.entries()).sort((a,b)=>b[0]-a[0]).slice(0,50).map(([price,amount])=>({price,amount}));
    ws.onopen=()=>{ ws.send(JSON.stringify({type:'subscribe',product_ids:[product],channels:['level2','ticker']})); };
    ws.onmessage=(ev)=>{ const msg=JSON.parse(ev.data);
      if(msg.type==='snapshot'){
        bids.clear(); asks.clear();
        (msg.bids||[]).slice(0,80).forEach((x:any)=>bids.set(+x[0],+x[1]));
        (msg.asks||[]).slice(0,80).forEach((x:any)=>asks.set(+x[0],+x[1]));
        onBook({bids:toRows(bids),asks:toRows(asks),ts:Date.now()});
      } else if(msg.type==='l2update'){
        (msg.changes||[]).forEach((c:any)=>{ const [side,p,sz]=c; const price=+p, amt = +sz; const m=side==='buy'?bids:asks; if(amt===0) m.delete(price); else m.set(price,amt); });
        onBook({bids:toRows(bids),asks:toRows(asks),ts:Date.now()});
      } else if(msg.type==='ticker'){
        onPrice(+msg.price);
      }
    };
    return ws; } catch { return null; }
 }

// --------------------------- Bollinger (SVG) -------------------------------
 function useBollinger(series:number[], period=20, mult=2){
  const n=series.length; if(n<2) return { mid:[], upper:[], lower:[] } as any;
  const mid:number[]=[], upper:number[]=[], lower:number[]=[];
  for(let i=0;i<n;i++){
    const start=Math.max(0,i-period+1); const slice=series.slice(start,i+1);
    const mean=slice.reduce((a,b)=>a+b,0)/slice.length;
    const variance=slice.reduce((a,b)=>a+(b-mean)*(b-mean),0)/slice.length;
    const sd=Math.sqrt(variance); mid.push(mean); upper.push(mean+mult*sd); lower.push(mean-mult*sd);
  }
  return { mid, upper, lower };
 }

 function MiniChart({ series, period=20, mult=2 }:{ series:number[]; period?:number; mult?:number }){
  const { mid, upper, lower } = useBollinger(series, period, mult);
  const w=260, h=80, pad=8; const n=Math.max(1, series.length);
  const min=Math.min(...series, ...lower, 1e9); const max=Math.max(...series, ...upper, 0);
  const x=(i:number)=>pad + (w-2*pad) * (i/(n-1||1));
  const y=(v:number)=>h-pad - (h-2*pad) * ((v-min)/Math.max(1e-6, max-min));
  const path=(arr:number[])=>arr.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg width={w} height={h} style={{display:'block'}}>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      <path d={path(upper)} fill="none" stroke="currentColor" opacity={0.35} />
      <path d={path(lower)} fill="none" stroke="currentColor" opacity={0.35} />
      <path d={path(mid)} fill="none" stroke="currentColor" opacity={0.8} />
    </svg>
  );
 }

// --------------------------- UI parts --------------------------------------
 function StyleTag(){
  return (
    <style>{`
      :root { --bg:#0b1220; --panel:#121a2b; --text:#e3e7f1; --muted:#93a0b4; --grid:rgba(255,255,255,.06); }
      .light { --bg:#f5f7fb; --panel:#fff; --text:#0b1220; --muted:#556179; --grid:rgba(0,0,0,.08); }
      *{box-sizing:border-box} html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial}
      .container{max-width:1200px;margin:0 auto;padding:20px}
      .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .brand{display:flex;gap:10px;align-items:center;font-weight:800}
      .logo{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3dbb6a,#2563eb)}
      .tabbar{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}
      .tab{padding:8px 12px;border-radius:10px;border:1px solid var(--grid);background:var(--panel);color:var(--text)}
      .tab.active{border-color:#3dbb6a;box-shadow:0 0 0 2px rgba(61,187,106,.15) inset}
      .card{background:var(--panel);border:1px solid var(--grid);border-radius:14px;padding:12px;box-shadow:0 6px 30px rgba(0,0,0,.35)}
      .grid{display:grid;gap:12px}
      .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
      .grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}
      .badge{padding:2px 8px;border:1px solid var(--grid);border-radius:999px;font-size:12px;color:var(--muted)}
      .small{font-size:12px;color:var(--muted)}
      table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
      th,td{padding:6px 8px;border-bottom:1px dashed var(--grid);text-align:right}
      th:first-child,td:first-child{text-align:left}
      .cell { position: relative; }
      .bar { position:absolute; top:0; bottom:0; left:0; width:calc(var(--w,0)*1%); pointer-events:none; }
      .bar.bid { background: linear-gradient(90deg, rgba(34,197,94,.3), rgba(34,197,94,.05)); }
      .bar.ask { background: linear-gradient(90deg, rgba(239,68,68,.3), rgba(239,68,68,.05)); }
      .bar.big { box-shadow: inset 0 0 0 2px rgba(255,255,255,.25); }
      .footer{text-align:center;color:var(--muted);font-size:12px;margin:10px 0}
      select,input,button{background:var(--panel);color:var(--text);border:1px solid var(--grid);border-radius:8px;padding:6px 8px}
      .settings{display:flex;gap:8px;align-items:center}
      .settings>label{font-size:12px;color:var(--muted)}
    `}</style>
  );
 }

 function CoinIcon({sym}:{sym:Symbol}){ const map:Record<Symbol,string>={ BTC:'₿', ETH:'Ξ', XRP:'✕' }; return <div style={{fontSize:18,opacity:.9}}>{map[sym]}</div>; }

 function TopBar({ lang, setLang, theme, setTheme, currency, setCurrency, bigWall, setBigWall, bollPeriod, setBollPeriod, bollMult, setBollMult }:{ lang:Lang; setLang:(l:Lang)=>void; theme:Theme; setTheme:(t:Theme)=>void; currency:Currency; setCurrency:(c:Currency)=>void; bigWall:number; setBigWall:(n:number)=>void; bollPeriod:number; setBollPeriod:(n:number)=>void; bollMult:number; setBollMult:(n:number)=>void }){
  const d = DICT[lang];
  return (
    <div className="header container">
      <div className="brand"><div className="logo" />TRADEFLOW<div className="badge">v2</div></div>
      <div className="settings">
        <label>RU/EN</label>
        <select value={lang} onChange={e=>setLang(e.target.value as Lang)}>
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </select>
        <label>Theme</label>
        <select value={theme} onChange={e=>setTheme(e.target.value as Theme)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <label>{d.currency}</label>
        <select value={currency} onChange={e=>setCurrency(e.target.value as Currency)}>
          <option>USD</option><option>AUD</option><option>RUB</option><option>BTC</option>
        </select>
        <label>{d.bigWall}</label>
        <input type="number" value={bigWall} onChange={e=>setBigWall(parseFloat(e.target.value||'0'))} style={{width:110}} />
        <label>{d.bollPeriod}</label>
        <input type="number" min={2} max={200} value={bollPeriod} onChange={e=>setBollPeriod(parseInt(e.target.value||'20'))} style={{width:70}} />
        <label>{d.bollMult}</label>
        <input type="number" step={0.5} min={0.5} max={4} value={bollMult} onChange={e=>setBollMult(parseFloat(e.target.value||'2'))} style={{width:70}} />
      </div>
    </div>
  );
 }

 function SignalLight({ totalBid, totalAsk, momentum, spreadBps, dict }:{ totalBid:number; totalAsk:number; momentum:number; spreadBps:number; dict:any }){
  const s = useMemo(()=>computeSignal({ bidUSD: totalBid, askUSD: totalAsk, momentum, spreadBps }), [totalBid,totalAsk,momentum,spreadBps]);
  const cls = s.color === 'green' ? {bg:'rgba(34,197,94,.15)',bd:'rgba(34,197,94,.35)'} : s.color==='red' ? {bg:'rgba(239,68,68,.15)',bd:'rgba(239,68,68,.35)'} : {bg:'rgba(245,158,11,.15)',bd:'rgba(245,158,11,.35)'};
  return (
    <div className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,background:cls.bg,border:`1px solid ${cls.bd}`}}>
      <div>{dict.signal}</div>
      <div className="small">score {s.score.toFixed(2)} | {s.comment}</div>
      <div className="small">{dict.legend}</div>
    </div>
  );
 }

 type FeedMode = 'ws' | 'sim';
 type SortBy = 'USD' | 'COIN' | 'PRICE';
 function OrderBookCard({ cfg, dict, onChange, onRemove, currency, rates, bigWall, bollPeriod, bollMult }:{ cfg: BookCfg; dict:any; onChange:(patch:Partial<BookCfg>)=>void; onRemove:()=>void; currency:Currency; rates:{AUD:number;RUB:number;BTC:number}; bigWall:number; bollPeriod:number; bollMult:number }){
  const [mode, setMode] = useState<FeedMode>('ws');
  const [book, setBook] = useState<Book>(()=>genBook(50000, cfg.depth, 1));
  const [lastPrice, setLastPrice] = useState<number|undefined>(book.price);
  const [sortBy, setSortBy] = useState<SortBy>('USD');
  const [series, setSeries] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    if(lastPrice!=null){ setSeries(s=>[...s.slice(-180), lastPrice]); }
    if(ref.current){
      const bidsNotional=book.bids.reduce((s,r)=>s+r.price*r.amount,0);
      const asksNotional=book.asks.reduce((s,r)=>s+r.price*r.amount,0);
      const tb=book.bids[0]?.price||0; const ta=book.asks[0]?.price||0; const spread=tb&&ta?((ta-tb)/((ta+tb)/2))*10000:0;
      ref.current.dataset.bid=String(bidsNotional);
      ref.current.dataset.ask=String(asksNotional);
      ref.current.dataset.spread=String(spread);
      ref.current.dataset.px=String(lastPrice||0);
      ref.current.dataset.sym=cfg.symbol;
    }
  }, [book, lastPrice, cfg.symbol]);

  useEffect(() => { 
    let ws: WebSocket | null = null; let timer: any;
    const onBook = (b:Book)=>{ setBook({ ...b, bids: b.bids.slice(0, 50), asks: b.asks.slice(0, 50) }); };
    const onPx = (px:number)=> setLastPrice(px);
    try{
      if (cfg.exchange==='Binance') ws = connectBinance(cfg.symbol, onBook, onPx);
      if (cfg.exchange==='Bitfinex') ws = connectBitfinex(cfg.symbol, onBook, onPx);
      if (cfg.exchange==='Coinbase') ws = connectCoinbase(cfg.symbol, onBook, onPx);
      if (!ws) throw new Error('ws null');
      setMode('ws');
    }catch{
      setMode('sim');
      let t=0; const loop=()=>{ t+=0.25; const mid=(book.price||50000)*(1+Math.sin(t)/3000); onBook(genBook(mid, cfg.depth, Math.floor(t*1000))); onPx(mid); timer=setTimeout(loop,250); }; loop();
    }
    return ()=>{ try{ws?.close();}catch{}; if(timer) clearTimeout(timer); };
  }, [cfg.exchange, cfg.symbol]);

  useEffect(()=>{ 
    setBook(b=>({ ...b, bids: b.bids.slice(0, cfg.depth), asks: b.asks.slice(0, cfg.depth) }));
  }, [cfg.depth]);

  const formatConv = (usd:number) => {
    if(currency==='USD') return usd;
    if(currency==='AUD') return usd*rates.AUD;
    if(currency==='RUB') return usd*rates.RUB;
    if(currency==='BTC') return usd*rates.BTC;
    return usd;
  };

  const filtered = useMemo(() => {
    const mapRow = (r:BookRow)=>({ ...r, usd: r.price*r.amount, coin: r.amount, price:r.price });
    let bids = book.bids.map(mapRow).filter(r=>r.usd >= cfg.minUSD).slice(0, cfg.depth);
    let asks = book.asks.map(mapRow).filter(r=>r.usd >= cfg.minUSD).slice(0, cfg.depth);
    const key = sortBy==='USD'? 'usd' : sortBy==='COIN'?'coin':'price';
    bids.sort((a:any,b:any)=>b[key]-a[key]);
    asks.sort((a:any,b:any)=>b[key]-a[key]);
    return { bids, asks } as any;
  }, [book, cfg.depth, cfg.minUSD, sortBy]);

  const topBid = filtered.bids[0]?.price || 0; const topAsk = filtered.asks[0]?.price || 0; const spreadBps = topBid && topAsk ? ( (topAsk-topBid)/((topAsk+topBid)/2) )*10000 : 0;
  const notionalBidUSD = filtered.bids.reduce((s:any,r:any)=>s+r.usd,0);
  const notionalAskUSD = filtered.asks.reduce((s:any,r:any)=>s+r.usd,0);

  const widthFor = (arr:any[], idx:number, r:any)=>{
    const max = Math.max(...arr.map(x=>x.usd));
    const rel = max? r.usd/max : 0;
    const ladder = (idx+1)/Math.max(1,arr.length);
    return Math.min(100, (rel*70 + ladder*30));
  };
  const isBig = (usd:number) => formatConv(usd) >= bigWall;

  const fmt = (v:number)=>{
    if (currency==='BTC') return (v*rates.BTC).toFixed(6)+' BTC';
    if (currency==='AUD') return (v*rates.AUD).toFixed(0)+' AUD';
    if (currency==='RUB') return (v*rates.RUB).toFixed(0)+' RUB';
    return v.toFixed(0)+' USD';
  };

  return (
    <div ref={ref} className="card" data-notional>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <CoinIcon sym={cfg.symbol} />
          <strong>{cfg.exchange}</strong>
          <span className="badge">{cfg.symbol}/USD</span>
          <span className="badge small">{mode==='ws'?dict.live:dict.sim}</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <label className="small">{dict.symbol}</label>
          <select value={cfg.symbol} onChange={(e)=>onChange({ symbol: e.target.value as Symbol })}>
            <option>BTC</option><option>ETH</option><option>XRP</option>
          </select>
          <label className="small">{dict.sort}</label>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortBy)}>
            <option value="USD">{dict.byUsd}</option>
            <option value="COIN">{dict.byCoin}</option>
            <option value="PRICE">Price</option>
          </select>
          <label className="small">{dict.depth}</label>
          <input type="number" min={5} max={50} value={cfg.depth} onChange={(e)=>onChange({ depth: Math.max(5, Math.min(50, parseInt(e.target.value||'20'))) })} style={{width:70}} />
          <label className="small">{dict.minUsd}</label>
          <input type="number" step={100} value={cfg.minUSD} onChange={(e)=>onChange({ minUSD: Math.max(0, parseFloat(e.target.value||'0')) })} style={{width:90}} />
          <button onClick={onRemove}>✕</button>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>BID ({currency})</th><th>Amount</th><th>Price</th><th>ASK ({currency})</th><th>Amount</th><th>Price</th></tr>
        </thead>
        <tbody>
          {Array.from({length: Math.max(filtered.bids.length, filtered.asks.length)}).map((_,i)=>{
            const b = filtered.bids[i]; const a = filtered.asks[i];
            return (
              <tr key={i}>
                <td className="cell" style={{position:'relative', '--w': String(b? widthFor(filtered.bids, i, b): 0)} as any}>
                  {b? fmt(b.usd): ''}
                  <div className={`bar bid ${b&&isBig(b.usd)?'big':''}`} />
                </td>
                <td>{b? b.amount.toFixed(4): ''}</td>
                <td>{b? b.price.toFixed(2): ''}</td>
                <td className="cell" style={{position:'relative', '--w': String(a? widthFor(filtered.asks, i, a): 0)} as any}>
                  {a? fmt(a.usd): ''}
                  <div className={`bar ask ${a&&isBig(a.usd)?'big':''}`} />
                </td>
                <td>{a? a.amount.toFixed(4): ''}</td>
                <td>{a? a.price.toFixed(2): ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="small">{DICT.en.lastPrice}: {lastPrice!=null? lastPrice.toFixed(2): '-' } | spread: {spreadBps.toFixed(1)} bps | notional: B {fmt(notionalBidUSD)} / A {fmt(notionalAskUSD)}</div>

      <div className="card" style={{marginTop:8}}>
        <MiniChart series={series} period={bollPeriod} mult={bollMult} />
        <div className="small">Bollinger({bollPeriod},{bollMult}σ) — по выбранному стакану</div>
      </div>
    </div>
  );
 }

 function StatsCard({ title, value }:{title:string; value:string}){
  return <div className="card"><div className="small">{title}</div><div style={{fontSize:22,fontWeight:700}}>{value}</div></div>;
 }

 function TradingView({ symbol }:{symbol:Symbol}){
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    const prev = ref.current.querySelector('script[data-tv]'); if(prev) prev.remove();
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/tv.js';
    s.async = true; s.dataset.tv = '1';
    s.onload = () => {
      // @ts-ignore
      if (window.TradingView) {
        // @ts-ignore
        new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}USDT`,
          interval: '60',
          timezone: 'Etc/UTC',
          theme: document.documentElement.classList.contains('light') ? 'light' : 'dark',
          style: '1',
          locale: 'en',
          container_id: 'tv_' + symbol,
          studies: ['RSI@tv-basicstudies'],
          withdateranges: true,
          allow_symbol_change: false,
          hide_side_toolbar: false,
          studies_overrides: {},
          overrides: { 'mainSeriesProperties.style': 8 }
        });
      }
    };
    ref.current.appendChild(s);
  }, [symbol]);
  return <div id={'tv_'+symbol} ref={ref} style={{height:400}} />;
 }

 function FearGreed(){
  const [value,setValue]=useState<number|null>(null);
  const [txt,setTxt]=useState<string>('');
  useEffect(()=>{ fetch('https://api.alternative.me/fng/?limit=1').then(r=>r.json()).then(j=>{ const v=+(j?.data?.[0]?.value||0); setValue(v); setTxt(j?.data?.[0]?.value_classification||''); }).catch(()=>{}); },[]);
  if(value==null) return <div className="card small">Fear & Greed: loading…</div>;
  return (
    <div className="card" style={{display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:160}}>
        <div className="small">Fear & Greed</div>
        <div style={{fontSize:22,fontWeight:700}}>{value} — {txt}</div>
      </div>
      <div style={{flex:1,height:10,background:'var(--grid)',borderRadius:6,position:'relative'}}>
        <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${value}%`,background:'linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)',borderRadius:6}} />
      </div>
    </div>
  );
 }

 function Outlook({ totalBid, totalAsk, momentum, spreadBps, dict }:{ totalBid:number; totalAsk:number; momentum:number; spreadBps:number; dict:any }){
  const s = computeSignal({ bidUSD: totalBid, askUSD: totalAsk, momentum, spreadBps });
  const prob = (bias:number, h:number)=>{ const base = 0.5 + Math.max(-0.45, Math.min(0.45, s.score* (h/24) )); return Math.round(base*100); };
  const row = (label:string,h:number)=> (
    <div className="badge" style={{display:'inline-flex',gap:8,alignItems:'center'}}>
      <span>{label}</span>
      <span style={{color: s.color==='green'?'#22c55e':s.color==='red'?'#ef4444':'#f59e0b'}}>{s.color==='green'?'BUY':'SELL'}</span>
      <span className="small">{prob(s.score,h)}%</span>
    </div>
  );
  return (
    <div className="card" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <div style={{fontWeight:700,marginRight:8}}>{DICT[ 'en' ].horizons}:</div>
      {row(DICT['en'].h4,4)}{row(DICT['en'].h1d,24)}{row(DICT['en'].h1w,24*7)}{row(DICT['en'].h1m,24*30)}
      <div className="small" style={{width:'100%'}}>{DICT['en'].explainTitle}: {DICT['en'].explainText} — <code>score {s.score.toFixed(2)} | {s.comment}</code></div>
    </div>
  );
 }

 // main page body
 const [lang, setLang] = useState<Lang>('ru');
 const dict = DICT[lang];
 const [theme, setTheme] = useTheme();
 const [currency, setCurrency] = useState<Currency>('USD');
 const rates = useFxRates();
 const [bigWall, setBigWall] = useState<number>(50000);
 const [bollPeriod, setBollPeriod] = useState<number>(20);
 const [bollMult, setBollMult] = useState<number>(2);

 const [tab, setTab] = useState<'constructor'|'stats'|'history'>('constructor');
 const [books, setBooks] = useState<BookCfg[]>([
    { id: 'b1', exchange: 'Binance', symbol: 'BTC', depth: 20, minUSD: 3000 },
    { id: 'b2', exchange: 'Bitfinex', symbol: 'ETH', depth: 20, minUSD: 2000 },
    { id: 'b3', exchange: 'Coinbase', symbol: 'XRP', depth: 20, minUSD: 1000 }
 ]);

 const changeBook = (id:string, patch:Partial<BookCfg>) => setBooks(bs=>bs.map(b=>b.id===id?{...b,...patch}:b));
 const removeBook = (id: string) => setBooks(bs => bs.filter(b=>b.id!==id));
 const addBook = () => { if (books.length >= 4) return; const id='b'+Math.random().toString(36).slice(2,7); setBooks(bs => [...bs, { id, exchange: 'Binance', symbol: 'BTC', depth: 20, minUSD: 3000 }]); };

 const [series, setSeries] = useState<number[]>([]);
 const [agg, setAgg] = useState({ bid:0, ask:0, spreadBps:5, momentum:0 });
 const [currentSymbol, setCurrentSymbol] = useState<Symbol>('BTC');

 useEffect(()=>{
  const iv = setInterval(()=>{
    const nodes = Array.from(document.querySelectorAll('[data-notional]')) as HTMLElement[];
    let bid=0, ask=0, spread=0; const pxs:number[]=[]; let sym:Symbol|undefined=undefined;
    nodes.forEach(el=>{
      bid += +(el.dataset.bid||'0');
      ask += +(el.dataset.ask||'0');
      spread += +(el.dataset.spread||'0');
      const p=+(el.dataset.px||'0'); if(p>0) pxs.push(p);
      const s=(el.dataset.sym as Symbol)||undefined; if(s) sym=s;
    });
    const avgSpread = nodes.length? spread/nodes.length : 5;
    const prev = series.length? series[series.length-1] : undefined;
    const prev2 = series.length>1? series[series.length-2] : prev;
    const avgPx = pxs.length? pxs.reduce((a,b)=>a+b,0)/pxs.length : (prev||50000);
    const nextSeries = [...series.slice(-180), avgPx];
    setSeries(nextSeries);
    const mom = prev2? (avgPx - prev2) / Math.max(1, prev2) : 0;
    setAgg({ bid, ask, spreadBps: avgSpread, momentum: mom });
    if (sym) setCurrentSymbol(sym);
  }, 1000);
  return ()=>clearInterval(iv);
 }, [series]);

 return (
  <>
    <StyleTag />
    <div className="header container">
      <div className="brand"><div className="logo" />TRADEFLOW<div className="badge">v2</div></div>
      <div className="settings">
        <label>RU/EN</label>
        <select value={lang} onChange={e=>setLang(e.target.value as Lang)}>
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </select>
        <label>Theme</label>
        <select value={theme} onChange={e=>setTheme(e.target.value as Theme)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <label>{dict.currency}</label>
        <select value={'USD'} onChange={()=>{}}>
          <option>USD</option><option>AUD</option><option>RUB</option><option>BTC</option>
        </select>
        <label>{dict.bigWall}</label>
        <input type="number" value={50000} onChange={()=>{}} style={{width:110}} />
        <label>{dict.bollPeriod}</label>
        <input type="number" min={2} max={200} value={20} onChange={()=>{}} style={{width:70}} />
        <label>{dict.bollMult}</label>
        <input type="number" step={0.5} min={0.5} max={4} value={2} onChange={()=>{}} style={{width:70}} />
      </div>
    </div>

    <div className="container">
      <div className="tabbar">
        <button className={`tab ${'constructor'==='constructor'?'active':''}`}>{dict.constructor}</button>
        <button className={`tab ${''==='stats'?'active':''}`}>{dict.stats}</button>
        <button className={`tab ${''==='history'?'active':''}`}>{dict.history}</button>
      </div>
    </div>

    <div className="container">
      <div style={{display:'flex',gap:12,flex:1,marginLeft:12}}>
        <div style={{flex:1}}>
          <SignalLight totalBid={agg.bid} totalAsk={agg.ask} momentum={agg.momentum} spreadBps={agg.spreadBps} dict={dict} />
        </div>
        <div className="card" style={{flex:'0 0 300px'}}>
          <MiniChart series={series} period={20} mult={2} />
        </div>
      </div>
      <div className={`grid grid-3`} style={{marginTop:12}}>
        {books.map(b => (
          <div key={b.id}>
            <OrderBookCard cfg={b} dict={dict} onChange={()=>{}} onRemove={()=>{}} currency={'USD' as Currency} rates={{AUD:1.5,RUB:90,BTC:1/50000}} bigWall={50000} bollPeriod={20} bollMult={2} />
          </div>
        ))}
      </div>

      <Outlook totalBid={agg.bid} totalAsk={agg.ask} momentum={agg.momentum} spreadBps={agg.spreadBps} dict={dict} />

      <div className="card" style={{marginTop:12}}>
        <div className="small">TradingView — {dict.tvNote}</div>
        <TradingView symbol={currentSymbol} />
      </div>

      <FearGreed />
      <div className="footer">{dict.developed}</div>
    </div>
  </>
 );
}

const Page = dynamic(() => Promise.resolve(App), { ssr: false });
export default Page;
