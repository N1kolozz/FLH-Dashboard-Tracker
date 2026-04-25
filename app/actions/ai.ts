"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google Generative AI SDK
// The user will need to add GEMINI_API_KEY to their .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateItinerary(prompt: string) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { 
        success: false, 
        error: "GEMINI_API_KEY is not set in your environment variables. Please add it to your .env file." 
      };
    }

    const model = genAI.getGenerativeModel({ model: "gemma-4-31b-it" });

    const systemInstruction = `You are an expert event planner AI. You help generate structured event itineraries and logistics details based on brief user inputs.
You MUST output all text (title, description, and location) in grammatically correct, formal Georgian language (ქართული).

CRITICAL GEORGIAN TERMINOLOGY RULES:
- ALWAYS use the word "ღონისძიება" (event) and its correct forms (e.g., "ღონისძიების"). NEVER use incorrect forms like "ღონისმევის".
- ALWAYS use the word "ლოჯისტიკა" (logistics). NEVER use "ლოგისტიკა".
- Ensure spelling, grammar, and phrasing are perfectly natural in Georgian.

You MUST output a valid JSON object with EXACTLY the following fields:
- "title": A short, professional title for the event in Georgian (string).
- "department": One of the following exact string values representing the best fit: "pr", "logistics", "projects", "all", "other".
- "description": A detailed itinerary, list of required logistics/equipment, and team roles, formatted professionally with line breaks, in Georgian (string).
- "location": A short string representing the location in Georgian if mentioned, or "" (empty string).
- "time": A suggested start time in HH:mm format (e.g., "09:00" or "14:30") if implied, or "" (empty string).
- "endTime": A suggested end time in HH:mm format, or "" (empty string).

Do NOT include any markdown formatting. Return strictly the raw JSON object.`;

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "user", parts: [{ text: `Generate event details for this idea: ${prompt}` }] }
      ]
    });
    
    const responseText = result.response.text();
    
    // Find the first balanced JSON object in the response
    let jsonString = "";
    const firstOpen = responseText.indexOf('{');
    if (firstOpen !== -1) {
      let depth = 0;
      for (let i = firstOpen; i < responseText.length; i++) {
        if (responseText[i] === '{') depth++;
        else if (responseText[i] === '}') {
          depth--;
          if (depth === 0) {
            jsonString = responseText.substring(firstOpen, i + 1);
            break;
          }
        }
      }
    }

    if (!jsonString) {
      throw new Error("Model did not return a valid JSON object.");
    }
    
    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch (error: any) {
    console.error("AI Generation error:", error);
    return { success: false, error: error.message || "Failed to generate itinerary. Please try again." };
  }
}
