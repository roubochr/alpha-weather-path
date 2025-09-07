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

    console.log('WeatherKitRadar: Radar functionality disabled - requires server-side WeatherKit radar implementation');
    
    // Note: WeatherKit radar tiles require server-side authentication and cannot be accessed from frontend
    // This component is disabled until proper WeatherKit radar proxy is implemented
    return;
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