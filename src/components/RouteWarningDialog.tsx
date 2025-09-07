import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CloudRain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RouteWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  routeDuration: number; // in seconds
  onContinue: () => void;
}

const RouteWarningDialog: React.FC<RouteWarningDialogProps> = ({
  isOpen,
  onClose,
  routeDuration,
  onContinue
}) => {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Route Duration Warning
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="h-4 w-4 text-amber-600" />
              <div>
                <div className="font-medium text-amber-800">
                  Route Duration: {formatDuration(routeDuration)}
                </div>
                <div className="text-xs text-amber-700">
                  This route exceeds 2 hours
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  WeatherKit
                </Badge>
                <div className="text-sm">
                  <div className="font-medium">Weather Forecast Data</div>
                  <div className="text-muted-foreground">
                    Hourly forecasts with interpolation for route planning
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                <CloudRain className="h-4 w-4" />
                Weather Information
              </div>
              <div className="text-xs text-blue-700 mt-1">
                This route uses WeatherKit's hourly forecast data with interpolation 
                to provide weather conditions along your journey.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onContinue} className="flex-1">
            Continue with Weather Data
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteWarningDialog;
