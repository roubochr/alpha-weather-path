import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, MapPin, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GeocodingResult {
  place_name: string;
  center: [number, number];
  properties: {
    address?: string;
  };
}

interface AddressSearchProps {
  onLocationSelect: (lng: number, lat: number, placeName: string) => void;
  onStartNavigation: () => void;
  mapboxToken: string;
}

const AddressSearch: React.FC<AddressSearchProps> = ({ 
  onLocationSelect, 
  onStartNavigation,
  mapboxToken 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchAddresses = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !mapboxToken) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${mapboxToken}&limit=5&types=place,postcode,address`
      );
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.features || []);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setLoading(false);
    }
  }, [mapboxToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchAddresses(query);
  };

  const handleLocationSelect = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    onLocationSelect(lng, lat, result.place_name);
    setQuery(result.place_name);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for an address or place..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
        <Button 
          type="button" 
          variant="outline"
          onClick={onStartNavigation}
          className="flex items-center space-x-1"
        >
          <Navigation className="h-4 w-4" />
          <span>Navigate</span>
        </Button>
      </form>

      {showResults && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto">
          <div className="p-2">
            {results.map((result, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                onClick={() => handleLocationSelect(result)}
              >
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{result.place_name}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AddressSearch;