import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface WeatherKitRadarProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
  isAnimating: boolean;
  currentHour: number;
  opacity: number;
  weatherData?: any;
}

const WeatherKitRadar: React.FC<WeatherKitRadarProps> = ({
  map,
  isVisible,
  isAnimating,
  currentHour,
  opacity,
  weatherData
}) => {
  const animationRef = useRef<number>();
  const timeOffsetRef = useRef(0);

  const removeAllLayers = useCallback(() => {
    if (!map) return;

    const layersToRemove = [
      'weatherkit-precipitation',
      'weatherkit-precipitation-animated'
    ];

    layersToRemove.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    const sourcesToRemove = [
      'weatherkit-precipitation-source',
      'weatherkit-precipitation-animated-source'
    ];

    sourcesToRemove.forEach(sourceId => {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    });
  }, [map]);

  const updatePrecipitationLayer = useCallback(() => {
    if (!map || !isVisible) return;

    removeAllLayers();

    // WeatherKit precipitation layer implementation
    // This would use actual WeatherKit radar data when available
    const layerId = isAnimating ? 'weatherkit-precipitation-animated' : 'weatherkit-precipitation';
    const sourceId = isAnimating ? 'weatherkit-precipitation-animated-source' : 'weatherkit-precipitation-source';

    // Calculate dynamic opacity based on weather data
    let dynamicOpacity = opacity;
    if (weatherData && weatherData.current) {
      const avgPrecipitation = weatherData.current.precipitation || 0;
      dynamicOpacity = Math.min(0.9, Math.max(0.2, opacity * (1 + avgPrecipitation / 10)));
    }

    // Mock WeatherKit radar source (replace with actual WeatherKit radar tiles)
    const radarSource = {
      type: 'raster' as const,
      tiles: [
        // This would be replaced with actual WeatherKit radar tile URLs
        `https://api.openweathermap.org/maps/2.0/weather/PA0/{z}/{x}/{y}?appid=demo&date=${Math.floor(Date.now() / 1000) + (currentHour * 3600)}`
      ],
      tileSize: 256
    };

    try {
      map.addSource(sourceId, radarSource);

      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': dynamicOpacity,
          'raster-fade-duration': 300
        }
      });

      console.log(`WeatherKit precipitation layer updated: opacity=${dynamicOpacity.toFixed(2)}, hour=${currentHour}`);
    } catch (error) {
      console.error('Error adding WeatherKit precipitation layer:', error);
    }
  }, [map, isVisible, isAnimating, currentHour, opacity, weatherData, removeAllLayers]);

  // Handle animation
  useEffect(() => {
    if (!isAnimating || !map) return;

    const animate = () => {
      timeOffsetRef.current += 1;
      if (timeOffsetRef.current > 12) {
        timeOffsetRef.current = 0;
      }
      
      updatePrecipitationLayer();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, updatePrecipitationLayer]);

  // Update layer when visibility, hour, or data changes
  useEffect(() => {
    if (isVisible) {
      updatePrecipitationLayer();
    } else {
      removeAllLayers();
    }
  }, [isVisible, currentHour, weatherData, updatePrecipitationLayer, removeAllLayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeAllLayers();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [removeAllLayers]);

  return null; // This component doesn't render anything visible
};

export default WeatherKitRadar;