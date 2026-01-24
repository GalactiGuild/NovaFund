import React from "react";
import Button from "@/components/ui/Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  actionHref,
  onAction,
  className = "",
}) => {
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      window.location.href = actionHref;
    }
  };

  return (
    <div
      className={`flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-600 bg-gray-800/20 p-8 text-center ${className}`}
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-700/40 text-gray-400">
        <svg
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-xl font-semibold tracking-tight text-white">
        {title}
      </h3>
      <p className="mb-6 max-w-sm text-muted-foreground">{description}</p>
      {actionText && <Button onClick={handleAction}>{actionText}</Button>}
    </div>
  );
};

export default EmptyState;
