"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface StatementCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetField: "fromDate" | "toDate";
  fromDate: string;
  toDate: string;
  onSelectDate: (field: "fromDate" | "toDate", dateStr: string) => void;
  onApplyPresetRange?: (fromStr: string, toStr: string) => void;
}

export const StatementCalendarModal: React.FC<StatementCalendarModalProps> = ({
  isOpen,
  onClose,
  targetField,
  fromDate,
  toDate,
  onSelectDate,
  onApplyPresetRange,
}) => {
  useModalBackHandler(isOpen, onClose, "statement-calendar-drawer");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initialDateStr = targetField === "fromDate" ? fromDate : toDate;
  const initialDate = initialDateStr ? new Date(initialDateStr + "T00:00:00") : today;

  const [calendarMonth, setCalendarMonth] = useState<Date>(
    isNaN(initialDate.getTime()) ? today : new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );

  if (!isOpen) return null;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    daysArray.push(new Date(year, month, day));
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleApplyPreset = (daysAgo: number) => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    start.setHours(0, 0, 0, 0);

    const fromStr = start.toISOString().split("T")[0];
    const toStr = end.toISOString().split("T")[0];

    if (onApplyPresetRange) {
      onApplyPresetRange(fromStr, toStr);
    } else {
      onSelectDate("fromDate", fromStr);
      onSelectDate("toDate", toStr);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100002] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-gray-100 z-10 text-black overflow-hidden max-h-[92vh] flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Modal Title */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00]">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                </div>
                <div>
                  <h3 className="font-bodoni text-[15px] font-bold text-black leading-tight">
                    Select {targetField === "fromDate" ? "Start (From) Date" : "End (To) Date"}
                  </h3>
                  <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">
                    Statement Date Picker
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-gray-150 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer border-0"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Quick Preset Range Chips */}
            <div className="space-y-1.5 mb-4">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Quick Range Presets</span>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 select-none">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(7)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#FC7A00] hover:text-white text-[10px] font-bold uppercase tracking-wider text-gray-700 transition-all flex-shrink-0 cursor-pointer"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(30)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#FC7A00] hover:text-white text-[10px] font-bold uppercase tracking-wider text-gray-700 transition-all flex-shrink-0 cursor-pointer"
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(90)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#FC7A00] hover:text-white text-[10px] font-bold uppercase tracking-wider text-gray-700 transition-all flex-shrink-0 cursor-pointer"
                >
                  Last 3 Months
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(180)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#FC7A00] hover:text-white text-[10px] font-bold uppercase tracking-wider text-gray-700 transition-all flex-shrink-0 cursor-pointer"
                >
                  Max 6 Months
                </button>
              </div>
            </div>

            {/* Month/Year Controller */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="font-hanken text-sm font-extrabold text-black">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                disabled={new Date(year, month + 1, 1) > new Date(today.getFullYear(), today.getMonth() + 1, 1)}
                onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            {/* Weekday Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
                <span key={dayName} className="font-hanken text-[10px] font-extrabold text-gray-400 uppercase tracking-wider py-1">
                  {dayName}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {daysArray.map((dayDate, idx) => {
                if (!dayDate) {
                  return <div key={`empty-${idx}`} className="aspect-square" />;
                }

                const compareDate = new Date(dayDate);
                compareDate.setHours(0, 0, 0, 0);

                const isFuture = compareDate > today;
                const formattedValue = dayDate.toISOString().split("T")[0];

                const isSelectedFrom = fromDate === formattedValue;
                const isSelectedTo = toDate === formattedValue;
                const isSelectedCurrentTarget = (targetField === "fromDate" ? fromDate : toDate) === formattedValue;

                let isInRange = false;
                if (fromDate && toDate) {
                  const fDate = new Date(fromDate + "T00:00:00");
                  const tDate = new Date(toDate + "T00:00:00");
                  isInRange = compareDate >= fDate && compareDate <= tDate;
                }

                return (
                  <button
                    key={formattedValue}
                    type="button"
                    disabled={isFuture}
                    onClick={() => {
                      onSelectDate(targetField, formattedValue);
                      onClose();
                    }}
                    className={`aspect-square rounded-xl font-hanken text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                      isSelectedCurrentTarget
                        ? "bg-[#FC7A00] text-white shadow-md ring-2 ring-[#FC7A00]/30"
                        : isSelectedFrom || isSelectedTo
                        ? "bg-amber-100 text-amber-900 border border-amber-300 font-black"
                        : isInRange
                        ? "bg-orange-50 text-[#FC7A00]"
                        : isFuture
                        ? "text-gray-300 bg-gray-50/50 cursor-not-allowed"
                        : "text-black hover:bg-gray-100 active:scale-95"
                    }`}
                  >
                    <span>{dayDate.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 border border-gray-200 text-gray-700 hover:text-black rounded-xl font-hanken text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            Close Calendar
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
