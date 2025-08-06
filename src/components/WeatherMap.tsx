import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudRain, Sun, AlertTriangle, MapPin, Wind, Droplets, Eye, Thermometer } from 'lucide-react';
import AddressSearch from '@/components/AddressSearch';
import { useRouting, RouteData } from '@/hooks/useRouting';
import { useTimeBasedWeather, TimeBasedWeatherData } from '@/hooks/useTimeBasedWeather';
import { useToast } from '@/hooks/use-toast';
import ApiKeySetup from '@/components/ApiKeySetup';
import TimeControls from '@/components/TimeControls';

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
  const [hasWeatherAPI, setHasApiKey] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number]>([-74.006, 40.7128]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Route and navigation state
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentNavigationStep, setCurrentNavigationStep] = useState(0);
  
  // Weather and time state
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isAnimating, setIsAnimating] = useState(false);
  const [departureTime, setDepartureTime] = useState(new Date());
  
  // Route weather analysis
  const [routeWeather, setRouteWeather] = useState<Array<{
    lat: number;
    lng: number;
    weather?: WeatherData;
    rainProbability?: number;
  }>>([]);
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);

  const { toast } = useToast();
  const { getRoute, loading: routeLoading, error: routeError } = useRouting(mapboxToken);
  const { getTimeBasedWeather } = useTimeBasedWeather();

  console.log('Rendering state:', {
    hasWeatherAPI,
    showTokenInput,
    mapboxToken: mapboxToken ? 'present' : 'missing'
  });

  console.log('Route state:', {
    routeLength: routePoints.length,
    currentRoute: !!currentRoute
  });

  // Get precipitation color based on intensity
  const getPrecipitationColor = useCallback((precipitation: number): string => {
    if (precipitation === 0) return '#4ade80'; // Green - no rain
    if (precipitation < 1) return '#fbbf24'; // Yellow - light rain
    if (precipitation < 5) return '#f97316'; // Orange - moderate rain
    return '#ef4444'; // Red - heavy rain
  }, []);

  const visualizeWeatherRoute = useCallback(async (routeData: RouteData, departureTime: Date) => {
    if (!map.current) return;

    // Sample points along the route more frequently for better resolution
    const coordinates = routeData.geometry.coordinates;
    const samplePoints: Array<{ coordinate: [number, number], arrivalTime: Date }> = [];
    
    // Calculate timing for each point with higher resolution
    const totalDistance = routeData.distance;
    const totalDuration = routeData.duration;
    const sampleInterval = Math.max(1, Math.floor(coordinates.length / 50)); // More sample points
    
    for (let i = 0; i < coordinates.length; i += sampleInterval) {
      const progress = i / (coordinates.length - 1);
      const arrivalTime = new Date(departureTime.getTime() + progress * totalDuration * 1000);
      samplePoints.push({
        coordinate: coordinates[i] as [number, number],
        arrivalTime
      });
    }

    // Add the final point
    if (coordinates.length > 0) {
      const finalTime = new Date(departureTime.getTime() + totalDuration * 1000);
      samplePoints.push({
        coordinate: coordinates[coordinates.length - 1] as [number, number],
        arrivalTime: finalTime
      });
    }

    // Fetch weather for each sample point
    const weatherSegments = await Promise.all(
      samplePoints.map(async (point) => {
        const weather = await getTimeBasedWeather(point.coordinate[1], point.coordinate[0], point.arrivalTime);
        return {
          coordinate: point.coordinate,
          arrivalTime: point.arrivalTime,
          weather: weather?.current || {
            temperature: 20,
            condition: 'Clear',
            precipitation: 0,
            humidity: 50,
            pressure: 1013,
            windSpeed: 5,
            visibility: 10000
          }
        };
      })
    );

    // Remove existing route layers and markers
    if (map.current.getLayer('route-line')) {
      map.current.removeLayer('route-line');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Clear existing weather markers
    const existingMarkers = document.querySelectorAll('[data-weather-marker="true"]');
    existingMarkers.forEach(marker => marker.remove());

    // Create multiple line segments with different colors based on precipitation
    const lineSegments = [];
    for (let i = 0; i < weatherSegments.length - 1; i++) {
      const segment = weatherSegments[i];
      const nextSegment = weatherSegments[i + 1];
      
      // Interpolate between segment coordinates for smoother line
      const segmentCoords = [];
      const startIdx = coordinates.findIndex(coord => 
        Math.abs(coord[0] - segment.coordinate[0]) < 0.001 && 
        Math.abs(coord[1] - segment.coordinate[1]) < 0.001
      );
      const endIdx = coordinates.findIndex(coord => 
        Math.abs(coord[0] - nextSegment.coordinate[0]) < 0.001 && 
        Math.abs(coord[1] - nextSegment.coordinate[1]) < 0.001
      );
      
      if (startIdx !== -1 && endIdx !== -1) {
        for (let j = startIdx; j <= endIdx; j++) {
          segmentCoords.push(coordinates[j]);
        }
      } else {
        segmentCoords.push(segment.coordinate, nextSegment.coordinate);
      }

      lineSegments.push({
        type: 'Feature',
        properties: {
          color: getPrecipitationColor(segment.weather.precipitation),
          precipitation: segment.weather.precipitation,
          temperature: segment.weather.temperature,
          condition: segment.weather.condition,
          arrivalTime: segment.arrivalTime.toLocaleTimeString()
        },
        geometry: {
          type: 'LineString',
          coordinates: segmentCoords
        }
      });
    }

    // Add route source and layer
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: lineSegments
      }
    });

    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 8,
        'line-opacity': 0.9
      }
    });

    // Add hover effect to route segments
    map.current.on('mouseenter', 'route-line', (e) => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'route-line', () => {
      map.current!.getCanvas().style.cursor = '';
    });

    // Add click popup for route segments
    map.current.on('click', 'route-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const precipitation = feature.properties?.precipitation || 0;
      const temperature = feature.properties?.temperature || 0;
      const condition = feature.properties?.condition || 'Unknown';
      const arrivalTime = feature.properties?.arrivalTime || '';
      const color = getPrecipitationColor(precipitation);
      
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="p-3 min-w-48">
            <div class="font-semibold text-lg">${Math.round(temperature)}°C</div>
            <div class="text-sm font-medium">${condition}</div>
            <div class="text-xs mt-2 space-y-1">
              <div>💧 Precipitation: ${precipitation}mm/h</div>
              <div>🕐 Arrival: ${arrivalTime}</div>
              <div class="flex items-center mt-2">
                <span class="inline-block w-3 h-3 rounded mr-2" style="background-color: ${color}"></span>
                Weather intensity
              </div>
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // Add weather markers at key points
    weatherSegments.forEach((segment, index) => {
      if (index % 4 !== 0 && index !== weatherSegments.length - 1) return; // Show every 4th marker plus end

      const markerElement = document.createElement('div');
      markerElement.className = 'weather-marker';
      markerElement.setAttribute('data-weather-marker', 'true');
      markerElement.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        background-color: ${getPrecipitationColor(segment.weather.precipitation)};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      new mapboxgl.Marker(markerElement)
        .setLngLat(segment.coordinate)
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div class="p-3 min-w-48">
              <div class="font-semibold text-lg">${Math.round(segment.weather.temperature)}°C</div>
              <div class="text-sm font-medium">${segment.weather.condition}</div>
              <div class="text-xs mt-2 space-y-1">
                <div>💧 Precipitation: ${segment.weather.precipitation}mm/h</div>
                <div>💨 Wind: ${Math.round(segment.weather.windSpeed)}km/h</div>
                <div>👁️ Visibility: ${Math.round(segment.weather.visibility/1000)}km</div>
                <div>🕐 Arrival: ${segment.arrivalTime.toLocaleTimeString()}</div>
              </div>
            </div>
          `)
        )
        .addTo(map.current!);
    });
  }, [getTimeBasedWeather, getPrecipitationColor]);

  const generateRoute = useCallback(async (routePoints: RoutePoint[]) => {
    if (routePoints.length < 2 || !mapboxToken) return;

    const coordinates: [number, number][] = routePoints.map(point => [point.lng, point.lat]);
    
    // Get route from Mapbox
    const routeData = await getRoute(coordinates);
    if (!routeData) return;

    // Generate weather-based route visualization
    await visualizeWeatherRoute(routeData, departureTime);
    setCurrentRoute(routeData);
  }, [mapboxToken, getRoute, visualizeWeatherRoute, departureTime]);

  // Check for existing API key on mount and set the provided key
  useEffect(() => {
    let apiKey = localStorage.getItem('openweather-api-key');
    
    // Set the provided API key if none exists
    if (!apiKey) {
      apiKey = 'ba3708802ed7275ee958045d0a9a0f99';
      localStorage.setItem('openweather-api-key', apiKey);
    }
    
    setHasApiKey(!!apiKey);
  }, []);

  const handleTokenSubmit = (token: string) => {
    if (token && !token.startsWith('http')) {
      localStorage.setItem('mapbox-token', token);
      setMapboxToken(token);
      setShowTokenInput(false);
    } else {
      alert('Please enter a valid Mapbox token (not a URL)');
    }
  };

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
              
              // Add new user location marker
              const el = document.createElement('div');
              el.className = 'user-location-marker';
              el.setAttribute('data-user-location', 'true');
              el.innerHTML = '📍';
              el.style.fontSize = '20px';
              el.style.textAlign = 'center';
              
              new mapboxgl.Marker(el)
                .setLngLat(newLocation)
                .addTo(map.current);
            }
          },
          (error) => {
            console.log('Geolocation error:', error);
            // Keep default location on error
          },
          options
        );

        // Store watchId to clear later if needed
        return () => {
          navigator.geolocation.clearWatch(watchId);
        };
      } catch (error) {
        console.log('Geolocation setup error:', error);
      }
    };

    requestLocation();
  }, [currentLocation]);

  // Check for existing tokens on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('mapbox-token');
    if (savedToken) {
      setMapboxToken(savedToken);
    } else {
      setShowTokenInput(true);
    }
  }, []);

  // Add weather layer to the map with time-based functionality
  const addWeatherLayer = useCallback(async () => {
    if (!map.current || !hasWeatherAPI) return;

    console.log('Adding weather layer...');
    
    // Function to update weather layer based on current hour
    const updateWeatherLayer = (hour: number) => {
      if (!map.current) return;
      
      // Remove existing weather layer
      if (map.current.getLayer('weather-layer')) {
        map.current.removeLayer('weather-layer');
      }
      if (map.current.getSource('weather-tiles')) {
        map.current.removeSource('weather-tiles');
      }

      // Calculate timestamp for the selected hour
      const targetDate = new Date();
      targetDate.setHours(hour, 0, 0, 0);
      const timestamp = Math.floor(targetDate.getTime() / 1000);

      // Add precipitation layer for the selected time
      map.current.addSource('weather-tiles', {
        type: 'raster',
        tiles: [
          `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=ba3708802ed7275ee958045d0a9a0f99&date=${timestamp}`
        ],
        tileSize: 256
      });

      map.current.addLayer({
        id: 'weather-layer',
        type: 'raster',
        source: 'weather-tiles',
        paint: {
          'raster-opacity': 0.6
        }
      });
    };

    // Initial load
    updateWeatherLayer(currentHour);

    // Store update function for external use
    (window as any).updateWeatherLayer = updateWeatherLayer;
  }, [hasWeatherAPI, currentHour]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    console.log('Map initialization starting...');
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: currentLocation,
        zoom: 10,
        pitch: 0,
        bearing: 0
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        addWeatherLayer();
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add click handler for adding route points
      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        console.log('Map clicked at:', { lng, lat });
        
        const newPoint: RoutePoint = { lat, lng };
        const newRoutePoints = [...routePoints, newPoint];
        setRoutePoints(newRoutePoints);

        // Add marker for the clicked point
        new mapboxgl.Marker({ color: routePoints.length === 0 ? '#22c55e' : '#ef4444' })
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div class="p-2">
                <div class="font-semibold">${routePoints.length === 0 ? 'Start' : `Stop ${routePoints.length}`}</div>
                <div class="text-sm text-gray-600">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
              </div>
            `)
          )
          .addTo(map.current!);

        // Generate route if we have at least 2 points
        if (newRoutePoints.length >= 2) {
          generateRoute(newRoutePoints);
        }
      });

    } catch (error) {
      console.error('Map initialization error:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken, currentLocation, addWeatherLayer, routePoints, generateRoute]);

  // Handle hour changes for time slider
  useEffect(() => {
    console.log('Hour changed to:', currentHour);
    if ((window as any).updateWeatherLayer) {
      (window as any).updateWeatherLayer(currentHour);
    }
  }, [currentHour]);

  // Handle departure time changes
  useEffect(() => {
    if (routePoints.length >= 2 && currentRoute) {
      generateRoute(routePoints);
    }
  }, [departureTime, routePoints, currentRoute, generateRoute]);

  const handleApiKeySubmit = (apiKey: string) => {
    localStorage.setItem('openweather-api-key', apiKey);
    setHasApiKey(true);
  };


  // Clear route function
  const clearRoute = () => {
    setRoutePoints([]);
    setCurrentRoute(null);
    
    if (map.current) {
      // Remove route layer
      if (map.current.getLayer('route-line')) {
        map.current.removeLayer('route-line');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
      
      // Clear all markers except user location
      const markers = document.querySelectorAll('.mapboxgl-marker:not([data-user-location="true"])');
      markers.forEach(marker => marker.remove());
      
      // Clear weather markers
      const weatherMarkers = document.querySelectorAll('[data-weather-marker="true"]');
      weatherMarkers.forEach(marker => marker.remove());
    }
  };

  console.log('Rendering main weather map interface...');

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {!hasWeatherAPI && (
        <ApiKeySetup 
          onApiKeySet={() => {
            setHasApiKey(true);
          }}
        />
      )}
      
      {showTokenInput && (
        <div className="absolute top-4 left-4 z-10 bg-card border border-border rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold mb-2">Mapbox Token Required</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Enter your Mapbox public token to display the map
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="pk.eyJ1..."
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleTokenSubmit((e.target as HTMLInputElement).value);
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                const input = document.querySelector('input[placeholder="pk.eyJ1..."]') as HTMLInputElement;
                if (input) handleTokenSubmit(input.value);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />
      
      {hasWeatherAPI && (
        <div className="absolute top-4 right-4 z-10 space-y-2">
          <TimeControls
            currentHour={currentHour}
            isAnimating={isAnimating}
            onHourChange={setCurrentHour}
            onToggleAnimation={() => setIsAnimating(!isAnimating)}
            departureTime={departureTime}
            onDepartureTimeChange={setDepartureTime}
          />
          <AddressSearch
            mapboxToken={mapboxToken}
            onLocationSelect={(lng: number, lat: number, placeName: string) => {
              setCurrentLocation([lng, lat]);
              if (map.current) {
                map.current.flyTo({
                  center: [lng, lat],
                  zoom: 12,
                  duration: 2000
                });
              }
            }}
            onStartNavigation={() => {}}
          />
          {routePoints.length > 0 && (
            <Button onClick={clearRoute} variant="outline" size="sm">
              Clear Route
            </Button>
          )}
        </div>
      )}
      
      {routePoints.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-card border border-border rounded-lg p-3 shadow-lg">
          <div className="text-sm font-medium mb-1">
            Route: {routePoints.length} point{routePoints.length !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-muted-foreground">
            Click map to add waypoints • Colors show precipitation intensity
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherMap;
