import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  ...props
}) => {
  const base =
    "font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none active:scale-95";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "h-9 w-9",
  };
  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
    outline: "bg-transparent border border-input hover:bg-accent hover:text-accent-foreground",
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
