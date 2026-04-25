"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User, ChevronDown } from "lucide-react";
import { Button } from "../ui";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { MobileDrawer } from "./MobileDrawer";
import { useSocial } from "@/contexts/SocialContext";

const NAV_LINKS = [
  { href: "/explore",   label: "Explore" },
  { href: "/bridge",    label: "Bridge" },
  { href: "/create",    label: "Create" },
  { href: "/dashboard", label: "Dashboard" },
];

const Header: React.FC = () => {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { currentWallet } = useSocial();

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="bg-background text-foreground shadow-md fixed top-0 left-0 right-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center h-16">
          <Link
            href="/"
            className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors"
          >
            NovaFund
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  pathname === href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}

            <NotificationCenter />

            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/10"
              >
                <User className="h-4 w-4" />
                <span className="font-mono text-xs">
                  {currentWallet.slice(0, 10)}...
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
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

          {/* Mobile: hamburger only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
          >
            <Menu size={24} />
          </button>
        </nav>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default Header;
