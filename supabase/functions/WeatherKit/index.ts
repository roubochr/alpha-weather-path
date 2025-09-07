import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts"
import { corsHeaders } from "../_shared/cors.ts"

// WeatherKit JWT creation function
async function createWeatherKitJWT(): Promise<string> {
  const teamId = Deno.env.get('WEATHERKIT_TEAM_ID')!;
  const keyId = Deno.env.get('WEATHERKIT_KEY_ID')!;
  const privateKey = Deno.env.get('WEATHERKIT_PRIVATE_KEY')!;
  const serviceId = Deno.env.get('WEATHERKIT_SERVICE_ID')!;

  // Clean and format the private key
  const cleanPrivateKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const pemKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;

  // Import the private key
  const keyData = new TextEncoder().encode(pemKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );

  // Create JWT header and payload
  const header = {
    alg: 'ES256',
    kid: keyId,
    id: `${teamId}.${serviceId}`,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 3600, // 1 hour expiration
    sub: serviceId,
  };

  // Create and return the JWT
  return await create(header, payload, cryptoKey);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lat, lon } = await req.json();

    if (!lat || !lon) {
      throw new Error('Latitude and longitude are required');
    }

    console.log(`Fetching weather for coordinates: ${lat}, ${lon}`);

    // Create WeatherKit JWT
    const token = await createWeatherKitJWT();

    // Fetch current weather and hourly forecast from WeatherKit
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=currentWeather`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Apple-Weather-Kit-Client': 'weatherkit-client',
        },
      }),
      fetch(`https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=forecastHourly`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Apple-Weather-Kit-Client': 'weatherkit-client',
        },
      })
    ]);

    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error(`WeatherKit API error: ${currentResponse.status} / ${forecastResponse.status}`);
    }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    // Process the data to match our interface
    const current = currentData.currentWeather;
    const hourlyForecast = forecastData.forecastHourly?.hours || [];

    const processedData = {
      current: {
        temperature: Math.round(current.temperature),
        humidity: Math.round(current.humidity * 100),
        precipitation: current.precipitationIntensity || 0,
        condition: current.conditionCode,
        description: current.conditionCode.toLowerCase(),
        windSpeed: Math.round(current.windSpeed),
        pressure: current.pressure,
        visibility: current.visibility,
        icon: current.conditionCode,
      },
      forecast: hourlyForecast.slice(0, 8).map((hour: any) => ({
        time: hour.forecastStart,
        temperature: Math.round(hour.temperature),
        condition: hour.conditionCode,
        description: hour.conditionCode.toLowerCase(),
        precipitation: hour.precipitationIntensity || 0,
        windSpeed: Math.round(hour.windSpeed),
        icon: hour.conditionCode,
      })),
    };

    return new Response(
      JSON.stringify(processedData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('WeatherKit function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});