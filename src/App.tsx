import { useState, useMemo } from "react";
import { createGradientWithOklch, type GradientOptions, type GradientWithOklch } from "./utils/createGradient";
import { formatHex, clampGamut, useMode as setMode, modeOklch, modeRgb } from "culori/fn";
import "./index.css";

// Initialize culori modes
setMode(modeOklch);
setMode(modeRgb);

const LUMINANCE_ORDER = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 1000] as const;

function ColorSwatch({ luminance, color }: { luminance: number; color: string }) {
  const isLight = luminance < 500;
  return (
    <div
      className="flex flex-col items-center justify-end p-2 h-24 min-w-14 rounded-lg shadow-md transition-transform hover:scale-105"
      style={{ backgroundColor: color }}
    >
      <span
        className="text-xs font-mono font-bold"
        style={{ color: isLight ? "#1a1a1a" : "#fafafa" }}
      >
        {luminance}
      </span>
      <span
        className="text-[10px] font-mono opacity-80"
        style={{ color: isLight ? "#1a1a1a" : "#fafafa" }}
      >
        {color}
      </span>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-white/80">
        {label}: <span className="font-mono text-white">{value.toFixed(3)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/20"
      />
    </div>
  );
}

interface LCPlotProps {
  data: GradientWithOklch;
}

function LCPlot({ data }: LCPlotProps) {
  const { gradient, oklchPoints, mainColorOklch } = data;
  
  // SVG dimensions and padding
  const width = 500;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  
  // Scale: L (lightness) on Y-axis (0-1), C (chroma) on X-axis (0-0.4 typical max)
  const maxC = 0.4;
  const scaleX = (c: number) => padding.left + (c / maxC) * plotWidth;
  const scaleY = (l: number) => padding.top + (1 - l) * plotHeight; // Invert Y so 1 is at top
  
  // Get points in order (from 0 to 1000)
  const sortedPoints = LUMINANCE_ORDER.map((lum) => ({
    lum,
    color: gradient[lum],
    ...oklchPoints[lum],
  }));
  
  // Create path for the interpolation line
  const pathD = sortedPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.c)} ${scaleY(p.l)}`)
    .join(" ");

  // Generate colored background grid using the hue from main color
  const clamp = clampGamut("oklch");
  const gridResolution = 40;
  const cellWidth = plotWidth / gridResolution;
  const cellHeight = plotHeight / gridResolution;
  const hue = mainColorOklch.h;
  
  const backgroundCells = useMemo(() => {
    const cells: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i < gridResolution; i++) {
      for (let j = 0; j < gridResolution; j++) {
        const c = (i / gridResolution) * maxC;
        const l = 1 - (j / gridResolution); // Invert because Y grows downward
        const oklchColor = clamp({ mode: "oklch" as const, l, c, h: hue });
        const hex = formatHex(oklchColor);
        if (hex) {
          cells.push({
            x: padding.left + i * cellWidth,
            y: padding.top + j * cellHeight,
            color: hex,
          });
        }
      }
    }
    return cells;
  }, [hue]);

  return (
    <svg width={width} height={height} className="bg-black/30 rounded-xl">
      {/* Colored background showing the color space at this hue */}
      {backgroundCells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={cellWidth + 0.5}
          height={cellHeight + 0.5}
          fill={cell.color}
        />
      ))}
      
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((l) => (
        <g key={`l-${l}`}>
          <line
            x1={padding.left}
            y1={scaleY(l)}
            x2={width - padding.right}
            y2={scaleY(l)}
            stroke="white"
            strokeOpacity={0.1}
          />
          <text
            x={padding.left - 10}
            y={scaleY(l)}
            textAnchor="end"
            dominantBaseline="middle"
            fill="white"
            fillOpacity={0.5}
            fontSize={12}
          >
            {l.toFixed(2)}
          </text>
        </g>
      ))}
      {[0, 0.1, 0.2, 0.3, 0.4].map((c) => (
        <g key={`c-${c}`}>
          <line
            x1={scaleX(c)}
            y1={padding.top}
            x2={scaleX(c)}
            y2={height - padding.bottom}
            stroke="white"
            strokeOpacity={0.1}
          />
          <text
            x={scaleX(c)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fill="white"
            fillOpacity={0.5}
            fontSize={12}
          >
            {c.toFixed(1)}
          </text>
        </g>
      ))}
      
      {/* Axis labels */}
      <text
        x={width / 2}
        y={height - 10}
        textAnchor="middle"
        fill="white"
        fillOpacity={0.7}
        fontSize={14}
        fontWeight="bold"
      >
        Chroma (C)
      </text>
      <text
        x={15}
        y={height / 2}
        textAnchor="middle"
        fill="white"
        fillOpacity={0.7}
        fontSize={14}
        fontWeight="bold"
        transform={`rotate(-90, 15, ${height / 2})`}
      >
        Lightness (L)
      </text>
      
      {/* Interpolation path */}
      <path
        d={pathD}
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeOpacity={0.5}
        strokeDasharray="4 2"
      />
      
      {/* Main color marker */}
      <circle
        cx={scaleX(mainColorOklch.c)}
        cy={scaleY(mainColorOklch.l)}
        r={10}
        fill="none"
        stroke="white"
        strokeWidth={2}
      />
      
      {/* Color points */}
      {sortedPoints.map((p) => (
        <g key={p.lum}>
          <circle
            cx={scaleX(p.c)}
            cy={scaleY(p.l)}
            r={8}
            fill={p.color}
            stroke="white"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          <text
            x={scaleX(p.c)}
            y={scaleY(p.l) - 12}
            textAnchor="middle"
            fill="white"
            fillOpacity={0.6}
            fontSize={10}
          >
            {p.lum}
          </text>
        </g>
      ))}
    </svg>
  );
}

const DEFAULT_COLOR = "#3b82f6";
const DEFAULT_OPTIONS: Required<GradientOptions> = {
  minL: 0.2,
  maxL: 0.98,
  darkChroma: 0.001,
  lightChroma: 0.01,
  mainColorStop: 0.5,
};

export function App() {
  const [mainColor, setMainColor] = useState(DEFAULT_COLOR);
  const [options, setOptions] = useState<Required<GradientOptions>>(DEFAULT_OPTIONS);

  const resetToDefaults = () => {
    setMainColor(DEFAULT_COLOR);
    setOptions(DEFAULT_OPTIONS);
  };

  const gradientData = useMemo(
    () => createGradientWithOklch(mainColor, options),
    [mainColor, options]
  );

  const updateOption = <K extends keyof GradientOptions>(key: K, value: GradientOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Gradient Visualizer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Controls Panel */}
        <div className="bg-white/5 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Controls</h2>
            <button
              onClick={resetToDefaults}
              className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
          
          {/* Color Picker */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-white/80">Main Color:</label>
            <input
              type="color"
              value={mainColor}
              onChange={(e) => setMainColor(e.target.value)}
              className="w-12 h-8 cursor-pointer rounded border-2 border-white/20"
            />
            <span className="font-mono text-sm opacity-70">{mainColor}</span>
          </div>

          {/* Parameter Sliders */}
          <div className="space-y-4">
            <Slider
              label="Min Lightness (dark end)"
              value={options.minL}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => updateOption("minL", v)}
            />
            <Slider
              label="Max Lightness (light end)"
              value={options.maxL}
              min={0.5}
              max={1}
              step={0.01}
              onChange={(v) => updateOption("maxL", v)}
            />
            <Slider
              label="Dark Chroma"
              value={options.darkChroma}
              min={0}
              max={0.2}
              step={0.001}
              onChange={(v) => updateOption("darkChroma", v)}
            />
            <Slider
              label="Light Chroma"
              value={options.lightChroma}
              min={0}
              max={0.2}
              step={0.001}
              onChange={(v) => updateOption("lightChroma", v)}
            />
            <Slider
              label="Main Color Stop"
              value={options.mainColorStop}
              min={0.1}
              max={0.9}
              step={0.01}
              onChange={(v) => updateOption("mainColorStop", v)}
            />
          </div>
        </div>

        {/* L vs C Plot */}
        <div className="bg-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">OKLCH Color Space (L vs C)</h2>
          <LCPlot data={gradientData} />
        </div>
      </div>

      {/* Gradient Display */}
      <div className="bg-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Generated Gradient</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {LUMINANCE_ORDER.map((lum) => (
            <ColorSwatch key={lum} luminance={lum} color={gradientData.gradient[lum]} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
