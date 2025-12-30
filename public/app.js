let currentLat = null;
let currentLon = null;
let currentLocationName = null;
let currentWeatherData = null; // Store full weather data for modals
let favorites = []; // Array of favorite locations
let hourlyChart = null;
let dailyChart = null;
let radarMap = null;
let radarLayer = null;
let radarFrames = []; // Frame structure: { time: unixTimestamp, isoTime: "ISO8601", intensityPath: "precipitationIntensity", typePath: "precipitationType", precipitationTypes: Set }
let currentRadarFrame = 0;
let currentRadarLayerType = 'precipitation'; // 'precipitation' or 'wind'
let windMarkers = [];
let windDataCache = null;
let windCanvasLayer = null;
let windGridData = null;
let mapMoveDebounceTimer = null; // Debounce timer for map movement
let radarAnimationInterval = null; // Animation interval for radar playback
let isRadarAnimating = false; // Whether radar animation is playing
let radarAnimationFrame = null; // requestAnimationFrame ID for smooth animation

// Favorites management using IndexedDB (more persistent than localStorage)
let favoritesDB = null;

// Initialize IndexedDB
function initFavoritesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WeatherAppDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            favoritesDB = request.result;
            resolve(favoritesDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('favorites')) {
                db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Load favorites from IndexedDB
async function loadFavorites() {
    try {
        if (!favoritesDB) {
            await initFavoritesDB();
        }
        
        const transaction = favoritesDB.transaction(['favorites'], 'readonly');
        const store = transaction.objectStore('favorites');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const dbFavorites = request.result;
            
            // If IndexedDB is empty, try to migrate from localStorage
            if (dbFavorites.length === 0) {
                const saved = localStorage.getItem('weatherFavorites');
                if (saved) {
                    try {
                        const localFavorites = JSON.parse(saved);
                        if (localFavorites && localFavorites.length > 0) {
                            // Migrate from localStorage to IndexedDB
                            favorites = localFavorites;
                            saveFavorites(); // This will save to IndexedDB
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing localStorage favorites:', e);
                    }
                }
            }
            
            // Extract favorites from IndexedDB (remove id field)
            favorites = dbFavorites.map(fav => ({
                name: fav.name,
                lat: fav.lat,
                lon: fav.lon
            }));
            renderFavorites();
        };
        
        request.onerror = () => {
            console.error('Error loading favorites from IndexedDB');
            // Fallback to localStorage
            const saved = localStorage.getItem('weatherFavorites');
            if (saved) {
                try {
                    favorites = JSON.parse(saved);
                } catch (e) {
                    favorites = [];
                }
            }
            renderFavorites();
        };
    } catch (error) {
        console.error('Error initializing favorites DB:', error);
        // Fallback to localStorage if IndexedDB fails
        const saved = localStorage.getItem('weatherFavorites');
        if (saved) {
            try {
                favorites = JSON.parse(saved);
            } catch (e) {
                favorites = [];
            }
        }
        renderFavorites();
    }
}

// Save favorites to IndexedDB
async function saveFavorites() {
    try {
        if (!favoritesDB) {
            await initFavoritesDB();
        }
        
        const transaction = favoritesDB.transaction(['favorites'], 'readwrite');
        const store = transaction.objectStore('favorites');
        
        // Clear existing favorites
        await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });
        
        // Add all current favorites
        const promises = favorites.map(fav => {
            return new Promise((resolve, reject) => {
                const addRequest = store.add(fav);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        });
        
        await Promise.all(promises);
        
        // Also save to localStorage as backup
        localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
        
        renderFavorites();
    } catch (error) {
        console.error('Error saving favorites to IndexedDB:', error);
        // Fallback to localStorage
        try {
            localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
        } catch (e) {
            console.error('Error saving to localStorage:', e);
        }
        renderFavorites();
    }
}

function addFavorite() {
    if (!currentLat || !currentLon || !currentLocationName) {
        alert('Please search for a location first or use your current location.');
        return;
    }
    
    // Check if already in favorites
    const exists = favorites.some(fav => 
        Math.abs(fav.lat - currentLat) < 0.001 && 
        Math.abs(fav.lon - currentLon) < 0.001
    );
    
    if (exists) {
        alert('This location is already in your favorites.');
        return;
    }
    
    favorites.push({
        name: currentLocationName,
        lat: currentLat,
        lon: currentLon
    });
    
    saveFavorites();
}

function removeFavorite(index) {
    favorites.splice(index, 1);
    saveFavorites();
}

function switchToFavorite(lat, lon, name) {
    currentLocationName = name;
    fetchWeather(lat, lon);
    document.getElementById('favoritesDropdown').classList.add('hidden');
}

function renderFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    const noFavorites = document.getElementById('noFavorites');
    
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        noFavorites.classList.remove('hidden');
        favoritesList.classList.add('hidden');
    } else {
        noFavorites.classList.add('hidden');
        favoritesList.classList.remove('hidden');
        
        favorites.forEach((fav, index) => {
            const favItem = document.createElement('div');
            favItem.className = 'flex items-center justify-between p-3 hover:bg-white/10 rounded-lg mb-1';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'flex-1 cursor-pointer';
            nameDiv.innerHTML = `
                <div class="text-white font-semibold">${fav.name}</div>
                <div class="text-white/60 text-xs">${fav.lat.toFixed(4)}, ${fav.lon.toFixed(4)}</div>
            `;
            nameDiv.addEventListener('click', () => switchToFavorite(fav.lat, fav.lon, fav.name));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-red-400 hover:text-red-300 ml-2 p-1';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFavorite(index);
            });
            
            favItem.appendChild(nameDiv);
            favItem.appendChild(deleteBtn);
            favoritesList.appendChild(favItem);
        });
    }
}

// Initialize with user's location or default
window.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
    
    // Favorites button click handler
    document.getElementById('favoritesBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('favoritesDropdown');
        dropdown.classList.toggle('hidden');
    });
    
    // Add favorite button
    document.getElementById('addFavoriteBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        addFavorite();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('favoritesDropdown');
        const btn = document.getElementById('favoritesBtn');
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;
                fetchWeather(currentLat, currentLon);
            },
            () => {
                // Default to London if geolocation fails
                fetchWeather(51.5074, -0.1278);
            }
        );
    } else {
        fetchWeather(51.5074, -0.1278);
    }
});

// Search functionality
document.getElementById('searchBtn').addEventListener('click', handleSearch);
document.getElementById('locationInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});
document.getElementById('locationBtn').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;
                fetchWeather(currentLat, currentLon);
            },
            () => showError('Unable to get your location. Please search for a city.')
        );
    } else {
        showError('Geolocation is not supported by your browser.');
    }
});

// State abbreviation to full name mapping (US states)
const STATE_ABBREVIATIONS = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia'
};

// Reverse mapping (full name to abbreviation)
const STATE_NAMES_TO_ABBR = {};
Object.keys(STATE_ABBREVIATIONS).forEach(abbr => {
    STATE_NAMES_TO_ABBR[STATE_ABBREVIATIONS[abbr].toLowerCase()] = abbr;
});

function normalizeState(stateInput) {
    if (!stateInput) return null;
    const state = stateInput.trim();
    // Check if it's an abbreviation
    if (state.length <= 2) {
        return STATE_ABBREVIATIONS[state.toUpperCase()] || state;
    }
    // Check if it's a full name
    const lowerState = state.toLowerCase();
    if (STATE_NAMES_TO_ABBR[lowerState]) {
        return STATE_ABBREVIATIONS[STATE_NAMES_TO_ABBR[lowerState]];
    }
    // Return as-is if not found
    return state;
}

function matchesState(result, searchState) {
    if (!searchState) return true;
    const resultAdmin1 = (result.admin1 || '').toLowerCase();
    const normalizedSearch = normalizeState(searchState).toLowerCase();
    return resultAdmin1 === normalizedSearch || 
           resultAdmin1.includes(normalizedSearch) || 
           normalizedSearch.includes(resultAdmin1);
}

async function handleSearch() {
    const query = document.getElementById('locationInput').value.trim();
    if (!query) return;

    try {
        // Parse "City, State" or "City, State, Country" format
        const parts = query.split(',').map(p => p.trim());
        const city = parts[0];
        const state = parts.length > 1 ? parts[1] : null;
        const country = parts.length > 2 ? parts[2] : null;
        
        // Build search query - use city name, optionally add country filter
        let searchUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`;
        if (country) {
            searchUrl += `&country=${encodeURIComponent(country)}`;
        }
        // Get more results to filter through (up to 10)
        searchUrl += `&count=10`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            let result = data.results[0];
            
            // If state was provided, try to find a match
            if (state) {
                const stateMatch = data.results.find(r => matchesState(r, state));
                if (stateMatch) {
                    result = stateMatch;
                } else {
                    // If no exact match, show all results and let user know
                    console.log('State not found, using first result:', result);
                }
            }
            
            currentLat = result.latitude;
            currentLon = result.longitude;
            
            // Store the location name for display - try multiple fields
            const name = result.name || result.admin1 || result.admin2 || '';
            const resultCountry = result.country || '';
            const admin1 = result.admin1 || '';
            
            // Check if it's US (handle various formats)
            const isUS = resultCountry && (
                resultCountry.includes('United States') || 
                resultCountry === 'US' || 
                resultCountry === 'USA'
            );
            
            if (name && resultCountry) {
                // For US locations, prefer "City, State" format
                if (isUS && admin1) {
                    currentLocationName = `${name}, ${admin1}`;
                } else if (!isUS) {
                    // For non-US locations, show "City, Country"
                    currentLocationName = `${name}, ${resultCountry}`;
                } else {
                    currentLocationName = name;
                }
            } else if (name) {
                currentLocationName = name;
            } else if (admin1) {
                currentLocationName = admin1;
            } else {
                currentLocationName = null; // Will trigger reverse geocoding
            }
            
            fetchWeather(currentLat, currentLon);
        } else {
            showError('Location not found. Please try another search.');
        }
    } catch (error) {
        showError('Error searching for location. Please try again.');
        console.error(error);
    }
}

async function fetchWeather(lat, lon) {
    showLoading();
    hideError();
    hideContent();

    try {
        // Make direct request to Open-Meteo from browser (uses user's IP, not shared Cloudflare IP)
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,uv_index,weather_code&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,precipitation,snowfall&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,precipitation_probability_max,snowfall_sum,sunrise,sunset&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto`);

        // Check for rate limiting before parsing JSON
        if (weatherResponse.status === 429) {
            const errorData = await weatherResponse.json().catch(() => ({ error: true, reason: 'Rate limit exceeded' }));
            showError(errorData.reason || 'Rate limit exceeded. Please wait a moment and try again.');
            return;
        }

        if (!weatherResponse.ok) {
            const errorData = await weatherResponse.json().catch(() => ({ error: true, reason: 'Failed to fetch weather data' }));
            showError(errorData.reason || `Failed to fetch weather data (${weatherResponse.status})`);
            return;
        }

        const weatherData = await weatherResponse.json();

        if (weatherData.error) {
            showError(weatherData.reason || 'Failed to fetch weather data');
            return;
        }

        // If we don't have a stored location name, try to get it via reverse geocoding
        if (!currentLocationName) {
            try {
                // Make direct request to BigDataCloud from browser (uses user's IP, not shared Cloudflare IP)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                
                const reverseGeoResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!reverseGeoResponse.ok) {
                    throw new Error(`HTTP ${reverseGeoResponse.status}`);
                }
                
                const data = await reverseGeoResponse.json();
                
                // BigDataCloud returns data directly - transform to match expected format
                if (data) {
                    // Try to get city name, fallback to town, village, or municipality
                    const cityName = data.city || data.locality || data.town || data.village || data.municipality || data.county;
                    const stateName = data.principalSubdivision;
                    const countryName = data.countryName;
                    
                    // Check if it's US (handle various formats like "United States", "United States of America", etc.)
                    const isUS = countryName && (
                        countryName.includes('United States') || 
                        countryName === 'US' || 
                        countryName === 'USA'
                    );
                    
                    if (cityName) {
                        if (stateName && isUS) {
                            // For US locations, show "City, State"
                            currentLocationName = `${cityName}, ${stateName}`;
                        } else if (countryName && !isUS) {
                            // For non-US locations, show "City, Country"
                            currentLocationName = `${cityName}, ${countryName}`;
                        } else {
                            currentLocationName = cityName;
                        }
                    } else if (stateName && isUS) {
                        currentLocationName = stateName;
                    } else if (countryName && !isUS) {
                        currentLocationName = countryName;
                    }
                }
            } catch (error) {
                // Log error for debugging but don't break the app
                console.error('Reverse geocoding failed:', error.message);
            }
        }

        currentWeatherData = weatherData; // Store for modals
        displayWeather(weatherData);
        
        // Update legend if radar is already initialized (to reflect rain vs snow)
        if (currentRadarLayerType === 'precipitation') {
            initializeLegend();
        }
        
        // Initialize radar map
        initializeRadar(lat, lon);
        
        // Fetch weather alerts (for US locations)
        fetchWeatherAlerts(lat, lon);
        
        // Fetch air quality data
        fetchAirQuality(lat, lon);
    } catch (error) {
        showError('Failed to fetch weather data. Please try again.');
        console.error(error);
    } finally {
        hideLoading();
    }
}

function displayWeather(data) {
    // Use stored location name if available (from search or reverse geocoding)
    let location = currentLocationName;
    
    // If we still don't have a location name, show coordinates as last resort
    if (!location) {
        location = `${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)}`;
    }

    // Current weather
    document.getElementById('currentLocation').textContent = location;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    document.getElementById('currentTemp').textContent = `${Math.round(data.current.temperature_2m)}${data.current_units.temperature_2m}`;
    document.getElementById('currentCondition').textContent = getWeatherDescription(data.current.weather_code);
    document.getElementById('feelsLike').textContent = `${Math.round(data.current.apparent_temperature)}${data.current_units.apparent_temperature}`;
    document.getElementById('humidity').textContent = `${data.current.relative_humidity_2m}${data.current_units.relative_humidity_2m}`;
    document.getElementById('windSpeed').textContent = `${data.current.wind_speed_10m} ${data.current_units.wind_speed_10m}`;
    document.getElementById('uvIndex').textContent = data.current.uv_index;
    
    // Sunrise and sunset times (for today, index 0)
    if (data.daily && data.daily.sunrise && data.daily.sunrise[0]) {
        const sunriseTime = new Date(data.daily.sunrise[0]);
        document.getElementById('sunrise').textContent = formatTime12Hour(sunriseTime);
    }
    if (data.daily && data.daily.sunset && data.daily.sunset[0]) {
        const sunsetTime = new Date(data.daily.sunset[0]);
        document.getElementById('sunset').textContent = formatTime12Hour(sunsetTime);
    }

    // Hourly forecast
    const hourlyContainer = document.getElementById('hourlyForecast').querySelector('.flex');
    hourlyContainer.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find the closest hour in the data
    let startIndex = 0;
    for (let i = 0; i < data.hourly.time.length; i++) {
        const hourTime = new Date(data.hourly.time[i]);
        if (hourTime.getHours() >= currentHour) {
            startIndex = i;
            break;
        }
    }
    
    for (let i = 0; i < 24 && (startIndex + i) < data.hourly.time.length; i++) {
        const hourIndex = startIndex + i;
        const hour = new Date(data.hourly.time[hourIndex]);
        const hourItem = document.createElement('div');
        hourItem.className = 'flex flex-col items-center bg-white/10 rounded-lg p-3 backdrop-blur-sm min-w-[80px] clickable';
        hourItem.innerHTML = `
            <div class="text-white/70 text-sm mb-1">${formatTime12Hour(hour)}</div>
            <div class="text-2xl mb-2">${getWeatherIcon(data.hourly.weather_code[hourIndex])}</div>
            <div class="text-white font-bold text-lg">${Math.round(data.hourly.temperature_2m[hourIndex])}${data.hourly_units.temperature_2m}</div>
            <div class="text-white/60 text-xs mt-1">${data.hourly.wind_speed_10m[hourIndex]} ${data.hourly_units.wind_speed_10m}</div>
        `;
        hourItem.addEventListener('click', () => openHourlyModal(data));
        hourlyContainer.appendChild(hourItem);
    }

    // Daily forecast
    const dailyContainer = document.getElementById('dailyForecast');
    dailyContainer.innerHTML = '';
    
    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const day = parseDateString(data.daily.time[i]);
        const dayItem = document.createElement('div');
        dayItem.className = 'flex items-center justify-between bg-white/10 rounded-lg p-4 backdrop-blur-sm clickable';
        dayItem.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="text-3xl">${getWeatherIcon(data.daily.weather_code[i])}</div>
                <div>
                    <div class="text-white font-semibold text-lg">${day.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                    <div class="text-white/70 text-sm">${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
            </div>
            <div class="flex items-center gap-6">
                <div class="text-right">
                    <div class="text-white font-bold text-xl">${Math.round(data.daily.temperature_2m_max[i])}${data.daily_units.temperature_2m_max}</div>
                    <div class="text-white/70 text-sm">${Math.round(data.daily.temperature_2m_min[i])}${data.daily_units.temperature_2m_min}</div>
                </div>
                <div class="text-white/70 text-sm text-right min-w-[100px]">
                    ${data.daily.snowfall_sum && data.daily.snowfall_sum[i] > 0 ? '' : `<div><i class="fas fa-tint mr-1"></i>${data.daily.precipitation_sum[i] || 0} ${data.daily_units.precipitation_sum}</div>`}
                    ${data.daily.snowfall_sum && data.daily.snowfall_sum[i] > 0 ? `<div><i class="fas fa-snowflake mr-1"></i>${data.daily.snowfall_sum[i]} ${data.daily_units.snowfall_sum || 'in'}</div>` : ''}
                    <div><i class="fas fa-wind mr-1"></i>${data.daily.wind_speed_10m_max[i]} ${data.daily_units.wind_speed_10m_max}</div>
                </div>
            </div>
        `;
        dayItem.addEventListener('click', () => openDailyModal(data));
        dailyContainer.appendChild(dayItem);
    }

    // Display weekly snow totals if there's snow in the forecast
    displayWeeklySnowTotals(data);

    showContent();
    
    // Add click handlers to section headers
    if (currentWeatherData) {
        document.getElementById('hourlyHeader').addEventListener('click', () => openHourlyModal(currentWeatherData));
        document.getElementById('dailyHeader').addEventListener('click', () => openDailyModal(currentWeatherData));
    }
}

function displayWeeklySnowTotals(data) {
    const snowSection = document.getElementById('weeklySnowSection');
    const snowContent = document.getElementById('weeklySnowContent');
    snowContent.innerHTML = '';
    
    // Check if there's any snow in the forecast
    if (!data.daily.snowfall_sum) {
        snowSection.classList.add('hidden');
        return;
    }
    
    // Collect all days with snow
    const snowDays = [];
    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const snowfall = data.daily.snowfall_sum[i] || 0;
        if (snowfall > 0) {
            const day = parseDateString(data.daily.time[i]);
            const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            // Round to nearest 0.1 inch
            const roundedSnow = Math.round(snowfall * 10) / 10;
            snowDays.push({
                dayName,
                dateStr,
                snowfall: roundedSnow,
                index: i
            });
        }
    }
    
    if (snowDays.length === 0) {
        snowSection.classList.add('hidden');
        return;
    }
    
    // Group consecutive days
    const snowPeriods = [];
    let currentPeriod = null;
    
    for (let i = 0; i < snowDays.length; i++) {
        const snowDay = snowDays[i];
        
        if (!currentPeriod) {
            // Start new period
            currentPeriod = {
                days: [snowDay],
                totalSnow: snowDay.snowfall
            };
        } else {
            // Check if consecutive (within 1 day index difference)
            const lastDayIndex = currentPeriod.days[currentPeriod.days.length - 1].index;
            if (snowDay.index === lastDayIndex + 1) {
                // Consecutive day - add to current period
                currentPeriod.days.push(snowDay);
                currentPeriod.totalSnow += snowDay.snowfall;
            } else {
                // Not consecutive - save current period and start new one
                snowPeriods.push(currentPeriod);
                currentPeriod = {
                    days: [snowDay],
                    totalSnow: snowDay.snowfall
                };
            }
        }
    }
    
    // Add the last period
    if (currentPeriod) {
        snowPeriods.push(currentPeriod);
    }
    
    // Display snow periods
    snowSection.classList.remove('hidden');
    
    snowPeriods.forEach(period => {
        const periodItem = document.createElement('div');
        periodItem.className = 'bg-white/10 rounded-lg p-4 backdrop-blur-sm';
        
        // Round total to nearest 0.1
        const totalSnowRounded = Math.round(period.totalSnow * 10) / 10;
        
        // Determine unit (inch vs inches)
        const unit = totalSnowRounded === 1.0 ? 'inch' : 'inches';
        
        let periodText;
        if (period.days.length === 1) {
            // Single day
            const day = period.days[0];
            const dayUnit = day.snowfall === 1.0 ? 'inch' : 'inches';
            periodText = `Snowfall on ${day.dayName} (${day.dateStr}) is ${totalSnowRounded.toFixed(1)} ${unit}`;
            
            periodItem.innerHTML = `
                <div class="text-white font-semibold">${periodText}</div>
            `;
        } else {
            // Multiple days - show range
            const firstDay = period.days[0];
            const lastDay = period.days[period.days.length - 1];
            periodText = `Snowfall between ${firstDay.dayName} (${firstDay.dateStr}) and ${lastDay.dayName} (${lastDay.dateStr}) is ${totalSnowRounded.toFixed(1)} ${unit}`;
            
            // Add breakdown of individual days
            const dayBreakdown = period.days.map(day => {
                const dayUnit = day.snowfall === 1.0 ? 'inch' : 'inches';
                return `${day.dayName}: ${day.snowfall.toFixed(1)} ${dayUnit}`;
            }).join(' • ');
            
            periodItem.innerHTML = `
                <div class="flex-1">
                    <div class="text-white font-semibold mb-1">${periodText}</div>
                    <div class="text-white/70 text-sm">${dayBreakdown}</div>
                </div>
            `;
        }
        
        snowContent.appendChild(periodItem);
    });
}

function getWeatherIcon(code) {
    // WMO Weather interpretation codes
    const icons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌦️', 53: '🌦️', 55: '🌦️',
        56: '🌨️', 57: '🌨️',
        61: '🌧️', 63: '🌧️', 65: '🌧️',
        66: '🌨️', 67: '🌨️',
        71: '❄️', 73: '❄️', 75: '❄️',
        77: '❄️',
        80: '🌦️', 81: '🌦️', 82: '🌦️',
        85: '🌨️', 86: '🌨️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[code] || '☀️';
}

function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Depositing rime fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        66: 'Light freezing rain', 67: 'Heavy freezing rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
        85: 'Slight snow showers', 86: 'Heavy snow showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
    };
    return descriptions[code] || 'Unknown';
}

function formatTime12Hour(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
}

function parseDateString(dateString) {
    // Parse date string (format: "YYYY-MM-DD") as local date, not UTC
    // This prevents timezone issues where UTC dates shift to previous day
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    // Fallback to regular Date parsing if format is different
    return new Date(dateString);
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showContent() {
    document.getElementById('weatherContent').classList.remove('hidden');
}

function hideContent() {
    document.getElementById('weatherContent').classList.add('hidden');
}

function showError(message) {
    document.getElementById('errorMessage').classList.remove('hidden');
    document.getElementById('errorText').textContent = message;
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

// Weather alerts functionality
async function fetchWeatherAlerts(lat, lon) {
    // Only fetch alerts for US locations (rough check: lat 24-50, lon -125 to -66)
    if (lat < 24 || lat > 50 || lon < -125 || lon > -66) {
        return; // Not in US, skip alerts
    }
    
    try {
        // First, get the forecast zone for this point
        const pointResponse = await fetch(`/api/nws-points/${lat.toFixed(4)},${lon.toFixed(4)}`);
        
        if (!pointResponse.ok) {
            console.log('NWS points API not available:', pointResponse.status);
            return; // Silently fail if not available
        }
        
        const pointData = await pointResponse.json();
        
        // Check if the response has an error
        if (pointData.error) {
            console.log('NWS points API error:', pointData.reason);
            return;
        }
        
        const forecastZoneUrl = pointData.properties?.forecastZone;
        
        if (!forecastZoneUrl) {
            console.log('No forecast zone URL found in NWS response');
            return;
        }
        
        // Extract zone ID from URL (e.g., "https://api.weather.gov/zones/forecast/AZZ001" -> "AZZ001")
        const zoneId = forecastZoneUrl.split('/').pop();
        
        if (!zoneId) {
            console.log('Could not extract zone ID from URL:', forecastZoneUrl);
            return;
        }
        
        // Fetch alerts for this zone
        const alertsResponse = await fetch(`/api/alerts/active/zone/${zoneId}`);
        
        if (!alertsResponse.ok) {
            console.log('NWS alerts API not available:', alertsResponse.status);
            return;
        }
        
        const alertsData = await alertsResponse.json();
        
        // Check if the response has an error
        if (alertsData.error) {
            console.log('NWS alerts API error:', alertsData.reason);
            return;
        }
        
        if (alertsData.features && alertsData.features.length > 0) {
            // Filter to only show actual (active) alerts
            const activeAlerts = alertsData.features.filter(alert => 
                alert.properties.status === 'Actual'
            );
            
            if (activeAlerts.length > 0) {
                displayAlerts(activeAlerts);
            }
        }
    } catch (error) {
        // Log error for debugging but don't break the app
        console.error('Weather alerts error:', error.message);
    }
}

function displayAlerts(alerts) {
    const alertsContainer = document.getElementById('weatherAlerts');
    alertsContainer.innerHTML = '';
    alertsContainer.classList.remove('hidden');
    
    alerts.forEach((alert, index) => {
        const props = alert.properties;
        const severity = props.severity?.toLowerCase() || 'unknown';
        const urgency = props.urgency?.toLowerCase() || 'unknown';
        
        // Determine alert color based on severity
        let alertColor = 'bg-yellow-500/20 border-yellow-300/30';
        if (severity === 'extreme' || severity === 'severe') {
            alertColor = 'bg-red-500/20 border-red-300/30';
        } else if (severity === 'moderate') {
            alertColor = 'bg-orange-500/20 border-orange-300/30';
        }
        
        const alertItem = document.createElement('div');
        alertItem.className = `${alertColor} backdrop-blur-sm rounded-lg border shadow-lg mb-3`;
        
        const eventType = props.event || 'Weather Alert';
        const headline = props.headline || '';
        const description = props.description || '';
        const effective = props.effective ? new Date(props.effective).toLocaleString('en-US') : '';
        const expires = props.expires ? new Date(props.expires).toLocaleString('en-US') : '';
        
        // Create unique IDs for this alert
        const alertId = `alert-${index}`;
        const headerId = `alert-header-${index}`;
        const contentId = `alert-content-${index}`;
        const expandIconId = `alert-icon-${index}`;
        
        alertItem.innerHTML = `
            <div class="cursor-pointer" id="${headerId}">
                <div class="flex items-center justify-between p-4">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <i class="fas fa-exclamation-triangle text-2xl text-white flex-shrink-0"></i>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 class="text-xl font-bold text-white">${eventType}</h3>
                                ${props.severity ? `<span class="px-2 py-1 bg-white/20 rounded text-xs text-white font-semibold uppercase whitespace-nowrap">${props.severity}</span>` : ''}
                            </div>
                            ${headline ? `<p class="text-white font-semibold text-sm">${headline}</p>` : ''}
                        </div>
                    </div>
                    <i id="${expandIconId}" class="fas fa-chevron-down text-white transition-transform duration-200 flex-shrink-0 ml-2"></i>
                </div>
            </div>
            <div id="${contentId}" class="hidden px-4 pb-4">
                <div class="border-t border-white/20 pt-4">
                    ${description ? `<p class="text-white/90 text-sm mb-3 whitespace-pre-line">${description}</p>` : ''}
                    ${(effective || expires) ? `
                    <div class="flex flex-col gap-2 text-white/70 text-xs mt-4 pt-4 border-t border-white/10">
                        ${effective ? `<div><i class="fas fa-clock mr-1"></i>Effective: ${effective}</div>` : ''}
                        ${expires ? `<div><i class="fas fa-calendar-times mr-1"></i>Expires: ${expires}</div>` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add click handler for expand/collapse
        const header = alertItem.querySelector(`#${headerId}`);
        const content = alertItem.querySelector(`#${contentId}`);
        const expandIcon = alertItem.querySelector(`#${expandIconId}`);
        
        header.addEventListener('click', () => {
            const isExpanded = !content.classList.contains('hidden');
            if (isExpanded) {
                content.classList.add('hidden');
                expandIcon.classList.remove('fa-chevron-up');
                expandIcon.classList.add('fa-chevron-down');
                expandIcon.style.transform = 'rotate(0deg)';
            } else {
                content.classList.remove('hidden');
                expandIcon.classList.remove('fa-chevron-down');
                expandIcon.classList.add('fa-chevron-up');
                expandIcon.style.transform = 'rotate(180deg)';
            }
        });
        
        alertsContainer.appendChild(alertItem);
    });
}

// Air Quality functionality
async function fetchAirQuality(lat, lon) {
    try {
        // Fetch air quality data from Open-Meteo Air Quality API
        const aqiResponse = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide`);
        
        if (!aqiResponse.ok) {
            // Hide air quality section if API is unavailable
            document.getElementById('airQualitySection').classList.add('hidden');
            return;
        }
        
        const aqiData = await aqiResponse.json();
        
        if (aqiData.error || !aqiData.current) {
            document.getElementById('airQualitySection').classList.add('hidden');
            return;
        }
        
        displayAirQuality(aqiData.current);
    } catch (error) {
        console.error('Error fetching air quality:', error);
        document.getElementById('airQualitySection').classList.add('hidden');
    }
}

function displayAirQuality(data) {
    const aqiSection = document.getElementById('airQualitySection');
    const aqiValue = document.getElementById('aqiValue');
    const aqiStatus = document.getElementById('aqiStatus');
    
    // Show the section
    aqiSection.classList.remove('hidden');
    
    // Get US AQI (0-500 scale)
    const usAqi = data.us_aqi || 0;
    
    // Determine AQI category and color
    let category, color;
    if (usAqi <= 50) {
        category = 'Good';
        color = 'text-green-400';
    } else if (usAqi <= 100) {
        category = 'Moderate';
        color = 'text-yellow-400';
    } else if (usAqi <= 150) {
        category = 'Unhealthy for Sensitive Groups';
        color = 'text-orange-400';
    } else if (usAqi <= 200) {
        category = 'Unhealthy';
        color = 'text-red-400';
    } else if (usAqi <= 300) {
        category = 'Very Unhealthy';
        color = 'text-purple-400';
    } else {
        category = 'Hazardous';
        color = 'text-red-600';
    }
    
    // Update display
    aqiValue.textContent = usAqi;
    aqiValue.className = `text-2xl font-bold ${color}`;
    aqiStatus.textContent = category;
    aqiStatus.className = `text-white/90 text-xs mt-1 ${color}`;
}

// Modal functionality
function openHourlyModal(data) {
    const modal = document.getElementById('hourlyModal');
    modal.classList.add('active');
    
    // Destroy existing charts if they exist
    if (hourlyChart) {
        Object.values(hourlyChart).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
    
    // Prepare data
    const now = new Date();
    const currentHour = now.getHours();
    let startIndex = 0;
    for (let i = 0; i < data.hourly.time.length; i++) {
        const hourTime = new Date(data.hourly.time[i]);
        if (hourTime.getHours() >= currentHour) {
            startIndex = i;
            break;
        }
    }
    
    const hours = [];
    const temps = [];
    const precip = [];
    const snow = [];
    const wind = [];
    const humidity = [];
    const labels = [];
    
    for (let i = 0; i < 24 && (startIndex + i) < data.hourly.time.length; i++) {
        const idx = startIndex + i;
        const hour = new Date(data.hourly.time[idx]);
        labels.push(formatTime12Hour(hour));
        hours.push(hour);
        temps.push(Math.round(data.hourly.temperature_2m[idx]));
        precip.push(data.hourly.precipitation ? data.hourly.precipitation[idx] : 0);
        snow.push(data.hourly.snowfall ? data.hourly.snowfall[idx] : 0);
        wind.push(data.hourly.wind_speed_10m[idx]);
        humidity.push(data.hourly.relative_humidity_2m[idx]);
    }
    
    // Create charts
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    };
    
    // Check if there's any snow in the hourly forecast
    const hasSnowHourly = snow.some(val => val > 0);
    
    hourlyChart = {
        temp: new Chart(document.getElementById('hourlyTempChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Temperature (${data.hourly_units.temperature_2m})`,
                    data: temps,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.4
                }]
            }
        }),
        precip: new Chart(document.getElementById('hourlyPrecipChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Precipitation (${data.hourly_units.precipitation || 'in'})`,
                    data: precip,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            }
        }),
        wind: new Chart(document.getElementById('hourlyWindChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Wind Speed (${data.hourly_units.wind_speed_10m})`,
                    data: wind,
                    borderColor: 'rgb(255, 206, 86)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    tension: 0.4
                }]
            }
        }),
        humidity: new Chart(document.getElementById('hourlyHumidityChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Humidity (${data.hourly_units.relative_humidity_2m})`,
                    data: humidity,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4
                }]
            }
        }),
        snow: new Chart(document.getElementById('hourlySnowChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Snowfall (${data.hourly_units.snowfall || 'in'})`,
                    data: snow,
                    borderColor: 'rgb(176, 196, 222)',
                    backgroundColor: 'rgba(176, 196, 222, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            }
        })
    };
    
    // Hide/show precipitation and snow charts based on data
    const hourlyPrecipChartContainer = document.getElementById('hourlyPrecipChart').parentElement;
    const hourlySnowChartContainer = document.getElementById('hourlySnowChart').parentElement;
    
    if (hasSnowHourly) {
        hourlyPrecipChartContainer.style.display = 'none';
        hourlySnowChartContainer.style.display = 'block';
    } else {
        hourlyPrecipChartContainer.style.display = 'block';
        hourlySnowChartContainer.style.display = 'none';
    }
    
    // Populate detailed hourly items
    const detailsContainer = document.getElementById('hourlyDetails');
    detailsContainer.innerHTML = '';
    for (let i = 0; i < hours.length; i++) {
        const idx = startIndex + i;
        const hour = hours[i];
        const detailItem = document.createElement('div');
        detailItem.className = 'bg-white/10 rounded-lg p-4 backdrop-blur-sm';
        detailItem.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                <div class="text-white font-semibold">${hour.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${formatTime12Hour(hour)}</div>
                <div class="text-2xl">${getWeatherIcon(data.hourly.weather_code[idx])}</div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <div><span class="text-white/70">Temp:</span> <span class="text-white font-bold">${Math.round(temps[i])}${data.hourly_units.temperature_2m}</span></div>
                <div><span class="text-white/70">Condition:</span> <span class="text-white">${getWeatherDescription(data.hourly.weather_code[idx])}</span></div>
                <div><span class="text-white/70">Wind:</span> <span class="text-white">${wind[i]} ${data.hourly_units.wind_speed_10m}</span></div>
                <div><span class="text-white/70">Humidity:</span> <span class="text-white">${humidity[i]}${data.hourly_units.relative_humidity_2m}</span></div>
                ${data.hourly.snowfall && snow[i] > 0 ? '' : (data.hourly.precipitation ? `<div><span class="text-white/70">Precip:</span> <span class="text-white">${precip[i]} ${data.hourly_units.precipitation || 'in'}</span></div>` : '')}
                ${data.hourly.snowfall && snow[i] > 0 ? `<div><span class="text-white/70">Snow:</span> <span class="text-white">${snow[i]} ${data.hourly_units.snowfall || 'in'}</span></div>` : ''}
                ${data.hourly.snowfall && snow[i] > 0 ? '' : (data.hourly.precipitation_probability ? `<div><span class="text-white/70">Rain Chance:</span> <span class="text-white">${data.hourly.precipitation_probability[idx]}%</span></div>` : '')}
            </div>
            <div class="mt-2 text-white/80 text-sm">${getWeatherDescription(data.hourly.weather_code[idx])}</div>
        `;
        detailsContainer.appendChild(detailItem);
    }
}

function openDailyModal(data) {
    const modal = document.getElementById('dailyModal');
    modal.classList.add('active');
    
    // Destroy existing charts if they exist
    if (dailyChart) {
        Object.values(dailyChart).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
    
    // Prepare data
    const labels = [];
    const maxTemps = [];
    const minTemps = [];
    const precip = [];
    const snowfall = [];
    const wind = [];
    const precipProb = [];
    
    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const day = parseDateString(data.daily.time[i]);
        labels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
        maxTemps.push(Math.round(data.daily.temperature_2m_max[i]));
        minTemps.push(Math.round(data.daily.temperature_2m_min[i]));
        precip.push(data.daily.precipitation_sum[i] || 0);
        snowfall.push(data.daily.snowfall_sum ? data.daily.snowfall_sum[i] || 0 : 0);
        wind.push(data.daily.wind_speed_10m_max[i]);
        precipProb.push(data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : 0);
    }
    
    // Create charts
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    };
    
    dailyChart = {
        temp: new Chart(document.getElementById('dailyTempChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [
                    {
                        label: `High (${data.daily_units.temperature_2m_max})`,
                        data: maxTemps,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.4
                    },
                    {
                        label: `Low (${data.daily_units.temperature_2m_min})`,
                        data: minTemps,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        tension: 0.4
                    }
                ]
            }
        }),
        precip: new Chart(document.getElementById('dailyPrecipChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Precipitation (${data.daily_units.precipitation_sum})`,
                    data: precip,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4
                }]
            }
        }),
        wind: new Chart(document.getElementById('dailyWindChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Wind Speed (${data.daily_units.wind_speed_10m_max})`,
                    data: wind,
                    borderColor: 'rgb(255, 206, 86)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    tension: 0.4
                }]
            }
        }),
        snow: new Chart(document.getElementById('dailySnowChart'), {
            ...chartConfig,
            data: {
                labels,
                datasets: [{
                    label: `Snowfall (${data.daily_units.snowfall_sum || 'in'})`,
                    data: snowfall,
                    borderColor: 'rgb(173, 216, 230)',
                    backgroundColor: 'rgba(173, 216, 230, 0.3)',
                    tension: 0.4,
                    fill: true
                }]
            }
        })
    };
    
    // Hide/show charts based on snow presence
    const snowChartContainer = document.getElementById('dailySnowChart').parentElement;
    const precipChartContainer = document.getElementById('dailyPrecipChart').parentElement;
    const hasSnow = snowfall.some(val => val > 0);
    
    if (hasSnow) {
        snowChartContainer.style.display = 'block';
        precipChartContainer.style.display = 'none';
    } else {
        snowChartContainer.style.display = 'none';
        precipChartContainer.style.display = 'block';
    }
    
    // Populate detailed daily items
    const detailsContainer = document.getElementById('dailyDetails');
    detailsContainer.innerHTML = '';
    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const day = parseDateString(data.daily.time[i]);
        const detailItem = document.createElement('div');
        detailItem.className = 'bg-white/10 rounded-lg p-4 backdrop-blur-sm';
        detailItem.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div>
                    <div class="text-white font-semibold text-lg">${day.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                    <div class="text-white/70 text-sm">${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div class="text-4xl">${getWeatherIcon(data.daily.weather_code[i])}</div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white/10 rounded p-3">
                    <div class="text-white/70 text-xs mb-1">High / Low</div>
                    <div class="text-white font-bold">${Math.round(maxTemps[i])}${data.daily_units.temperature_2m_max} / ${Math.round(minTemps[i])}${data.daily_units.temperature_2m_min}</div>
                </div>
                ${snowfall[i] > 0 ? `
                <div class="bg-white/10 rounded p-3">
                    <div class="text-white/70 text-xs mb-1"><i class="fas fa-snowflake mr-1"></i>Snowfall</div>
                    <div class="text-white font-bold">${snowfall[i]} ${data.daily_units.snowfall_sum || 'in'}</div>
                </div>
                ` : `
                <div class="bg-white/10 rounded p-3">
                    <div class="text-white/70 text-xs mb-1">Precipitation</div>
                    <div class="text-white font-bold">${precip[i]} ${data.daily_units.precipitation_sum}</div>
                </div>
                `}
                <div class="bg-white/10 rounded p-3">
                    <div class="text-white/70 text-xs mb-1">Wind Speed</div>
                    <div class="text-white font-bold">${wind[i]} ${data.daily_units.wind_speed_10m_max}</div>
                </div>
                ${snowfall[i] > 0 ? '' : (precipProb[i] > 0 ? `
                <div class="bg-white/10 rounded p-3">
                    <div class="text-white/70 text-xs mb-1">Rain Chance</div>
                    <div class="text-white font-bold">${precipProb[i]}%</div>
                </div>
                ` : '')}
            </div>
            <div class="mt-3 text-white/80">${getWeatherDescription(data.daily.weather_code[i])}</div>
        `;
        detailsContainer.appendChild(detailItem);
    }
}

// Modal close handlers
document.getElementById('closeHourlyModal').addEventListener('click', () => {
    document.getElementById('hourlyModal').classList.remove('active');
});

document.getElementById('closeDailyModal').addEventListener('click', () => {
    document.getElementById('dailyModal').classList.remove('active');
});

// Close modals when clicking outside
document.getElementById('hourlyModal').addEventListener('click', (e) => {
    if (e.target.id === 'hourlyModal') {
        document.getElementById('hourlyModal').classList.remove('active');
    }
});

document.getElementById('dailyModal').addEventListener('click', (e) => {
    if (e.target.id === 'dailyModal') {
        document.getElementById('dailyModal').classList.remove('active');
    }
});

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('hourlyModal').classList.remove('active');
        document.getElementById('dailyModal').classList.remove('active');
    }
});

// Weather Radar functionality
function initializeRadar(lat, lon) {
    // Initialize map if it doesn't exist (only for wind layer)
    if (!radarMap) {
        radarMap = L.map('radarMap', {
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false,
            zoomControl: false
        }).setView([lat, lon], 10);
        
        // Set view based on layer type
        // For precipitation: 100 miles x 100 miles ≈ 1.44 degrees at mid-latitudes
        // For wind: 10x10 miles (0.144 degrees)
        let milesToDegrees;
        if (currentRadarLayerType === 'precipitation') {
            // 100 miles ≈ 1.44 degrees at mid-latitudes
            milesToDegrees = 1.44;
        } else {
            // Wind: 10x10 miles
            milesToDegrees = 0.144;
        }
        const halfSize = milesToDegrees / 2;
        const bounds = [
            [lat - halfSize, lon - halfSize],
            [lat + halfSize, lon + halfSize]
        ];
        radarMap.fitBounds(bounds, { padding: [10, 10] });
        
        // Add base tile layer (dark theme)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(radarMap);
        
        // Add marker for current location
        L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(radarMap);
        
        // Setup navigation buttons
        setupRadarNavigation();
    } else {
        // Update map view based on layer type
        // For precipitation: 100 miles x 100 miles ≈ 1.44 degrees at mid-latitudes
        // For wind: 10x10 miles (0.144 degrees)
        let milesToDegrees;
        if (currentRadarLayerType === 'precipitation') {
            // 100 miles ≈ 1.44 degrees at mid-latitudes
            milesToDegrees = 1.44;
        } else {
            // Wind: 10x10 miles
            milesToDegrees = 0.144;
        }
        const halfSize = milesToDegrees / 2;
        const bounds = [
            [lat - halfSize, lon - halfSize],
            [lat + halfSize, lon + halfSize]
        ];
        radarMap.fitBounds(bounds, { padding: [10, 10] });
        radarMap.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                radarMap.removeLayer(layer);
            }
        });
        L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(radarMap);
    }
    
    // Fetch radar data
    fetchNWSRadarData(lat, lon);
    
    // Update wind layer when map moves or zooms (if wind is active) - with debounce
    if (radarMap) {
        radarMap.on('moveend zoomend', () => {
            // Clear existing timer
            if (mapMoveDebounceTimer) {
                clearTimeout(mapMoveDebounceTimer);
            }
            
            // Set new timer - wait 2 seconds before making API call
            mapMoveDebounceTimer = setTimeout(() => {
                if (currentRadarLayerType === 'wind') {
                    const currentFrame = radarFrames.length > 0 ? (radarFrames[currentRadarFrame] || radarFrames[radarFrames.length - 1]) : null;
                    if (currentFrame && currentFrame.time) {
                        fetchWindLayer(currentFrame.time);
                    }
                } else if (currentRadarLayerType === 'precipitation') {
                    // Precipitation uses NWS tiles, update when map moves
                    if (radarFrames.length > 0) {
                        const currentFrame = radarFrames[currentRadarFrame] || radarFrames[radarFrames.length - 1];
                        fetchPrecipitationRadar(currentFrame);
                    }
                }
            }, 500); // 0.5 second delay
        });
    }
}

function setupRadarNavigation() {
    // Zoom controls
    document.getElementById('radarZoomIn').addEventListener('click', () => {
        radarMap.zoomIn();
        triggerMapUpdate();
    });
    
    document.getElementById('radarZoomOut').addEventListener('click', () => {
        radarMap.zoomOut();
        triggerMapUpdate();
    });
    
    // Pan controls (move by 25% of view in pixels)
    document.getElementById('radarMoveUp').addEventListener('click', () => {
        const mapSize = radarMap.getSize();
        radarMap.panBy([0, -mapSize.y * 0.25]);
        triggerMapUpdate();
    });
    
    document.getElementById('radarMoveDown').addEventListener('click', () => {
        const mapSize = radarMap.getSize();
        radarMap.panBy([0, mapSize.y * 0.25]);
        triggerMapUpdate();
    });
    
    document.getElementById('radarMoveLeft').addEventListener('click', () => {
        const mapSize = radarMap.getSize();
        radarMap.panBy([-mapSize.x * 0.25, 0]);
        triggerMapUpdate();
    });
    
    document.getElementById('radarMoveRight').addEventListener('click', () => {
        const mapSize = radarMap.getSize();
        radarMap.panBy([mapSize.x * 0.25, 0]);
        triggerMapUpdate();
    });
    
    // Play/Pause animation button
    const playPauseBtn = document.getElementById('radarPlayPause');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            toggleRadarAnimation();
        });
    }
}

function triggerMapUpdate() {
    // Manually trigger moveend event after a short delay to ensure map has updated
    setTimeout(() => {
        radarMap.fire('moveend');
    }, 100);
}

// Generate time steps for NWS radar (10-minute intervals, past 1 hour to future 1 hour)
function generateNWSTimeSteps() {
    const now = new Date();
    const steps = [];
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    // NWS service provides data for past 4 hours up to current time
    // Start 4 hours ago (rounded to nearest 10-minute interval)
    const startTime = new Date(Math.floor((now.getTime() - (4 * 60 * 60 * 1000)) / tenMinutes) * tenMinutes);
    // End at current time (rounded down to nearest 10-minute interval)
    const endTime = new Date(Math.floor(now.getTime() / tenMinutes) * tenMinutes);
    
    // Generate steps at 10-minute intervals (only past times, not future)
    let currentTime = startTime;
    while (currentTime <= endTime) {
        const unixTime = Math.floor(currentTime.getTime() / 1000);
        const isoTime = currentTime.toISOString();
        const epochTime = currentTime.getTime(); // Epoch milliseconds for NWS WMS
        
        steps.push({
            time: unixTime,
            isoTime: isoTime,
            epochTime: epochTime, // Epoch milliseconds for NWS WMS time parameter
            intensityPath: 'precipitationIntensity',
            typePath: 'precipitationType',
            precipitationTypes: new Set() // Will be populated when we fetch type data
        });
        
        currentTime = new Date(currentTime.getTime() + tenMinutes);
    }
    
    return steps;
}

// Fetch precipitation type for a specific tile to determine legend type
async function fetchPrecipitationTypeSample(lat, lon, isoTime, zoom = 8) {
    try {
        // Sample a few tiles around the center to determine precipitation type
        // Use a small area around the location
        const sampleTiles = [
            { x: Math.floor((lon + 180) / 360 * Math.pow(2, zoom)) - 1, y: Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)) - 1 },
            { x: Math.floor((lon + 180) / 360 * Math.pow(2, zoom)), y: Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)) },
            { x: Math.floor((lon + 180) / 360 * Math.pow(2, zoom)) + 1, y: Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)) + 1 }
        ];
        
        const types = new Set();
        // We'll determine types from the actual tile data when available
        // For now, return empty set - types will be determined from weather data
        return types;
    } catch (error) {
        console.error('Error fetching precipitation type sample:', error);
        return new Set();
    }
}

async function fetchNWSRadarData(lat, lon) {
    try {
        // Generate time steps at 10-minute intervals for NWS (past 1 hour to future 1 hour)
        const timeSteps = generateNWSTimeSteps();
        
        if (timeSteps.length === 0) {
            console.log('No time steps generated');
            return;
        }
        
        // Store frames for animation
        radarFrames = timeSteps;
        currentRadarFrame = Math.floor(timeSteps.length / 2); // Start at middle (current time)
        
        // Remove old radar layer if it exists
        if (radarLayer) {
            radarMap.removeLayer(radarLayer);
        }
        
        // Update map view size based on current layer type (before loading data)
        if (radarMap && lat && lon) {
            let milesToDegrees;
            if (currentRadarLayerType === 'precipitation') {
                // 100 miles x 100 miles ≈ 1.44 degrees at mid-latitudes
                milesToDegrees = 1.44;
            } else {
                // Wind: 10x10 miles
                milesToDegrees = 0.144;
            }
            const halfSize = milesToDegrees / 2;
            const bounds = [
                [lat - halfSize, lon - halfSize],
                [lat + halfSize, lon + halfSize]
            ];
            radarMap.fitBounds(bounds, { padding: [10, 10] });
        }
        
        // Add the current frame
        const currentFrame = radarFrames[currentRadarFrame];
        if (currentFrame) {
            updateRadarLayer(currentFrame);
        }
        
    } catch (error) {
        console.error('Error fetching NWS radar data:', error);
    }
}

// Check if it's currently snowing based on weather data
function isSnowing() {
    if (!currentWeatherData) return false;
    
    // Check current weather code for snow conditions
    const snowCodes = [71, 73, 75, 77, 85, 86]; // Slight snow, Moderate snow, Heavy snow, Snow grains, Slight snow showers, Heavy snow showers
    const currentCode = currentWeatherData.current?.weather_code;
    if (currentCode && snowCodes.includes(currentCode)) {
        return true;
    }
    
    // Also check if there's current snowfall in hourly data
    if (currentWeatherData.hourly?.snowfall && currentWeatherData.hourly?.time) {
        const now = new Date();
        const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
        
        // Find the current hour in the hourly data
        for (let i = 0; i < currentWeatherData.hourly.time.length; i++) {
            const hourTime = new Date(currentWeatherData.hourly.time[i]);
            if (hourTime.getTime() === currentHour.getTime()) {
                const snowfall = currentWeatherData.hourly.snowfall[i] || 0;
                const precipitation = currentWeatherData.hourly.precipitation[i] || 0;
                // If snowfall is greater than precipitation, it's snowing
                if (snowfall > 0 && snowfall >= precipitation) {
                    return true;
                }
                break;
            }
        }
    }
    
    return false;
}

// Get current precipitation rate (rain or snow) in in/hr
function getCurrentPrecipitationRate() {
    if (!currentWeatherData || !currentWeatherData.hourly) return 0;
    
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    
    // Find the current hour in the hourly data
    for (let i = 0; i < currentWeatherData.hourly.time.length; i++) {
        const hourTime = new Date(currentWeatherData.hourly.time[i]);
        if (hourTime.getTime() === currentHour.getTime()) {
            const snowing = isSnowing();
            if (snowing && currentWeatherData.hourly.snowfall) {
                return currentWeatherData.hourly.snowfall[i] || 0;
            } else if (currentWeatherData.hourly.precipitation) {
                return currentWeatherData.hourly.precipitation[i] || 0;
            }
            break;
        }
    }
    return 0;
}

// Get current wind speed in mph
function getCurrentWindSpeed() {
    if (!currentWeatherData || !currentWeatherData.current) return 0;
    return currentWeatherData.current.wind_speed_10m || 0;
}

// Determine precipitation types for a given timestamp from weather data
function getPrecipitationTypesForTime(timestamp) {
    const types = new Set();
    if (!currentWeatherData || !currentWeatherData.hourly) return types;
    
    const targetTime = new Date(timestamp * 1000);
    const targetHour = new Date(targetTime.getFullYear(), targetTime.getMonth(), targetTime.getDate(), targetTime.getHours(), 0, 0);
    
    // Find the closest hour in hourly data
    for (let i = 0; i < currentWeatherData.hourly.time.length; i++) {
        const hourTime = new Date(currentWeatherData.hourly.time[i]);
        if (hourTime.getTime() === targetHour.getTime()) {
            const weatherCode = currentWeatherData.hourly.weather_code?.[i];
            const snowfall = currentWeatherData.hourly.snowfall?.[i] || 0;
            const precipitation = currentWeatherData.hourly.precipitation?.[i] || 0;
            
            // Determine type from weather code
            if (weatherCode) {
                // Snow codes: 71, 73, 75, 77, 85, 86
                if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
                    types.add('snow');
                }
                // Rain codes: 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99
                if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
                    types.add('rain');
                }
                // Freezing rain: 66, 67
                if ([66, 67].includes(weatherCode)) {
                    types.add('freezing_rain');
                }
                // Freezing drizzle: 56, 57
                if ([56, 57].includes(weatherCode)) {
                    types.add('freezing_drizzle');
                }
            }
            
            // Also check snowfall vs precipitation ratio
            if (snowfall > 0 && snowfall >= precipitation * 0.5) {
                types.add('snow');
            } else if (precipitation > 0 && snowfall < precipitation * 0.5) {
                types.add('rain');
            }
            
            break;
        }
    }
    
    return types;
}

// Get precipitation types for current frame and surrounding frames
function getPrecipitationTypesForFrames() {
    const allTypes = new Set();
    
    if (radarFrames.length === 0) {
        // Fallback to current weather data
        const now = Math.floor(Date.now() / 1000);
        const types = getPrecipitationTypesForTime(now);
        types.forEach(type => allTypes.add(type));
        return allTypes;
    }
    
    // Check current frame and a few surrounding frames
    const startIdx = Math.max(0, currentRadarFrame - 2);
    const endIdx = Math.min(radarFrames.length - 1, currentRadarFrame + 2);
    
    for (let i = startIdx; i <= endIdx; i++) {
        const frame = radarFrames[i];
        if (frame && frame.time) {
            const types = getPrecipitationTypesForTime(frame.time);
            types.forEach(type => allTypes.add(type));
        }
    }
    
    return allTypes;
}

// Calculate position percentage on gradient bar (0-100%)
function calculateMarkerPosition(value, min, max) {
    if (value <= min) return 0;
    if (value >= max) return 100;
    return ((value - min) / (max - min)) * 100;
}

// Initialize legend based on current layer type and weather conditions
function initializeLegend() {
    const legend = document.getElementById('radarLegend');
    if (!legend) {
        return;
    }
    
    if (currentRadarLayerType === 'wind') {
        const windSpeed = getCurrentWindSpeed();
        const position = calculateMarkerPosition(windSpeed, 0, 50);
        
        // For wind, show gradient bar with min/max - styled like controls
        legend.innerHTML = `
            <div class="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 pt-4 pb-2 border border-white/30 overflow-visible">
                <span class="text-xs font-semibold text-white">0</span>
                <div class="relative w-32 h-3 rounded-full overflow-visible border border-white/20">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-300 via-cyan-400 via-green-400 via-yellow-400 via-orange-500 to-red-600 rounded-full"></div>
                    <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style="left: ${position}%; z-index: 10;">
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 text-[9px] font-bold text-white whitespace-nowrap" style="max-width: 32px; overflow: hidden; text-overflow: ellipsis;">${windSpeed.toFixed(1)}</div>
                        <div class="w-0.5 h-4 bg-white border border-white/50 shadow-lg"></div>
                    </div>
                </div>
                <span class="text-xs font-semibold text-white">50+</span>
                <span class="text-xs text-white/80 ml-1">mph</span>
            </div>
        `;
    } else if (currentRadarLayerType === 'precipitation') {
        // Determine precipitation types from current and surrounding frames
        const precipitationTypes = getPrecipitationTypesForFrames();
        
        // Determine legend type and labels
        let unitLabel, icon, legendType;
        if (precipitationTypes.has('snow') && !precipitationTypes.has('rain') && !precipitationTypes.has('freezing_rain') && !precipitationTypes.has('freezing_drizzle')) {
            // Only snow
            unitLabel = 'in/hr (snow)';
            icon = '<i class="fas fa-snowflake text-blue-300 mr-1"></i>';
            legendType = 'snow';
        } else if (precipitationTypes.has('rain') && !precipitationTypes.has('snow') && !precipitationTypes.has('freezing_rain') && !precipitationTypes.has('freezing_drizzle')) {
            // Only rain
            unitLabel = 'in/hr (rain)';
            icon = '<i class="fas fa-tint text-blue-300 mr-1"></i>';
            legendType = 'rain';
        } else if (precipitationTypes.size > 1 || precipitationTypes.has('freezing_rain') || precipitationTypes.has('freezing_drizzle')) {
            // Mixed types
            const typeLabels = [];
            if (precipitationTypes.has('rain')) typeLabels.push('rain');
            if (precipitationTypes.has('snow')) typeLabels.push('snow');
            if (precipitationTypes.has('freezing_rain')) typeLabels.push('freezing rain');
            if (precipitationTypes.has('freezing_drizzle')) typeLabels.push('freezing drizzle');
            unitLabel = `in/hr (${typeLabels.join(', ')})`;
            icon = '<i class="fas fa-cloud-rain text-blue-300 mr-1"></i>';
            legendType = 'mixed';
        } else {
            // Default to rain if unclear
            unitLabel = 'in/hr (rain)';
            icon = '<i class="fas fa-tint text-blue-300 mr-1"></i>';
            legendType = 'rain';
        }
        
        const rate = getCurrentPrecipitationRate();
        
        // Precipitation scale: 0, 0.02, 0.08, 0.4, 1.6, 2+
        // Use logarithmic-like positioning for better distribution
        let position = 0;
        if (rate <= 0) {
            position = 0;
        } else if (rate <= 0.02) {
            position = (rate / 0.02) * (100 / 6); // First segment: 0-16.67%
        } else if (rate <= 0.08) {
            position = 16.67 + ((rate - 0.02) / 0.06) * (100 / 6); // Second segment: 16.67-33.33%
        } else if (rate <= 0.4) {
            position = 33.33 + ((rate - 0.08) / 0.32) * (100 / 6); // Third segment: 33.33-50%
        } else if (rate <= 1.6) {
            position = 50 + ((rate - 0.4) / 1.2) * (100 / 6); // Fourth segment: 50-66.67%
        } else if (rate <= 2) {
            position = 66.67 + ((rate - 1.6) / 0.4) * (100 / 6); // Fifth segment: 66.67-83.33%
        } else {
            position = 83.33 + Math.min(((rate - 2) / 2) * (100 / 6), 16.67); // Sixth segment: 83.33-100%
        }
        position = Math.min(100, Math.max(0, position));
        
        // For precipitation, show gradient bar with labels - styled like controls
        legend.innerHTML = `
            <div class="flex flex-col gap-1.5 bg-white/20 backdrop-blur-sm rounded-lg px-3 pt-4 pb-2 border border-white/30 overflow-visible">
                <div class="relative w-48 h-3 rounded-full overflow-visible border border-white/20">
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-400 via-cyan-400 via-green-400 via-yellow-400 via-orange-500 to-red-600 rounded-full"></div>
                    <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style="left: ${position}%; z-index: 10;">
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 text-[9px] font-bold text-white whitespace-nowrap" style="max-width: 48px; overflow: hidden; text-overflow: ellipsis;">${rate.toFixed(1)}</div>
                        <div class="w-0.5 h-4 bg-white border border-white/50 shadow-lg"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-white/90 font-medium">
                    <span>0</span>
                    <span>0.02</span>
                    <span>0.08</span>
                    <span>0.4</span>
                    <span>1.6</span>
                    <span>2+</span>
                </div>
                <div class="text-center">
                    <span class="text-[10px] font-semibold text-white/90">${icon}${unitLabel}</span>
                </div>
            </div>
        `;
    }
}

// Radar layer switching
function updateRadarLayer(frame) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1592',message:'updateRadarLayer called',data:{layerType:currentRadarLayerType,hasFrame:!!frame,framePath:frame?.path,radarFramesLength:radarFrames.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    // For precipitation, we need a frame with path
    if (currentRadarLayerType === 'precipitation') {
        if (!currentLat || !currentLon) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1595',message:'updateRadarLayer precipitation - no lat/lon, returning',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            return;
        }
        if (!frame || !frame.epochTime) {
            // Try to get frame from radarFrames
            if (radarFrames.length > 0) {
                frame = radarFrames[currentRadarFrame] || radarFrames[0];
            } else {
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1601',message:'updateRadarLayer precipitation - no frame, returning early',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
                // #endregion
                return;
            }
        }
    } else if (currentRadarLayerType === 'wind') {
        // Wind doesn't need frame - it fetches current data
        // Allow to proceed even without frame
    } else if (!frame) {
        return;
    }
    
    // Remove existing layers
    if (radarLayer) {
        radarMap.removeLayer(radarLayer);
        radarLayer = null;
    }
    
    // Clear wind layer if switching away from wind
    if (currentRadarLayerType !== 'wind') {
        if (windCanvasLayer) {
            radarMap.removeLayer(windCanvasLayer);
            windCanvasLayer = null;
        }
        windMarkers.forEach(marker => radarMap.removeLayer(marker));
        windMarkers = [];
    }
    
    // Rain and snow use NWS tiles, no canvas layer needed
    
    if (currentRadarLayerType === 'wind') {
        // For wind, show Leaflet map and hide iframe
        const mapContainer = document.getElementById('radarMap');
        const iframeContainer = document.getElementById('radarIframeContainer');
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1630',message:'Updating radar map display for wind',data:{mapContainerExists:!!mapContainer,mapDisplayBefore:mapContainer?.style?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (mapContainer) mapContainer.style.display = 'block';
        if (iframeContainer) iframeContainer.style.display = 'none';
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1634',message:'Map display updated for wind',data:{mapDisplayAfter:mapContainer?.style?.display,legendExists:!!document.getElementById('radarLegend'),legendDisplay:document.getElementById('radarLegend')?.style?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        
        // Invalidate map size to ensure it renders correctly after being hidden
        if (radarMap) {
            setTimeout(() => {
                radarMap.invalidateSize();
                // Ensure map is centered on current location
                if (currentLat && currentLon) {
                    const milesToDegrees = 0.144; // 10x10 miles
                    const halfSize = milesToDegrees / 2;
                    const bounds = [
                        [currentLat - halfSize, currentLon - halfSize],
                        [currentLat + halfSize, currentLon + halfSize]
                    ];
                    radarMap.fitBounds(bounds, { padding: [10, 10] });
                }
            }, 100);
        }
        
        // Fetch and display wind vectors across the map
        fetchWindLayer(frame ? frame.time : null);
    } else if (currentRadarLayerType === 'precipitation') {
        // Precipitation radar - use NWS tiles with Leaflet
        // Show Leaflet map, hide iframe
        const mapContainer = document.getElementById('radarMap');
        const iframeContainer = document.getElementById('radarIframeContainer');
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1673',message:'Updating radar map display for precipitation',data:{mapContainerExists:!!mapContainer,mapDisplayBefore:mapContainer?.style?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (mapContainer) mapContainer.style.display = 'block';
        if (iframeContainer) iframeContainer.style.display = 'none';
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:1681',message:'Map display updated for precipitation',data:{mapDisplayAfter:mapContainer?.style?.display,legendExists:!!document.getElementById('radarLegend'),legendDisplay:document.getElementById('radarLegend')?.style?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Initialize legend when map is shown
        initializeLegend();
        
        
        // Invalidate map size to ensure it renders correctly after being hidden
        if (radarMap) {
            setTimeout(() => {
                radarMap.invalidateSize();
                // Ensure map is centered on current location with 100x100 mile view
                if (currentLat && currentLon) {
                    const milesToDegrees = 1.44; // 100x100 miles
                    const halfSize = milesToDegrees / 2;
                    const bounds = [
                        [currentLat - halfSize, currentLon - halfSize],
                        [currentLat + halfSize, currentLon + halfSize]
                    ];
                    radarMap.fitBounds(bounds, { padding: [10, 10] });
                }
            }, 100);
        }
        
        // Fetch and display precipitation radar tiles
        fetchPrecipitationRadar(frame);
    }
}

async function fetchWindLayer(timestamp) {
    if (!currentLat || !currentLon || !radarMap) return;
    
    // Get map bounds to create a dense grid for streamlines
    const bounds = radarMap.getBounds();
    
    // Check if we can reuse cached data (if bounds haven't changed much)
    if (windDataCache && windDataCache.bounds && windDataCache.timestamp) {
        const cachedBounds = windDataCache.bounds;
        const boundsChanged = 
            Math.abs(cachedBounds.getNorth() - bounds.getNorth()) > 0.01 ||
            Math.abs(cachedBounds.getSouth() - bounds.getSouth()) > 0.01 ||
            Math.abs(cachedBounds.getEast() - bounds.getEast()) > 0.01 ||
            Math.abs(cachedBounds.getWest() - bounds.getWest()) > 0.01;
        
        // If bounds haven't changed much and cache is less than 5 minutes old, reuse it
        const cacheAge = Date.now() - windDataCache.timestamp;
        if (!boundsChanged && cacheAge < 5 * 60 * 1000) {
            console.log('Reusing cached wind data');
            windGridData = windDataCache;
            createWindStreamlines(windGridData, bounds, 8);
            return;
        }
    }
    
    // Clear existing wind visualization
    windMarkers.forEach(marker => radarMap.removeLayer(marker));
    windMarkers = [];
    if (windCanvasLayer) {
        radarMap.removeLayer(windCanvasLayer);
        windCanvasLayer = null;
    }
    
    try {
        
        // Create a moderate grid (8x8 = 64 points) to reduce API calls
        // We use interpolation to create smooth streamlines from fewer data points
        const gridSize = 8;
        const latStep = (bounds.getNorth() - bounds.getSouth()) / (gridSize - 1);
        const lonStep = (bounds.getEast() - bounds.getWest()) / (gridSize - 1);
        
        const gridPoints = [];
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const lat = bounds.getSouth() + (i * latStep);
                const lon = bounds.getWest() + (j * lonStep);
                gridPoints.push({ lat, lon, gridI: i, gridJ: j });
            }
        }
        
        // Fetch only current wind data (no time series needed)
        const windPromises = gridPoints.map(async (point, pointIndex) => {
            // Small delay to avoid rate limiting
            if (pointIndex > 0) {
                await new Promise(resolve => setTimeout(resolve, pointIndex * 10));
            }
            
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&current=wind_speed_10m,wind_direction_10m&windspeed_unit=mph&timezone=auto`);
                const data = await response.json();
                
                if (data.current && data.current.wind_speed_10m !== undefined && data.current.wind_direction_10m !== undefined) {
                    const windSpeed = data.current.wind_speed_10m || 0;
                    const windDirection = data.current.wind_direction_10m || 0;
                    
                    // Convert direction to radians and calculate u/v components
                    const dirRad = (windDirection * Math.PI) / 180;
                    const u = -windSpeed * Math.sin(dirRad);
                    const v = -windSpeed * Math.cos(dirRad);
                    
                    return {
                        lat: point.lat,
                        lon: point.lon,
                        gridI: point.gridI,
                        gridJ: point.gridJ,
                        speed: windSpeed,
                        direction: windDirection,
                        u: u,
                        v: v
                    };
                }
            } catch (error) {
                console.error(`Error fetching wind for point ${pointIndex}:`, error);
            }
            return null;
        });
        
        const windData = await Promise.all(windPromises);
        
        // Filter out null values
        const validWindData = windData.filter(d => d !== null);
        
        // Use current wind data
        windGridData = validWindData;
        
        // Create canvas layer for streamlines
        createWindStreamlines(windGridData, bounds, gridSize);
        
        // Store wind data
        windDataCache = windGridData;
        
        // Mark that we have wind data cached
        windDataCache.bounds = bounds;
        windDataCache.timestamp = Date.now();
        
    } catch (error) {
        console.error('Error fetching wind data:', error);
    }
}

// Fetch and display precipitation radar using NWS WMS tiles
async function fetchPrecipitationRadar(frame) {
    if (!currentLat || !currentLon || !radarMap) return;
    
    // Remove existing radar layer
    if (radarLayer) {
        radarMap.removeLayer(radarLayer);
        radarLayer = null;
    }
    
    try {
        // Get the frame to use if not provided
        let frameToUse = frame;
        if (!frameToUse) {
            // Use current frame or first available frame
            if (radarFrames.length > 0) {
                frameToUse = radarFrames[currentRadarFrame] || radarFrames[0];
            } else {
                console.log('No radar frames available');
                return;
            }
        }
        
        // Ensure we have a valid frame with epochTime
        if (!frameToUse || !frameToUse.epochTime) {
            console.log('No valid frame with epochTime available');
            return;
        }
        
        // #region agent log
        console.log('DEBUG: Creating NWS WMS layer - frame data', {epochTime:frameToUse.epochTime,isoTime:frameToUse.isoTime,time:frameToUse.time,epochTimeStr:frameToUse.epochTime.toString()});
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2221',message:'Creating NWS WMS layer - frame data',data:{epochTime:frameToUse.epochTime,isoTime:frameToUse.isoTime,time:frameToUse.time,epochTimeStr:frameToUse.epochTime.toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // NWS WMS endpoint - try direct connection first (images don't have CORS restrictions)
        // If this doesn't work, we can fall back to proxy
        const wmsUrl = 'https://opengeo.ncep.noaa.gov/geoserver/ows';
        
        // Build WMS options - try without time first since time parameter is causing errors
        // NWS service returns most recent data when time is omitted
        const wmsOptions = {
            layers: 'conus:conus_bref_qcd', // CONUS base reflectivity layer from RIDGE2
            format: 'image/png',
            transparent: true,
            opacity: 0.7,
            attribution: 'NWS',
            zIndex: 1000,
            // Temporarily omit time parameter - NWS returns most recent when omitted
            // TODO: Fix time parameter format for animation support
            // time: frameToUse.epochTime.toString(), // Time parameter in epoch milliseconds for NWS WMS
            version: '1.3.0',
            // Don't specify CRS - let Leaflet use the map's default CRS (EPSG:3857)
            // The layer supports both EPSG:3857 and EPSG:4326, and EPSG:3857 returns larger/better images
            uppercase: true // Some WMS servers require uppercase parameters
        };
        
        // #region agent log
        console.log('DEBUG: WMS layer options before creation', {wmsOptions:wmsOptions,wmsUrl:wmsUrl});
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2234',message:'WMS layer options before creation',data:{wmsOptions:wmsOptions,wmsUrl:wmsUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Create WMS layer for radar reflectivity
        // NWS requires time in epoch milliseconds format
        radarLayer = L.tileLayer.wms(wmsUrl, wmsOptions);
        
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2242',message:'WMS layer created - checking wmsParams',data:{hasWmsParams:!!radarLayer.wmsParams,wmsParams:radarLayer.wmsParams},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Add error handler - capture detailed error information
        radarLayer.on('tileerror', function(error, tile) {
            // #region agent log
            // Try to extract more information from the error
            let tileSrc = null;
            let tileCoords = null;
            try {
                if (tile) {
                    tileSrc = tile.src || tile.getAttribute?.('src') || null;
                    tileCoords = tile.coords || null;
                }
            } catch (e) {}
            
            // Try to fetch the failed tile to see what's actually being returned
            if (tileSrc) {
                fetch(tileSrc).then(r => r.arrayBuffer()).then(buffer => {
                    const bytes = new Uint8Array(buffer.slice(0, 8));
                    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
                    const textDecoder = new TextDecoder();
                    const textStart = textDecoder.decode(buffer.slice(0, 100));
                    console.log('DEBUG: Failed tile analysis', {
                        url:tileSrc,
                        dataSize:buffer.byteLength,
                        isPNG:isPNG,
                        firstBytes:Array.from(bytes),
                        textStart:textStart.substring(0, 100)
                    });
                }).catch(e => {
                    console.log('DEBUG: Failed to analyze tile', {error:e.message,url:tileSrc});
                });
            }
            
            const errorData = {
                hasError: !!error,
                errorType: error?.type,
                errorMessage: error?.error?.message,
                errorStack: error?.error?.stack,
                tileSrc: tileSrc,
                tileCoords: tileCoords,
                tileObject: tile ? Object.keys(tile) : null,
                errorObject: error ? Object.keys(error) : null,
                fullError: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : null
            };
            console.log('DEBUG: NWS tile error', errorData);
            console.log('DEBUG: Tile object:', tile);
            console.log('DEBUG: Error object:', error);
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2250',message:'NWS tile error occurred',data:errorData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            // Suppress errors for missing tiles which are expected
            // Only log if it's not a common CORS/network issue
            if (error && error.error && error.error.message && !error.error.message.includes('Failed to fetch')) {
                console.log('NWS tile error (suppressed):', error);
            }
        });
        
        // Monitor tile loading to capture request URLs
        radarLayer.on('tileloadstart', function(event) {
            // #region agent log
            let tileSrc = null;
            try {
                if (event.tile) {
                    tileSrc = event.tile.src || event.tile.getAttribute?.('src') || null;
                    // Also try to get it from the img element directly
                    if (!tileSrc && event.tile.tagName === 'IMG') {
                        tileSrc = event.tile.src;
                    }
                }
            } catch (e) {}
            console.log('DEBUG: Tile load started', {tileSrc:tileSrc,coords:event.coords,eventKeys:Object.keys(event)});
            // Try to fetch the tile URL directly to see what's being requested and validate the image
            if (tileSrc) {
                fetch(tileSrc).then(r => r.arrayBuffer()).then(buffer => {
                    const bytes = new Uint8Array(buffer.slice(0, 8));
                    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
                    console.log('DEBUG: Direct tile fetch response', {
                        status:200,
                        contentType:'image/png',
                        url:tileSrc,
                        dataSize:buffer.byteLength,
                        isPNG:isPNG,
                        firstBytes:Array.from(bytes)
                    });
                }).catch(e => {
                    console.log('DEBUG: Direct tile fetch error', {error:e.message,url:tileSrc});
                });
            }
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2265',message:'Tile load started',data:{tileSrc:tileSrc,coords:event.coords},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
        });
        
        // Monitor successful tile loads
        radarLayer.on('tileload', function(event) {
            // #region agent log
            let tileSrc = null;
            try {
                if (event.tile) {
                    tileSrc = event.tile.src || event.tile.getAttribute?.('src') || null;
                }
            } catch (e) {}
            console.log('DEBUG: Tile loaded successfully', {tileSrc:tileSrc,coords:event.coords});
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2275',message:'Tile loaded successfully',data:{tileSrc:tileSrc,coords:event.coords},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
        });
        
        radarLayer.addTo(radarMap);
        console.log('Added NWS precipitation layer for time:', frameToUse.isoTime);
        
        // Update time display
        updateRadarTimeDisplay(frameToUse.time);
        
        // Update legend based on precipitation type
        initializeLegend();
        
    } catch (error) {
        console.error('Error fetching NWS precipitation radar:', error);
    }
}

// Update radar frame display with smooth transition
function updateRadarFrame(frame) {
    if (!frame || !frame.epochTime || !radarMap) return;
    
    // Update the WMS layer with new frame using smooth opacity transition
    // Note: Time parameter is currently disabled due to format issues
    // For now, just refresh the layer to show most recent data
    if (radarLayer && radarLayer.wmsParams) {
        // Fade out old layer
        radarLayer.setOpacity(0);
        
        // After fade, refresh the layer (time parameter disabled for now)
        setTimeout(() => {
            if (radarLayer && radarLayer.wmsParams) {
                // Time parameter temporarily disabled - just refresh layer
                // radarLayer.wmsParams.time = frame.epochTime.toString();
                radarLayer.setParams(radarLayer.wmsParams);
                
                // Fade in new layer smoothly
                setTimeout(() => {
                    if (radarLayer) {
                        radarLayer.setOpacity(0.7);
                    }
                }, 50);
            }
        }, 200); // Wait for fade out
    } else if (!radarLayer) {
        // If layer doesn't exist, create it
        fetchPrecipitationRadar(frame);
    }
    
    // Update time display
    updateRadarTimeDisplay(frame.time);
    
    // Update legend based on precipitation type for this frame
    initializeLegend();
}

// Update the time display for current frame
function updateRadarTimeDisplay(timestamp) {
    const timeDisplay = document.getElementById('radarTimeDisplay');
    const timeText = document.getElementById('radarTimeText');
    
    if (timeDisplay && timeText && timestamp) {
        // Convert timestamp (Unix timestamp in seconds) to Date
        const date = new Date(timestamp * 1000);
        const timeStr = formatTime12Hour(date);
        timeText.textContent = timeStr;
        timeDisplay.classList.remove('hidden');
    }
}

// Play/pause radar animation with smooth transitions
let lastFrameTime = 0;
const FRAME_DURATION = 1500; // 1.5 seconds per frame for slower, smoother animation

function animateRadarFrame(currentTime) {
    if (!isRadarAnimating || currentRadarLayerType !== 'precipitation') {
        radarAnimationFrame = null;
        return;
    }
    
    // Use requestAnimationFrame for smooth timing
    if (currentTime - lastFrameTime >= FRAME_DURATION) {
        if (radarFrames.length === 0) {
            isRadarAnimating = false;
            radarAnimationFrame = null;
            return;
        }
        
        // Move to next frame
        if (currentRadarFrame < radarFrames.length - 1) {
            currentRadarFrame = currentRadarFrame + 1;
        } else {
            // Reached the end - reset to current time (frame 0) and stop animation
            currentRadarFrame = 0;
            const frame = radarFrames[currentRadarFrame];
            updateRadarFrame(frame);
            toggleRadarAnimation();
            return;
        }
        const frame = radarFrames[currentRadarFrame];
        
        // Update frame with smooth transition
        updateRadarFrame(frame);
        
        lastFrameTime = currentTime;
    }
    
    // Continue animation loop
    radarAnimationFrame = requestAnimationFrame(animateRadarFrame);
}

function toggleRadarAnimation() {
    if (currentRadarLayerType !== 'precipitation') {
        return; // Only animate precipitation layer
    }
    
    if (isRadarAnimating) {
        // Pause animation
        if (radarAnimationFrame) {
            cancelAnimationFrame(radarAnimationFrame);
            radarAnimationFrame = null;
        }
        if (radarAnimationInterval) {
            clearInterval(radarAnimationInterval);
            radarAnimationInterval = null;
        }
        isRadarAnimating = false;
        
        // Update button icon
        const playPauseBtn = document.getElementById('radarPlayPause');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
            playPauseBtn.title = 'Play Animation';
        }
    } else {
        // Start animation
        if (radarFrames.length === 0) {
            console.log('No radar frames available for animation');
            return;
        }
        
        isRadarAnimating = true;
        lastFrameTime = performance.now();
        
        // Update button icon
        const playPauseBtn = document.getElementById('radarPlayPause');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            }
            playPauseBtn.title = 'Pause Animation';
        }
        
        // Show time display
        const timeDisplay = document.getElementById('radarTimeDisplay');
        if (timeDisplay) {
            timeDisplay.classList.remove('hidden');
        }
        
        // Update initial time display
        if (radarFrames.length > 0) {
            const currentFrame = radarFrames[currentRadarFrame] || radarFrames[radarFrames.length - 1];
            if (currentFrame && currentFrame.time) {
                updateRadarTimeDisplay(currentFrame.time);
            }
        }
        
        // Start smooth animation loop using requestAnimationFrame
        radarAnimationFrame = requestAnimationFrame(animateRadarFrame);
    }
}

function createWindStreamlines(windData, bounds, gridSize) {
    // Remove existing canvas layer and stop animation
    if (windCanvasLayer) {
        radarMap.removeLayer(windCanvasLayer);
        windCanvasLayer = null;
    }
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1001';
    const ctx = canvas.getContext('2d');
    
    // Store wind data reference for animation updates
    let currentWindData = windData;
    let pulseOffset = 0; // Animation offset for pulsing effect
    let isAnimating = false;
    let cachedStreamlines = null; // Cache generated streamlines to avoid regenerating every frame
    
    // Function to interpolate wind vector at any point using bilinear interpolation
    function getWindAtPoint(lat, lon, data = currentWindData) {
        if (!data || data.length === 0) return null;
        
        // Find the 4 nearest points for bilinear interpolation
        const neighbors = [];
        data.forEach(wind => {
            const dist = Math.sqrt(
                Math.pow(wind.lat - lat, 2) + 
                Math.pow(wind.lon - lon, 2)
            );
            neighbors.push({ ...wind, dist });
        });
        
        // Sort by distance
        neighbors.sort((a, b) => a.dist - b.dist);
        
        // Use the nearest point if within reasonable distance (much larger threshold)
        const nearest = neighbors[0];
        if (nearest && nearest.dist < 1.0) { // Very large threshold to ensure we always get data
            return { u: nearest.u, v: nearest.v, speed: nearest.speed || 0 };
        }
        
        // If we have at least 2 neighbors, do weighted interpolation
        if (neighbors.length >= 2) {
            const n1 = neighbors[0];
            const n2 = neighbors[1];
            
            // Use inverse distance weighting
            const w1 = 1 / (n1.dist + 0.001);
            const w2 = 1 / (n2.dist + 0.001);
            const totalWeight = w1 + w2;
            
            const u = (n1.u * w1 + n2.u * w2) / totalWeight;
            const v = (n1.v * w1 + n2.v * w2) / totalWeight;
            const speed = (n1.speed * w1 + n2.speed * w2) / totalWeight;
            
            return { u, v, speed: speed || 0 };
        }
        
        // If we have at least 4 neighbors, do bilinear interpolation
        if (neighbors.length >= 4) {
            const n1 = neighbors[0];
            const n2 = neighbors[1];
            const n3 = neighbors[2];
            const n4 = neighbors[3];
            
            // Simple weighted average
            const w1 = 1 / (n1.dist + 0.001);
            const w2 = 1 / (n2.dist + 0.001);
            const w3 = 1 / (n3.dist + 0.001);
            const w4 = 1 / (n4.dist + 0.001);
            const totalWeight = w1 + w2 + w3 + w4;
            
            const u = (n1.u * w1 + n2.u * w2 + n3.u * w3 + n4.u * w4) / totalWeight;
            const v = (n1.v * w1 + n2.v * w2 + n3.v * w3 + n4.v * w4) / totalWeight;
            const speed = (n1.speed * w1 + n2.speed * w2 + n3.speed * w3 + n4.speed * w4) / totalWeight;
            
            return { u, v, speed: speed || 0 };
        }
        
        // Always return something, even if far away
        if (nearest) {
            return { u: nearest.u, v: nearest.v, speed: nearest.speed || 0 };
        }
        
        return null;
    }
    
    // Function to trace a long, continuous streamline
    function traceStreamline(startLat, startLon, forward = true, data = currentWindData) {
        const points = [];
        
        // Get current zoom level to adjust step size for consistent screen length
        const zoom = radarMap.getZoom();
        // Base step size in pixels - this will remain constant on screen
        const pixelStepSize = 3; // pixels per step
        // Convert pixel step to geographic step based on zoom level
        // At zoom level z, 1 degree ≈ 256 * 2^z pixels at equator (Web Mercator approximation)
        // Adjust for latitude
        const metersPerPixel = (40075017 / (256 * Math.pow(2, zoom))) * Math.cos(startLat * Math.PI / 180);
        const degreesPerPixel = metersPerPixel / 111320; // approximate meters per degree
        const stepSize = pixelStepSize * degreesPerPixel;
        
        let currentLat = startLat;
        let currentLon = startLon;
        const maxSteps = 1000; // More steps for longer lines
        
        // Track visited areas to avoid loops (very loose)
        const visited = new Set();
        const visitKey = (lat, lon) => `${Math.round(lat * 10)}_${Math.round(lon * 10)}`; // Very loose precision
        
        let lastWind = null;
        let consecutiveFailures = 0;
        
        for (let step = 0; step < maxSteps; step++) {
            const wind = getWindAtPoint(currentLat, currentLon, data);
            
            if (!wind) {
                consecutiveFailures++;
                // Use last known wind direction if available
                if (lastWind && consecutiveFailures < 10) {
                    const magnitude = Math.sqrt(lastWind.u * lastWind.u + lastWind.v * lastWind.v);
                    if (magnitude > 0.001) {
                        const uNorm = lastWind.u / magnitude;
                        const vNorm = lastWind.v / magnitude;
                        
                        // Use pixel-based step size
                        const latStep = (vNorm * stepSize * (forward ? 1 : -1));
                        const lonStep = (uNorm * stepSize * (forward ? 1 : -1)) / Math.cos(currentLat * Math.PI / 180);
                        
                        currentLat += latStep;
                        currentLon += lonStep;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                lastWind = wind;
                consecutiveFailures = 0;
                const speed = wind.speed || 0;
                
                // Normalize direction
                const magnitude = Math.sqrt(wind.u * wind.u + wind.v * wind.v);
                if (magnitude < 0.001) {
                    // Very weak wind, use a default direction
                    break;
                }
                
                const uNorm = wind.u / magnitude;
                const vNorm = wind.v / magnitude;
                
                // Convert to lat/lon step using pixel-based step size
                const latStep = (vNorm * stepSize * (forward ? 1 : -1));
                const lonStep = (uNorm * stepSize * (forward ? 1 : -1)) / Math.cos(currentLat * Math.PI / 180);
                
                currentLat += latStep;
                currentLon += lonStep;
            }
            
            // Check for loops (very loose - only break on exact repeats after many points)
            const key = visitKey(currentLat, currentLon);
            if (visited.has(key) && points.length > 50) {
                // Only break if we've traced a long way and hit a loop
                break;
            }
            visited.add(key);
            
            // Check bounds with very generous padding
            const padding = 0.1; // Very large padding
            if (currentLat < bounds.getSouth() - padding || currentLat > bounds.getNorth() + padding ||
                currentLon < bounds.getWest() - padding || currentLon > bounds.getEast() + padding) {
                break;
            }
            
            // Get wind speed for this point
            const windAtPoint = getWindAtPoint(currentLat, currentLon, data);
            const speed = windAtPoint ? (windAtPoint.speed || 0) : 0;
            
            points.push([currentLat, currentLon, speed]);
        }
        
        return points;
    }
    
    // Animation function for pulsing effect
    function animatePulse() {
        if (!isAnimating) return;
        
        pulseOffset += 1.5; // Speed of pulse animation
        if (pulseOffset >= 100) pulseOffset = 0;
        
        // Only redraw the canvas with new pulse position - NO data fetching, NO streamline regeneration
        // Just redraw existing cached streamlines with updated pulse position
        if (cachedStreamlines && radarMap && canvas && ctx) {
            // Clear and redraw with new pulse position
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawStreamlines(cachedStreamlines);
        }
        
        requestAnimationFrame(animatePulse);
    }
    
    // Update canvas function - create smooth, continuous flow lines
    const updateCanvas = (data = currentWindData) => {
        const mapSize = radarMap.getSize();
        const currentBounds = radarMap.getBounds();
        
        canvas.width = mapSize.x;
        canvas.height = mapSize.y;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!data || data.length === 0) {
            console.log('No wind data available');
            return;
        }
        
        // Only regenerate streamlines if we don't have cached ones or data changed
        if (!cachedStreamlines) {
            console.log('Generating streamlines with', data.length, 'wind data points');
            
            // Use fewer seed points but trace much longer lines
            const seedGridSize = 8; // 8x8 = 64 seed points for better coverage
            const latStep = (currentBounds.getNorth() - currentBounds.getSouth()) / (seedGridSize - 1);
            const lonStep = (currentBounds.getEast() - currentBounds.getWest()) / (seedGridSize - 1);
            
            // Store all continuous streamlines
            const allStreamlines = [];
            
            // Generate long, continuous streamlines from seed points
            for (let i = 0; i < seedGridSize; i++) {
                for (let j = 0; j < seedGridSize; j++) {
                    const startLat = currentBounds.getSouth() + (i * latStep);
                    const startLon = currentBounds.getWest() + (j * lonStep);
                    
                    // Trace forward and backward to create one long continuous streamline
                    const forwardPoints = traceStreamline(startLat, startLon, true, data);
                    const backwardPoints = traceStreamline(startLat, startLon, false, data).reverse();
                    
                    // Combine into one continuous streamline
                    const completeStreamline = [...backwardPoints, [startLat, startLon, 0], ...forwardPoints];
                    
                    if (completeStreamline.length >= 10) { // Require at least 10 points for a visible line
                        // Calculate average speed for coloring
                        let totalSpeed = 0;
                        let speedCount = 0;
                        completeStreamline.forEach((point) => {
                            if (point[2] !== undefined && point[2] >= 0) {
                                totalSpeed += point[2];
                                speedCount++;
                            }
                        });
                        const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
                        
                        allStreamlines.push({
                            points: completeStreamline,
                            avgSpeed: avgSpeed
                        });
                    }
                }
            }
            
            console.log('Generated', allStreamlines.length, 'streamlines');
            
            if (allStreamlines.length === 0) {
                console.warn('No streamlines generated! Check traceStreamline function.');
                // Draw a test line to verify canvas is working
                ctx.beginPath();
                ctx.moveTo(10, 10);
                ctx.lineTo(100, 100);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.stroke();
                console.log('Drew test line to verify canvas');
                return;
            }
            
            // Cache the streamlines
            cachedStreamlines = allStreamlines;
        }
        
        // Draw the cached streamlines
        drawStreamlines(cachedStreamlines);
    };
    
    // Function to draw streamlines (separated from generation for animation)
    function drawStreamlines(allStreamlines) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw all streamlines as smooth, continuous lines
        allStreamlines.forEach((streamline, index) => {
            const avgSpeed = streamline.avgSpeed;
            const completeStreamline = streamline.points;
            
            // Color based on average wind speed
            let color = '#7dd3fc'; // Light blue for light wind
            if (avgSpeed > 30) color = '#f87171'; // Red for strong
            else if (avgSpeed > 20) color = '#fb923c'; // Orange for moderate-strong
            else if (avgSpeed > 15) color = '#fbbf24'; // Yellow for moderate
            else if (avgSpeed > 10) color = '#60a5fa'; // Blue for light-moderate
            
            // Draw the continuous streamline with smooth curves
            ctx.beginPath();
            let isFirstPoint = true;
            const pixelPoints = [];
            
            completeStreamline.forEach((point) => {
                const [lat, lon] = point;
                try {
                    const pixelPoint = radarMap.latLngToContainerPoint([lat, lon]);
                    pixelPoints.push({ x: pixelPoint.x, y: pixelPoint.y });
                    
                    if (isFirstPoint) {
                        ctx.moveTo(pixelPoint.x, pixelPoint.y);
                        isFirstPoint = false;
                    } else {
                        ctx.lineTo(pixelPoint.x, pixelPoint.y);
                    }
                } catch (e) {
                    // Skip invalid points
                    console.warn('Invalid point:', lat, lon, e);
                }
            });
            
            // Only draw if we have valid points
            if (pixelPoints.length < 2) {
                return;
            }
            
            // Draw smooth, continuous line with pulsing animation
            // Create gradient for pulsing effect
            const gradient = ctx.createLinearGradient(
                pixelPoints[0].x, pixelPoints[0].y,
                pixelPoints[pixelPoints.length - 1].x,
                pixelPoints[pixelPoints.length - 1].y
            );
            
            // Calculate pulse position along the line (0 to 1)
            const pulsePosition = (pulseOffset % 100) / 100;
            const pulseWidth = 0.3; // Width of the pulse
            
            // Create gradient stops for pulsing effect
            for (let i = 0; i <= 10; i++) {
                const pos = i / 10;
                let alpha = 0.3; // Base opacity
                
                // Create pulse effect moving along the line
                const distFromPulse = Math.abs(pos - pulsePosition);
                if (distFromPulse < pulseWidth) {
                    // Bright pulse in the center, fading out
                    const pulseIntensity = 1 - (distFromPulse / pulseWidth);
                    alpha = 0.3 + (pulseIntensity * 0.55); // 0.3 to 0.85
                }
                
                // Wrap around for continuous effect
                const distFromPulseWrapped = Math.min(distFromPulse, 1 - distFromPulse);
                if (distFromPulseWrapped < pulseWidth) {
                    const pulseIntensity = 1 - (distFromPulseWrapped / pulseWidth);
                    alpha = Math.max(alpha, 0.3 + (pulseIntensity * 0.55));
                }
                
                gradient.addColorStop(pos, `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${alpha})`);
            }
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            // Also draw base line for better visibility
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 3.5;
            ctx.stroke();
            
            // Debug: log first streamline only once
            if (index === 0 && pulseOffset === 0) {
                console.log('Drawing first streamline:', {
                    points: completeStreamline.length,
                    pixelPoints: pixelPoints.length,
                    color: color,
                    avgSpeed: avgSpeed
                });
            }
            
            // Draw minimal arrows - only a few per streamline
            if (pixelPoints.length >= 20) {
                const numArrows = Math.min(3, Math.floor(pixelPoints.length / 100)); // Max 3 arrows per line
                const arrowSpacing = Math.floor(pixelPoints.length / (numArrows + 1));
                const arrowSize = 6;
                
                for (let a = 1; a <= numArrows; a++) {
                    const arrowIndex = a * arrowSpacing;
                    if (arrowIndex >= pixelPoints.length - 1) break;
                    
                    const arrowPoint = pixelPoints[arrowIndex];
                    const nextPoint = pixelPoints[Math.min(arrowIndex + 3, pixelPoints.length - 1)];
                    
                    // Calculate direction
                    const dx = nextPoint.x - arrowPoint.x;
                    const dy = nextPoint.y - arrowPoint.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // Draw small, subtle arrow
                    ctx.save();
                    ctx.translate(arrowPoint.x, arrowPoint.y);
                    ctx.rotate(angle);
                    
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-arrowSize, -arrowSize / 2.5);
                    ctx.lineTo(-arrowSize * 0.7, 0);
                    ctx.lineTo(-arrowSize, arrowSize / 2.5);
                    ctx.closePath();
                    
                    ctx.fillStyle = color;
                    ctx.globalAlpha = 0.85;
                    ctx.fill();
                    
                    ctx.restore();
                }
            }
        });
    }
    
    // Create custom layer class
    const WindCanvasLayer = L.Layer.extend({
        onAdd: function(map) {
            this._map = map;
            this._canvas = canvas;
            this._ctx = ctx;
            this._windData = currentWindData;
            map.getPanes().overlayPane.appendChild(canvas);
            this._reset();
            map.on('moveend', this._reset, this);
            map.on('zoomend', this._reset, this);
            updateCanvas(this._windData);
            
            // Start pulse animation
            isAnimating = true;
            animatePulse();
        },
        
        onRemove: function(map) {
            // Stop animation
            isAnimating = false;
            map.getPanes().overlayPane.removeChild(canvas);
            map.off('moveend', this._reset, this);
            map.off('zoomend', this._reset, this);
        },
        
        _reset: function() {
            const mapSize = this._map.getSize();
            canvas.style.width = mapSize.x + 'px';
            canvas.style.height = mapSize.y + 'px';
            canvas.width = mapSize.x;
            canvas.height = mapSize.y;
            // Clear cache when map resets (zoom/pan) to regenerate streamlines for new view
            cachedStreamlines = null;
            this._redraw();
        },
        
        _redraw: function() {
            // Use stored wind data or current data
            const dataToUse = this._windData || currentWindData || windGridData;
            if (dataToUse) {
                currentWindData = dataToUse;
                // Clear cache to force regeneration with new map bounds
                cachedStreamlines = null;
                updateCanvas(dataToUse);
            }
        }
    });
    
    windCanvasLayer = new WindCanvasLayer();
    windCanvasLayer.addTo(radarMap);
}

function switchRadarLayer(layerType) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2615',message:'switchRadarLayer called',data:{layerType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    currentRadarLayerType = layerType;
    
    // Update button styles
    document.querySelectorAll('.radar-layer-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500/30', 'border-blue-400');
        btn.classList.add('bg-white/20', 'border-transparent');
    });
    
    const activeBtn = document.getElementById(`radarLayer${layerType.charAt(0).toUpperCase() + layerType.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white/20', 'border-transparent');
        activeBtn.classList.add('bg-blue-500/30', 'border-blue-400');
    }
    
    // Update legend
    initializeLegend();
    
    // Update map view size based on layer type
    if (layerType === 'wind') {
        // For wind: 10x10 miles - update Leaflet map
        if (radarMap && currentLat && currentLon) {
            const milesToDegrees = 0.144; // 10x10 miles
            const halfSize = milesToDegrees / 2;
            const bounds = [
                [currentLat - halfSize, currentLon - halfSize],
                [currentLat + halfSize, currentLon + halfSize]
            ];
            radarMap.fitBounds(bounds, { padding: [10, 10] });
        }
        
        // Update the radar layer for wind (doesn't need radar frames)
        updateRadarLayer(null);
    } else if (layerType === 'precipitation') {
        // Stop animation if switching away from precipitation
        if (isRadarAnimating) {
            toggleRadarAnimation();
        }
        
        // Show time display for precipitation layer
        const timeDisplay = document.getElementById('radarTimeDisplay');
        if (timeDisplay) {
            timeDisplay.classList.remove('hidden');
        }
        
        // Show map container immediately so legend is visible
        const mapContainer = document.getElementById('radarMap');
        const iframeContainer = document.getElementById('radarIframeContainer');
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2724',message:'switchRadarLayer precipitation - showing map container',data:{mapContainerExists:!!mapContainer,mapDisplayBefore:mapContainer?.style?.display,legendExists:!!document.getElementById('radarLegend'),legendInnerHTML:document.getElementById('radarLegend')?.innerHTML?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        if (mapContainer) mapContainer.style.display = 'block';
        if (iframeContainer) iframeContainer.style.display = 'none';
        // #region agent log
        setTimeout(() => {
            const legend = document.getElementById('radarLegend');
            const computedStyle = window.getComputedStyle(legend);
            const rect = legend.getBoundingClientRect();
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2727',message:'switchRadarLayer precipitation - after showing map',data:{mapDisplayAfter:mapContainer?.style?.display,legendExists:!!legend,legendInnerHTMLLength:legend?.innerHTML?.length,legendDisplay:computedStyle.display,legendVisibility:computedStyle.visibility,legendOpacity:computedStyle.opacity,legendWidth:rect.width,legendHeight:rect.height,parentDisplay:legend?.parentElement?.style?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
        }, 50);
        // #endregion
        
        // For precipitation: Update Leaflet map with NWS tiles
        if (radarMap && currentLat && currentLon) {
            const milesToDegrees = 1.44; // 100x100 miles
            const halfSize = milesToDegrees / 2;
            const bounds = [
                [currentLat - halfSize, currentLon - halfSize],
                [currentLat + halfSize, currentLon + halfSize]
            ];
            radarMap.fitBounds(bounds, { padding: [10, 10] });
        }
        
        // Update the radar layer for precipitation
        if (radarFrames.length > 0) {
            const currentFrame = radarFrames[currentRadarFrame] || radarFrames[0];
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2740',message:'switchRadarLayer precipitation - calling updateRadarLayer with frame',data:{hasFrame:!!currentFrame},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            updateRadarLayer(currentFrame);
        } else {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2743',message:'switchRadarLayer precipitation - calling fetchRadarData (no frames)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            // Fetch radar data if we don't have frames
            fetchNWSRadarData(currentLat, currentLon);
        }
        // #region agent log
        setTimeout(() => {
            const legend = document.getElementById('radarLegend');
            const computedStyle = window.getComputedStyle(legend);
            const rect = legend.getBoundingClientRect();
            fetch('http://127.0.0.1:7244/ingest/3ad439b4-bfd8-472a-b938-f75691213087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2747',message:'switchRadarLayer precipitation - final legend state',data:{legendExists:!!legend,legendInnerHTMLLength:legend?.innerHTML?.length,legendDisplay:computedStyle.display,legendVisibility:computedStyle.visibility,legendWidth:rect.width,legendHeight:rect.height,isVisible:rect.width > 0 && rect.height > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
        }, 200);
        // #endregion
    } else if (layerType === 'wind') {
        // Hide time display for wind layer
        const timeDisplay = document.getElementById('radarTimeDisplay');
        if (timeDisplay) {
            timeDisplay.classList.add('hidden');
        }
    }
}

// Precipitation navigation now uses the same controls as wind (radarZoomIn, etc.)
// No separate setup needed - setupRadarNavigation() handles both

// Radar layer buttons - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Radar layer buttons
    const precipBtn = document.getElementById('radarLayerPrecipitation');
    const windBtn = document.getElementById('radarLayerWind');
    
    if (precipBtn) {
        precipBtn.addEventListener('click', () => switchRadarLayer('precipitation'));
    }
    if (windBtn) {
        windBtn.addEventListener('click', () => switchRadarLayer('wind'));
    }
    
});

