import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface PrecipitationOverlayProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
  currentHour: number;
  isAnimating: boolean;
  apiKey: string;
  weatherData?: { [coordinate: string]: { precipitation: number } };
}

const PrecipitationOverlay: React.FC<PrecipitationOverlayProps> = ({
  map,
  isVisible,
  currentHour,
  isAnimating,
  apiKey,
  weatherData
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
  }, [map, isVisible, currentHour, apiKey, weatherData]);

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
    if (!map || !apiKey || !isVisible || !map.isStyleLoaded()) return;

    console.log('Updating precipitation layer for hour:', timeRef.current);
    
    try {
      // Remove existing precipitation layers
      removeAllLayers();

      // Wait a bit for style to be ready
      setTimeout(() => {
        if (!map || !map.isStyleLoaded()) return;

        // Add precipitation layer with dynamic opacity based on weather data
        if (!map.getSource('precipitation')) {
          map.addSource('precipitation', {
            type: 'raster',
            tiles: [
              `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 18
          });
        }

        // Calculate average precipitation intensity for dynamic opacity
        let avgPrecipitation = 0;
        let dataPoints = 0;
        
        if (weatherData) {
          Object.values(weatherData).forEach(data => {
            if (data.precipitation !== undefined) {
              avgPrecipitation += data.precipitation;
              dataPoints++;
            }
          });
          avgPrecipitation = dataPoints > 0 ? avgPrecipitation / dataPoints : 0;
        }

        // Adjust opacity based on precipitation intensity
        const baseOpacity = 0.85;
        const intensityMultiplier = Math.min(avgPrecipitation / 2.0, 1.0); // Normalize to 0-1
        const dynamicOpacity = baseOpacity * (0.3 + intensityMultiplier * 0.7);

        if (!map.getLayer('precipitation-layer')) {
          map.addLayer({
            id: 'precipitation-layer',
            type: 'raster',
            source: 'precipitation',
            paint: {
              'raster-opacity': dynamicOpacity,
              'raster-fade-duration': 300,
              'raster-brightness-min': 0.0,
              'raster-brightness-max': 1.2,
              'raster-contrast': 0.4,
              'raster-saturation': 0.3
            }
          });
        } else {
          // Update existing layer opacity
          map.setPaintProperty('precipitation-layer', 'raster-opacity', dynamicOpacity);
        }
        
        console.log(`Precipitation overlay updated - Avg intensity: ${avgPrecipitation.toFixed(2)}mm/h, Opacity: ${dynamicOpacity.toFixed(2)}`);
      }, 100);

    } catch (error) {
      console.error('Error updating precipitation layer:', error);
    }
  };

  return null; // This component doesn't render anything visible
};

export default PrecipitationOverlay;