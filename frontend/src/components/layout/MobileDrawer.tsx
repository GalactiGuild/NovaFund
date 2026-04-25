"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  Compass,
  ArrowLeftRight,
  PlusCircle,
  LayoutDashboard,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "../ui";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useSocial } from "@/contexts/SocialContext";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: "/explore",   label: "Explore",   icon: Compass },
  { href: "/bridge",    label: "Bridge",    icon: ArrowLeftRight },
  { href: "/create",    label: "Create",    icon: PlusCircle },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ open, onClose }) => {
  const pathname = usePathname();
  const { currentWallet } = useSocial();

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-zinc-950 border-r border-white/10 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-xl font-bold text-purple-400">NovaFund</span>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Wallet pill */}
        <div className="px-5 py-3 border-b border-white/10">
          <Link
            href={`/profile/${encodeURIComponent(currentWallet)}`}
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <User size={15} />
            <span className="font-mono text-xs truncate">{currentWallet}</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-purple-500/15 text-purple-400"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} className={active ? "text-purple-400" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase tracking-wider">Notifications</span>
            <NotificationCenter />
          </div>
          <Button variant="primary" size="md" className="w-full justify-center gap-2">
            <Wallet size={16} />
            Connect Wallet
          </Button>
        </div>
      </aside>
    </>
  );
};
