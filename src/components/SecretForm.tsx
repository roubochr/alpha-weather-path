import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CloudRain } from 'lucide-react';

interface SecretFormProps {
  onApiKeySet: () => void;
}

const SecretForm: React.FC<SecretFormProps> = ({ onApiKeySet }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      // Store in localStorage for demo purposes
      localStorage.setItem('openweather-api-key', apiKey);
      onApiKeySet();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <CloudRain className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Weather API Setup</h1>
          <p className="text-muted-foreground">
            Enter your OpenWeatherMap API key to enable live weather data
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="api-key">OpenWeatherMap API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={!apiKey.trim()} className="w-full">
            Save API Key
          </Button>
        </form>
        
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Get your free API key at{' '}
          <a 
            href="https://openweathermap.org/api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            openweathermap.org
          </a>
        </p>
      </Card>
    </div>
  );
};

export default SecretForm;