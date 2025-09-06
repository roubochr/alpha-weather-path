import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lat, lon } = await req.json()
    
    const apiKey = Deno.env.get('OPENWEATHER_API_KEY')
    if (!apiKey) {
      throw new Error('OpenWeather API key not configured in Supabase secrets')
    }

    // Get current weather
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    )
    
    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data')
    }
    
    const weatherData = await weatherResponse.json()
    
    // Get forecast
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    )
    
    const forecastData = await forecastResponse.json()
    
    const result = {
      current: {
        temperature: Math.round(weatherData.main.temp),
        humidity: weatherData.main.humidity,
        precipitation: weatherData.rain?.['1h'] || 0,
        condition: weatherData.weather[0].main,
        description: weatherData.weather[0].description,
        windSpeed: Math.round(weatherData.wind.speed * 3.6),
        pressure: weatherData.main.pressure,
        visibility: weatherData.visibility / 1000,
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