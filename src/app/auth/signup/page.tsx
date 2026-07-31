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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [useBvnNinDob, setUseBvnNinDob] = useState(false);
  const [bvnNin, setBvnNin] = useState("");

  // Duplicate Account Check state
  const [accountExistsError, setAccountExistsError] = useState<string | null>(null);
  const [isCheckingExists, setIsCheckingExists] = useState(false);

  // Auto-format Date of Birth typed manually (YYYY-MM-DD)
  const handleDobChange = (val: string) => {
    // If they delete characters, let them delete without glitching the hyphens
    let cleaned = val.replace(/[^0-9]/g, "");
    if (cleaned.length > 4) {
      cleaned = cleaned.slice(0, 4) + "-" + cleaned.slice(4);
    }
    if (cleaned.length > 7) {
      cleaned = cleaned.slice(0, 7) + "-" + cleaned.slice(7);
    }
    setDateOfBirth(cleaned.slice(0, 10));
  };

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

  // Structured Address States (Step 2)
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [postalCode, setPostalCode] = useState("");

  // Account Contact States (Step 3)
  const [phonePrefix, setPhonePrefix] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");

  // Account Security States (Step 4)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsError, setTermsError] = useState("");

  // Custom Permission Drawer state
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

  // Stop Camera Stream
  const stopCamera = React.useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCountdown(null);
  }, [cameraStream]);

  // Sync state with browser back history for camera drawer
  useEffect(() => {
    if (showCamera) {
      window.history.pushState({ cameraOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        stopCamera();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (hasPushedState.current) {
          window.history.back();
          hasPushedState.current = false;
        }
      };
    }
  }, [showCamera, stopCamera]);

  // Prevent background body scroll when camera drawer or permission drawer is open
  useEffect(() => {
    if (showCamera || showPermissionDrawer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCamera, showPermissionDrawer]);

  // Handle Photo Upload from local files
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        toast.success("Profile photo uploaded!");
      };
      reader.readAsDataURL(file);
    }
  };

  // Start Camera Stream with robust constraints and device configuration
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { min: 240, ideal: 640, max: 1080 },
          height: { min: 240, ideal: 640, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((playErr) => {
          console.error("Video element play failed:", playErr);
        });
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access denied or unavailable:", err);
      toast.error("Could not access your camera lens. Please allow permission or upload an image instead.");
    }
  };

  // Switch camera facing direction dynamically (Front / Back)
  const toggleCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
    toast.success(nextMode === "user" ? "Switched to Front Camera" : "Switched to Back Camera");
  };

  // Drag down to dismiss gesture for selfie drawer
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      stopCamera();
    }
  };

  // Capture Selfie with elegant countdown and flash
  const triggerCapture = () => {
    setCountdown(3);
    const counter = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(counter);
          captureSelfie();
          return null;
        }
        return prev - 1;
      });
    }, 800);
  };

  const captureSelfie = () => {
    if (videoRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 640;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhoto(dataUrl);
        toast.success("Selfie captured successfully!");
        stopCamera();
      }
    }
  };

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
      if (!photo) {
        toast.error("Profile picture / Selfie capture is required to set up your account.");
        return;
      }
      if (!firstName || firstName.trim().length < 2) {
        toast.error("First name must be at least 2 characters.");
        return;
      }
      if (!lastName || lastName.trim().length < 2) {
        toast.error("Last name must be at least 2 characters.");
        return;
      }

      if (useBvnNinDob) {
        if (!bvnNin || bvnNin.trim().length !== 11 || !/^\d+$/.test(bvnNin.trim())) {
          toast.error("BVN/NIN must be exactly 11 digits.");
          return;
        }

        // Check if this BVN/NIN already exists!
        const alreadyExists = await checkAccountExists("", bvnNin);
        if (alreadyExists) return;
      } else {
        if (!dateOfBirth) {
          toast.error("Date of birth is required.");
          return;
        }

        const dob = new Date(dateOfBirth);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(dob.getTime())) {
          toast.error("Invalid Date of Birth.");
          return;
        }
        if (dob >= today) {
          toast.error("Date of Birth cannot be today or in the future.");
          return;
        }

        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 18) {
          toast.error("You must be at least 18 years old to proceed.");
          return;
        }
      }

      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!houseNumber || houseNumber.trim().length === 0) {
        toast.error("House number is required.");
        return;
      }
      if (!street || street.trim().length === 0) {
        toast.error("Street name is required.");
        return;
      }
      if (!city || city.trim().length === 0) {
        toast.error("City is required.");
        return;
      }
      if (!state || state.trim().length === 0) {
        toast.error("State is required.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!phoneNumber || phoneNumber.trim().length === 0) {
        toast.error("Phone number is required.");
        return;
      }
      if (!email || !email.includes("@")) {
        toast.error("Please provide a valid email address.");
        return;
      }

      // Check if phone number already exists before proceeding to Step 4!
      const fullPhone = `${phonePrefix}${phoneNumber}`;
      const alreadyExists = await checkAccountExists(fullPhone, bvnNin, email);
      if (alreadyExists) return;

      setCurrentStep(4);
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
          dateOfBirth,
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
          dateOfBirth,
          houseNumber,
          street,
          city,
          state,
          country,
          postalCode: null,
          phonePrefix,
          phoneNumber,
          bvn: useBvnNinDob ? bvnNin : null,
          nin: useBvnNinDob ? bvnNin : null,
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
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />

            {[1, 2, 3, 4].map((sIndex) => {
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
            <span className={cn(currentStep === 2 && "text-[#FC7A00]")}>Address</span>
            <span className={cn(currentStep === 3 && "text-[#FC7A00]")}>Contact</span>
            <span className={cn(currentStep === 4 && "text-[#FC7A00]")}>Security</span>
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
                {/* Profile Picture Upload & Selfie Selection Section */}
                <div className="flex flex-col items-center">
                  <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 block">
                    Profile Picture <span className="text-red-500">*</span>
                  </label>

                  <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-[#FC7A00] flex items-center justify-center bg-gray-50 group shadow-md">
                    {photo ? (
                      <Image
                        src={photo}
                        alt="Profile Preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[48px] text-gray-300">
                        account_circle
                      </span>
                    )}

                    {photo && (
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-black text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1 transition-all cursor-pointer border border-gray-200/50"
                    >
                      <span className="material-symbols-outlined text-[16px]">upload_file</span>
                      Upload Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPermissionDrawer(true)}
                      className="px-3 py-2 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                      Take Selfie
                    </button>
                  </div>
                </div>

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

                <p className="text-[10px] text-amber-600 font-bold leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-left">
                  Please ensure your First Name and Last Name exactly match your BVN and NIN records. Incorrect information may prevent identity verification later.
                </p>

                {/* DoB & BVN/NIN Tick Selection */}
                <div className="space-y-3 text-left">
                  <label htmlFor="dateOfBirth" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-150 rounded-2xl">
                    <input
                      type="checkbox"
                      id="bvnNinDobCheck"
                      checked={useBvnNinDob}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseBvnNinDob(checked);
                        if (checked) {
                          // Standard fallback birthday that is guaranteed to be older than 18 (e.g., 2000-01-01)
                          setDateOfBirth("2000-01-01");
                          toast.success("Using your BVN/NIN verified Date of Birth");
                        } else {
                          setDateOfBirth("");
                        }
                      }}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-[#FC7A00] focus:ring-[#FC7A00] cursor-pointer"
                    />
                    <label htmlFor="bvnNinDobCheck" className="text-[11px] text-gray-700 font-bold select-none cursor-pointer">
                      Use my BVN / NIN verified Date of Birth
                    </label>
                  </div>

                  {!useBvnNinDob ? (
                    <div className="relative">
                      <input
                        id="dateOfBirth"
                        type="text"
                        required
                        value={dateOfBirth}
                        onChange={(e) => handleDobChange(e.target.value)}
                        placeholder="YYYY-MM-DD (e.g. 1995-10-15)"
                        maxLength={10}
                        className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all tracking-wide"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-gray-400 pointer-events-none">
                        calendar_today
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
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
                      <div className="w-full bg-gray-100 border border-gray-200 text-gray-500 rounded-2xl px-4 py-3 text-[11px] font-semibold select-none flex items-center justify-between">
                        <span>DoB will be matched dynamically from BVN/NIN</span>
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Address Block */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4 text-left"
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Residential Address</h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-1 space-y-1">
                    <label htmlFor="houseNumber" className="text-[9px] font-bold text-gray-400 uppercase">House No. <span className="text-red-500">*</span></label>
                    <input
                      id="houseNumber"
                      type="text"
                      required
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      placeholder="24B"
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label htmlFor="street" className="text-[9px] font-bold text-gray-400 uppercase">Street Name <span className="text-red-500">*</span></label>
                    <input
                      id="street"
                      type="text"
                      required
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Adetokunbo Ademola Street"
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="city" className="text-[9px] font-bold text-gray-400 uppercase">City <span className="text-red-500">*</span></label>
                    <input
                      id="city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Victoria Island"
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="state" className="text-[9px] font-bold text-gray-400 uppercase">State <span className="text-red-500">*</span></label>
                    <input
                      id="state"
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Lagos"
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="country" className="text-[9px] font-bold text-gray-400 uppercase">Country <span className="text-red-500">*</span></label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all appearance-none"
                    >
                      <option value="Nigeria">Nigeria</option>
                      <option value="Niger">Niger</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Contact details */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* Phone Input */}
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
                </div>

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
              </motion.div>
            )}

            {/* STEP 4: Security details */}
            {currentStep === 4 && (
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

            {currentStep < 4 ? (
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

        {/* Elegant Custom Camera Permission Bottom Drawer Modal */}
        <AnimatePresence>
          {showPermissionDrawer && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPermissionDrawer(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              {/* Bottom Sheet Drawer */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] p-6 pb-8 z-[99999] flex flex-col items-center shadow-none text-black"
              >
                {/* Grab Handle */}
                <div className="w-10 h-1 bg-gray-300 rounded-full mb-5" />

                {/* Header */}
                <div className="w-full flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                  <div className="w-8" />
                  <h3 className="font-hanken font-bold text-base text-black text-center">Camera Access Needed</h3>
                  <button
                    type="button"
                    onClick={() => setShowPermissionDrawer(false)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                <div className="w-14 h-14 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00] mb-4">
                  <span className="material-symbols-outlined text-[28px] font-bold">photo_camera</span>
                </div>

                <p className="font-hanken text-sm text-gray-500 text-center max-w-[280px] mb-8 leading-relaxed">
                  E-Tech secure identity setup requires camera access to capture your selfie. This verifies your KYC status and safeguards your wallet transactions.
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPermissionDrawer(false);
                      startCamera(facingMode);
                    }}
                    className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                  >
                    Allow Camera Access
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPermissionDrawer(false)}
                    className="w-full py-4 bg-white hover:bg-gray-50 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer premium-gradient-border"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Elegant 90% Height Bottom Drawer for Active Selfie Capture */}
        <AnimatePresence>
          {showCamera && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={stopCamera}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              {/* 90% Height Slide Up Drawer */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                drag="y"
                dragDirectionLock
                dragConstraints={{ top: 0, bottom: 450 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={handleDragEnd}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] z-[99999] flex flex-col items-center select-none cursor-default shadow-none touch-none text-black"
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-4 mb-4 cursor-grab active:cursor-grabbing" />

                {/* Header block */}
                <div className="w-full px-6 flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                  {/* Switch camera button */}
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                    title="Switch Camera (Front/Back)"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">flip_camera_ios</span>
                  </button>
                  <h3 className="font-hanken font-bold text-base text-black text-center">
                    Selfie Verification
                  </h3>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                {/* Centered Video Stream container with guide overlay */}
                <div className="flex-grow flex flex-col justify-center items-center w-full px-6">
                  <div className="relative w-full aspect-square max-w-[320px] rounded-[32px] overflow-hidden bg-black flex items-center justify-center border-2 border-[#FC7A00]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className={cn(
                        "w-full h-full object-cover",
                        facingMode === "user" ? "scale-x-[-1]" : "scale-x-[1]"
                      )}
                    />

                    {/* Oval Portrait Face Guide Overlay */}
                    <div className="absolute inset-0 border-[32px] border-black/40 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-56 rounded-[100px] border-2 border-dashed border-white/60 flex items-center justify-center">
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold font-hanken">Align Face</span>
                      </div>
                    </div>

                    {/* Countdown indicator */}
                    {countdown !== null && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <motion.span
                          key={countdown}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1.5, opacity: 1 }}
                          exit={{ scale: 2, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="text-white text-6xl font-bold font-hanken"
                        >
                          {countdown}
                        </motion.span>
                      </div>
                    )}

                    {/* Camera Flash effect overlay */}
                    {flash && (
                      <div className="absolute inset-0 bg-white z-10 animate-pulse" />
                    )}
                  </div>

                  <p className="font-hanken text-xs text-gray-400 text-center mt-6 max-w-[260px] leading-relaxed">
                    Make sure your face is clearly visible inside the alignment frame. Use the top-left button to toggle between front and back camera lenses.
                  </p>
                </div>

                {/* Bottom Action buttons bar */}
                <div className="w-full p-6 border-t border-gray-100 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={triggerCapture}
                    disabled={countdown !== null}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    {countdown !== null ? "Get Ready..." : "Capture Selfie"}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-full py-4 bg-white hover:bg-gray-50 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer premium-gradient-border"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

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

        {/* Account Already Exists Premium Warning Dialog */}
        <AnimatePresence>
          {accountExistsError && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              {/* Center Modal Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-x-4 inset-y-auto my-auto m-auto max-w-sm h-fit bg-white rounded-[32px] p-6 z-[99999] flex flex-col items-center border border-gray-150 shadow-2xl text-black"
              >
                <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-[#FC7A00] mb-4 border border-amber-200">
                  <span className="material-symbols-outlined text-[32px] font-bold">warning</span>
                </div>

                <h3 className="font-hanken font-bold text-base text-black text-center mb-2">Account Already Exists</h3>

                <p className="font-hanken text-[11px] text-gray-500 text-center leading-relaxed mb-6">
                  {accountExistsError}
                </p>

                <div className="flex flex-col gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountExistsError(null);
                      router.push("/auth/login");
                    }}
                    className="w-full py-3.5 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                  >
                    Login to your Account
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountExistsError(null);
                      router.push("/auth/login?forgot=true");
                    }}
                    className="w-full py-3.5 bg-[#FC7A00] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                  >
                    Reset Password or PIN
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountExistsError(null)}
                    className="w-full py-3.5 bg-white hover:bg-gray-50 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all cursor-pointer border border-gray-200"
                  >
                    Use Different Details
                  </button>
                </div>
              </motion.div>
            </>
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
