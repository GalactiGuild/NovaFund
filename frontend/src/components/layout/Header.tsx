"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui";

const Header: React.FC = () => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="bg-black text-white shadow-md fixed top-0 left-0 right-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center h-16">
        <Link href="/" className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
          NovaFund
        </Link>
        
        <div className="flex items-center space-x-6">
          <Link 
            href="/explore" 
            className={`text-sm font-medium transition-colors ${isActive('/explore') ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
          >
            Explore
          </Link>
          <Link 
            href="/create" 
            className={`text-sm font-medium transition-colors ${isActive('/create') ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
          >
            Create
          </Link>
          <Link 
            href="/dashboard" 
            className={`text-sm font-medium transition-colors ${isActive('/dashboard') ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
          >
            Dashboard
          </Link>
          <Button variant="primary" size="md">
            Connect Wallet
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Header;
