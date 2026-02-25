"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, User, ChevronDown } from "lucide-react";
import { Button } from "../ui";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useSocial } from "@/contexts/SocialContext";

const Header: React.FC = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { currentWallet } = useSocial();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-black text-white shadow-md fixed top-0 left-0 right-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center h-16">
        <Link
          href="/"
          className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors"
        >
          NovaFund
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link
            href="/explore"
            className={`text-sm font-medium transition-colors ${
              isActive("/explore")
                ? "text-purple-400"
                : "text-gray-300 hover:text-white"
            }`}
          >
            Explore
          </Link>
          <Link
            href="/create"
            className={`text-sm font-medium transition-colors ${
              isActive("/create")
                ? "text-purple-400"
                : "text-gray-300 hover:text-white"
            }`}
          >
            Create
          </Link>
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors ${
              isActive("/dashboard")
                ? "text-purple-400"
                : "text-gray-300 hover:text-white"
            }`}
          >
            Dashboard
          </Link>
          <NotificationCenter />
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/10"
            >
              <User className="h-4 w-4" />
              <span className="font-mono text-xs">
                {currentWallet.slice(0, 10)}...
              </span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  isUserMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
                <Link
                  href={`/profile/${encodeURIComponent(currentWallet)}`}
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex w-full px-4 py-3 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                >
                  My Profile
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex w-full px-4 py-3 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Dashboard
                </Link>
              </div>
            )}
          </div>
          <Button variant="primary" size="md">
            Connect Wallet
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-black border-t border-gray-800">
          <div className="px-4 py-4 space-y-4">
            <Link
              href="/explore"
              className={`block text-base font-medium transition-colors ${
                isActive("/explore")
                  ? "text-purple-400"
                  : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Explore
            </Link>
            <Link
              href="/create"
              className={`block text-base font-medium transition-colors ${
                isActive("/create")
                  ? "text-purple-400"
                  : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Create
            </Link>
            <Link
              href="/dashboard"
              className={`block text-base font-medium transition-colors ${
                isActive("/dashboard")
                  ? "text-purple-400"
                  : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <div className="flex justify-center">
              <NotificationCenter />
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
