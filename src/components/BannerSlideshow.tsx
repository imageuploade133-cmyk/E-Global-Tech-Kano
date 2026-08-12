"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface BannerSlide {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  targetPage: "all" | "bills" | "investment" | "referral";
  link?: string;
}

interface BannerSlideshowProps {
  page: "bills" | "investment" | "referral";
  isDark?: boolean;
}

export default function BannerSlideshow({ page, isDark = false }: BannerSlideshowProps) {
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const res = await fetch(`/api/banners?page=${page}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSlides(data.banners || []);
        }
      } catch (err) {
        console.error("Failed to load banner slideshow slides:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSlides();
  }, [page]);

  // Autoplay loop Setup
  useEffect(() => {
    if (slides.length <= 1) return;

    const startAutoplay = () => {
      autoplayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
      }, 5000); // Transition every 5 seconds
    };

    startAutoplay();

    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [slides]);

  const handleDotClick = (idx: number) => {
    setCurrentIndex(idx);
    // Reset autoplay timer on manual slide shift
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
    }
  };

  const handleSlideClick = (slide: BannerSlide) => {
    if (slide.link) {
      if (slide.link.startsWith("http")) {
        window.open(slide.link, "_blank", "noopener,noreferrer");
      } else {
        router.push(slide.link);
      }
    }
  };

  if (loading || slides.length === 0) {
    return null;
  }

  const activeSlide = slides[currentIndex];

  return (
    <div className="w-full relative mb-6 select-none overflow-hidden rounded-2xl md:rounded-[24px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          onClick={() => handleSlideClick(activeSlide)}
          className={cn(
            "w-full aspect-[3/1] min-h-[120px] max-h-[220px] md:max-h-[300px] bg-gray-900 flex items-center relative overflow-hidden rounded-2xl md:rounded-[24px] cursor-pointer group shadow-xs border transition-colors duration-300",
            isDark ? "border-gray-800" : "border-gray-150"
          )}
        >
          {/* Main Background Image */}
          <img
            src={activeSlide.imageUrl}
            alt={activeSlide.title || "Marketing Campaign"}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[6s] group-hover:scale-105"
          />

          {/* Premium Dark Glassmorphic Vignette Backdrop Mask */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent flex flex-col justify-center p-6 md:p-10 text-left" />

          {/* Slide Caption Texts */}
          <div className="relative z-10 max-w-[70%] space-y-1.5 md:space-y-2 select-text cursor-default">
            {activeSlide.title && (
              <motion.h3
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="font-hanken font-black text-sm min-[360px]:text-base md:text-xl text-white uppercase tracking-tight leading-tight select-none pointer-events-none"
              >
                {activeSlide.title}
              </motion.h3>
            )}
            {activeSlide.description && (
              <motion.p
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="font-hanken text-[10px] min-[360px]:text-xs md:text-sm text-gray-200/90 font-semibold leading-snug select-none pointer-events-none"
              >
                {activeSlide.description}
              </motion.p>
            )}

            {/* Optional Interactive CTA Button */}
            {activeSlide.link && (
              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="pt-1 select-none pointer-events-none"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FC7A00] hover:bg-[#e06600] text-white font-black text-[9px] min-[360px]:text-[10px] uppercase rounded-full shadow-lg shadow-orange-500/10 active:scale-95 transition-all">
                  <span>Learn More</span>
                  <span className="material-symbols-outlined text-[11px] font-bold">arrow_forward</span>
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide Indicators Dots (Only if multiple slides exist) */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 p-1.5 bg-black/35 backdrop-blur-xs rounded-full">
          {slides.map((_, idx) => {
            const isSelected = currentIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => handleDotClick(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                  isSelected ? "w-4 bg-[#FC7A00]" : "w-1.5 bg-white/50 hover:bg-white"
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
