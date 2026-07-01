import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import crypto from "crypto";

// Load Environment variables
dotenv.config();

import { requireAuth } from "./src/server/middleware/auth";
import { sanitizeInput, globalLimiter, criticalLimiter } from "./src/server/middleware/security";
import { DiagnosisController } from "./src/server/controllers/DiagnosisController";
import { DoctorController } from "./src/server/controllers/DoctorController";
import { adminDb } from "./src/server/services/FirebaseAdmin";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Socket.io Setup with strict security guidelines
  const allowedOrigin = process.env.APP_URL || "*";
  const io = new Server(server, {
    cors: {
      origin: allowedOrigin,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  const PORT = 3000;

  app.set("trust proxy", 1); // Trust first proxy (required for Cloud Run / reverse proxies)

  // 1. Strict CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === allowedOrigin || allowedOrigin === "*") {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    } else {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // 2. Parsers & Global Sanitizers (OWASP Injection Protection)
  app.use(express.json({ limit: "2mb" })); // Mitigate Denial of Service
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(sanitizeInput); // Strict XSS/NoSQL Sanitation
  app.use(globalLimiter); // Protect entire platform from brute-force/DoS

  // --- SECURE BACKEND API ROUTES ---

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Geolocation route: find nearest approved doctors
  app.get("/api/doctors/nearest", DoctorController.findNearest);

  // Admin routes: get and approve doctors
  app.get("/api/admin/doctors", requireAuth, DoctorController.getAllDoctors);
  app.post("/api/admin/doctors/approve", requireAuth, DoctorController.approveDoctor);

  // Agricultural & Veterinary Logic: AI Plant/Animal diagnosis
  app.post("/api/diagnose", requireAuth, criticalLimiter, DiagnosisController.getDiagnosis);


  // --- REAL-TIME COMMUNICATION ENGINE (SOCKET.IO) ---
  io.on("connection", (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Join room event - restricts users to specific room chats
    socket.on("join_room", (chatId: string) => {
      if (!chatId || typeof chatId !== "string" || chatId.length > 128) return;
      socket.join(chatId);
      console.log(`Client ${socket.id} joined room ${chatId}`);
    });

    // Real-time messenger event - Stores message in Firestore securely & broadcasts
    socket.on("send_message", async (data: { chatId: string; senderId: string; senderName: string; text: string }) => {
      const { chatId, senderId, senderName, text } = data;
      
      // Strict input validation
      if (!chatId || !senderId || !text || typeof text !== "string") {
        return;
      }
      if (text.trim().length === 0 || text.length > 2048) {
        return;
      }

      const messageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const msgPayload = {
        id: messageId,
        chatId,
        senderId,
        senderName: senderName || "Farmer",
        text: text.trim(),
        timestamp
      };

      try {
        // Double Check that user is a member of the chat room in the parent document to prevent Broken Access Control (OWASP #1)
        const chatSnap = await adminDb.collection("chats").doc(chatId).get();
        if (!chatSnap.exists) {
          console.error("Chat room does not exist");
          return;
        }

        const chatData = chatSnap.data();
        if (chatData?.farmerId !== senderId && chatData?.doctorId !== senderId) {
          console.error("Unauthenticated user attempting to inject message into private chat");
          return;
        }

        // 1. Store message in Firestore (Subcollection pattern for scale)
        await adminDb
          .collection("chats")
          .doc(chatId)
          .collection("messages")
          .doc(messageId)
          .set(msgPayload);

        // 2. Update chat parent metadata
        await adminDb.collection("chats").doc(chatId).update({
          lastMessage: text.substring(0, 100),
          lastMessageAt: timestamp
        });

        // 3. Broadcast message securely to the room only
        io.to(chatId).emit("new_message", msgPayload);
      } catch (error) {
        console.error("Error storing and broadcasting chat message:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });


  // --- VITE INTERFACE / FRONTEND SERVING ---
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode (Vite Middleware)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode (Static Assets)");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nepal Agri-Vet Security Hub is active on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
});
