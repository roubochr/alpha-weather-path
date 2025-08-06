import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface PrecipitationOverlayProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
  currentHour: number;
  isAnimating: boolean;
  apiKey: string;
}

const PrecipitationOverlay: React.FC<PrecipitationOverlayProps> = ({
  map,
  isVisible,
  currentHour,
  isAnimating,
  apiKey
}) => {
  const animationRef = useRef<number>();
  const timeRef = useRef<number>(currentHour);

  useEffect(() => {
    timeRef.current = currentHour;
  }, [currentHour]);

  useEffect(() => {
    if (!map || !isVisible) {
      removeAllLayers();
      return;
    }

    updatePrecipitationLayer();
  }, [map, isVisible, currentHour, apiKey]);

  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      if (!map || !isVisible) return;
      
      timeRef.current = (timeRef.current + 0.5) % 24; // Increment by 30 minutes
      updatePrecipitationLayer();
      
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
  }, [isAnimating, map, isVisible]);

  const removeAllLayers = () => {
    if (!map) return;

    const layersToRemove = [
      'precipitation-layer',
      'precipitation-clouds-layer',
      'precipitation-temp-layer'
    ];

    layersToRemove.forEach(layerId => {
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(layerId.replace('-layer', ''))) {
          map.removeSource(layerId.replace('-layer', ''));
        }
      } catch (error) {
        console.warn(`Could not remove layer ${layerId}:`, error);
      }
    });
  };

  const updatePrecipitationLayer = () => {
    if (!map || !apiKey || !isVisible) return;

    console.log('Updating precipitation layer for hour:', timeRef.current);
    
    try {
      // Remove existing precipitation layers
      removeAllLayers();

      // Add precipitation layer with current time
      map.addSource('precipitation', {
        type: 'raster',
        tiles: [
          `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`
        ],
        tileSize: 256
      });

      map.addLayer({
        id: 'precipitation-layer',
        type: 'raster',
        source: 'precipitation',
        paint: {
          'raster-opacity': 0.6,
          'raster-fade-duration': 300
        }
      });

    } catch (error) {
      console.error('Error updating precipitation layer:', error);
    }
  };

  return null; // This component doesn't render anything visible
};

export default PrecipitationOverlay;