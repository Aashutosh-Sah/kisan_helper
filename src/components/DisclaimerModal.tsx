import React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface DisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export default function DisclaimerModal({ isOpen, onAccept }: DisclaimerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" id="disclaimer-modal-overlay">
      <div 
        className="relative w-full max-w-lg overflow-hidden bg-white border border-amber-200 rounded-2xl shadow-2xl"
        id="disclaimer-modal-card"
      >
        {/* Warning Header */}
        <div className="flex items-center gap-3 p-5 bg-amber-50 border-b border-amber-100">
          <div className="p-2 text-amber-600 bg-amber-100 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-lg text-amber-900 leading-tight">Agri-Vet Advisory Disclaimer</h3>
            <p className="font-sans text-xs text-amber-700 font-medium">Terms of Use & Security Consent</p>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-6 space-y-4 text-sm text-gray-600 max-h-96 overflow-y-auto">
          <p className="font-medium text-gray-900">
            कृपया ध्यान दिनुहोस् (Please read carefully):
          </p>
          <p className="leading-relaxed">
            The **Nepal Agri-Vet Secure Hub** provides computer-generated AI diagnostics and expert peer opinions for agricultural crops and livestock. 
            All insights are intended solely as an **advisory reference**.
          </p>
          <div className="p-3 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-lg space-y-1">
            <p className="font-semibold text-xs uppercase tracking-wider">Crucial Emergency Notice</p>
            <p className="text-xs leading-relaxed">
              This platform does **NOT** replace in-person veterinary examinations, emergency livestock triage, or professional, official agricultural inspection. 
              If your animal is severely injured, unresponsive, or showing symptoms of contagious endemic outbreaks, seek immediate physical aid from a local veterinary hospital.
            </p>
          </div>
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase text-gray-500">Data & Security Agreement</p>
            <ul className="list-disc pl-5 text-xs space-y-1 leading-relaxed">
              <li>Your chat logs are stored securely and encrypted in transit.</li>
              <li>Only you and your matching veterinary doctor can read your chat logs.</li>
              <li>Your location coordinates are processed only to determine the nearest doctor.</li>
            </ul>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 p-5 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 font-sans font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition duration-150 shadow-md shadow-emerald-600/10 cursor-pointer"
            id="accept-disclaimer-btn"
          >
            <CheckCircle className="w-5 h-5" />
            स्वीकार गर्छु / I Agree and Accept
          </button>
        </div>
      </div>
    </div>
  );
}
