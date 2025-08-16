import React, { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { TomorrowForecastData } from '@/hooks/useTomorrowWeather';

interface TomorrowRadarOverlayProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
  currentTime: number; // Unix timestamp
  isAnimating: boolean;
  routeWeatherData?: { [coordinate: string]: TomorrowForecastData[] };
  onTimeChange?: (timestamp: number) => void;
}

const TomorrowRadarOverlay: React.FC<TomorrowRadarOverlayProps> = ({
  map,
  isVisible,
  currentTime,
  isAnimating,
  routeWeatherData,
  onTimeChange
}) => {
  const animationRef = useRef<number>();
  const timeRef = useRef<number>(currentTime);
  const [radarLayers, setRadarLayers] = useState<string[]>([]);

  useEffect(() => {
    timeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!map || !isVisible) {
      removeAllLayers();
      return;
    }

    updateRadarLayer();
  }, [map, isVisible, currentTime, routeWeatherData]);

  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      if (!map || !isVisible) return;
      
      // Increment by 15 minutes (900 seconds)
      timeRef.current = timeRef.current + 900;
      
      // Don't go beyond 24 hours from now
      const maxTime = Date.now() + (24 * 60 * 60 * 1000);
      if (timeRef.current > maxTime) {
        timeRef.current = Date.now();
      }
      
      updateRadarLayer();
      
      if (onTimeChange) {
        onTimeChange(timeRef.current);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation with a delay
    const timer = setTimeout(() => {
      animate();
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, map, isVisible, onTimeChange]);

  const removeAllLayers = useCallback(() => {
    if (!map) return;

    radarLayers.forEach(layerId => {
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        const sourceId = layerId.replace('-layer', '');
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (error) {
        console.warn(`Could not remove layer ${layerId}:`, error);
      }
    });

    setRadarLayers([]);
  }, [map, radarLayers]);

  const getPrecipitationColor = useCallback((intensity: number): string => {
    if (intensity <= 0) return 'rgba(16, 185, 129, 0)'; // Transparent for no rain
    if (intensity < 0.1) return 'rgba(34, 197, 94, 0.3)'; // Very light green
    if (intensity < 0.5) return 'rgba(132, 204, 22, 0.5)'; // Light green
    if (intensity < 1) return 'rgba(245, 158, 11, 0.6)'; // Yellow
    if (intensity < 3) return 'rgba(249, 115, 22, 0.7)'; // Orange
    if (intensity < 10) return 'rgba(239, 68, 68, 0.8)'; // Red
    return 'rgba(220, 38, 38, 0.9)'; // Dark red
  }, []);

  const updateRadarLayer = useCallback(() => {
    if (!map || !map.isStyleLoaded() || !isVisible) return;

    console.log('Updating Tomorrow.io radar layer for time:', new Date(timeRef.current));
    
    try {
      // Remove existing layers
      removeAllLayers();

      // Wait for style to be ready
      setTimeout(() => {
        if (!map || !map.isStyleLoaded()) return;

        const layerId = 'tomorrow-radar-layer';
        const sourceId = 'tomorrow-radar';

        // Create precipitation data features from route weather data
        const features: any[] = [];

        if (routeWeatherData) {
          Object.entries(routeWeatherData).forEach(([coordKey, forecasts]) => {
            const [lonStr, latStr] = coordKey.split(',');
            const lon = parseFloat(lonStr);
            const lat = parseFloat(latStr);

            // Find the forecast data closest to current time
            const targetTime = timeRef.current;
            let closestForecast = forecasts[0];
            let minTimeDiff = Math.abs(closestForecast.timestampUTC - targetTime);

            forecasts.forEach(forecast => {
              const timeDiff = Math.abs(forecast.timestampUTC - targetTime);
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestForecast = forecast;
              }
            });

            if (closestForecast && closestForecast.precipitationIntensity > 0) {
              // Create a circular feature for precipitation visualization
              const intensity = closestForecast.precipitationIntensity;
              const radius = 0.01; // ~1km radius for each point
              
              // Create a simple circle polygon
              const circle = [];
              const points = 20;
              for (let i = 0; i <= points; i++) {
                const angle = (i / points) * 2 * Math.PI;
                const x = lon + radius * Math.cos(angle);
                const y = lat + radius * Math.sin(angle);
                circle.push([x, y]);
              }

              features.push({
                type: 'Feature',
                properties: {
                  intensity: intensity,
                  color: getPrecipitationColor(intensity),
                  precipitationType: closestForecast.precipitationType,
                  time: new Date(closestForecast.timestampUTC).toISOString()
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [circle]
                }
              });
            }
          });
        }

        if (features.length === 0) {
          console.log('No precipitation data to display');
          return;
        }

        // Add source with precipitation data
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: features
            }
          });
        } else {
          // Update existing source
          const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
          source.setData({
            type: 'FeatureCollection',
            features: features
          });
        }

        // Add precipitation fill layer
        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0, 'rgba(16, 185, 129, 0)',
                0.1, 'rgba(34, 197, 94, 0.3)',
                0.5, 'rgba(132, 204, 22, 0.5)',
                1, 'rgba(245, 158, 11, 0.6)',
                3, 'rgba(249, 115, 22, 0.7)',
                10, 'rgba(239, 68, 68, 0.8)',
                50, 'rgba(220, 38, 38, 0.9)'
              ],
              'fill-opacity': 0.8
            }
          });

          // Add border layer for better visibility
          map.addLayer({
            id: layerId + '-border',
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0, 'rgba(16, 185, 129, 0)',
                0.1, 'rgba(34, 197, 94, 0.6)',
                0.5, 'rgba(132, 204, 22, 0.8)',
                1, 'rgba(245, 158, 11, 0.9)',
                3, 'rgba(249, 115, 22, 1)',
                10, 'rgba(239, 68, 68, 1)',
                50, 'rgba(220, 38, 38, 1)'
              ],
              'line-width': 1,
              'line-opacity': 0.6
            }
          });

          setRadarLayers([layerId, layerId + '-border']);
        }

        // Add hover interaction
        map.on('mouseenter', layerId, (e) => {
          if (!map) return;
          map.getCanvas().style.cursor = 'pointer';
          
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const intensity = feature.properties?.intensity || 0;
            const precipType = feature.properties?.precipitationType || 'rain';
            const time = feature.properties?.time || '';
            
            new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: [0, -10],
              className: 'radar-popup'
            })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="p-2 bg-gray-900 text-white rounded-lg shadow-lg border border-gray-600">
                <div class="font-bold">${precipType.charAt(0).toUpperCase() + precipType.slice(1)}</div>
                <div class="text-sm">Intensity: ${intensity.toFixed(1)}mm/h</div>
                <div class="text-xs text-gray-300">${new Date(time).toLocaleTimeString()}</div>
              </div>
            `)
            .addTo(map);
          }
        });

        map.on('mouseleave', layerId, () => {
          if (!map) return;
          map.getCanvas().style.cursor = '';
          
          // Remove popup
          const popups = document.getElementsByClassName('radar-popup');
          Array.from(popups).forEach(popup => popup.remove());
        });
        
        console.log(`Tomorrow.io radar updated with ${features.length} precipitation features`);
      }, 100);

    } catch (error) {
      console.error('Error updating Tomorrow.io radar layer:', error);
    }
  }, [map, isVisible, routeWeatherData, removeAllLayers, getPrecipitationColor]);

  return null; // This component doesn't render anything visible
};

export default TomorrowRadarOverlay;