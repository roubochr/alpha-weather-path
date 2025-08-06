import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CloudRain, Droplets } from 'lucide-react';

interface WeatherLegendProps {
  className?: string;
}

const WeatherLegend: React.FC<WeatherLegendProps> = ({ className = '' }) => {
  const legendItems = [
    { color: '#22c55e', label: 'No Rain', range: '0 mm/h' },
    { color: '#84cc16', label: 'Very Light', range: '< 0.5 mm/h' },
    { color: '#eab308', label: 'Light Rain', range: '0.5-1 mm/h' },
    { color: '#f97316', label: 'Moderate', range: '1-3 mm/h' },
    { color: '#ef4444', label: 'Heavy Rain', range: '3-10 mm/h' },
    { color: '#dc2626', label: 'Very Heavy', range: '> 10 mm/h' }
  ];

  return (
    <Card className={`p-3 bg-card/95 backdrop-blur-sm ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <CloudRain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Precipitation Legend</span>
      </div>
      
      <div className="space-y-1.5">
        {legendItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div 
              className="w-4 h-3 rounded border border-white/50 flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-medium min-w-0 flex-1">{item.label}</span>
            <span className="text-muted-foreground text-xs">{item.range}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Droplets className="h-3 w-3" />
          <span>Route colors show expected precipitation</span>
        </div>
      </div>
    </Card>
  );
};

export default WeatherLegend;