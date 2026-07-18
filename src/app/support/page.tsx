"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/AuthContext";

import { useAppConfig } from "@/lib/ConfigContext";

export default function SupportPage() {
  const { userData, user } = useAuth();
  const { config } = useAppConfig();
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Mock priority number list
  const CONTACTS = [
    {
      id: "priority",
      title: "Priority Helpline",
      subtitle: "24/7 Dedicated Call Center",
      phone: config.supportPhone1,
      formattedPhone: config.supportPhone1,
      icon: "phone_in_talk",
      badge: "Toll Free",
      color: "from-[#FC7A00] to-[#FF9022]",
    },
    {
      id: "whatsapp",
      title: "WhatsApp VIP Chat",
      subtitle: "Instant Chat Support",
      phone: config.supportPhone2,
      formattedPhone: config.supportPhone2,
      icon: "chat",
      badge: "Fastest Response",
      color: "from-emerald-500 to-teal-600",
    },
  ];

  const FAQs = [
    {
      question: "What information should I prepare before calling?",
      answer: "Please have your registered email address and the transaction reference ID (if applicable) ready. This helps our specialist verify your profile instantly."
    },
    {
      question: "Is support really free?",
      answer: "Yes, our Priority Toll-Free line (+234 800 E-GLOBAL) is completely free of charge. Standard mobile operator fees may apply to international numbers."
    },
    {
      question: "What should I do if my card is lost or compromised?",
      answer: "You should immediately lock your card in the Profile tab, or call our priority line directly. An agent will suspend the card and initiate a replacement in minutes."
    }
  ];

  const handleCopyPhone = (phone: string, title: string) => {
    navigator.clipboard.writeText(phone);
    toast.success(`${title} number copied to clipboard!`);
  };

  const handleSimulateDispute = (type: string) => {
    toast.info(`Dispute ticket for "${type}" initiated! Our support system is generating your tracking reference...`);
    setTimeout(() => {
      toast.success("Ticket #ET-99382 Created. A care representative will reach out in a few minutes.");
    }, 1500);
  };

  return (
    <>
      <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-5"
        >
          {/* Header Action Nav */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>
            <div>
              <h2 className="font-hanken font-extrabold text-lg text-black leading-tight">Help & Support</h2>
              <p className="font-hanken text-[11px] text-gray-400 font-bold uppercase tracking-wider">E-Tech Global Hub 24/7</p>
            </div>
          </div>

          {/* Premium Hero Card with Support Mic Icon */}
          <section className="premium-gradient-card premium-gradient-border p-5 relative overflow-hidden bg-gradient-to-br from-surface-container-highest to-surface-container">
            <div className="absolute right-[-10px] top-[-10px] opacity-10">
              <span className="material-symbols-outlined text-[120px] text-primary" style={{ fontVariationSettings: '"wght" 300' }}>
                support_agent
              </span>
            </div>

            <div className="flex gap-4 items-start relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00] flex-shrink-0">
                <span className="material-symbols-outlined text-[28px]">headset_mic</span>
              </div>
              <div>
                <h3 className="font-hanken font-extrabold text-sm text-black">How can we assist you, {userName.split(" ")[0]}?</h3>
                <p className="font-hanken text-xs text-gray-500 mt-1 leading-relaxed font-semibold">
                  Reach out directly via call or chat for immediate resolution of transfer issues, limits, or security concerns.
                </p>
              </div>
            </div>
          </section>

          {/* Core Instruction Steps: Beautiful and Clear */}
          <section className="premium-gradient-card premium-gradient-border p-5 space-y-4 bg-white shadow-sm">
            <h4 className="font-hanken font-bold text-[12px] uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
              Calling Support: Steps & Security Notice
            </h4>

            <div className="space-y-3.5">
              {/* Step 1 */}
              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-[#FC7A00] text-white flex items-center justify-center font-mono text-[10px] font-bold mt-0.5 flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-hanken font-bold text-xs text-black">Locate Your Account Details</p>
                  <p className="font-hanken text-[10px] text-gray-400 mt-0.5 leading-relaxed font-semibold">
                    Find your Customer ID or registered email. Providing this to our agent expedites identity confirmation.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-[#FC7A00] text-white flex items-center justify-center font-mono text-[10px] font-bold mt-0.5 flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-hanken font-bold text-xs text-black">Tap the Phone Link below</p>
                  <p className="font-hanken text-[10px] text-gray-400 mt-0.5 leading-relaxed font-semibold">
                    We support one-touch direct dial. Click any hotline below to initiate a premium, immediate call connection.
                  </p>
                </div>
              </div>

              {/* Step 3 - Critical Security Notice */}
              <div className="flex gap-3 items-start p-3 bg-error-container/40 border border-error/15 rounded-2xl">
                <div className="w-5 h-5 rounded-full bg-error text-error-container flex items-center justify-center mt-0.5 flex-shrink-0">
                  <span className="material-symbols-outlined text-[12px] font-bold">gpp_maybe</span>
                </div>
                <div>
                  <p className="font-hanken font-bold text-xs text-error">CRITICAL SECURITY WARNING</p>
                  <p className="font-hanken text-[10px] text-gray-600 mt-0.5 leading-relaxed font-semibold">
                    Our support agents will <strong className="text-black underline">NEVER</strong> ask for your Access PIN, login password, or transaction OTP tokens. Never share this data with anyone over phone or chat.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Methods (Interactive Hotlines) */}
          <section className="space-y-3">
            <h4 className="font-hanken font-bold text-[12px] uppercase tracking-wider text-gray-400 px-1">
              Select Contact Hotline
            </h4>

            <div className="space-y-3">
              {CONTACTS.map((contact) => (
                <div
                  key={contact.id}
                  className="premium-gradient-card premium-gradient-border p-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">{contact.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-hanken font-bold text-xs text-black truncate">{contact.title}</p>
                        <span className="px-1.5 py-0.5 bg-gray-100 text-[8px] font-black uppercase text-gray-500 rounded tracking-wider">
                          {contact.badge}
                        </span>
                      </div>
                      <p className="font-mono font-bold text-[13px] text-black mt-1 tracking-tight">
                        {contact.formattedPhone}
                      </p>
                      <p className="font-hanken text-[9px] text-gray-400 mt-0.5">{contact.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(contact.phone, contact.title)}
                      className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-black active:scale-90 transition-all cursor-pointer"
                      title="Copy Number"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                      className="w-8 h-8 rounded-full bg-gradient-to-r from-[#FC7A00] to-[#FF9022] flex items-center justify-center text-white active:scale-90 transition-all cursor-pointer"
                      title="Call Now"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Priority Quick Dispute Tickets */}
          <section className="premium-gradient-card premium-gradient-border p-5 space-y-3 bg-white shadow-sm">
            <div>
              <h4 className="font-hanken font-bold text-xs text-black">Need Quick Troubleshooting?</h4>
              <p className="font-hanken text-[10px] text-gray-400 mt-0.5">Click any category to raise a priority claim instantly</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSimulateDispute("Failed Transfer Return")}
                className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-left transition-colors active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-[#FC7A00]">payments</span>
                <span className="font-hanken text-[10px] font-bold text-black leading-tight">Failed Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDispute("Biometric Re-calibration")}
                className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-left transition-colors active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-500">face</span>
                <span className="font-hanken text-[10px] font-bold text-black leading-tight">KYC / Face ID</span>
              </button>
            </div>
          </section>

          {/* Quick FAQ Section */}
          <section className="premium-gradient-card premium-gradient-border p-5 space-y-3 bg-white shadow-sm">
            <h4 className="font-hanken font-bold text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
              Frequently Asked Questions
            </h4>

            <div className="space-y-2">
              {FAQs.map((faq, idx) => (
                <div key={idx} className="border-b border-gray-50 pb-2 last:border-none last:pb-0">
                  <button
                    type="button"
                    onClick={() => setActiveFAQ(activeFAQ === idx ? null : idx)}
                    className="w-full flex justify-between items-center text-left py-1 outline-none text-black hover:text-[#FC7A00] transition-colors cursor-pointer"
                  >
                    <span className="font-hanken font-bold text-[11px] pr-2">{faq.question}</span>
                    <span className="material-symbols-outlined text-[16px] text-gray-400 flex-shrink-0">
                      {activeFAQ === idx ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {activeFAQ === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="font-hanken text-[10px] text-gray-400 mt-1 leading-relaxed font-semibold">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </motion.div>
      </main>

      <BottomNav />
    </>
  );
}
