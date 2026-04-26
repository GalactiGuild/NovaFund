/**
 * hooks/useHardwareWallet.ts
 *
 * Issue: Integrate Ledger hardware-wallet support for Stellar.
 *
 * Responsibilities
 * ────────────────
 * • Detect whether a Ledger device is connected via WebUSB / WebHID.
 * • Open a transport session and derive a Stellar public key.
 * • Sign arbitrary XDR transaction envelopes on the device.
 * • Expose a clean React hook API with loading, error, and fallback states.
 *
 * Acceptance criteria
 * ───────────────────
 * ✅ Users can sign transactions using a physical Ledger device.
 * ✅ Secure fallback (disconnect detection + user-readable error) if the
 *    device is unplugged mid-flow.
 *
 * Runtime dependencies (add to package.json):
 *   @ledgerhq/hw-transport-webusb   — WebUSB transport (Chrome/Edge)
 *   @ledgerhq/hw-app-str            — Stellar Ledger app bindings
 * Both are MIT-licensed and maintained by Ledger.
 *
 * Note: WebUSB requires a secure context (HTTPS or localhost) and a user
 * gesture to trigger the browser permission dialog on first connection.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HardwareWalletStatus =
  | "idle" // hook just mounted, nothing attempted yet
  | "connecting" // transport being opened / app being contacted
  | "connected" // public key obtained, ready to sign
  | "signing" // transaction on device awaiting user confirmation
  | "disconnected" // device was unplugged or app was closed
  | "error"; // unrecoverable error — see `errorMessage`

export interface HardwareWalletState {
  status: HardwareWalletStatus;
  publicKey: string | null;
  errorMessage: string | null;
  /** True while any async operation (connect / sign) is in progress. */
  isLoading: boolean;
}

export interface UseHardwareWalletReturn extends HardwareWalletState {
  /** Open transport, unlock Ledger Stellar app, and fetch the public key. */
  connect: () => Promise<void>;
  /** Sign an XDR-encoded transaction envelope. Returns signed XDR string. */
  signTransaction: (transactionXdr: string) => Promise<string | null>;
  /** Tear down the transport session gracefully. */
  disconnect: () => Promise<void>;
  /** Whether the browser supports WebUSB (required for Ledger). */
  isSupported: boolean;
}

// ---------------------------------------------------------------------------
// Ledger BIP-44 derivation path for Stellar account index 0
// ---------------------------------------------------------------------------
const STELLAR_BIP44_PATH = "44'/148'/0'";

// ---------------------------------------------------------------------------
// Lazy-load Ledger libraries so they are never bundled server-side and only
// pulled into the client bundle when the hook is actually used.
// ---------------------------------------------------------------------------
async function loadLedgerTransport() {
  const { default: TransportWebUSB } = await import(
    // @ts-expect-error — types live in a separate @types package
    "@ledgerhq/hw-transport-webusb"
  );
  return TransportWebUSB;
}

async function loadStellarApp(transport: unknown) {
  const { default: Str } = await import(
    // @ts-expect-error — same as above
    "@ledgerhq/hw-app-str"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Str(transport as any);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHardwareWallet(): UseHardwareWalletReturn {
  const [state, setState] = useState<HardwareWalletState>({
    status: "idle",
    publicKey: null,
    errorMessage: null,
    isLoading: false,
  });

  // Hold transport reference so we can close it on disconnect / unmount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transportRef = useRef<any>(null);

  // Check browser support once on mount (no SSR)
  const isSupported =
    typeof window !== "undefined" &&
    typeof (navigator as Navigator & { usb?: unknown }).usb !== "undefined";

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setError = (message: string) =>
    setState({
      status: "error",
      publicKey: null,
      errorMessage: message,
      isLoading: false,
    });

  const handleTransportError = useCallback((err: unknown) => {
    const message =
      err instanceof Error ? err.message : "Unknown hardware wallet error.";

    const isDisconnect =
      message.toLowerCase().includes("disconnected") ||
      message.toLowerCase().includes("device not found") ||
      message.toLowerCase().includes("access denied");

    if (isDisconnect) {
      setState({
        status: "disconnected",
        publicKey: null,
        errorMessage:
          "Ledger device disconnected. Please reconnect and try again.",
        isLoading: false,
      });
    } else {
      setError(message);
    }
  }, []);

  // ── connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError(
        "WebUSB is not supported in this browser. Please use Chrome or Edge.",
      );
      return;
    }

    setState({
      status: "connecting",
      publicKey: null,
      errorMessage: null,
      isLoading: true,
    });

    try {
      // Close any pre-existing transport to avoid resource conflicts
      if (transportRef.current) {
        await transportRef.current.close().catch(() => {});
        transportRef.current = null;
      }

      const TransportWebUSB = await loadLedgerTransport();
      // `create()` triggers the browser USB permission dialog on first use
      const transport = await TransportWebUSB.create();
      transportRef.current = transport;

      // Listen for device-level disconnect events
      transport.on("disconnect", () => {
        transportRef.current = null;
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          errorMessage:
            "Ledger device was disconnected. Please reconnect and try again.",
          isLoading: false,
        }));
      });

      const stellarApp = await loadStellarApp(transport);
      const { publicKey } = await stellarApp.getPublicKey(
        STELLAR_BIP44_PATH,
        /* validate= */ false,
        /* display= */ false,
      );

      setState({
        status: "connected",
        publicKey,
        errorMessage: null,
        isLoading: false,
      });
    } catch (err) {
      // Clean up a partially-opened transport
      if (transportRef.current) {
        await transportRef.current.close().catch(() => {});
        transportRef.current = null;
      }
      handleTransportError(err);
    }
  }, [isSupported, handleTransportError]);

  // ── signTransaction ────────────────────────────────────────────────────────

  const signTransaction = useCallback(
    async (transactionXdr: string): Promise<string | null> => {
      if (!transportRef.current || state.status !== "connected") {
        setError(
          "Hardware wallet is not connected. Please connect your Ledger first.",
        );
        return null;
      }

      setState((prev) => ({
        ...prev,
        status: "signing",
        errorMessage: null,
        isLoading: true,
      }));

      try {
        const stellarApp = await loadStellarApp(transportRef.current);
        // `signTransaction` returns { signature: Buffer }
        const { signature } = await stellarApp.signTransaction(
          STELLAR_BIP44_PATH,
          Buffer.from(transactionXdr, "base64"),
        );

        // Re-encode the signed XDR back to base64 for the caller
        const signedXdr = Buffer.from(signature).toString("base64");

        setState((prev) => ({
          ...prev,
          status: "connected",
          isLoading: false,
        }));

        return signedXdr;
      } catch (err) {
        handleTransportError(err);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.status],
  );

  // ── disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.close().catch(() => {});
      transportRef.current = null;
    }
    setState({
      status: "idle",
      publicKey: null,
      errorMessage: null,
      isLoading: false,
    });
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      transportRef.current?.close().catch(() => {});
    };
  }, []);

  return {
    ...state,
    isSupported,
    connect,
    signTransaction,
    disconnect,
  };
}
