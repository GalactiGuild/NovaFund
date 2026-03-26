import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  ...props
}) => {
  const base =
    "font-semibold rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center";
  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };
  const variants = {
    primary:
      "bg-purple-700 text-white hover:bg-purple-600 focus:ring-purple-500",
    secondary: "bg-gray-800 text-white hover:bg-gray-700 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-500 focus:ring-red-400",
  };

  // Allow custom className to override variants
  const allClasses = `${base} ${sizes[size]} ${variants[variant]} ${props.className || ''}`;

  return (
    <button
      className={allClasses}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
