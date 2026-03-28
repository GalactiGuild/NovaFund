import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "danger";
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const variants = {
    primary: "bg-purple-700 text-white",
    secondary: "bg-muted text-muted-foreground",
    success: "bg-green-600 text-white",
    danger: "bg-red-600 text-white",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
