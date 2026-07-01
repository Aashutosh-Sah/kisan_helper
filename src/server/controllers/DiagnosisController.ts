import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { GeminiService } from "../services/GeminiService.js";
import { GroqService } from "../services/GroqService.js";
import { adminDb } from "../services/FirebaseAdmin.js";
import crypto from "crypto";

export class DiagnosisController {
  /**
   * Run AI diagnosis on animal/crop condition
   */
  static async getDiagnosis(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { type, subject, description, imageBase64 } = req.body;
    const user = req.user;

    // 1. Inputs validation
    if (!type || !["crop", "animal"].includes(type)) {
      res.status(400).json({ error: "Invalid diagnosis type. Must be 'crop' or 'animal'." });
      return;
    }

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      res.status(400).json({ error: "Subject is required and must be a valid string." });
      return;
    }

    if (subject.length > 256) {
      res.status(400).json({ error: "Subject must be 256 characters or fewer." });
      return;
    }

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      res.status(400).json({ error: "Description of the symptoms is required." });
      return;
    }

    if (description.length > 2048) {
      res.status(400).json({ error: "Description must be 2048 characters or fewer to prevent abuse." });
      return;
    }
    
    if (imageBase64 && typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 must be a valid string if provided." });
      return;
    }

    try {
      // 2. Query AI Service
      let result;
      if (process.env.GROQ_API_KEY) {
        result = await GroqService.diagnose({
          type: type as "crop" | "animal",
          subject,
          description,
          imageBase64,
        });
      } else {
        result = await GeminiService.diagnose({
          type: type as "crop" | "animal",
          subject,
          description,
        });
      }

      // We will let the client handle saving the log to Firestore directly.
      // 3. Return the result
      res.status(200).json({ success: true, result });
    } catch (error: any) {
      console.error("Diagnosis error in controller:", error);
      res.status(500).json({
        error: "AI Diagnosis Service temporarily unavailable. Please verify API configuration or try again later.",
        details: error.message
      });
    }
  }
}

