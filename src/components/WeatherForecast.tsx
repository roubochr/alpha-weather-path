import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Calendar, 
  Thermometer, 
  CloudRain, 
  Wind, 
  Eye,
  Clock
} from 'lucide-react';

interface WeatherForecastData {
  temperature: number;
  condition: string;
  description: string;
  precipitation: number;
  windSpeed: number;
  humidity: number;
  visibility: number;
  icon: string;
}

interface WeatherForecastProps {
  departureWeather?: WeatherForecastData;
  arrivalWeather?: WeatherForecastData;
  departureLocation?: string;
  arrivalLocation?: string;
  departureTime?: Date;
  arrivalTime?: Date;
}

const WeatherForecast: React.FC<WeatherForecastProps> = ({
  departureWeather,
  arrivalWeather,
  departureLocation = "Departure",
  arrivalLocation = "Destination", 
  departureTime,
  arrivalTime
}) => {
  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'clear': return '☀️';
      case 'clouds': return '☁️';
      case 'rain': return '🌧️';
      case 'drizzle': return '🌦️';
      case 'thunderstorm': return '⛈️';
      case 'snow': return '❄️';
      case 'mist':
      case 'fog': return '🌫️';
      default: return '🌤️';
    }
  };

  const WeatherCard = ({ 
    weather, 
    location, 
    time, 
    type 
  }: { 
    weather?: WeatherForecastData; 
    location: string; 
    time?: Date; 
    type: 'departure' | 'arrival';
  }) => {
    if (!weather) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <MapPin className={`h-4 w-4 ${type === 'departure' ? 'text-green-500' : 'text-red-500'}`} />
          <span className="font-medium text-sm">{location}</span>
          {time && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(time)}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getWeatherIcon(weather.condition)}</div>
          <div>
            <div className="font-semibold text-lg">{Math.round(weather.temperature)}°C</div>
            <div className="text-sm text-muted-foreground capitalize">{weather.description}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <CloudRain className="h-3 w-3 text-blue-500" />
            <span>{weather.precipitation.toFixed(1)}mm</span>
          </div>
          <div className="flex items-center space-x-1">
            <Wind className="h-3 w-3 text-gray-500" />
            <span>{Math.round(weather.windSpeed)}km/h</span>
          </div>
          <div className="flex items-center space-x-1">
            <Thermometer className="h-3 w-3 text-orange-500" />
            <span>{weather.humidity}%</span>
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="h-3 w-3 text-green-500" />
            <span>{Math.round(weather.visibility)}km</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-4 bg-card/95 backdrop-blur-sm border shadow-lg max-w-sm">
      <div className="text-sm font-medium mb-3 flex items-center">
        <Calendar className="h-4 w-4 mr-2" />
        Weather Forecast
      </div>
      
      <div className="space-y-4">
        {departureWeather && (
          <WeatherCard 
            weather={departureWeather}
            location={departureLocation}
            time={departureTime}
            type="departure"
          />
        )}
        
        {arrivalWeather && departureWeather && (
          <div className="border-t border-border pt-4">
            <WeatherCard 
              weather={arrivalWeather}
              location={arrivalLocation}
              time={arrivalTime}
              type="arrival"
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default WeatherForecast;