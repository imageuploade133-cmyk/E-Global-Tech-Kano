"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EstateProperty, EstateSeller } from "@/estate/types";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface EstateChatInquiryModalProps {
  isOpen: boolean;
  property: EstateProperty | null;
  publisherAgent: EstateSeller | null;
  onClose: () => void;
  onSubmitInquiry: (message: string) => Promise<boolean | void> | void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  time: string;
  status?: "sent" | "delivered" | "read";
}

export const EstateChatInquiryModal: React.FC<EstateChatInquiryModalProps> = ({
  isOpen,
  property,
  publisherAgent,
  onClose,
  onSubmitInquiry,
}) => {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useModalBackHandler(
    isOpen,
    onClose,
    property ? `estate-chat-inquiry-${property.id}` : "estate-chat-inquiry"
  );

  // Initialize messages or load history
  useEffect(() => {
    if (isOpen && property) {
      // Default welcome message from agent or system
      const agentName = publisherAgent?.displayName || property.sellerName || "Agent";
      setMessages([
        {
          id: "welcome",
          sender: "agent",
          text: `Hello! I am ${agentName}. How can I assist you regarding "${property.title}"?`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, property, publisherAgent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen || !property) return null;

  const quickQuestions = [
    "Is this property still available?",
    "When can I schedule an inspection?",
    "Are the prices negotiable?",
    "What are the payment terms?",
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) {
      toast.error("Please type a message before sending.");
      return;
    }

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setInputText("");
    setIsSending(true);

    try {
      await onSubmitInquiry(text.trim());
      // Add simulated agent auto-response acknowledgement
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "agent",
            text: "Thank you for your message! Our agent has been notified and will respond shortly.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }, 1000);
    } catch {
      toast.error("Failed to send inquiry. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const agentName = publisherAgent?.displayName || property.sellerName || "Property Agent";
  const agentPhone = publisherAgent?.phone || property.sellerPhone;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100020] bg-gray-50 w-full h-full flex flex-col justify-between overflow-hidden text-black font-hanken">
          {/* Header Bar */}
          <div className="px-4 py-3 bg-white flex items-center justify-between z-10">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-all cursor-pointer border-0 active:scale-90 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FC7A00] to-[#E06600] text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-2xs">
                  {agentName[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-xs text-black truncate">{agentName}</h3>
                    {(publisherAgent?.isVerified || true) && (
                      <span className="material-symbols-outlined text-emerald-600 text-[15px]" title="Verified Partner">
                        verified
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold truncate">
                    {publisherAgent?.agencyName || "Estate Direct Partner"} • Active Agent
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Contact Actions */}
            {agentPhone && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`tel:${agentPhone}`}
                  className="w-9 h-9 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center cursor-pointer border border-emerald-200 transition-all active:scale-90"
                  title="Call Agent"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                </a>
                <a
                  href={`https://wa.me/${agentPhone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer border-0 transition-all active:scale-90"
                  title="WhatsApp Agent"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </a>
              </div>
            )}
          </div>

          {/* Property Context Header Card */}
          <div className="px-4 py-2.5 bg-white/90 flex items-center gap-3 flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gray-100 relative overflow-hidden flex-shrink-0 border border-gray-200">
              {property.images && property.images[0] ? (
                <Image src={property.images[0]} alt="Prop" fill className="object-cover" unoptimized />
              ) : (
                <span className="material-symbols-outlined text-[24px] text-gray-400 flex items-center justify-center h-full">
                  domain
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-xs text-black truncate uppercase">{property.title}</h4>
              <p className="font-mono text-xs font-black text-[#FC7A00]">
                ₦{property.price.toLocaleString()}
                {property.purpose !== "Sale" && property.pricePeriod && (
                  <span className="text-[10px] text-gray-500 font-bold"> /{property.pricePeriod}</span>
                )}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-orange-100 text-[#FC7A00] border border-orange-200 flex-shrink-0">
              For {property.purpose}
            </span>
          </div>

          {/* Chat Stream Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-[#F8F9FA]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] p-3.5 rounded-2xl shadow-2xs space-y-1 ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-br-none"
                      : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                  }`}
                >
                  <p className="text-xs font-semibold leading-relaxed whitespace-pre-line">{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 text-[9px] font-bold ${
                      msg.sender === "user" ? "text-orange-100" : "text-gray-400"
                    }`}
                  >
                    <span>{msg.time}</span>
                    {msg.sender === "user" && (
                      <span className="material-symbols-outlined text-[13px]">done_all</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions Chips & Input Bar */}
          <div className="p-3 bg-white border-t border-gray-150 space-y-2.5 flex-shrink-0 shadow-lg">
            {/* Quick chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-orange-50 hover:bg-orange-100 text-[#FC7A00] border border-[#FC7A00]/20 flex-shrink-0 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div className="bg-gradient-to-r from-[#FC7A00] via-amber-400 to-[#E06600] p-[1.5px] rounded-2xl">
              <div className="bg-white rounded-[14.5px] p-1.5 flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your inquiry or message..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs font-semibold text-black placeholder-gray-400 outline-none"
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isSending || !inputText.trim()}
                  className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white flex items-center justify-center cursor-pointer border-0 disabled:opacity-50 transition-all active:scale-90 flex-shrink-0 shadow-2xs"
                >
                  {isSending ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
