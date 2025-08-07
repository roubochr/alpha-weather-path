import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Clock, Play, Pause } from 'lucide-react';

interface TimeControlsProps {
  currentHour: number;
  isAnimating: boolean;
  onHourChange: (hour: number) => void;
  onToggleAnimation: () => void;
  departureTime: Date;
  onDepartureTimeChange: (time: Date) => void;
}

const TimeControls: React.FC<TimeControlsProps> = ({
  currentHour,
  isAnimating,
  onHourChange,
  onToggleAnimation,
  departureTime,
  onDepartureTimeChange
}) => {
  const formatHour = (hour: number): string => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: true 
    });
  };

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDepartureTimeChange = (hoursFromNow: number) => {
    const newTime = new Date();
    newTime.setTime(newTime.getTime() + hoursFromNow * 60 * 60 * 1000);
    onDepartureTimeChange(newTime);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Time Controls</Label>
        </div>
        <Button
          size="sm"
          variant={isAnimating ? "default" : "outline"}
          onClick={onToggleAnimation}
        >
          {isAnimating ? (
            <>
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-3 w-3 mr-1" />
              Play
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm text-muted-foreground">
            Weather Time: {formatHour(currentHour)}
          </Label>
          <Slider
            value={[currentHour]}
            onValueChange={(value) => onHourChange(value[0])}
            max={23}
            min={0}
            step={1}
            className="mt-2"
          />
        </div>

        <div className="border-t border-border pt-3">
          <Label className="text-sm font-medium">Departure Time & Date</Label>
          <div className="text-xs text-muted-foreground mb-2">
            Current: {formatDateTime(departureTime)}
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDepartureTimeChange(0)}
              className="text-xs"
            >
              Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDepartureTimeChange(1)}
              className="text-xs"
            >
              +1hr
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDepartureTimeChange(3)}
              className="text-xs"
            >
              +3hr
            </Button>
          </div>
          
          {/* Date controls */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const newTime = new Date(departureTime);
                newTime.setDate(newTime.getDate() + 1);
                onDepartureTimeChange(newTime);
              }}
              className="text-xs"
            >
              +1 Day
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDepartureTimeChange(24)}
              className="text-xs"
            >
              Tomorrow
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDepartureTimeChange(168)}
              className="text-xs"
            >
              Next Week
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TimeControls;