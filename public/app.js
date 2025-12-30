let currentLat = null;
let currentLon = null;
let currentLocationName = null;
let currentWeatherData = null; // Store full weather data for modals
let favorites = []; // Array of favorite locations
let hourlyChart = null;
let dailyChart = null;
// Layer switching removed - Ventusky handles layers internally

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

// Prevent iframe from opening new tabs
// Override window.open globally to prevent Ventusky iframe from opening new tabs
const originalWindowOpen = window.open;
window.open = function(url, target, features) {
    // Block any attempts to open new tabs/windows from iframes
    if (url && (url.includes('ventusky.com') || url.includes('ventusky'))) {
        console.log('Blocked Ventusky window.open:', url);
        return null;
    }
    // Also block if target is _blank and URL is from Ventusky
    if (target === '_blank' && url && (url.includes('ventusky.com') || url.includes('ventusky'))) {
        console.log('Blocked Ventusky _blank link:', url);
        return null;
    }
    // Allow other window.open calls (for legitimate uses)
    return originalWindowOpen.apply(this, arguments);
};

// Intercept postMessage from iframe that might try to open new tabs
window.addEventListener('message', (event) => {
    // Only trust messages from Ventusky domain
    if (event.origin.includes('ventusky.com')) {
        // Block any messages that might trigger navigation
        if (event.data && (typeof event.data === 'string' || typeof event.data === 'object')) {
            const dataStr = JSON.stringify(event.data);
            if (dataStr.includes('open') || dataStr.includes('navigate') || dataStr.includes('window')) {
                console.log('Blocked Ventusky postMessage:', event.data);
                event.stopPropagation();
                return false;
            }
        }
    }
}, { capture: true });

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
        
        // Initialize Ventusky radar
        initializeVentuskyRadar(lat, lon);
        
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

// Ventusky Radar functionality
function initializeVentuskyRadar(lat, lon) {
    // Build Ventusky URL with location parameters
    // Format: https://www.ventusky.com/precipitation-map?p=[lat];[lon];[zoom]&l=[layer]
    // Using precipitation map as default - users can change layers within Ventusky
    // Zoom level 8 shows approximately 50 miles x 50 miles
    // Use slightly higher zoom on mobile to show less area but more detail
    const isMobile = window.innerWidth <= 768;
    const zoom = isMobile ? 9 : 8; // Higher zoom on mobile for better detail
    // Use proxy route to request desktop version (removes download app button)
    const ventuskyUrl = `/ventusky-proxy/precipitation-map?p=${lat};${lon};${zoom}&l=rain`;
    
    // Set iframe source
    const ventuskyFrame = document.getElementById('ventuskyFrame');
    if (ventuskyFrame) {
        ventuskyFrame.src = ventuskyUrl;
        
        // Prevent iframe from opening in new tab
        ventuskyFrame.addEventListener('load', () => {
            try {
                // Try to access iframe content to prevent new tab opens
                // This may fail due to cross-origin restrictions, but we'll try
                const iframeWindow = ventuskyFrame.contentWindow;
                if (iframeWindow) {
                    // Override window.open if possible
                    iframeWindow.open = function() {
                        console.log('Blocked iframe window.open');
                        return null;
                    };
                }
            } catch (e) {
                // Cross-origin restrictions prevent this, which is expected
            }
        });
    }
    
    // Prevent container clicks and scroll events from opening new tabs
    const radarContainer = document.getElementById('radarContainer');
    const ventuskyContainer = document.getElementById('ventuskyContainer');
    
    if (radarContainer) {
        // Track if user is scrolling to prevent accidental interactions
        let scrollTimeout;
        let isUserScrolling = false;
        
        // Monitor page scroll to detect when user is actively scrolling
        window.addEventListener('scroll', () => {
            isUserScrolling = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isUserScrolling = false;
            }, 300);
        }, { passive: true });
        
        // Prevent clicks during or right after scrolling
        radarContainer.addEventListener('click', (e) => {
            if (isUserScrolling) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            // Only prevent if clicking outside the iframe
            if (e.target === radarContainer || e.target === ventuskyContainer) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, { passive: false, capture: true });
        
        // Prevent focus events that might trigger new tabs
        radarContainer.addEventListener('focusin', (e) => {
            if (isUserScrolling) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { capture: true });
    }
}

function updateVentuskyLocation(lat, lon) {
    // Update iframe URL when location changes
    // Zoom level 8 shows approximately 50 miles x 50 miles on desktop
    // Use slightly higher zoom on mobile to show less area but more detail
    const isMobile = window.innerWidth <= 768;
    const zoom = isMobile ? 9 : 8;
    // Use proxy route to request desktop version (removes download app button)
    const ventuskyUrl = `/ventusky-proxy/precipitation-map?p=${lat};${lon};${zoom}&l=rain`;
    
    const ventuskyFrame = document.getElementById('ventuskyFrame');
    if (ventuskyFrame) {
        ventuskyFrame.src = ventuskyUrl;
    }
}

