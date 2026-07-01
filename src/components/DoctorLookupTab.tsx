import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { Search, MapPin, Navigation, Phone, MessageSquareCode, ShieldCheck, AlertCircle } from "lucide-react";
import { DoctorWithDistance } from "../types";

interface DoctorLookupTabProps {
  onStartChat: (chatId: string) => void;
  userProfile: any;
}

const NEPAL_PRESETS = [
  { name: "Chitwan (Bharatpur) - Agriculture Hub", lat: 27.6833, lng: 84.4333 },
  { name: "Kathmandu", lat: 27.7172, lng: 85.3240 },
  { name: "Pokhara", lat: 28.2096, lng: 83.9856 },
  { name: "Janakpur - Plains Region", lat: 26.7271, lng: 85.9231 },
  { name: "Biratnagar - Eastern Region", lat: 26.4525, lng: 87.2717 },
  { name: "Surkhet - Western Hills", lat: 28.5912, lng: 81.6315 },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DoctorLookupTab({ onStartChat, userProfile }: DoctorLookupTabProps) {
  const [locationPreset, setLocationPreset] = useState(0);
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [doctors, setDoctors] = useState<DoctorWithDistance[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCustomCoords({
            lat: parseFloat(pos.coords.latitude.toFixed(6)),
            lng: parseFloat(pos.coords.longitude.toFixed(6)),
          });
          setError("");
        },
        (err) => {
          console.warn("Geolocation failed/denied:", err);
          setError("Could not access physical GPS. Using Nepal location preset instead.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setError("Browser geolocation not supported.");
    }
  };

  const fetchNearestDoctors = async () => {
    setLoading(true);
    setError("");

    const activeLoc = customCoords || {
      lat: NEPAL_PRESETS[locationPreset].lat,
      lng: NEPAL_PRESETS[locationPreset].lng,
    };

    try {
      const q = query(
        collection(db, "profiles"),
        where("role", "==", "doctor"),
        where("isApproved", "==", true)
      );
      
      const snapshot = await getDocs(q);
      const docsArr: DoctorWithDistance[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location && typeof data.location.lat === "number" && typeof data.location.lng === "number") {
          const distance = calculateDistance(activeLoc.lat, activeLoc.lng, data.location.lat, data.location.lng);
          docsArr.push({
            uid: data.uid || doc.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            specialization: data.specialization || "General Agri-Vet",
            location: data.location,
            distanceKm: parseFloat(distance.toFixed(2)),
          });
        }
      });
      
      docsArr.sort((a, b) => a.distanceKm - b.distanceKm);
      setDoctors(docsArr);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to query the database for doctors.");
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateChat = async (doctorUid: string, doctorName: string) => {
    const farmer = auth.currentUser;
    if (!farmer) return;

    setChatLoading(doctorUid);
    try {
      // Determine unique ID for this direct chat pairing
      const chatId = `chat_${farmer.uid}_${doctorUid}`;

      // Check if chat document already exists in Firestore
      const chatDocRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatDocRef);

      if (!chatSnap.exists()) {
        // Fetch farmer name from profile or auth
        const farmerName = userProfile?.name || farmer.displayName || "Farmer";

        // Create new secure chat room document matching our Firestore Rules
        await setDoc(chatDocRef, {
          id: chatId,
          farmerId: farmer.uid,
          doctorId: doctorUid,
          farmerName: farmerName,
          doctorName: doctorName,
          createdAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString()
        });
      }

      onStartChat(chatId);
    } catch (err: any) {
      console.error("Failed to start chat session:", err);
      setError("Failed to initialize a secure chat room. Details: " + err.message);
    } finally {
      setChatLoading(null);
    }
  };

  // Sync with user's profile location on load if available
  useEffect(() => {
    if (userProfile?.location) {
      setCustomCoords(userProfile.location);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchNearestDoctors();
  }, [locationPreset, customCoords]);

  return (
    <div className="space-y-6" id="doctor-lookup-tab">
      {/* Geolocation Input Module */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 flex flex-col" id="geo-finder-panel">
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-base font-bold text-slate-800">Configure Search Location</h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Geospatial Locator</span>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-12 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Select District/Hub</label>
            <select
              value={customCoords ? "custom" : locationPreset}
              onChange={(e) => {
                if (e.target.value !== "custom") {
                  setLocationPreset(Number(e.target.value));
                  setCustomCoords(null);
                }
              }}
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              id="preset-geo-select"
            >
              {customCoords && <option value="custom">📍 Custom GPS Location</option>}
              {NEPAL_PRESETS.map((preset, index) => (
                <option key={index} value={index}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Latitude</label>
            <input 
              type="text" 
              readOnly 
              value={customCoords?.lat || NEPAL_PRESETS[locationPreset].lat} 
              className="w-full px-3 py-2 border border-slate-200 bg-slate-100/50 rounded-lg text-xs text-slate-600 font-mono" 
            />
          </div>
          
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Longitude</label>
            <input 
              type="text" 
              readOnly 
              value={customCoords?.lng || NEPAL_PRESETS[locationPreset].lng} 
              className="w-full px-3 py-2 border border-slate-200 bg-slate-100/50 rounded-lg text-xs text-slate-600 font-mono" 
            />
          </div>

          <div className="sm:col-span-4">
            <button
              onClick={handleDetectLocation}
              className="flex items-center justify-center gap-1.5 w-full py-2 border border-slate-200 rounded-lg font-sans text-xs font-bold text-slate-700 hover:bg-slate-50 transition duration-150 cursor-pointer"
              id="detect-gps-btn"
            >
              <Navigation className="w-4 h-4" />
              Auto Detect GPS
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-lg text-xs" id="geo-error">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Doctor Listings Grid */}
      <div className="space-y-4" id="doctor-listings-module">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h4 className="text-base font-bold text-slate-800">Nearby Approved Vet & Agri Doctors</h4>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">{doctors.length} verified experts</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" id="doctors-loading">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200" id="doctors-empty">
            <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-500">No active doctors nearby</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Try widening your coordinate presets to other districts.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" id="vetted-doctors-grid">
            {doctors.map((doc) => (
              <div 
                key={doc.uid} 
                className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between"
                id={`doctor-card-${doc.uid}`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        {doc.name}
                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      </h5>
                      <p className="text-xs text-slate-500 mb-2">
                        {doc.specialization}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">{doc.distanceKm} km away</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs text-slate-600 font-medium">
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Contact: {doc.phone}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      HQ Location: Lat {doc.location.lat}, Lng {doc.location.lng}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleInitiateChat(doc.uid, doc.name)}
                  disabled={chatLoading === doc.uid}
                  className="mt-auto w-full py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex justify-center items-center gap-2 disabled:opacity-50"
                  id={`chat-init-btn-${doc.uid}`}
                >
                  <MessageSquareCode className="w-4 h-4" />
                  {chatLoading === doc.uid ? "Opening Room..." : "Start Secure Consult / च्याट सुरु गर्नुहोस्"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
