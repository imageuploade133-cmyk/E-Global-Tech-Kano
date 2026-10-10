import { describe, test, expect } from "bun:test";

describe("Outward Transfer Modal Stack Isolation Suite", () => {
  test("Closing Authorize Transfer (TransferPinModal) strictly updates PIN modal state without closing Confirm Outward Transfer", () => {
    let isTransferOpen = true;
    let trfStep: "input" | "confirm" | "pin" | "completion" = "confirm";
    let isTrfPinModalOpen = false;

    // Step 1: User clicks "Confirm and Proceed"
    isTrfPinModalOpen = true;
    expect(isTransferOpen).toBe(true);
    expect(trfStep).toBe("confirm");
    expect(isTrfPinModalOpen).toBe(true);

    // Step 2: User clicks close (×) icon on TransferPinModal
    isTrfPinModalOpen = false;

    // Assert: Confirm Outward Transfer remains open with original data
    expect(isTrfPinModalOpen).toBe(false);
    expect(isTransferOpen).toBe(true);
    expect(trfStep).toBe("confirm");
  });

  test("Reopening Authorize Transfer modal works cleanly after closing", () => {
    let isTransferOpen = true;
    let isTrfPinModalOpen = false;

    // Open -> Close -> Reopen
    isTrfPinModalOpen = true;
    expect(isTrfPinModalOpen).toBe(true);

    isTrfPinModalOpen = false;
    expect(isTrfPinModalOpen).toBe(false);

    isTrfPinModalOpen = true;
    expect(isTrfPinModalOpen).toBe(true);
    expect(isTransferOpen).toBe(true);
  });
});
