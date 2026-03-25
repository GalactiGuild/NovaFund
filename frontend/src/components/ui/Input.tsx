import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, ...props }) => {
  const base =
    "w-full px-3 py-3 border rounded focus:outline-none focus:ring-2 min-h-[44px] md:py-2 md:min-h-0";
  const errorStyle = error
    ? "border-red-500 focus:ring-red-400"
    : "border-gray-700 focus:ring-purple-500";

  return (
    <div className="flex flex-col mb-4">
      <label className="mb-1 font-medium" htmlFor={props.id}>
        {label}
      </label>
      <input
        className={`${base} ${errorStyle}`}
        {...props}
        aria-invalid={!!error}
      />
      {error && <span className="text-red-500 text-sm mt-1">{error}</span>}
    </div>
  );
};

export default Input;
