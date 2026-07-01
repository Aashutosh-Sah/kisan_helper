# Firestore Security Specification - Nepali Farmers Agri-Vet Platform

This document describes the data invariants, threat model, and "Dirty Dozen" malicious payloads used to verify our Firestore security posture.

## 1. Data Invariants
- **Profiles**: 
  - A user profile must match its Firestore Document ID with the authenticated User's UID.
  - No user can set their own `role` to `admin` or change it after creation.
  - Doctors must have `isApproved` set to `false` on initial creation; only an authorized Admin can set `isApproved` to `true`.
  - Farmers cannot edit Doctor profiles.
- **Chats**:
  - A Chat must have a `farmerId` and a `doctorId` matching existing, valid profiles.
  - A Chat can only be read or written by the authenticated farmer or doctor whose UIDs are specified inside the document.
- **Messages**:
  - Messages exist under a sub-collection of `chats`.
  - A message can only be added to a chat if the sender's UID matches either the `farmerId` or `doctorId` of the parent chat document.
  - Message text must be less than 1024 characters.
- **Diagnoses**:
  - A diagnosis can only be created by an authenticated user and belongs strictly to them.
  - A farmer can only read their own diagnostic logs.

---

## 2. The "Dirty Dozen" Threat Payloads

### Payload 1: Privilege Escalation (Self-Admin)
- **Path**: `/profiles/farmer_123`
- **User**: Authenticated as `farmer_123`
- **Payload**: `{ "uid": "farmer_123", "email": "farmer@example.com", "name": "Ram Bahadur", "role": "admin", "isApproved": true }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Self-Approval by Unapproved Doctor
- **Path**: `/profiles/doctor_456`
- **User**: Authenticated as `doctor_456` (role: doctor)
- **Payload**: `{ "uid": "doctor_456", "email": "dr.gopal@example.com", "name": "Dr. Gopal", "role": "doctor", "isApproved": true }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 3: Malicious Mod of Doctor Profile by Farmer
- **Path**: `/profiles/doctor_456`
- **User**: Authenticated as `farmer_123`
- **Payload**: `{ "specialization": "None - Hacked" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 4: Anonymous Profile Write
- **Path**: `/profiles/anon_789`
- **User**: Unauthenticated
- **Payload**: `{ "uid": "anon_789", "email": "anon@example.com", "name": "Anonymous" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 5: Identity Spoofing in Chat Creation
- **Path**: `/chats/chat_abc`
- **User**: Authenticated as `farmer_123`
- **Payload**: `{ "id": "chat_abc", "farmerId": "attacker_999", "doctorId": "doctor_456", "farmerName": "Attacker", "doctorName": "Dr. Gopal", "createdAt": "2026-06-30T18:00:00Z" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 6: Eavesdropping on Another User's Chat
- **Path**: `/chats/chat_private_xyz`
- **User**: Authenticated as `farmer_123`
- **Context**: `chat_private_xyz` has `farmerId: "farmer_other"` and `doctorId: "doctor_456"`.
- **Action**: Read request by `farmer_123`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 7: Chat Sub-collection Message Injection
- **Path**: `/chats/chat_abc/messages/msg_999`
- **User**: Authenticated as `malicious_user_777` (not part of `chat_abc`)
- **Payload**: `{ "id": "msg_999", "chatId": "chat_abc", "senderId": "malicious_user_777", "senderName": "Hacker", "text": "spam", "timestamp": "2026-06-30T18:01:00Z" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 8: Direct Read of Another Farmer's Diagnoses
- **Path**: `/diagnoses/diagnosis_private`
- **User**: Authenticated as `farmer_123`
- **Context**: `diagnosis_private` has `userId: "farmer_other"`.
- **Action**: Read request by `farmer_123`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 9: Wallet Exhaustion through Giant Payload
- **Path**: `/chats/chat_abc/messages/msg_giant`
- **User**: Authenticated as `farmer_123`
- **Payload**: `{ "id": "msg_giant", "chatId": "chat_abc", "senderId": "farmer_123", "senderName": "Ram", "text": "A".repeat(500000), "timestamp": "2026-06-30T18:00:00Z" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 10: Message Timestamp Backdating
- **Path**: `/chats/chat_abc/messages/msg_backdated`
- **User**: Authenticated as `farmer_123`
- **Payload**: `{ "id": "msg_backdated", "chatId": "chat_abc", "senderId": "farmer_123", "senderName": "Ram", "text": "hello", "timestamp": "1990-01-01T00:00:00Z" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 11: Invalid Profile Schema Schema Injection
- **Path**: `/profiles/farmer_123`
- **User**: Authenticated as `farmer_123`
- **Payload**: `{ "uid": "farmer_123", "email": "farmer@example.com", "name": "Ram", "role": "farmer", "isApproved": true, "extraShadowField": "malicious" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Broad Profile List Query (Client Delegation Bypass)
- **Path**: `/profiles` (Query without filtering by UID)
- **User**: Authenticated as `farmer_123` (role: farmer)
- **Action**: List query
- **Expected Outcome**: `PERMISSION_DENIED` (only allows reading specific profiles, or query filtered by specific keys, or admins can read all profiles).
