# Jaccuweather

A fully featured, modern weather website built as a Cloudflare Worker. Jaccuweather provides real-time weather forecasts, interactive radar maps, health-focused symptom risk forecasting, and detailed meteorological data using the Open-Meteo API and Ventusky for radar visualization.

## 🌟 Features

### Core Weather Features
- 🌤️ **Current Weather Display** - Real-time temperature, conditions, humidity, wind speed, UV index, and "feels like" temperature
- 📅 **14-Day Forecast** - Extended weather forecast with daily highs, lows, precipitation totals, snowfall, wind speeds, sunrise/sunset times, and moon phases
- ⏰ **24-Hour Forecast** - Detailed hourly weather predictions with interactive charts showing temperature, precipitation probability, and conditions
- ❄️ **Weekly Snow Totals** - Displays cumulative snowfall predictions for the week when snow is in the forecast
- 🌙 **Moon Phase Data** - Comprehensive moon phase information including illumination, moonrise/moonset times, distance, and next full/new moon dates
- 📊 **Interactive Charts** - Visual temperature, precipitation, wind, and moon phase charts for extended forecasts

### Health & Wellness Features
- 🤧 **Sinus Risk Forecasting** - Calculates risk of sinus discomfort based on barometric pressure changes, humidity, precipitation, and temperature swings
- 🌿 **Allergy Risk Forecasting** - Estimates pollen allergy risk using real pollen count data (tree, grass, weed) from Open-Meteo Air Quality API
- 🏥 **Pollen Forecast** - Current pollen levels and 5-day pollen forecast with detailed breakdowns by pollen type
- 📋 **Health Methodology** - Detailed calculation formulas with LaTeX mathematical expressions for complete transparency

### Location Features
- 🔍 **Location Search** - Search for any city or location worldwide with autocomplete
- 📍 **Geolocation** - Automatically detects and displays weather for your current location
- ⭐ **Favorites System** - Save and quickly access your favorite locations
- 🔄 **Reverse Geocoding** - Automatically displays location names for coordinates

### Radar & Maps
- 🗺️ **Interactive Weather Radar** - Embedded Ventusky precipitation map with real-time weather visualization
- 📍 **Location-Based Radar** - Radar automatically centers on your current or searched location
- 🎯 **Responsive Design** - Optimized radar view for both desktop and mobile devices
- 🔒 **Safe Browsing** - Prevents accidental navigation when scrolling past the radar

### User Experience
- 🎨 **Modern UI** - Beautiful gradient design with glassmorphism effects using Tailwind CSS
- 📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile devices
- ⚡ **Fast & Lightweight** - Deployed on Cloudflare's edge network for global performance
- 🌙 **Dark Theme** - Easy-on-the-eyes dark color scheme
- 📱 **PWA Ready** - Apple touch icons and mobile web app support

### Technical Features
- 🔄 **API Proxy** - Cloudflare Worker proxies API requests to avoid CORS issues
- 🛡️ **Error Handling** - Comprehensive error handling with user-friendly messages
- 💾 **Local Storage** - Favorites and preferences saved locally
- 🚫 **Rate Limit Handling** - Graceful handling of API rate limits

## 🛠️ Tech Stack

### Frontend
- **Vanilla JavaScript** - No framework dependencies, pure ES6+
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Font Awesome** - Icon library for UI elements
- **Chart.js** - Interactive charts for weather data visualization
- **SunCalc.js** - Accurate astronomical calculations for moon phases, moonrise/moonset times, and moon distance

### Backend & Infrastructure
- **Cloudflare Workers** - Serverless deployment platform for edge computing
- **Open-Meteo API** - Free, open-source weather API for forecast data and air quality/pollen information
- **Ventusky** - Interactive weather maps and radar visualization
- **BigDataCloud API** - Reverse geocoding service (free tier)
- **MathJax** - LaTeX mathematical rendering for formula display

### Development Tools
- **Wrangler** - Cloudflare Workers CLI for development and deployment
- **Node.js** - Build tooling and dependencies
- **Sharp** - Image processing for favicon conversion

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Cloudflare account (for deployment)
- Git (for version control)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anglim3/jaccuweather.git
   cd jaccuweather
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```
   This generates the Cloudflare Worker file (`src/index.js`) by embedding HTML, JavaScript, and assets.

4. **Run locally:**
   ```bash
   npm run dev
   ```
   This builds the project and starts a local development server using Wrangler.

### Deployment

1. **Authenticate with Cloudflare:**
   ```bash
   npx wrangler login
   ```

2. **Deploy to Cloudflare Workers:**
   ```bash
   npm run deploy
   ```
   This builds the project and deploys it to Cloudflare's edge network.

## 📁 Project Structure

```
Weather/
├── public/
│   ├── index.html           # Main HTML template with embedded styles
│   ├── app.js               # Frontend JavaScript (weather logic, UI interactions)
│   ├── favicon.svg          # SVG favicon
│   └── apple-touch-icon.png # iOS home screen icon (auto-generated)
├── src/
│   └── index.js             # Cloudflare Worker (auto-generated by build.js)
├── testing/                 # Local development/testing (git-ignored)
│   ├── index.html           # Experimental UI designs
│   └── app.js               # Test JavaScript
├── build.js                 # Build script that embeds assets into worker
├── convert-favicon.js       # Converts SVG favicon to PNG for iOS
├── backup.sh                # Automated backup script for Git
├── package.json             # Dependencies and npm scripts
├── wrangler.toml            # Cloudflare Worker configuration
└── README.md                # This file
```

## 🔌 API Endpoints

The Cloudflare Worker provides the following endpoints:

### Main Routes
- `/` or `/index.html` - Serves the main HTML page
- `/app.js` - Serves the JavaScript application
- `/favicon.svg` - SVG favicon
- `/apple-touch-icon.png` - iOS touch icon

### Proxy Routes
- `/api/forecast` - Proxies requests to Open-Meteo forecast API
- `/api/geocoding` - Proxies requests to Open-Meteo geocoding API
- `/api/reverse` - Proxies requests to BigDataCloud reverse geocoding API
- `/api/air-quality` - Proxies requests to Open-Meteo Air Quality API (includes pollen data)
- `/ventusky-proxy/*` - Proxies Ventusky requests with desktop user agent to avoid mobile app prompts

## 📋 Features in Detail

### Current Weather Display
- **Temperature**: Current temperature in Fahrenheit
- **Feels Like**: Apparent temperature accounting for wind and humidity
- **Conditions**: Weather description (sunny, cloudy, rain, etc.)
- **Humidity**: Relative humidity percentage
- **Wind Speed**: Current wind speed in mph
- **UV Index**: Current UV index level
- **Sunrise/Sunset**: Times for the current day

### Hourly Forecast
- **24-Hour View**: Detailed forecast for the next 24 hours
- **Interactive Chart**: Visual temperature graph with Chart.js
- **Hour-by-Hour Data**: Temperature, conditions, precipitation probability, and wind speed
- **Modal View**: Click header to open expanded modal with full details

### Daily Forecast
- **14-Day Extended Forecast**: Complete two-week weather predictions
- **Daily Highs/Lows**: Maximum and minimum temperatures
- **Precipitation**: Daily precipitation totals and probability
- **Snowfall**: Daily snowfall accumulation
- **Wind**: Maximum wind speeds
- **Sunrise/Sunset**: Daily sunrise and sunset times
- **Moon Phases**: Moon phase emoji and name for each day
- **Modal View**: Click header to open expanded modal with full details, charts, and moon phase information

### Weekly Snow Totals
- **Automatic Display**: Only appears when snow is in the forecast
- **Cumulative Totals**: Shows total expected snowfall for the week
- **Daily Breakdown**: Individual day snowfall amounts

### Favorites System
- **Save Locations**: Add current location to favorites
- **Quick Access**: Dropdown menu for quick location switching
- **Local Storage**: Favorites persist across browser sessions
- **Remove Favorites**: Easy removal of saved locations

### Health & Wellness Features

#### Sinus Risk Forecasting
- **Risk Calculation**: Estimates sinus discomfort risk based on meteorological factors that commonly trigger sinus symptoms
- **Factors Considered**:
  - Barometric pressure changes (sudden drops can cause sinus pressure)
  - High humidity levels (>70%)
  - Precipitation events
  - Temperature swings (>20°F daily change)
- **Risk Levels**: Low (0-2), Moderate (3-4), High (5-7), Very High (8-10)
- **Methodology Modal**: Click the Sinus tile to see detailed calculation formulas with LaTeX mathematical expressions

#### Allergy Risk Forecasting
- **Pollen-Based Calculation**: Uses real pollen count data from Open-Meteo Air Quality API for accurate allergy risk assessment
- **Pollen Types Tracked**: Tree pollen (Alder, Birch, Olive), Grass pollen, Weed pollen (Mugwort, Ragweed)
- **Risk Scoring**:
  - Very High: >200 grains/m³
  - High: 80-200 grains/m³
  - Moderate: 20-80 grains/m³
  - Low: 1-20 grains/m³
- **Additional Factors**: Wind speed (disperses pollen) and recent precipitation (washes pollen away)
- **Transparent Methodology**: Click the Allergy tile for detailed formulas and pollen level thresholds

#### Pollen Forecast Section
- **Current Levels**: Real-time pollen counts for Tree, Grass, and Weed categories with color-coded severity indicators
- **5-Day Forecast**: Daily maximum pollen levels with emoji indicators and category breakdowns
- **Data Source**: Open-Meteo Air Quality API (free, no API key required)
- **Health Insights**: Helps users with pollen allergies plan activities and medication

### Moon Phase Features
- **Current Moon Phase**: Displays today's moon phase with emoji and name in the current weather section
- **14-Day Moon Phases**: Moon phase information for each day in the extended forecast
- **Moon Details Modal**: Click any moon phase tile to see detailed information including:
  - Moon illumination percentage
  - Accurate moonrise and moonset times (calculated using SunCalc.js)
  - Moon distance in miles (varies with lunar cycle)
  - Days until next full moon and new moon
- **Moon Phase Chart**: Visual chart showing moon phase progression over 14 days in the expanded forecast modal

### Weather Radar
- **Ventusky Integration**: Embedded Ventusky precipitation map
- **Auto-Centering**: Automatically centers on current or searched location
- **Responsive Sizing**: Optimized aspect ratios for desktop and mobile (more zoomed out on mobile)
- **Interactive Controls**: Full Ventusky map controls (zoom, pan, layer switching)
- **Safe Scrolling**: Prevents accidental navigation when scrolling past the radar

## 🔧 Development Workflow

### Making Changes

1. **Edit source files:**
   - `public/index.html` - HTML structure and styles
   - `public/app.js` - JavaScript functionality

2. **Test locally:**
   ```bash
   npm run dev
   ```
   Visit the local URL provided by Wrangler (typically `http://localhost:8787`)

3. **Build for production:**
   ```bash
   npm run build
   ```
   This creates the optimized worker file.

4. **Deploy:**
   ```bash
   npm run deploy
   ```

### Testing New Changes

Before deploying, always test locally using `npm run dev`. This:
- Builds the project
- Starts a local Cloudflare Worker
- Allows you to test all features without deploying
- Provides hot-reloading for development

### UI Development (testing/ folder)

The `testing/` folder (git-ignored) is used for experimenting with new UI designs before deploying:

1. **Create test files:**
   - `testing/index.html` - Experimental HTML/CSS
   - `testing/app.js` - Test JavaScript

2. **Test locally:**
   ```bash
   npx serve testing/
   ```

3. **Deploy when ready:**
   - Copy `testing/index.html` to `public/index.html`
   - Copy `testing/app.js` to `public/app.js` (if changed)
   - Run `npm run build && npm run deploy`

4. **Revert if needed:**
   - Simply delete the testing files
   - The production `public/` files remain unchanged

## 💾 Backup & Restore

### Automated Backup

The project includes an automated backup script (`backup.sh`) that:
- Commits all changes to Git
- Pushes to the remote repository
- Can be scheduled with cron for automatic backups

**To use the backup script:**
```bash
chmod +x backup.sh
./backup.sh
```

**To schedule automatic backups (example - daily at 2 AM):**
```bash
crontab -e
# Add this line:
0 2 * * * /path/to/Weather/backup.sh
```

### Manual Backup

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

2. **Push to remote:**
   ```bash
   git push origin main
   ```

### Restore from Backup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anglim3/jaccuweather.git
   cd jaccuweather
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build and deploy:**
   ```bash
   npm run build
   npm run deploy
   ```

## 🌐 Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile Browsers**: iOS Safari, Chrome Mobile, Firefox Mobile
- **Required Features**:
  - ES6+ JavaScript support
  - Fetch API
  - Geolocation API (optional, falls back to default location)
  - Local Storage API
  - CSS Grid and Flexbox

## 🔒 Security & Privacy

- **No API Keys Required**: Uses free, open APIs that don't require authentication
- **Client-Side Requests**: Weather API requests made directly from browser (uses user's IP)
- **Local Storage Only**: Favorites stored locally, never sent to servers
- **No Tracking**: No analytics or tracking scripts included
- **CORS Handling**: Cloudflare Worker proxies API requests to avoid CORS issues

## 🐛 Troubleshooting

### Build Errors
- Ensure Node.js is v16 or higher
- Delete `node_modules` and run `npm install` again
- Check that all dependencies are installed

### Deployment Issues
- Verify Cloudflare authentication: `npx wrangler whoami`
- Check `wrangler.toml` configuration
- Ensure you have a Cloudflare Workers account

### API Errors
- Open-Meteo has rate limits - wait a moment and try again
- Check browser console for specific error messages
- Verify internet connection

### Radar Not Loading
- Check browser console for iframe errors
- Verify Ventusky proxy is working
- Try clearing browser cache

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Credits

- **Weather Data**: [Open-Meteo](https://open-meteo.com/) - Free, open-source weather API
- **Air Quality & Pollen Data**: [Open-Meteo Air Quality API](https://air-quality-api.open-meteo.com/) - Real-time pollen and air quality data
- **Weather Maps**: [Ventusky](https://www.ventusky.com/) - Interactive weather visualization
- **Moon Calculations**: [SunCalc.js](https://github.com/mourner/suncalc) - Accurate astronomical calculations for moon phases and times
- **Mathematical Rendering**: [MathJax](https://www.mathjax.org/) - LaTeX mathematical expression rendering
- **Icons**: [Font Awesome](https://fontawesome.com/) - Icon library
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- **Charts**: [Chart.js](https://www.chartjs.org/) - JavaScript charting library
- **Reverse Geocoding**: [BigDataCloud](https://www.bigdatacloud.com/) - Free reverse geocoding API

## 👤 Author

**Jack A** - Vibecoded with ❤️

---

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/anglim3/jaccuweather).
