"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import { toast } from "sonner";

export interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SupportChatMessage {
  id?: string;
  sender: "user" | "admin";
  senderName: string;
  text?: string;
  audioUrl?: string;
  timestamp: any;
}

export function SupportChatModal({ isOpen, onClose }: SupportChatModalProps) {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const uid = user?.uid;
  const userName = (userData?.name || user?.displayName || "User") as string;
  const userEmail = (userData?.email || user?.email || "") as string;
  const userPhone = (userData?.phoneNumber || userData?.phone || "") as string;

  useModalBackHandler(isOpen, onClose, "support-chat-modal");

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Real-time Firestore Listener
  useEffect(() => {
    if (!isOpen || !uid) return;

    const chatDocRef = doc(db, "support_chats", uid);
    const messagesColRef = collection(db, "support_chats", uid, "messages");
    const q = query(messagesColRef, orderBy("timestamp", "asc"));

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
  }, [isOpen, uid]);

  if (!isOpen) return null;

  const handleSendTextMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputMessage.trim();
    if (!textToSend || !uid) return;

    setInputMessage("");
    setSending(true);

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
          lastMessage: textToSend,
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

  const startRecording = async () => {
    try {
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
            } catch (err) {
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
      toast.error("Microphone access denied.");
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
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[200050] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg h-[85vh] max-h-[680px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-black border border-gray-100"
        >
          {/* Modal Header Bar */}
          <div className="p-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                <span className="material-symbols-outlined text-2xl font-bold">support_agent</span>
              </div>
              <div>
                <h2 className="font-extrabold text-base leading-tight">Live Support & Helpdesk</h2>
                <p className="text-[11px] text-white/80 font-medium">Real-time Encrypted Support Channel</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Online
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-colors"
                title="Close"
              >
                <span className="material-symbols-outlined text-lg font-bold">close</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/60">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00] mb-3">
                  <span className="material-symbols-outlined text-3xl font-bold">forum</span>
                </div>
                <p className="text-sm font-extrabold text-gray-800">Support Administrator Live Chat</p>
                <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed">
                  Have an issue logging in or verifying your device? Send a message or voice note directly to our team.
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
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-medium shadow-2xs leading-relaxed ${
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
                          <audio controls src={msg.audioUrl} className="w-full h-8 min-w-[180px]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar Footer */}
          <form onSubmit={handleSendTextMessage} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0">
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                  <span className="text-xs font-bold font-mono">Recording... ({recordingSeconds}s)</span>
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
                  placeholder="Describe your issue or ask for help..."
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
