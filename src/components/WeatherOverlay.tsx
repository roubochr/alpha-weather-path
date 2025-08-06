import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CloudRain, 
  Thermometer, 
  Wind, 
  Eye, 
  Gauge, 
  Droplets 
} from 'lucide-react';
import { WeatherData } from '@/hooks/useWeatherAPI';

interface WeatherOverlayProps {
  weather: WeatherData;
  position: { lat: number; lng: number };
}

const WeatherOverlay: React.FC<WeatherOverlayProps> = ({ weather, position }) => {
  const getWeatherColor = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'clear': return 'bg-yellow-500/20 border-yellow-500/50';
      case 'clouds': return 'bg-gray-500/20 border-gray-500/50';
      case 'rain': return 'bg-blue-500/20 border-blue-500/50';
      case 'drizzle': return 'bg-blue-400/20 border-blue-400/50';
      case 'thunderstorm': return 'bg-purple-600/20 border-purple-600/50';
      case 'snow': return 'bg-white/20 border-white/50';
      case 'mist':
      case 'fog': return 'bg-gray-400/20 border-gray-400/50';
      default: return 'bg-secondary/20 border-border';
    }
  };

  return (
    <Card className={`p-3 max-w-xs backdrop-blur-sm bg-card/95 ${getWeatherColor(weather.condition)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <img 
            src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
            alt={weather.description}
            className="w-8 h-8"
          />
          <div>
            <div className="font-semibold text-lg">{weather.temperature}°C</div>
            <Badge variant="outline" className="text-xs">
              {weather.condition}
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center space-x-1">
          <Droplets className="h-3 w-3 text-blue-500" />
          <span>{weather.humidity}%</span>
        </div>
        <div className="flex items-center space-x-1">
          <Wind className="h-3 w-3 text-gray-500" />
          <span>{weather.windSpeed} km/h</span>
        </div>
        <div className="flex items-center space-x-1">
          <Gauge className="h-3 w-3 text-orange-500" />
          <span>{weather.pressure} hPa</span>
        </div>
        <div className="flex items-center space-x-1">
          <Eye className="h-3 w-3 text-green-500" />
          <span>{weather.visibility} km</span>
        </div>
      </div>
      
      {weather.precipitation > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center space-x-1 text-xs">
            <CloudRain className="h-3 w-3 text-blue-600" />
            <span>Precipitation: {weather.precipitation}mm</span>
          </div>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground mt-1 capitalize">
        {weather.description}
      </div>
    </Card>
  );
};

export default WeatherOverlay;