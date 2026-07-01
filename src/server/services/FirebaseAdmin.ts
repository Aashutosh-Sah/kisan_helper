import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let config: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("Firebase Admin loaded config for Project ID:", config.projectId);
  }
} catch (e) {
  console.error("Failed to read firebase-applet-config.json in backend:", e);
}

const app = getApps().length === 0
  ? initializeApp({
      projectId: config.projectId || process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0493511835",
    })
  : getApps()[0];

export const adminDb = getFirestore(app, config.firestoreDatabaseId);
export const adminAuth = getAuth(app);
