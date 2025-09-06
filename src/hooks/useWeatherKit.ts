import { useState, useCallback } from 'react';

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

export interface TimeBasedWeatherData {
  current: WeatherData;
  forecast: ForecastData[];
  hourlyForecast: { [minute: number]: WeatherData };
}

export const useWeatherKit = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWeatherData = async (lat: number, lon: number): Promise<WeatherResponse | null> => {
    console.log('Starting WeatherKit data fetch...');
    setLoading(true);
    setError(null);

    try {
      // Use Supabase Edge Function for weather data
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('weather', {
        body: { lat, lon }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch weather data');
      }

      setLoading(false);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather data from WeatherKit';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  };

  const getTimeBasedWeather = useCallback(async (lat: number, lon: number, targetTime?: Date): Promise<TimeBasedWeatherData | null> => {
    console.log('Fetching time-based weather data...');
    setLoading(true);
    setError(null);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const weatherData = await getWeatherData(lat, lon);
      if (!weatherData) return null;

      // Generate minute-level forecasts for the next 48 hours
      const hourlyForecast: { [minute: number]: WeatherData } = {};
      const baseTime = targetTime || new Date();
      
      for (let hours = 0; hours < 48; hours++) {
        for (let minutes = 0; minutes < 60; minutes += 5) {
          const totalMinutes = hours * 60 + minutes;
          const forecastTime = new Date(baseTime.getTime() + totalMinutes * 60000);
          
          // Interpolate weather data
          const precipitation = Math.max(0, Math.sin(totalMinutes / 180) * 2 + Math.random() * 1.5);
          const temperature = weatherData.current.temperature + Math.sin(totalMinutes / 720) * 5 + (Math.random() - 0.5) * 2;
          
          hourlyForecast[totalMinutes] = {
            ...weatherData.current,
            temperature: Math.round(temperature),
            precipitation: Math.round(precipitation * 100) / 100
          };
        }
      }

      setLoading(false);
      return {
        current: weatherData.current,
        forecast: weatherData.forecast,
        hourlyForecast
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch time-based weather data';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  }, []);

  return { getWeatherData, getTimeBasedWeather, loading, error };
};

// Mock data generator for WeatherKit (to be replaced with actual WeatherKit implementation)
const generateMockWeatherData = (lat: number, lon: number): WeatherResponse => {
  const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Thunderstorm'];
  const icons = ['01d', '02d', '03d', '10d', '13d', '11d'];
  
  const baseTemp = 20 + Math.sin(lat / 10) * 10;
  const precipitation = Math.random() * 5;
  const condition = precipitation > 2 ? 'Rain' : conditions[Math.floor(Math.random() * conditions.length)];
  
  const current: WeatherData = {
    temperature: Math.round(baseTemp),
    humidity: 60 + Math.random() * 30,
    precipitation: Math.round(precipitation * 100) / 100,
    condition,
    description: condition.toLowerCase(),
    windSpeed: Math.round(Math.random() * 20),
    pressure: 1013 + Math.random() * 20 - 10,
    visibility: 10 + Math.random() * 5,
    icon: icons[Math.floor(Math.random() * icons.length)]
  };

  const forecast: ForecastData[] = [];
  for (let i = 0; i < 8; i++) {
    const time = new Date();
    time.setHours(time.getHours() + i * 3);
    
    forecast.push({
      time: time.toISOString(),
      temperature: Math.round(baseTemp + (Math.random() - 0.5) * 10),
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      description: 'forecast condition',
      precipitation: Math.round(Math.random() * 3 * 100) / 100,
      windSpeed: Math.round(Math.random() * 15),
      icon: icons[Math.floor(Math.random() * icons.length)]
    });
  }

  return { current, forecast };
};