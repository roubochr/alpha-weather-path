import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lat, lon } = await req.json()
    
    if (!OPENWEATHER_API_KEY) {
      throw new Error('OpenWeather API key not configured')
    }

    // Get current weather
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    )
    
    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data')
    }
    
    const weatherData = await weatherResponse.json()
    
    // Get forecast for route planning
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
    )
    
    const forecastData = await forecastResponse.json()
    
    return new Response(
      JSON.stringify({
        current: {
          temperature: Math.round(weatherData.main.temp),
          humidity: weatherData.main.humidity,
          precipitation: weatherData.rain?.['1h'] || 0,
          condition: weatherData.weather[0].main,
          description: weatherData.weather[0].description,
          windSpeed: Math.round(weatherData.wind.speed * 3.6), // Convert m/s to km/h
          pressure: weatherData.main.pressure,
          visibility: weatherData.visibility / 1000, // Convert to km
          icon: weatherData.weather[0].icon
        },
        forecast: forecastData.list.slice(0, 8).map((item: any) => ({
          time: item.dt_txt,
          temperature: Math.round(item.main.temp),
          condition: item.weather[0].main,
          description: item.weather[0].description,
          precipitation: item.rain?.['3h'] || 0,
          windSpeed: Math.round(item.wind.speed * 3.6),
          icon: item.weather[0].icon
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})