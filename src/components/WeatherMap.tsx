import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudRain, Sun, AlertTriangle, MapPin, Wind, Droplets, Eye, Thermometer, ChevronLeft, ChevronRight } from 'lucide-react';
import AddressSearch from '@/components/AddressSearch';
import { useRouting, RouteData } from '@/hooks/useRouting';
import { useWeatherKit, TimeBasedWeatherData } from '@/hooks/useWeatherKit';
import { useToast } from '@/hooks/use-toast';
import TimeControls from '@/components/TimeControls';
import WeatherLegend from '@/components/WeatherLegend';
import OverlayControls from '@/components/OverlayControls';
import WeatherForecast from '@/components/WeatherForecast';
import LocationDialog from '@/components/LocationDialog';
import MinimizableUI from '@/components/MinimizableUI';
import RouteWarningDialog from '@/components/RouteWarningDialog';
import WeatherKitRadar from '@/components/WeatherKitRadar';
import WeatherKitTimeline from '@/components/WeatherKitTimeline';
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
  const [showRouteInfo, setShowRouteInfo] = useState(true);
  const [routeInfoTimer, setRouteInfoTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasTimeUpdates, setHasTimeUpdates] = useState(false);
  const [showTravelRecommendations, setShowTravelRecommendations] = useState(true);
  
  // Overlay control state
  const [showPrecipitation, setShowPrecipitation] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  
  // State for opacity
  const [precipitationOpacity, setPrecipitationOpacity] = useState(0.7);
  const [cloudOpacity, setCloudOpacity] = useState(0.4);
  
  // Weather forecast state
  const [departureWeather, setDepartureWeather] = useState<any>(null);
  const [arrivalWeather, setArrivalWeather] = useState<any>(null);
  
  // Travel recommendations state
  const [travelRecommendation, setTravelRecommendation] = useState<TravelRecommendation | null>(null);
  const [routeHourlyForecasts, setRouteHourlyForecasts] = useState<{ [coordinate: string]: { [minute: number]: any } }>({});
  
  // Route weather analysis
  const [routeWeather, setRouteWeather] = useState<Array<{
    lat: number;
    lng: number;
    weather?: WeatherData;
    rainProbability?: number;
  }>>([]);
  const [routeWeatherSegments, setRouteWeatherSegments] = useState<any[]>([]);
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  const [showAccuWeatherSetup, setShowAccuWeatherSetup] = useState(false);
  const [showRouteWarning, setShowRouteWarning] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<RoutePoint[] | null>(null);
  const [pendingRouteDuration, setPendingRouteDuration] = useState<number>(0);

  const { toast } = useToast();
  const { getRoute, loading: routeLoading, error: routeError } = useRouting(mapboxToken);
  const { getTimeBasedWeather } = useWeatherKit();
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

    // Store weather segments for time-based updates
    setRouteWeatherSegments(weatherSegments);

    updateRouteVisualization(weatherSegments, coordinates);
  }, [getTimeBasedWeather, getPrecipitationColor]);

  // New function to update route visualization based on current time
  const updateRouteVisualization = useCallback((weatherSegments: any[], coordinates: any[]) => {
    if (!map.current || !weatherSegments.length) return;

    // Remove existing route layers and markers
    ['route-line', 'route-line-glow'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Clear existing weather markers
    const existingMarkers = document.querySelectorAll('[data-weather-marker="true"]');
    existingMarkers.forEach(marker => marker.remove());

    // Create multiple line segments with colors based on current time offset
    const lineSegments = [];
    
    for (let i = 0; i < weatherSegments.length - 1; i++) {
      const segment = weatherSegments[i];
      const nextSegment = weatherSegments[i + 1];
      
      // Calculate precipitation based on current time offset from arrival time
      const timeOffset = currentHour - segment.arrivalTime.getHours();
      const adjustedPrecipitation = Math.max(0, segment.weather.precipitation * (1 + timeOffset * 0.1));
      const nextAdjustedPrecipitation = Math.max(0, nextSegment.weather.precipitation * (1 + timeOffset * 0.1));
      
      // Get colors for smooth transitions based on adjusted precipitation
      const startColor = getPrecipitationColor(adjustedPrecipitation);
      const endColor = getPrecipitationColor(nextAdjustedPrecipitation);
      
      console.log(`Segment ${i}: original precipitation=${segment.weather.precipitation}mm/h, adjusted=${adjustedPrecipitation.toFixed(1)}mm/h, color=${startColor}`);
      
      // Find exact coordinates in route for smooth path following
      const segmentCoords = [];
      const startIdx = coordinates.findIndex(coord => 
        Math.abs(coord[0] - segment.coordinate[0]) < 0.0005 && 
        Math.abs(coord[1] - segment.coordinate[1]) < 0.0005
      );
      const endIdx = coordinates.findIndex(coord => 
        Math.abs(coord[0] - nextSegment.coordinate[0]) < 0.0005 && 
        Math.abs(coord[1] - nextSegment.coordinate[1]) < 0.0005
      );
      
      if (startIdx !== -1 && endIdx !== -1) {
        // Use actual route coordinates for perfect path following
        for (let j = startIdx; j <= endIdx; j++) {
          segmentCoords.push(coordinates[j]);
        }
      } else {
        // Fallback to direct line
        segmentCoords.push(segment.coordinate, nextSegment.coordinate);
      }

      // Create smooth interpolated points for better curves
      const smoothedCoords = [];
      for (let j = 0; j < segmentCoords.length; j++) {
        smoothedCoords.push(segmentCoords[j]);
        
        // Add intermediate points for smoother visual curves
        if (j < segmentCoords.length - 1) {
          const curr = segmentCoords[j];
          const next = segmentCoords[j + 1];
          
          // Add two intermediate points for very smooth curves
          const third1 = [
            curr[0] + (next[0] - curr[0]) * 0.33,
            curr[1] + (next[1] - curr[1]) * 0.33
          ];
          const third2 = [
            curr[0] + (next[0] - curr[0]) * 0.66,
            curr[1] + (next[1] - curr[1]) * 0.66
          ];
          
          smoothedCoords.push(third1, third2);
        }
      }

      lineSegments.push({
        type: 'Feature',
        properties: {
          color: startColor,
          gradientEnd: endColor,
          precipitation: adjustedPrecipitation,
          temperature: segment.weather.temperature,
          condition: segment.weather.condition,
          arrivalTime: segment.arrivalTime.toLocaleTimeString(),
          segmentIndex: i
        },
        geometry: {
          type: 'LineString',
          coordinates: smoothedCoords
        }
      });
    }

    // Add route source and layers with glow effect
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: lineSegments
      }
    });

    // Add glow layer first (behind main line)
    map.current.addLayer({
      id: 'route-line-glow',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 16,
        'line-opacity': 0.25,
        'line-blur': 4
      }
    });

    // Add main route line with smooth joins
    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 8,
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
        z-index: 1000;
        position: relative;
      `;

      // Only add marker if map is ready
      if (map.current && map.current.isStyleLoaded()) {
        const marker = new mapboxgl.Marker(markerElement)
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
          );
        
        // Set high z-index for marker visibility
        const markerEl = marker.getElement();
        markerEl.style.zIndex = '30';
        
        marker.addTo(map.current!);
      }
    });
  }, [getTimeBasedWeather, getPrecipitationColor]);

  const generateRoute = useCallback(async (routePoints: RoutePoint[], skipWarning: boolean = false) => {
    if (routePoints.length < 2 || !mapboxToken) return;

    const coordinates: [number, number][] = routePoints.map(point => [point.lng, point.lat]);
    
    // Get route from Mapbox
    const routeData = await getRoute(coordinates);
    if (!routeData) return;

    // Check if route is longer than 2 hours
    const routeDurationHours = routeData.duration / 3600;
    const hasAccuWeatherKey = localStorage.getItem('accuweather-api-key');
    
    // Show warning dialog for long routes (always show, regardless of AccuWeather availability)
    if (!skipWarning && routeDurationHours >= 2) {
      setPendingRoute(routePoints);
      setPendingRouteDuration(routeData.duration);
      setShowRouteWarning(true);
      return; // Don't proceed with route generation until user confirms
    }

    // Generate weather-based route visualization
    await visualizeWeatherRoute(routeData, departureTime);
    setCurrentRoute(routeData);
  }, [mapboxToken, getRoute, visualizeWeatherRoute, departureTime]);

  // Check for existing tokens on mount and set defaults
  useEffect(() => {
    let mapboxToken = localStorage.getItem('mapbox-token');
    
    // Set the provided Mapbox token if none exists
    if (!mapboxToken) {
      mapboxToken = 'pk.eyJ1IjoiYm9vYm9zIiwiYSI6ImNtZHo4emZ3cjBhZWYydnB5b2o4aGh6YjYifQ.rvTwrB2pOlZwt_1j8scLSw';
      localStorage.setItem('mapbox-token', mapboxToken);
      setShowTokenInput(false);
    }
    
    // Set the provided Mapbox token if none exists
    if (!mapboxToken) {
      mapboxToken = 'pk.eyJ1IjoiYm9vYm9zIiwiYSI6ImNtZHo4emZ3cjBhZWYydnB5b2o4aGh6YjYifQ.rvTwrB2pOlZwt_1j8scLSw';
      localStorage.setItem('mapbox-token', mapboxToken);
      setShowTokenInput(false);
    }
    
    setHasApiKey(true); // WeatherKit is configured via Supabase secrets
    setMapboxToken(mapboxToken);
    
    // Only show token input if no token exists
    if (!mapboxToken) {
      setShowTokenInput(true);
    }
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

  // Setup user location on component mount - only ask once initially
  useEffect(() => {
    if (!currentLocation) {
      setupUserLocation();
    }
  }, []); // Empty dependency array to only run once on mount

  // Add weather layer to the map with time-based functionality
  const addWeatherLayer = useCallback(async () => {
    if (!map.current || !hasWeatherAPI) return;

    console.log('Adding weather layer...');
    
    // Function to update weather layer based on current hour and overlay settings
    const updateWeatherLayer = (hour: number, precipitation: boolean, clouds: boolean, precipOpacity?: number, cloudOpacity?: number) => {
      if (!map.current || !map.current.isStyleLoaded()) {
        console.log('Map style not loaded yet, skipping weather layer update');
        return;
      }
      
      console.log('Updating weather layer for hour:', hour, 'precipitation:', precipitation, 'clouds:', clouds);
      
      try {
        // Remove existing weather layers (but keep sources for caching)
        ['weather-precipitation', 'weather-clouds'].forEach(layerId => {
          if (map.current!.getLayer(layerId)) {
            map.current!.removeLayer(layerId);
          }
        });
        
        // Only remove sources if they won't be used (for caching efficiency)
        if (!precipitation && map.current!.getSource('precipitation-tiles')) {
          map.current!.removeSource('precipitation-tiles');
        }
        if (!clouds && map.current!.getSource('cloud-tiles')) {
          map.current!.removeSource('cloud-tiles');
        }

        // Calculate average precipitation intensity for dynamic opacity
        let avgPrecipitation = 0;
        let dataPoints = 0;
        
        if (routeWeather.length > 0) {
          routeWeather.forEach(segment => {
            if (segment.weather && segment.weather.precipitation !== undefined) {
              avgPrecipitation += segment.weather.precipitation;
              dataPoints++;
            }
          });
          avgPrecipitation = dataPoints > 0 ? avgPrecipitation / dataPoints : 0;
        }

        // Add precipitation layer if enabled (WeatherKit integration needed)
        if (precipitation) {
          console.log('Precipitation overlay disabled - WeatherKit radar integration pending');
          // WeatherKit radar tiles would be configured here
          // For now, precipitation overlay is disabled pending WeatherKit radar tile integration

          // Enhanced opacity calculation with over-saturation effect and time-based adjustment
          const baseOpacity = precipOpacity ?? 0.7;
          const intensityMultiplier = Math.min(avgPrecipitation / 2.0, 1.0); // Normalize to 0-1
          
          // Add time-based visibility factor (fade radar when forecast shows no precipitation)
          const currentTime = new Date().getHours();
          const timeDiff = Math.abs(hour - currentTime);
          const timeAdjustment = avgPrecipitation > 0 ? 1.0 : Math.max(0.3, 1.0 - (timeDiff * 0.1)); // Fade for future times with no forecast rain
          
          console.log(`Debug precipitation - baseOpacity: ${baseOpacity}, avgPrecipitation: ${avgPrecipitation}, intensityMultiplier: ${intensityMultiplier}, timeAdjustment: ${timeAdjustment}, selectedHour: ${hour}, currentHour: ${currentTime}`);
          
          let dynamicOpacity;
          let isOverSaturated = false;
          
          if (baseOpacity <= 0.8) {
            // Normal opacity control (0-80%)
            dynamicOpacity = baseOpacity * (0.3 + intensityMultiplier * 0.7) * timeAdjustment;
          } else {
            // Over-saturation effect (80-100%)
            isOverSaturated = true;
            const overSaturationFactor = (baseOpacity - 0.8) / 0.2; // 0 to 1 as opacity goes from 80% to 100%
            const enhancedIntensity = intensityMultiplier + (overSaturationFactor * 0.5); // Boost intensity by up to 50%
            dynamicOpacity = Math.min(1.0, baseOpacity * (0.3 + enhancedIntensity * 0.7) * timeAdjustment);
          }
          
          // Ensure minimum opacity when precipitation is enabled
          const minOpacity = 0.1; // Minimum 10% opacity
          dynamicOpacity = Math.max(dynamicOpacity, minOpacity);

          // Add precipitation source if it doesn't exist
          if (!map.current.getSource('precipitation-tiles')) {
            console.log('Adding precipitation tiles source');
            map.current.addSource('precipitation-tiles', {
              type: 'raster',
              tiles: [
                // Note: Using placeholder tiles - WeatherKit radar tiles require server-side authentication
                // In production, replace with authenticated WeatherKit radar tiles via proxy
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // Transparent 1x1 pixel
              ],
              tileSize: 256
            });
          }

          // Enhanced visual effects for more vibrant precipitation
          const paintProperties: any = {
            'raster-opacity': dynamicOpacity,
            'raster-resampling': 'linear', // Changed to linear for smoother appearance
            'raster-fade-duration': 300
          };

          // Apply enhanced visual effects based on intensity and over-saturation
          if (isOverSaturated) {
            // Over-saturation mode: maximum vibrancy within 1.0 limits
            paintProperties['raster-brightness-min'] = 0.2; // Higher min for more dramatic effect
            paintProperties['raster-brightness-max'] = 1.0;
            paintProperties['raster-contrast'] = 1.0; // Maximum allowed contrast
            paintProperties['raster-saturation'] = 1.0; // Maximum allowed saturation
            paintProperties['raster-hue-rotate'] = 0; // Ensure blue tones
          } else if (intensityMultiplier > 0.5) {
            // High intensity mode: enhanced vibrancy within limits
            paintProperties['raster-brightness-min'] = 0.15; // Higher min for more pop
            paintProperties['raster-brightness-max'] = 1.0;
            paintProperties['raster-contrast'] = 0.9; // High contrast within limits
            paintProperties['raster-saturation'] = 0.9; // High saturation within limits
            paintProperties['raster-hue-rotate'] = 0; // Ensure blue tones
          } else {
            // Normal mode: moderate enhancement within limits
            paintProperties['raster-brightness-min'] = 0.1; // Higher min
            paintProperties['raster-brightness-max'] = 1.0;
            paintProperties['raster-contrast'] = 0.7; // Moderate contrast within limits
            paintProperties['raster-saturation'] = 0.8; // Moderate saturation within limits
            paintProperties['raster-hue-rotate'] = 0; // Ensure blue tones
          }

          map.current.addLayer({
            id: 'weather-precipitation',
            type: 'raster',
            source: 'precipitation-tiles',
            paint: paintProperties
          });
          
          const timeStatus = timeDiff === 0 ? 'CURRENT' : timeDiff > 0 ? `FORECAST +${timeDiff}h` : `PAST -${Math.abs(timeDiff)}h`;
          console.log(`Precipitation overlay updated - Avg intensity: ${avgPrecipitation.toFixed(2)}mm/h, Opacity: ${dynamicOpacity.toFixed(2)}, Time: ${timeStatus}${isOverSaturated ? ' (OVER-SATURATED)' : ''}`);
        }

        // Add clouds layer if enabled (WeatherKit integration needed)
        if (clouds) {
          console.log('Clouds overlay disabled - WeatherKit integration pending');
          
          // Add clouds source if it doesn't exist
          if (!map.current.getSource('cloud-tiles')) {
            console.log('Adding cloud tiles source');
            map.current.addSource('cloud-tiles', {
              type: 'raster',
              tiles: [
                // Note: Using placeholder tiles - WeatherKit cloud tiles require server-side authentication
                // In production, replace with authenticated WeatherKit cloud tiles via proxy
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // Transparent 1x1 pixel
              ],
              tileSize: 256
            });
          }

          map.current.addLayer({
            id: 'weather-clouds',
            type: 'raster',
            source: 'cloud-tiles',
            paint: {
              'raster-opacity': cloudOpacity ?? 0.4,
              'raster-resampling': 'nearest'
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
      updateWeatherLayer(currentHour, showPrecipitation, showClouds, precipitationOpacity, cloudOpacity);
    }
  }, [hasWeatherAPI, currentHour, showPrecipitation, showClouds, routeWeather, precipitationOpacity, cloudOpacity]);

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
          // Set preserve position flag after first movement
          setPreserveMapPosition(true);
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
  }, [mapboxToken]); // Only reinitialize map when token changes

  // Handle hour changes for time slider - don't move map
  useEffect(() => {
    console.log('Hour changed to:', currentHour);
    if ((window as any).updateWeatherLayer && map.current && map.current.isStyleLoaded()) {
      // Preserve current map position
      const currentCenter = map.current.getCenter();
      const currentZoom = map.current.getZoom();
      
      (window as any).updateWeatherLayer(currentHour, showPrecipitation, showClouds, precipitationOpacity, cloudOpacity);
      
      // Update route visualization with new time-based weather
      if (currentRoute && routePoints.length >= 2) {
        console.log('Updating route visualization for new hour:', currentHour);
        visualizeWeatherRoute(currentRoute, departureTime);
      }
      
      // Restore map position after weather update
      map.current.jumpTo({
        center: [currentCenter.lng, currentCenter.lat],
        zoom: currentZoom
      });
    }
  }, [currentHour, showPrecipitation, showClouds, routeWeather, precipitationOpacity, cloudOpacity, currentRoute, routePoints, departureTime, visualizeWeatherRoute]);

  // Handle departure time changes - regenerate route with new weather
  useEffect(() => {
    if (routePoints.length >= 2 && currentRoute) {
      console.log('Regenerating route for new departure time:', departureTime);
      generateRoute(routePoints);
    }
  }, [departureTime, routePoints, generateRoute]);

  // Handle current hour changes - only update weather overlay, not route departure time
  useEffect(() => {
    console.log('Weather overlay hour changed to:', currentHour);
    // The currentHour only affects weather overlay visualization, not route planning
    // Route planning uses the separate departureTime state set by time controls
  }, [currentHour]);

  const handleApiKeySubmit = (apiKey: string) => {
    // WeatherKit doesn't need client-side API keys
    setHasApiKey(true);
  };


      // Clear route function
  const clearRoute = () => {
    setRoutePoints([]);
    setCurrentRoute(null);
    
    if (map.current) {
      // Remove route layers
      ['route-line', 'route-line-glow'].forEach(layerId => {
        if (map.current!.getLayer(layerId)) {
          map.current!.removeLayer(layerId);
        }
      });
      
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

  // Update weather forecasts and travel recommendations when route changes
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
            
            // Fetch hourly forecasts for route points for travel recommendations
            const forecasts: { [coordinate: string]: { [minute: number]: any } } = {};
            const samplePoints = Math.min(currentRoute.geometry.coordinates.length, 100); // Increased to match travel recommendations
            const step = Math.max(1, Math.floor(currentRoute.geometry.coordinates.length / samplePoints));
            
            console.log(`Collecting weather data for travel recommendations: ${samplePoints} sample points, step: ${step}, total coords: ${currentRoute.geometry.coordinates.length}`);
            
            for (let i = 0; i < currentRoute.geometry.coordinates.length; i += step) {
              const [lon, lat] = currentRoute.geometry.coordinates[i];
              const coordKey = `${Math.round(lon * 1000) / 1000},${Math.round(lat * 1000) / 1000}`;
              
              try {
                const weather = await getTimeBasedWeather(lat, lon, departureTime);
                if (weather?.hourlyForecast) {
                  forecasts[coordKey] = weather.hourlyForecast;
                  console.log(`Collected forecast for ${coordKey}: ${Object.keys(weather.hourlyForecast).length} time points`);
                } else {
                  console.warn(`No hourly forecast for ${coordKey}`);
                }
              } catch (error) {
                console.warn(`Failed to get weather for coordinate ${coordKey}:`, error);
              }
            }
            
            console.log(`Weather data collection complete: ${Object.keys(forecasts).length} coordinates with forecast data`);
            setRouteHourlyForecasts(forecasts);
            
            // Generate travel recommendations
              try {
                const recommendation = await generateRecommendation(
                  currentRoute.geometry.coordinates,
                  departureTime,
                  currentRoute.duration,
                  forecasts
                );
                setTravelRecommendation(recommendation);
              } catch (error) {
              console.error('Error generating travel recommendations:', error);
            }
          }
        } catch (error) {
          console.error('Error updating weather forecasts:', error);
        }
      } else {
        setDepartureWeather(null);
        setArrivalWeather(null);
        setTravelRecommendation(null);
        setRouteHourlyForecasts({});
      }
    };

    updateForecasts();
  }, [routePoints, departureTime, currentRoute, getTimeBasedWeather, generateRecommendation]);

  // Update route visualization when time changes
  useEffect(() => {
    if (routeWeatherSegments.length > 0 && currentRoute) {
      console.log('Updating route colors for time:', currentHour);
      updateRouteVisualization(routeWeatherSegments, currentRoute.geometry.coordinates);
    }
  }, [currentHour, routeWeatherSegments, currentRoute, updateRouteVisualization]);

  console.log('Rendering main weather map interface...');

  // Location dialog handlers
  const handleSetDeparture = () => {
    if (!clickedLocation) return;
    
    const newPoint: RoutePoint = { 
      lat: clickedLocation.lat, 
      lng: clickedLocation.lng, 
      name: 'Departure' 
    };
    
    // Replace departure point, keep destination if it exists
    const newRoutePoints = routePoints.length > 1 ? [newPoint, routePoints[1]] : [newPoint];
    setRoutePoints(newRoutePoints);
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
        z-index: 40;
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
    
    // Replace destination point, keep departure point
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
        z-index: 40;
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
        z-index: 40;
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
      (window as any).updateWeatherLayer(currentHour, showPrecipitation, showClouds, precipitationOpacity, cloudOpacity);
    }
    }
  }, [showPrecipitation, showClouds, mapCenter, preserveMapPosition, currentHour, routeWeather, precipitationOpacity, cloudOpacity]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* WeatherKit integration is now configured via Supabase secrets */}
      
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
          {/* WeatherKit Timeline */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <WeatherKitTimeline
              currentHour={currentHour}
              onHourChange={setCurrentHour}
              isAnimating={isAnimating}
              onAnimationToggle={() => setIsAnimating(!isAnimating)}
              weatherData={departureWeather}
            />
          </div>

          {/* WeatherKit Radar Overlay */}
          <WeatherKitRadar
            map={map.current}
            isVisible={showPrecipitation}
            isAnimating={isAnimating}
            currentHour={currentHour}
            opacity={precipitationOpacity}
            weatherData={departureWeather}
          />

          {/* Minimizable UI for mobile */}
          <MinimizableUI
            currentHour={currentHour}
            isAnimating={isAnimating}
            onHourChange={setCurrentHour}
            onToggleAnimation={() => setIsAnimating(!isAnimating)}
            departureTime={departureTime}
            onDepartureTimeChange={(newTime) => {
              setDepartureTime(newTime);
              setHasTimeUpdates(true);
              // Clear recommendations to force regeneration on update
              setTravelRecommendation(null);
            }}
            hasUpdates={hasTimeUpdates}
            onUpdate={() => {
              setHasTimeUpdates(false);
              // Clear travel recommendation to force regeneration
              setTravelRecommendation(null);
              // Trigger re-fetch by regenerating the route with new departure time
              if (currentRoute && routePoints.length >= 2) {
                generateRoute(routePoints);
              }
            }}
            showPrecipitation={showPrecipitation}
            showClouds={showClouds}
            precipitationOpacity={precipitationOpacity}
            cloudOpacity={cloudOpacity}
            onTogglePrecipitation={setShowPrecipitation}
            onToggleClouds={setShowClouds}
            onPrecipitationOpacityChange={setPrecipitationOpacity}
            onCloudOpacityChange={setCloudOpacity}
            mapboxToken={mapboxToken}
            onLocationSelect={(lng: number, lat: number, placeName: string) => {
              setClickedLocation({ lng, lat });
              setShowLocationDialog(true);
            }}
            onStartNavigation={() => {}}
            departureWeather={departureWeather}
            arrivalWeather={arrivalWeather}
            arrivalTime={currentRoute ? new Date(departureTime.getTime() + currentRoute.duration * 1000) : undefined}
            onClearRoute={clearRoute}
            routePoints={routePoints}
            onApiSetup={() => {}} // No API setup needed for WeatherKit
          />
          
          {/* Travel Recommendations Panel */}
          {routePoints.length >= 2 && currentRoute && showTravelRecommendations && (
            <div className="absolute top-6 left-6 z-10 w-80 max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden">
              <TravelRecommendations
                recommendation={travelRecommendation}
                loading={recommendationLoading}
                onSelectDeparture={(time: Date) => {
                  setDepartureTime(time);
                  setHasTimeUpdates(true);
                  // Clear recommendations to force regeneration on update
                  setTravelRecommendation(null);
                  // Trigger immediate re-fetch by regenerating the route with new departure time
                  if (currentRoute && routePoints.length >= 2) {
                    generateRoute(routePoints);
                  }
                  toast({
                    title: "Departure Time Updated",
                    description: `New departure: ${time.toLocaleTimeString()}`,
                  });
                }}
              />
            </div>
          )}
          
          {/* Toggle button for travel recommendations */}
          {routePoints.length >= 2 && currentRoute && (
            <div className="absolute top-4 left-4 z-10">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTravelRecommendations(!showTravelRecommendations)}
                className="bg-card/95 backdrop-blur-sm border-border hover:bg-accent"
                title={showTravelRecommendations ? "Hide Travel Recommendations" : "Show Travel Recommendations"}
              >
                {showTravelRecommendations ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
          
          <div className="absolute bottom-4 left-4 z-10 space-y-3">
            <Button
              onClick={() => setupUserLocation(true)}
              size="sm"
              variant="outline"
              className="bg-card/95 backdrop-blur-sm border-border hover:bg-accent"
              title="Get my location"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="absolute bottom-4 right-4 z-10">
            <WeatherLegend />
          </div>
        </>
      )}
      
      {routePoints.length > 0 && showRouteInfo && (
        <div className="absolute bottom-20 left-4 z-10 bg-card/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg transition-all duration-300">
          <div className="text-sm font-medium mb-1">
            Route: {routePoints.length} point{routePoints.length !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-muted-foreground">
            Click map to add waypoints • Colors show precipitation intensity
          </div>
        </div>
      )}

      {/* Route Warning Dialog */}
      <RouteWarningDialog
        isOpen={showRouteWarning}
        onClose={() => {
          setShowRouteWarning(false);
          setPendingRoute(null);
        }}
        routeDuration={pendingRouteDuration}
        onContinue={() => {
          if (pendingRoute) {
            generateRoute(pendingRoute, true); // Skip warning on continue
          }
          setShowRouteWarning(false);
          setPendingRoute(null);
        }}
      />
    </div>
  );
};

export default WeatherMap;
