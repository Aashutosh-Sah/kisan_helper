export interface Location {
  lat: number;
  lng: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: "farmer" | "doctor" | "admin";
  isApproved: boolean;
  phone: string;
  specialization?: string;
  location?: Location;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  farmerId: string;
  doctorId: string;
  farmerName: string;
  doctorName: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface DiagnosisResult {
  doctorMessage: string;
  diagnosis: string;
  remedy: string;
  preventiveMeasures: string;
  isEmergency: boolean;
  nepaliTranslation: {
    doctorMessage: string;
    diagnosis: string;
    remedy: string;
  };
}

export interface DiagnosisRecord {
  id: string;
  userId: string;
  userName: string;
  type: "crop" | "animal";
  subject: string;
  description: string;
  result: string; // JSON string of DiagnosisResult
  createdAt: string;
}

export interface DoctorWithDistance {
  uid: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  location: Location;
  distanceKm: number;
}
