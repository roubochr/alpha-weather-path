import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, MapPin, Navigation } from 'lucide-react';

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
  onSetDeparture?: (lng: number, lat: number, placeName: string) => void;
  onSetDestination?: (lng: number, lat: number, placeName: string) => void;
}

const AddressSearch: React.FC<AddressSearchProps> = ({ 
  onLocationSelect, 
  onStartNavigation,
  mapboxToken,
  onSetDeparture,
  onSetDestination
}) => {
  console.log('AddressSearch rendering with mapboxToken:', mapboxToken ? 'present' : 'missing');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const searchAddresses = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !mapboxToken) {
      console.log('Search skipped - missing query or token');
      setResults([]);
      setShowResults(false);
      return;
    }

    console.log('Searching for address:', searchQuery);
    setLoading(true);
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${mapboxToken}&limit=5&types=place,postcode,address`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Geocoding results:', data.features);
        setResults(data.features || []);
        setShowResults(true);
      } else {
        console.error('Geocoding failed:', response.status);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setLoading(false);
    }
  }, [mapboxToken]);

  // Auto-search with debounce
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for auto-search
    if (value.trim().length >= 2) {
      const timeout = setTimeout(() => {
        searchAddresses(value);
      }, 300); // 300ms debounce
      setSearchTimeout(timeout);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [searchAddresses, searchTimeout]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchAddresses(query);
  };

  const handleLocationSelect = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    console.log('Address selected:', result.place_name, { lng, lat });
    onLocationSelect(lng, lat, result.place_name);
    setQuery(result.place_name);
    setShowResults(false);
  };

  // Show a visible message if no mapbox token
  if (!mapboxToken) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          Address search requires Mapbox token to be configured
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <form onSubmit={handleSearch} className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for an address or place..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-10 h-11"
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
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[70vh] overflow-y-auto bg-background border-border">
          <div className="p-2">
            {results.map((result, index) => (
              <div 
                key={index} 
                className="border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 rounded transition-colors"
                onClick={() => handleLocationSelect(result)}
              >
                <div className="flex items-center space-x-2 p-2">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.place_name}</p>
                  </div>
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