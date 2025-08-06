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
import { useMockWeather } from '@/hooks/useMockWeather';
import { useRouting, RouteData } from '@/hooks/useRouting';
import { useTimeBasedWeather } from '@/hooks/useTimeBasedWeather';
import SecretForm from './SecretForm';
import AddressSearch from './AddressSearch';
import NavigationPanel from './NavigationPanel';
import TimeControls from './TimeControls';
import PrecipitationOverlay from './PrecipitationOverlay';


interface RoutePoint {
  lng: number;
  lat: number;
  weather?: WeatherData;
  rainProbability?: number;
  marker?: mapboxgl.Marker;
  arrivalTime?: Date;
}

interface RouteSegment {
  coordinates: [number, number][];
  rainIntensity: number;
  arrivalTime: Date;
}

const WeatherMap: React.FC = () => {
  console.log('WeatherMap component rendering...');
  
  const handleTokenSubmit = (token: string) => {
    if (token && !token.startsWith('http')) {
      localStorage.setItem('mapbox-token', token);
      setMapboxToken(token);
      setShowTokenInput(false);
    } else {
      alert('Please enter a valid Mapbox token (not a URL)');
    }
  };
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState(() => {
    const stored = localStorage.getItem('mapbox-token');
    return stored || '';
  });
  const [showTokenInput, setShowTokenInput] = useState(() => {
    const stored = localStorage.getItem('mapbox-token');
    return !stored;
  });
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [routeWeather, setRouteWeather] = useState<RoutePoint[]>([]);
  const [showWeatherLayer, setShowWeatherLayer] = useState(false);
  const [weatherMarkers, setWeatherMarkers] = useState<mapboxgl.Marker[]>([]);
  const [hasWeatherAPI, setHasWeatherAPI] = useState(true); // Always enable weather features
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [isAnimating, setIsAnimating] = useState(false);
  const [departureTime, setDepartureTime] = useState(() => new Date());
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const { getWeatherData, loading } = useWeatherAPI();
  const { getMockWeatherData } = useMockWeather();
  const { getRoute, loading: routeLoading } = useRouting(mapboxToken);
  const { getTimeBasedWeather, calculateArrivalWeather } = useTimeBasedWeather();

  // Enhanced GPS tracking for mobile devices
  useEffect(() => {
    console.log('Setting up mobile GPS tracking...');
    
    // Set default location immediately to allow map to initialize
    if (!currentLocation) {
      console.log('Setting default location (New York)');
      setCurrentLocation([-74.006, 40.7128]);
    }
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
      console.log('Geolocation not supported, keeping default location');
      return;
    }

    // Options optimized for mobile devices
    const options = {
      enableHighAccuracy: true,
      timeout: 15000, // Longer timeout for mobile
      maximumAge: 60000 // 1 minute cache for mobile efficiency
    };

    // For mobile Safari, request permission explicitly
    const requestLocation = async () => {
      try {
        // Try to get permission first (for newer browsers)
        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          console.log('Geolocation permission:', permission.state);
        }

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log('GPS position updated:', position.coords);
            const newLocation: [number, number] = [
              position.coords.longitude, 
              position.coords.latitude
            ];
            setUserLocation(newLocation);
            
            // Set initial location if not set
            if (!currentLocation) {
              setCurrentLocation(newLocation);
            }
            
            // Update user location marker on map
            if (map.current) {
              // Remove existing user location marker
              const existingMarkers = document.querySelectorAll('[data-user-location="true"]');
              existingMarkers.forEach(marker => marker.remove());
              
              // Add new user location marker with mobile-friendly styling
              const markerElement = document.createElement('div');
              markerElement.setAttribute('data-user-location', 'true');
              markerElement.className = 'w-6 h-6 bg-green-500 rounded-full border-4 border-white shadow-lg pulse';
              markerElement.style.cssText = `
                animation: pulse 2s infinite;
                transform: translate(-50%, -50%);
                position: relative;
              `;
              
              new mapboxgl.Marker({ 
                element: markerElement,
                anchor: 'center'
              })
                .setLngLat(newLocation)
                .addTo(map.current);
            }
          },
          (error) => {
            console.error('GPS tracking error:', error.message);
            // More specific error handling for mobile
            switch(error.code) {
              case error.PERMISSION_DENIED:
                console.log('Location permission denied by user');
                break;
              case error.POSITION_UNAVAILABLE:
                console.log('Location information unavailable');
                break;
              case error.TIMEOUT:
                console.log('Location request timeout');
                break;
            }
            
            // Fallback to one-time location request
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const fallbackLocation: [number, number] = [
                  position.coords.longitude, 
                  position.coords.latitude
                ];
                setCurrentLocation(fallbackLocation);
                setUserLocation(fallbackLocation);
              },
              () => {
                console.log('Using default location (New York)');
                setCurrentLocation([-74.006, 40.7128]);
              },
              options
            );
          },
          options
        );

        return () => {
          if (watchId !== undefined) {
            navigator.geolocation.clearWatch(watchId);
          }
        };
      } catch (error) {
        console.error('Error requesting location permission:', error);
        setCurrentLocation([-74.006, 40.7128]);
      }
    };

    const cleanup = requestLocation();
    return () => {
      if (cleanup instanceof Promise) {
        cleanup.then(cleanupFn => cleanupFn && cleanupFn());
      }
    };
  }, [currentLocation]);

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
      // Safari iOS compatibility settings with mobile optimizations
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: currentLocation,
        zoom: 10,
        preserveDrawingBuffer: true, // Better Safari compatibility
        antialias: false, // Reduce memory usage on mobile
        crossSourceCollisions: false, // Improve performance
        touchZoomRotate: true, // Enable touch controls
        touchPitch: true, // Enable touch pitch
        dragRotate: true, // Enable drag rotation
        doubleClickZoom: true, // Enable double tap zoom
        keyboard: false, // Disable keyboard for mobile
        scrollZoom: true // Enable scroll zoom
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
    // Round coordinates for consistency
    const roundedLng = Math.round(lng * 10000) / 10000;
    const roundedLat = Math.round(lat * 10000) / 10000;
    
    console.log('Adding route point:', { lng: roundedLng, lat: roundedLat });
    
    // Add marker to map
    let marker: mapboxgl.Marker | undefined;
    if (map.current) {
      marker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([roundedLng, roundedLat])
        .addTo(map.current);
    }

    const newPoint: RoutePoint = { lng: roundedLng, lat: roundedLat, marker };
    setRoute(prev => [...prev, newPoint]);

    // Get weather data (real or mock)
    console.log('Fetching weather data for point...');
    const hasAPIKey = !!localStorage.getItem('openweather-api-key');
    const weatherData = hasAPIKey 
      ? await getWeatherData(roundedLat, roundedLng)
      : await getMockWeatherData(roundedLat, roundedLng);
    console.log('Weather data received:', weatherData);
    
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
      
      // Add weather overlay popup to the marker
      if (marker && map.current) {
        const popupElement = document.createElement('div');
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setLngLat([roundedLng, roundedLat])
          .setDOMContent(popupElement);
        
        // Create a simple weather display for the popup
        popupElement.innerHTML = `
          <div class="p-2 text-sm">
            <div class="font-semibold">${weatherData.current.temperature}°C</div>
            <div class="text-xs">${weatherData.current.condition}</div>
            <div class="text-xs">Humidity: ${weatherData.current.humidity}%</div>
          </div>
        `;
        
        marker.setPopup(popup);
      }
    }
  }, [getWeatherData]);

  const getRainColor = (rainIntensity: number): string => {
    if (rainIntensity > 70) return '#dc2626'; // Red for heavy rain
    if (rainIntensity > 40) return '#f59e0b'; // Amber for moderate rain
    if (rainIntensity > 20) return '#3b82f6'; // Blue for light rain
    return '#10b981'; // Green for no rain
  };

  // Simplified weather layer management
  const addWeatherLayer = useCallback(async () => {
    if (!map.current || !showWeatherLayer) return;

    console.log('Adding mock weather layer...');
    
    try {
      // Remove existing layers first
      if (map.current.getLayer('precipitation-layer')) {
        map.current.removeLayer('precipitation-layer');
      }
      if (map.current.getSource('precipitation')) {
        map.current.removeSource('precipitation');
      }

      // Add a simple mock precipitation layer using a color overlay
      map.current.addSource('precipitation', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { intensity: 0.3 },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-180, -85],
                  [180, -85],
                  [180, 85],
                  [-180, 85],
                  [-180, -85]
                ]]
              }
            }
          ]
        }
      });

      map.current.addLayer({
        id: 'precipitation-layer',
        type: 'fill',
        source: 'precipitation',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.2
        }
      });
      
      console.log('Mock weather layer added successfully');
    } catch (error) {
      console.error('Error adding weather layer:', error);
    }
  }, [showWeatherLayer]);

  const removeWeatherLayer = useCallback(() => {
    if (!map.current) return;
    
    console.log('Removing weather layer...');
    try {
      if (map.current.getLayer('precipitation-layer')) {
        map.current.removeLayer('precipitation-layer');
      }
      if (map.current.getSource('precipitation')) {
        map.current.removeSource('precipitation');
      }
      console.log('Weather layer removed successfully');
    } catch (error) {
      console.error('Error removing weather layer:', error);
    }
  }, []);

  // Toggle weather layer when switch changes
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
    
    // Remove route from map
    if (map.current) {
      try {
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
        }
        if (map.current.getSource('route')) {
          map.current.removeSource('route');
        }
      } catch (error) {
        console.warn('Could not remove route from map');
      }
    }
    
    setRoute([]);
    setRouteWeather([]);
    setCurrentRoute(null);
    setRouteSegments([]);
  }, [route, weatherMarkers]);

  const planOptimalRoute = useCallback(async () => {
    if (route.length < 2) return;

    console.log('Planning route for points:', route);
    const coordinates = route.map(point => [point.lng, point.lat] as [number, number]);
    
    const routeData = await getRoute(coordinates);
    if (routeData && map.current) {
      setCurrentRoute(routeData);
      
      // Remove existing route layers
      try {
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
        }
        if (map.current.getSource('route')) {
          map.current.removeSource('route');
        }
      } catch (error) {
        console.warn('Could not remove existing route layer');
      }

      // Add basic route first (always visible)
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeData.geometry.coordinates
          }
        }
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
          'line-width': 6,
          'line-opacity': 0.8
        }
      });

      // Fit map to route bounds
      const coordinates_flat = routeData.geometry.coordinates;
      const bounds = coordinates_flat.reduce((bounds, coord) => {
        return bounds.extend(coord as [number, number]);
      }, new mapboxgl.LngLatBounds(coordinates_flat[0], coordinates_flat[0]));
      
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [route, getRoute]);

  const startNavigation = useCallback(() => {
    if (currentRoute) {
      setIsNavigating(true);
      setCurrentStep(0);
    }
  }, [currentRoute]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setCurrentStep(0);
  }, []);

  const handleLocationSelect = useCallback(async (lng: number, lat: number, placeName: string) => {
    console.log('Location selected:', { lng, lat, placeName });
    await addRoutePoint(lng, lat);
    
    // Center map on selected location
    if (map.current) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1000
      });
    }
  }, [addRoutePoint]);

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

  console.log('Rendering state:', { hasWeatherAPI, showTokenInput, mapboxToken });
  console.log('Route state:', { routeLength: route.length, currentRoute: !!currentRoute });
  
  if (!hasWeatherAPI) {
    console.log('Showing SecretForm...');
    return <SecretForm onApiKeySet={() => setHasWeatherAPI(true)} />;
  }

  if (showTokenInput) {
    console.log('Showing token input...');
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
              onClick={() => handleTokenSubmit(mapboxToken)}
              disabled={!mapboxToken}
              className="w-full"
            >
              Initialize Map
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">
              <strong>How to get your Mapbox token:</strong>
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://mapbox.com" target="_blank" className="text-primary hover:underline">mapbox.com</a></li>
              <li>Sign up for a free account</li>
              <li>Go to Account → Access tokens</li>
              <li>Copy your "Default public token"</li>
            </ol>
          </div>
        </Card>
      </div>
    );
  }

  console.log('Rendering main weather map interface...');
  console.log('AddressSearch props:', { mapboxToken: mapboxToken ? 'present' : 'missing' });

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with Address Search */}
      <div className="bg-card border-b border-border p-4 space-y-4">
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
                <span>Weather</span>
              </Label>
            </div>
            <div className="flex space-x-2">
              {route.length >= 2 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={planOptimalRoute}
                  disabled={routeLoading}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {routeLoading ? 'Planning...' : 'Plan Route'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={clearRoute}>
                <Route className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>
        
        {/* Address Search Bar and Time Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AddressSearch 
              onLocationSelect={handleLocationSelect}
              onStartNavigation={startNavigation}
              mapboxToken={mapboxToken}
            />
          </div>
          <div>
            <TimeControls
              currentHour={currentHour}
              isAnimating={isAnimating}
              onHourChange={setCurrentHour}
              onToggleAnimation={() => setIsAnimating(!isAnimating)}
              departureTime={departureTime}
              onDepartureTimeChange={setDepartureTime}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Map */}
        <div className="flex-1 relative touch-none">
          <div 
            ref={mapContainer} 
            className="absolute inset-0 mapbox-map"
            style={{ 
              touchAction: 'pan-x pan-y',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          />
          
          {/* Route Info Overlay */}
          {route.length > 0 && (
            <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 max-w-xs">
              <div className="flex items-center space-x-2 mb-2">
                <Route className="h-4 w-4 text-primary" />
                <span className="font-semibold">Route Points: {route.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Click on map to add waypoints</p>
              {currentRoute && (
                <div className="mt-2 text-xs">
                  <div>Distance: {(currentRoute.distance / 1000).toFixed(1)} km</div>
                  <div>Duration: {Math.round(currentRoute.duration / 60)} min</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Panel */}
        {currentRoute && (
          <NavigationPanel
            route={currentRoute}
            currentStep={currentStep}
            isNavigating={isNavigating}
            onStartNavigation={startNavigation}
            onStopNavigation={stopNavigation}
          />
        )}

        {/* Weather Panel */}
        {!currentRoute && routeWeather.length > 0 && (
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