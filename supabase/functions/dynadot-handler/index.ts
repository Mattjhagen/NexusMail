
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { XMLParser } from "npm:fast-xml-parser@4.3.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keys from configuration
const DYNADOT_API_KEY = "7r6W8ANI7T8W9KJmu8WI7i81C"; 

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, domain } = await req.json();

    if (!domain) throw new Error("Domain is required");

    let apiUrl = `https://api.dynadot.com/api3.xml?key=${DYNADOT_API_KEY}`;

    if (action === 'search') {
      // Search for domain availability and price
      apiUrl += `&command=search&domain0=${domain}&show_price=1`;
    } else if (action === 'register') {
      // Register domain (Uses account balance)
      apiUrl += `&command=register&domain=${domain}&duration=1`;
    } else {
      throw new Error("Invalid action");
    }

    // Call Dynadot with User-Agent to avoid blocking
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'NexusMailPro/1.0 (Deno Edge Function)'
      }
    });
    
    if (!response.ok) {
       throw new Error(`Dynadot API Network Error: ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Parse XML to JSON
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xmlText);

    // Normalize Response
    let result = {};
    
    if (action === 'search') {
      const searchResponse = parsed.SearchResponse;
      const header = searchResponse?.SearchHeader;

      if (header && header.ResponseCode != 0) {
         // API returned an error code
         const err = header.Error || "Unknown Search Error";
         return new Response(JSON.stringify({ error: err }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
      }
      
      const searchResults = searchResponse?.SearchResults;
      const item = searchResults?.SearchResult;
      
      if (item) {
        result = {
          domain: item.DomainName,
          available: item.Available === 'yes',
          price: item.Price,
          status: item.Status
        };
      } else {
         // If structure is unexpected but no explicit error code
         result = { error: "Invalid response structure from Dynadot" };
      }
    } 
    else if (action === 'register') {
      const regResponse = parsed.RegisterResponse;
      const header = regResponse?.RegisterHeader;

      if (header && header.ResponseCode != 0) {
         // Extract API specific error (e.g., "Insufficient funds", "Invalid Domain")
         const err = header.Error || "Registration failed at API gateway";
         // Return 200 with error field so client can display it
         return new Response(JSON.stringify({ success: false, error: err }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
      }

      const regResult = regResponse?.RegisterResult;
      
      if (regResult && regResult.Success === 'yes') {
        result = {
          success: true,
          domain: regResult.DomainName,
          expiration: regResult.ExpirationDate,
          orderId: regResult.OrderId
        };
      } else {
         // Fallback error
        const err = regResponse?.ResponseError || "Registration failed";
        result = { success: false, error: err };
      }
    }

    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    // Return 200 for handled logic errors to distinguish from system crashes, 
    // unless it's a critical failure which might throw 400.
    // Here we choose to return error in body for frontend to decide.
    console.error("Handler Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
