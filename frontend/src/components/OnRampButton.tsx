"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";

export default function OnRampButton() {
  return (
    <Link
      href="/onramp"
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all duration-200"
    >
      <DollarSign className="w-4 h-4" />
      <span>Add Funds</span>
    </Link>
  );
}
