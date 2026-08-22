"use client";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";



import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppConfig } from "@/lib/ConfigContext";
import { uploadImageSecurely } from "@/lib/image-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function CpanelSettingsPage() {
  const { config, updateConfig } = useAppConfig();
  const router = useRouter();

  const { isDark, toggleTheme } = useCpanelTheme();
  const [logoInput, setLogoInput] = useState(config.logoUrl);
  const [phone1Input, setPhone1Input] = useState(config.supportPhone1);
  const [phone2Input, setPhone2Input] = useState(config.supportPhone2);
  const [emailInput, setEmailInput] = useState(config.supportEmail);
  const [apiKeyInput, setApiKeyInput] = useState(config.imgbbApiKey || "");
  const [uploadSizeInput, setUploadSizeInput] = useState(config.maxKycUploadSizeMb || 10);

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);





  useEffect(() => {
    setLogoInput(config.logoUrl);
    setPhone1Input(config.supportPhone1);
    setPhone2Input(config.supportPhone2);
    setEmailInput(config.supportEmail);
    setApiKeyInput(config.imgbbApiKey || "");
    setUploadSizeInput(config.maxKycUploadSizeMb || 10);
  }, [config]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBranding(true);
    try {
      await updateConfig({
        logoUrl: logoInput,
        supportPhone1: phone1Input,
        supportPhone2: phone2Input,
        supportEmail: emailInput,
        imgbbApiKey: apiKeyInput,
        maxKycUploadSizeMb: uploadSizeInput,
      });
      toast.success("Branding, Support and API configurations applied!");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to commit settings updates to Firebase Firestore.");
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    toast.loading("Uploading app logo securely...");

    try {
      const result = await uploadImageSecurely(file, "app_logo");
      toast.dismiss();

      if (result.success && result.url) {
        const uploadedUrl = result.url;
        setLogoInput(uploadedUrl);
        updateConfig({ logoUrl: uploadedUrl });
        toast.success("App logo successfully uploaded and updated!");
      } else {
        toast.error(result.error || "Failed to upload logo image!");
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "App logo upload failed.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";
  const inputClass = isDark
    ? "bg-[#111827] border border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full"
    : "bg-[#F9FAFB] border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full";

  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300", bgClass)}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[22px]">diamond</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Branding & Support Settings</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Configure platform brand logo, ImgBB API key, document limits, and customer support contacts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={cn("px-3 h-10 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer", isDark ? "bg-gray-900 border-gray-800 text-yellow-400" : "bg-gray-100 border-gray-200 text-gray-700")}
            >
              <span className="material-symbols-outlined text-[18px]">{isDark ? "light_mode" : "dark_mode"}</span>
              <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <Link
              href="/cpanel"
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Control Panel</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={cn("rounded-2xl p-6 md:col-span-2 border transition-colors duration-300", panelClass)}>
            <h3 className={cn("font-hanken font-extrabold text-sm border-b pb-3 mb-4 uppercase tracking-wide", isDark ? "border-gray-800 text-white" : "border-gray-100 text-gray-900")}>
              Live Brand Configurations
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className={cn("space-y-1 p-4 rounded-xl border transition-colors duration-300", isDark ? "bg-orange-950/20 border-orange-900/30" : "bg-orange-50/50 border-orange-100")}>
                <label className="text-[10px] font-black uppercase text-[#FC7A00] tracking-wider">Imgbb API Key (Image Upload Rail)</label>
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter Imgbb v1 api key"
                  className={inputClass}
                />
              </div>

              <div className={cn("space-y-1 p-4 rounded-xl border transition-colors duration-300", isDark ? "bg-orange-950/20 border-orange-900/30" : "bg-orange-50/50 border-orange-100")}>
                <label className="text-[10px] font-black uppercase text-[#FC7A00] tracking-wider">Max KYC Document Upload Size (MB)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={uploadSizeInput}
                  onChange={(e) => setUploadSizeInput(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="e.g. 10"
                  className={inputClass}
                />
                <p className="text-[9px] text-gray-400 mt-1">Configure the maximum permitted file size in MB for Identity document image uploads.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Core Brand Logo URL</label>
                  <input
                    type="url"
                    value={logoInput}
                    onChange={(e) => setLogoInput(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Upload Logo Image File</label>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingLogo}
                    onChange={handleLogoUpload}
                    className={cn(inputClass, "cursor-pointer py-1.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-[#FC7A00]/10 file:text-[#FC7A00]")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Toll-Free Support Line</label>
                  <input
                    type="text"
                    value={phone1Input}
                    onChange={(e) => setPhone1Input(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">VIP Chat Hotline</label>
                  <input
                    type="text"
                    value={phone2Input}
                    onChange={(e) => setPhone2Input(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">System Support Email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={isSavingBranding}
                className="px-6 py-3.5 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-98"
              >
                {isSavingBranding ? <><ButtonSpinner /> Saving configurations...</> : "Save Branding Configurations"}
              </button>
            </form>
          </div>

          <div className={cn("border rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden transition-colors duration-300", isDark ? "bg-orange-950/10 border-orange-900/30" : "bg-orange-50 border-orange-100")}>
            <div className="relative z-10">
              <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Live Platform Widget Preview</h4>
              <div className={cn("border p-4 rounded-xl space-y-3 transition-colors duration-300", isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/80 border-gray-150")}>
                <div className="flex justify-between items-center">
                  <div className="w-10 h-10 rounded bg-white flex items-center justify-center p-1.5 border border-gray-100">
                    <img src={logoInput || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="Brand Logo Preview" className="object-contain" />
                  </div>
                  <span className="text-[10px] font-mono font-black text-[#FC7A00] bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">LIVE</span>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-black tracking-wide leading-none">Support contact details</p>
                  <p className={cn("text-xs font-black mt-1.5", isDark ? "text-white" : "text-gray-900")}>{emailInput}</p>
                  <p className="text-[11px] font-mono text-gray-400 mt-1">{phone1Input}</p>
                </div>
              </div>
            </div>
            <div className={cn("pt-4 border-t mt-4 relative z-10", isDark ? "border-gray-800" : "border-gray-100")}>
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed font-hanken">
                All alterations committed inside this settings matrix propagates instantly to the global wallet UI client.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}