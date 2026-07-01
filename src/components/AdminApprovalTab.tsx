import React, { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { ShieldCheck, UserX, Check, AlertCircle } from "lucide-react";

interface Doctor {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isApproved: boolean;
  specialization?: string;
  location?: { lat: number; lng: number };
}

export default function AdminApprovalTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchDoctors = async () => {
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const q = query(collection(db, "profiles"), where("role", "==", "doctor"));
      const snapshot = await getDocs(q);
      const docsArr: Doctor[] = [];
      snapshot.forEach((doc) => {
        docsArr.push(doc.data() as Doctor);
      });

      setDoctors(docsArr);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load doctor applications.");
    } finally {
      setLoading(false);
    }
  };

  const approveDoctor = async (doctorUid: string) => {
    setError("");
    setSuccessMsg("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const docRef = doc(db, "profiles", doctorUid);
      await updateDoc(docRef, { isApproved: true });

      setSuccessMsg("Doctor approved successfully.");
      // Refresh list
      await fetchDoctors();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to approve doctor. Make sure you have admin rights.");
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  return (
    <div className="space-y-6" id="admin-approval-tab">
      <div className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 text-amber-600 bg-amber-50 rounded-lg shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-base text-slate-800">Admin Control Panel</h3>
            <p className="font-sans text-xs text-slate-500">Manual verification of doctor onboarding profiles.</p>
          </div>
        </div>
        <div className="hidden sm:block text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold border border-slate-200">Security Core</div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-lg text-xs" id="admin-error">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 rounded-r-lg text-xs" id="admin-success">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12" id="admin-loading">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : doctors.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200" id="admin-empty">
          <UserX className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500 font-medium">No veterinarian applications found in profiles.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" id="admin-doctor-grid">
          {doctors.map((doctor) => (
            <div 
              key={doctor.uid} 
              className={`p-5 rounded-2xl bg-white shadow-sm border ${
                doctor.isApproved ? "border-slate-200" : "border-amber-200"
              }`}
              id={`doctor-card-${doctor.uid}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase rounded border mb-3 ${
                    doctor.isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                    {doctor.isApproved ? "Approved & Active" : "Pending Verification"}
                  </span>
                  <h4 className="text-base font-bold text-slate-800">{doctor.name}</h4>
                  <p className="text-xs text-slate-500">{doctor.specialization}</p>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <p><strong className="text-slate-400 font-medium">Email:</strong> {doctor.email}</p>
                <p><strong className="text-slate-400 font-medium">Phone:</strong> {doctor.phone}</p>
                {doctor.location && (
                  <p><strong className="text-slate-400 font-medium">HQ coordinates:</strong> Lat: {doctor.location.lat}, Lng: {doctor.location.lng}</p>
                )}
              </div>

              {!doctor.isApproved && (
                <button
                  onClick={() => approveDoctor(doctor.uid)}
                  className="w-full mt-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex justify-center items-center gap-2"
                  id={`approve-btn-${doctor.uid}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Approve and Activate
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
