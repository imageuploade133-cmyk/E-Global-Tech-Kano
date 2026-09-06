"use client";

import { useEffect, useRef } from "react";

/**
 * Custom React hook for robust Modal & Drawer UX:
 * 1. Locks background body scrolling on all devices (iOS, Android, Desktop) when active.
 * 2. Intercepts hardware / browser Back button (`popstate`) on mobile & desktop to close the modal instead of navigating away.
 *
 * @param isOpen Boolean indicating if the modal/drawer is open.
 * @param onClose Callback to close the modal when Back button is pressed or requested.
 * @param modalId Optional unique identifier for modal history state management.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  modalId: string = "modal-drawer"
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    // 1. Lock Background Body Scrolling (iOS, Android, Desktop)
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = "hidden";

    // 2. Mobile Hardware & Browser Back Button (popstate) Interception
    const stateKey = `modal_open_${modalId}_${Date.now()}`;
    let isPoppedByBackButton = false;

    window.history.pushState({ modalStateKey: stateKey }, "", window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      isPoppedByBackButton = true;
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      // Restore Body Scrolling
      document.body.style.overflow = originalStyle;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;

      window.removeEventListener("popstate", handlePopState);

      // Clean history state if closing programmatically rather than via back button
      if (!isPoppedByBackButton && window.history.state && window.history.state.modalStateKey === stateKey) {
        window.history.back();
      }
    };
  }, [isOpen, modalId]);
}
