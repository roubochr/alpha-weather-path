import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey } = await req.json()
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Test with a basic location lookup for New York
    const response = await fetch(
      `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=40.7128,-74.0060`
    )
    
    if (response.ok) {
      const data = await response.json()
      return new Response(
        JSON.stringify({ valid: true, location: data }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else if (response.status === 401) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid API key' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      return new Response(
        JSON.stringify({ valid: false, error: 'API validation failed' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Failed to validate API key' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})