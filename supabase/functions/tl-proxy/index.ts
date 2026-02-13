
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse Body
    let bodyData;
    try {
        bodyData = await req.json();
    } catch (e: any) {
        return new Response(JSON.stringify({ error: "Invalid JSON body", details: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }

    const { action, client_id, client_secret, code, refresh_token, redirect_uri, url, method, body, headers } = bodyData;

    console.log(`[TL-Proxy] Processing Action: ${action}`);

    // --- 1. TOKEN EXCHANGE (Authorization Code Grant) ---
    if (action === 'exchange') {
        const tokenUrl = 'https://focus.teamleader.eu/oauth2/access_token';
        
        console.log(`[TL-Proxy] Exchanging code. URI: ${redirect_uri}`);

        const params = new URLSearchParams();
        params.append('client_id', client_id);
        params.append('client_secret', client_secret);
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('redirect_uri', redirect_uri);

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('[Exchange Error Upstream]', data);
            // We return 200 so the client can read the error JSON
            return new Response(JSON.stringify({ error: data, upstreamStatus: response.status }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
            });
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // --- 2. TOKEN REFRESH ---
    if (action === 'refresh') {
        const tokenUrl = 'https://focus.teamleader.eu/oauth2/access_token';
        
        const params = new URLSearchParams();
        params.append('client_id', client_id);
        params.append('client_secret', client_secret);
        params.append('refresh_token', refresh_token);
        params.append('grant_type', 'refresh_token');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();

        if (!response.ok) {
             console.error('[Refresh Error Upstream]', data);
             return new Response(JSON.stringify({ error: data, upstreamStatus: response.status }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // --- 3. API REQUEST PROXY ---
    if (action === 'request' || !action) {
        // Security check
        if (!url || !url.includes('teamleader.eu')) {
            return new Response(JSON.stringify({ error: "Only Teamleader URLs allowed", upstreamStatus: 403 }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const response = await fetch(url, {
            method: method || 'GET',
            headers: headers,
            body: body || undefined,
        })

        const responseText = await response.text()
        let responseData;
        try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

        if (!response.ok) {
            return new Response(JSON.stringify({ error: responseData, upstreamStatus: response.status }), {
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    return new Response(JSON.stringify({ error: "Invalid Action" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    });

  } catch (error: any) {
    console.error(`[Proxy Internal Error]`, error);
    return new Response(JSON.stringify({ error: error.message, upstreamStatus: 500 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
