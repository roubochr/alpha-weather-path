import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, Clock, MapPin, Route as RouteIcon } from 'lucide-react';
import { RouteData, RouteStep } from '@/hooks/useRouting';

interface NavigationPanelProps {
  route: RouteData | null;
  currentStep: number;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  route,
  currentStep,
  isNavigating,
  onStartNavigation,
  onStopNavigation
}) => {
  if (!route) return null;

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="w-80 bg-card border-l border-border overflow-y-auto">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold flex items-center">
            <RouteIcon className="h-4 w-4 mr-2 text-primary" />
            Route Information
          </h2>
          {!isNavigating ? (
            <Button size="sm" onClick={onStartNavigation}>
              <Navigation className="h-4 w-4 mr-1" />
              Start
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={onStopNavigation}>
              Stop
            </Button>
          )}
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <RouteIcon className="h-4 w-4 text-blue-500" />
            <span>{formatDistance(route.distance)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4 text-green-500" />
            <span>{formatDuration(route.duration)}</span>
          </div>
        </div>
      </div>

      {isNavigating && route.steps.length > 0 && (
        <div className="p-4 border-b border-border bg-primary/5">
          <div className="flex items-start space-x-3">
            <Navigation className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">
                Continue on route
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {route.steps[currentStep] && 
                  `In ${formatDistance(route.steps[currentStep].distance)}`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <h3 className="font-medium mb-3 flex items-center">
          <MapPin className="h-4 w-4 mr-2" />
          Turn-by-turn Directions
        </h3>
        
        <div className="space-y-3">
          {route.steps.map((step, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg border ${
                isNavigating && index === currentStep 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border'
              }`}
            >
              <div className="flex items-start space-x-2">
                <Badge 
                  variant={
                    isNavigating && index === currentStep ? 'default' : 'outline'
                  }
                  className="text-xs px-2 py-1 mt-0.5 flex-shrink-0"
                >
                  {index + 1}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Continue on route</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistance(step.distance)} • {formatDuration(step.duration)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;