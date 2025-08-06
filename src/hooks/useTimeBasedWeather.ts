import { useState, useCallback } from 'react';
import { WeatherData, ForecastData } from './useWeatherAPI';

export interface TimeBasedWeatherData {
  current: WeatherData;
  forecast: ForecastData[];
  hourlyForecast: { [hour: number]: WeatherData };
}

export const useTimeBasedWeather = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTimeBasedWeather = useCallback(async (
    lat: number, 
    lon: number,
    targetTime?: Date
  ): Promise<TimeBasedWeatherData | null> => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('openweather-api-key');
      if (!apiKey) {
        throw new Error('OpenWeather API key not found');
      }

      // Round coordinates for consistency
      const roundedLat = Math.round(lat * 10000) / 10000;
      const roundedLon = Math.round(lon * 10000) / 10000;

      // Get current weather
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${roundedLat}&lon=${roundedLon}&appid=${apiKey}&units=metric`
      );
      
      if (!weatherResponse.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const weatherData = await weatherResponse.json();
      
      // Get 5-day/3-hour forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${roundedLat}&lon=${roundedLon}&appid=${apiKey}&units=metric`
      );
      
      const forecastData = await forecastResponse.json();
      
      // Create hourly forecast map for next 48 hours
      const hourlyForecast: { [hour: number]: WeatherData } = {};
      const now = new Date();
      
      // Process forecast data to create hourly predictions
      forecastData.list.forEach((item: any, index: number) => {
        const forecastTime = new Date(item.dt * 1000);
        const hourKey = forecastTime.getHours();
        
        // Only include next 48 hours
        if (forecastTime.getTime() <= now.getTime() + 48 * 60 * 60 * 1000) {
          hourlyForecast[hourKey] = {
            temperature: Math.round(item.main.temp),
            humidity: item.main.humidity,
            precipitation: item.rain?.['3h'] || 0,
            condition: item.weather[0].main,
            description: item.weather[0].description,
            windSpeed: Math.round(item.wind.speed * 3.6),
            pressure: item.main.pressure,
            visibility: 10, // Default visibility for forecast
            icon: item.weather[0].icon
          };
        }
      });

      const result: TimeBasedWeatherData = {
        current: {
          temperature: Math.round(weatherData.main.temp),
          humidity: weatherData.main.humidity,
          precipitation: weatherData.rain?.['1h'] || 0,
          condition: weatherData.weather[0].main,
          description: weatherData.weather[0].description,
          windSpeed: Math.round(weatherData.wind.speed * 3.6),
          pressure: weatherData.main.pressure,
          visibility: weatherData.visibility / 1000,
          icon: weatherData.weather[0].icon
        },
        forecast: forecastData.list.slice(0, 16).map((item: any) => ({
          time: item.dt_txt,
          temperature: Math.round(item.main.temp),
          condition: item.weather[0].main,
          description: item.weather[0].description,
          precipitation: item.rain?.['3h'] || 0,
          windSpeed: Math.round(item.wind.speed * 3.6),
          icon: item.weather[0].icon
        })),
        hourlyForecast
      };

      setLoading(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather data';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  }, []);

  const getWeatherAtTime = useCallback((
    hourlyForecast: { [hour: number]: WeatherData },
    hour: number
  ): WeatherData | null => {
    return hourlyForecast[hour] || null;
  }, []);

  const calculateArrivalWeather = useCallback((
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number, // in seconds
    hourlyForecasts: { [coordinate: string]: { [hour: number]: WeatherData } }
  ): { coordinate: [number, number]; weather: WeatherData; arrivalTime: Date }[] => {
    const results: { coordinate: [number, number]; weather: WeatherData; arrivalTime: Date }[] = [];
    
    routeCoordinates.forEach((coord, index) => {
      // Calculate arrival time at this point (assuming uniform travel speed)
      const progressRatio = index / (routeCoordinates.length - 1);
      const timeToPoint = routeDuration * progressRatio * 1000; // Convert to milliseconds
      const arrivalTime = new Date(departureTime.getTime() + timeToPoint);
      
      // Round coordinates to match API precision
      const roundedLat = Math.round(coord[1] * 1000) / 1000;
      const roundedLon = Math.round(coord[0] * 1000) / 1000;
      const coordKey = `${roundedLon},${roundedLat}`;
      
      const hourlyForecast = hourlyForecasts[coordKey];
      
      if (hourlyForecast) {
        const arrivalHour = arrivalTime.getHours();
        const weather = getWeatherAtTime(hourlyForecast, arrivalHour);
        
        if (weather) {
          results.push({
            coordinate: [roundedLon, roundedLat],
            weather,
            arrivalTime
          });
        }
      } else {
        // If no forecast data, try to interpolate from nearby points
        const nearbyForecasts = Object.entries(hourlyForecasts);
        if (nearbyForecasts.length > 0) {
          // Find closest coordinate
          let closestForecast = null;
          let minDistance = Infinity;
          
          nearbyForecasts.forEach(([key, forecast]) => {
            const [lon, lat] = key.split(',').map(Number);
            const distance = Math.sqrt(
              Math.pow(lon - roundedLon, 2) + Math.pow(lat - roundedLat, 2)
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              closestForecast = forecast;
            }
          });
          
          if (closestForecast) {
            const arrivalHour = arrivalTime.getHours();
            const weather = getWeatherAtTime(closestForecast, arrivalHour);
            
            if (weather) {
              results.push({
                coordinate: [roundedLon, roundedLat],
                weather,
                arrivalTime
              });
            }
          }
        }
      }
    });
    
    return results;
  }, [getWeatherAtTime]);

  return {
    getTimeBasedWeather,
    getWeatherAtTime,
    calculateArrivalWeather,
    loading,
    error
  };
};