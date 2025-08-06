import { useState, useCallback } from 'react';

export interface RouteStep {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
}

export interface RouteData {
  distance: number;
  duration: number;
  steps: RouteStep[];
  geometry: {
    coordinates: [number, number][];
  };
}

export const useRouting = (mapboxToken: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRoute = useCallback(async (
    coordinates: [number, number][]
  ): Promise<RouteData | null> => {
    if (coordinates.length < 2 || !mapboxToken) return null;

    setLoading(true);
    setError(null);

    try {
      const coordinateString = coordinates
        .map(coord => coord.join(','))
        .join(';');

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?steps=true&geometries=geojson&access_token=${mapboxToken}`
      );

      if (!response.ok) {
        throw new Error('Failed to get route');
      }

      const data = await response.json();
      const route = data.routes[0];

      if (!route) {
        throw new Error('No route found');
      }

      const routeData: RouteData = {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        steps: route.legs[0]?.steps?.map((step: any) => ({
          distance: step.distance,
          duration: step.duration,
          geometry: step.geometry
        })) || []
      };

      setLoading(false);
      return routeData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get route';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  }, [mapboxToken]);

  return { getRoute, loading, error };
};