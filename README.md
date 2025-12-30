# Weather App - Cloudflare Worker

A fully featured weather website built as a Cloudflare Worker, using the Open-Meteo API for weather data and Tailwind CSS for styling.

## Features

- 🌤️ **Current Weather Display** - Shows current temperature, conditions, humidity, wind speed, and UV index
- 📅 **7-Day Forecast** - Extended weather forecast with daily highs, lows, precipitation, and wind
- ⏰ **24-Hour Forecast** - Hourly weather predictions for the next 24 hours
- 🔍 **Location Search** - Search for any city or location worldwide
- 📍 **Geolocation** - Automatically detects and displays weather for your current location
- 🎨 **Modern UI** - Beautiful gradient design with glassmorphism effects using Tailwind CSS
- ⚡ **Fast & Lightweight** - Deployed on Cloudflare's edge network for global performance

## Tech Stack

- **Cloudflare Workers** - Serverless deployment platform
- **Open-Meteo API** - Free, open-source weather API
- **Tailwind CSS** - Utility-first CSS framework
- **Font Awesome** - Icon library
- **Vanilla JavaScript** - No framework dependencies

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Run locally:**
   ```bash
   npm run dev
   ```

4. **Deploy to Cloudflare:**
   ```bash
   npm run deploy
   ```

   Note: You'll need to authenticate with Cloudflare first:
   ```bash
   npx wrangler login
   ```

## Project Structure

```
Weather/
├── public/
│   ├── index.html    # Main HTML template
│   └── app.js        # Frontend JavaScript
├── src/
│   └── index.js      # Cloudflare Worker (auto-generated)
├── build.js          # Build script
├── package.json      # Dependencies and scripts
├── wrangler.toml     # Cloudflare Worker configuration
└── README.md         # This file
```

## API Endpoints

The worker proxies requests to the Open-Meteo API:

- `/api/forecast` - Weather forecast data
- `/api/geocoding` - Location search and reverse geocoding

## Features in Detail

### Current Weather
- Temperature (actual and feels like)
- Weather condition description
- Relative humidity
- Wind speed
- UV index

### Hourly Forecast
- Next 24 hours of weather
- Temperature for each hour
- Weather conditions
- Wind speed

### Daily Forecast
- 7-day extended forecast
- Daily high and low temperatures
- Precipitation totals
- Maximum wind speeds

## Browser Support

- Modern browsers with ES6+ support
- Geolocation API support (optional, falls back to default location)
- Fetch API support

## License

MIT

## Credits

- Weather data provided by [Open-Meteo](https://open-meteo.com/)
- Icons by [Font Awesome](https://fontawesome.com/)
- Styling by [Tailwind CSS](https://tailwindcss.com/)

