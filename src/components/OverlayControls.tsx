import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CloudRain, Cloud, Eye, EyeOff } from 'lucide-react';

interface OverlayControlsProps {
  showPrecipitation: boolean;
  showClouds: boolean;
  onTogglePrecipitation: (enabled: boolean) => void;
  onToggleClouds: (enabled: boolean) => void;
}

const OverlayControls: React.FC<OverlayControlsProps> = ({
  showPrecipitation,
  showClouds,
  onTogglePrecipitation,
  onToggleClouds
}) => {
  return (
    <Card className="p-3 bg-card/95 backdrop-blur-sm border shadow-lg">
      <div className="text-sm font-medium mb-3 flex items-center">
        <Eye className="h-4 w-4 mr-2" />
        Weather Overlays
      </div>
      
      <div className="space-y-3">
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
      </div>
    </Card>
  );
};

export default OverlayControls;