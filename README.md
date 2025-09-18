
# Tradeflow Order Book Aggregator — Next.js

Ready to deploy on **Vercel**.

## Run locally
```bash
npm i
npm run dev
# open http://localhost:3000
```

## Build
```bash
npm run build && npm start
```

## Notes
- Uses live FX: exchangerate.host (AUD/RUB) and CoinGecko (BTC).
- TradingView widget is loaded on client only.
- WebSocket feeds: Binance/Bitfinex/Coinbase with fallback simulator.
- Sorting: USD / COIN / PRICE.
- Settings: Theme, Language (RU/EN), Currency (USD/AUD/RUB/BTC), Big‑wall threshold, Bollinger period/multiplier.

If you need HARSI as a built-in study (not just RSI), we can add a custom oscillator panel in a follow-up.
