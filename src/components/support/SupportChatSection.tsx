"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { SupportChatModal } from "@/components/support/SupportChatModal";
import { toast } from "sonner";

export interface SupportChatMessage {
  id?: string;
  sender: "user" | "admin";
  senderName: string;
  text?: string;
  audioUrl?: string;
  timestamp: any;
}

export function SupportChatSection() {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isFullScreenModalOpen, setIsFullScreenModalOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const uid = user?.uid;
  const userName = (userData?.name || user?.displayName || "User") as string;
  const userEmail = (userData?.email || user?.email || "") as string;
  const userPhone = (userData?.phoneNumber || userData?.phone || "") as string;

  // Auto scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time Firestore Listener for Chat Room and Messages
  useEffect(() => {
    if (!uid) return;

    const chatDocRef = doc(db, "support_chats", uid);
    const messagesColRef = collection(db, "support_chats", uid, "messages");
    const q = query(messagesColRef, orderBy("timestamp", "asc"));

    // Reset user unread counter when opening support page
    updateDoc(chatDocRef, { unreadUser: 0 }).catch(() => {});

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SupportChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          sender: data.sender || "user",
          senderName: data.senderName || "User",
          text: data.text || "",
          audioUrl: data.audioUrl || "",
          timestamp: data.timestamp,
        });
      });
      setMessages(list);
    });

    return () => unsubscribe();
  }, [uid]);

  const handleSendTextMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputMessage.trim();
    if (!textToSend || !uid) return;

    setInputMessage("");
    setSending(true);

    try {
      const chatDocRef = doc(db, "support_chats", uid);
      const messagesColRef = collection(db, "support_chats", uid, "messages");

      // Ensure room header document exists and updates unread count for Admin
      await setDoc(
        chatDocRef,
        {
          userId: uid,
          userName,
          userEmail,
          userPhone,
          lastMessage: textToSend,
          lastMessageAt: serverTimestamp(),
          unreadAdmin: ((await (await import("firebase/firestore")).getDoc(chatDocRef)).data()?.unreadAdmin || 0) + 1,
          unreadUser: 0,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Add message
      await addDoc(messagesColRef, {
        sender: "user",
        senderName: userName,
        text: textToSend,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });

    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Start Audio Recording
  const startRecording = async () => {
    try {
      // Android/iOS WebView needs the native permission flow before getUserMedia.
      const bridge =
        typeof window !== "undefined"
          ? (window as any).flutter_inappwebview
          : null;

      if (bridge && typeof bridge.callHandler === "function") {
        const granted = await bridge.callHandler("requestMicrophonePermission");
        if (granted === false) {
          throw new Error("Microphone permission was denied.");
        }
      }

      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        throw new Error("Microphone recording is not supported on this device.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Convert Audio Blob to Base64 URI for instant lightweight storage
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (base64Audio && uid) {
            try {
              const chatDocRef = doc(db, "support_chats", uid);
              const messagesColRef = collection(db, "support_chats", uid, "messages");

              await setDoc(
                chatDocRef,
                {
                  userId: uid,
                  userName,
                  userEmail,
                  userPhone,
                  lastMessage: "🎤 Voice Note",
                  lastMessageAt: serverTimestamp(),
                  unreadAdmin: ((await (await import("firebase/firestore")).getDoc(chatDocRef)).data()?.unreadAdmin || 0) + 1,
                  unreadUser: 0,
                  updatedAt: new Date().toISOString(),
                },
                { merge: true }
              );

              await addDoc(messagesColRef, {
                sender: "user",
                senderName: userName,
                audioUrl: base64Audio,
                timestamp: serverTimestamp(),
                createdAt: new Date().toISOString(),
              });

              toast.success("Voice note sent!");
            } catch (err: any) {
              toast.error("Failed to send voice note.");
            }
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      toast.error("Microphone access denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col h-[480px]">
      {/* Header Bar */}
      <div className="p-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-xl">support_agent</span>
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white leading-tight">Administrator Live Support</h3>
            <p className="text-[10px] text-white/80 font-medium">Real-time Encrypted Support Channel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFullScreenModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-hanken font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer border border-white/20 shadow-xs"
            title="Open Live Chat in Full Screen"
          >
            <span className="material-symbols-outlined text-sm font-bold">open_in_full</span>
            <span className="hidden sm:inline">Full Screen</span>
          </button>

          <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Online
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <span className="material-symbols-outlined text-4xl text-[#FC7A00]/40 mb-2">forum</span>
            <p className="text-xs font-bold text-gray-600">Start a conversation with Support</p>
            <p className="text-[11px] text-gray-400 max-w-xs mt-1">
              Type a message or record a voice note below. An administrator will respond shortly.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender === "user";
            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[82%] p-3 rounded-2xl text-xs font-medium shadow-2xs leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-r from-[#FC7A00] to-[#FF9022] text-white rounded-tr-none"
                      : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase mb-1 tracking-wider ${isMe ? "text-white/80" : "text-[#FC7A00]"}`}>
                    {isMe ? "You" : "Support Administrator"}
                  </p>
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {msg.audioUrl && (
                    <div className="mt-1">
                      <audio controls src={msg.audioUrl} className="w-full h-8 min-w-[200px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <form onSubmit={handleSendTextMessage} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-bold font-mono">Recording Voice Note... ({recordingSeconds}s)</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-rose-700"
            >
              Stop & Send
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
            />

            <button
              type="button"
              onClick={startRecording}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              title="Record Voice Note"
            >
              <span className="material-symbols-outlined text-lg">mic</span>
            </button>

            <button
              type="submit"
              disabled={sending || !inputMessage.trim()}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white flex items-center justify-center shrink-0 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </>
        )}
      </form>

      {/* Full Screen Live Chat Modal */}
      <SupportChatModal
        isOpen={isFullScreenModalOpen}
        onClose={() => setIsFullScreenModalOpen(false)}
      />
    </div>
  );
}
