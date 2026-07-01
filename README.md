# Nepal Agri-Vet Secure Hub

An enterprise-grade, secure, full-stack application for Nepali farmers that provides verified veterinary and agronomic consultations, localized mapping, real-time Socket.io chat support, and AI-driven diagnosis of livestock and crop issues.

---

## 🔒 Threat Mitigation & Security Architecture (OWASP Top 10)

This platform was built under strict zero-trust principles to safeguard users against digital exploitation. The primary mitigations against common **OWASP Top 10** vulnerabilities include:

### 1. Broken Access Control (A01:2021)
- **Problem**: Unauthorized users reading/modifying private profiles, diagnostic history, or chat transcripts (Insecure Direct Object References - IDOR).
- **Our Protection**:
  - **Firestore Security Rules**: The system implements rigorous rules. Users can only read/write their own profiles, chat rooms, and diagnostics histories.
  - **Sub-collection Master-Gate Pattern**: To read messages under `/chats/{chatId}/messages/{messageId}`, the Firestore rule evaluates the parent document `/chats/{chatId}` to verify if the authenticated user's UID matches either the `farmerId` or `doctorId`. If neither matches, Firestore returns `PERMISSION_DENIED` directly at the database layer.
  - **Immutable Audit Logs**: Diagnostics and message collections are write-once; updating or deleting logs is restricted exclusively to System Administrators.
  - **RBAC Enforcement**: The system relies on database-verified field checks for administrative permissions rather than client-assigned claims.

### 2. Injection Attacks (A03:2021)
- **Problem**: Attackers submitting malicious queries, scripts, or XSS vectors in input boxes like "Symptom Diagnosis" to hijack browser sessions or compromise backends.
- **Our Protection**:
  - **Recursive Sanitation Middleware**: Our backend controller implements strict input sanitization on all body/query fields, stripping out HTML tags, javascript URLs (`javascript:`), and dangerous events like `onclick`/`onerror`/`onload` to neutralize any Cross-Site Scripting (XSS) payload.
  - **NoSQL / Query Safe Bindings**: We use standard Firebase document references and parameters, which natively prevent NoSQL command injection.
  - **Strict Size/Type Constraints**: Every string schema in Firestore has size limitations (e.g. description maximum 2048 characters, subject maximum 256) which mitigates Denial of Wallet (DoW) and memory fatigue attacks.

---

## ⚙️ Core Technical Features

1. **Authentication (Email/Google)**:
   - Supports seamless Google OAuth and standard Email/Password authentication.
   - Enforces **Email Verification** on registration to prevent malicious actors and bots from spamming the system or registering fraudulent medical profiles.

2. **Vetted Onboarding Flow**:
   - Farmers gain immediate access.
   - Veterinary practitioners enter in a "Pending Review" status.
   - Vetted administrators (with authorized emails or roles) review, vet, and approve profiles via a secure Admin Panel, activating them in the directory lookup.

3. **Geolocation Proximity Engine**:
   - Calculates real distances between farmer coordinates and the doctor's clinics using the **Haversine formula** on the server.
   - Returns a sorted list of veterinarians, optimizing lookup time and resource consumption.

4. **Real-Time Communication (Socket.io)**:
   - Socket connections map clients securely into private rooms.
   - All messages sent over the socket are authenticated, verified against parent chat participant UIDs, and stored securely in Firestore for persistent auditing.

5. **Agriculture / Vet Diagnostics (Gemini AI)**:
   - Uses the latest official `@google/genai` model `gemini-2.5-flash` to process crop and livestock symptoms.
   - Translates findings and treatment steps into readable **Nepali Devanagari script** for accessible, locally grounded consultations.

---

## 🛠️ Local Development & Operations Setup

### 1. Set Environment Variables
Create a `.env` file in the root directory and define the following:
```env
GEMINI_API_KEY="your_api_key_here"
APP_URL="http://localhost:3000"
```

### 2. Run in Development Mode
To boot the full-stack server (Vite + Express in Hot reload):
```bash
npm run dev
```

### 3. Build and Run in Production
To compile the TypeScript Express backend into a bundled CommonJS file (`dist/server.cjs`) and build the static React assets:
```bash
npm run build
npm run start
```
This serves compiled client assets and initializes socket and API routing over port 3000 securely.
