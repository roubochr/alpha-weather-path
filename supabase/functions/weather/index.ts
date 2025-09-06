import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'

// Helper function to create JWT for WeatherKit authentication
async function createWeatherKitJWT(): Promise<string> {
  const keyId = Deno.env.get('WEATHERKIT_KEY_ID')
  const privateKey = Deno.env.get('WEATHERKIT_PRIVATE_KEY')
  
  if (!keyId || !privateKey) {
    throw new Error('WeatherKit credentials not configured in Supabase secrets')
  }

  // Clean up the private key format
  const cleanPrivateKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/\n?-----END PRIVATE KEY-----/, '')
    .trim()

  const pemKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`

  // Import the private key
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(pemKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const header = {
    alg: 'ES256',
    kid: keyId,
    id: 'com.apple.weatherkit.client'
  }

  const payload = {
    iss: 'com.apple.weatherkit.client',
    iat: getNumericDate(new Date()),
    exp: getNumericDate(new Date(Date.now() + 3600000)), // 1 hour
    sub: 'com.apple.weatherkit.client'
  }

  return await create(header, payload, cryptoKey)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lat, lon } = await req.json()
    
    // Create JWT token for WeatherKit authentication
    const token = await createWeatherKitJWT()
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Get current weather from WeatherKit
    const weatherResponse = await fetch(
      `https://weatherkit.apple.com/api/v1/weather/en_US/${lat}/${lon}?dataSets=currentWeather,forecastDaily,forecastHourly&timezone=UTC`,
      { headers }
    )
    
    if (!weatherResponse.ok) {
      throw new Error(`WeatherKit API error: ${weatherResponse.status}`)
    }
    
    const weatherData = await weatherResponse.json()
    
    const result = {
      current: {
        temperature: Math.round(weatherData.currentWeather.temperature),
        humidity: Math.round(weatherData.currentWeather.humidity * 100),
        precipitation: weatherData.currentWeather.precipitationIntensity || 0,
        condition: weatherData.currentWeather.conditionCode,
        description: weatherData.currentWeather.conditionCode.toLowerCase(),
        windSpeed: Math.round(weatherData.currentWeather.windSpeed * 3.6),
        pressure: weatherData.currentWeather.pressure,
        visibility: weatherData.currentWeather.visibility,
        icon: weatherData.currentWeather.conditionCode
      },
      forecast: weatherData.forecastHourly.hours.slice(0, 8).map((item: any) => ({
        time: item.forecastStart,
        temperature: Math.round(item.temperature),
        condition: item.conditionCode,
        description: item.conditionCode.toLowerCase(),
        precipitation: item.precipitationIntensity || 0,
        windSpeed: Math.round(item.windSpeed * 3.6),
        icon: item.conditionCode
      }))
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})