import { useState, useCallback } from 'react';
import { TimeBasedWeatherData } from './useTimeBasedWeather';

export interface TravelWindow {
  departureTime: Date;
  arrivalTime: Date;
  totalRainEncounter: number;
  averageRainIntensity: number;
  maxRainIntensity: number;
  maxWindSpeed: number;
  averageWindSpeed: number;
  riskLevel: 'low' | 'medium' | 'high';
  primaryRiskFactor: 'rain' | 'wind' | 'combined' | 'none';
  conditionsMessage: string;
  optimalWindow: boolean;
  ranking: number;
  delayBenefit?: {
    recommendedDelay: number;
    expectedImprovement: string;
    riskReduction: number;
  };
  earlierBenefit?: {
    recommendedAdvance: number;
    expectedImprovement: string;
    riskReduction: number;
  };
  improvementForecast: {
    willImprove: boolean;
    timeToImprovement?: Date;
    message: string;
  };
}

export interface TravelRecommendation {
  currentConditions: TravelWindow;
  alternativeWindows: TravelWindow[];
  generalAdvice: string;
  immediateAction: string;
  confidence: number;
}

export const useTravelRecommendations = () => {
  const [loading, setLoading] = useState(false);

  const generateConditionsMessage = useCallback((window: TravelWindow): string => {
    const { riskLevel, primaryRiskFactor, maxRainIntensity, maxWindSpeed } = window;
    
    const riskText = riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Moderate' : 'Low';
    
    if (primaryRiskFactor === 'wind') {
      return `${riskText} wind risk: ${maxWindSpeed.toFixed(0)}km/h gusts expected`;
    } else if (primaryRiskFactor === 'combined') {
      return `${riskText} risk: Heavy rain (${maxRainIntensity.toFixed(1)}mm/h) + strong winds (${maxWindSpeed.toFixed(0)}km/h)`;
    } else if (primaryRiskFactor === 'rain') {
      return `${riskText} rain risk: ${maxRainIntensity.toFixed(1)}mm/h precipitation expected`;
    } else {
      return `${riskText} risk: Favorable conditions expected`;
    }
  }, []);

  const generateRecommendation = useCallback(async (
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number,
    timeBasedForecasts: { [coordinate: string]: { [minute: number]: any } }
  ): Promise<TravelRecommendation> => {
    console.log('Generating travel recommendations...');
    setLoading(true);

    try {
      // Calculate weather window for current departure time
      const currentWindow = await calculateWeatherWindow(
        routeCoordinates,
        departureTime,
        routeDuration,
        timeBasedForecasts
      );

      // Generate alternative departure times (every 30 minutes for next 6 hours)
      const alternativeWindows: TravelWindow[] = [];
      for (let offset = 30; offset <= 360; offset += 30) {
        const altDepartureTime = new Date(departureTime.getTime() + offset * 60000);
        const altWindow = await calculateWeatherWindow(
          routeCoordinates,
          altDepartureTime,
          routeDuration,
          timeBasedForecasts
        );
        alternativeWindows.push(altWindow);
      }

      // Rank alternatives by total rain encounter and wind risk
      alternativeWindows.sort((a, b) => {
        const aScore = a.totalRainEncounter + (a.maxWindSpeed / 10);
        const bScore = b.totalRainEncounter + (b.maxWindSpeed / 10);
        return aScore - bScore;
      });

      // Mark the best alternative as optimal
      if (alternativeWindows.length > 0) {
        alternativeWindows[0].optimalWindow = true;
      }

      // Generate advice
      const bestAlternative = alternativeWindows[0];
      let generalAdvice = '';
      let immediateAction = '';
      let confidence = 0.8;

      if (currentWindow.riskLevel === 'high') {
        if (bestAlternative && bestAlternative.riskLevel === 'low') {
          const delayMinutes = Math.round((bestAlternative.departureTime.getTime() - departureTime.getTime()) / 60000);
          generalAdvice = `Consider delaying departure by ${delayMinutes} minutes to avoid severe weather conditions.`;
          immediateAction = 'Delay recommended';
          confidence = 0.9;
        } else {
          generalAdvice = 'Proceed with extreme caution. Weather conditions are challenging throughout the forecast period.';
          immediateAction = 'Exercise caution';
          confidence = 0.7;
        }
      } else if (currentWindow.riskLevel === 'medium') {
        if (bestAlternative && bestAlternative.riskLevel === 'low') {
          const delayMinutes = Math.round((bestAlternative.departureTime.getTime() - departureTime.getTime()) / 60000);
          generalAdvice = `Weather conditions will improve in ${delayMinutes} minutes. Consider waiting for better conditions.`;
          immediateAction = 'Short delay beneficial';
          confidence = 0.85;
        } else {
          generalAdvice = 'Current conditions are acceptable but monitor weather updates during your journey.';
          immediateAction = 'Proceed with monitoring';
          confidence = 0.8;
        }
      } else {
        generalAdvice = 'Excellent weather conditions for travel. Safe journey!';
        immediateAction = 'Depart as planned';
        confidence = 0.95;
      }

      const recommendation: TravelRecommendation = {
        currentConditions: currentWindow,
        alternativeWindows: alternativeWindows.slice(0, 6), // Top 6 alternatives
        generalAdvice,
        immediateAction,
        confidence
      };

      console.log('Travel recommendation generated:', recommendation);
      setLoading(false);
      return recommendation;

    } catch (error) {
      console.error('Error generating travel recommendations:', error);
      setLoading(false);
      throw error;
    }
  }, []);

  const calculateWeatherWindow = useCallback(async (
    routeCoordinates: [number, number][],
    departureTime: Date,
    routeDuration: number,
    timeBasedForecasts?: { [coordinate: string]: { [minute: number]: any } }
  ): Promise<TravelWindow> => {
    let totalRain = 0;
    let maxRain = 0;
    let totalWind = 0;
    let maxWind = 0;
    let weatherSamples = 0;

    const arrivalTime = new Date(departureTime.getTime() + routeDuration * 1000);
    
    if (!timeBasedForecasts) {
      // Fallback to mock data if no forecasts available
      return {
        departureTime,
        arrivalTime,
        totalRainEncounter: Math.random() * 5,
        averageRainIntensity: Math.random() * 2,
        maxRainIntensity: Math.random() * 3,
        maxWindSpeed: Math.random() * 20 + 5,
        averageWindSpeed: Math.random() * 15 + 5,
        riskLevel: 'low',
        primaryRiskFactor: 'none',
        conditionsMessage: 'Weather data unavailable',
        optimalWindow: false,
        ranking: 0,
        improvementForecast: {
          willImprove: false,
          message: 'Forecast unavailable'
        }
      };
    }

    // Sample weather at key points along the route
    const samplePoints = Math.min(10, routeCoordinates.length);
    const pointStep = Math.max(1, Math.floor(routeCoordinates.length / samplePoints));
    
    for (let i = 0; i < routeCoordinates.length; i += pointStep) {
      const coord = routeCoordinates[i];
      const coordinateKey = `${coord[0].toFixed(3)},${coord[1].toFixed(3)}`;
      
      // Calculate time at this point along the route
      const routeProgress = i / routeCoordinates.length;
      const timeAtPoint = new Date(departureTime.getTime() + (routeDuration * routeProgress * 1000));
      const minutesSinceDeparture = Math.floor((timeAtPoint.getTime() - departureTime.getTime()) / 60000);
      
      const coordinateWeather = timeBasedForecasts[coordinateKey];
      if (coordinateWeather && coordinateWeather[minutesSinceDeparture]) {
        const weather = coordinateWeather[minutesSinceDeparture];
        
        const rain = weather.precipitation || 0;
        const wind = weather.windSpeed || 0;
        
        totalRain += rain;
        maxRain = Math.max(maxRain, rain);
        totalWind += wind;
        maxWind = Math.max(maxWind, wind);
        weatherSamples++;
      }
    }

    const averageRain = weatherSamples > 0 ? totalRain / weatherSamples : 0;
    const averageWind = weatherSamples > 0 ? totalWind / weatherSamples : 0;

    // Determine risk level and primary factor
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let primaryRiskFactor: 'rain' | 'wind' | 'combined' | 'none' = 'none';

    if (maxRain > 3 && maxWind > 40) {
      riskLevel = 'high';
      primaryRiskFactor = 'combined';
    } else if (maxRain > 5) {
      riskLevel = 'high';
      primaryRiskFactor = 'rain';
    } else if (maxWind > 50) {
      riskLevel = 'high';
      primaryRiskFactor = 'wind';
    } else if (maxRain > 1.5 && maxWind > 25) {
      riskLevel = 'medium';
      primaryRiskFactor = 'combined';
    } else if (maxRain > 2) {
      riskLevel = 'medium';
      primaryRiskFactor = 'rain';
    } else if (maxWind > 30) {
      riskLevel = 'medium';
      primaryRiskFactor = 'wind';
    }

    const window: TravelWindow = {
      departureTime,
      arrivalTime,
      totalRainEncounter: totalRain,
      averageRainIntensity: averageRain,
      maxRainIntensity: maxRain,
      maxWindSpeed: maxWind,
      averageWindSpeed: averageWind,
      riskLevel,
      primaryRiskFactor,
      conditionsMessage: '',
      optimalWindow: false,
      ranking: 0,
      improvementForecast: {
        willImprove: false,
        message: 'Conditions stable'
      }
    };

    window.conditionsMessage = generateConditionsMessage(window);

    return window;
  }, [generateConditionsMessage]);

  return {
    generateRecommendation,
    calculateWeatherWindow,
    loading
  };
};