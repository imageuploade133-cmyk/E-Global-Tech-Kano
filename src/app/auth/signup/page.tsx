"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import Image from "next/image";
import { cn, formatFirebaseError } from "@/lib/utils";

export default function SignUpPage() {
  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);

  // Personal Info States (Step 1)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bvnNin, setBvnNin] = useState("");

  // Duplicate Account Check state
  const [accountExistsError, setAccountExistsError] = useState<string | null>(null);
  const [isCheckingExists, setIsCheckingExists] = useState(false);

  const checkAccountExists = async (phoneVal: string, bvnNinVal: string, emailVal: string = "") => {
    setIsCheckingExists(true);
    try {
      const res = await fetch("/api/auth/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneVal,
          bvnNin: bvnNinVal,
          email: emailVal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.exists) {
        setAccountExistsError(data.message);
        return true;
      }
    } catch (err) {
      console.error("Error checking account existence:", err);
    } finally {
      setIsCheckingExists(false);
    }
    return false;
  };

  // Structured Address States (Step 2 is removed/simplified, we can default these safely)
  const [houseNumber, setHouseNumber] = useState("1");
  const [street, setStreet] = useState("Main St");
  const [city, setCity] = useState("Lagos");
  const [state, setState] = useState("Lagos");
  const [country, setCountry] = useState("Nigeria");

  // Account Contact States (Step 2 now)
  const [phonePrefix, setPhonePrefix] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");

  // WhatsApp OTP Verification States
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpError, setOtpError] = useState("");

  // Cooldown countdown timer for OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Reset verification states if phone number or prefix changes
  useEffect(() => {
    setIsOtpVerified(false);
    setIsOtpRequested(false);
    setOtpCode("");
    setOtpError("");
  }, [phonePrefix, phoneNumber]);

  const handleRequestOtp = async () => {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      toast.error("Please enter your phone number first.");
      return;
    }
    setIsSendingOtp(true);
    setOtpError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phonePrefix, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Failed to send OTP.");
        toast.error(data.error || "Failed to send OTP.");
      } else {
        setIsOtpRequested(true);
        setOtpCooldown(60);
        toast.success("Verification code sent to WhatsApp!");
        if (data.devFallback) {
          toast.info("Local Test Mode: OTP logged to server terminal.");
        }
      }
    } catch (err) {
      console.error("Error sending WhatsApp OTP:", err);
      toast.error("Failed to connect to the server.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP code.");
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phonePrefix, phoneNumber, otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Incorrect code or verification failed.");
        toast.error(data.error || "Incorrect code.");
      } else {
        setIsOtpVerified(true);
        toast.success("WhatsApp number verified successfully!");
      }
    } catch (err) {
      console.error("Error verifying WhatsApp OTP:", err);
      toast.error("Failed to verify code.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Account Security States (Step 3 now)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [photo, setPhoto] = useState<string | null>("https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M");
  const [loading, setLoading] = useState(false);
  const [termsError, setTermsError] = useState("");

  // Custom Permission Drawer state (not used anymore but kept to avoid broken references)
  const [showPermissionDrawer, setShowPermissionDrawer] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  // Ripple Effect State
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const hasPushedState = useRef(false);

  // Auto-set Prefix based on country selection
  useEffect(() => {
    if (country === "Nigeria") {
      setPhonePrefix("+234");
    } else if (country === "Niger") {
      setPhonePrefix("+227");
    }
  }, [country]);

  // Password Strength Calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "None", color: "bg-gray-200" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[@$!%*?&]/.test(pass)) score++;

    switch (score) {
      case 1:
        return { score: 1, label: "Very Weak", color: "bg-red-500" };
      case 2:
        return { score: 2, label: "Weak", color: "bg-orange-500" };
      case 3:
        return { score: 3, label: "Medium", color: "bg-yellow-500" };
      case 4:
        return { score: 4, label: "Strong", color: "bg-blue-500" };
      case 5:
        return { score: 5, label: "Excellent", color: "bg-green-500" };
      default:
        return { score: 0, label: "None", color: "bg-gray-200" };
    }
  };

  const pStrength = getPasswordStrength(password);

  // Stop Camera Stream (No-op but kept for refs)
  const stopCamera = React.useCallback(() => {
    setShowCamera(false);
  }, []);

  // Create Ripple Effect
  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  // Stage-by-Stage validation and navigation handlers
  const handleNextStep = async () => {
    if (currentStep === 1) {
      if (!firstName || firstName.trim().length < 2) {
        toast.error("First name must be at least 2 characters.");
        return;
      }
      if (!lastName || lastName.trim().length < 2) {
        toast.error("Last name must be at least 2 characters.");
        return;
      }
      if (!bvnNin || bvnNin.trim().length !== 11 || !/^\d+$/.test(bvnNin.trim())) {
        toast.error("BVN or NIN must be exactly 11 digits.");
        return;
      }

      // Check if this BVN/NIN already exists!
      const alreadyExists = await checkAccountExists("", bvnNin);
      if (alreadyExists) return;

      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!phoneNumber || phoneNumber.trim().length === 0) {
        toast.error("Phone number is required.");
        return;
      }
      if (!email || !email.includes("@")) {
        toast.error("Please provide a valid email address.");
        return;
      }

      if (!isOtpVerified) {
        toast.error("Please verify your WhatsApp number with the OTP code first.");
        return;
      }

      // Check if phone number already exists before proceeding!
      const fullPhone = `${phonePrefix}${phoneNumber}`;
      const alreadyExists = await checkAccountExists(fullPhone, bvnNin, email);
      if (alreadyExists) return;

      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTermsError("");

    // Step 4 final validations
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
      toast.error("Password must be at least 8 characters and include uppercase, lowercase, number, and a special character.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!acceptedTerms || !acceptedPrivacy) {
      setTermsError("You must accept both the Terms & Conditions and Privacy Policy.");
      toast.error("Please accept both the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      // 1. Call secure server-side validation endpoint
      const validateRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth: "2000-01-01",
          houseNumber,
          street,
          city,
          state,
          country,
          postalCode: "",
          phonePrefix,
          phoneNumber,
          email,
          password,
          acceptedTerms,
          acceptedPrivacy,
          acceptedTermsVersion: "v1.0.0",
          acceptedPrivacyVersion: "v1.0.0",
          bvnNin,
        }),
      });

      const validateData = await validateRes.json();
      if (!validateRes.ok || !validateData.success) {
        toast.error(validateData.error || "Server validation failed.");
        setLoading(false);
        return;
      }

      // 2. Create standard Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(user, { displayName: fullName, photoURL: photo });

      // 3. Call secure server-side endpoint to save the complete record
      const idToken = await user.getIdToken();
      const completeRes = await fetch("/api/auth/register-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth: "2000-01-01",
          houseNumber,
          street,
          city,
          state,
          country,
          postalCode: null,
          phonePrefix,
          phoneNumber,
          email,
          referralCode,
          bvn: bvnNin,
          nin: bvnNin,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok || !completeData.success) {
        toast.error(completeData.error || "Failed to complete registration on database.");
        setLoading(false);
        return;
      }

      toast.success("Account created successfully!");
      router.push("/auth/pin-setup");
    } catch (error: unknown) {
      console.error("Signup Error:", error);
      const friendlyMessage = formatFirebaseError(error);
      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6 justify-center text-black">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl mx-auto"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative w-14 h-14 mb-2">
            <Image
              src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
              alt="E-Tech Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-hanken font-bold text-xl tracking-tight text-black">E-TECH GLOBAL HUB</h1>
          <p className="text-gray-500 font-hanken mt-1 text-[11px] font-semibold">Stage-by-Stage Premium Account Setup</p>
        </div>

        {/* Wizard Progress Bar & Step Indicators */}
        <div className="mb-8 max-w-md mx-auto">
          <div className="flex justify-between items-center relative mb-2">
            {/* Background progress bar line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-gray-150 z-0 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] z-0 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            />

            {[1, 2, 3].map((sIndex) => {
              const isActive = currentStep === sIndex;
              const isCompleted = currentStep > sIndex;
              return (
                <button
                  key={sIndex}
                  type="button"
                  onClick={() => {
                    // Prevent skip-ahead without stage validation
                    if (sIndex < currentStep) {
                      setCurrentStep(sIndex);
                    }
                  }}
                  disabled={sIndex > currentStep}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-hanken text-xs font-black z-10 transition-all duration-300 shadow-sm border",
                    isCompleted
                      ? "bg-[#FC7A00] border-[#FC7A00] text-white"
                      : isActive
                      ? "bg-white border-black text-black scale-110"
                      : "bg-white border-gray-250 text-gray-400"
                  )}
                >
                  {isCompleted ? "✓" : sIndex}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase px-1">
            <span className={cn(currentStep === 1 && "text-[#FC7A00]")}>Personal</span>
            <span className={cn(currentStep === 2 && "text-[#FC7A00]")}>Contact</span>
            <span className={cn(currentStep === 3 && "text-[#FC7A00]")}>Security</span>
          </div>
        </div>

        <form onSubmit={handleSignUp} className="space-y-6">
          <AnimatePresence mode="wait">
            {/* STEP 1: Personal Details */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* First & Last Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="firstName" className="text-[10px] font-black uppercase tracking-widest text-gray-400">First Name <span className="text-red-500">*</span></label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                      placeholder="John"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label htmlFor="lastName" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Last Name <span className="text-red-500">*</span></label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                {/* BVN/NIN Input */}
                <div className="space-y-3 text-left">
                  <label htmlFor="bvnNinInput" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    BVN or NIN (11 Digits) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="bvnNinInput"
                      type="tel"
                      required
                      value={bvnNin}
                      onChange={(e) => setBvnNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="Enter your 11-digit BVN or NIN"
                      maxLength={11}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all font-mono"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-gray-400 pointer-events-none">
                      fingerprint
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Contact details */}
            {currentStep === 2 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* Phone Input with WhatsApp Note */}
                <div className="space-y-1.5 text-left">
                  <label htmlFor="phoneNumber" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <select
                      id="phonePrefix"
                      value={phonePrefix}
                      onChange={(e) => setPhonePrefix(e.target.value)}
                      className="bg-white border border-black rounded-2xl px-3.5 outline-none text-xs font-black text-black appearance-none shadow-sm"
                      aria-label="Phone Prefix"
                    >
                      <option value="+234">🇳🇬 +234</option>
                      <option value="+227">🇳🇪 +227</option>
                    </select>
                    <input
                      id="phoneNumber"
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      className="flex-grow bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all font-mono"
                      placeholder="08012345678"
                    />
                  </div>
                  <p className="text-[9.5px] text-amber-600 font-bold leading-tight mt-1">
                    ⚠️ Note: This phone number must be registered on WhatsApp to receive the verification OTP.
                  </p>
                </div>

                {/* OTP Request and Verify Control Panel */}
                {!isOtpVerified ? (
                  <div className="space-y-3.5 text-left bg-gray-50 border border-gray-150 p-4 rounded-2xl">
                    {!isOtpRequested ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">WhatsApp Verification</p>
                          <p className="text-[9px] text-gray-400 font-semibold leading-tight">Verify your WhatsApp number to secure your account registration.</p>
                        </div>
                        <button
                          type="button"
                          disabled={isSendingOtp || !phoneNumber}
                          onClick={handleRequestOtp}
                          className="bg-black text-white hover:bg-gray-900 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-40 transition-all whitespace-nowrap cursor-pointer"
                        >
                          {isSendingOtp ? "Sending..." : "Send OTP"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#FC7A00]">Enter Verification OTP</p>
                          {otpCooldown > 0 ? (
                            <span className="text-[9px] text-gray-400 font-bold">Resend in {otpCooldown}s</span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRequestOtp}
                              className="text-[9px] text-[#FC7A00] hover:underline font-bold cursor-pointer"
                            >
                              Resend Code
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2.5">
                          <input
                            type="tel"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => {
                              setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                              setOtpError("");
                            }}
                            className="flex-grow bg-white border border-black rounded-2xl px-4 py-3 text-xs font-bold tracking-widest text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm font-mono text-center"
                            placeholder="••••••"
                          />
                          <button
                            type="button"
                            disabled={isVerifyingOtp || otpCode.length !== 6}
                            onClick={handleVerifyOtp}
                            className="bg-[#FC7A00] text-white hover:brightness-105 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider disabled:opacity-40 transition-all cursor-pointer"
                          >
                            {isVerifyingOtp ? "Verifying..." : "Verify"}
                          </button>
                        </div>

                        {otpError && (
                          <p className="text-[9px] text-red-500 font-bold">{otpError}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-left">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 font-bold">verified</span>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest">WhatsApp Number Verified</p>
                      <p className="text-[9px] text-emerald-600 font-semibold leading-none">Your WhatsApp number is successfully secured and verified.</p>
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div className="space-y-1.5 text-left">
                  <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address <span className="text-red-500">*</span></label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    placeholder="doe@example.com"
                  />
                </div>

                {/* Referral Account ID */}
                <div className="space-y-1.5 text-left">
                  <label htmlFor="referralCode" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Referral Account ID (Optional)</label>
                  <input
                    id="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.trim().toUpperCase())}
                    className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all font-mono"
                    placeholder="ET-XXXXXX"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: Security details */}
            {currentStep === 3 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* Passwords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FC7A00] cursor-pointer transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? "visibility" : "visibility_off"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FC7A00] cursor-pointer transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showConfirmPassword ? "visibility" : "visibility_off"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1.5 text-left bg-gray-50 p-3 rounded-2xl border border-gray-150">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase text-gray-400">Password Strength</span>
                      <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded text-white", pStrength.color)}>
                        {pStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-250 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-300", pStrength.color)}
                        style={{ width: `${(pStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-gray-400 font-semibold leading-tight">Must include at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character.</p>
                  </div>
                )}

                {/* Terms checkbox */}
                <div className="space-y-3 text-left pt-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="termsCheck"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-[#FC7A00] focus:ring-[#FC7A00] cursor-pointer mt-0.5"
                    />
                    <label htmlFor="termsCheck" className="text-xs text-gray-600 font-semibold select-none leading-relaxed">
                      I agree to the{" "}
                      <Link href="/auth/terms" className="text-[#FC7A00] hover:underline font-bold">
                        Terms & Conditions
                      </Link> (v1.0.0).
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="privacyCheck"
                      checked={acceptedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-[#FC7A00] focus:ring-[#FC7A00] cursor-pointer mt-0.5"
                    />
                    <label htmlFor="privacyCheck" className="text-xs text-gray-600 font-semibold select-none leading-relaxed">
                      I agree to the{" "}
                      <Link href="/auth/privacy" className="text-[#FC7A00] hover:underline font-bold">
                        Privacy Policy
                      </Link> (v1.0.0).
                    </label>
                  </div>

                  {termsError && (
                    <p className="text-[10px] text-red-500 font-bold text-left animate-pulse">{termsError}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Controls Bar */}
          <div className="flex gap-4 pt-4">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 py-4 bg-white border border-black hover:bg-gray-50 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-none cursor-pointer text-center"
              >
                Back
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-grow py-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-110 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-none cursor-pointer flex items-center justify-center gap-1.5"
              >
                Next Step
                <span className="material-symbols-outlined text-[16px] font-bold">chevron_right</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                onClick={handleButtonClick}
                className="flex-grow relative overflow-hidden bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-110 text-white py-4 rounded-xl border border-white/10 font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5 shadow-none"
              >
                {/* Ripple Elements */}
                {ripples.map((ripple) => (
                  <span
                    key={ripple.id}
                    className="absolute bg-white/30 rounded-full pointer-events-none animate-ripple"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      width: 100,
                      height: 100,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}

                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                    />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            )}
          </div>
        </form>

        {/* Global Checking Database Loader Overlay */}
        <AnimatePresence>
          {isCheckingExists && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/80 backdrop-blur-xs z-[99999] flex flex-col items-center justify-center p-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-10 h-10 rounded-full border-3 border-gray-200 border-t-[#FC7A00]"
              />
              <p className="mt-4 font-hanken font-bold text-xs tracking-wider uppercase text-gray-800">
                Verifying Credentials...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Account Already Exists Full Screen Premium Warning Overlay */}
        <AnimatePresence>
          {accountExistsError && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="fixed inset-0 bg-white z-[99999] flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto text-black"
            >
              <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
                {/* Brand Logo */}
                <div className="relative w-16 h-14 mb-2">
                  <Image
                    src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                    alt="E-Tech Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>

                {/* Warning Icon */}
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-[#FC7A00] border border-amber-200 shadow-sm animate-bounce">
                  <span className="material-symbols-outlined text-[36px] font-bold">warning</span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-hanken font-extrabold text-lg tracking-tight text-black uppercase">Account Already Exists</h3>
                  <p className="text-gray-500 font-hanken text-[10px] font-bold uppercase tracking-wider">Stage-by-Stage Security Validation</p>
                </div>

                <div className="w-full bg-gray-50 border border-gray-150 p-5 rounded-[24px] text-left">
                  <p className="font-hanken text-xs text-gray-700 leading-relaxed font-semibold">
                    {accountExistsError}
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountExistsError(null);
                      router.push("/auth/login");
                    }}
                    className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-sm text-center"
                  >
                    Login to your Account
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountExistsError(null);
                      router.push("/auth/login?forgot=true");
                    }}
                    className="w-full py-4 bg-[#FC7A00] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-sm text-center"
                  >
                    Reset Password or PIN
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountExistsError(null)}
                    className="w-full py-4 bg-white hover:bg-gray-50 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer border border-black/15 shadow-xs text-center"
                  >
                    Use Different Details
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#FC7A00] font-bold underline">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
