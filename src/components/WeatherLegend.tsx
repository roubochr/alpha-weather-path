import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CloudRain, Droplets, Cloud, ChevronUp, ChevronDown } from 'lucide-react';

interface WeatherLegendProps {
  className?: string;
  routePointsCount?: number;
}

const WeatherLegend: React.FC<WeatherLegendProps> = ({ className = '', routePointsCount = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-hide after 5 seconds when points are added
  useEffect(() => {
    if (routePointsCount > 0 && isExpanded) {
      // Clear existing timer
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
      
      // Set new timer for 5 seconds
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 5000);
      
      setAutoHideTimer(timer);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [routePointsCount, isExpanded]);

  const handleToggle = () => {
    // Clear auto-hide timer when manually toggling
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
    setIsExpanded(!isExpanded);
  };
  
  const legendItems = [
    { color: '#22c55e', label: 'No Rain', range: '0 mm/h' },
    { color: '#84cc16', label: 'Very Light', range: '< 0.5 mm/h' },
    { color: '#eab308', label: 'Light Rain', range: '0.5-1 mm/h' },
    { color: '#f97316', label: 'Moderate', range: '1-3 mm/h' },
    { color: '#ef4444', label: 'Heavy Rain', range: '3-10 mm/h' },
    { color: '#dc2626', label: 'Very Heavy', range: '> 10 mm/h' }
  ];

  return (
    <Card className={`bg-black/80 backdrop-blur-sm border-gray-700 transition-all duration-300 ${
      isExpanded ? 'p-3 w-64' : 'p-2 w-32'
    } ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <CloudRain className="h-3 w-3 text-blue-400" />
          {isExpanded && <span className="text-xs font-semibold text-white">Weather</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-white/10"
          onClick={handleToggle}
        >
          {isExpanded ? 
            <ChevronDown className="h-3 w-3 text-white" /> : 
            <ChevronUp className="h-3 w-3 text-white" />
          }
        </Button>
      </div>
      
      {isExpanded && (
        <>
          <div className="space-y-1.5 mt-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-2 rounded border border-blue-400/50 bg-blue-500/30" />
              <span className="text-blue-200 text-xs">Precipitation</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-2 rounded border border-gray-400/50 bg-gray-500/30" />
              <span className="text-gray-200 text-xs">Clouds</span>
            </div>
          </div>
          
          <div className="border-t border-gray-600 pt-1.5 mb-1.5">
            <span className="text-xs font-semibold text-white">Route Colors:</span>
          </div>
          
          <div className="space-y-1">
            {legendItems.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                <div 
                  className="w-3 h-2 rounded border border-white/50 flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium min-w-0 flex-1 text-white text-xs">{item.label}</span>
                <span className="text-gray-300 text-xs">{item.range}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-1.5 pt-1.5 border-t border-gray-600">
            <div className="flex items-center gap-1 text-xs text-gray-300">
              <Droplets className="h-2 w-2" />
              <span className="text-xs">Route precipitation forecast</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default WeatherLegend;
