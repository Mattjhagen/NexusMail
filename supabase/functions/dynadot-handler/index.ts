
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
      // Note: In production, you might want to add currency params or duration
      apiUrl += `&command=register&domain=${domain}&duration=1`;
    } else {
      throw new Error("Invalid action");
    }

    // Call Dynadot
    const response = await fetch(apiUrl);
    const xmlText = await response.text();

    // Parse XML to JSON
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xmlText);

    // Normalize Response
    let result = {};
    
    if (action === 'search') {
      const searchResponse = parsed.SearchResponse;
      if (searchResponse.ResponseCode !== 0) {
         // Dynadot returns non-zero code for errors, but sometimes '0' just means the request was received
         // Check Status
      }
      
      const searchResults = searchResponse.SearchResults;
      // Handle case where API might return array or single object, fast-xml-parser handles this usually but good to check structure
      // For single domain search (domain0):
      const item = searchResults?.SearchResult;
      
      if (item) {
        result = {
          domain: item.DomainName,
          available: item.Available === 'yes',
          price: item.Price,
          status: item.Status
        };
      } else {
        throw new Error("Invalid response from Dynadot");
      }
    } 
    else if (action === 'register') {
      const regResponse = parsed.RegisterResponse;
      const regResult = regResponse.RegisterResult;
      
      if (regResponse.ResponseCode == 0 && regResult.Success === 'yes') {
        result = {
          success: true,
          domain: regResult.DomainName,
          expiration: regResult.ExpirationDate,
          orderId: regResult.OrderId
        };
      } else {
        // Error handling
        const err = regResponse.ResponseError || "Registration failed";
        result = { success: false, error: err };
      }
    }

    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
