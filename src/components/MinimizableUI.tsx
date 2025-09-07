import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Menu, X, Zap, Settings, Check } from 'lucide-react';
import TimeControls from './TimeControls';
import OverlayControls from './OverlayControls';
import AddressSearch from './AddressSearch';
import WeatherForecast from './WeatherForecast';

interface MinimizableUIProps {
  currentHour: number;
  isAnimating: boolean;
  onHourChange: (hour: number) => void;
  onToggleAnimation: () => void;
  departureTime: Date;
  onDepartureTimeChange: (time: Date) => void;
  showPrecipitation: boolean;
  showClouds: boolean;
  precipitationOpacity: number;
  cloudOpacity: number;
  onTogglePrecipitation: (show: boolean) => void;
  onToggleClouds: (show: boolean) => void;
  onPrecipitationOpacityChange: (opacity: number) => void;
  onCloudOpacityChange: (opacity: number) => void;
  mapboxToken: string;
  onLocationSelect: (lng: number, lat: number, placeName: string) => void;
  onStartNavigation: () => void;
  departureWeather: any;
  arrivalWeather: any;
  arrivalTime?: Date;
  onClearRoute: () => void;
  routePoints: any[];
  onApiSetup: () => void;
  hasUpdates?: boolean;
  onUpdate?: () => void;
}

const MinimizableUI: React.FC<MinimizableUIProps> = ({
  currentHour,
  isAnimating,
  onHourChange,
  onToggleAnimation,
  departureTime,
  onDepartureTimeChange,
  showPrecipitation,
  showClouds,
  precipitationOpacity,
  cloudOpacity,
  onTogglePrecipitation,
  onToggleClouds,
  onPrecipitationOpacityChange,
  onCloudOpacityChange,
  mapboxToken,
  onLocationSelect,
  onStartNavigation,
  departureWeather,
  arrivalWeather,
  arrivalTime,
  onClearRoute,
  routePoints,
  onApiSetup,
  hasUpdates,
  onUpdate
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'search' | 'weather' | 'settings'>('controls');

  const handleDepartureTimePlus = (hours: number) => {
    const newTime = new Date(departureTime.getTime() + hours * 60 * 60 * 1000);
    onDepartureTimeChange(newTime);
  };

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          size="sm"
          onClick={() => setIsMinimized(false)}
          className="bg-card/95 backdrop-blur-sm border shadow-lg"
          variant="outline"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80 max-h-[80vh] overflow-visible">
      <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-card/50">
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={activeTab === 'controls' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('controls')}
              className="h-8 text-xs"
            >
              Controls
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'search' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('search')}
              className="h-8 text-xs"
            >
              Search
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'weather' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('weather')}
              className="h-8 text-xs"
            >
              Weather
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('settings')}
              className="h-8 text-xs"
            >
              Setup
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsMinimized(true)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-3">
          {activeTab === 'controls' && (
            <div className="space-y-4">
              <TimeControls
                currentHour={currentHour}
                isAnimating={isAnimating}
                onHourChange={onHourChange}
                onToggleAnimation={onToggleAnimation}
                departureTime={departureTime}
                onDepartureTimeChange={onDepartureTimeChange}
                hasUpdates={hasUpdates}
                onUpdate={onUpdate}
              />
              
              <OverlayControls
                showPrecipitation={showPrecipitation}
                showClouds={showClouds}
                precipitationOpacity={precipitationOpacity}
                cloudOpacity={cloudOpacity}
                onTogglePrecipitation={onTogglePrecipitation}
                onToggleClouds={onToggleClouds}
                onPrecipitationOpacityChange={onPrecipitationOpacityChange}
                onCloudOpacityChange={onCloudOpacityChange}
              />

              {/* Enhanced departure time controls */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium mb-2">Quick Departure Times</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDepartureTimeChange(new Date())}
                    className="text-xs"
                  >
                    Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDepartureTimePlus(0.5)}
                    className="text-xs"
                  >
                    +30min
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDepartureTimePlus(1)}
                    className="text-xs"
                  >
                    +1 hour
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDepartureTimePlus(24)}
                    className="text-xs"
                  >
                    +1 day
                  </Button>
                </div>
              </div>
              
              {routePoints.length > 0 && (
                <Button 
                  onClick={onClearRoute} 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  Clear Route ({routePoints.length} points)
                </Button>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <AddressSearch
                mapboxToken={mapboxToken}
                onLocationSelect={onLocationSelect}
                onStartNavigation={onStartNavigation}
              />
              
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                <div className="font-medium mb-1">Search Tips:</div>
                <div>• Search results will show "Set as Departure" and "Set as Destination" options</div>
                <div>• Click anywhere on the map to add waypoints</div>
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="space-y-4">
              {(departureWeather || arrivalWeather) ? (
                <WeatherForecast
                  departureWeather={departureWeather}
                  arrivalWeather={arrivalWeather}
                  departureLocation="Departure"
                  arrivalLocation="Destination"
                  departureTime={departureTime}
                  arrivalTime={arrivalTime}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <div className="text-sm">No route selected</div>
                  <div className="text-xs mt-1">
                    Create a route to see weather forecasts
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="w-full justify-start p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="text-sm font-medium">WeatherKit Integration</div>
                      <div className="text-xs text-muted-foreground">Configure via Settings for weather data</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinimizableUI;