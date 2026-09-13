# Frontend integration

Two files from the React project's `src/services/marketData/`, already updated to use this proxy:

- `proxyProvider.ts` — copy into `src/services/marketData/proxyProvider.ts`
- `marketData-index.ts` — replaces `src/services/marketData/index.ts` (renamed here only to avoid a filename clash in this folder)

Then add `VITE_API_BASE_URL=https://your-deployed-proxy-url` to the React project's `.env.local`. That's the whole integration — no component changes needed, since everything already goes through the `MarketDataProvider` interface.

If you're using the standalone HTML preview instead of the React project, edit the `const API_BASE_URL = '';` line near the top of that file's `<script>` tag to point at your deployed proxy instead.
