import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { adminDb } from "../services/FirebaseAdmin.js";

// Haversine formula to calculate distance in km
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

export class DoctorController {
  /**
   * Find approved doctors closest to the farmer's location
   */
  static async findNearest(req: Request, res: Response): Promise<void> {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      res.status(400).json({ error: "Latitude (lat) and Longitude (lng) are required query parameters." });
      return;
    }

    const farmerLat = parseFloat(lat as string);
    const farmerLng = parseFloat(lng as string);

    if (isNaN(farmerLat) || isNaN(farmerLng)) {
      res.status(400).json({ error: "Invalid coordinates provided." });
      return;
    }

    try {
      // Fetch all doctors from Firestore profiles
      const snapshot = await adminDb
        .collection("profiles")
        .where("role", "==", "doctor")
        .where("isApproved", "==", true)
        .get();

      const doctors: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location && typeof data.location.lat === "number" && typeof data.location.lng === "number") {
          const distance = calculateDistance(farmerLat, farmerLng, data.location.lat, data.location.lng);
          doctors.push({
            uid: data.uid,
            name: data.name,
            email: data.email,
            phone: data.phone,
            specialization: data.specialization || "General Agri-Vet",
            location: data.location,
            distanceKm: parseFloat(distance.toFixed(2)),
          });
        }
      });

      // Sort doctors by distance in ascending order
      doctors.sort((a, b) => a.distanceKm - b.distanceKm);

      res.status(200).json({ success: true, doctors });
    } catch (error) {
      console.error("Error finding nearest doctor:", error);
      res.status(500).json({ error: "Failed to fetch doctors and calculate geo-distances." });
    }
  }

  /**
   * Admin-only API to approve a pending doctor's registration
   */
  static async approveDoctor(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { doctorUid } = req.body;
    const adminUser = req.user;

    if (!adminUser) {
      res.status(401).json({ error: "Unauthorized. Admin credentials required." });
      return;
    }

    // Verify admin role via hardcoded list or admin profile doc
    const isSpecialAdmin = adminUser.email === "aashutoshsah0.1.1@gmail.com";
    
    let isAdminRole = false;
    try {
      const adminDocRef = await adminDb.collection("admins").doc(adminUser.uid).get();
      isAdminRole = adminDocRef.exists;
    } catch (e) {
      console.warn("Failed to check admins collection", e);
    }

    if (!isSpecialAdmin && !isAdminRole) {
      res.status(403).json({ error: "Forbidden. Only authorized administrators can approve doctors." });
      return;
    }

    if (!doctorUid || typeof doctorUid !== "string") {
      res.status(400).json({ error: "Valid doctorUid is required for approval." });
      return;
    }

    try {
      const docRef = adminDb.collection("profiles").doc(doctorUid);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        res.status(404).json({ error: "Doctor profile not found." });
        return;
      }

      const doctorData = docSnap.data();
      if (doctorData?.role !== "doctor") {
        res.status(400).json({ error: "The selected profile is not a doctor." });
        return;
      }

      await docRef.update({ isApproved: true });

      res.status(200).json({ success: true, message: `Doctor ${doctorData.name} has been approved successfully.` });
    } catch (error) {
      console.error("Error approving doctor:", error);
      res.status(500).json({ error: "Failed to approve doctor profile." });
    }
  }

  /**
   * Get all doctors (approved and pending) for admin dashboard review
   */
  static async getAllDoctors(req: AuthenticatedRequest, res: Response): Promise<void> {
    const adminUser = req.user;

    if (!adminUser) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const isSpecialAdmin = adminUser.email === "aashutoshsah0.1.1@gmail.com";
    let isAdminRole = false;
    try {
      const adminDocRef = await adminDb.collection("admins").doc(adminUser.uid).get();
      isAdminRole = adminDocRef.exists;
    } catch (e) {}

    if (!isSpecialAdmin && !isAdminRole) {
      res.status(403).json({ error: "Forbidden. Admin only access." });
      return;
    }

    try {
      const snapshot = await adminDb.collection("profiles").where("role", "==", "doctor").get();
      const doctors: any[] = [];
      snapshot.forEach((doc) => {
        doctors.push(doc.data());
      });

      res.status(200).json({ success: true, doctors });
    } catch (error) {
      console.error("Error fetching all doctors:", error);
      res.status(500).json({ error: "Failed to fetch all doctors." });
    }
  }
}
