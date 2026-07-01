import React, { useState } from "react";
import { auth, googleProvider, db } from "../lib/firebase";
import { 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { LogIn, UserPlus, ShieldAlert, Check, MapPin, Navigation } from "lucide-react";

interface AuthCardProps {
  onAuthSuccess: () => void;
}

const NEPAL_PRESETS = [
  { name: "Chitwan (Bharatpur) - Agriculture Hub", lat: 27.6833, lng: 84.4333 },
  { name: "Kathmandu", lat: 27.7172, lng: 85.3240 },
  { name: "Pokhara", lat: 28.2096, lng: 83.9856 },
  { name: "Janakpur - Plains Region", lat: 26.7271, lng: 85.9231 },
  { name: "Biratnagar - Eastern Region", lat: 26.4525, lng: 87.2717 },
  { name: "Surkhet - Western Hills", lat: 28.5912, lng: 81.6315 },
];

export default function AuthCard({ onAuthSuccess }: AuthCardProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"farmer" | "doctor">("farmer");
  const [specialization, setSpecialization] = useState("");
  const [locationPreset, setLocationPreset] = useState(0);
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCustomCoords({
            lat: parseFloat(pos.coords.latitude.toFixed(6)),
            lng: parseFloat(pos.coords.longitude.toFixed(6)),
          });
          setInfoMsg("Actual GPS coordinates detected successfully!");
          setError("");
        },
        (err) => {
          console.warn("Geolocation denied/failed. Presets used instead.", err);
          setError("Could not access GPS. Using Nepal location preset instead.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setError("Browser geolocation not supported.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfoMsg("");

    const activeLoc = customCoords || {
      lat: NEPAL_PRESETS[locationPreset].lat,
      lng: NEPAL_PRESETS[locationPreset].lng,
    };

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error("Display Name is required.");
        if (!phone.trim()) throw new Error("Contact Phone Number is required.");
        if (role === "doctor" && !specialization.trim()) {
          throw new Error("Veterinarians must specify a specialization.");
        }

        const credential = await signInWithPopup(auth, googleProvider);
        const user = credential.user;

        // Check if profile exists
        const profileSnap = await getDoc(doc(db, "profiles", user.uid));
        
        if (!profileSnap.exists()) {
          // Build Firestore profile doc
          const profilePayload: any = {
            uid: user.uid,
            email: user.email,
            name: name.trim(),
            role,
            phone: phone.trim(),
            isApproved: role === "farmer", // Farmers are instantly active; doctors need manual admin approval
            location: activeLoc,
            createdAt: new Date().toISOString(),
          };

          if (role === "doctor") {
            profilePayload.specialization = specialization.trim();
          }

          // Set user profile inside Firestore collection
          await setDoc(doc(db, "profiles", user.uid), profilePayload);
        }

        onAuthSuccess();
      } else {
        // Sign In
        const credential = await signInWithPopup(auth, googleProvider);
        const user = credential.user;

        // Check if profile exists, if not, create a default one
        const profileSnap = await getDoc(doc(db, "profiles", user.uid));
        
        if (!profileSnap.exists()) {
          const profilePayload = {
            uid: user.uid,
            email: user.email || "",
            name: user.displayName || "Nepali Farmer",
            role: "farmer",
            phone: "N/A",
            isApproved: true, // Farmers are instantly active
            location: activeLoc,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, "profiles", user.uid), profilePayload);
        }

        onAuthSuccess();
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm" id="auth-card">
      {/* Brand Header */}
      <div className="p-8 text-center bg-slate-900 text-white border-b border-slate-700 shadow-inner" id="auth-header">
        <h2 className="font-sans font-bold text-2xl tracking-tight leading-tight">Nepal Agri-Vet Hub <span className="text-emerald-400 font-normal text-sm ml-1">Security-v1.4</span></h2>
        <p className="mt-2 text-[10px] text-slate-400 uppercase tracking-widest font-medium">Authorized Access Only</p>
      </div>

      <div className="p-8 space-y-6 bg-white" id="auth-body">
        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200" id="auth-tabs">
          <button
            onClick={() => { setIsSignUp(false); setError(""); setInfoMsg(""); }}
            className={`flex items-center justify-center gap-2 py-2.5 font-sans font-semibold text-xs rounded-lg transition-all duration-150 cursor-pointer ${
              !isSignUp ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}
            id="tab-login"
          >
            <LogIn className="w-4 h-4" />
            Sign In / लग-इन
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(""); setInfoMsg(""); }}
            className={`flex items-center justify-center gap-2 py-2.5 font-sans font-semibold text-xs rounded-lg transition-all duration-150 cursor-pointer ${
              isSignUp ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}
            id="tab-register"
          >
            <UserPlus className="w-4 h-4" />
            Register / दर्ता
          </button>
        </div>

        {/* Error/Info banners */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-lg text-xs leading-relaxed" id="auth-error-banner">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {infoMsg && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 rounded-r-lg text-xs leading-relaxed" id="auth-info-banner">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{infoMsg}</p>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4" id="auth-form">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name (पूरा नाम)</label>
                <input
                  type="text"
                  required
                  placeholder="Ram Bahadur Thapa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  id="reg-name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number (मोबाइल नं.)</label>
                <input
                  type="tel"
                  required
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  id="reg-phone"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role Type (तपाईंको भूमिका)</label>
                <div className="grid grid-cols-2 gap-3" id="role-select-box">
                  <label className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer text-xs font-semibold select-none ${
                    role === "farmer" ? "border-emerald-500 bg-emerald-50/50 text-emerald-800" : "border-gray-200 text-gray-600"
                  }`}>
                    <input type="radio" name="role" checked={role === "farmer"} onChange={() => setRole("farmer")} className="accent-emerald-600" />
                    Farmer (कृषक)
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer text-xs font-semibold select-none ${
                    role === "doctor" ? "border-emerald-500 bg-emerald-50/50 text-emerald-800" : "border-gray-200 text-gray-600"
                  }`}>
                    <input type="radio" name="role" checked={role === "doctor"} onChange={() => setRole("doctor")} className="accent-emerald-600" />
                    Doctor (पशु/बाली विशेषज्ञ)
                  </label>
                </div>
              </div>

              {role === "doctor" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Doctor Specialization (विशेषज्ञता)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Livestock Veterinarian, Soil Scientist"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    id="reg-specialization"
                  />
                </div>
              )}

              {/* Geolocation Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Location Coordinates (स्थान निर्धारण)</label>
                <p className="text-[10px] text-gray-400 mb-2 leading-tight">Needed to connect farmers to closest experts.</p>
                
                <div className="space-y-2.5" id="geolocation-block">
                  <select
                    value={customCoords ? "custom" : locationPreset}
                    onChange={(e) => {
                      if (e.target.value !== "custom") {
                        setLocationPreset(Number(e.target.value));
                        setCustomCoords(null);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    id="preset-location-select"
                  >
                    {customCoords && <option value="custom">📍 Custom GPS Location</option>}
                    {NEPAL_PRESETS.map((preset, index) => (
                      <option key={index} value={index}>
                        Preset: {preset.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Latitude</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={customCoords?.lat || NEPAL_PRESETS[locationPreset].lat} 
                        className="w-full px-3 py-2 bg-slate-100/50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono focus:outline-none" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Longitude</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={customCoords?.lng || NEPAL_PRESETS[locationPreset].lng} 
                        className="w-full px-3 py-2 bg-slate-100/50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono focus:outline-none" 
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    className="flex items-center justify-center gap-1.5 w-full py-2 border border-slate-200 rounded-lg font-sans text-xs font-semibold text-slate-700 hover:bg-slate-50 transition duration-150 cursor-pointer"
                    id="detect-gps-btn"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Auto Detect Live GPS / मेरो हालको स्थान पत्ता लगाउनुहोस्
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:bg-slate-300 cursor-pointer"
            id="auth-submit-btn"
          >
            <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.123C18.465 1.91 15.54 1 12.24 1 5.92 1 1 5.92 1 12s4.92 11 11.24 11c6.62 0 11.02-4.66 11.02-11.22 0-.75-.08-1.33-.2-1.895H12.24z"
              />
            </svg>
            {loading ? "Processing..." : isSignUp ? "Register with Google / दर्ता गर्नुहोस्" : "Sign In with Google / प्रवेश गर्नुहोस्"}
          </button>
        </form>
      </div>
    </div>
  );
}
