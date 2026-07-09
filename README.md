# Jaccuweather

A full-featured weather app that runs as a single [Cloudflare Worker](https://workers.cloudflare.com/). Vanilla JavaScript (no framework), client-side rendering, and free public APIs. The Worker embeds the HTML/JS and proxies external APIs so the browser does not hit CORS walls.

**Demo:** [weather.janglim.cloud](https://weather.janglim.cloud)

## What you get

- Current conditions (temp, feels-like, humidity, wind, UV, pressure trend, AQI)
- Sunrise / sunset arc (sun along the path by day, moon after dark)
- Moon phase detail modal
- 48-hour forecast with Conditions / Precipitation / Wind toggle
- 14-day forecast with week separators
- Detail modals with ApexCharts (hourly and daily)
- Health scores: sinus risk, allergy risk, nice-weather index (with methodology modals)
- Pollen levels and 5-day pollen forecast
- Ventusky radar (location-centered)
- NWS alerts (US)
- NOAA tides on coastal locations
- City search with autocomplete, geolocation, and local favorites

Core weather works **without any API keys**. Optional keys improve pollen coverage.

## Requirements

- [Node.js](https://nodejs.org/) 16+
- npm
- A [Cloudflare](https://dash.cloudflare.com/) account (free tier is enough)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm install`)

## Quick start

```bash
git clone https://github.com/janglimTARS/jaccuweather.git
cd jaccuweather
npm install
```

### Configure Cloudflare

1. Open `wrangler.toml` and set your own `account_id` (or remove the line and let Wrangler use your default account after login).
2. Log in once:

```bash
npx wrangler login
```

### Run locally

```bash
npm run dev
```

Open the URL Wrangler prints (default `http://127.0.0.1:8787`).

If port 8787 is busy:

```bash
npm run build
npx wrangler dev --ip 127.0.0.1 --port 8793
```

**Important:** edit files under `public/`. Then rebuild (or restart `npm run dev`) so `src/index.js` is regenerated. Do not hand-edit `src/index.js` — the build overwrites it.

### Deploy

```bash
npm run deploy
```

That builds and deploys the Worker named `weather-app` from `wrangler.toml`. After deploy, attach a custom domain in the Cloudflare dashboard if you want one.

Optional: set account ID only for that command:

```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id npm run deploy
```

## Optional secrets

Pollen works without secrets via Open-Meteo. For better coverage, add Worker secrets:

| Secret | Required | Purpose |
|--------|----------|---------|
| `GOOGLE_POLLEN_API_KEY` | No | Primary pollen source (Google Pollen API) |
| `TOMORROW_API_KEY` | No | Secondary pollen fallback |

```bash
npx wrangler secret put GOOGLE_POLLEN_API_KEY
npx wrangler secret put TOMORROW_API_KEY
```

Local `wrangler dev` does **not** load remote secrets by default. To test with production secrets:

```bash
npx wrangler dev --remote --ip 127.0.0.1 --port 8789
```

## Project layout

```
jaccuweather/
├── public/
│   ├── index.html      # UI + CSS (edit this)
│   ├── app.js          # Frontend logic (edit this)
│   └── favicon.svg
├── src/
│   └── index.js        # Generated Worker — do not edit
├── build.js            # Embeds public/* and defines API proxy routes
├── convert-favicon.js  # SVG → PNG for Apple touch icon (uses sharp)
├── wrangler.toml
└── package.json
```

| Script | Description |
|--------|-------------|
| `npm run build` | Generate `src/index.js` from `public/*` |
| `npm run dev` | Build + local Worker dev server |
| `npm run deploy` | Build + deploy to Cloudflare |

Syntax check before shipping:

```bash
node --check public/app.js && node --check build.js && npm run build && node --check src/index.js
```

## How it works

1. `build.js` inlines `public/index.html`, `public/app.js`, and assets into a Worker.
2. The Worker serves the app and proxies `/api/*` (and Ventusky) with caching where useful.
3. The browser fetches weather from the Worker (or Open-Meteo ensemble directly for the main forecast), then renders UI, charts, radar, and health metrics client-side.
4. Favorites live in IndexedDB (with localStorage fallback). Theme preference is stored in the browser only.

### Worker routes

| Route | Upstream |
|-------|----------|
| `/`, `/app.js`, favicons | Embedded static assets |
| `/api/forecast` | Open-Meteo forecast |
| `/api/geocoding` | Open-Meteo geocoding |
| `/api/reverse` | BigDataCloud reverse geocode |
| `/api/air-quality` | Open-Meteo air quality / pollen |
| `/api/pollen` | Google Pollen → Tomorrow.io → Open-Meteo |
| `/api/alerts` | NWS alerts (US) |
| `/api/nws-points` | NWS points |
| `/api/nws-wms` | NWS radar WMS |
| `/ventusky-proxy/*` | Ventusky (iframe-friendly proxy) |

### UI notes (for theming)

- **Fonts:** DM Sans (UI), Lora (location titles)
- **Accent:** soft sky blue; sun marker gold
- **Layout:** glass cards over a full-page background, max width ~920px
- **Theme toggle:** dark keeps a static deep-blue background; light applies weather-based gradients (sunny, cloudy, rain, storm, snow, fog, clear night)
- **Sun arc:** SVG path in the hero; marker position follows location-local sunrise/sunset

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Changes in `public/` don’t show up | Run `npm run build` and restart `wrangler dev` |
| `sharp` missing on build | Optional — favicon PNG conversion warns and continues. `npm install` should install it as a devDependency |
| Pollen always empty | Coverage varies by location; optional Google/Tomorrow secrets help. Without them Open-Meteo is used |
| Radar blank / navigates away | Keep the Ventusky proxy route; it neutralizes frame-busting scripts |
| NWS alerts fail | US locations only; Worker must send a User-Agent (already set in `build.js`) |
| Wrong account on deploy | Set `account_id` in `wrangler.toml` or `CLOUDFLARE_ACCOUNT_ID` |

## Credits

| Role | Source |
|------|--------|
| Forecast / geocoding / air quality | [Open-Meteo](https://open-meteo.com/) |
| Pollen | Google Pollen API, Tomorrow.io, Open-Meteo |
| Maps | [Ventusky](https://www.ventusky.com/) |
| Alerts / radar tiles | [NWS](https://www.weather.gov/) |
| Tides | [NOAA](https://tidesandcurrents.noaa.gov/) |
| Moon times | [SunCalc.js](https://github.com/mourner/suncalc) |
| Charts | [ApexCharts](https://apexcharts.com/) |
| Math in methodology | [MathJax](https://www.mathjax.org/) |
| Icons | [Font Awesome](https://fontawesome.com/) |
| CSS utilities | [Tailwind CSS](https://tailwindcss.com/) |
| Reverse geocode | [BigDataCloud](https://www.bigdatacloud.com/) |
| Fonts | [DM Sans](https://fonts.google.com/specimen/DM+Sans), [Lora](https://fonts.google.com/specimen/Lora) |

## License

MIT

## Author

Jack Anglim
