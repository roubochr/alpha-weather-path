import { useState, useCallback } from 'react';
import { TimeBasedWeatherData } from './useTimeBasedWeather';
import { useAccuWeather, MinuteCastData } from './useAccuWeather';

export interface TravelWindow {
  departureTime: Date;
  arrivalTime: Date;
  totalRainEncounter: number;
  averageRainIntensity: number;
  maxRainIntensity: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TravelRecommendation {
  shouldWait: boolean;
  reason: string;
  bestDepartureTime: Date;
  alternativeWindows: TravelWindow[];
  currentConditions: {
    riskLevel: 'low' | 'medium' | 'high';
    message: string;
  };
  improvementForecast: {
    willImprove: boolean;
    timeToImprovement?: Date;
    message: string;
  };
}

export const useTravelRecommendations = () => {
  const [loading, setLoading] = useState(false);
  const { getMinuteCastForRoute } = useAccuWeather();

  const analyzeRainRisk = useCallback((precipitation: number): 'low' | 'medium' | 'high' => {
    if (precipitation <= 0.5) return 'low';
    if (precipitation <= 2.0) return 'medium';
    return 'high';
  }, []);

  const calculateTravelWindow = useCallback((
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [timeKey: number]: any } }
  ): TravelWindow => {
    let totalRain = 0;
    let maxRain = 0;
    let rainSamples = 0;

    const arrivalTime = new Date(departureTime.getTime() + routeDuration * 1000);
    
    // Check if trip extends beyond forecast range
    const maxForecastTime = new Date(Date.now() + 120 * 60 * 60 * 1000);
    const tripBeyondForecast = arrivalTime > maxForecastTime;

    // Sample weather at key points along the route
    const samplePoints = Math.min(routeCoordinates.length, 20);
    const step = Math.max(1, Math.floor(routeCoordinates.length / samplePoints));

    for (let i = 0; i < routeCoordinates.length; i += step) {
      const [lon, lat] = routeCoordinates[i];
      const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
      
      if (hourlyForecasts[coordKey]) {
        // Calculate time of arrival at this point
        const progressRatio = i / (routeCoordinates.length - 1);
        const timeToPoint = routeDuration * progressRatio * 1000;
        const pointArrivalTime = new Date(departureTime.getTime() + timeToPoint);
        
        // Skip points beyond forecast range
        if (pointArrivalTime > maxForecastTime) {
          continue;
        }
        
        const timeKey = Math.floor(pointArrivalTime.getTime() / (3600 * 1000));
        let weather = hourlyForecasts[coordKey][timeKey];
        
        // Try to find closest forecast if exact time not available
        if (!weather) {
          for (let offset = 1; offset <= 3; offset++) {
            if (hourlyForecasts[coordKey][timeKey - offset]) {
              weather = hourlyForecasts[coordKey][timeKey - offset];
              break;
            }
            if (hourlyForecasts[coordKey][timeKey + offset]) {
              weather = hourlyForecasts[coordKey][timeKey + offset];
              break;
            }
          }
        }
        
        if (weather && weather.precipitation !== undefined) {
          totalRain += weather.precipitation;
          maxRain = Math.max(maxRain, weather.precipitation);
          rainSamples++;
        }
      }
    }

    const averageRain = rainSamples > 0 ? totalRain / rainSamples : 0;
    let riskLevel = analyzeRainRisk(maxRain);
    
    // Increase risk level for trips extending beyond forecast range
    if (tripBeyondForecast && rainSamples < samplePoints * 0.3) {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
    }

    return {
      departureTime,
      arrivalTime,
      totalRainEncounter: totalRain,
      averageRainIntensity: averageRain,
      maxRainIntensity: maxRain,
      riskLevel
    };
  }, [analyzeRainRisk]);

  const findOptimalDepartureWindow = useCallback((
    routeCoordinates: [number, number][],
    baseTime: Date,
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [hour: number]: any } }
  ): TravelWindow[] => {
    const windows: TravelWindow[] = [];
    
    // Generate windows 1 hour before and after the selected time in 15-minute intervals
    for (let minutes = -60; minutes <= 60; minutes += 15) {
      const departureTime = new Date(baseTime.getTime() + minutes * 60 * 1000);
      const window = calculateTravelWindow(routeCoordinates, departureTime, routeDuration, hourlyForecasts);
      windows.push(window);
    }

    // Sort by risk level and total rain encounter
    return windows.sort((a, b) => {
      const riskOrder = { 'low': 0, 'medium': 1, 'high': 2 } as const;
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return a.totalRainEncounter - b.totalRainEncounter;
    });
  }, [calculateTravelWindow]);

  const analyzeWeatherImprovement = useCallback((
    hourlyForecasts: { [coordinate: string]: { [hour: number]: any } },
    currentHour: number
  ): { willImprove: boolean; timeToImprovement?: Date; message: string } => {
    let currentRainLevel = 0;
    let futureRainLevels: number[] = [];
    
    // Average rain across all forecast points for current and future hours
    Object.values(hourlyForecasts).forEach(forecast => {
      if (forecast[currentHour]) {
        currentRainLevel += forecast[currentHour].precipitation || 0;
      }
      
      // Check next 6 hours
      for (let h = 1; h <= 6; h++) {
        const futureHour = (currentHour + h) % 24;
        if (forecast[futureHour]) {
          if (!futureRainLevels[h - 1]) futureRainLevels[h - 1] = 0;
          futureRainLevels[h - 1] += forecast[futureHour].precipitation || 0;
        }
      }
    });

    const forecastCount = Object.keys(hourlyForecasts).length;
    currentRainLevel /= forecastCount;
    futureRainLevels = futureRainLevels.map(level => level / forecastCount);

    // Find if conditions improve significantly
    const improvementThreshold = Math.max(0.5, currentRainLevel * 0.5);
    let timeToImprovement: Date | undefined;
    
    for (let h = 0; h < futureRainLevels.length; h++) {
      if (futureRainLevels[h] < improvementThreshold) {
        timeToImprovement = new Date(Date.now() + (h + 1) * 60 * 60 * 1000);
        break;
      }
    }

    if (timeToImprovement) {
      return {
        willImprove: true,
        timeToImprovement,
        message: `Conditions should improve around ${timeToImprovement.toLocaleTimeString()}`
      };
    }

    if (currentRainLevel > 1.0) {
      return {
        willImprove: false,
        message: "Heavy rain conditions may persist for several hours"
      };
    }

    return {
      willImprove: false,
      message: "Weather conditions appear stable for the next few hours"
    };
  }, []);

  const generateRecommendation = useCallback(async (
    routeCoordinates: [number, number][],
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [timeKey: number]: any } },
    baseDepartureTime: Date
  ): Promise<TravelRecommendation> => {
    setLoading(true);

    try {
      const baseTime = baseDepartureTime;
      const isShortTrip = routeDuration <= 7200; // 2 hours or less
      
      let windows: TravelWindow[] = [];
      
      if (isShortTrip) {
        // Use AccuWeather MinuteCast for short trips (minute-level)
        console.log('Using AccuWeather MinuteCast for short trip');
        windows = await generateAccuWeatherWindows(routeCoordinates, baseTime, routeDuration);
      } else {
        // Use OpenWeatherMap for longer trips (hourly)
        console.log('Using OpenWeatherMap for trip');
        windows = findOptimalDepartureWindow(routeCoordinates, baseTime, routeDuration, hourlyForecasts);
      }

      // Identify best, current-at-selected, and trend
      const bestWindow = windows[0];
      const currentAtSelected = isShortTrip 
        ? await calculateAccuWeatherWindow(routeCoordinates, baseTime, routeDuration)
        : calculateTravelWindow(routeCoordinates, baseTime, routeDuration, hourlyForecasts);

      // Analyze weather improvement around the selected time
      const currentHour = baseTime.getHours();
      const improvement = analyzeWeatherImprovement(hourlyForecasts, currentHour);

      // Determine if leaving ASAP is advisable vs waiting or leaving earlier than selected
      const beforeWindows = windows.filter(w => w.departureTime <= baseTime);
      const afterWindows = windows.filter(w => w.departureTime > baseTime);

      const minBeforeRisk = beforeWindows.length ? Math.min(...beforeWindows.map(w => ({low:0,medium:1,high:2} as const)[w.riskLevel])) : Infinity;
      const minAfterRisk = afterWindows.length ? Math.min(...afterWindows.map(w => ({low:0,medium:1,high:2} as const)[w.riskLevel])) : Infinity;

      let shouldWait = false;
      let reason = '';

      if (minAfterRisk > ({low:0,medium:1,high:2} as const)[currentAtSelected.riskLevel]) {
        // Conditions worsen after selected time
        reason = 'Weather is expected to worsen after the selected time — consider leaving as soon as possible.';
        shouldWait = false;
      } else if (minBeforeRisk < ({low:0,medium:1,high:2} as const)[currentAtSelected.riskLevel]) {
        // Better window exists before the selected time
        reason = 'An earlier departure could help you avoid worse weather conditions.';
        shouldWait = false;
      } else {
        // Decide based on best window vs current-at-selected
        shouldWait = currentAtSelected.riskLevel === 'high' && bestWindow.riskLevel !== 'high' && bestWindow.departureTime > baseTime;
        if (shouldWait) {
          const mins = Math.round((bestWindow.departureTime.getTime() - baseTime.getTime()) / 60000);
          reason = `Current conditions pose high risk. Better to depart in about ${mins} minutes.`;
        } else if (currentAtSelected.riskLevel === 'low') {
          reason = 'Conditions at your selected time look favorable.';
        } else {
          reason = 'Conditions are acceptable, but monitor weather closely.';
        }
      }

      const recommendation: TravelRecommendation = {
        shouldWait,
        reason,
        bestDepartureTime: bestWindow.departureTime,
        alternativeWindows: windows,
        currentConditions: {
          riskLevel: currentAtSelected.riskLevel,
          message: currentAtSelected.riskLevel === 'high' 
            ? `High rain risk: ${currentAtSelected.maxRainIntensity.toFixed(1)}mm/h expected`
            : currentAtSelected.riskLevel === 'medium'
            ? `Moderate rain risk: ${currentAtSelected.maxRainIntensity.toFixed(1)}mm/h expected`
            : `Low rain risk: ${currentAtSelected.maxRainIntensity.toFixed(1)}mm/h expected`
        },
        improvementForecast: improvement
      };

      setLoading(false);
      return recommendation;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [findOptimalDepartureWindow, calculateTravelWindow, analyzeWeatherImprovement, getMinuteCastForRoute]);

  const generateAccuWeatherWindows = useCallback(async (
    routeCoordinates: [number, number][],
    baseTime: Date,
    routeDuration: number
  ): Promise<TravelWindow[]> => {
    const windows: TravelWindow[] = [];
    
    try {
      // Get MinuteCast data for the route centered around the selected time
      const minutecastForecasts = await getMinuteCastForRoute(routeCoordinates, baseTime, routeDuration);
      
      // Generate windows 1 hour before and after in 15-minute intervals
      for (let minutes = -60; minutes <= 60; minutes += 15) {
        const departureTime = new Date(baseTime.getTime() + minutes * 60 * 1000);
        const window = await calculateAccuWeatherWindow(routeCoordinates, departureTime, routeDuration, minutecastForecasts);
        windows.push(window);
      }
    } catch (error) {
      console.error('Failed to generate AccuWeather windows:', error);
      // Fallback to empty windows
    }

    // Sort by risk level and total rain encounter
    return windows.sort((a, b) => {
      const riskOrder = { 'low': 0, 'medium': 1, 'high': 2 } as const;
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return a.totalRainEncounter - b.totalRainEncounter;
    });
  }, [getMinuteCastForRoute]);

  const calculateAccuWeatherWindow = useCallback(async (
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number,
    minutecastForecasts?: { [coordinate: string]: MinuteCastData[] }
  ): Promise<TravelWindow> => {
    let totalRain = 0;
    let maxRain = 0;
    let rainSamples = 0;

    const arrivalTime = new Date(departureTime.getTime() + routeDuration * 1000);
    
    try {
      const forecasts = minutecastForecasts || await getMinuteCastForRoute(routeCoordinates, departureTime, routeDuration);
      
      // Sample key points along the route
      const samplePoints = Math.min(routeCoordinates.length, 10);
      const step = Math.max(1, Math.floor(routeCoordinates.length / samplePoints));

      for (let i = 0; i < routeCoordinates.length; i += step) {
        const [lon, lat] = routeCoordinates[i];
        const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
        
        if (forecasts[coordKey]) {
          // Calculate time of arrival at this point
          const progressRatio = i / (routeCoordinates.length - 1);
          const timeToPoint = routeDuration * progressRatio * 1000;
          const pointArrivalTime = new Date(departureTime.getTime() + timeToPoint);
          
          // Find closest minute forecast
          const minuteForecasts = forecasts[coordKey];
          const closest = minuteForecasts.find(forecast => 
            Math.abs(forecast.time.getTime() - pointArrivalTime.getTime()) <= 60000 // Within 1 minute
          ) || minuteForecasts.reduce((prev, curr) => 
            Math.abs(curr.time.getTime() - pointArrivalTime.getTime()) < 
            Math.abs(prev.time.getTime() - pointArrivalTime.getTime()) ? curr : prev
          );
          
          if (closest) {
            totalRain += closest.precipitation;
            maxRain = Math.max(maxRain, closest.precipitation);
            rainSamples++;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating AccuWeather window:', error);
    }

    const averageRain = rainSamples > 0 ? totalRain / rainSamples : 0;
    const riskLevel = analyzeRainRisk(maxRain);

    return {
      departureTime,
      arrivalTime,
      totalRainEncounter: totalRain,
      averageRainIntensity: averageRain,
      maxRainIntensity: maxRain,
      riskLevel
    };
  }, [getMinuteCastForRoute, analyzeRainRisk]);

  return {
    generateRecommendation,
    loading
  };
};