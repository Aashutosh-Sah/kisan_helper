import Groq from "groq-sdk";

export interface DiagnosisRequest {
  type: "crop" | "animal";
  subject: string; // e.g. "Tomato", "Cow"
  description: string;
  imageBase64?: string; // Optional image data for vision
}

export interface DiagnosisResult {
  doctorMessage: string;
  diagnosis: string;
  remedy: string;
  preventiveMeasures: string;
  isEmergency: boolean;
  nepaliTranslation: {
    doctorMessage: string;
    diagnosis: string;
    remedy: string;
  };
}

export class GroqService {
  static async diagnose(req: DiagnosisRequest): Promise<DiagnosisResult> {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error("GROQ_API_KEY environment variable is not configured.");
    }
    const groq = new Groq({ apiKey: key });

    const prompt = `
You are a highly empathetic, expert agricultural scientist and veterinary doctor from Nepal. 
A farmer is coming to you for help with their ${req.type === 'crop' ? 'crops' : 'livestock'}.
Talk to them directly like a caring, real human doctor giving personal advice, using an interactive and compassionate tone.

Analyze the following user-submitted issue:
Subject/Species/Crop: ${req.subject}
Issue Description: ${req.description}

Provide a structured diagnosis JSON response matching this exact schema:
{
  "doctorMessage": "A warm, personal, and empathetic message speaking directly to the farmer. Sound like a real doctor (e.g., 'Hello there! I see you are worried about your... don't worry, let's take a look at what we can do.')",
  "diagnosis": "Clear, simple name of the disease/pest/condition in English",
  "remedy": "Detailed step-by-step treatment or organic/chemical remedy suitable for Nepali farmers (available local resources), written as friendly instructions",
  "preventiveMeasures": "How to prevent this in the future, given as caring advice",
  "isEmergency": true/false (true ONLY if it is life-threatening or highly contagious),
  "nepaliTranslation": {
    "doctorMessage": "The same warm, empathetic greeting and reassurance translated naturally into conversational Nepali (Devanagari script)",
    "diagnosis": "Name of the diagnosis in Nepali (Devanagari script)",
    "remedy": "The friendly treatment steps translated into clear, simple Nepali language"
  }
}

Return ONLY valid JSON. Do not wrap in markdown or include any other text.
`;

    let messages: any[] = [];
    
    if (req.imageBase64) {
      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: req.imageBase64
              }
            }
          ]
        }
      ];
    } else {
      messages = [
        {
          role: "user",
          content: prompt
        }
      ];
    }

    try {
      const response = await groq.chat.completions.create({
        messages: messages,
        model: req.imageBase64 ? "llama-3.2-90b-vision-preview" : "llama-3.3-70b-versatile",
        temperature: 0.5,
        response_format: { type: "json_object" }
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("Empty response received from Groq API");
      }

      const parsed: DiagnosisResult = JSON.parse(responseText.trim());
      return parsed;
    } catch (error: any) {
      console.warn("Error in GroqService.diagnose:", error?.message || error);
      throw error;
    }
  }
}
