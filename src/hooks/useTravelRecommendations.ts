import { useState, useCallback } from 'react';
import { TimeBasedWeatherData } from './useTimeBasedWeather';

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

  const analyzeRainRisk = useCallback((precipitation: number): 'low' | 'medium' | 'high' => {
    if (precipitation <= 0.5) return 'low';
    if (precipitation <= 2.0) return 'medium';
    return 'high';
  }, []);

  const calculateTravelWindow = useCallback((
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [hour: number]: any } }
  ): TravelWindow => {
    let totalRain = 0;
    let maxRain = 0;
    let rainSamples = 0;

    const arrivalTime = new Date(departureTime.getTime() + routeDuration * 1000);

    // Sample weather at key points along the route
    const samplePoints = Math.min(routeCoordinates.length, 10);
    const step = Math.max(1, Math.floor(routeCoordinates.length / samplePoints));

    for (let i = 0; i < routeCoordinates.length; i += step) {
      const [lon, lat] = routeCoordinates[i];
      const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
      
      if (hourlyForecasts[coordKey]) {
        // Calculate time of arrival at this point
        const progressRatio = i / (routeCoordinates.length - 1);
        const timeToPoint = routeDuration * progressRatio * 1000;
        const pointArrivalTime = new Date(departureTime.getTime() + timeToPoint);
        
        const hour = pointArrivalTime.getHours();
        const weather = hourlyForecasts[coordKey][hour];
        
        if (weather && weather.precipitation !== undefined) {
          totalRain += weather.precipitation;
          maxRain = Math.max(maxRain, weather.precipitation);
          rainSamples++;
        }
      }
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
  }, [analyzeRainRisk]);

  const findOptimalDepartureWindow = useCallback((
    routeCoordinates: [number, number][],
    currentTime: Date,
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [hour: number]: any } }
  ): TravelWindow[] => {
    const windows: TravelWindow[] = [];
    
    // Check departure times in 15-minute intervals over the next hour
    for (let minutes = 0; minutes <= 60; minutes += 15) {
      const departureTime = new Date(currentTime.getTime() + minutes * 60 * 1000);
      const window = calculateTravelWindow(routeCoordinates, departureTime, routeDuration, hourlyForecasts);
      windows.push(window);
    }

    // Sort by risk level and total rain encounter
    return windows.sort((a, b) => {
      const riskOrder = { 'low': 0, 'medium': 1, 'high': 2 };
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
    hourlyForecasts: { [coordinate: string]: { [hour: number]: any } }
  ): Promise<TravelRecommendation> => {
    setLoading(true);

    try {
      const currentTime = new Date();
      const currentHour = currentTime.getHours();

      // Find optimal departure windows
      const windows = findOptimalDepartureWindow(routeCoordinates, currentTime, routeDuration, hourlyForecasts);
      const bestWindow = windows[0];
      const currentWindow = calculateTravelWindow(routeCoordinates, currentTime, routeDuration, hourlyForecasts);

      // Analyze weather improvement
      const improvement = analyzeWeatherImprovement(hourlyForecasts, currentHour);

      // Determine if should wait
      const shouldWait = currentWindow.riskLevel === 'high' && bestWindow.riskLevel !== 'high';
      
      let reason = '';
      if (shouldWait) {
        reason = `Current conditions pose high risk. Better to depart ${bestWindow.departureTime > currentTime ? 'in ' + Math.round((bestWindow.departureTime.getTime() - currentTime.getTime()) / 60000) + ' minutes' : 'now'}`;
      } else if (currentWindow.riskLevel === 'low') {
        reason = 'Current conditions are favorable for travel';
      } else {
        reason = 'Conditions are acceptable, but monitor weather closely';
      }

      const recommendation: TravelRecommendation = {
        shouldWait,
        reason,
        bestDepartureTime: bestWindow.departureTime,
        alternativeWindows: windows.slice(0, 4),
        currentConditions: {
          riskLevel: currentWindow.riskLevel,
          message: currentWindow.riskLevel === 'high' 
            ? `High rain risk: ${currentWindow.maxRainIntensity.toFixed(1)}mm/h expected`
            : currentWindow.riskLevel === 'medium'
            ? `Moderate rain risk: ${currentWindow.maxRainIntensity.toFixed(1)}mm/h expected`
            : `Low rain risk: ${currentWindow.maxRainIntensity.toFixed(1)}mm/h expected`
        },
        improvementForecast: improvement
      };

      setLoading(false);
      return recommendation;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [findOptimalDepartureWindow, calculateTravelWindow, analyzeWeatherImprovement]);

  return {
    generateRecommendation,
    loading
  };
};