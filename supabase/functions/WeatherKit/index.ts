import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'

// Helper functions for processing WeatherKit data
function getConditionDescription(conditionCode: string | undefined): string {
  if (!conditionCode) return 'clear'
  
  const descriptions: { [key: string]: string } = {
    'Clear': 'clear sky',
    'Cloudy': 'cloudy',
    'PartlyCloudy': 'partly cloudy',
    'MostlyCloudy': 'mostly cloudy',
    'Rain': 'rain',
    'Drizzle': 'drizzle',
    'HeavyRain': 'heavy rain',
    'Snow': 'snow',
    'Sleet': 'sleet',
    'Hail': 'hail',
    'Thunderstorms': 'thunderstorms',
    'SevereThunderstorms': 'severe thunderstorms',
    'Fog': 'fog',
    'Windy': 'windy',
    'Breezy': 'breezy'
  }
  
  return descriptions[conditionCode] || conditionCode.toLowerCase()
}

function mapConditionToIcon(conditionCode: string | undefined): string {
  if (!conditionCode) return '01d'
  
  const iconMap: { [key: string]: string } = {
    'Clear': '01d',
    'PartlyCloudy': '02d',
    'Cloudy': '03d',
    'MostlyCloudy': '04d',
    'Rain': '10d',
    'Drizzle': '09d',
    'HeavyRain': '10d',
    'Snow': '13d',
    'Sleet': '13d',
    'Hail': '13d',
    'Thunderstorms': '11d',
    'SevereThunderstorms': '11d',
    'Fog': '50d',
    'Windy': '01d',
    'Breezy': '01d'
  }
  
  return iconMap[conditionCode] || '01d'
}

// Helper function to create JWT for WeatherKit authentication
async function createWeatherKitJWT(): Promise<string> {
  const keyId = Deno.env.get('WEATHERKIT_KEY_ID')
  const teamId = Deno.env.get('WEATHERKIT_TEAM_ID')
  const privateKey = Deno.env.get('WEATHERKIT_PRIVATE_KEY')
  const serviceId = Deno.env.get('WEATHERKIT_SERVICE_ID')
  
  console.log('WeatherKit JWT: Starting JWT creation process')
  console.log('WeatherKit JWT: Key ID exists:', !!keyId)
  console.log('WeatherKit JWT: Team ID exists:', !!teamId)
  console.log('WeatherKit JWT: Private key exists:', !!privateKey)
  console.log('WeatherKit JWT: Service ID exists:', !!serviceId)
  
  if (!keyId || !teamId || !privateKey || !serviceId) {
    const missing = []
    if (!keyId) missing.push('WEATHERKIT_KEY_ID')
    if (!teamId) missing.push('WEATHERKIT_TEAM_ID')
    if (!privateKey) missing.push('WEATHERKIT_PRIVATE_KEY')
    if (!serviceId) missing.push('WEATHERKIT_SERVICE_ID')
    throw new Error(`WeatherKit credentials missing: ${missing.join(', ')}`)
  }

  try {
    // Handle P8 key format - Apple provides keys in P8 format, not PEM
    let processedKey = privateKey.trim()
    
    // Remove any PEM headers if present and clean up
    processedKey = processedKey
      .replace(/\\n/g, '\n')
      .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
      .replace(/\n?-----END PRIVATE KEY-----/, '')
      .replace(/-----BEGIN EC PRIVATE KEY-----\n?/, '')
      .replace(/\n?-----END EC PRIVATE KEY-----/, '')
      .trim()

    // Convert to proper PEM format for Web Crypto API
    const pemKey = `-----BEGIN PRIVATE KEY-----\n${processedKey}\n-----END PRIVATE KEY-----`
    console.log('WeatherKit JWT: Private key formatted for import')

    // Decode base64 to binary
    const binaryKey = Uint8Array.from(atob(processedKey.replace(/\s/g, '')), c => c.charCodeAt(0))
    
    // Import the private key for ES256 signing
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )
    console.log('WeatherKit JWT: Private key imported successfully')

    const now = Math.floor(Date.now() / 1000)
    
    const header = {
      alg: 'ES256',
      kid: keyId,
      typ: 'JWT'
    }

    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 3600, // 1 hour from now
      sub: serviceId // Use the WeatherKit Service ID
    }

    console.log('WeatherKit JWT: Creating JWT with header:', { ...header, kid: '[REDACTED]' })
    console.log('WeatherKit JWT: Creating JWT with payload:', { ...payload, iss: '[REDACTED]', sub: '[REDACTED]' })

    const token = await create(header, payload, cryptoKey)
    console.log('WeatherKit JWT: JWT created successfully, length:', token.length)
    
    return token
  } catch (error) {
    console.error('WeatherKit JWT: Error creating JWT token:', error)
    console.error('WeatherKit JWT: Error details:', error.message)
    console.error('WeatherKit JWT: Error stack:', error.stack)
    throw new Error(`Failed to create WeatherKit JWT: ${error.message}`)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200
    })
  }

  try {
    const { lat, lon } = await req.json()
    console.log('WeatherKit API: Request received for coordinates:', { lat, lon })
    
    // Create JWT token for WeatherKit authentication
    const token = await createWeatherKitJWT()
    console.log('WeatherKit API: JWT token created successfully')
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Get current weather from WeatherKit - correct API format
    // timezone parameter is required according to Apple's documentation
    const weatherUrl = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=currentWeather,forecastHourly&timezone=UTC`
    console.log('WeatherKit API: Making request to:', weatherUrl)
    console.log('WeatherKit API: Using headers:', { 'Authorization': 'Bearer [REDACTED]' })
    
    const weatherResponse = await fetch(weatherUrl, { 
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    
    console.log('WeatherKit API: Response status:', weatherResponse.status)
    console.log('WeatherKit API: Response headers:', Object.fromEntries(weatherResponse.headers.entries()))
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text()
      console.error('WeatherKit API error:', weatherResponse.status, errorText)
      console.error('WeatherKit API: Full error response:', errorText)
      throw new Error(`WeatherKit API error: ${weatherResponse.status} - ${errorText}`)
    }
    
    const weatherData = await weatherResponse.json()
    console.log('WeatherKit API: Raw response data:', JSON.stringify(weatherData, null, 2))
    
    // Process WeatherKit response data according to Apple's API structure
    const result = {
      current: {
        temperature: Math.round(weatherData.currentWeather?.temperature || 20),
        humidity: Math.round((weatherData.currentWeather?.humidity || 0.6) * 100),
        precipitation: weatherData.currentWeather?.precipitationIntensity || 0,
        condition: weatherData.currentWeather?.conditionCode || 'Clear',
        description: getConditionDescription(weatherData.currentWeather?.conditionCode),
        windSpeed: Math.round(weatherData.currentWeather?.windSpeed || 10),
        pressure: Math.round(weatherData.currentWeather?.pressure || 1013),
        visibility: Math.round((weatherData.currentWeather?.visibility || 10000) / 1000), // Convert meters to km
        icon: mapConditionToIcon(weatherData.currentWeather?.conditionCode)
      },
      forecast: (weatherData.forecastHourly?.hours || []).slice(0, 8).map((item: any) => ({
        time: item.forecastStart,
        temperature: Math.round(item.temperature || 20),
        condition: item.conditionCode || 'Clear',
        description: getConditionDescription(item.conditionCode),
        precipitation: item.precipitationIntensity || 0,
        windSpeed: Math.round(item.windSpeed || 10),
        icon: mapConditionToIcon(item.conditionCode)
      }))
    }

    console.log('WeatherKit API: Processed result:', JSON.stringify(result, null, 2))
    
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
    console.error('WeatherKit API: Error in weather function:', error)
    console.error('WeatherKit API: Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check Supabase function logs for more information'
      }),
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