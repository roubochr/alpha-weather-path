import { useState, useCallback } from 'react';
import { WeatherData, ForecastData } from './useWeatherAPI';

export interface TimeBasedWeatherData {
  current: WeatherData;
  forecast: ForecastData[];
  hourlyForecast: { [minute: number]: WeatherData };
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
      
      // Create minute-level forecast map for next 48 hours (for 15-minute intervals)
      const hourlyForecast: { [minute: number]: WeatherData } = {};
      const now = new Date();
      
      console.log('Generating minute-level forecasts...');
      
      // Process forecast data to create timestamped predictions with interpolation
      for (let index = 0; index < forecastData.list.length; index++) {
        const item = forecastData.list[index];
        const nextItem = forecastData.list[index + 1];
        const forecastTime = new Date(item.dt * 1000);
        
        // Extract precipitation data - try different formats and convert to hourly rate
        let currentPrecipitation = 0;
        if (item.rain) {
          if (item.rain['3h']) {
            currentPrecipitation = item.rain['3h'] / 3; // Convert 3-hour total to hourly rate
          } else if (item.rain['1h']) {
            currentPrecipitation = item.rain['1h']; // Already hourly rate
          } else if (item.rain['1']) {
            currentPrecipitation = item.rain['1']; // Assume hourly rate
          }
        } else if (item.snow) {
          if (item.snow['3h']) {
            currentPrecipitation = (item.snow['3h'] / 3) * 0.1; // Convert 3-hour total to hourly rate
          } else if (item.snow['1h']) {
            currentPrecipitation = item.snow['1h'] * 0.1; // Already hourly rate
          } else if (item.snow['1']) {
            currentPrecipitation = item.snow['1'] * 0.1; // Assume hourly rate
          }
        }
        
        // Extract next precipitation for interpolation
        let nextPrecipitation = currentPrecipitation; // Default to current if no next item
        if (nextItem) {
          if (nextItem.rain) {
            if (nextItem.rain['3h']) {
              nextPrecipitation = nextItem.rain['3h'] / 3;
            } else if (nextItem.rain['1h']) {
              nextPrecipitation = nextItem.rain['1h'];
            } else if (nextItem.rain['1']) {
              nextPrecipitation = nextItem.rain['1'];
            }
          } else if (nextItem.snow) {
            if (nextItem.snow['3h']) {
              nextPrecipitation = (nextItem.snow['3h'] / 3) * 0.1;
            } else if (nextItem.snow['1h']) {
              nextPrecipitation = nextItem.snow['1h'] * 0.1;
            } else if (nextItem.snow['1']) {
              nextPrecipitation = nextItem.snow['1'] * 0.1;
            }
          }
        }
        
        console.log(`Processing forecast ${index}: ${forecastTime.toLocaleString()}, Current rain/h: ${currentPrecipitation.toFixed(2)}mm, Next rain/h: ${nextPrecipitation.toFixed(2)}mm`);
        
        // Create interpolated minute-level entries for the next 3 hours (or until next forecast)
        const hoursToNextForecast = nextItem ? 3 : 1; // 3 hours between forecasts, or 1 if last item
        const totalMinutes = hoursToNextForecast * 60;
        
        for (let minute = 0; minute < totalMinutes; minute += 15) {
          const minuteTime = new Date(forecastTime.getTime() + minute * 60 * 1000);
          const minuteKey = Math.floor(minuteTime.getTime() / (60 * 1000));
          
          // Include up to 5 days (120 hours) of forecast data
          if (minuteTime.getTime() <= now.getTime() + 120 * 60 * 60 * 1000) {
            // Interpolate precipitation between current and next forecast
            const progressRatio = minute / totalMinutes; // 0 to 1 over the forecast period
            let precipitation = currentPrecipitation + (nextPrecipitation - currentPrecipitation) * progressRatio;
            
            // Add some realistic variation within the 3-hour window (reduced multiplier)
            const variationFactor = 0.6 + Math.random() * 0.4; // 0.6 to 1.0 random multiplier
            precipitation *= variationFactor;
            
            // If still 0, check if there's precipitation in the weather condition
            if (precipitation === 0 && item.weather[0].main.toLowerCase().includes('rain')) {
              precipitation = 0.1 + Math.random() * 0.2; // 0.1-0.3mm light rain with variation
            }
            
            // Additional check for drizzle or light rain
            if (precipitation === 0 && (item.weather[0].description.toLowerCase().includes('drizzle') || 
                                      item.weather[0].description.toLowerCase().includes('light rain'))) {
              precipitation = 0.05 + Math.random() * 0.15; // 0.05-0.2mm drizzle with variation
            }
            
            // Check for moderate to heavy rain descriptions
            if (precipitation === 0 && (item.weather[0].description.toLowerCase().includes('moderate rain') ||
                                      item.weather[0].description.toLowerCase().includes('heavy rain'))) {
              precipitation = 0.8 + Math.random() * 0.7; // 0.8-1.5mm moderate rain with variation
            }
            
            // Round to reasonable precision
            precipitation = Math.round(precipitation * 100) / 100;
            
            console.log(`Creating forecast for ${minuteTime.toLocaleTimeString()}, Key: ${minuteKey}, Precipitation: ${precipitation}mm/h (interpolated)`);
            
            hourlyForecast[minuteKey] = {
              temperature: Math.round(item.main.temp),
              humidity: item.main.humidity,
              precipitation: precipitation,
              condition: item.weather[0].main,
              description: item.weather[0].description,
              windSpeed: Math.round(item.wind.speed * 3.6),
              pressure: item.main.pressure,
              visibility: 10, // Default visibility for forecast
              icon: item.weather[0].icon
            };
          }
        }
      }
      
      console.log(`Generated ${Object.keys(hourlyForecast).length} minute-level forecast entries`);

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
    hourlyForecast: { [timeKey: number]: WeatherData },
    targetTime: Date
  ): WeatherData | null => {
    const timeKey = Math.floor(targetTime.getTime() / (60 * 1000)); // Minute timestamp key
    
    // Try exact match first
    if (hourlyForecast[timeKey]) {
      return hourlyForecast[timeKey];
    }
    
    // Try to find closest forecast within 15 minutes
    for (let offset = 1; offset <= 15; offset++) {
      if (hourlyForecast[timeKey - offset]) {
        return hourlyForecast[timeKey - offset];
      }
      if (hourlyForecast[timeKey + offset]) {
        return hourlyForecast[timeKey + offset];
      }
    }
    
    return null;
  }, []);

  const calculateArrivalWeather = useCallback((
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number, // in seconds
    hourlyForecasts: { [coordinate: string]: { [timeKey: number]: WeatherData } }
  ): { coordinate: [number, number]; weather: WeatherData; arrivalTime: Date }[] => {
    const results: { coordinate: [number, number]; weather: WeatherData; arrivalTime: Date }[] = [];
    
    // Sample fewer points for very long routes to avoid overwhelming API
    const maxSamplePoints = 50;
    const sampleStep = Math.max(1, Math.floor(routeCoordinates.length / maxSamplePoints));
    
    for (let i = 0; i < routeCoordinates.length; i += sampleStep) {
      const coord = routeCoordinates[i];
      // Calculate arrival time at this point (assuming uniform travel speed)
      const progressRatio = i / (routeCoordinates.length - 1);
      const timeToPoint = routeDuration * progressRatio * 1000; // Convert to milliseconds
      const arrivalTime = new Date(departureTime.getTime() + timeToPoint);
      
      // Skip if arrival time is beyond forecast range (5 days)
      const maxForecastTime = new Date(Date.now() + 120 * 60 * 60 * 1000);
      if (arrivalTime > maxForecastTime) {
        console.log(`Skipping point ${i}: arrival time ${arrivalTime} beyond forecast range`);
        continue;
      }
      
      // Round coordinates to match API precision
      const roundedLat = Math.round(coord[1] * 1000) / 1000;
      const roundedLon = Math.round(coord[0] * 1000) / 1000;
      const coordKey = `${roundedLon},${roundedLat}`;
       
       const hourlyForecast = hourlyForecasts[coordKey];
       
       if (hourlyForecast) {
         const weather = getWeatherAtTime(hourlyForecast, arrivalTime);
         
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
           // Find closest coordinate within reasonable distance (0.1 degrees ~ 11km)
           let closestForecast = null;
           let minDistance = Infinity;
           const maxDistance = 0.1;
           
           nearbyForecasts.forEach(([key, forecast]) => {
             const [lon, lat] = key.split(',').map(Number);
             const distance = Math.sqrt(
               Math.pow(lon - roundedLon, 2) + Math.pow(lat - roundedLat, 2)
             );
             
             if (distance < minDistance && distance <= maxDistance) {
               minDistance = distance;
               closestForecast = forecast;
             }
           });
           
           if (closestForecast) {
             const weather = getWeatherAtTime(closestForecast, arrivalTime);
             
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
     }
     
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