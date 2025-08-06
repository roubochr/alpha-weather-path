import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CloudRain, MapPin, Route, AlertTriangle, Layers, Navigation } from 'lucide-react';
import { useWeatherAPI, WeatherData } from '@/hooks/useWeatherAPI';
import SecretForm from './SecretForm';


interface RoutePoint {
  lng: number;
  lat: number;
  weather?: WeatherData;
  rainProbability?: number;
  marker?: mapboxgl.Marker;
}

const WeatherMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState(() => {
    // Persist token in localStorage for Safari iOS
    return localStorage.getItem('mapbox-token') || '';
  });
  const [showTokenInput, setShowTokenInput] = useState(() => {
    // Only show input if no token is stored
    return !localStorage.getItem('mapbox-token');
  });
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [routeWeather, setRouteWeather] = useState<RoutePoint[]>([]);
  const [showWeatherLayer, setShowWeatherLayer] = useState(false);
  const [weatherMarkers, setWeatherMarkers] = useState<mapboxgl.Marker[]>([]);
  const [hasWeatherAPI, setHasWeatherAPI] = useState(() => {
    return !!localStorage.getItem('openweather-api-key');
  });
  const { getWeatherData, loading } = useWeatherAPI();

  // Get current location with Safari iOS compatibility
  useEffect(() => {
    console.log('Attempting to get current location...');
    
    // For Safari iOS, use a more conservative approach
    if ('geolocation' in navigator) {
      const options = {
        enableHighAccuracy: false, // Less demanding for Safari iOS
        timeout: 5000, // Shorter timeout
        maximumAge: 300000 // 5 minutes cache
      };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location obtained:', position.coords);
          setCurrentLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.error('Geolocation error:', error.message);
          console.log('Using default location (New York)');
          // Default to New York if geolocation fails
          setCurrentLocation([-74.006, 40.7128]);
        },
        options
      );
    } else {
      console.log('Geolocation not supported, using default location');
      setCurrentLocation([-74.006, 40.7128]);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    console.log('Map initialization check:', { 
      hasContainer: !!mapContainer.current, 
      hasToken: !!mapboxToken, 
      hasLocation: !!currentLocation 
    });
    
    if (!mapContainer.current || !mapboxToken || !currentLocation) {
      console.log('Map initialization skipped - missing requirements');
      return;
    }

    console.log('Initializing map with token and location:', { mapboxToken: mapboxToken.substring(0, 10) + '...', currentLocation });
    
    mapboxgl.accessToken = mapboxToken;

    try {
      // Safari iOS compatibility settings
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: currentLocation,
        zoom: 10,
        preserveDrawingBuffer: true, // Better Safari compatibility
        antialias: false, // Reduce memory usage on mobile
        crossSourceCollisions: false // Improve performance
      });

      console.log('Map created successfully');
      
      // Wait for map to be fully loaded before adding controls
      map.current.on('load', () => {
        console.log('Map loaded successfully');
        
        // Add navigation controls after map loads
        if (map.current) {
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
          
          // Add current location marker
          new mapboxgl.Marker({ color: '#3b82f6' })
            .setLngLat(currentLocation)
            .addTo(map.current);
            
          // Add click handler for route planning
          map.current.on('click', (e) => {
            addRoutePoint(e.lngLat.lng, e.lngLat.lat);
          });
        }
      });

      // Handle map style loading errors
      map.current.on('error', (e) => {
        console.error('Map error:', e.error);
        if (e.error.message.includes('401')) {
          console.error('Invalid Mapbox token - please check your token');
          alert('Invalid Mapbox token. Please check your token and try again.');
          // Clear the invalid token
          localStorage.removeItem('mapbox-token');
          setShowTokenInput(true);
        }
      });
      
    } catch (error) {
      console.error('Error creating map:', error);
      return;
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, currentLocation]);

  const addRoutePoint = useCallback(async (lng: number, lat: number) => {
    // Add marker to map
    let marker: mapboxgl.Marker | undefined;
    if (map.current) {
      marker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([lng, lat])
        .addTo(map.current);
    }

    const newPoint: RoutePoint = { lng, lat, marker };
    setRoute(prev => [...prev, newPoint]);

    // Get real weather data for the point
    const weatherData = await getWeatherData(lat, lng);
    if (weatherData) {
      const rainProbability = Math.min(
        Math.round((weatherData.current.precipitation + weatherData.current.humidity / 2) / 2),
        100
      );
      
      const pointWithWeather = { 
        ...newPoint, 
        weather: weatherData.current, 
        rainProbability 
      };
      setRouteWeather(prev => [...prev, pointWithWeather]);
    }
  }, [getWeatherData]);

  const addWeatherLayer = useCallback(async () => {
    if (!map.current || !showWeatherLayer) return;

    const apiKey = localStorage.getItem('openweather-api-key');
    if (!apiKey) return;

    // Add precipitation layer
    try {
      if (!map.current.getSource('precipitation')) {
        map.current.addSource('precipitation', {
          type: 'raster',
          tiles: [
            `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`
          ],
          tileSize: 256
        });

        map.current.addLayer({
          id: 'precipitation-layer',
          type: 'raster',
          source: 'precipitation',
          paint: {
            'raster-opacity': 0.6
          }
        });
      }
    } catch (error) {
      console.error('Error adding weather layer:', error);
    }
  }, [showWeatherLayer]);

  const removeWeatherLayer = useCallback(() => {
    if (!map.current) return;
    
    try {
      if (map.current.getLayer('precipitation-layer')) {
        map.current.removeLayer('precipitation-layer');
      }
      if (map.current.getSource('precipitation')) {
        map.current.removeSource('precipitation');
      }
    } catch (error) {
      console.error('Error removing weather layer:', error);
    }
  }, []);

  useEffect(() => {
    if (showWeatherLayer) {
      addWeatherLayer();
    } else {
      removeWeatherLayer();
    }
  }, [showWeatherLayer, addWeatherLayer, removeWeatherLayer]);

  const clearRoute = useCallback(() => {
    // Remove all route markers
    route.forEach(point => {
      if (point.marker) {
        point.marker.remove();
      }
    });
    
    // Clear weather markers
    weatherMarkers.forEach(marker => marker.remove());
    setWeatherMarkers([]);
    
    setRoute([]);
    setRouteWeather([]);
  }, [route, weatherMarkers]);

  const planOptimalRoute = useCallback(async () => {
    if (route.length < 2) return;

    // Create a route line on the map
    if (map.current) {
      const coordinates = route.map(point => [point.lng, point.lat]);
      
      const geojson = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates
        }
      };

      if (map.current.getSource('route')) {
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(geojson);
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: geojson
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 4
          }
        });
      }
    }
  }, [route]);

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

  if (!hasWeatherAPI) {
    return <SecretForm onApiKeySet={() => setHasWeatherAPI(true)} />;
  }

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
              onClick={() => {
                // Save token to localStorage for persistence
                localStorage.setItem('mapbox-token', mapboxToken);
                setShowTokenInput(false);
              }}
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="weather-layer"
                checked={showWeatherLayer}
                onCheckedChange={setShowWeatherLayer}
              />
              <Label htmlFor="weather-layer" className="flex items-center space-x-1">
                <Layers className="h-4 w-4" />
                <span>Weather Layer</span>
              </Label>
            </div>
            <div className="flex space-x-2">
              {route.length >= 2 && (
                <Button variant="outline" size="sm" onClick={planOptimalRoute}>
                  <Navigation className="h-4 w-4 mr-2" />
                  Plan Route
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={clearRoute}>
                <Route className="h-4 w-4 mr-2" />
                Clear Route
              </Button>
            </div>
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