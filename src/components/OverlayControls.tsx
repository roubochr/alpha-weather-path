import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { CloudRain, Cloud, Eye, EyeOff } from 'lucide-react';

interface OverlayControlsProps {
  showPrecipitation: boolean;
  showClouds: boolean;
  precipitationOpacity: number;
  cloudOpacity: number;
  onTogglePrecipitation: (enabled: boolean) => void;
  onToggleClouds: (enabled: boolean) => void;
  onPrecipitationOpacityChange: (opacity: number) => void;
  onCloudOpacityChange: (opacity: number) => void;
}

const OverlayControls: React.FC<OverlayControlsProps> = ({
  showPrecipitation,
  showClouds,
  precipitationOpacity,
  cloudOpacity,
  onTogglePrecipitation,
  onToggleClouds,
  onPrecipitationOpacityChange,
  onCloudOpacityChange
}) => {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium mb-3 flex items-center">
        <Eye className="h-4 w-4 mr-2" />
        Weather Overlays
      </div>
      
      <div className="space-y-4">
        {/* Precipitation Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CloudRain className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Precipitation</span>
            </div>
            <Switch
              checked={showPrecipitation}
              onCheckedChange={onTogglePrecipitation}
            />
          </div>
          {showPrecipitation && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Opacity</span>
                <span>{Math.round(precipitationOpacity * 100)}%</span>
              </div>
              <Slider
                value={[precipitationOpacity]}
                onValueChange={(value) => onPrecipitationOpacityChange(value[0])}
                max={1}
                min={0}
                step={0.01}
                className="w-full"
              />
            </div>
          )}
        </div>
        
        {/* Cloud Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cloud className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Clouds</span>
            </div>
            <Switch
              checked={showClouds}
              onCheckedChange={onToggleClouds}
            />
          </div>
          {showClouds && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Opacity</span>
                <span>{Math.round(cloudOpacity * 100)}%</span>
              </div>
              <Slider
                value={[cloudOpacity]}
                onValueChange={(value) => onCloudOpacityChange(value[0])}
                max={1}
                min={0}
                step={0.01}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverlayControls;