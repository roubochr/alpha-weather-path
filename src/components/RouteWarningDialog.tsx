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

  const hasAccuWeatherKey = localStorage.getItem('accuweather-api-key');

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
              {hasAccuWeatherKey && (
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    AccuWeather MinuteCast
                  </Badge>
                  <div className="text-sm">
                    <div className="font-medium">High Precision (0-2 hours)</div>
                    <div className="text-muted-foreground">
                      Minute-by-minute precipitation forecasts with high accuracy
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  OpenWeather {hasAccuWeatherKey ? 'Fallback' : 'Standard'}
                </Badge>
                <div className="text-sm">
                  <div className="font-medium">Standard Precision (2+ hours)</div>
                  <div className="text-muted-foreground">
                    3-hour interval forecasts with interpolation - reduced accuracy
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800 font-medium text-sm">
                <CloudRain className="h-4 w-4" />
                Weather Accuracy Notice
              </div>
              <div className="text-xs text-orange-700 mt-1">
                {hasAccuWeatherKey ? (
                  <>For routes longer than 2 hours, the system will use OpenWeather's 3-hour forecast 
                  intervals with interpolation. This may result in less precise precipitation timing 
                  and intensity predictions compared to AccuWeather's minute-level data.</>
                ) : (
                  <>This route uses OpenWeather's 3-hour forecast intervals with interpolation. 
                  For better accuracy on shorter routes, consider setting up AccuWeather MinuteCast 
                  which provides minute-by-minute precipitation forecasts.</>
                )}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onContinue} className="flex-1">
            {hasAccuWeatherKey ? 'Continue with Reduced Accuracy' : 'Continue with Standard Accuracy'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteWarningDialog;
