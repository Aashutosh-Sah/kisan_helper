import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, onSnapshot } from "firebase/firestore";
import { io, Socket } from "socket.io-client";
import { MessageSquare, Send, CheckCheck, UserCheck, Stethoscope, AlertCircle } from "lucide-react";
import { ChatRoom, ChatMessage } from "../types";

interface ChatTabProps {
  activeChatId: string | null;
  onSelectChat: (chatId: string | null) => void;
  userProfile: any;
}

export default function ChatTab({ activeChatId, onSelectChat, userProfile }: ChatTabProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = rooms.find((r) => r.id === activeChatId);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch Chat Rooms list based on User Role (Security segregation)
  const fetchRooms = async () => {
    setLoadingRooms(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please log in to browse chat rooms.");

      const isDoctor = userProfile?.role === "doctor";
      const q = query(
        collection(db, "chats"),
        where(isDoctor ? "doctorId" : "farmerId", "==", user.uid)
      );

      const snap = await getDocs(q);
      const list: ChatRoom[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as ChatRoom);
      });
      list.sort((a, b) => {
        const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
        const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
        return timeB - timeA;
      });
      setRooms(list);
    } catch (err: any) {
      console.warn("Could not fetch chat rooms:", err);
      setError("Failed to load secure chat sessions.");
    } finally {
      setLoadingRooms(false);
    }
  };

  // 2. Load message history and listen to real-time updates via Firestore
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    setError("");

    const q = query(
      collection(db, "chats", activeChatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as ChatMessage);
      });
      setMessages(list);
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 50);
    }, (err) => {
      console.error("Failed to load message log:", err);
      setError("Missing or insufficient permissions. Could not load message history.");
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  // Initial rooms fetch
  useEffect(() => {
    fetchRooms();
  }, [userProfile]);

  // 3. Send Message Handler directly to Firestore
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChatId) return;

    const user = auth.currentUser;
    if (!user) return;

    const senderName = userProfile?.name || user.displayName || "User";
    const currentText = text.trim();
    setText("");

    try {
      const { doc, setDoc, updateDoc } = await import("firebase/firestore");
      const messageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const msgPayload = {
        id: messageId,
        chatId: activeChatId,
        senderId: user.uid,
        senderName,
        text: currentText,
        timestamp
      };

      // Store message in Firestore directly
      await setDoc(doc(db, "chats", activeChatId, "messages", messageId), msgPayload);

      // Update chat parent metadata
      await updateDoc(doc(db, "chats", activeChatId), {
        lastMessage: currentText.substring(0, 100),
        lastMessageAt: timestamp
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please check permissions.");
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[580px]" id="chat-hub-layout">
      {/* Side Panel: Active Chat Sessions */}
      <div className="md:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col" id="chat-rooms-panel">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Consultations</h3>
          </div>
          <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">Session List</span>
        </div>

        <div className="flex-grow overflow-y-auto p-3 space-y-2.5" id="chat-rooms-list">
          {loadingRooms ? (
            <div className="flex items-center justify-center py-10" id="rooms-loading">
              <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium text-xs space-y-2" id="rooms-empty">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
              <p>No active chat rooms found.</p>
              <p className="text-[10px] text-slate-400">Search for nearest doctor and start secure chats.</p>
            </div>
          ) : (
            rooms.map((room) => {
              const isDoctor = userProfile?.role === "doctor";
              const interlocutorName = isDoctor ? room.farmerName : room.doctorName;
              const isSelected = room.id === activeChatId;

              return (
                <div
                  key={room.id}
                  onClick={() => onSelectChat(room.id)}
                  className={`p-3 rounded-lg cursor-pointer transition duration-150 flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-100 text-slate-900 font-semibold text-sm border border-slate-200"
                      : "text-slate-500 hover:bg-slate-50 text-sm border border-transparent"
                  }`}
                  id={`room-item-${room.id}`}
                >
                  <div className="min-w-0 pr-3 flex items-center space-x-3">
                    <span className="opacity-70">{isDoctor ? "🧑‍🌾" : "👨‍⚕️"}</span>
                    <div className="truncate">
                      <span>{interlocutorName}</span>
                      <p className="text-[10px] mt-0.5 truncate text-slate-400 font-normal">
                        {room.lastMessage || "Click to chat..."}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                      {room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "New"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Panel: Conversation Thread */}
      <div className="md:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-0" id="chat-messages-panel">
        {activeChatId && activeRoom ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0" id="chat-active-header">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                <h3 className="text-sm font-bold text-slate-800">
                  Secure Chat Interface
                  <span className="ml-2 font-normal text-slate-500 text-xs">({userProfile?.role === "doctor" ? activeRoom.farmerName : activeRoom.doctorName})</span>
                </h3>
              </div>
              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">Firestore Real-time</span>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 bg-red-50 text-red-800 border-b border-red-100 text-xs flex items-center gap-2" id="chat-error-banner">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <p>{error}</p>
              </div>
            )}

            {/* Message List */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4" id="chat-message-list">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20" id="messages-loading">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-medium text-xs space-y-2" id="messages-empty">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-300" />
                  <p>Starting chat log...</p>
                  <p className="text-[10px] text-slate-400">Type a message below to send secure updates to your specialist.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwnMessage = msg.senderId === auth.currentUser?.uid;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      id={`msg-bubble-${msg.id}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 ${
                          isOwnMessage
                            ? "bg-blue-600 text-white rounded-tl-xl rounded-bl-xl rounded-br-xl shadow-sm shadow-blue-600/20"
                            : "bg-slate-100 rounded-tr-xl rounded-br-xl rounded-bl-xl border border-slate-200"
                        }`}
                      >
                        <p className={`text-xs ${isOwnMessage ? "text-white" : "text-slate-800"}`}>{msg.text}</p>
                        <p className={`text-[9px] mt-1 uppercase font-bold ${isOwnMessage ? "text-blue-200 text-right" : "text-slate-400"}`}>
                          {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 shrink-0 flex items-center" id="chat-input-form">
              <div className="flex space-x-2 w-full">
                <input
                  type="text"
                  required
                  maxLength={2048}
                  placeholder="Type a secure message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                  id="chat-text-input"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  id="chat-send-btn"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center" id="chat-no-room-state">
            <MessageSquare className="w-16 h-16 text-slate-200 mb-2" />
            <h5 className="text-sm font-bold text-slate-800">Select a secure chat interface</h5>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">Click on any active consultation on the left panel to begin encrypted messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
