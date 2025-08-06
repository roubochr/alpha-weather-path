import { useState } from 'react';
import { WeatherData, ForecastData, WeatherResponse } from './useWeatherAPI';

// Mock weather conditions based on location
const weatherConditions = [
  { condition: 'Clear', description: 'clear sky', icon: '01d' },
  { condition: 'Clouds', description: 'few clouds', icon: '02d' },
  { condition: 'Clouds', description: 'scattered clouds', icon: '03d' },
  { condition: 'Clouds', description: 'broken clouds', icon: '04d' },
  { condition: 'Rain', description: 'light rain', icon: '10d' },
  { condition: 'Rain', description: 'moderate rain', icon: '10d' },
  { condition: 'Drizzle', description: 'light drizzle', icon: '09d' }
];

export const useMockWeather = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMockWeather = (lat: number, lon: number): WeatherData => {
    // Use coordinates to create consistent but varied weather
    const seed = Math.abs(lat * 1000 + lon * 1000) % 1000;
    const conditionIndex = Math.floor(seed / 143) % weatherConditions.length;
    const selectedCondition = weatherConditions[conditionIndex];
    
    return {
      temperature: Math.round(15 + (seed % 25)), // 15-40°C
      humidity: Math.round(30 + (seed % 60)), // 30-90%
      precipitation: selectedCondition.condition === 'Rain' ? Math.round((seed % 10) + 1) : 0,
      condition: selectedCondition.condition,
      description: selectedCondition.description,
      windSpeed: Math.round(5 + (seed % 20)), // 5-25 km/h
      pressure: Math.round(1000 + (seed % 50)), // 1000-1050 hPa
      visibility: Math.round(5 + (seed % 15)), // 5-20 km
      icon: selectedCondition.icon
    };
  };

  const generateMockForecast = (lat: number, lon: number): ForecastData[] => {
    const forecast: ForecastData[] = [];
    const now = new Date();
    
    for (let i = 0; i < 8; i++) {
      const forecastTime = new Date(now.getTime() + i * 3 * 60 * 60 * 1000); // 3-hour intervals
      const seed = Math.abs(lat * 1000 + lon * 1000 + i * 100) % 1000;
      const conditionIndex = Math.floor(seed / 143) % weatherConditions.length;
      const selectedCondition = weatherConditions[conditionIndex];
      
      forecast.push({
        time: forecastTime.toISOString().replace('T', ' ').substring(0, 19),
        temperature: Math.round(12 + (seed % 28)), // 12-40°C
        condition: selectedCondition.condition,
        description: selectedCondition.description,
        precipitation: selectedCondition.condition === 'Rain' ? Math.round((seed % 15) + 1) : 0,
        windSpeed: Math.round(3 + (seed % 25)), // 3-28 km/h
        icon: selectedCondition.icon
      });
    }
    
    return forecast;
  };

  const getMockWeatherData = async (lat: number, lon: number): Promise<WeatherResponse | null> => {
    console.log('Using mock weather data for coordinates:', { lat, lon });
    setLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const current = generateMockWeather(lat, lon);
      const forecast = generateMockForecast(lat, lon);
      
      const result = { current, forecast };
      console.log('Mock weather data generated:', result);
      
      setLoading(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mock weather data';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  };

  return { getMockWeatherData, loading, error };
};