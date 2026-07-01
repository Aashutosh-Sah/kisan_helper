import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// --- Enterprise Rate Limiters ---

// Global rate limiter for general browsing
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false }
});

// High-security route limiter (AI diagnosis, approvals, etc.)
export const criticalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit to 5 request/min for AI endpoints to prevent cost depletion
  message: { error: "Diagnosis request limit reached. Please wait 1 minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false }
});

// --- Enterprise Input Sanitation Middleware ---

/**
 * Sanitizes input string to prevent XSS and remove potentially malicious scripts/HTML
 */
export function sanitizeString(val: string): string {
  if (typeof val !== "string") return "";
  // Strip HTML tags
  let sanitized = val.replace(/<[^>]*>/g, "");
  // Strip malicious javascript indicators
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/onclick|onerror|onload|onmouseover/gi, "");
  return sanitized.trim();
}

/**
 * Express middleware to recursively sanitize body fields against injection & XSS
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  const sanitizeValue = (obj: any): any => {
    if (typeof obj === "string") {
      return sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeValue);
    }
    if (typeof obj === "object" && obj !== null) {
      const sanitizedObj: any = {};
      for (const key of Object.keys(obj)) {
        // Guard against Prototype Pollution
        if (key === "__proto__" || key === "constructor") continue;
        sanitizedObj[key] = sanitizeValue(obj[key]);
      }
      return sanitizedObj;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  next();
}
