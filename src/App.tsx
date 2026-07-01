import React, { useState, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { 
  Stethoscope, 
  MapPin, 
  MessageSquareCode, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon,
  Sprout, 
  AlertTriangle 
} from "lucide-react";

import DisclaimerModal from "./components/DisclaimerModal";
import AuthCard from "./components/AuthCard";
import DiagnosisTab from "./components/DiagnosisTab";
import DoctorLookupTab from "./components/DoctorLookupTab";
import ChatTab from "./components/ChatTab";
import AdminApprovalTab from "./components/AdminApprovalTab";
import { UserProfile } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"diagnose" | "doctors" | "chat" | "admin">("diagnose");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Sync Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Enforce verified email to continue
        if (currentUser.emailVerified) {
          try {
            const profileSnap = await getDoc(doc(db, "profiles", currentUser.uid));
            if (profileSnap.exists()) {
              setUserProfile(profileSnap.data() as UserProfile);
            }
          } catch (e) {
            console.error("Could not fetch user profile", e);
          }
        } else {
          // If logged in via email but not verified, log them out to trigger verification flow
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Enforce Veterinary advisory terms of service acceptance on mount
  useEffect(() => {
    const accepted = localStorage.getItem("agriVetDisclaimerAccepted");
    if (accepted !== "true" && user) {
      setDisclaimerOpen(true);
    }
  }, [user]);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem("agriVetDisclaimerAccepted", "true");
    setDisclaimerOpen(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const navigateToChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActiveTab("chat");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50/50" id="global-spinner">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Admin access control flag
  const isSystemAdmin = user?.email === "aashutoshsah0.1.1@gmail.com";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Disclaimer banner modal */}
      <DisclaimerModal isOpen={disclaimerOpen} onAccept={handleAcceptDisclaimer} />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Agri-Vet Hub <span className="text-blue-600 font-normal ml-1">Security-v1.4</span></h1>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Authorized Access Only</span>
            </div>
          </div>

          {/* Connected User Badge & Controls */}
          {user && userProfile && (
            <div className="flex items-center gap-4" id="header-user-badge">
              <div className="hidden sm:flex flex-col items-end text-right">
                <p className="font-semibold text-sm text-slate-900">{userProfile.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${userProfile.isApproved ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="text-[11px] font-bold uppercase text-slate-600 bg-slate-100 px-2 rounded border border-slate-200">
                    {userProfile.role === "doctor" ? "Specialist Vet" : "Farmer"}
                  </span>
                </div>
              </div>

              <div className="p-1.5 bg-slate-50 rounded-full border border-slate-200 overflow-hidden w-10 h-10 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-slate-400" />
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 active:bg-red-100 border border-transparent hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                id="logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col" id="main-content">
        {!user || !userProfile ? (
          /* Landing page with OAuth / Password Card */
          <div className="flex-grow flex flex-col justify-center items-center py-12" id="landing-screen">
            <div className="text-center max-w-xl mb-10 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-bold uppercase tracking-wider shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                vetted secure connection
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Nepal's Vetted <span className="text-blue-600">Agri-Vet Portal</span></h2>
              <p className="text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                Connect directly with verified agronomists and veterinary doctors. Run automated diagnosis on livestock ailments or plant conditions with secure encryption.
              </p>
            </div>
            <AuthCard onAuthSuccess={async () => {
              if (auth.currentUser) {
                const profileSnap = await getDoc(doc(db, "profiles", auth.currentUser.uid));
                if (profileSnap.exists()) {
                  setUserProfile(profileSnap.data() as UserProfile);
                }
              }
            }} />
          </div>
        ) : (
          /* Main Dashboard with multi-tab layout */
          <div className="space-y-8 flex-grow flex flex-col" id="dashboard-screen">
            
            {/* Warning Banner for Pending Doctors */}
            {userProfile.role === "doctor" && !userProfile.isApproved && (
              <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl animate-fade-in" id="pending-doctor-banner">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="font-sans font-bold text-sm text-amber-900 uppercase tracking-wide">Veterinary Profile Pending Activation</h4>
                  <p className="text-xs text-amber-700 leading-relaxed font-medium">
                    To maintain strict agricultural clinical security and prevent misinformation, all veterinary and agronomist profiles must be manually approved by administrators before listing in our system. Your profile is currently under review. 
                  </p>
                  <p className="text-xs text-amber-800 font-bold mt-1.5">
                    For reviewers: You can log in using admin credentials to approve this profile instantly.
                  </p>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2" id="navigation-tabs">
              <button
                onClick={() => setActiveTab("diagnose")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors rounded-t-lg border-b-2 cursor-pointer ${
                  activeTab === "diagnose"
                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                    : "border-transparent text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                }`}
                id="tab-diagnose-btn"
              >
                <Sprout className="w-4 h-4" />
                AI Diagnosis / रोग पहिचान
              </button>

              {userProfile.role === "farmer" && (
                <button
                  onClick={() => setActiveTab("doctors")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors rounded-t-lg border-b-2 cursor-pointer ${
                    activeTab === "doctors"
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                }`}
                  id="tab-doctors-btn"
                >
                  <MapPin className="w-4 h-4" />
                  Find Nearest Specialist
                </button>
              )}

              {/* Chat is active for farmers, and approved doctors */}
              {(userProfile.role === "farmer" || userProfile.isApproved) && (
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors rounded-t-lg border-b-2 cursor-pointer ${
                    activeTab === "chat"
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                }`}
                  id="tab-chat-btn"
                >
                  <MessageSquareCode className="w-4 h-4" />
                  Secure Consult Chat
                </button>
              )}

              {/* Admin Panel button */}
              {isSystemAdmin && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors rounded-t-lg border-b-2 cursor-pointer ${
                    activeTab === "admin"
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                }`}
                  id="tab-admin-btn"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Approvals ({userProfile.name})
                </button>
              )}
            </div>

            {/* Active Tab View Rendering */}
            <div className="flex-grow flex flex-col" id="active-tab-container">
              {activeTab === "diagnose" && <DiagnosisTab />}
              
              {activeTab === "doctors" && userProfile.role === "farmer" && (
                <DoctorLookupTab onStartChat={navigateToChat} userProfile={userProfile} />
              )}

              {activeTab === "chat" && (
                <ChatTab 
                  activeChatId={activeChatId} 
                  onSelectChat={setActiveChatId} 
                  userProfile={userProfile} 
                />
              )}

              {activeTab === "admin" && isSystemAdmin && <AdminApprovalTab />}
            </div>
          </div>
        )}
      </main>

      {/* Footer disclaimer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-4 px-6 flex flex-wrap items-center justify-between text-xs text-slate-500 shrink-0 mt-auto" id="main-footer">
        <p>© 2026 Nepal Agri-Vet Security Hub. All diagnostic actions are advisory only. Compliant with HIPAA & veterinary safety regulations.</p>
        <p className="font-mono text-[10px] text-slate-400">v1.4.2_LATEST_STABLE</p>
      </footer>
    </div>
  );
}
