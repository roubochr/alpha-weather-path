import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CloudRain, MapPin, Route, AlertTriangle } from 'lucide-react';

interface WeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  condition: string;
  windSpeed: number;
}

interface RoutePoint {
  lng: number;
  lat: number;
  weather?: WeatherData;
  rainProbability?: number;
}

const WeatherMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [routeWeather, setRouteWeather] = useState<RoutePoint[]>([]);

  // Get current location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation([position.coords.longitude, position.coords.latitude]);
      },
      (error) => {
        console.error('Error getting location:', error);
        // Default to New York if geolocation fails
        setCurrentLocation([-74.006, 40.7128]);
      }
    );
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !currentLocation) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: currentLocation,
      zoom: 10,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add current location marker
    new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat(currentLocation)
      .addTo(map.current);

    // Add click handler for route planning
    map.current.on('click', (e) => {
      addRoutePoint(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, currentLocation]);

  const addRoutePoint = (lng: number, lat: number) => {
    const newPoint: RoutePoint = { lng, lat };
    setRoute(prev => [...prev, newPoint]);

    // Add marker to map
    if (map.current) {
      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([lng, lat])
        .addTo(map.current);
    }

    // Simulate weather data for the point
    simulateWeatherData(newPoint);
  };

  const simulateWeatherData = (point: RoutePoint) => {
    // Simulate weather API call
    const weatherData: WeatherData = {
      temperature: Math.floor(Math.random() * 30) + 10,
      humidity: Math.floor(Math.random() * 100),
      precipitation: Math.random() * 10,
      condition: ['Clear', 'Cloudy', 'Light Rain', 'Heavy Rain', 'Thunderstorm'][Math.floor(Math.random() * 5)],
      windSpeed: Math.floor(Math.random() * 20) + 5,
    };

    const rainProbability = weatherData.precipitation > 5 ? 
      Math.floor((weatherData.precipitation / 10) * 100) : 
      Math.floor(Math.random() * 30);

    const pointWithWeather = { ...point, weather: weatherData, rainProbability };
    setRouteWeather(prev => [...prev, pointWithWeather]);
  };

  const clearRoute = () => {
    setRoute([]);
    setRouteWeather([]);
    
    // Remove all markers except current location
    if (map.current && currentLocation) {
      // This is a simplified approach - in a real app you'd track markers
      map.current.remove();
      
      // Reinitialize map
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: currentLocation,
        zoom: 10,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(currentLocation)
        .addTo(map.current);

      map.current.on('click', (e) => {
        addRoutePoint(e.lngLat.lng, e.lngLat.lat);
      });
    }
  };

  const getWeatherColor = (condition: string) => {
    switch (condition) {
      case 'Clear': return 'bg-weather-clear';
      case 'Cloudy': return 'bg-weather-cloudy';
      case 'Light Rain': return 'bg-weather-rain';
      case 'Heavy Rain': return 'bg-weather-storm';
      case 'Thunderstorm': return 'bg-weather-danger';
      default: return 'bg-secondary';
    }
  };

  const getRainIcon = (probability: number) => {
    if (probability > 70) return <CloudRain className="h-4 w-4 text-weather-danger" />;
    if (probability > 40) return <CloudRain className="h-4 w-4 text-weather-warning" />;
    return <CloudRain className="h-4 w-4 text-weather-cloudy" />;
  };

  if (showTokenInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center mb-6">
            <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Weather Route Planner</h1>
            <p className="text-muted-foreground">Enter your Mapbox token to get started</p>
          </div>
          
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Mapbox Public Token"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <Button 
              onClick={() => setShowTokenInput(false)}
              disabled={!mapboxToken}
              className="w-full"
            >
              Initialize Map
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Get your free token at <a href="https://mapbox.com" className="text-primary hover:underline">mapbox.com</a>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CloudRain className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Weather Route Planner</h1>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={clearRoute}>
              <Route className="h-4 w-4 mr-2" />
              Clear Route
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* Route Info Overlay */}
          {route.length > 0 && (
            <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 max-w-xs">
              <div className="flex items-center space-x-2 mb-2">
                <Route className="h-4 w-4 text-primary" />
                <span className="font-semibold">Route Points: {route.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Click on map to add waypoints</p>
            </div>
          )}
        </div>

        {/* Weather Panel */}
        {routeWeather.length > 0 && (
          <div className="w-80 bg-card border-l border-border overflow-y-auto">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-weather-warning" />
                Route Weather Analysis
              </h2>
            </div>
            
            <div className="p-4 space-y-4">
              {routeWeather.map((point, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Waypoint {index + 1}</span>
                    <Badge variant="outline" className={getWeatherColor(point.weather?.condition || '')}>
                      {point.weather?.condition}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Temp:</span>
                      <span className="ml-1">{point.weather?.temperature}°C</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wind:</span>
                      <span className="ml-1">{point.weather?.windSpeed} km/h</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <div className="flex items-center space-x-1">
                      {getRainIcon(point.rainProbability || 0)}
                      <span className="text-sm">Rain Probability</span>
                    </div>
                    <span className="text-sm font-medium">{point.rainProbability}%</span>
                  </div>
                  
                  {(point.rainProbability || 0) > 60 && (
                    <div className="mt-2 p-2 bg-weather-warning/20 rounded text-xs">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      High rain probability at this location
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherMap;