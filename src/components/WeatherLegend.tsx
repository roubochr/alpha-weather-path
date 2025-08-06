import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CloudRain, Droplets, Cloud } from 'lucide-react';

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
    <Card className={`p-3 bg-black/80 backdrop-blur-sm border-gray-700 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <CloudRain className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Weather Layers</span>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-4 h-3 rounded border border-blue-400/50 bg-blue-500/30" />
          <span className="text-blue-200 font-medium">Precipitation Overlay</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-4 h-3 rounded border border-gray-400/50 bg-gray-500/30" />
          <span className="text-gray-200 font-medium">Cloud Cover</span>
        </div>
      </div>
      
      <div className="border-t border-gray-600 pt-2 mb-2">
        <span className="text-xs font-semibold text-white">Route Colors:</span>
      </div>
      
      <div className="space-y-1">
        {legendItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div 
              className="w-4 h-3 rounded border border-white/50 flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-medium min-w-0 flex-1 text-white">{item.label}</span>
            <span className="text-gray-300 text-xs">{item.range}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-600">
        <div className="flex items-center gap-1 text-xs text-gray-300">
          <Droplets className="h-3 w-3" />
          <span>Route colors show expected precipitation</span>
        </div>
      </div>
    </Card>
  );
};

export default WeatherLegend;
