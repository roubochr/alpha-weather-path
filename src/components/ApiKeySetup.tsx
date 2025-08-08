import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CloudRain, Key, ExternalLink, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKeySetupProps {
  onApiKeySet: () => void;
  onClose?: () => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onApiKeySet, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setLoading(true);
    try {
      // Store in localStorage for immediate use
      localStorage.setItem('openweather-api-key', apiKey.trim());
      
      toast({
        title: "API Key Saved",
        description: "Your OpenWeather API key has been saved. You can now use real weather data!",
      });
      
      onApiKeySet();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 bg-background relative">
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-2 right-2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="text-center mb-6 pr-8">
          <div className="relative mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <CloudRain className="h-8 w-8 text-primary" />
            <Key className="h-4 w-4 text-primary absolute -top-1 -right-1" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Add OpenWeather API Key</h2>
          <p className="text-muted-foreground text-sm">
            Enter your API key to enable real weather data
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Your OpenWeather API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={!apiKey.trim() || loading} 
              className="flex-1"
            >
              {loading ? "Saving..." : "Save API Key"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => window.open('https://openweathermap.org/api', '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </form>
        
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Get your free API key:</strong><br />
            1. Visit openweathermap.org<br />
            2. Create an account<br />
            3. Go to API Keys section<br />
            4. Copy your default API key
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ApiKeySetup;