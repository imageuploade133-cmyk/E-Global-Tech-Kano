"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface CpanelActionItem {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: "default" | "danger" | "warning" | "emerald";
  disabled?: boolean;
}

interface CpanelActionDropdownProps {
  actions: CpanelActionItem[];
  align?: "left" | "right";
  isDark?: boolean;
}

export const CpanelActionDropdown: React.FC<CpanelActionDropdownProps> = ({
  actions,
  align = "right",
  isDark = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const validActions = actions.filter((act) => !act.disabled);
  if (validActions.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer select-none",
          isDark
            ? "bg-gray-800 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 hover:border-gray-600"
            : "bg-gray-100 border-gray-200 text-gray-600 hover:text-black hover:bg-gray-200"
        )}
        title="Actions Menu"
      >
        <span className="material-symbols-outlined text-[20px] font-bold">more_vert</span>
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-1.5 w-48 rounded-2xl border shadow-xl z-[1000] overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0" : "left-0",
            isDark
              ? "bg-[#111827] border-gray-800 text-white shadow-black/60"
              : "bg-white border-gray-200 text-gray-900 shadow-gray-200/80"
          )}
        >
          {validActions.map((action, idx) => {
            const isDanger = action.variant === "danger";
            const isWarning = action.variant === "warning";
            const isEmerald = action.variant === "emerald";

            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  action.onClick();
                }}
                className={cn(
                  "w-full px-3.5 py-2.5 text-xs font-bold font-hanken flex items-center gap-2.5 transition-colors cursor-pointer text-left select-none",
                  isDark
                    ? isDanger
                      ? "text-rose-400 hover:bg-rose-500/10"
                      : isWarning
                      ? "text-amber-400 hover:bg-amber-500/10"
                      : isEmerald
                      ? "text-emerald-400 hover:bg-emerald-500/10"
                      : "text-gray-200 hover:bg-gray-800 hover:text-white"
                    : isDanger
                    ? "text-rose-600 hover:bg-rose-50"
                    : isWarning
                    ? "text-amber-700 hover:bg-amber-50"
                    : isEmerald
                    ? "text-emerald-700 hover:bg-emerald-50"
                    : "text-gray-700 hover:bg-orange-50/80 hover:text-[#FC7A00]"
                )}
              >
                {action.icon && (
                  <span className="material-symbols-outlined text-[17px] shrink-0">
                    {action.icon}
                  </span>
                )}
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
