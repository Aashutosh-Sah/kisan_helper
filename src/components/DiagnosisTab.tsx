import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, setDoc } from "firebase/firestore";
import { Leaf, Award, ShieldAlert, History, Sparkles, CheckCircle2, Stethoscope, AlertTriangle, Camera, X } from "lucide-react";
import { DiagnosisResult, DiagnosisRecord } from "../types";

export default function DiagnosisTab() {
  const [type, setType] = useState<"crop" | "animal">("crop");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<DiagnosisRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fetchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "diagnoses"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const records: DiagnosisRecord[] = [];
      snap.forEach((doc) => {
        records.push(doc.data() as DiagnosisRecord);
      });
      setHistory(records);
    } catch (e) {
      console.warn("Could not load diagnostic logs history:", e);
    }
  };

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please login to proceed.");

      let resultData;
      
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type, subject, description, imageBase64 }),
        });

        const responseText = await res.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Failed to parse response:", responseText);
          throw new Error(`Invalid response from server (likely a static deployment issue).`);
        }

        if (!res.ok) throw new Error(data.error || "Failed to contact Agri-Vet AI.");
        resultData = data.result;
      } catch (backendError) {
        console.warn("Backend diagnosis failed, attempting client-side fallback...", backendError);
        
        // Client-side fallback for static deployments
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!groqKey) {
          throw new Error("Backend API failed and VITE_GROQ_API_KEY is not configured for client fallback. Please check deployment settings.");
        }
        
        const prompt = `You are an expert agricultural scientist and veterinary doctor specializing in Nepali farming systems.
Analyze the following user-submitted agricultural / animal issue:
Type: ${type}
Subject/Species/Crop: ${subject}
Issue Description: ${description}

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
Return ONLY valid JSON.`;

        let messages: any[] = [];
        if (imageBase64) {
          messages = [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }];
        } else {
          messages = [{ role: "user", content: prompt }];
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile",
            messages: messages,
            temperature: 0.5,
            response_format: { type: "json_object" }
          })
        });

        if (!groqRes.ok) {
          const errData = await groqRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || "Client-side Groq fallback failed.");
        }

        const groqData = await groqRes.json();
        const content = groqData.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from Groq.");
        resultData = JSON.parse(content);
      }

      setResult(resultData);
      
      // Save diagnosis log to Firestore on the client side
      try {
        const diagnosisId = crypto.randomUUID();
        const userName = user.displayName || "Farmer";
        const logPayload = {
          id: diagnosisId,
          userId: user.uid,
          userName,
          type,
          subject,
          description,
          result: JSON.stringify(data.result),
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "diagnoses", diagnosisId), logPayload);
      } catch (dbError) {
        console.error("Failed to save diagnosis log to Firestore:", dbError);
      }

      // Refresh history log
      await fetchHistory();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during AI analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-8" id="diagnosis-tab">
      {/* Upper Module Heading */}
      <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 text-blue-600 bg-blue-50 rounded-lg shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-base text-slate-800">AI-Powered Agri-Vet Diagnostics</h3>
            <p className="font-sans text-xs text-slate-500">Real-time diagnosis of crop pests and animal health using Gemini AI.</p>
          </div>
        </div>
        <div className="hidden sm:block text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold border border-slate-200">Gemini 1.5 Pro Enabled</div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12" id="diagnosis-layout">
        {/* Form Module */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-base font-bold text-slate-800">Request New Analysis</h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Diagnosis Engine</span>
            </div>
            
            <form onSubmit={handleDiagnose} className="space-y-4" id="diagnosis-form">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                <div className="grid grid-cols-2 gap-3" id="diagnose-type-select">
                  <button
                    type="button"
                    onClick={() => setType("crop")}
                    className={`flex items-center justify-center gap-2 py-2.5 border font-sans font-bold text-xs rounded-lg cursor-pointer select-none transition-all duration-150 ${
                      type === "crop" ? "border-blue-600 bg-blue-50 text-blue-800 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Leaf className="w-4 h-4" />
                    Crop / बालीनाली
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("animal")}
                    className={`flex items-center justify-center gap-2 py-2.5 border font-sans font-bold text-xs rounded-lg cursor-pointer select-none transition-all duration-150 ${
                      type === "animal" ? "border-blue-600 bg-blue-50 text-blue-800 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    Livestock / पशुपालान
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {type === "crop" ? "Crop Name / Type (e.g., Tomato, Rice)" : "Animal Species (e.g., Cow, Goat)"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={type === "crop" ? "e.g. Tomato plant, Paddy" : "e.g. Holstein Cow, Boer Goat"}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  id="diag-subject"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Symptom Description (लक्षणहरु खुलाउनुहोस्)
                </label>
                <p className="text-[10px] text-slate-400 mb-1.5 leading-tight">Be specific about color spots, behavior, eating patterns, or duration.</p>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    type === "crop"
                      ? "Describe the leaf colors, spots, holes, withering, or pest details..."
                      : "Describe symptoms like loss of appetite, coughing, sluggish movement, or fever..."
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  id="diag-description"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Upload Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Select Image
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  {imageBase64 && (
                    <div className="relative group">
                      <img src={imageBase64} alt="Preview" className="h-10 w-10 object-cover rounded shadow-sm border border-slate-200" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-lg text-xs" id="diag-error">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !subject.trim() || !description.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors mt-2 shadow-sm disabled:bg-slate-300 cursor-pointer flex justify-center items-center gap-2"
                id="diag-submit-btn"
              >
                <Sparkles className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
                {loading ? "Analyzing Symptoms..." : "Analyze Symptoms / निदान सुरु गर्नुहोस्"}
              </button>
            </form>
          </div>
        </div>

        {/* Diagnostic Results / Advice Showcase */}
        <div className="lg:col-span-7 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm text-center" id="diag-loading-screen">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <h4 className="mt-4 font-sans font-semibold text-base text-slate-800">Processing Diagnostic Model</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1">Our certified agricultural model is matching symptoms with endemic Nepali farm databases...</p>
            </div>
          ) : result ? (
            <div className="p-6 bg-white border border-blue-100 rounded-2xl shadow-md space-y-6 animate-fade-in" id="diag-result-card">
              {/* Emergency indicator banner */}
              {result.isEmergency && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-xl" id="diag-emergency">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 animate-bounce" />
                  <div>
                    <h5 className="font-sans font-bold text-xs uppercase tracking-wider">CRITICAL vet Emergency</h5>
                    <p className="text-[11px] leading-snug font-medium">This condition requires direct in-person inspection from a certified practitioner immediately.</p>
                  </div>
                </div>
              )}

              {/* English Overview */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Diagnosis Report / विश्लेषण रिपोर्ट</span>
                  <h4 className="font-sans font-bold text-xl text-slate-900 mt-1">{result.diagnosis}</h4>
                  <p className="text-xs font-semibold text-slate-500 font-mono mt-0.5">Translation: {result.nepaliTranslation.diagnosis}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                    <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Remedy / उपचार विधि</h5>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{result.remedy}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h5 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1">Preventive Measures</h5>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{result.preventiveMeasures}</p>
                  </div>
                </div>

                {/* Nepali translation block for local farmers */}
                <div className="p-4 bg-blue-50/40 border-l-4 border-blue-400 rounded-r-xl space-y-2">
                  <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">नेपालीमा उपचार गाइड (Nepali Treatment Guide)</h5>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{result.nepaliTranslation.remedy}</p>
                </div>
              </div>

              {/* Veterinary Disclaimer warning */}
              <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-100 flex items-start gap-2.5 text-[10px] leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  <strong>Security & Safety Compliance Disclaimer:</strong> This automated advice is an AI reference model. Keep a look out for abnormal reactions and verify with a nearby vetted Agri-Vet Doctor in the lookup panel before executing treatments.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 border border-slate-200 rounded-2xl text-center" id="diag-empty-state">
              <Sparkles className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-500">No active diagnosis requested</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-snug">Fill in the crop symptoms or animal species profile on the left to activate Gemini diagnostics.</p>
            </div>
          )}

          {/* History / Durable logs panel */}
          {history.length > 0 && (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4" id="diag-history-box">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <History className="w-4 h-4 text-blue-600" />
                <h5 className="font-sans font-semibold text-sm text-slate-800">Your Diagnostic History Logs</h5>
              </div>

              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1" id="diag-history-list">
                {history.map((record) => {
                  let parsedRes: DiagnosisResult | null = null;
                  try {
                    parsedRes = JSON.parse(record.result);
                  } catch (e) {}

                  return (
                    <div 
                      key={record.id} 
                      onClick={() => {
                        if (parsedRes) setResult(parsedRes);
                      }}
                      className="p-3 border border-slate-200 hover:border-blue-300 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-blue-50/50 transition duration-150 flex items-center justify-between"
                      id={`history-row-${record.id}`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            record.type === "crop" ? "bg-green-600" : "bg-blue-600"
                          }`} />
                          <h6 className="text-xs font-semibold text-slate-900 truncate">{record.subject}</h6>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{record.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full font-sans">
                          {parsedRes?.nepaliTranslation.diagnosis || "Vetted"}
                        </span>
                        <p className="text-[9px] text-slate-400 mt-1">{new Date(record.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
