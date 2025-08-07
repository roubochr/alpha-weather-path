import { useState, useCallback } from 'react';

export interface MinuteCastData {
  time: Date;
  precipitation: number;
  precipitationType: string;
  intensity: 'light' | 'moderate' | 'heavy';
}

export interface AccuWeatherLocation {
  key: string;
  name: string;
}

export const useAccuWeather = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocationKey = useCallback(async (lat: number, lon: number): Promise<string | null> => {
    const apiKey = localStorage.getItem('accuweather-api-key');
    if (!apiKey) {
      throw new Error('AccuWeather API key not found');
    }

    try {
      const response = await fetch(
        `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=${lat},${lon}`
      );

      if (!response.ok) {
        throw new Error('Failed to get location key');
      }

      const data = await response.json();
      return data.Key;
    } catch (err) {
      console.error('Error getting AccuWeather location key:', err);
      return null;
    }
  }, []);

  const getMinuteCast = useCallback(async (lat: number, lon: number): Promise<MinuteCastData[]> => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('accuweather-api-key');
      if (!apiKey) {
        throw new Error('AccuWeather API key not found');
      }

      // First get the location key
      const locationKey = await getLocationKey(lat, lon);
      if (!locationKey) {
        throw new Error('Could not get location key');
      }

      // Get MinuteCast data
      const response = await fetch(
        `https://dataservice.accuweather.com/forecasts/v1/minute?apikey=${apiKey}&locationKey=${locationKey}&details=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch MinuteCast data');
      }

      const data = await response.json();
      
      const minutecastData: MinuteCastData[] = data.Intervals?.map((interval: any) => ({
        time: new Date(interval.DateTime),
        precipitation: interval.Precipitation || 0,
        precipitationType: interval.PrecipitationType || 'Rain',
        intensity: interval.Precipitation <= 0.5 ? 'light' : 
                  interval.Precipitation <= 2.0 ? 'moderate' : 'heavy'
      })) || [];

      setLoading(false);
      return minutecastData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch MinuteCast data';
      setError(errorMessage);
      setLoading(false);
      return [];
    }
  }, [getLocationKey]);

  const getMinuteCastForRoute = useCallback(async (
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number // in seconds
  ): Promise<{ [coordinate: string]: MinuteCastData[] }> => {
    const forecasts: { [coordinate: string]: MinuteCastData[] } = {};
    
    // Sample key points along the route (max 5 to avoid API limits)
    const samplePoints = Math.min(routeCoordinates.length, 5);
    const step = Math.max(1, Math.floor(routeCoordinates.length / samplePoints));
    
    const promises = [];
    
    for (let i = 0; i < routeCoordinates.length; i += step) {
      const [lon, lat] = routeCoordinates[i];
      const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
      
      promises.push(
        getMinuteCast(lat, lon).then(data => {
          forecasts[coordKey] = data;
        }).catch(err => {
          console.error(`Failed to get MinuteCast for ${coordKey}:`, err);
        })
      );
    }
    
    await Promise.all(promises);
    return forecasts;
  }, [getMinuteCast]);

  return {
    getMinuteCast,
    getMinuteCastForRoute,
    getLocationKey,
    loading,
    error
  };
};