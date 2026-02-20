"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "../ui";

const Header: React.FC = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-black text-white shadow-md fixed top-0 left-0 right-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center h-16">
        <Link href="/" className="text-2xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
          NovaFund
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
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
              className={`block text-base font-medium transition-colors ${isActive('/explore') ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Explore
            </Link>
            <Link 
              href="/create" 
              className={`block text-base font-medium transition-colors ${isActive('/create') ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Create
            </Link>
            <Link 
              href="/dashboard" 
              className={`block text-base font-medium transition-colors ${isActive('/dashboard') ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Button variant="primary" size="md" className="w-full justify-center">
              Connect Wallet
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
