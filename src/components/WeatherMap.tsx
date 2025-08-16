import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudRain, Sun, AlertTriangle, MapPin, Wind, Droplets, Eye, Thermometer, ChevronLeft, ChevronRight } from 'lucide-react';
import AddressSearch from '@/components/AddressSearch';
import { useRouting, RouteData } from '@/hooks/useRouting';
import { useTomorrowWeather, TomorrowWeatherResponse, TomorrowForecastData } from '@/hooks/useTomorrowWeather';
import { useToast } from '@/hooks/use-toast';
import WeatherTimeline from '@/components/WeatherTimeline';
import TomorrowRadarOverlay from '@/components/TomorrowRadarOverlay';
import WeatherLegend from '@/components/WeatherLegend';
import OverlayControls from '@/components/OverlayControls';
import WeatherForecast from '@/components/WeatherForecast';
import LocationDialog from '@/components/LocationDialog';
import MinimizableUI from '@/components/MinimizableUI';
import RouteWarningDialog from '@/components/RouteWarningDialog';
import TravelRecommendations from '@/components/TravelRecommendations';
import { useTravelRecommendations, TravelRecommendation } from '@/hooks/useTravelRecommendations';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';

// Define types for our route and weather system
interface RoutePoint {
  lat: number;
  lng: number;
  name?: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  precipitation: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  visibility: number;
}

const WeatherMap = () => {
  console.log('WeatherMap component rendering...');
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  // Core state
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [preserveMapPosition, setPreserveMapPosition] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(10);
  
  // Route and navigation state
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentNavigationStep, setCurrentNavigationStep] = useState(0);
  
  // Weather and time state
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());
  const [isAnimating, setIsAnimating] = useState(false);
  const [departureTime, setDepartureTime] = useState(new Date());
  
  // UI state
  const [isUIMinimized, setIsUIMinimized] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{lng: number, lat: number} | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showRouteInfo, setShowRouteInfo] = useState(true);
  const [routeInfoTimer, setRouteInfoTimer] = useState<NodeJS.Timeout | null>(null);
  const [showTravelRecommendations, setShowTravelRecommendations] = useState(true);
  
  // Overlay control state
  const [showPrecipitation, setShowPrecipitation] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  
  // State for opacity
  const [precipitationOpacity, setPrecipitationOpacity] = useState(0.7);
  const [cloudOpacity, setCloudOpacity] = useState(0.4);
  
  // Tomorrow.io weather state
  const [weatherData, setWeatherData] = useState<TomorrowWeatherResponse | null>(null);
  const [routeWeatherData, setRouteWeatherData] = useState<{ [coordinate: string]: TomorrowForecastData[] }>({});
  
  // Travel recommendations state
  const [travelRecommendation, setTravelRecommendation] = useState<TravelRecommendation | null>(null);

  // Route weather analysis
  const [routeWeather, setRouteWeather] = useState<Array<{
    lat: number;
    lng: number;
    weather?: WeatherData;
    rainProbability?: number;
  }>>([]);
  const [showRouteWarning, setShowRouteWarning] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<RoutePoint[] | null>(null);
  const [pendingRouteDuration, setPendingRouteDuration] = useState<number>(0);

  const { toast } = useToast();
  const { getRoute, loading: routeLoading, error: routeError } = useRouting(mapboxToken);
  const { getWeatherData, getWeatherForRoute, clearCache, loading: weatherLoading, error: weatherError } = useTomorrowWeather();
  const { generateRecommendation, loading: recommendationLoading } = useTravelRecommendations();

  // Auto-hide route info after 5 seconds when points are added
  useEffect(() => {
    if (routePoints.length > 0) {
      setShowRouteInfo(true);
      
      // Clear existing timer
      if (routeInfoTimer) {
        clearTimeout(routeInfoTimer);
      }
      
      // Set new timer for 5 seconds
      const timer = setTimeout(() => {
        setShowRouteInfo(false);
      }, 5000);
      
      setRouteInfoTimer(timer);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (routeInfoTimer) {
        clearTimeout(routeInfoTimer);
      }
    };
  }, [routePoints.length]);

  // Show route info when points are cleared
  useEffect(() => {
    if (routePoints.length === 0) {
      setShowRouteInfo(false);
      if (routeInfoTimer) {
        clearTimeout(routeInfoTimer);
        setRouteInfoTimer(null);
      }
    }
  }, [routePoints.length]);

  console.log('Rendering state:', {
    showTokenInput,
    mapboxToken: mapboxToken ? 'present' : 'missing',
    weatherDataAvailable: !!weatherData
  });

  console.log('Route state:', {
    routeLength: routePoints.length,
    currentRoute: !!currentRoute
  });

  // Get precipitation color based on intensity with enhanced vibrancy
  const getPrecipitationColor = useCallback((precipitation: number): string => {
    if (precipitation === 0) return '#10b981'; // Emerald - no rain
    if (precipitation < 0.1) return '#22c55e'; // Green - very light rain
    if (precipitation < 0.5) return '#84cc16'; // Lime - light rain
    if (precipitation < 1) return '#f59e0b'; // Amber - moderate rain  
    if (precipitation < 3) return '#f97316'; // Orange - heavy rain
    if (precipitation < 10) return '#ef4444'; // Red - very heavy rain
    return '#dc2626'; // Dark red - extreme rain
  }, []);

  // Enhanced geolocation setup with user location as default
  const setupUserLocation = useCallback((forceRequest = false) => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported, using fallback location');
      if (!currentLocation) {
        setCurrentLocation([-74.006, 40.7128]); // New York fallback
      }
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: forceRequest ? 0 : 300000 // Force fresh location if requested
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc: [number, number] = [
          position.coords.longitude,
          position.coords.latitude
        ];
        console.log('User location obtained:', userLoc);
        setUserLocation(userLoc);
        if (!currentLocation && !preserveMapPosition) {
          setCurrentLocation(userLoc);
        }
        // If forcing request, update current location and center map
        if (forceRequest) {
          setCurrentLocation(userLoc);
          if (map.current) {
            map.current.flyTo({
              center: userLoc,
              zoom: 12,
              duration: 1500
            });
          }
        }
      },
      (error) => {
        console.log('Geolocation error:', error);
        if (!currentLocation || forceRequest) {
          toast({
            title: "Location Access Denied",
            description: "Please allow location access or search for a location manually.",
            variant: "destructive"
          });
        }
        if (!currentLocation) {
          setCurrentLocation([-74.006, 40.7128]); // New York fallback
        }
      },
      options
    );
  }, [currentLocation, preserveMapPosition, map, toast]);

  const visualizeWeatherRoute = useCallback(async (routeData: RouteData, departureTime: Date) => {
    if (!map.current) return;

    console.log('Updating route with Tomorrow.io weather data...');
    
    // Get weather data for the route
    const routeWeather = await getWeatherForRoute(
      routeData.geometry.coordinates as [number, number][],
      departureTime,
      routeData.duration
    );
    
    // Convert the data format to match our state structure
    const convertedRouteWeather: { [coordinate: string]: TomorrowForecastData[] } = {};
    Object.entries(routeWeather).forEach(([coordKey, weatherResponse]) => {
      convertedRouteWeather[coordKey] = weatherResponse.hourly || [];
    });
    
    setRouteWeatherData(convertedRouteWeather);

    // Create simple route visualization
    const coordinates = routeData.geometry.coordinates;

    // Remove existing route layers
    ['route-line', 'route-line-glow'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add simple route line
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    // Add route line with default styling
    map.current.addLayer({
      id: 'route-line',
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

    console.log('Route visualization updated');
  }, [getWeatherForRoute]);

  const generateRoute = useCallback(async (routePoints: RoutePoint[], skipWarning: boolean = false) => {
    if (routePoints.length < 2 || !mapboxToken) return;

    const coordinates: [number, number][] = routePoints.map(point => [point.lng, point.lat]);
    
    // Get route from Mapbox
    const routeData = await getRoute(coordinates);
    if (!routeData) return;

    // Check if route is longer than 2 hours
    const routeDurationHours = routeData.duration / 3600;
    
    if (routeDurationHours > 2 && !skipWarning) {
      setShowRouteWarning(true);
      setPendingRoute(routePoints);
      setPendingRouteDuration(routeData.duration);
      return;
    }

    setCurrentRoute(routeData);
    
    // Visualize route with weather
    await visualizeWeatherRoute(routeData, departureTime);

    // Fit map to show the entire route
    if (map.current && routeData.geometry.coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      routeData.geometry.coordinates.forEach((coord: [number, number]) => {
        bounds.extend(coord);
      });
      
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15
      });
    }

    console.log('Route generated successfully:', routeData);
  }, [mapboxToken, getRoute, departureTime, visualizeWeatherRoute]);

  // Clear route function
  const clearRoute = useCallback(() => {
    if (!map.current) return;

    // Remove route layers
    ['route-line', 'route-line-glow'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Clear route markers
    const routeMarkers = document.querySelectorAll('[data-route-marker="true"]');
    routeMarkers.forEach(marker => marker.remove());

    // Reset route state
    setRoutePoints([]);
    setCurrentRoute(null);
    setRouteWeatherData({});
    setTravelRecommendation(null);
    
    console.log('Route cleared');
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const savedToken = localStorage.getItem('mapbox-token');
    if (savedToken) {
      setMapboxToken(savedToken);
      mapboxgl.accessToken = savedToken;
    } else {
      setShowTokenInput(true);
      return;
    }

    // Get user location first
    setupUserLocation();

    const initializeMap = () => {
      if (!mapContainer.current) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: currentLocation || [-74.006, 40.7128],
        zoom: currentLocation ? 12 : 8,
        projection: 'globe' as any
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add atmosphere and fog effects
      map.current.on('style.load', () => {
        if (!map.current) return;
        
        map.current.setFog({
          color: 'rgb(30, 30, 50)',
          'high-color': 'rgb(50, 50, 80)',
          'horizon-blend': 0.1,
        });
      });

      // Handle map clicks for adding route points
      map.current.on('click', (e) => {
        setClickedLocation({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        setShowLocationDialog(true);
      });

      console.log('Map initialized successfully');
    };

    if (currentLocation) {
      initializeMap();
    } else {
      // Wait for location then initialize
      const locationInterval = setInterval(() => {
        if (currentLocation) {
          clearInterval(locationInterval);
          initializeMap();
        }
      }, 100);

      // Fallback: initialize without location after 3 seconds
      setTimeout(() => {
        clearInterval(locationInterval);
        if (!map.current) {
          initializeMap();
        }
      }, 3000);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [currentLocation, mapboxToken, setupUserLocation]);

  // Load current weather when location changes
  useEffect(() => {
    if (currentLocation && !weatherData) {
      getWeatherData(currentLocation[1], currentLocation[0])
        .then(data => {
          if (data) {
            setWeatherData(data);
          }
        })
        .catch(err => {
          console.error('Failed to load weather data:', err);
        });
    }
  }, [currentLocation, getWeatherData, weatherData]);

  // Handle map token input
  const handleTokenSubmit = useCallback((token: string) => {
    mapboxgl.accessToken = token;
    localStorage.setItem('mapbox-token', token);
    setMapboxToken(token);
    setShowTokenInput(false);
    window.location.reload(); // Reload to reinitialize map
  }, []);

  const handleLocationAdd = useCallback((name: string) => {
    if (!clickedLocation) return;

    const newPoint: RoutePoint = {
      lat: clickedLocation.lat,
      lng: clickedLocation.lng,
      name: name || `Point ${routePoints.length + 1}`
    };

    const newRoutePoints = [...routePoints, newPoint];
    setRoutePoints(newRoutePoints);

    // Auto-generate route when we have 2+ points
    if (newRoutePoints.length >= 2) {
      generateRoute(newRoutePoints);
    }

    setShowLocationDialog(false);
    setClickedLocation(null);
  }, [clickedLocation, routePoints, generateRoute]);

  if (showTokenInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-6 w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4">Mapbox Token Required</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please enter your Mapbox access token to use the map.
          </p>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter Mapbox token..."
              className="w-full p-2 border rounded"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleTokenSubmit((e.target as HTMLInputElement).value);
                }
              }}
            />
            <Button
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement;
                if (input?.value) {
                  handleTokenSubmit(input.value);
                }
              }}
              className="w-full"
            >
              Save Token
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Tomorrow.io Radar Overlay */}
      {map.current && (
        <TomorrowRadarOverlay
          map={map.current}
          isVisible={showPrecipitation}
          currentTime={currentTimestamp}
          isAnimating={isAnimating}
          routeWeatherData={routeWeatherData}
          onTimeChange={setCurrentTimestamp}
        />
      )}
      
      {/* UI Components */}
      <div className="absolute top-4 left-4 w-80 max-w-sm space-y-4 z-10">
        {/* Address Search */}
        <AddressSearch
          onLocationSelect={(lng: number, lat: number, placeName: string) => {
            setCurrentLocation([lng, lat]);
            if (map.current) {
              map.current.flyTo({
                center: [lng, lat],
                zoom: 12,
                duration: 1500
              });
            }
          }}
          onStartNavigation={() => {}}
          mapboxToken={mapboxToken}
        />

        {/* Weather Timeline Controls */}
        <WeatherTimeline
          currentTime={currentTimestamp}
          isAnimating={isAnimating}
          onTimeChange={setCurrentTimestamp}
          onToggleAnimation={() => setIsAnimating(!isAnimating)}
          forecastData={weatherData?.hourly || []}
          routeWeatherData={routeWeatherData}
          routeCoordinates={currentRoute?.geometry.coordinates as [number, number][]}
          onRouteWeatherUpdate={async () => {
            if (currentRoute) {
              await visualizeWeatherRoute(currentRoute, departureTime);
            }
          }}
        />

        {/* Overlay Controls */}
        <OverlayControls
          showPrecipitation={showPrecipitation}
          showClouds={showClouds}
          precipitationOpacity={precipitationOpacity}
          cloudOpacity={cloudOpacity}
          onTogglePrecipitation={setShowPrecipitation}
          onToggleClouds={setShowClouds}
          onPrecipitationOpacityChange={(value) => setPrecipitationOpacity(value)}
          onCloudOpacityChange={(value) => setCloudOpacity(value)}
        />

        {/* Weather Legend */}
        <WeatherLegend />

        {/* Current Weather Display */}
        {weatherData && (
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Current Weather</h3>
            <div className="text-2xl font-bold">{weatherData.current.temperature}°C</div>
            <div className="text-sm text-muted-foreground">{weatherData.current.description}</div>
          </Card>
        )}

          {/* Route Controls */}
          {routePoints.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Route Points ({routePoints.length})</h3>
                <Button size="sm" variant="outline" onClick={clearRoute}>
                  Clear Route
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {routePoints.map((point, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <MapPin className="h-3 w-3" />
                    <span>{point.name || `Point ${index + 1}`}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

        {/* Travel Recommendations */}
        {currentRoute && travelRecommendation && showTravelRecommendations && (
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Travel Recommendations</h3>
            <div className="text-sm">{travelRecommendation.reason}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Risk Level: {travelRecommendation.currentConditions.riskLevel}
            </div>
          </Card>
        )}
      </div>

      {/* Location Dialog */}
      <LocationDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onSetDeparture={() => handleLocationAdd('Departure')}
        onSetDestination={() => handleLocationAdd('Destination')}
        onAddStop={() => handleLocationAdd('Stop')}
        coordinates={clickedLocation ? { lng: clickedLocation.lng, lat: clickedLocation.lat } : { lng: 0, lat: 0 }}
      />

      {/* Route Warning Dialog */}
      <RouteWarningDialog
        isOpen={showRouteWarning}
        routeDuration={pendingRouteDuration}
        onClose={() => {
          setShowRouteWarning(false);
          setPendingRoute(null);
        }}
        onContinue={() => {
          if (pendingRoute) {
            generateRoute(pendingRoute, true); // Skip warning on continue
          }
          setShowRouteWarning(false);
          setPendingRoute(null);
        }}
      />

      {/* Toast Container */}
      <Toaster />
    </div>
  );
};

export default WeatherMap;