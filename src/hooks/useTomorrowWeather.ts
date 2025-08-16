import { useState, useCallback } from 'react';

export interface TomorrowWeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  precipitationType: 'none' | 'rain' | 'snow' | 'sleet' | 'hail';
  precipitationIntensity: number;
  condition: string;
  description: string;
  windSpeed: number;
  pressure: number;
  visibility: number;
  cloudCover: number;
  uvIndex: number;
  dewPoint: number;
  weatherCode: number;
}

export interface TomorrowForecastData {
  time: string;
  timestampUTC: number;
  temperature: number;
  condition: string;
  description: string;
  precipitation: number;
  precipitationType: string;
  precipitationIntensity: number;
  windSpeed: number;
  cloudCover: number;
  weatherCode: number;
}

export interface TomorrowWeatherResponse {
  current: TomorrowWeatherData;
  minutely: TomorrowForecastData[];
  hourly: TomorrowForecastData[];
  daily: TomorrowForecastData[];
}

export interface TomorrowTimelineData {
  timelineId: string;
  coordinates: [number, number];
  data: TomorrowWeatherResponse;
  cachedAt: number;
}

// Cache implementation
class WeatherCache {
  private cache = new Map<string, TomorrowTimelineData>();
  private maxCacheAge = 10 * 60 * 1000; // 10 minutes

  getCacheKey(lat: number, lon: number): string {
    // Round to 2 decimal places for consistent caching
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    return `${roundedLat},${roundedLon}`;
  }

  get(lat: number, lon: number): TomorrowTimelineData | null {
    const key = this.getCacheKey(lat, lon);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.cachedAt < this.maxCacheAge) {
      console.log(`Cache hit for ${key}`);
      return cached;
    }
    
    if (cached) {
      console.log(`Cache expired for ${key}`);
      this.cache.delete(key);
    }
    
    return null;
  }

  set(lat: number, lon: number, data: TomorrowWeatherResponse): void {
    const key = this.getCacheKey(lat, lon);
    const timelineData: TomorrowTimelineData = {
      timelineId: `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      coordinates: [lon, lat],
      data,
      cachedAt: Date.now()
    };
    
    this.cache.set(key, timelineData);
    console.log(`Cached weather data for ${key}`);
    
    // Clean up old entries
    this.cleanup();
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cache.forEach((value, key) => {
      if (now - value.cachedAt > this.maxCacheAge) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.cache.delete(key);
      console.log(`Cleaned up expired cache entry: ${key}`);
    });
  }

  clear(): void {
    this.cache.clear();
    console.log('Weather cache cleared');
  }

  size(): number {
    return this.cache.size;
  }
}

const weatherCache = new WeatherCache();

export const useTomorrowWeather = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_KEY = 'o7psjSwPMU8LiIehO5CsgTUfNcVRHGCA';
  const BASE_URL = 'https://api.tomorrow.io/v4';

  const getWeatherCondition = (weatherCode: number): { condition: string; description: string } => {
    const conditions: { [key: number]: { condition: string; description: string } } = {
      0: { condition: 'Unknown', description: 'Unknown' },
      1000: { condition: 'Clear', description: 'Clear, Sunny' },
      1100: { condition: 'Mostly Clear', description: 'Mostly Clear' },
      1101: { condition: 'Partly Cloudy', description: 'Partly Cloudy' },
      1102: { condition: 'Mostly Cloudy', description: 'Mostly Cloudy' },
      1001: { condition: 'Cloudy', description: 'Cloudy' },
      2000: { condition: 'Fog', description: 'Fog' },
      2100: { condition: 'Light Fog', description: 'Light Fog' },
      4000: { condition: 'Drizzle', description: 'Drizzle' },
      4001: { condition: 'Rain', description: 'Rain' },
      4200: { condition: 'Light Rain', description: 'Light Rain' },
      4201: { condition: 'Heavy Rain', description: 'Heavy Rain' },
      5000: { condition: 'Snow', description: 'Snow' },
      5001: { condition: 'Flurries', description: 'Flurries' },
      5100: { condition: 'Light Snow', description: 'Light Snow' },
      5101: { condition: 'Heavy Snow', description: 'Heavy Snow' },
      6000: { condition: 'Freezing Drizzle', description: 'Freezing Drizzle' },
      6001: { condition: 'Freezing Rain', description: 'Freezing Rain' },
      6200: { condition: 'Light Freezing Rain', description: 'Light Freezing Rain' },
      6201: { condition: 'Heavy Freezing Rain', description: 'Heavy Freezing Rain' },
      7000: { condition: 'Ice Pellets', description: 'Ice Pellets' },
      7101: { condition: 'Heavy Ice Pellets', description: 'Heavy Ice Pellets' },
      7102: { condition: 'Light Ice Pellets', description: 'Light Ice Pellets' },
      8000: { condition: 'Thunderstorm', description: 'Thunderstorm' },
    };

    return conditions[weatherCode] || { condition: 'Unknown', description: 'Unknown Weather' };
  };

  const getPrecipitationType = (weatherCode: number): 'none' | 'rain' | 'snow' | 'sleet' | 'hail' => {
    if ([4000, 4001, 4200, 4201].includes(weatherCode)) return 'rain';
    if ([5000, 5001, 5100, 5101].includes(weatherCode)) return 'snow';
    if ([6000, 6001, 6200, 6201].includes(weatherCode)) return 'sleet';
    if ([7000, 7101, 7102].includes(weatherCode)) return 'hail';
    return 'none';
  };

  const getWeatherData = useCallback(async (
    lat: number, 
    lon: number, 
    startTime?: Date,
    endTime?: Date
  ): Promise<TomorrowWeatherResponse | null> => {
    console.log('Starting Tomorrow.io weather data fetch...', { lat, lon });
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = weatherCache.get(lat, lon);
      if (cached) {
        setLoading(false);
        return cached.data;
      }

      // Round coordinates for API consistency
      const roundedLat = Math.round(lat * 10000) / 10000;
      const roundedLon = Math.round(lon * 10000) / 10000;

      // Set up time range for forecast - next 5 days if not specified
      const start = startTime || new Date();
      const end = endTime || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      const startIso = start.toISOString();
      const endIso = end.toISOString();

      // Define all weather fields we want
      const fields = [
        'temperature',
        'humidity',
        'precipitationIntensity',
        'precipitationType',
        'windSpeed',
        'pressureSeaLevel',
        'visibility',
        'cloudCover',
        'uvIndex',
        'dewPoint',
        'weatherCode'
      ].join(',');

      console.log('Fetching Tomorrow.io data for coordinates:', { lat: roundedLat, lon: roundedLon });

      // Get timeline data with minutely, hourly, and daily intervals
      const timelineUrl = `${BASE_URL}/timelines?` + new URLSearchParams({
        location: `${roundedLat},${roundedLon}`,
        fields: fields,
        timesteps: '1m,1h,1d',
        startTime: startIso,
        endTime: endIso,
        apikey: API_KEY
      });

      const response = await fetch(timelineUrl);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Tomorrow.io API error:', response.status, errorData);
        throw new Error(`Tomorrow.io API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Tomorrow.io API response:', data);

      if (!data.data || !data.data.timelines) {
        throw new Error('Invalid response format from Tomorrow.io');
      }

      // Process the response data
      const timelines = data.data.timelines;
      const minutelyTimeline = timelines.find((t: any) => t.timestep === '1m');
      const hourlyTimeline = timelines.find((t: any) => t.timestep === '1h');
      const dailyTimeline = timelines.find((t: any) => t.timestep === '1d');

      // Get current weather (first minutely data point or first hourly if minutely not available)
      const currentData = minutelyTimeline?.intervals?.[0] || hourlyTimeline?.intervals?.[0];
      
      if (!currentData) {
        throw new Error('No current weather data available');
      }

      const currentWeatherCode = currentData.values?.weatherCode || 1000;
      const currentCondition = getWeatherCondition(currentWeatherCode);

      const current: TomorrowWeatherData = {
        temperature: Math.round(currentData.values?.temperature || 20),
        humidity: Math.round(currentData.values?.humidity || 50),
        precipitation: currentData.values?.precipitationIntensity || 0,
        precipitationType: getPrecipitationType(currentWeatherCode),
        precipitationIntensity: currentData.values?.precipitationIntensity || 0,
        condition: currentCondition.condition,
        description: currentCondition.description,
        windSpeed: Math.round((currentData.values?.windSpeed || 0) * 3.6), // Convert m/s to km/h
        pressure: Math.round(currentData.values?.pressureSeaLevel || 1013),
        visibility: Math.round((currentData.values?.visibility || 10000) / 1000), // Convert m to km
        cloudCover: Math.round(currentData.values?.cloudCover || 0),
        uvIndex: Math.round(currentData.values?.uvIndex || 0),
        dewPoint: Math.round(currentData.values?.dewPoint || 0),
        weatherCode: currentWeatherCode
      };

      // Process minutely data (first 120 minutes for detailed short-term forecast)
      const minutely: TomorrowForecastData[] = (minutelyTimeline?.intervals || [])
        .slice(0, 120)
        .map((item: any) => {
          const weatherCode = item.values?.weatherCode || 1000;
          const condition = getWeatherCondition(weatherCode);
          
          return {
            time: item.startTime,
            timestampUTC: new Date(item.startTime).getTime(),
            temperature: Math.round(item.values?.temperature || 20),
            condition: condition.condition,
            description: condition.description,
            precipitation: item.values?.precipitationIntensity || 0,
            precipitationType: getPrecipitationType(weatherCode),
            precipitationIntensity: item.values?.precipitationIntensity || 0,
            windSpeed: Math.round((item.values?.windSpeed || 0) * 3.6),
            cloudCover: Math.round(item.values?.cloudCover || 0),
            weatherCode: weatherCode
          };
        });

      // Process hourly data (next 120 hours for detailed forecast)
      const hourly: TomorrowForecastData[] = (hourlyTimeline?.intervals || [])
        .slice(0, 120)
        .map((item: any) => {
          const weatherCode = item.values?.weatherCode || 1000;
          const condition = getWeatherCondition(weatherCode);
          
          return {
            time: item.startTime,
            timestampUTC: new Date(item.startTime).getTime(),
            temperature: Math.round(item.values?.temperature || 20),
            condition: condition.condition,
            description: condition.description,
            precipitation: item.values?.precipitationIntensity || 0,
            precipitationType: getPrecipitationType(weatherCode),
            precipitationIntensity: item.values?.precipitationIntensity || 0,
            windSpeed: Math.round((item.values?.windSpeed || 0) * 3.6),
            cloudCover: Math.round(item.values?.cloudCover || 0),
            weatherCode: weatherCode
          };
        });

      // Process daily data
      const daily: TomorrowForecastData[] = (dailyTimeline?.intervals || [])
        .slice(0, 5)
        .map((item: any) => {
          const weatherCode = item.values?.weatherCode || 1000;
          const condition = getWeatherCondition(weatherCode);
          
          return {
            time: item.startTime,
            timestampUTC: new Date(item.startTime).getTime(),
            temperature: Math.round(item.values?.temperature || 20),
            condition: condition.condition,
            description: condition.description,
            precipitation: item.values?.precipitationIntensity || 0,
            precipitationType: getPrecipitationType(weatherCode),
            precipitationIntensity: item.values?.precipitationIntensity || 0,
            windSpeed: Math.round((item.values?.windSpeed || 0) * 3.6),
            cloudCover: Math.round(item.values?.cloudCover || 0),
            weatherCode: weatherCode
          };
        });

      const result: TomorrowWeatherResponse = {
        current,
        minutely,
        hourly,
        daily
      };

      // Cache the result
      weatherCache.set(lat, lon, result);

      setLoading(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather data from Tomorrow.io';
      console.error('Tomorrow.io weather fetch error:', err);
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  }, []);

  const getWeatherForRoute = useCallback(async (
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number // in seconds
  ): Promise<{ [coordinate: string]: TomorrowWeatherResponse }> => {
    const forecasts: { [coordinate: string]: TomorrowWeatherResponse } = {};
    
    // Sample key points along the route (max 10 to balance detail vs API limits)
    const maxSamplePoints = Math.min(routeCoordinates.length, 10);
    const step = Math.max(1, Math.floor(routeCoordinates.length / maxSamplePoints));
    
    const promises = [];
    
    for (let i = 0; i < routeCoordinates.length; i += step) {
      const [lon, lat] = routeCoordinates[i];
      const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
      
      // Calculate arrival time at this point
      const progressRatio = i / (routeCoordinates.length - 1);
      const arrivalTime = new Date(departureTime.getTime() + progressRatio * routeDuration * 1000);
      const endTime = new Date(arrivalTime.getTime() + 2 * 60 * 60 * 1000); // +2 hours for safety
      
      promises.push(
        getWeatherData(lat, lon, arrivalTime, endTime).then(data => {
          if (data) {
            forecasts[coordKey] = data;
          }
        }).catch(err => {
          console.error(`Failed to get weather for ${coordKey}:`, err);
        })
      );
    }
    
    await Promise.all(promises);
    console.log(`Got weather data for ${Object.keys(forecasts).length} route points`);
    return forecasts;
  }, [getWeatherData]);

  const clearCache = useCallback(() => {
    weatherCache.clear();
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      size: weatherCache.size(),
      maxAge: 10 // minutes
    };
  }, []);

  return {
    getWeatherData,
    getWeatherForRoute,
    clearCache,
    getCacheStats,
    loading,
    error
  };
};