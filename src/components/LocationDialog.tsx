import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Plus } from 'lucide-react';

interface LocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSetDeparture: () => void;
  onSetDestination: () => void;
  onAddStop: () => void;
  coordinates: { lng: number; lat: number };
}

const LocationDialog: React.FC<LocationDialogProps> = ({
  isOpen,
  onClose,
  onSetDeparture,
  onSetDestination,
  onAddStop,
  coordinates
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-primary" />
            Set Location
          </DialogTitle>
          <DialogDescription>
            What would you like to do with this location?
            <br />
            <span className="text-xs text-muted-foreground">
              {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          <Button
            onClick={() => {
              onSetDeparture();
              onClose();
            }}
            className="flex items-center justify-start gap-3 h-12"
            variant="outline"
          >
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm">
              🚀
            </div>
            Set as Departure Point
          </Button>
          
          <Button
            onClick={() => {
              onSetDestination();
              onClose();
            }}
            className="flex items-center justify-start gap-3 h-12"
            variant="outline"
          >
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm">
              🏁
            </div>
            Set as Destination
          </Button>
          
          <Button
            onClick={() => {
              onAddStop();
              onClose();
            }}
            className="flex items-center justify-start gap-3 h-12"
            variant="outline"
          >
            <Plus className="h-4 w-4 text-blue-500" />
            Add as Waypoint
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationDialog;