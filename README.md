# Jaccuweather

A full-featured weather application deployed as a Cloudflare Worker. Vanilla JavaScript, no framework. Proxies free APIs (Open-Meteo, NWS, BigDataCloud, Ventusky, Google Pollen) for CORS, renders everything client-side.

**Live:** [weather.janglim.cloud](https://weather.janglim.cloud)

## Features

### Current Conditions
- Real-time temperature, conditions, feels-like, humidity, wind, UV index
- Sunrise/sunset times with **SVG sun arc**: gold sun rides the half-ellipse path by local solar day; becomes a silver moon after dark (and parks at the ends before dawn / after dusk)
- Moon phase with clickable detail modal
- Pressure with trend indicator
- Air quality index (when available)
- Manual refresh button with spin animation

### 48-Hour Forecast
- Three toggle views: Conditions, Precipitation, Wind (iOS 27-style pill toggle)
- Precipitation intensity bars scaled to the 48h window
- Wind direction arrows (rotated to meteorological bearing)
- Uniform chip sizing across all toggle modes
- Click header to open modal with 9 ApexCharts graphs (temp, precip, wind, humidity, pressure, snow, cloud, brightness, tides)

### 14-Day Forecast
- Daily highs/lows, precipitation, snowfall, wind, feels-like temperatures
- Week 1 / Week 2 separators for scannable grouping
- Tide summaries per day (coastal locations only, via NOAA)
- Click header to open modal with 11 ApexCharts graphs (temp, feels-like, nice weather, precip, wind, pressure, snow, cloud, brightness, tides, moon phase)

### Health Tiles
- **Sinus Risk** - Barometric pressure change, humidity, precipitation, temperature swing. Click for methodology modal with LaTeX formulas.
- **Allergy Risk** - Real pollen counts (Google Pollen API primary, Tomorrow.io fallback, Open-Meteo tertiary). Wind dispersal and rain washout factors. Click for methodology.
- **Nice Weather Index** - Comfort score from 0-10 subtracting points for adverse conditions. Click for reasoning breakdown modal.

### Pollen Forecast
- Current tree/grass/weed levels with color-coded severity
- 5-day pollen forecast
- Google Pollen API with Tomorrow.io and Open-Meteo fallbacks

### Weather Radar
- Ventusky iframe embed with framebreaker neutralization
- Auto-centering on current or searched location
- Mobile zoom level 5, desktop zoom level 7

### NWS Weather Alerts
- US-only severe weather alerts from the National Weather Service
- Alert banner displayed above the main content

### Tide Data
- NOAA tide predictions for coastal locations
- 48h tide charts in hourly modal, 14-day tide forecast in daily modal
- Coastal detection based on NOAA station proximity and elevation
- High/low tide markers on charts

### Location & Search
- Autocomplete search with Open-Meteo geocoding
- Geolocation button for current location
- Favorites system (IndexedDB with localStorage fallback)
- Reverse geocoding via BigDataCloud (cleaned of API artifacts)
- US state abbreviation normalization

## Design (Horizon)

Visual language is the **Horizon** redesign (merged July 2026): glass over dynamic sky, serif location names, sticky pill chrome. Identity stays Jaccuweather (`🌤️` logo) — reference language for chrome only.

| Token | Value |
|-------|--------|
| Body font | **DM Sans** (UI) |
| Display font | **Lora** (location names / hero serif) |
| Accent | `#7dd3fc` soft sky blue |
| Sun gold | `#fbbf24` (day marker + UV accents) |
| Glass | `rgba(255,255,255,0.12)` + blur 24px / saturate 1.4 |
| Glass border | `rgba(255,255,255,0.22)` |
| Max content width | 920px |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` |

### Dark / light mode

Header sun/moon toggle, persisted in `localStorage('jaccuweather-theme')`.

| Mode | Background behavior |
|------|---------------------|
| **Dark (default)** | Static deep-blue loading color — **no** weather reactivity |
| **Light** | Weather-reactive gradients via `setTheme(wmo, isDay)` on `#bgLayer` |

Same glass cards and light text in both modes. The only difference is whether the background reacts to conditions.

### Weather-reactive backgrounds (light mode)

Full-viewport `#bgLayer` themes from WMO code + `is_day`: sunny, clear-night, cloudy, rainy, storm, snow, fog. Soft radial + linear gradients with ~1.2s crossfade and a light noise overlay.

### Sun / moon arc

Hero row: sunrise label | arc | sunset label.

- Arc is an **SVG half-ellipse** path (not a CSS border hack)
- Marker is a 12px HTML disc so it stays circular when the arc is wide
- Position uses local sunrise/sunset wall-clock times + `utc_offset_seconds` (Open-Meteo `timezone=auto`), so LA/Tokyo aren’t judged in the browser’s zone
- Day: gold sun; night: silver moon (`.sun-dot.is-moon`)
- Recomputed after layout (post-`showContent`), on location change, resize, and once a minute

### Glass UI

- Backdrop-blur cards, inner highlights, tinted shadows
- Stat tiles grouped **Conditions / Atmosphere / Health**
- Skeleton loaders sized to match loaded layout (hero, hourly chips, daily rows, radar)
- Favorites / autocomplete dropdowns use **opaque** slate glass (`rgba(15,23,42,0.95)`), not content-card glass
- Tailwind gray utilities inside cards overridden to theme text tokens for contrast on translucent surfaces

### Interactions & a11y

- Spring-easing transitions; active press `scale(0.98)`; global `:focus-visible`
- Reduced-motion respected; mobile chart scrubbing with `touch-action: pan-y`
- Sticky single-row header: brand emoji + flexible search + round action buttons (no wrap on small screens)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES6+), Tailwind CSS (CDN), ApexCharts, SunCalc, Font Awesome, Leaflet, MathJax |
| Backend | Cloudflare Worker (serverless edge) |
| Weather API | Open-Meteo (forecast, geocoding, air quality) |
| Pollen API | Google Pollen API (primary), Tomorrow.io (fallback), Open-Meteo (tertiary) |
| Radar | Ventusky (iframe with proxy) |
| Alerts | NWS Weather Alerts API (US only) |
| Tides | NOAA Tides and Currents API |
| Reverse Geocoding | BigDataCloud (free tier) |
| Charts | ApexCharts 4.7.0 (monotoneCubic curves, gradient area fills, mobile-optimized) |
| Math Rendering | MathJax 3 (LaTeX for methodology formulas) |
| Build | Node.js, Wrangler, Sharp (favicon conversion) |

## Project Structure

```
jaccuweather/
├── public/
│   ├── index.html           # HTML structure + embedded Horizon CSS (~1750 lines)
│   ├── app.js               # All frontend logic (~4900 lines)
│   └── favicon.svg          # SVG favicon source
├── src/
│   └── index.js             # Auto-generated Cloudflare Worker (DO NOT EDIT)
├── build.js                 # Worker generator: embeds assets, defines API proxy routes
├── convert-favicon.js       # SVG to PNG for iOS touch icon
├── wrangler.toml             # Worker config
├── package.json             # Dependencies and scripts
└── README.md
```

## Development

### Prerequisites
- Node.js v16+
- npm
- Cloudflare account (account ID: ``)

### Quick Start

```bash
npm install
npm run build          # Generates src/index.js from public/*
npm run dev            # Build + local wrangler dev server
```

Default dev port is 8787. If occupied, use `npx wrangler dev --port 8793`.

### Build Commands

| Command | What it does |
|---------|-------------|
| `npm run build` | Generates `src/index.js` from `public/*` via `build.js` |
| `npm run dev` | Build + start local wrangler dev server |
| `npm run deploy` | Build + deploy to Cloudflare Workers |
| `node --check public/app.js` | Syntax check before build |
| `node --check build.js` | Syntax check build script |

### Deploy

```bash
npm run build
CLOUDFLARE_ACCOUNT_ID= npx wrangler deploy
```

Verify: `curl -sSI https://weather.janglim.cloud | head -n5`

### Remote Preview with Worker Secrets

Local `wrangler dev` does not have remote Worker secrets (e.g., `GOOGLE_POLLEN_API_KEY`). For secrets-backed previews:

```bash
npx wrangler dev --remote --ip 127.0.0.1 --port 8789
```

## API Routes (Cloudflare Worker)

| Route | Upstream | Notes |
|-------|----------|-------|
| `/` | (embedded HTML) | Serves index.html |
| `/app.js` | (embedded JS) | Serves app.js |
| `/favicon.svg` | (embedded) | 1-year cache |
| `/apple-touch-icon.png` | (embedded base64) | 1-year cache |
| `/api/forecast` | `api.open-meteo.com/v1/forecast` | 10-min cache, retry on 429 |
| `/api/geocoding` | `geocoding-api.open-meteo.com/v1/search` | 1-hour cache |
| `/api/reverse` | `api.bigdatacloud.net/data/reverse-geocode-client` | No cache |
| `/api/air-quality` | `air-quality-api.open-meteo.com/v1/air-quality` | Pollen fallback |
| `/api/pollen` | `pollen.googleapis.com` (primary) | Google Pollen API with `GOOGLE_POLLEN_API_KEY` secret, falls back to Tomorrow.io then Open-Meteo |
| `/api/alerts` | `api.weather.gov/alerts` | US only, requires User-Agent header |
| `/api/nws-points` | `api.weather.gov/points` | Forecast zone lookup |
| `/api/nws-wms` | `opengeo.ncep.noaa.gov/geoserver/ows` | Radar WMS tiles, 5-min cache |
| `/ventusky-proxy/*` | `www.ventusky.com` | Desktop UA, framebreaker neutralizer |

## Environment Variables

| Secret | Required | Purpose |
|--------|----------|---------|
| `GOOGLE_POLLEN_API_KEY` | Optional | Enables Google Pollen API as primary pollen source. Without it, falls back to Tomorrow.io then Open-Meteo. |

Set via: `npx wrangler secret put GOOGLE_POLLEN_API_KEY`

## Live URLs

- **Custom domain:** [weather.janglim.cloud](https://weather.janglim.cloud)
- **Workers subdomain:** weather-app.jackanglim3.workers.dev

## Credits

- **Weather Data:** [Open-Meteo](https://open-meteo.com/)
- **Pollen Data:** Google Pollen API, [Open-Meteo Air Quality API](https://air-quality-api.open-meteo.com/)
- **Weather Maps:** [Ventusky](https://www.ventusky.com/)
- **NWS Alerts & Radar:** [National Weather Service](https://www.weather.gov/)
- **Tide Data:** [NOAA Tides and Currents](https://tidesandcurrents.noaa.gov/)
- **Moon Calculations:** [SunCalc.js](https://github.com/mourner/suncalc)
- **Charts:** [ApexCharts](https://apexcharts.com/)
- **Math Rendering:** [MathJax](https://www.mathjax.org/)
- **Icons:** [Font Awesome](https://fontawesome.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Reverse Geocoding:** [BigDataCloud](https://www.bigdatacloud.com/)
- **Fonts:** [DM Sans](https://fonts.google.com/specimen/DM+Sans) (UI), [Lora](https://fonts.google.com/specimen/Lora) (display)

## License

MIT

## Author

Jack Anglim - maintained by TARS