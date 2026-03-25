"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Clock, Loader2, Mail, ShieldCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { recoverWithMagicLink } from "@/lib/stellar";

type RecoveryState = "validating" | "ready" | "loading" | "success" | "expired" | "error";

interface RecoveryParams {
  token: string;
  email: string;
  expiresAt: number;
}

/**
 * Recovery component that handles the magic link logic
 */
function RecoveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<RecoveryState>("validating");
  const [params, setParams] = useState<RecoveryParams | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * Validates email format using simple regex
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Masks email for display: first 2 chars + *** + domain
   */
  const maskEmail = (email: string): string => {
    const [localPart, domain] = email.split("@");
    const visibleChars = localPart.slice(0, 2);
    return `${visibleChars}***@${domain}`;
  };

  /**
   * Formats timestamp for human-readable display
   */
  const formatExpiryTime = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  /**
   * Validates deep link parameters on component mount
   */
  useEffect(() => {
    const validateParams = () => {
      try {
        const token = searchParams.get("token");
        const email = searchParams.get("email");
        const expiresAt = searchParams.get("expires_at");

        // Validate required parameters
        if (!token || !email || !expiresAt) {
          setState("error");
          setErrorMessage("Invalid recovery link. Missing required parameters.");
          return;
        }

        // Validate email format
        if (!isValidEmail(email)) {
          setState("error");
          setErrorMessage("Invalid email address in recovery link.");
          return;
        }

        // Validate expiration
        const expiryTime = parseInt(expiresAt, 10);
        if (isNaN(expiryTime) || expiryTime <= Date.now() / 1000) {
          setState("expired");
          setParams({ token, email, expiresAt: expiryTime });
          return;
        }

        // All validations passed
        setParams({ token, email, expiresAt: expiryTime });
        setState("ready");
      } catch (error) {
        setState("error");
        setErrorMessage("Failed to parse recovery link parameters.");
      }
    };

    validateParams();
  }, [searchParams]);

  /**
   * Handles countdown timer for success state redirect
   */
  useEffect(() => {
    if (state === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (state === "success" && countdown === 0) {
      router.replace("/dashboard");
    }
  }, [state, countdown, router]);

  /**
   * Processes the recovery using SEP-30 magic link
   */
  const handleRecovery = async () => {
    if (!params) return;

    setState("loading");

    try {
      const result = await recoverWithMagicLink(params.token, params.email);
      
      if (result.success) {
        setState("success");
        
        // Clear sensitive parameters from URL immediately
        router.replace("/recovery");
      } else {
        setErrorMessage(result.error || "Recovery failed. Please try again.");
        setState("error");
      }
    } catch (error) {
      setErrorMessage("Recovery failed. Please try again.");
      setState("error");
    }
  };

  /**
   * Renders appropriate UI based on current state
   */
  const renderContent = () => {
    switch (state) {
      case "validating":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Validating Recovery Link
            </h2>
            <p className="text-gray-400 text-center max-w-md">
              Please wait while we verify your recovery link...
            </p>
          </motion.div>
        );

      case "ready":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              Recover Your Account
            </h2>
            
            <p className="text-gray-300 mb-6">
              We found a recovery request for{" "}
              <span className="font-semibold text-white">
                {params && maskEmail(params.email)}
              </span>
            </p>
            
            <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-gray-300">
                    This recovery link is valid and secure. Click below to restore access to your NovaFund wallet.
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleRecovery}
              size="lg"
              className="w-full"
            >
              Recover Access
            </Button>
          </motion.div>
        );

      case "loading":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Recovering Your Account
            </h2>
            <p className="text-gray-400 text-center max-w-md">
              Please wait while we restore access to your wallet...
            </p>
          </motion.div>
        );

      case "success":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              Recovery Successful!
            </h2>
            
            <p className="text-gray-300 mb-6">
              Your wallet access has been restored. You'll be redirected to your dashboard in{" "}
              <span className="font-semibold text-purple-400">{countdown}</span> seconds.
            </p>
            
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                <span className="text-sm text-gray-400">Redirecting to dashboard...</span>
              </div>
            </div>
          </motion.div>
        );

      case "expired":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              Recovery Link Expired
            </h2>
            
            <p className="text-gray-300 mb-2">
              This recovery link expired on{" "}
              <span className="font-semibold text-white">
                {params && formatExpiryTime(params.expiresAt)}
              </span>
            </p>
            
            <p className="text-gray-400 mb-6">
              For security reasons, recovery links are only valid for a limited time.
            </p>
            
            <Button
              onClick={() => router.push("/forgot-password")}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Request New Link
            </Button>
          </motion.div>
        );

      case "error":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              Recovery Failed
            </h2>
            
            <p className="text-gray-300 mb-6">
              {errorMessage || "An error occurred while processing your recovery request."}
            </p>
            
            <Button
              onClick={() => router.push("/forgot-password")}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Request New Link
            </Button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return renderContent();
}

/**
 * Magic Link Email Recovery Page
 * 
 * Handles SEP-30 account recovery via email magic links.
 * Validates deep link parameters, processes recovery, and provides
 * appropriate UI states for the recovery flow.
 */
export default function RecoveryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-8">
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Loading Recovery Page
              </h2>
            </div>
          </div>
        </div>
      </div>
    }>
      <RecoveryContent />
    </Suspense>
  );
}
