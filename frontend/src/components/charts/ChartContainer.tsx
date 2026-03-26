'use client';

export default function ChartContainer({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--chart-bg)] p-4 rounded-2xl shadow-sm w-full">
      {title && (
        <h3 className="text-sm font-semibold mb-2 text-[var(--chart-text)]">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}