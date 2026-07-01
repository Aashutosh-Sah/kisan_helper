import Groq from "groq-sdk";

export interface DiagnosisRequest {
  type: "crop" | "animal";
  subject: string; // e.g. "Tomato", "Cow"
  description: string;
  imageBase64?: string; // Optional image data for vision
}

export interface DiagnosisResult {
  diagnosis: string;
  remedy: string;
  preventiveMeasures: string;
  isEmergency: boolean;
  nepaliTranslation: {
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
You are an expert agricultural scientist and veterinary doctor specializing in Nepali farming systems.
Analyze the following user-submitted agricultural / animal issue:

Type: ${req.type}
Subject/Species/Crop: ${req.subject}
Issue Description: ${req.description}

Provide a structured diagnosis JSON response matching this exact schema:
{
  "diagnosis": "Scientific and layman name of the disease/pest/condition in English",
  "remedy": "Detailed step-by-step treatment or organic/chemical remedy suitable for Nepali farmers (available local resources)",
  "preventiveMeasures": "How to prevent this in the future (soil management, hygiene, vaccines, etc.)",
  "isEmergency": true,
  "nepaliTranslation": {
    "diagnosis": "Name of the diagnosis in Nepali (Devanagari script)",
    "remedy": "Key treatment steps translated into clear, simple Nepali language for farmers"
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
        model: req.imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile",
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
