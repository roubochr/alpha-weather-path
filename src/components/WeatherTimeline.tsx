import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Clock,
  CloudRain,
  Thermometer
} from 'lucide-react';
import { TomorrowForecastData } from '@/hooks/useTomorrowWeather';

interface WeatherTimelineProps {
  currentTime: number; // Unix timestamp
  isAnimating: boolean;
  onTimeChange: (timestamp: number) => void;
  onToggleAnimation: () => void;
  forecastData?: TomorrowForecastData[];
  routeWeatherData?: { [coordinate: string]: TomorrowForecastData[] };
  routeCoordinates?: [number, number][];
  onRouteWeatherUpdate?: () => void;
}

const WeatherTimeline: React.FC<WeatherTimelineProps> = ({
  currentTime,
  isAnimating,
  onTimeChange,
  onToggleAnimation,
  forecastData = [],
  routeWeatherData = {},
  routeCoordinates = [],
  onRouteWeatherUpdate
}) => {
  const [timelineRange, setTimelineRange] = useState<{ start: number; end: number }>({
    start: Date.now(),
    end: Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
  });

  const [selectedForecast, setSelectedForecast] = useState<TomorrowForecastData | null>(null);

  useEffect(() => {
    // Update timeline range based on available forecast data
    if (forecastData.length > 0) {
      const timestamps = forecastData.map(f => f.timestampUTC);
      const start = Math.min(...timestamps);
      const end = Math.max(...timestamps);
      setTimelineRange({ start, end });
    }
  }, [forecastData]);

  useEffect(() => {
    // Find the forecast closest to current time
    if (forecastData.length > 0) {
      let closest = forecastData[0];
      let minDiff = Math.abs(closest.timestampUTC - currentTime);

      forecastData.forEach(forecast => {
        const diff = Math.abs(forecast.timestampUTC - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = forecast;
        }
      });

      setSelectedForecast(closest);
    }
  }, [currentTime, forecastData]);

  const formatTimeLabel = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (isTomorrow) {
      return `Tomorrow ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }, []);

  const getTimelinePosition = useCallback((timestamp: number): number => {
    const { start, end } = timelineRange;
    const position = ((timestamp - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, position));
  }, [timelineRange]);

  const getTimestampFromPosition = useCallback((position: number): number => {
    const { start, end } = timelineRange;
    return start + (position / 100) * (end - start);
  }, [timelineRange]);

  const jumpToTime = useCallback((direction: 'back' | 'forward') => {
    const increment = 60 * 60 * 1000; // 1 hour in milliseconds
    const newTime = direction === 'forward' 
      ? currentTime + increment 
      : currentTime - increment;
    
    // Keep within timeline range
    const clampedTime = Math.max(
      timelineRange.start, 
      Math.min(timelineRange.end, newTime)
    );
    
    onTimeChange(clampedTime);
  }, [currentTime, timelineRange, onTimeChange]);

  const getPrecipitationColor = useCallback((intensity: number): string => {
    if (intensity <= 0) return 'rgb(156, 163, 175)'; // Gray for no rain
    if (intensity < 0.1) return 'rgb(34, 197, 94)'; // Green
    if (intensity < 0.5) return 'rgb(132, 204, 22)'; // Lime
    if (intensity < 1) return 'rgb(245, 158, 11)'; // Amber
    if (intensity < 3) return 'rgb(249, 115, 22)'; // Orange
    if (intensity < 10) return 'rgb(239, 68, 68)'; // Red
    return 'rgb(220, 38, 38)'; // Dark red
  }, []);

  const getRouteWeatherSummary = useCallback((): { avgPrecipitation: number; avgTemp: number; coordCount: number } => {
    const coordKeys = Object.keys(routeWeatherData);
    if (coordKeys.length === 0) return { avgPrecipitation: 0, avgTemp: 0, coordCount: 0 };

    let totalPrecipitation = 0;
    let totalTemp = 0;
    let count = 0;

    coordKeys.forEach(coordKey => {
      const forecasts = routeWeatherData[coordKey];
      if (forecasts.length > 0) {
        // Find forecast closest to current time
        let closest = forecasts[0];
        let minDiff = Math.abs(closest.timestampUTC - currentTime);

        forecasts.forEach(forecast => {
          const diff = Math.abs(forecast.timestampUTC - currentTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = forecast;
          }
        });

        totalPrecipitation += closest.precipitationIntensity;
        totalTemp += closest.temperature;
        count++;
      }
    });

    return {
      avgPrecipitation: count > 0 ? totalPrecipitation / count : 0,
      avgTemp: count > 0 ? totalTemp / count : 0,
      coordCount: count
    };
  }, [routeWeatherData, currentTime]);

  const routeSummary = getRouteWeatherSummary();

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Weather Timeline</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => jumpToTime('back')}
            disabled={currentTime <= timelineRange.start}
          >
            <SkipBack className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={isAnimating ? "default" : "outline"}
            onClick={onToggleAnimation}
          >
            {isAnimating ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => jumpToTime('forward')}
            disabled={currentTime >= timelineRange.end}
          >
            <SkipForward className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm text-muted-foreground">
            {formatTimeLabel(currentTime)}
          </Label>
          <div className="mt-2 relative">
            <Slider
              value={[getTimelinePosition(currentTime)]}
              onValueChange={(value) => {
                const newTime = getTimestampFromPosition(value[0]);
                onTimeChange(newTime);
              }}
              max={100}
              min={0}
              step={0.1}
              className="w-full"
            />
            
            {/* Precipitation intensity markers along timeline */}
            <div className="absolute top-6 left-0 right-0 h-2 flex">
              {forecastData.map((forecast, index) => {
                const position = getTimelinePosition(forecast.timestampUTC);
                const color = getPrecipitationColor(forecast.precipitationIntensity);
                
                return (
                  <div
                    key={index}
                    className="absolute w-1 h-2 rounded-sm opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{
                      left: `${position}%`,
                      backgroundColor: color,
                      transform: 'translateX(-50%)'
                    }}
                    title={`${forecast.precipitationIntensity.toFixed(1)}mm/h at ${formatTimeLabel(forecast.timestampUTC)}`}
                    onClick={() => onTimeChange(forecast.timestampUTC)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Current weather display */}
        {selectedForecast && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Thermometer className="h-4 w-4 text-orange-500" />
                <span className="font-semibold">{selectedForecast.temperature}°C</span>
              </div>
              <div className="flex items-center space-x-2">
                <CloudRain className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{selectedForecast.precipitationIntensity.toFixed(1)}mm/h</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedForecast.description}
            </div>
          </div>
        )}

        {/* Route weather summary */}
        {routeSummary.coordCount > 0 && (
          <div className="border-t border-border pt-3">
            <Label className="text-sm font-medium">Route Weather Summary</Label>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Thermometer className="h-3 w-3 text-orange-500" />
                <span>Avg: {routeSummary.avgTemp.toFixed(1)}°C</span>
              </div>
              <div className="flex items-center space-x-2">
                <CloudRain className="h-3 w-3 text-blue-500" />
                <span>Avg: {routeSummary.avgPrecipitation.toFixed(1)}mm/h</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Data from {routeSummary.coordCount} route points
            </div>
            
            {onRouteWeatherUpdate && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRouteWeatherUpdate}
                className="w-full mt-2"
              >
                <Clock className="h-3 w-3 mr-1" />
                Update Route Weather
              </Button>
            )}
          </div>
        )}

        {/* Time range display */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>{formatTimeLabel(timelineRange.start)}</span>
          <span>{formatTimeLabel(timelineRange.end)}</span>
        </div>
      </div>
    </Card>
  );
};

export default WeatherTimeline;
