import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Client
    const supabaseClient = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Parse Request
    const { action, domain, records } = await req.json();

    // Verify User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get Cloudflare Secret
    const CF_TOKEN = (Deno as any).env.get('CLOUDFLARE_API');
    if (!CF_TOKEN) {
      throw new Error('Configuration Error: CLOUDFLARE_API secret is missing.');
    }

    if (action === 'sync-dns') {
      // 1. Fetch Zone ID from Cloudflare
      const zoneResp = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const zoneData = await zoneResp.json();
      
      if (!zoneData.success) {
        throw new Error(`Cloudflare API Error: ${zoneData.errors?.[0]?.message || 'Unknown error'}`);
      }
      
      if (zoneData.result.length === 0) {
        throw new Error(`Zone not found. Please ensure '${domain}' is active in the P3 Lending Cloudflare account.`);
      }

      const zoneId = zoneData.result[0].id;
      const results = [];

      // 2. Iterate and Create DNS Records
      for (const rec of records) {
        // Construct Cloudflare Record Object
        const cfRecord = {
          type: rec.type,
          name: rec.name === '@' ? domain : rec.name,
          content: rec.content,
          ttl: 3600, // 1 hour
          priority: rec.priority || 10,
          proxied: false // Email records should not be proxied
        };

        const createResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cfRecord)
        });

        const createResult = await createResp.json();
        
        // If error is "Record already exists", we consider it a success/pass
        if (!createResult.success) {
           const isDuplicate = createResult.errors?.some((e: any) => e.code === 81053 || e.message?.includes('already exists'));
           if (!isDuplicate) {
             console.error(`Failed to create record ${rec.type} ${rec.name}:`, createResult.errors);
             results.push({ ...rec, status: 'failed', error: createResult.errors?.[0]?.message });
           } else {
             results.push({ ...rec, status: 'exists' });
           }
        } else {
           results.push({ ...rec, status: 'created' });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    throw new Error(`Invalid action: ${action}`);

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});