"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { requestRecoveryLink } from "@/lib/stellar";

type ForgotPasswordState = "form" | "loading" | "success";

/**
 * Forgot Password Page
 * 
 * Allows users to request a new recovery link for their SEP-30 email recovery.
 * This is the entry point for the recovery flow.
 */
export default function ForgotPasswordPage() {
  const [state, setState] = useState<ForgotPasswordState>("form");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Validates email format
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Handles form submission to request recovery link
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setState("loading");
    setIsLoading(true);

    try {
      const result = await requestRecoveryLink(email);
      
      if (result.success) {
        setState("success");
      } else {
        setError(result.error || "Failed to send recovery link. Please try again.");
        setState("form");
      }
    } catch (error) {
      setError("Failed to send recovery link. Please try again.");
      setState("form");
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case "form":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-purple-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                Recover Your Account
              </h2>
              
              <p className="text-gray-400">
                Enter your email address and we'll send you a recovery link
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isLoading}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                Send Recovery Link
              </Button>
            </form>

            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </div>
          </motion.div>
        );

      case "loading":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[300px]"
          >
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Sending Recovery Link
            </h2>
            <p className="text-gray-400 text-center max-w-md">
              Please wait while we send a recovery link to your email...
            </p>
          </motion.div>
        );

      case "success":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Recovery Link Sent
              </h2>
              
              <p className="text-gray-400 mb-4">
                We've sent a recovery link to{" "}
                <span className="font-semibold text-white">{email}</span>
              </p>
              
              <p className="text-gray-500 text-sm">
                Check your inbox and click the link to recover your account.
                The link will expire in 24 hours for security reasons.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => window.location.href = "https://gmail.com"}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                Open Email App
              </Button>
              
              <Link href="/" className="block">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Back to Home
                </Button>
              </Link>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-8">
          {renderContent()}
        </div>
        
        {/* Security footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Secure recovery powered by SEP-30 • NovaFund
          </p>
        </div>
      </motion.div>
    </div>
  );
}
