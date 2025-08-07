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
import WeatherLegend from '@/components/WeatherLegend';
import OverlayControls from '@/components/OverlayControls';
import WeatherForecast from '@/components/WeatherForecast';
import LocationDialog from '@/components/LocationDialog';
import MinimizableUI from '@/components/MinimizableUI';

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
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isAnimating, setIsAnimating] = useState(false);
  const [departureTime, setDepartureTime] = useState(new Date());
  
  // UI state
  const [isUIMinimized, setIsUIMinimized] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{lng: number, lat: number} | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  
  // Overlay control state
  const [showPrecipitation, setShowPrecipitation] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  
  // Weather forecast state
  const [departureWeather, setDepartureWeather] = useState<any>(null);
  const [arrivalWeather, setArrivalWeather] = useState<any>(null);
  
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

  // Get precipitation color based on intensity with enhanced vibrancy
  const getPrecipitationColor = useCallback((precipitation: number): string => {
    if (precipitation === 0) return '#10b981'; // Emerald - no rain
    if (precipitation < 0.5) return '#84cc16'; // Lime - very light rain
    if (precipitation < 1) return '#f59e0b'; // Amber - light rain  
    if (precipitation < 3) return '#f97316'; // Orange - moderate rain
    if (precipitation < 10) return '#ef4444'; // Red - heavy rain
    return '#dc2626'; // Dark red - very heavy rain
  }, []);

  // Enhanced geolocation setup with user location as default
  const setupUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported, using fallback location');
      setCurrentLocation([-74.006, 40.7128]); // New York fallback
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc: [number, number] = [
          position.coords.longitude,
          position.coords.latitude
        ];
        console.log('User location obtained:', userLoc);
        setUserLocation(userLoc);
        if (!currentLocation) {
          setCurrentLocation(userLoc);
        }
      },
      (error) => {
        console.log('Geolocation error:', error);
        setCurrentLocation([-74.006, 40.7128]); // New York fallback
      },
      options
    );
  }, [currentLocation]);

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

    // Fetch weather for each sample point with actual API data
    const weatherSegments = await Promise.all(
      samplePoints.map(async (point, index) => {
        try {
          // Use actual weather API for each coordinate
          const weather = await getTimeBasedWeather(point.coordinate[1], point.coordinate[0], point.arrivalTime);
          
          if (weather?.current) {
            return {
              coordinate: point.coordinate,
              arrivalTime: point.arrivalTime,
              weather: weather.current
            };
          }
        } catch (error) {
          console.warn(`Failed to get weather for point ${index}:`, error);
        }
        
        // Fallback to default weather if API fails
        return {
          coordinate: point.coordinate,
          arrivalTime: point.arrivalTime,
          weather: {
            temperature: 20,
            condition: 'Clear',
            precipitation: 0,
            humidity: 50,
            pressure: 1013,
            windSpeed: 5,
            visibility: 10000,
            description: 'clear sky',
            icon: '01d'
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
        'line-width': 10,
        'line-opacity': 0.95
      }
    });

    // Add hover effect to route segments
    map.current.on('mouseenter', 'route-line', (e) => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = 'pointer';
      
      // Show hover popup with weather info
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        const precipitation = feature.properties?.precipitation || 0;
        const temperature = feature.properties?.temperature || 0;
        const condition = feature.properties?.condition || 'Unknown';
        const arrivalTime = feature.properties?.arrivalTime || '';
        
        // Remove any existing hover popup
        if ((window as any).hoverPopup) {
          (window as any).hoverPopup.remove();
        }
        
        // Create hover popup with better styling
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -10],
          className: 'weather-hover-popup'
        })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="p-3 bg-gray-900 text-white rounded-lg shadow-lg border border-gray-600 min-w-48">
            <div class="font-bold text-lg text-white">${Math.round(temperature)}°C</div>
            <div class="font-semibold text-blue-200">${condition}</div>
            <div class="text-sm text-gray-200 mt-1">
              <div>💧 Rain: ${precipitation.toFixed(1)}mm/h</div>
              <div>🕐 Arrival: ${arrivalTime}</div>
            </div>
          </div>
        `)
        .addTo(map.current);
        
        // Store popup for cleanup
        (window as any).hoverPopup = popup;
      }
    });

    map.current.on('mouseleave', 'route-line', () => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = '';
      
      // Remove hover popup immediately
      if ((window as any).hoverPopup) {
        (window as any).hoverPopup.remove();
        (window as any).hoverPopup = null;
      }
    });

    map.current.on('mousemove', 'route-line', (e) => {
      // Update popup position if it exists
      if ((window as any).hoverPopup && e.features && e.features[0]) {
        (window as any).hoverPopup.setLngLat(e.lngLat);
      }
    });

    // Add click popup for route segments
    map.current.on('click', 'route-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      
      // Prevent the general map click handler from triggering
      e.preventDefault();
      e.originalEvent?.stopPropagation();
      
      const feature = e.features[0];
      const precipitation = feature.properties?.precipitation || 0;
      const temperature = feature.properties?.temperature || 0;
      const condition = feature.properties?.condition || 'Unknown';
      const arrivalTime = feature.properties?.arrivalTime || '';
      const color = getPrecipitationColor(precipitation);
      
      // Remove any existing route popup
      if ((window as any).routePopup) {
        (window as any).routePopup.remove();
      }
      
      // Create persistent popup that stays until map movement or click elsewhere
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        closeOnMove: true,
        offset: [0, -10]
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="p-3 min-w-48 bg-background border border-border rounded-lg">
            <div class="font-semibold text-lg text-foreground">${Math.round(temperature)}°C</div>
            <div class="text-sm font-medium text-muted-foreground">${condition}</div>
            <div class="text-xs mt-2 space-y-1 text-foreground">
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
        
      // Store popup for cleanup
      (window as any).routePopup = popup;
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

      // Only add marker if map is ready
      if (map.current && map.current.isStyleLoaded()) {
        new mapboxgl.Marker(markerElement)
          .setLngLat(segment.coordinate)
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div class="p-3 bg-gray-900 text-white rounded-lg shadow-lg border border-gray-600 min-w-48">
              <div class="font-bold text-xl text-white">${Math.round(segment.weather.temperature)}°C</div>
              <div class="font-semibold text-blue-200 mb-2">${segment.weather.condition}</div>
              <div class="text-sm text-gray-200 space-y-1">
                <div>💧 Precipitation: ${segment.weather.precipitation.toFixed(1)}mm/h</div>
                <div>💨 Wind: ${Math.round(segment.weather.windSpeed)}km/h</div>
                <div>👁️ Visibility: ${Math.round(segment.weather.visibility/1000)}km</div>
                <div>🕐 Arrival: ${segment.arrivalTime.toLocaleTimeString()}</div>
              </div>
            </div>
          `)
        )
          .addTo(map.current!);
      }
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

  // Check for existing tokens on mount and set defaults
  useEffect(() => {
    let apiKey = localStorage.getItem('openweather-api-key');
    let mapboxToken = localStorage.getItem('mapbox-token');
    
    // Set the provided API key if none exists
    if (!apiKey) {
      apiKey = 'ba3708802ed7275ee958045d0a9a0f99';
      localStorage.setItem('openweather-api-key', apiKey);
    }
    
    // Set the provided Mapbox token if none exists
    if (!mapboxToken) {
      mapboxToken = 'pk.eyJ1IjoiYm9vYm9zIiwiYSI6ImNtZHo4emZ3cjBhZWYydnB5b2o4aGh6YjYifQ.rvTwrB2pOlZwt_1j8scLSw';
      localStorage.setItem('mapbox-token', mapboxToken);
    }
    
    setHasApiKey(!!apiKey);
    setMapboxToken(mapboxToken);
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

  // Setup user location on component mount
  useEffect(() => {
    setupUserLocation();
  }, [setupUserLocation]);

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
    
    // Function to update weather layer based on current hour and overlay settings
    const updateWeatherLayer = (hour: number, precipitation: boolean, clouds: boolean) => {
      if (!map.current || !map.current.isStyleLoaded()) {
        console.log('Map style not loaded yet, skipping weather layer update');
        return;
      }
      
      console.log('Updating weather layer for hour:', hour, 'precipitation:', precipitation, 'clouds:', clouds);
      
      try {
        // Remove existing weather layers
        ['weather-precipitation', 'weather-clouds'].forEach(layerId => {
          if (map.current!.getLayer(layerId)) {
            map.current!.removeLayer(layerId);
          }
        });
        
        ['precipitation-tiles', 'cloud-tiles'].forEach(sourceId => {
          if (map.current!.getSource(sourceId)) {
            map.current!.removeSource(sourceId);
          }
        });

        // Add precipitation layer if enabled
        if (precipitation) {
          map.current.addSource('precipitation-tiles', {
            type: 'raster',
            tiles: [
              `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=ba3708802ed7275ee958045d0a9a0f99`
            ],
            tileSize: 256
          });

          map.current.addLayer({
            id: 'weather-precipitation',
            type: 'raster',
            source: 'precipitation-tiles',
            paint: {
              'raster-opacity': 0.7
            }
          });
        }

        // Add clouds layer if enabled
        if (clouds) {
          map.current.addSource('cloud-tiles', {
            type: 'raster',
            tiles: [
              `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=ba3708802ed7275ee958045d0a9a0f99`
            ],
            tileSize: 256
          });

          map.current.addLayer({
            id: 'weather-clouds',
            type: 'raster',
            source: 'cloud-tiles',
            paint: {
              'raster-opacity': 0.4
            }
          });
        }
        
        console.log('Weather layers updated successfully');
      } catch (error) {
        console.error('Error adding weather layer:', error);
      }
    };

    // Store update function for external use
    (window as any).updateWeatherLayer = updateWeatherLayer;
    
    // Only update if style is loaded
    if (map.current.isStyleLoaded()) {
      updateWeatherLayer(currentHour, showPrecipitation, showClouds);
    }
  }, [hasWeatherAPI, currentHour, showPrecipitation, showClouds]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    console.log('Map initialization starting...');
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      // Safari iOS compatibility fixes
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      const mapOptions: any = {
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: currentLocation || [-74.006, 40.7128],
        zoom: 10,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        logoPosition: 'bottom-left'
      };
      
      // Additional iOS Safari fixes
      if (isIOS || isSafari) {
        mapOptions.preserveDrawingBuffer = true;
        mapOptions.antialias = false;
        mapOptions.failIfMajorPerformanceCaveat = false;
        mapOptions.renderWorldCopies = false;
      }
      
      map.current = new mapboxgl.Map(mapOptions);

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        // Add weather layer after style is loaded
        setTimeout(() => {
          if (map.current && map.current.isStyleLoaded()) {
            addWeatherLayer();
          }
        }, 100);
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Track map center and zoom changes to preserve position
      map.current.on('moveend', () => {
        if (map.current) {
          const center = map.current.getCenter();
          const zoom = map.current.getZoom();
          setMapCenter([center.lng, center.lat]);
          setMapZoom(zoom);
        }
      });

      // Add click handler for location selection dialog
      map.current.on('click', (e) => {
        // Check if click was on a route line by querying features at the point
        const features = map.current?.queryRenderedFeatures(e.point, {
          layers: ['route-line']
        });
        
        // Only show location dialog if not clicking on route line
        if (!features || features.length === 0) {
          const { lng, lat } = e.lngLat;
          console.log('Map clicked at:', { lng, lat });
          
          // Close any existing route popup when clicking elsewhere
          if ((window as any).routePopup) {
            (window as any).routePopup.remove();
            (window as any).routePopup = null;
          }
          
          setClickedLocation({ lng, lat });
          setShowLocationDialog(true);
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

  // Handle hour changes for time slider - don't move map
  useEffect(() => {
    console.log('Hour changed to:', currentHour);
    if ((window as any).updateWeatherLayer && map.current && map.current.isStyleLoaded()) {
      // Preserve current map position
      const currentCenter = map.current.getCenter();
      const currentZoom = map.current.getZoom();
      
      (window as any).updateWeatherLayer(currentHour, showPrecipitation, showClouds);
      
      // Restore map position after weather update
      map.current.jumpTo({
        center: [currentCenter.lng, currentCenter.lat],
        zoom: currentZoom
      });
    }
  }, [currentHour, showPrecipitation, showClouds]);

  // Handle departure time changes - regenerate route with new weather
  useEffect(() => {
    if (routePoints.length >= 2 && currentRoute) {
      console.log('Regenerating route for new departure time:', departureTime);
      generateRoute(routePoints);
    }
  }, [departureTime, routePoints, generateRoute]);

  // Handle current hour changes - regenerate route weather for new time
  useEffect(() => {
    if (routePoints.length >= 2) {
      console.log('Regenerating route for new hour:', currentHour);
      // Update departure time to reflect the current hour selection
      const newDepartureTime = new Date(departureTime);
      newDepartureTime.setHours(currentHour);
      setDepartureTime(newDepartureTime);
    }
  }, [currentHour, routePoints]);

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
      
      // Clear route markers specifically
      const routeMarkers = document.querySelectorAll('[data-route-marker="true"]');
      routeMarkers.forEach(marker => marker.remove());
      
      // Clear weather markers
      const weatherMarkers = document.querySelectorAll('[data-weather-marker="true"]');
      weatherMarkers.forEach(marker => marker.remove());
      
      // Clear any hover popups
      if ((window as any).hoverPopup) {
        (window as any).hoverPopup.remove();
        (window as any).hoverPopup = null;
      }
    }
  };

  // Update weather forecasts when route changes
  useEffect(() => {
    const updateForecasts = async () => {
      if (routePoints.length >= 2) {
        try {
          // Get departure weather
          const depWeather = await getTimeBasedWeather(
            routePoints[0].lat, 
            routePoints[0].lng, 
            departureTime
          );
          setDepartureWeather(depWeather?.current);

          // Calculate arrival time
          if (currentRoute) {
            const arrivalTime = new Date(departureTime.getTime() + currentRoute.duration * 1000);
            const arrWeather = await getTimeBasedWeather(
              routePoints[routePoints.length - 1].lat,
              routePoints[routePoints.length - 1].lng,
              arrivalTime
            );
            setArrivalWeather(arrWeather?.current);
          }
        } catch (error) {
          console.error('Error updating weather forecasts:', error);
        }
      } else {
        setDepartureWeather(null);
        setArrivalWeather(null);
      }
    };

    updateForecasts();
  }, [routePoints, departureTime, currentRoute, getTimeBasedWeather]);

  console.log('Rendering main weather map interface...');

  // Location dialog handlers
  const handleSetDeparture = () => {
    if (!clickedLocation) return;
    
    const newPoint: RoutePoint = { 
      lat: clickedLocation.lat, 
      lng: clickedLocation.lng, 
      name: 'Departure' 
    };
    
    setRoutePoints([newPoint]);
    setCurrentRoute(null);
    
    // Add departure marker
    if (map.current) {
      // Clear existing route markers
      const routeMarkers = document.querySelectorAll('[data-route-marker="true"]');
      routeMarkers.forEach(marker => marker.remove());
      
      const markerElement = document.createElement('div');
      markerElement.className = 'route-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background-color: #10b981;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        color: white;
        z-index: 10000 !important;
        position: relative;
      `;
      markerElement.innerHTML = '🚀';
      markerElement.setAttribute('data-route-marker', 'true');
      
      new mapboxgl.Marker(markerElement)
        .setLngLat([clickedLocation.lng, clickedLocation.lat])
        .addTo(map.current);
    }
  };

  const handleSetDestination = () => {
    if (!clickedLocation) return;
    
    const newPoint: RoutePoint = { 
      lat: clickedLocation.lat, 
      lng: clickedLocation.lng, 
      name: 'Destination' 
    };
    
    if (routePoints.length === 0) {
      // If no departure point, set this as departure instead
      handleSetDeparture();
      return;
    }
    
    const newRoutePoints = [routePoints[0], newPoint];
    setRoutePoints(newRoutePoints);
    
    // Add destination marker
    if (map.current) {
      const markerElement = document.createElement('div');
      markerElement.className = 'route-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background-color: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        color: white;
        z-index: 10000 !important;
        position: relative;
      `;
      markerElement.innerHTML = '🏁';
      markerElement.setAttribute('data-route-marker', 'true');
      
      new mapboxgl.Marker(markerElement)
        .setLngLat([clickedLocation.lng, clickedLocation.lat])
        .addTo(map.current);
    }
    
    // Generate route
    generateRoute(newRoutePoints);
  };

  const handleAddStop = () => {
    if (!clickedLocation) return;
    
    const newPoint: RoutePoint = { 
      lat: clickedLocation.lat, 
      lng: clickedLocation.lng, 
      name: `Stop ${routePoints.length + 1}` 
    };
    
    const newRoutePoints = [...routePoints, newPoint];
    setRoutePoints(newRoutePoints);
    
    // Add waypoint marker
    if (map.current) {
      const markerElement = document.createElement('div');
      markerElement.className = 'route-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        color: white;
        z-index: 10000 !important;
        position: relative;
      `;
      markerElement.innerHTML = routePoints.length.toString();
      markerElement.setAttribute('data-route-marker', 'true');
      
      new mapboxgl.Marker(markerElement)
        .setLngLat([clickedLocation.lng, clickedLocation.lat])
        .addTo(map.current);
    }
    
    // Generate route if we have at least 2 points
    if (newRoutePoints.length >= 2) {
      generateRoute(newRoutePoints);
    }
  };

  // Prevent map position reset when changing time or overlays
  useEffect(() => {
    if (!preserveMapPosition && routePoints.length === 0 && !currentLocation) {
      setPreserveMapPosition(true);
    }
  }, [preserveMapPosition, routePoints.length, currentLocation]);

  // Update map position only when location changes, not on time/overlay changes
  useEffect(() => {
    if (map.current && currentLocation && !preserveMapPosition) {
      map.current.flyTo({
        center: currentLocation,
        zoom: 10,
        duration: 2000
      });
      setPreserveMapPosition(true);
    }
  }, [currentLocation, preserveMapPosition]);

  // Effect to handle overlay changes without moving map
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && mapCenter && preserveMapPosition) {
      // Only update weather layers without moving map
      if ((window as any).updateWeatherLayer) {
        (window as any).updateWeatherLayer(currentHour, showPrecipitation, showClouds);
      }
    }
  }, [showPrecipitation, showClouds, mapCenter, preserveMapPosition, currentHour]);

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
      
      {/* Location Selection Dialog */}
      <LocationDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onSetDeparture={handleSetDeparture}
        onSetDestination={handleSetDestination}
        onAddStop={handleAddStop}
        coordinates={clickedLocation || { lng: 0, lat: 0 }}
      />
      
      {hasWeatherAPI && (
        <>
          {/* Minimizable UI for mobile */}
          <MinimizableUI
            currentHour={currentHour}
            isAnimating={isAnimating}
            onHourChange={setCurrentHour}
            onToggleAnimation={() => setIsAnimating(!isAnimating)}
            departureTime={departureTime}
            onDepartureTimeChange={setDepartureTime}
            showPrecipitation={showPrecipitation}
            showClouds={showClouds}
            onTogglePrecipitation={setShowPrecipitation}
            onToggleClouds={setShowClouds}
            mapboxToken={mapboxToken}
            onLocationSelect={(lng: number, lat: number, placeName: string) => {
              if (!preserveMapPosition) {
                setCurrentLocation([lng, lat]);
                if (map.current) {
                  map.current.flyTo({
                    center: [lng, lat],
                    zoom: 12,
                    duration: 2000
                  });
                }
              }
            }}
            onStartNavigation={() => {}}
            departureWeather={departureWeather}
            arrivalWeather={arrivalWeather}
            arrivalTime={currentRoute ? new Date(departureTime.getTime() + currentRoute.duration * 1000) : undefined}
            onClearRoute={clearRoute}
            routePoints={routePoints}
          />
          
          <div className="absolute bottom-4 right-4 z-10">
            <WeatherLegend />
          </div>
        </>
      )}
      
      {routePoints.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-card/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
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
