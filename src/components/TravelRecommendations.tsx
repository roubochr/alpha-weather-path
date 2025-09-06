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
  // Debug logging to check if wind data is present
  React.useEffect(() => {
    if (recommendation && recommendation.alternativeWindows.length > 0) {
      const firstWindow = recommendation.alternativeWindows[0];
      console.log('TravelRecommendations - First window data:', firstWindow);
      console.log('TravelRecommendations - Properties check:', {
        hasMaxWindSpeed: 'maxWindSpeed' in firstWindow,
        hasMaxRainIntensity: 'maxRainIntensity' in firstWindow,
        hasPrimaryRiskFactor: 'primaryRiskFactor' in firstWindow,
        maxWindSpeed: firstWindow.maxWindSpeed,
        maxRainIntensity: firstWindow.maxRainIntensity,
        primaryRiskFactor: firstWindow.primaryRiskFactor,
        riskLevel: firstWindow.riskLevel
      });
    }
  }, [recommendation]);
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
              {recommendation.currentConditions.conditionsMessage}
            </span>
          </div>
        </div>

        {/* Main Recommendation */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Recommendation</h4>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              {recommendation.immediateAction.includes('Delay') ? (
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {recommendation.immediateAction}
                </p>
                <p className="text-sm text-muted-foreground">
                  {recommendation.generalAdvice}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Weather Improvement Forecast */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Weather Outlook</h4>
          <div className="flex items-center gap-2 p-3 bg-background border rounded-lg">
            {recommendation.currentConditions.improvementForecast.willImprove ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {recommendation.currentConditions.improvementForecast.message}
            </span>
          </div>
        </div>

        <Separator />

        {/* Optimal Departure Windows */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Departure Time Options</h4>
          <div className="space-y-2">
            {recommendation.alternativeWindows
              .filter(window => {
                const minutesFromNow = getMinutesFromNow(window.departureTime);
                return minutesFromNow >= -5; // Show times up to 5 minutes in the past
              })
              .map((window, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="text-center flex-shrink-0">
                    <div className="text-sm font-medium">
                      {formatTime(window.departureTime)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getMinutesFromNow(window.departureTime) === 0 
                        ? 'Now' 
                        : getMinutesFromNow(window.departureTime) < 0
                        ? `${Math.abs(getMinutesFromNow(window.departureTime))}m ago`
                        : `${getMinutesFromNow(window.departureTime)}m`
                      }
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0.5 ${getRiskColor(window.riskLevel)} whitespace-nowrap`}
                    >
                      {window.riskLevel.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      <div className="truncate">
                        {(window.primaryRiskFactor === 'wind' && window.maxWindSpeed !== undefined) ? (
                          `Wind: ${window.maxWindSpeed.toFixed(0)}km/h`
                        ) : (window.primaryRiskFactor === 'combined' && window.maxWindSpeed !== undefined) ? (
                          `${window.maxRainIntensity.toFixed(1)}mm/h + ${window.maxWindSpeed.toFixed(0)}km/h`
                        ) : (
                          `Rain: ${window.maxRainIntensity.toFixed(1)}mm/h`
                        )}
                      </div>
                      {window.maxWindSpeed !== undefined && window.primaryRiskFactor !== 'wind' && window.primaryRiskFactor !== 'combined' && (
                        <div className="text-[11px] text-gray-400 truncate">
                          Wind: {window.maxWindSpeed.toFixed(0)}km/h
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={index === 0 ? "default" : "outline"}
                  onClick={() => onSelectDeparture(window.departureTime)}
                  className="text-xs flex-shrink-0 ml-2"
                  disabled={getMinutesFromNow(window.departureTime) < -5}
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
            onClick={() => onSelectDeparture(recommendation.alternativeWindows[0]?.departureTime || new Date())}
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