import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractTextFromPdfBytes(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Extract printable ASCII runs (min 4 chars) from binary
  let result = '';
  let current = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) {
      current += String.fromCharCode(c);
    } else {
      if (current.trim().length >= 4) result += current + ' ';
      current = '';
    }
  }
  if (current.trim().length >= 4) result += current;

  // Clean up excessive whitespace
  return result.replace(/\s+/g, ' ').trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64, pdfText } = await req.json();
    
    let text = pdfText || '';
    if (pdfBase64) {
      text = extractTextFromPdfBytes(pdfBase64);
    }
    
    if (!text || text.trim().length < 20) {
      return new Response(JSON.stringify({ success: false, error: "Could not extract readable text from PDF. Try a different file." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured professional profile data from LinkedIn PDF exports. Extract the person's full name, current headline/title, areas of expertise, network strengths, and any notable information.",
          },
          {
            role: "user",
            content: `Extract structured profile data from this LinkedIn PDF content:\n\n${text.slice(0, 8000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract structured profile data from LinkedIn PDF",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name" },
                  headline: { type: "string", description: "Current title/headline" },
                  expertiseTags: { type: "array", items: { type: "string" }, description: "3-6 expertise areas" },
                  networkStrengths: { type: "string", description: "Summary of network strengths and industry connections" },
                  notes: { type: "string", description: "Notable background, achievements, or relevant info" },
                },
                required: ["name", "headline", "expertiseTags", "networkStrengths", "notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limited, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured data returned");

    const profile = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-lead-pdf error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
