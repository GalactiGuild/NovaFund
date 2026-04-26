"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { HelpCircle, ExternalLink } from "lucide-react";
import { ReactNode } from "react";

interface TermTooltipProps {
  /** The technical term to display with tooltip */
  term: string;
  /** The explanation/definition of the term */
  definition: string;
  /** Optional documentation URL for "Learn More" link */
  learnMoreUrl?: string;
  /** Optional custom trigger element (defaults to term with help icon) */
  children?: ReactNode;
  /** Position of the tooltip */
  side?: "top" | "right" | "bottom" | "left";
  /** Delay before showing tooltip (in ms) */
  delayDuration?: number;
  /** Additional CSS classes for the trigger */
  className?: string;
}

/**
 * TermTooltip - An accessible tooltip component for explaining technical terms
 * 
 * Uses Radix UI Tooltip for keyboard navigation and screen reader support.
 * Provides clear explanations of blockchain/smart contract terminology with
 * optional "Learn More" links to documentation.
 * 
 * @example
 * <TermTooltip
 *   term="Escrow"
 *   definition="A smart contract that holds funds until specific conditions are met."
 *   learnMoreUrl="https://docs.novafund.io/concepts/escrow"
 * />
 */
export default function TermTooltip({
  term,
  definition,
  learnMoreUrl,
  children,
  side = "top",
  delayDuration = 200,
  className = "",
}: TermTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={delayDuration}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children || (
            <span
              className={`inline-flex items-center gap-1 font-medium text-white/90 border-b border-dotted border-white/40 cursor-help hover:text-white hover:border-white/60 transition-colors ${className}`}
              tabIndex={0}
              aria-label={`${term} - Help (press to learn more)`}
            >
              {term}
              <HelpCircle className="w-3.5 h-3.5 text-white/50" aria-hidden="true" />
            </span>
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="max-w-xs rounded-xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl z-50"
            side={side}
            sideOffset={8}
            align="start"
            avoidCollisions
          >
            <div className="space-y-2">
              <h4 className="font-semibold text-white">{term}</h4>
              <p className="text-white/80 leading-relaxed text-xs">{definition}</p>
              {learnMoreUrl && (
                <a
                  href={learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors mt-1"
                  aria-label={`Learn more about ${term} (opens in new tab)`}
                >
                  Learn More
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>
            <Tooltip.Arrow className="fill-slate-950" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * Predefined technical term definitions for NovaFund
 * Use these to ensure consistency across the application.
 */
export const TECHNICAL_TERMS = {
  milestone: {
    term: "Milestone",
    definition:
      "A specific project phase with defined deliverables. Funds are released when milestones are completed and verified.",
    learnMoreUrl: "https://docs.novafund.io/concepts/milestones",
  },
  escrow: {
    term: "Escrow",
    definition:
      "A smart contract that securely holds funds until predefined conditions are met. Protects both backers and project creators.",
    learnMoreUrl: "https://docs.novafund.io/concepts/escrow",
  },
  soroban: {
    term: "Soroban",
    definition:
      "Stellar's smart contract platform. NovaFund uses Soroban to execute secure, transparent funding agreements on-chain.",
    learnMoreUrl: "https://soroban.stellar.org/docs",
  },
  stellar: {
    term: "Stellar",
    definition:
      "A decentralized blockchain network optimized for fast, low-cost payments. NovaFund is built on Stellar for efficient micro-investments.",
    learnMoreUrl: "https://stellar.org/learn/intro-to-stellar",
  },
  wallet: {
    term: "Stellar Wallet",
    definition:
      "Your digital address on the Stellar network where funds are received. Always starts with 'G' and is 56 characters long.",
    learnMoreUrl: "https://docs.novafund.io/guides/wallets",
  },
  tvl: {
    term: "TVL",
    definition:
      "Total Value Locked - The total amount of funds currently held in smart contracts for a project. Indicates project scale.",
    learnMoreUrl: "https://docs.novafund.io/concepts/tvl",
  },
  yield: {
    term: "Expected Yield",
    definition:
      "The projected annual return on your investment, expressed as a percentage. Calculated based on project performance metrics.",
    learnMoreUrl: "https://docs.novafund.io/concepts/yield",
  },
  bridge: {
    term: "Bridge",
    definition:
      "A service that transfers tokens between different blockchains. Allows you to use USDC from Ethereum/Polygon on Stellar.",
    learnMoreUrl: "https://docs.novafund.io/concepts/bridging",
  },
  usdc: {
    term: "USDC",
    definition:
      "USD Coin - A stablecoin pegged 1:1 to the US Dollar. Provides price stability for investments and funding.",
    learnMoreUrl: "https://docs.novafund.io/concepts/usdc",
  },
  smartContract: {
    term: "Smart Contract",
    definition:
      "Self-executing code on the blockchain that automatically enforces funding rules. Eliminates the need for intermediaries.",
    learnMoreUrl: "https://docs.novafund.io/concepts/smart-contracts",
  },
  allOrNothing: {
    term: "All-or-Nothing Funding",
    definition:
      "A funding model where projects only receive funds if they reach their goal. If unsuccessful, all funds are returned to backers.",
    learnMoreUrl: "https://docs.novafund.io/concepts/all-or-nothing",
  },
} as const;

/**
 * Convenience component for using predefined terms
 * 
 * @example
 * <Term termKey="milestone" />
 * <Term termKey="escrow" side="bottom" />
 */
interface PredefinedTermProps {
  termKey: keyof typeof TECHNICAL_TERMS;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  children?: ReactNode;
}

export function Term({ termKey, side, className, children }: PredefinedTermProps) {
  const termData = TECHNICAL_TERMS[termKey];
  return (
    <TermTooltip
      term={termData.term}
      definition={termData.definition}
      learnMoreUrl={termData.learnMoreUrl}
      side={side}
      className={className}
    >
      {children}
    </TermTooltip>
  );
}
