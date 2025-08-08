import { useState, useCallback } from 'react';
import { TimeBasedWeatherData } from './useTimeBasedWeather';
import { useAccuWeather, MinuteCastData } from './useAccuWeather';

export interface TravelWindow {
  departureTime: Date;
  arrivalTime: Date;
  totalRainEncounter: number;
  averageRainIntensity: number;
  maxRainIntensity: number;
  maxWindSpeed: number;
  averageWindSpeed: number;
  riskLevel: 'low' | 'medium' | 'high';
  primaryRiskFactor: 'precipitation' | 'wind' | 'combined';
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

  const generateConditionsMessage = useCallback((window: TravelWindow): string => {
    const { riskLevel, primaryRiskFactor, maxRainIntensity, maxWindSpeed } = window;
    
    const riskText = riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Moderate' : 'Low';
    
    if (primaryRiskFactor === 'wind') {
      return `${riskText} wind risk: ${maxWindSpeed.toFixed(0)}km/h gusts expected`;
    } else if (primaryRiskFactor === 'combined') {
      return `${riskText} weather risk: ${maxRainIntensity.toFixed(1)}mm/h rain + ${maxWindSpeed.toFixed(0)}km/h winds`;
    } else {
      return `${riskText} rain risk: ${maxRainIntensity.toFixed(1)}mm/h expected`;
    }
  }, []);

  const analyzeWeatherRisk = useCallback((
    precipitation: number, 
    windSpeed: number
  ): { 
    riskLevel: 'low' | 'medium' | 'high', 
    primaryRiskFactor: 'precipitation' | 'wind' | 'combined' 
  } => {
    // Analyze precipitation risk
    let precipRisk: 'low' | 'medium' | 'high' = 'low';
    if (precipitation > 2.0) precipRisk = 'high';
    else if (precipitation > 0.5) precipRisk = 'medium';
    
    // Analyze wind risk (km/h)
    let windRisk: 'low' | 'medium' | 'high' = 'low';
    if (windSpeed > 50) windRisk = 'high';        // >50 km/h (31+ mph) - dangerous
    else if (windSpeed > 25) windRisk = 'medium'; // 25-50 km/h (15-31 mph) - caution
    
    // Determine overall risk and primary factor
    const precipScore = precipRisk === 'high' ? 3 : precipRisk === 'medium' ? 2 : 1;
    const windScore = windRisk === 'high' ? 3 : windRisk === 'medium' ? 2 : 1;
    
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    let primaryFactor: 'precipitation' | 'wind' | 'combined' = 'precipitation';
    
    // Combined risk assessment
    if (precipScore >= 3 || windScore >= 3) {
      overallRisk = 'high';
    } else if (precipScore >= 2 || windScore >= 2) {
      overallRisk = 'medium';
    }
    
    // Determine primary risk factor
    if (precipScore > windScore) {
      primaryFactor = 'precipitation';
    } else if (windScore > precipScore) {
      primaryFactor = 'wind';
    } else if (precipScore >= 2 && windScore >= 2) {
      primaryFactor = 'combined';
    }
    
    // Amplify risk when both factors are present
    if (precipRisk === 'medium' && windRisk === 'medium') {
      overallRisk = 'high';
      primaryFactor = 'combined';
    }
    
    return { riskLevel: overallRisk, primaryRiskFactor: primaryFactor };
  }, []);

  const calculateTravelWindow = useCallback((
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [timeKey: number]: any } }
  ): TravelWindow => {
    let totalRain = 0;
    let maxRain = 0;
    let totalWind = 0;
    let maxWind = 0;
    let weatherSamples = 0;

    const arrivalTime = new Date(departureTime.getTime() + routeDuration * 1000);
    
    // Check if trip extends beyond forecast range
    const maxForecastTime = new Date(Date.now() + 120 * 60 * 60 * 1000);
    const tripBeyondForecast = arrivalTime > maxForecastTime;

    // Sample weather at key points along the route
    const samplePoints = Math.min(routeCoordinates.length, 100); // Increased from 50 to 100 for better accuracy
    const step = Math.max(1, Math.floor(routeCoordinates.length / samplePoints));

    for (let i = 0; i < routeCoordinates.length; i += step) {
      const [lon, lat] = routeCoordinates[i];
      const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
      
      if (hourlyForecasts[coordKey]) {
        // Calculate time of arrival at this point
        const progressRatio = i / (routeCoordinates.length - 1);
        const timeToPoint = routeDuration * progressRatio * 1000;
        const pointArrivalTime = new Date(departureTime.getTime() + timeToPoint);
        
        console.log(`Point ${i}: Progress ratio: ${progressRatio.toFixed(3)}, Time to point: ${timeToPoint}ms, Arrival: ${pointArrivalTime.toLocaleTimeString()}`);
        
        // Skip points beyond forecast range
        if (pointArrivalTime > maxForecastTime) {
          continue;
        }
        
        // Use minute-level precision for time key to handle sub-hour intervals
        const timeKey = Math.floor(pointArrivalTime.getTime() / (60 * 1000)); // Minute timestamp key
        let weather = hourlyForecasts[coordKey][timeKey];
        
        console.log(`Point ${i}: Arrival at ${pointArrivalTime.toLocaleTimeString()}, TimeKey: ${timeKey}, Weather found: ${!!weather}, Available keys: ${Object.keys(hourlyForecasts[coordKey] || {}).slice(0, 5).join(', ')}`);
        
        // Try to find closest forecast if exact time not available
        if (!weather) {
          // Find the closest available time key
          const availableKeys = Object.keys(hourlyForecasts[coordKey] || {}).map(Number).sort((a, b) => a - b);
          if (availableKeys.length > 0) {
            // Find the closest key
            const closestKey = availableKeys.reduce((prev, curr) => 
              Math.abs(curr - timeKey) < Math.abs(prev - timeKey) ? curr : prev
            );
            weather = hourlyForecasts[coordKey][closestKey];
            console.log(`No exact match, using closest key: ${closestKey} (diff: ${Math.abs(closestKey - timeKey)})`);
          }
          
          // If still not found, try to find the closest hour-based forecast
          if (!weather) {
            const hourKey = Math.floor(pointArrivalTime.getTime() / (3600 * 1000)); // Hour timestamp key
            weather = hourlyForecasts[coordKey][hourKey];
            
            console.log(`No minute-level weather found, trying hour key: ${hourKey}, Weather found: ${!!weather}`);
            
            // If still not found, try nearby hours
            if (!weather) {
              for (let offset = 1; offset <= 3; offset++) {
                if (hourlyForecasts[coordKey][hourKey - offset]) {
                  weather = hourlyForecasts[coordKey][hourKey - offset];
                  console.log(`Found weather at hour offset -${offset}`);
                  break;
                }
                if (hourlyForecasts[coordKey][hourKey + offset]) {
                  weather = hourlyForecasts[coordKey][hourKey + offset];
                  console.log(`Found weather at hour offset +${offset}`);
                  break;
                }
              }
            }
          }
        }
        
        if (weather && weather.precipitation !== undefined) {
          console.log(`Point ${i}/${routeCoordinates.length} (${coordKey}): Rain=${weather.precipitation}mm, Wind=${weather.windSpeed || 0}km/h, Time=${pointArrivalTime.toLocaleTimeString()}`);
          totalRain += weather.precipitation;
          const previousMaxRain = maxRain;
          maxRain = Math.max(maxRain, weather.precipitation);
          
          if (weather.precipitation > previousMaxRain) {
            console.log(`NEW MAX RAIN: ${weather.precipitation}mm at point ${i} (${coordKey}) at ${pointArrivalTime.toLocaleTimeString()}`);
          }
          
          const windSpeed = weather.windSpeed || 0;
          totalWind += windSpeed;
          maxWind = Math.max(maxWind, windSpeed);
          
          weatherSamples++;
        } else {
          console.log(`No weather data found for point ${i} (${coordKey}) at time key ${timeKey}`);
        }
      }
    }

    const averageRain = weatherSamples > 0 ? totalRain / weatherSamples : 0;
    const averageWind = weatherSamples > 0 ? totalWind / weatherSamples : 0;
    
    // Log final summary
    console.log(`TRAVEL WINDOW SUMMARY: Departure: ${departureTime.toLocaleTimeString()}, Samples: ${weatherSamples}/${samplePoints}, Max Rain: ${maxRain}mm, Max Wind: ${maxWind}km/h, Avg Rain: ${averageRain.toFixed(2)}mm`);
    
    // Analyze combined weather risk
    const riskAnalysis = analyzeWeatherRisk(maxRain, maxWind);
    let riskLevel = riskAnalysis.riskLevel;
    let primaryRiskFactor = riskAnalysis.primaryRiskFactor;
    
    // Increase risk level for trips extending beyond forecast range
    if (tripBeyondForecast && weatherSamples < samplePoints * 0.3) {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
    }

    return {
      departureTime,
      arrivalTime,
      totalRainEncounter: totalRain,
      averageRainIntensity: averageRain,
      maxRainIntensity: maxRain,
      maxWindSpeed: maxWind,
      averageWindSpeed: averageWind,
      riskLevel,
      primaryRiskFactor
    };
  }, [analyzeWeatherRisk]);

  const findOptimalDepartureWindow = useCallback((
    routeCoordinates: [number, number][],
    baseTime: Date,
    routeDuration: number,
    hourlyForecasts: { [coordinate: string]: { [minute: number]: any } }
  ): TravelWindow[] => {
    const windows: TravelWindow[] = [];
    const now = new Date();
    
    // Generate windows 1 hour before and after the selected time in 15-minute intervals
    for (let minutes = -60; minutes <= 60; minutes += 15) {
      const departureTime = new Date(baseTime.getTime() + minutes * 60 * 1000);
      
      // Skip times in the past (more than 5 minutes ago)
      if (departureTime.getTime() < now.getTime() - 5 * 60 * 1000) {
        console.log(`Skipping past time: ${departureTime.toLocaleTimeString()}`);
        continue;
      }
      
      console.log(`Calculating window for departure time: ${departureTime.toLocaleTimeString()}`);
      const window = calculateTravelWindow(routeCoordinates, departureTime, routeDuration, hourlyForecasts);
      console.log(`Window result - Risk: ${window.riskLevel}, Max Rain: ${window.maxRainIntensity}mm/h`);
      windows.push(window);
    }

    // Sort by risk level and total rain encounter
    const sortedWindows = windows.sort((a, b) => {
      const riskOrder = { 'low': 0, 'medium': 1, 'high': 2 } as const;
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return a.totalRainEncounter - b.totalRainEncounter;
    });
    
    // Limit to top 8 windows to avoid overwhelming the UI
    return sortedWindows.slice(0, 8);
  }, [calculateTravelWindow]);

  const analyzeWeatherImprovement = useCallback((
    windows: TravelWindow[],
    baseTime: Date
  ): { willImprove: boolean; timeToImprovement?: Date; message: string } => {
    // Sort windows by departure time to analyze the trend
    const sortedWindows = [...windows].sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
    
    // Find the current window (closest to base time)
    const currentWindow = sortedWindows.reduce((prev, curr) => 
      Math.abs(curr.departureTime.getTime() - baseTime.getTime()) < 
      Math.abs(prev.departureTime.getTime() - baseTime.getTime()) ? curr : prev
    );
    
    // Get future windows (after current time)
    const futureWindows = sortedWindows.filter(w => w.departureTime > baseTime);
    
    console.log(`Analyzing weather improvement: Current max rain: ${currentWindow.maxRainIntensity}mm/h, Risk: ${currentWindow.riskLevel}`);
    console.log(`Future windows: ${futureWindows.length} windows to analyze`);
    
    // Check if conditions improve in the next few hours
    let timeToImprovement: Date | undefined;
    let improvementFound = false;
    
    for (const window of futureWindows) {
      console.log(`Future window at ${window.departureTime.toLocaleTimeString()}: Max rain: ${window.maxRainIntensity}mm/h, Risk: ${window.riskLevel}`);
      
      // Check if this window has significantly better conditions
      if (window.maxRainIntensity < currentWindow.maxRainIntensity * 0.7 || 
          (currentWindow.riskLevel === 'high' && window.riskLevel !== 'high')) {
        timeToImprovement = window.departureTime;
        improvementFound = true;
        console.log(`Improvement found at ${timeToImprovement.toLocaleTimeString()}`);
        break;
      }
    }
    
    // Check if conditions are getting worse
    const worseWindows = futureWindows.filter(w => w.maxRainIntensity > currentWindow.maxRainIntensity * 1.3);
    const gettingWorse = worseWindows.length > 0;
    
    if (improvementFound && timeToImprovement) {
      const minutesToImprovement = Math.round((timeToImprovement.getTime() - baseTime.getTime()) / 60000);
      return {
        willImprove: true,
        timeToImprovement,
        message: `Conditions should improve in about ${minutesToImprovement} minutes`
      };
    }
    
    if (gettingWorse) {
      return {
        willImprove: false,
        message: "Weather conditions are expected to worsen - consider leaving sooner"
      };
    }
    
    if (currentWindow.riskLevel === 'high') {
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
      const routeDurationHours = routeDuration / 3600; // Convert to hours
      let windows: TravelWindow[] = [];
      
      // Check if AccuWeather API key is available
      const hasAccuWeatherKey = localStorage.getItem('accuweather-api-key');
      
      // Use AccuWeather MinuteCast for routes under 2 hours if API key is available
      if (routeDurationHours < 2 && hasAccuWeatherKey) {
        console.log(`Route duration: ${routeDurationHours.toFixed(1)}h - Using AccuWeather MinuteCast for high precision`);
        
        try {
          windows = await generateAccuWeatherWindows(routeCoordinates, baseTime, routeDuration);
          console.log(`Generated ${windows.length} AccuWeather windows`);
          
          // If AccuWeather fails, fallback to OpenWeather
          if (windows.length === 0) {
            console.log('AccuWeather failed, falling back to OpenWeather');
            windows = findOptimalDepartureWindow(routeCoordinates, baseTime, routeDuration, hourlyForecasts);
            console.log(`Generated ${windows.length} OpenWeather fallback windows`);
          }
        } catch (error) {
          console.error('AccuWeather error, falling back to OpenWeather:', error);
          windows = findOptimalDepartureWindow(routeCoordinates, baseTime, routeDuration, hourlyForecasts);
          console.log(`Generated ${windows.length} OpenWeather fallback windows`);
        }
      } else {
        // Use OpenWeatherMap for long routes or when AccuWeather is not available
        const reason = routeDurationHours >= 2 ? 'route duration exceeds 2 hours' : 'AccuWeather API key not available';
        console.log(`Using OpenWeather due to: ${reason} (duration: ${routeDurationHours.toFixed(1)}h)`);
        windows = findOptimalDepartureWindow(routeCoordinates, baseTime, routeDuration, hourlyForecasts);
        console.log(`Generated ${windows.length} OpenWeather windows`);
      }

      // Identify best, current-at-selected, and trend
      const bestWindow = windows[0];
      
      // Calculate current window using the same method as the generated windows
      let currentAtSelected: TravelWindow;
      if (routeDurationHours < 2 && hasAccuWeatherKey && windows.length > 0) {
        // Use AccuWeather calculation for consistency
        currentAtSelected = await calculateAccuWeatherWindow(routeCoordinates, baseTime, routeDuration);
      } else {
        // Use OpenWeather calculation
        currentAtSelected = calculateTravelWindow(routeCoordinates, baseTime, routeDuration, hourlyForecasts);
      }

      // Analyze weather improvement around the selected time
      const improvement = analyzeWeatherImprovement(windows, baseTime);

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
          message: generateConditionsMessage(currentAtSelected)
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
      console.log('Generating AccuWeather windows for route...');
      
      // Get MinuteCast data for the route centered around the selected time
      const minutecastForecasts = await getMinuteCastForRoute(routeCoordinates, baseTime, routeDuration);
      
      console.log(`Got MinuteCast data for ${Object.keys(minutecastForecasts).length} coordinates`);
      
      // Generate windows 1 hour before and after in 15-minute intervals
      for (let minutes = -60; minutes <= 60; minutes += 15) {
        const departureTime = new Date(baseTime.getTime() + minutes * 60 * 1000);
        console.log(`Calculating AccuWeather window for ${departureTime.toLocaleTimeString()}`);
        
        const window = await calculateAccuWeatherWindow(routeCoordinates, departureTime, routeDuration, minutecastForecasts);
        windows.push(window);
        
        console.log(`Window result - Risk: ${window.riskLevel}, Max Rain: ${window.maxRainIntensity}mm/h`);
      }
    } catch (error) {
      console.error('Failed to generate AccuWeather windows:', error);
      // Return empty windows to trigger fallback
      return [];
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
    let totalWind = 0;
    let maxWind = 0;
    let weatherSamples = 0;

    const arrivalTime = new Date(departureTime.getTime() + routeDuration * 1000);
    
    try {
      const forecasts = minutecastForecasts || await getMinuteCastForRoute(routeCoordinates, departureTime, routeDuration);
      
      console.log(`Calculating AccuWeather window with ${Object.keys(forecasts).length} forecast points`);
      
          // Sample key points along the route - increase density for better accuracy
    const samplePoints = Math.min(routeCoordinates.length, 100); // Increased from 50 to 100
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
            console.log(`Point ${i}: Arrival at ${pointArrivalTime.toLocaleTimeString()}, Precipitation: ${closest.precipitation}mm, Type: ${closest.precipitationType}`);
            totalRain += closest.precipitation;
            maxRain = Math.max(maxRain, closest.precipitation);
            
            // AccuWeather MinuteCast doesn't include wind data, use default moderate wind
            // This could be enhanced by fetching current wind conditions separately
            const defaultWind = 15; // 15 km/h default wind speed
            totalWind += defaultWind;
            maxWind = Math.max(maxWind, defaultWind);
            
            weatherSamples++;
          } else {
            console.log(`Point ${i}: No forecast found for ${pointArrivalTime.toLocaleTimeString()}`);
          }
        } else {
          console.log(`Point ${i}: No forecast data for coordinate ${coordKey}`);
        }
      }
    } catch (error) {
      console.error('Error calculating AccuWeather window:', error);
    }

    const averageRain = weatherSamples > 0 ? totalRain / weatherSamples : 0;
    const averageWind = weatherSamples > 0 ? totalWind / weatherSamples : 0;
    
    // Analyze combined weather risk
    const riskAnalysis = analyzeWeatherRisk(maxRain, maxWind);
    const riskLevel = riskAnalysis.riskLevel;
    const primaryRiskFactor = riskAnalysis.primaryRiskFactor;
    
    console.log(`AccuWeather window result: Samples: ${weatherSamples}, Total Rain: ${totalRain}mm, Max Rain: ${maxRain}mm, Max Wind: ${maxWind}km/h, Risk: ${riskLevel}`);

    return {
      departureTime,
      arrivalTime,
      totalRainEncounter: totalRain,
      averageRainIntensity: averageRain,
      maxRainIntensity: maxRain,
      maxWindSpeed: maxWind,
      averageWindSpeed: averageWind,
      riskLevel,
      primaryRiskFactor
    };
  }, [getMinuteCastForRoute, analyzeWeatherRisk]);

  return {
    generateRecommendation,
    loading
  };
};