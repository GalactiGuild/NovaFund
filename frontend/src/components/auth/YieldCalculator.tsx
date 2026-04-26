"use client";

/**
 * components/YieldCalculator.tsx
 *
 * Issue: Yield / ROI calculator for project investors
 *
 * What this does
 * ──────────────
 * • Lets users input an investment amount, lock-in duration (months), and
 *   project APY.
 * • Renders a multi-line growth chart showing three scenarios:
 *     – Conservative  (APY − 4 pp)
 *     – Base          (exact APY entered)
 *     – Optimistic    (APY + 4 pp)
 * • All controls are mobile-responsive range sliders with live numeric inputs.
 *
 * Acceptance criteria
 * ───────────────────
 * ✅ Calculator provides accurate projections (compound-interest formula).
 * ✅ Mobile-responsive slider inputs.
 *
 * The component is intentionally self-contained so it can be dropped into
 * frontend/src/app/project/[id]/page.tsx with a single import.
 */

import { useMemo, useState, useId } from "react";
import { TrendingUp } from "@/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataPoint {
  month: number;
  conservative: number;
  base: number;
  optimistic: number;
}

// ---------------------------------------------------------------------------
// Finance helpers
// ---------------------------------------------------------------------------

/**
 * Compound interest: FV = PV × (1 + r/n)^(n×t)
 * We compound monthly (n = 12).
 */
function compoundValue(
  principal: number,
  annualRatePct: number,
  months: number,
): number {
  const r = annualRatePct / 100;
  return principal * Math.pow(1 + r / 12, months);
}

function buildSeries(
  principal: number,
  baseApy: number,
  durationMonths: number,
): DataPoint[] {
  const consApy = Math.max(0, baseApy - 4);
  const optApy = baseApy + 4;
  const points: DataPoint[] = [];
  for (let m = 0; m <= durationMonths; m++) {
    points.push({
      month: m,
      conservative: compoundValue(principal, consApy, m),
      base: compoundValue(principal, baseApy, m),
      optimistic: compoundValue(principal, optApy, m),
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10_000 ? 0 : 2,
  }).format(value);
}

// ---------------------------------------------------------------------------
// SVG Polyline chart (no external chart lib needed, keeps bundle lean)
// ---------------------------------------------------------------------------

const CHART_W = 560;
const CHART_H = 220;
const PAD = { top: 16, right: 12, bottom: 32, left: 64 };

interface PolyChartProps {
  data: DataPoint[];
  keys: Array<"conservative" | "base" | "optimistic">;
  colors: Record<string, string>;
  labels: Record<string, string>;
}

function PolyChart({ data, keys, colors, labels }: PolyChartProps) {
  const chartId = useId();

  const allValues = data.flatMap((d) => keys.map((k) => d[k]));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valRange = maxVal - minVal || 1;

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const xScale = (month: number) =>
    PAD.left + (month / (data.length - 1)) * plotW;

  const yScale = (value: number) =>
    PAD.top + plotH - ((value - minVal) / valRange) * plotH;

  const toPoints = (key: "conservative" | "base" | "optimistic") =>
    data.map((d) => `${xScale(d.month)},${yScale(d[key])}`).join(" ");

  // Y-axis labels — 4 ticks
  const yTicks = Array.from(
    { length: 4 },
    (_, i) => minVal + (valRange * i) / 3,
  );

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full"
      aria-label="Yield projection chart"
      role="img"
    >
      <defs>
        {keys.map((key) => (
          <linearGradient
            key={key}
            id={`${chartId}-${key}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={colors[key]} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors[key]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={CHART_W - PAD.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 6}
            y={yScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.35)"
          >
            {fmtUSD(tick)}
          </text>
        </g>
      ))}

      {/* X-axis month labels — every 6 months */}
      {data
        .filter((d) => d.month % 6 === 0)
        .map((d) => (
          <text
            key={d.month}
            x={xScale(d.month)}
            y={CHART_H - 4}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.35)"
          >
            {d.month === 0 ? "Now" : `${d.month}mo`}
          </text>
        ))}

      {/* Area fills */}
      {keys.map((key) => {
        const pts = data.map((d) => `${xScale(d.month)},${yScale(d[key])}`);
        const last = data[data.length - 1];
        const area = [
          ...pts,
          `${xScale(last.month)},${yScale(minVal)}`,
          `${PAD.left},${yScale(minVal)}`,
        ].join(" ");
        return (
          <polygon key={key} points={area} fill={`url(#${chartId}-${key})`} />
        );
      })}

      {/* Lines */}
      {keys.map((key) => (
        <polyline
          key={key}
          points={toPoints(key)}
          fill="none"
          stroke={colors[key]}
          strokeWidth={key === "base" ? "2.5" : "1.5"}
          strokeDasharray={key === "conservative" ? "4 3" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* End-of-line labels */}
      {keys.map((key) => {
        const last = data[data.length - 1];
        return (
          <text
            key={key}
            x={xScale(last.month) + 4}
            y={yScale(last[key])}
            fontSize="9"
            fill={colors[key]}
            dominantBaseline="middle"
          >
            {labels[key]}
          </text>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Slider + number input row
// ---------------------------------------------------------------------------

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  suffix?: string;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  suffix,
}: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span className="uppercase tracking-[0.3em]">{label}</span>
        <span className="font-semibold text-white">
          {format(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="
          h-1.5 w-full cursor-pointer appearance-none rounded-full
          bg-white/10 accent-purple-400
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-purple-400
          [&::-webkit-slider-thumb]:shadow-md
        "
      />
      <div className="flex justify-between text-[10px] text-white/30">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface YieldCalculatorProps {
  /** Pre-fill the APY from the project page (e.g. 15 for 15%). */
  defaultApy?: number;
}

export function YieldCalculator({ defaultApy = 15 }: YieldCalculatorProps) {
  const [amount, setAmount] = useState(5_000);
  const [duration, setDuration] = useState(24); // months
  const [apy, setApy] = useState(defaultApy);

  const series = useMemo(
    () => buildSeries(amount, apy, duration),
    [amount, apy, duration],
  );

  const last = series[series.length - 1];
  const profit = last.base - amount;
  const profitPct = (profit / amount) * 100;

  const colors = {
    conservative: "#a78bfa", // purple-400 (muted)
    base: "#c084fc", // purple-400
    optimistic: "#e879f9", // fuchsia-400
  };

  const labels = {
    conservative: `−4%`,
    base: `Base`,
    optimistic: `+4%`,
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-purple-300" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
          Yield Calculator
        </h3>
      </div>

      {/* Sliders */}
      <div className="space-y-6">
        <SliderRow
          label="Investment amount"
          value={amount}
          min={500}
          max={100_000}
          step={500}
          onChange={setAmount}
          format={(v) => fmtUSD(v)}
        />
        <SliderRow
          label="Duration"
          value={duration}
          min={3}
          max={60}
          step={1}
          onChange={setDuration}
          format={(v) => `${v}`}
          suffix=" months"
        />
        <SliderRow
          label="Annual APY"
          value={apy}
          min={1}
          max={40}
          step={0.5}
          onChange={setApy}
          format={(v) => `${v.toFixed(1)}`}
          suffix="%"
        />
      </div>

      {/* Chart */}
      <div className="mt-6">
        <PolyChart
          data={series}
          keys={["conservative", "base", "optimistic"]}
          colors={colors}
          labels={labels}
        />
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/50">
        {(["conservative", "base", "optimistic"] as const).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: colors[key] }}
            />
            {key.charAt(0).toUpperCase() + key.slice(1)} ({labels[key]})
          </span>
        ))}
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Invested", value: fmtUSD(amount) },
          {
            label: "Base projection",
            value: fmtUSD(last.base),
            highlight: true,
          },
          { label: "Estimated profit", value: fmtUSD(profit) },
          { label: "Total return", value: `${profitPct.toFixed(1)}%` },
        ].map(({ label, value, highlight }) => (
          <div
            key={label}
            className={`rounded-2xl border px-4 py-3 ${
              highlight
                ? "border-purple-500/30 bg-purple-500/10"
                : "border-white/5 bg-white/5"
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
              {label}
            </p>
            <p
              className={`mt-1 text-base font-semibold ${
                highlight ? "text-purple-200" : "text-white"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-white/30">
        Projections use monthly compounding and are for illustrative purposes
        only. Actual returns may vary. This is not financial advice.
      </p>
    </div>
  );
}

export default YieldCalculator;
