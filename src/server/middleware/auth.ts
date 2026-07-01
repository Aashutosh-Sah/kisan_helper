import { Request, Response, NextFunction } from "express";
import { adminAuth } from "../services/FirebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

/**
 * Enterprise middleware to verify Firebase Auth ID Tokens in API Requests
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Access Denied. Authorization Header with Bearer token is missing or malformed." });
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(403).json({ error: "Access Denied. Invalid or expired authentication token." });
  }
}

/**
 * Optional Auth middleware that populates user if token is present, but doesn't block if not.
 */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
    } catch (error) {
      console.warn("Optional Token verification failed, proceeding as anonymous.");
    }
  }
  next();
}
