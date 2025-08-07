import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  CloudRain, 
  Calendar,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { TravelRecommendation, TravelWindow } from '@/hooks/useTravelRecommendations';

interface TravelRecommendationsProps {
  recommendation: TravelRecommendation | null;
  loading: boolean;
  onSelectDeparture: (time: Date) => void;
}

const TravelRecommendations: React.FC<TravelRecommendationsProps> = ({
  recommendation,
  loading,
  onSelectDeparture
}) => {
  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Analyzing Travel Conditions...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) return null;

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getRiskIcon = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <CloudRain className="h-4 w-4" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMinutesFromNow = (date: Date) => {
    return Math.round((date.getTime() - Date.now()) / 60000);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Travel Recommendations
        </CardTitle>
        <CardDescription>
          AI-powered weather analysis for optimal departure timing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Conditions */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Current Conditions</h4>
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${getRiskColor(recommendation.currentConditions.riskLevel)}`}>
            {getRiskIcon(recommendation.currentConditions.riskLevel)}
            <span className="text-sm font-medium">
              {recommendation.currentConditions.message}
            </span>
          </div>
        </div>

        {/* Main Recommendation */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Recommendation</h4>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              {recommendation.shouldWait ? (
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {recommendation.shouldWait ? 'Consider Waiting' : 'Safe to Depart'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {recommendation.reason}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Weather Improvement Forecast */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Weather Outlook</h4>
          <div className="flex items-center gap-2 p-3 bg-background border rounded-lg">
            {recommendation.improvementForecast.willImprove ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {recommendation.improvementForecast.message}
            </span>
          </div>
        </div>

        <Separator />

        {/* Optimal Departure Windows */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Departure Time Options</h4>
          <div className="space-y-2">
            {recommendation.alternativeWindows.map((window, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {formatTime(window.departureTime)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getMinutesFromNow(window.departureTime) === 0 
                        ? 'Now' 
                        : `${getMinutesFromNow(window.departureTime)}m`
                      }
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getRiskColor(window.riskLevel)}`}
                    >
                      {window.riskLevel.toUpperCase()} RISK
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Max: {window.maxRainIntensity.toFixed(1)}mm/h
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={index === 0 ? "default" : "outline"}
                  onClick={() => onSelectDeparture(window.departureTime)}
                  className="text-xs"
                >
                  {index === 0 ? 'Best' : 'Select'}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectDeparture(new Date())}
            className="flex-1"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Depart Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectDeparture(recommendation.bestDepartureTime)}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            Optimal Time
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TravelRecommendations;