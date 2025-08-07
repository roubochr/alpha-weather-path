import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Check, AlertCircle, ExternalLink } from 'lucide-react';

interface AccuWeatherSetupProps {
  onApiKeySet: () => void;
}

const AccuWeatherSetup: React.FC<AccuWeatherSetupProps> = ({ onApiKeySet }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('accuweather-api-key');
    if (stored) {
      setApiKey(stored);
      setIsValid(true);
    }
  }, []);

  const validateApiKey = async (key: string) => {
    if (!key.trim()) return false;
    
    setIsValidating(true);
    setError(null);
    
    try {
      const response = await fetch('/functions/v1/validate-accuweather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: key }),
      });
      
      const data = await response.json();
      
      if (data.valid) {
        return true;
      } else {
        setError(data.error || 'API key validation failed');
        return false;
      }
    } catch (err) {
      setError('Failed to validate API key - please check your connection');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    const trimmedKey = apiKey.trim();
    const valid = await validateApiKey(trimmedKey);
    
    if (valid) {
      localStorage.setItem('accuweather-api-key', trimmedKey);
      setIsValid(true);
      onApiKeySet();
    }
  };

  const handleClear = () => {
    localStorage.removeItem('accuweather-api-key');
    setApiKey('');
    setIsValid(false);
    setError(null);
  };

  if (isValid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            AccuWeather API Connected
          </CardTitle>
          <CardDescription>
            MinuteCast enabled for sub-2-hour trips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleClear} size="sm">
            Change API Key
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          AccuWeather MinuteCast Setup
        </CardTitle>
        <CardDescription>
          Add AccuWeather API key for minute-by-minute precipitation forecasts on short trips
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accuweather-key">AccuWeather API Key</Label>
          <Input
            id="accuweather-key"
            type="password"
            placeholder="Enter your AccuWeather API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isValidating}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleSave} 
            disabled={!apiKey.trim() || isValidating}
          >
            {isValidating ? 'Validating...' : 'Save & Validate'}
          </Button>
          
          <Button 
            variant="outline" 
            asChild
          >
            <a 
              href="https://developer.accuweather.com/apis" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              Get API Key <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>

        <Alert>
          <AlertDescription>
            AccuWeather MinuteCast provides minute-by-minute precipitation forecasts for the next 2 hours, 
            perfect for short trips. Longer trips will continue using OpenWeatherMap's 5-day forecast.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default AccuWeatherSetup;