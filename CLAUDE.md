# CLAUDE.md - AI Assistant Guide for Jaccuweather

## Project Overview

Jaccuweather is a modern weather application deployed as a **Cloudflare Worker**. It provides real-time weather forecasts, interactive radar maps, health-focused forecasting (sinus/allergy risk), and detailed meteorological data using free, open APIs.

**Live URL**: Deployed to Cloudflare Workers (serverless edge computing)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript (ES6+), Tailwind CSS (CDN), Chart.js, SunCalc.js |
| Backend | Cloudflare Workers (serverless) |
| APIs | Open-Meteo (weather), BigDataCloud (geocoding), Ventusky (radar) |
| Build | Node.js, Sharp (image processing), Wrangler CLI |

**No API keys required** - all services used are free and open.

## Project Structure

```
jaccuweather/
├── public/                    # Source files (edit these)
│   ├── index.html            # Main HTML with embedded styles (~850 lines)
│   ├── app.js                # Frontend JavaScript (~2700 lines)
│   ├── favicon.svg           # SVG favicon
│   └── apple-touch-icon.png  # iOS icon (auto-generated)
├── src/
│   └── index.js              # Generated Cloudflare Worker (DO NOT EDIT)
├── build.js                  # Build script - embeds assets into worker
├── convert-favicon.js        # SVG to PNG converter for iOS
├── wrangler.toml             # Cloudflare Worker configuration
├── package.json              # Dependencies and npm scripts
└── README.md                 # User documentation
```

## Development Commands

```bash
npm install          # Install dependencies (first time only)
npm run build        # Build worker file (generates src/index.js)
npm run dev          # Build + start local dev server (http://localhost:8787)
npm run deploy       # Build + deploy to Cloudflare Workers
```

## Architecture

### Build Process
The build system (`build.js`) embeds all assets into a single worker file:
1. Converts `favicon.svg` to PNG for iOS
2. Reads HTML, JS, and assets from `public/`
3. Generates `src/index.js` with embedded content
4. Worker serves assets and proxies API requests

### Key Architectural Decisions
- **Single-file deployment**: Everything bundled into `src/index.js`
- **API proxying**: Worker proxies all external APIs to handle CORS
- **Client-side storage**: IndexedDB + localStorage for favorites (no server-side state)
- **No framework**: Pure vanilla JS for minimal bundle size

### API Routes (in src/index.js)
| Route | Purpose |
|-------|---------|
| `/` | Serves HTML |
| `/app.js` | Serves JavaScript |
| `/api/forecast` | Proxy to Open-Meteo weather API |
| `/api/geocoding` | Proxy to Open-Meteo geocoding |
| `/api/reverse` | Proxy to BigDataCloud reverse geocoding |
| `/api/air-quality` | Proxy to Open-Meteo pollen data |
| `/api/alerts` | Proxy to NWS weather alerts (US only) |
| `/api/nws-wms` | Proxy for NWS radar WMS tiles |
| `/ventusky-proxy/*` | Proxy for Ventusky weather maps |

## Key Files to Edit

### `public/app.js` - Main Application Logic
- **State variables** (lines 1-8): `currentLat`, `currentLon`, `currentWeatherData`, `favorites`
- **Favorites system** (lines 16-200): IndexedDB with localStorage fallback
- **Weather fetching** (search for `fetchWeather`): Main data fetch function
- **Display rendering** (search for `displayWeather`): Updates all UI sections
- **Health calculations** (search for `calculateSinusRisk`, `calculateAllergyRisk`): Risk algorithms
- **Modal handlers** (search for `openHourlyModal`, `openDailyModal`): Detail views
- **Radar initialization** (search for `initializeVentuskyRadar`): Ventusky iframe setup

### `public/index.html` - Structure and Styles
- **CDN imports** (lines 16-45): Tailwind, Chart.js, SunCalc, Font Awesome, Leaflet
- **Custom styles** (lines 46-300): Dark theme, glassmorphism cards, animations
- **Main sections**: Search bar, current weather, hourly/daily forecasts, health tiles, radar
- **Modals**: Hourly detail, daily detail, sinus/allergy methodology

### `build.js` - Worker Generation
- Generates the Cloudflare Worker with embedded assets
- Handles API proxy routing and CORS
- Includes rate limit handling and caching logic

## Code Conventions

### JavaScript Style
- **ES6+ syntax**: Arrow functions, template literals, async/await
- **No TypeScript**: Plain JavaScript throughout
- **Global state**: Module-level variables for app state
- **DOM manipulation**: Direct `document.getElementById()` and innerHTML

### CSS/Styling
- **Tailwind CSS**: Utility classes for most styling
- **Custom CSS**: In `<style>` block in index.html
- **Dark theme**: Navy/blue gradient background, glassmorphism cards
- **Responsive**: Mobile-first with Tailwind breakpoints

### Naming Conventions
- **Functions**: camelCase (`fetchWeather`, `displayCurrentWeather`)
- **Variables**: camelCase (`currentLat`, `weatherData`)
- **DOM IDs**: camelCase (`hourlyForecast`, `weatherRadar`)
- **CSS classes**: Tailwind utilities + custom `.card`, `.skeleton`, `.modal`

## Common Tasks

### Adding a New Weather Metric
1. Check Open-Meteo API docs for available parameters
2. Add parameter to API URL in `fetchWeather()` function in `app.js`
3. Add display element in `index.html`
4. Update `displayWeather()` to render the new data

### Modifying API Proxy
1. Edit `build.js` (the API routing section, around line 86+)
2. Add new route handler in the `if (url.pathname.startsWith('/api/'))` block
3. Run `npm run build` to regenerate worker

### Adding a New Health Metric
1. Add calculation function in `app.js` (follow pattern of `calculateSinusRisk`)
2. Add display tile in `index.html`
3. Add methodology modal if transparency is needed

### Updating Radar Integration
- Ventusky iframe settings are in `initializeVentuskyRadar()` function
- NWS WMS proxy is handled in `build.js` under `/api/nws-wms`

## Testing

**No formal test framework** - testing is manual:
1. Run `npm run dev` for local testing
2. Open http://localhost:8787 in browser
3. Test on mobile using browser DevTools device mode
4. Check browser console for errors

### Test Checklist
- [ ] Location search and geolocation
- [ ] Favorites add/remove/switch
- [ ] Current weather display
- [ ] Hourly forecast (cards + modal)
- [ ] Daily forecast (cards + modal)
- [ ] Health tiles (sinus/allergy risk)
- [ ] Radar map loads and centers correctly
- [ ] Mobile responsiveness

## Important Notes

### DO NOT EDIT
- `src/index.js` - Auto-generated by build process, will be overwritten

### Git Ignored
- `testing/` folder - Used for experimental UI work
- `node_modules/`, `.wrangler/`, `.env` files

### Rate Limits
- Open-Meteo has rate limits; worker includes retry logic with exponential backoff
- Caching: 10 minutes for forecasts, 1 hour for geocoding results

### Browser Storage
- Primary: IndexedDB (`WeatherAppDB` database, `favorites` store)
- Backup: localStorage (`weatherFavorites` key)
- Auto-migration from localStorage to IndexedDB on first load

### Mobile Considerations
- Ventusky radar uses more zoom on mobile (zoom level 5 vs 7 on desktop)
- Touch icons configured for iOS PWA support
- Safe scrolling prevents accidental navigation when scrolling past radar

## External API Reference

### Open-Meteo Weather API
- Base URL: `https://api.open-meteo.com/v1/forecast`
- No API key required
- Provides: temperature, humidity, precipitation, wind, UV, pressure

### Open-Meteo Air Quality API
- Base URL: `https://air-quality-api.open-meteo.com/v1/air-quality`
- No API key required
- Provides: pollen counts (tree, grass, weed)

### BigDataCloud Reverse Geocoding
- Base URL: `https://api.bigdatacloud.net/data/reverse-geocode-client`
- No API key required (free tier)
- Provides: city, state, country names from coordinates

### National Weather Service (NWS)
- Alerts API: `https://api.weather.gov/alerts`
- WMS Radar: `https://opengeo.ncep.noaa.gov/geoserver/ows`
- US only; requires User-Agent header

### Ventusky
- Embedded via iframe
- Proxied through `/ventusky-proxy/` to use desktop user agent

## Deployment

```bash
# First time setup
npm install
npx wrangler login

# Deploy
npm run deploy
```

The worker is deployed to Cloudflare's global edge network for low-latency worldwide access.

## Troubleshooting

### Build Fails
- Ensure Node.js v16+ is installed
- Delete `node_modules` and run `npm install`
- Check Sharp installation (may need Python/build tools)

### API Errors
- Check browser console for specific error messages
- Open-Meteo rate limit: wait 1-2 minutes
- NWS alerts: only works for US locations

### Radar Not Loading
- Check browser console for iframe errors
- Verify Ventusky proxy is working
- Try clearing browser cache

### Favorites Not Persisting
- Check IndexedDB in browser DevTools (Application tab)
- May need to clear site data and reload if corrupted
