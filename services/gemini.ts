
import { GoogleGenAI, Type } from "@google/genai";
import { AIInsight } from "../types";

export const analyzeEmail = async (emailContent: string, subject: string): Promise<AIInsight> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following email and extract structured insights.
    Subject: ${subject}
    Content: ${emailContent}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "A concise summary of the email." },
          sentiment: { 
            type: Type.STRING, 
            description: "Sentiment of the sender.",
            enum: ["positive", "neutral", "negative", "frustrated"] 
          },
          suggestedTasks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of actionable tasks found in the email."
          },
          suggestedTicket: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              priority: { 
                type: Type.STRING,
                enum: ["low", "medium", "high", "urgent"]
              }
            },
            description: "If an issue needs support tracking, suggest a ticket title and priority."
          }
        },
        required: ["summary", "sentiment", "suggestedTasks"]
      }
    }
  });

  try {
    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr) as AIInsight;
  } catch (err) {
    console.error("Failed to parse Gemini response", err);
    throw new Error("Analysis failed");
  }
};

export const draftReply = async (emailContent: string, context: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Draft a professional and helpful reply to the following email.
    
    Email Content: ${emailContent}
    Instructions/Context: ${context}
    
    Respond with only the draft text.`,
  });
  return response.text || "Failed to generate draft.";
};

export interface DNSInstruction {
  type: 'MX' | 'TXT' | 'CNAME';
  name: string;
  content: string;
  priority?: number;
  purpose: string;
}

// Updated to accept a specific verification token to enforce real checks
export const getDNSInstructions = async (domain: string, verificationToken: string): Promise<DNSInstruction[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate the required DNS records for the domain "${domain}" to connect it to NexusMail AI services.
    
    CRITICAL REQUIREMENT:
    You MUST include a TXT record with the EXACT content: "${verificationToken}" for domain ownership verification.
    
    Also include MX for mail delivery (mx.p3lending.space) and TXT for SPF (v=spf1 include:_spf.p3lending.space ~all).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["MX", "TXT", "CNAME"] },
            name: { type: Type.STRING },
            content: { type: Type.STRING },
            priority: { type: Type.NUMBER },
            purpose: { type: Type.STRING }
          },
          required: ["type", "name", "content", "purpose"]
        }
      }
    }
  });

  try {
    const jsonStr = response.text?.trim() || "[]";
    return JSON.parse(jsonStr) as DNSInstruction[];
  } catch (err) {
    console.error("Failed to generate DNS instructions", err);
    // Fallback if AI fails, ensuring the critical token is present
    return [
      { type: 'TXT', name: '@', content: verificationToken, purpose: 'Domain Ownership Verification' },
      { type: 'MX', name: '@', content: 'mx1.p3lending.space', priority: 10, purpose: 'Primary mail routing' },
      { type: 'TXT', name: '@', content: 'v=spf1 include:_spf.p3lending.space ~all', purpose: 'SPF Anti-spam protection' }
    ];
  }
};

// Real DNS Checker using Google Public DNS API
export const verifyDNSRecord = async (domain: string, token: string): Promise<boolean> => {
  try {
    // Uses Google's DNS-over-HTTPS API to check TXT records
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
    const data = await response.json();
    
    if (!data.Answer) return false;
    
    // Check if any TXT record contains our token
    return data.Answer.some((record: any) => record.data && record.data.includes(token));
  } catch (error) {
    console.error("DNS Verification Failed:", error);
    return false;
  }
};
