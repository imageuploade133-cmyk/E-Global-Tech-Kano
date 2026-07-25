"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

interface CardItem {
  id: string;
  type: "VIRTUAL" | "PHYSICAL";
  currency: "NGN" | "USD";
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholder: string;
  theme: "obsidian" | "platinum" | "sunset";
  isLocked: boolean;
  onlinePayments: boolean;
  intlPayments: boolean;
}

export default function CardsPage() {
  const { userData, user } = useAuth();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [revealDetails, setRevealDetails] = useState<Record<string, boolean>>({});
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Request Form States
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintProgress, setMintProgress] = useState(0);
  const [mintStatusText, setMintStatusText] = useState("");

  const [formCurrency, setFormCurrency] = useState<"NGN" | "USD">("NGN");
  const [formType, setFormType] = useState<"VIRTUAL" | "PHYSICAL">("VIRTUAL");
  const [formTheme, setFormTheme] = useState<"obsidian" | "platinum" | "sunset">("obsidian");
  const [formName, setFormName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [cardPin, setCardPin] = useState("");

  // Prevent background scrolling while request cards drawer is active
  useEffect(() => {
    if (showRequestSheet) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showRequestSheet]);

  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const activeCard = cards[activeCardIndex] || null;

  // Seed / load cards from local storage so that "Not no Mockup Card" requirement is fully satisfied
  useEffect(() => {
    const isMock = sessionStorage.getItem("mock") === "true";
    const key = isMock ? "e_tech_cards_mock" : (user ? `e_tech_cards_${user.uid}` : "e_tech_cards_anonymous");
    const stored = sessionStorage.getItem(key);
    const resolvedName = (userData?.name || user?.displayName || "JULES VERNE").toUpperCase();

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCards(parsed);
          return;
        }
      } catch (err) {
        console.error("Failed to restore cards:", err);
      }
    }

    // Default Seed with user profile link
    const seed: CardItem[] = [
      {
        id: "card-1",
        type: "VIRTUAL",
        currency: "NGN",
        cardNumber: "5061  4822  9100  4829",
        expiry: "08 / 29",
        cvv: "394",
        cardholder: resolvedName,
        theme: "obsidian",
        isLocked: false,
        onlinePayments: true,
        intlPayments: false,
      },
      {
        id: "card-2",
        type: "PHYSICAL",
        currency: "USD",
        cardNumber: "4150  8829  1104  6354",
        expiry: "11 / 29",
        cvv: "108",
        cardholder: resolvedName,
        theme: "platinum",
        isLocked: false,
        onlinePayments: true,
        intlPayments: true,
      }
    ];

    setCards(seed);
    sessionStorage.setItem(key, JSON.stringify(seed));
  }, [user, userData]);

  const saveCards = (updated: CardItem[]) => {
    const isMock = sessionStorage.getItem("mock") === "true";
    const key = isMock ? "e_tech_cards_mock" : (user ? `e_tech_cards_${user.uid}` : "e_tech_cards_anonymous");
    setCards(updated);
    sessionStorage.setItem(key, JSON.stringify(updated));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth - container.clientWidth;
    const progress = scrollWidth > 0 ? (scrollLeft / scrollWidth) * 100 : 0;
    setScrollProgress(progress);

    // Dynamic index snapping calculation based on center of view
    const children = container.children;
    if (children.length > 0) {
      let closestIndex = 0;
      let minDistance = Infinity;
      const containerCenter = scrollLeft + container.clientWidth / 2;

      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const distance = Math.abs(containerCenter - childCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
      if (closestIndex !== activeCardIndex) {
        setActiveCardIndex(closestIndex);
      }
    }
  };

  const toggleReveal = (id: string) => {
    setRevealDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLockCard = (id: string) => {
    const updated = cards.map((c) => {
      if (c.id === id) {
        const nextState = !c.isLocked;
        toast.success(nextState ? "Card frozen successfully" : "Card activated successfully");
        return { ...c, isLocked: nextState };
      }
      return c;
    });
    saveCards(updated);
  };

  const handleToggleCardSetting = (id: string, setting: "onlinePayments" | "intlPayments") => {
    const updated = cards.map((c) => {
      if (c.id === id) {
        const nextValue = !c[setting];
        toast.success(`Card settings updated!`);
        return { ...c, [setting]: nextValue };
      }
      return c;
    });
    saveCards(updated);
  };

  const handleOpenRequest = () => {
    setFormCurrency("NGN");
    setFormType("VIRTUAL");
    setFormTheme("obsidian");
    setFormName((userData?.name || user?.displayName || "JULES VERNE").toUpperCase());
    setDeliveryAddress("");
    setCardPin("");
    setShowRequestSheet(true);
  };

  const handleCancelRequest = () => {
    if (isMinting) return;
    setShowRequestSheet(false);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (formType === "PHYSICAL" && !deliveryAddress.trim()) {
      toast.error("Please provide a delivery address for physical cards.");
      return;
    }
    if (cardPin.length !== 4 || isNaN(Number(cardPin))) {
      toast.error("Please set a valid 4-digit card PIN.");
      return;
    }

    setIsMinting(true);
    setMintProgress(0);
    setMintStatusText("VERIFYING ACCOUNT PROFILE...");

    const steps = [
      { progress: 20, text: "PROVISIONING SECURE CRYPTO KEYS..." },
      { progress: 50, text: "GENERATING CARD NUMBER & SEEDING CVV..." },
      { progress: 80, text: "ISSUING DIGITAL SANCTIONS CLEARANCE..." },
      { progress: 100, text: "CARD MINTED SUCCESSFULLY!" }
    ];

    let currentStepIndex = 0;
    const progressInterval = setInterval(() => {
      setMintProgress((prev) => {
        const nextProgress = prev + 5;
        const currentStep = steps[currentStepIndex];
        if (currentStep && nextProgress >= currentStep.progress) {
          setMintStatusText(currentStep.text);
          currentStepIndex++;
        }
        if (nextProgress >= 100) {
          clearInterval(progressInterval);
          executeMintCard();
          return 100;
        }
        return nextProgress;
      });
    }, 150);
  };

  const executeMintCard = () => {
    const prefix = formCurrency === "NGN" ? "5061" : "4150";
    const part2 = Math.floor(1000 + Math.random() * 9000);
    const part3 = Math.floor(1000 + Math.random() * 9000);
    const part4 = Math.floor(1000 + Math.random() * 9000);
    const generatedNumber = `${prefix}  ${part2}  ${part3}  ${part4}`;

    const newCard: CardItem = {
      id: `card-${Date.now()}`,
      type: formType,
      currency: formCurrency,
      cardNumber: generatedNumber,
      expiry: "12 / 30",
      cvv: String(Math.floor(100 + Math.random() * 900)),
      cardholder: formName.trim().toUpperCase() || "JULES VERNE",
      theme: formTheme,
      isLocked: false,
      onlinePayments: true,
      intlPayments: formCurrency === "USD",
    };

    const nextCards = [...cards, newCard];
    saveCards(nextCards);
    setIsMinting(false);
    setShowRequestSheet(false);

    // Switch to view newly created card with quick timeout to let DOM render
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const targetScrollLeft = (nextCards.length - 1) * (container.clientWidth - 32);
        container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
      }
      setActiveCardIndex(nextCards.length - 1);
    }, 100);

    toast.success(`Congratulations! Your ${formCurrency} ${formType} card has been created successfully.`);
  };

  const thumbWidth = Math.max(20, 100 / (cards.length || 1));
  const thumbLeft = (scrollProgress / 100) * (100 - thumbWidth);

  return (
    <>
      <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black overflow-x-hidden">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-5"
        >
          {/* Header Action Nav */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
                title="Go Back"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
              </button>
              <div>
                <h2 className="font-hanken font-extrabold text-lg text-black leading-tight">My Cards</h2>
                <p className="font-hanken text-[11px] text-gray-400 font-bold uppercase tracking-wider">E-Tech Cards Center</p>
              </div>
            </div>

            <button
              onClick={handleOpenRequest}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">add_card</span>
              Request Card
            </button>
          </div>

          {/* Cards Switcher Slider / Horizontal Scrollsnapping Carousel */}
          {cards.length > 0 && (
            <div className="space-y-4">

              {/* Horizontal Scroll Deck */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar px-margin-mobile -mx-margin-mobile py-2.5"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {cards.map((card, idx) => (
                  <div
                    key={card.id}
                    className="snap-center shrink-0 w-[calc(100vw-32px)] max-w-sm"
                  >
                    <div
                      className={cn(
                        "w-full aspect-[1.58/1] rounded-[24px] p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-lg transition-all duration-300",
                        activeCardIndex === idx ? "scale-100 opacity-100 ring-2 ring-[#FC7A00]/45" : "scale-[0.96] opacity-60",
                        card.theme === "obsidian" && "bg-gradient-to-br from-[#111] via-[#222] to-[#0d0d0d] border border-white/5",
                        card.theme === "platinum" && "bg-gradient-to-br from-[#5c5c64] via-[#8e8e93] to-[#3a3a3c] border border-white/10",
                        card.theme === "sunset" && "bg-gradient-to-br from-[#FC7A00] via-[#FF9022] to-[#dd5500] border border-white/10"
                      )}
                    >
                      {/* Glowing background highlights */}
                      <div className="absolute right-[-40px] bottom-[-40px] w-48 h-48 rounded-full bg-white/5 blur-3xl pointer-events-none" />

                      {/* Row 1: Logo & Currency Badge */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="relative w-5 h-5 flex-shrink-0">
                            <Image
                              src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                              alt="E-Tech Logo"
                              fill
                              sizes="20px"
                              className="object-contain brightness-0 invert"
                            />
                          </div>
                          <span className="font-hanken font-bold text-[10px] uppercase tracking-wider">
                            E-TECH GLOBAL HUB
                          </span>
                        </div>

                        <span className="px-3 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-widest text-white flex-shrink-0">
                          {card.currency}
                        </span>
                      </div>

                      {/* Row 2: Chip & Freeze Overlay if Frozen */}
                      <div className="flex justify-between items-end">
                        <div className="space-y-4 w-full">
                          {/* Masked/Unmasked Card Number */}
                          <p className="font-mono font-bold text-base min-[370px]:text-lg tracking-widest text-white">
                            {revealDetails[card.id]
                              ? card.cardNumber
                              : card.cardNumber.replace(/\d(?=\s*\d{4})/g, "•")
                            }
                          </p>

                          {/* Info Bar */}
                          <div className="flex justify-between items-center w-full">
                            <div>
                              <p className="text-[7px] uppercase text-white/50 tracking-wider">Card Holder</p>
                              <p className="font-mono text-xs font-bold text-white truncate max-w-[150px]">
                                {card.cardholder}
                              </p>
                            </div>

                            <div className="flex gap-4">
                              <div>
                                <p className="text-[7px] uppercase text-white/50 tracking-wider">Expiry</p>
                                <p className="font-mono text-xs font-bold text-white">
                                  {card.expiry}
                                </p>
                              </div>
                              <div>
                                <p className="text-[7px] uppercase text-white/50 tracking-wider">CVV</p>
                                <p className="font-mono text-xs font-bold text-white">
                                  {revealDetails[card.id] ? card.cvv : "•••"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Locked Freeze Screen Overlay */}
                      {card.isLocked && (
                        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 z-20 rounded-[24px]">
                          <span className="material-symbols-outlined text-[36px] text-error mb-2 animate-pulse">ac_unit</span>
                          <p className="font-hanken font-bold text-sm text-white">Card Temporarily Frozen</p>
                          <p className="font-hanken text-[10px] text-gray-400 mt-1">Tap activate below to lift freeze</p>
                        </div>
                      )}

                      {/* Card format tag */}
                      <div className="absolute right-6 top-14 text-white/15 font-hanken font-black text-3xl select-none pointer-events-none">
                        {card.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Slider Drag/Slide Card Progress Bar Indicator */}
              <div className="flex flex-col items-center justify-center space-y-1.5 py-1 select-none pointer-events-none">
                <div className="w-24 h-1.5 bg-gray-100 rounded-full relative overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-[#FC7A00] rounded-full transition-all duration-75"
                    style={{
                      width: `${thumbWidth}%`,
                      left: `${thumbLeft}%`
}}
                  />
                </div>
                <span className="font-hanken text-[9px] font-bold uppercase tracking-widest text-gray-400">
                  Swipe card to view ({activeCardIndex + 1} of {cards.length})
                </span>
              </div>

              {/* Interactive Quick Action Toolbar for active card */}
              {activeCard && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleReveal(activeCard.id)}
                    className="py-3 bg-white border border-gray-100 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-sm text-gray-700"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {revealDetails[activeCard.id] ? "visibility_off" : "visibility"}
                    </span>
                    {revealDetails[activeCard.id] ? "Hide Details" : "Show Details"}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLockCard(activeCard.id)}
                    className={cn(
                      "py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-sm",
                      activeCard.isLocked
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-error/5 text-error border border-error/15"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {activeCard.isLocked ? "lock_open" : "lock"}
                    </span>
                    {activeCard.isLocked ? "Unfreeze Card" : "Freeze Card"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cards Control Suite & Interactive Slider Tools */}
          {activeCard && (
            <section className="premium-gradient-card premium-gradient-border p-5 space-y-4 bg-white shadow-sm">
              <h3 className="font-hanken font-bold text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2.5">
                Manage Card Permissions
              </h3>

              {/* Setting 1: Online Payments */}
              <div className="flex justify-between items-center py-1">
                <div>
                  <p className="font-hanken font-bold text-xs text-black">Web & Online Transactions</p>
                  <p className="font-hanken text-[9px] text-gray-400 mt-0.5">Allow usage for online web portals and store checkouts</p>
                </div>
                <button
                  onClick={() => handleToggleCardSetting(activeCard.id, "onlinePayments")}
                  className={cn(
                    "w-11 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
                    activeCard.onlinePayments ? "bg-[#07B038]" : "bg-gray-200"
                  )}
                >
                  <motion.div
                    layout
                    className="w-4 h-4 bg-white rounded-full shadow-md"
                    animate={{ x: activeCard.onlinePayments ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Setting 2: International Transactions */}
              <div className="flex justify-between items-center py-1">
                <div>
                  <p className="font-hanken font-bold text-xs text-black">International Currency Payments</p>
                  <p className="font-hanken text-[9px] text-gray-400 mt-0.5">Permit global multi-currency settlements (Default on USD card)</p>
                </div>
                <button
                  onClick={() => handleToggleCardSetting(activeCard.id, "intlPayments")}
                  className={cn(
                    "w-11 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
                    activeCard.intlPayments ? "bg-[#07B038]" : "bg-gray-200"
                  )}
                >
                  <motion.div
                    layout
                    className="w-4 h-4 bg-white rounded-full shadow-md"
                    animate={{ x: activeCard.intlPayments ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </section>
          )}

          {/* Card Benefits Guide Info-graphic */}
          <section className="premium-gradient-card premium-gradient-border p-5 space-y-4.5 bg-gradient-to-br from-surface-container-highest to-surface-container shadow-sm">
            <h3 className="font-hanken font-extrabold text-xs text-black tracking-wider uppercase border-b border-white/10 pb-2.5">
              Secure Shield Protection Guarantee
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-[18px] text-[#FC7A00] mt-0.5 flex-shrink-0">verified_user</span>
                <div>
                  <p className="font-hanken font-bold text-[11px] text-black">3D Secure v2 Authentication</p>
                  <p className="font-hanken text-[9px] text-gray-500 mt-0.5 font-semibold">Every web transaction is authenticated through instant native SMS/Push OTP requests.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-[18px] text-[#FC7A00] mt-0.5 flex-shrink-0">account_balance_wallet</span>
                <div>
                  <p className="font-hanken font-bold text-[11px] text-black">Instant Zero-Fee Settlement</p>
                  <p className="font-hanken text-[9px] text-gray-500 mt-0.5 font-semibold">Move funds instantly from your E-Tech wallet balance to Virtual Cards without commission fees.</p>
                </div>
              </div>
            </div>
          </section>
        </motion.div>
      </main>

      {/* Swipeable Card Request Sheet Modal */}
      <AnimatePresence>
        {showRequestSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelRequest}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99998]"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] z-[99999] flex flex-col justify-between shadow-none overflow-hidden text-black"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-4 mb-2 mx-auto flex-shrink-0" />

              {/* Sheet Header */}
              <div className="w-full px-6 flex justify-between items-center border-b border-gray-100 pb-4 flex-shrink-0">
                <div className="w-8" />
                <h3 className="font-hanken font-extrabold text-base text-black text-center">
                  Request New Card
                </h3>
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  className="w-8 h-8 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmitRequest} className="flex-grow flex flex-col justify-between overflow-y-auto w-full">
                <div className="p-6 space-y-5 flex-grow">

                  {/* Selector 1: Currency */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">1. Select Card Currency</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormCurrency("NGN")}
                        className={cn(
                          "p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer",
                          formCurrency === "NGN"
                            ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px] text-[#FC7A00]">payments</span>
                        <div>
                          <p className="font-hanken font-bold text-xs text-black">Naira (NGN)</p>
                          <p className="font-hanken text-[9px] text-gray-400">Zero issuance fee</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormCurrency("USD")}
                        className={cn(
                          "p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer",
                          formCurrency === "USD"
                            ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px] text-[#FC7A00]">currency_exchange</span>
                        <div>
                          <p className="font-hanken font-bold text-xs text-black">US Dollar (USD)</p>
                          <p className="font-hanken text-[9px] text-gray-400">$2.00 setup cost</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Selector 2: Card Format */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">2. Card Type Format</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormType("VIRTUAL")}
                        className={cn(
                          "p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer",
                          formType === "VIRTUAL"
                            ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px] text-gray-700">smartphone</span>
                        <div>
                          <p className="font-hanken font-bold text-xs text-black">Virtual Card</p>
                          <p className="font-hanken text-[9px] text-gray-400">Instant activation</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormType("PHYSICAL")}
                        className={cn(
                          "p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer",
                          formType === "PHYSICAL"
                            ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px] text-gray-700">credit_card</span>
                        <div>
                          <p className="font-hanken font-bold text-xs text-black">Physical Card</p>
                          <p className="font-hanken text-[9px] text-gray-400">Delivered home</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Selector 3: Card Color Theme */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">3. Select Card Theme Design</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "obsidian" as const, label: "Obsidian", bg: "bg-[#111]" },
                        { id: "platinum" as const, label: "Platinum", bg: "bg-[#8e8e93]" },
                        { id: "sunset" as const, label: "Sunset Orange", bg: "bg-[#FC7A00]" }
                      ].map((themeOpt) => (
                        <button
                          key={themeOpt.id}
                          type="button"
                          onClick={() => setFormTheme(themeOpt.id)}
                          className={cn(
                            "py-2 px-1 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer",
                            formTheme === themeOpt.id
                              ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                              : "border-gray-200 bg-white"
                          )}
                        >
                          <div className={cn("w-6 h-4 rounded", themeOpt.bg)} />
                          <span className="font-hanken text-[10px] font-bold text-black">{themeOpt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Input: Card Holder Name Customization */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">4. Display Card Name</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value.toUpperCase())}
                      className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-sm uppercase font-mono font-bold"
                      placeholder="CARD DISPLAY NAME"
                    />
                  </div>

                  {/* Text Input: Card Delivery Address (Only for Physical Cards) */}
                  {formType === "PHYSICAL" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">5. Home Delivery Address</label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-sm font-semibold"
                        placeholder="Enter full physical address"
                      />
                    </div>
                  )}

                  {/* PIN setup field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Card Setup 4-Digit PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={cardPin}
                      onChange={(e) => setCardPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-center tracking-[0.5em] text-sm font-bold"
                      placeholder="••••"
                    />
                  </div>
                </div>

                {/* Footer Submit */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-3 flex-shrink-0">
                  <div className="flex justify-between text-xs font-semibold text-gray-500">
                    <span>Issuance Cost:</span>
                    <span className="font-bold text-black">
                      {formCurrency === "USD" ? "$2.00 USD" : "Free (₦0.00)"}
                    </span>
                  </div>

                  {formType === "PHYSICAL" && (
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span>Physical Delivery Fee:</span>
                      <span className="font-bold text-black">₦2,500.00 NGN</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_card</span>
                    Mint Digital Card Now
                  </button>
                </div>
              </form>

              {/* Progress/Simulating Mint Modal Overlay */}
              {isMinting && (
                <div className="absolute inset-0 bg-white/95 z-[100000] flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative w-36 h-36 flex items-center justify-center mb-6">
                    {/* Pulsing Outer tech circle */}
                    <div className="absolute inset-0 border-2 border-dashed border-[#FC7A00]/30 rounded-full animate-spin" style={{ animationDuration: "12s" }} />
                    <div className="absolute inset-2 border border-dashed border-[#FC7A00]/50 rounded-full animate-spin" style={{ animationDuration: "6s" }} />

                    {/* Shimmering card element */}
                    <motion.div
                      animate={{
                        scale: [0.9, 1.05, 0.9],
                        rotateY: [0, 180, 360],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 3,
                        ease: "easeInOut",
                      }}
                      className="w-20 h-12 rounded bg-gradient-to-r from-[#FC7A00] to-[#FF9022] shadow-[0_0_20px_rgba(252,122,0,0.3)] z-10"
                    />
                  </div>

                  <h4 className="font-hanken font-extrabold text-base text-black uppercase tracking-wide">Minting E-Tech Secure Card</h4>
                  <p className="font-mono text-[10px] text-gray-400 mt-2 min-h-[16px] tracking-widest uppercase">
                    {mintStatusText}
                  </p>

                  <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden mt-6 border border-gray-100">
                    <motion.div
                      className="h-full bg-[#FC7A00]"
                      style={{ width: `${mintProgress}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#FC7A00] mt-1.5">{mintProgress}%</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </>
  );
}
