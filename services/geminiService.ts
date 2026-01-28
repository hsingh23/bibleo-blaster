import { AnalysisResult } from "../types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-3-flash-preview";

// Define the schema as a plain JavaScript object for the REST API
const reviewSchema = {
  type: "OBJECT",
  properties: {
    overallScore: {
      type: "NUMBER",
      description: "A score from 0 to 100 based on accuracy."
    },
    summaryMessage: {
      type: "STRING",
      description: "A very short, encouraging, funny summary sentence for a kid."
    },
    bibliographyReviews: {
      type: "ARRAY",
      description: "Reviews for the Bibliography section items",
      items: {
        type: "OBJECT",
        properties: {
          originalText: { type: "STRING" },
          status: { type: "STRING", enum: ["correct", "incorrect"] },
          correction: { type: "STRING" },
          primaryAuthor: { type: "STRING" },
          feedback: { type: "STRING" },
          emoji: { type: "STRING" }
        },
        required: ["originalText", "status", "feedback", "emoji", "primaryAuthor"]
      }
    },
    footnoteReviews: {
      type: "ARRAY",
      description: "Reviews for the Footnotes/Endnotes items. Must check for Ibid and Short forms.",
      items: {
        type: "OBJECT",
        properties: {
          originalText: { type: "STRING" },
          status: { type: "STRING", enum: ["correct", "incorrect"] },
          correction: { type: "STRING" },
          feedback: { type: "STRING" },
          emoji: { type: "STRING" }
        },
        required: ["originalText", "status", "feedback", "emoji"]
      }
    }
  },
  required: ["overallScore", "summaryMessage", "bibliographyReviews", "footnoteReviews"]
};

// Disable safety filters to prevent blocking on academic topics (e.g. wars, biology)
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

export const analyzeBibliography = async (bibliographyText: string, footnotesText: string | null, apiKey: string): Promise<AnalysisResult> => {
  if (!apiKey) throw new Error("API Key is missing!");

  const prompt = `
    You are the "BiblioBlaster," a fun, energetic AI robot that helps kids fix their citations.
    
    You are reviewing a student's report which uses **Chicago Manual of Style (17th Edition, Notes & Bibliography System)**.
    
    TASK 1: Review the **Bibliography** (if provided).
    - Check for formatting (Periods vs Commas, hanging indents implied, alphabetical).
    - Extract Primary Author for checking.

    TASK 2: Review the **Footnotes/Endnotes** (if provided).
    - **First Citation** of a source: MUST be **Long Form** (full details, but commas instead of periods, specific pages).
    - **Subsequent Citations** of the same source: MUST be **Short Form** (Author, *Title*, page).
    - **Immediate Consecutive Citation** (same source, same page or different): MUST use **"Ibid."** (or "Ibid., page").
    - Be strict about the sequence!
    
    Keep feedback SHORT and FUN. Use kid-friendly language (e.g. "Oopsie!", "Nailed it!", "Forgot the Ibid!").
    If it's a mess, just show the fix in the 'correction' field.
    
    DATA TO REVIEW:
    
    ${footnotesText ? `
    === FOOTNOTES SECTION (Check Ibid/Short form logic here) ===
    """
    ${footnotesText}
    """
    ` : '=== NO FOOTNOTES FOUND ==='}

    ${bibliographyText ? `
    === BIBLIOGRAPHY SECTION ===
    """
    ${bibliographyText}
    """
    ` : '=== NO BIBLIOGRAPHY FOUND ==='}
  `;

  try {
    const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: reviewSchema,
          temperature: 0.2
        },
        safetySettings: SAFETY_SETTINGS,
        systemInstruction: {
          parts: [{ text: "You are a helpful, high-energy coding assistant for kids. You love Chicago Style citations." }]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || `API Error: ${response.statusText}`;
      
      if (response.status === 400 && errorMessage.includes("API key")) {
        throw new Error("INVALID_API_KEY");
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AnalysisResult;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message === "INVALID_API_KEY") throw error;
    throw new Error(error.message || "My brain hurts! Something went wrong connecting to the AI.");
  }
};

export const extractTextFromImage = async (base64Data: string, mimeType: string, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing!");

  try {
    const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Data } },
            { text: "Transcribe all the text from this document accurately. Preserve newlines and basic formatting. If you see footnotes at the bottom, include them clearly." }
          ]
        }]
      })
    });

    if (!response.ok) {
       const errorData = await response.json();
       const errorMessage = errorData.error?.message || "Failed to read image.";
       if (response.status === 400 && errorMessage.includes("API key")) {
          throw new Error("INVALID_API_KEY");
       }
       throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error: any) {
    console.error("OCR Error:", error);
    if (error.message === "INVALID_API_KEY") throw error;
    throw new Error("I couldn't read that image! Try a clearer picture. " + error.message);
  }
};