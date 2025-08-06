import { useState } from 'react';

export interface WeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  condition: string;
  description: string;
  windSpeed: number;
  pressure: number;
  visibility: number;
  icon: string;
}

export interface ForecastData {
  time: string;
  temperature: number;
  condition: string;
  description: string;
  precipitation: number;
  windSpeed: number;
  icon: string;
}

export interface WeatherResponse {
  current: WeatherData;
  forecast: ForecastData[];
}

export const useWeatherAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWeatherData = async (lat: number, lon: number): Promise<WeatherResponse | null> => {
    console.log('Starting weather data fetch...');
    setLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('openweather-api-key');
      if (!apiKey) {
        throw new Error('OpenWeather API key not found');
      }

      console.log('Fetching weather data for coordinates:', { lat, lon });
      
      // Round coordinates to avoid cache misses and improve accuracy
      const roundedLat = Math.round(lat * 1000) / 1000;
      const roundedLon = Math.round(lon * 1000) / 1000;

      // Get current weather with rounded coordinates for consistency
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${roundedLat}&lon=${roundedLon}&appid=${apiKey}&units=metric`
      );
      
      if (!weatherResponse.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const weatherData = await weatherResponse.json();
      console.log('Weather API response:', weatherData);
      
      // Get forecast for route planning with same rounded coordinates
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${roundedLat}&lon=${roundedLon}&appid=${apiKey}&units=metric`
      );
      
      const forecastData = await forecastResponse.json();
      
      const result = {
        current: {
          temperature: Math.round(weatherData.main.temp),
          humidity: weatherData.main.humidity,
          precipitation: weatherData.rain?.['1h'] || 0,
          condition: weatherData.weather[0].main,
          description: weatherData.weather[0].description,
          windSpeed: Math.round(weatherData.wind.speed * 3.6), // Convert m/s to km/h
          pressure: weatherData.main.pressure,
          visibility: weatherData.visibility / 1000, // Convert to km
          icon: weatherData.weather[0].icon
        },
        forecast: forecastData.list.slice(0, 8).map((item: any) => ({
          time: item.dt_txt,
          temperature: Math.round(item.main.temp),
          condition: item.weather[0].main,
          description: item.weather[0].description,
          precipitation: item.rain?.['3h'] || 0,
          windSpeed: Math.round(item.wind.speed * 3.6),
          icon: item.weather[0].icon
        }))
      };

      setLoading(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather data';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  };

  return { getWeatherData, loading, error };
};