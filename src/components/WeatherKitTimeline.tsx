import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface WeatherKitTimelineProps {
  currentHour: number;
  onHourChange: (hour: number) => void;
  isAnimating: boolean;
  onAnimationToggle: () => void;
  weatherData?: any;
  className?: string;
}

const WeatherKitTimeline: React.FC<WeatherKitTimelineProps> = ({
  currentHour,
  onHourChange,
  isAnimating,
  onAnimationToggle,
  weatherData,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleSliderChange = useCallback((value: number[]) => {
    if (!isDragging) {
      setIsDragging(true);
    }
    onHourChange(value[0]);
  }, [onHourChange, isDragging]);

  const handleSliderCommit = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetToNow = useCallback(() => {
    onHourChange(new Date().getHours());
  }, [onHourChange]);

  const formatHour = (hour: number) => {
    const adjustedHour = hour % 24;
    const period = adjustedHour >= 12 ? 'PM' : 'AM';
    const displayHour = adjustedHour === 0 ? 12 : adjustedHour > 12 ? adjustedHour - 12 : adjustedHour;
    return `${displayHour}:00 ${period}`;
  };

  const getPrecipitationAtHour = (hour: number) => {
    if (!weatherData?.hourlyForecast) return 0;
    
    const minuteKey = (hour % 24) * 60;
    return weatherData.hourlyForecast[minuteKey]?.precipitation || 0;
  };

  const generateTimelineMarkers = () => {
    const markers = [];
    const currentTime = new Date();
    
    for (let i = 0; i < 24; i++) {
      const hour = (currentTime.getHours() + i) % 24;
      const precipitation = getPrecipitationAtHour(hour);
      
      // Create precipitation intensity indicator
      const intensity = precipitation > 2 ? 'high' : precipitation > 0.5 ? 'medium' : 'low';
      const heightClass = intensity === 'high' ? 'h-4' : intensity === 'medium' ? 'h-2' : 'h-1';
      const colorClass = intensity === 'high' ? 'bg-blue-600' : intensity === 'medium' ? 'bg-blue-400' : 'bg-blue-200';
      
      markers.push(
        <div
          key={hour}
          className="relative flex flex-col items-center"
          style={{ left: `${(i / 23) * 100}%` }}
        >
          <div className={`w-1 ${heightClass} ${colorClass} rounded-t mb-1`} />
          {i % 6 === 0 && (
            <span className="text-xs text-muted-foreground absolute top-6">
              {formatHour(hour)}
            </span>
          )}
        </div>
      );
    }
    
    return markers;
  };

  return (
    <Card className={`p-4 space-y-4 bg-background/95 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Weather Timeline</h3>
          <p className="text-xs text-muted-foreground">
            Current: {formatHour(currentHour)}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={resetToNow}
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          
          <Button
            size="sm"
            variant={isAnimating ? "default" : "outline"}
            onClick={onAnimationToggle}
            className="h-8 w-8 p-0"
          >
            {isAnimating ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {/* Timeline markers */}
        <div className="relative h-8 mb-2">
          <div className="absolute inset-x-0 top-0 flex">
            {generateTimelineMarkers()}
          </div>
        </div>

        {/* Time slider */}
        <div className="px-2">
          <Slider
            value={[currentHour]}
            onValueChange={handleSliderChange}
            onValueCommit={handleSliderCommit}
            max={47}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        {/* Current precipitation info */}
        {weatherData && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Precipitation: {getPrecipitationAtHour(currentHour).toFixed(1)}mm/h</span>
            <span>
              {isDragging ? 'Scrubbing...' : isAnimating ? 'Animating' : 'Paused'}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default WeatherKitTimeline;