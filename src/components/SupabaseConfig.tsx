import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Save, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SupabaseConfigProps {
  onConfigSaved?: () => void;
}

export const SupabaseConfig: React.FC<SupabaseConfigProps> = ({ onConfigSaved }) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load existing configuration from localStorage
    const savedUrl = localStorage.getItem('supabase-url');
    const savedKey = localStorage.getItem('supabase-anon-key');
    
    if (savedUrl) setUrl(savedUrl);
    if (savedKey) setAnonKey(savedKey);
    
    setIsValid(!!(savedUrl && savedKey));
  }, []);

  const handleSave = () => {
    if (!url || !anonKey) {
      toast({
        title: "Missing Configuration",
        description: "Please provide both Supabase URL and Anon Key",
        variant: "destructive"
      });
      return;
    }

    // Basic validation
    if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      toast({
        title: "Invalid URL",
        description: "Supabase URL should start with https:// and contain .supabase.co",
        variant: "destructive"
      });
      return;
    }

    if (anonKey.length < 100) {
      toast({
        title: "Invalid Key",
        description: "Supabase Anon Key appears to be too short",
        variant: "destructive"
      });
      return;
    }

    // Save to localStorage
    localStorage.setItem('supabase-url', url);
    localStorage.setItem('supabase-anon-key', anonKey);
    
    setIsValid(true);
    
    toast({
      title: "Configuration Saved",
      description: "Supabase configuration has been saved successfully"
    });

    onConfigSaved?.();
  };

  const handleClear = () => {
    localStorage.removeItem('supabase-url');
    localStorage.removeItem('supabase-anon-key');
    setUrl('');
    setAnonKey('');
    setIsValid(false);
    
    toast({
      title: "Configuration Cleared",
      description: "Supabase configuration has been cleared"
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Supabase Configuration
        </CardTitle>
        <CardDescription>
          Configure your Supabase project URL and anon key for weather data functionality.
          {isValid && (
            <span className="text-green-600 font-medium"> ✓ Configuration saved</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supabase-url">Supabase Project URL</Label>
          <Input
            id="supabase-url"
            type="url"
            placeholder="https://your-project.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Find this in your Supabase project settings under "Project URL"
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="supabase-key">Supabase Anon Key</Label>
          <div className="relative">
            <Input
              id="supabase-key"
              type={showKey ? "text" : "password"}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Find this in your Supabase project settings under "Project API keys" → "anon public"
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Configuration
          </Button>
          {isValid && (
            <Button variant="outline" onClick={handleClear}>
              Clear Configuration
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};