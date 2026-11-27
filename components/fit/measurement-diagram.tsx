import { useId } from "react";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";
import { MEASUREMENT_FIELDS, type MeasurementKind } from "@/lib/measurements";

// "Where to measure": a simple front-view figure with a numbered line for each measurement.
// The numbers match the form's labels; the line for the field being filled in is highlighted.

type Line =
  | { type: "h"; y: number; x1: number; x2: number; label: [number, number] }
  | { type: "v"; x: number; y1: number; y2: number; label: [number, number] }
  | { type: "loop"; cx: number; cy: number; rx: number; ry: number; label: [number, number] };

const LINES: Record<string, Line> = {
  neck: { type: "h", y: 60, x1: 90, x2: 110, label: [124, 52] },
  shoulder: { type: "h", y: 71, x1: 60, x2: 140, label: [152, 66] },
  armhole: { type: "loop", cx: 136, cy: 96, rx: 7, ry: 17, label: [156, 96] },
  bust: { type: "h", y: 132, x1: 64, x2: 136, label: [150, 132] },
  chest: { type: "h", y: 132, x1: 64, x2: 136, label: [150, 132] },
  underBust: { type: "h", y: 152, x1: 67, x2: 133, label: [148, 154] },
  upperArm: { type: "h", y: 122, x1: 45, x2: 64, label: [24, 122] },
  waist: { type: "h", y: 178, x1: 74, x2: 126, label: [142, 178] },
  hip: { type: "h", y: 222, x1: 60, x2: 140, label: [154, 222] },
  seat: { type: "h", y: 222, x1: 60, x2: 140, label: [154, 222] },
  sleeveLength: { type: "v", x: 32, y1: 76, y2: 234, label: [18, 156] },
  shoulderToWaist: { type: "v", x: 86, y1: 66, y2: 178, label: [86, 106] },
  kurtaLength: { type: "v", x: 86, y1: 66, y2: 300, label: [86, 106] },
  waistToFloor: { type: "v", x: 118, y1: 178, y2: 404, label: [118, 290] },
  trouserLength: { type: "v", x: 118, y1: 178, y2: 392, label: [118, 290] },
  height: { type: "v", x: 186, y1: 14, y2: 404, label: [186, 330] },
};

/** Measurements the diagram can show (a unit test checks every measurement has a line). */
export const DIAGRAM_KEYS = Object.keys(LINES);

// The left half of the figure's outline; the right half is its mirror image.
const LEFT: Array<[number, number]> = [
  [92, 54],
  [90, 64],
  [72, 66],
  [60, 76],
  [48, 100],
  [42, 168],
  [40, 232],
  [42, 252],
  [52, 250],
  [52, 232],
  [56, 168],
  [66, 112],
  [64, 134],
  [74, 178],
  [60, 224],
  [64, 260],
  [70, 316],
  [80, 392],
  [72, 404],
  [96, 404],
  [94, 392],
  [92, 316],
  [100, 252],
];

const OUTLINE = (() => {
  const right = [...LEFT].reverse().map(([x, y]) => [200 - x, y] as [number, number]);
  const points = [...LEFT, ...right.slice(1)];
  return `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
})();

export function MeasurementDiagram({
  kind,
  activeKey,
  className,
}: {
  kind: MeasurementKind;
  activeKey?: string | null;
  className?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const fields = MEASUREMENT_FIELDS[kind];

  return (
    <svg
      viewBox="0 0 200 420"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={cn("h-auto w-full", className ?? "max-w-56")}
    >
      <title id={titleId}>{en.fit.diagramTitle}</title>
      <desc id={descId}>{en.fit.diagramDescription}</desc>
      <rect x="0" y="0" width="200" height="420" className="fill-sand" />
      <circle cx="100" cy="34" r="20" className="fill-white stroke-stone-700" strokeWidth="1.5" />
      <path
        d={OUTLINE}
        className="fill-white stroke-stone-700"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {fields.map((field, index) => {
        const line = LINES[field.key];
        if (!line) return null;
        const active = field.key === activeKey;
        const stroke = active ? "stroke-crimson-700" : "stroke-gold-700";
        const [lx, ly] = line.label;
        return (
          <g key={field.key} aria-hidden="true">
            {line.type === "h" ? (
              <line
                x1={line.x1}
                x2={line.x2}
                y1={line.y}
                y2={line.y}
                className={stroke}
                strokeWidth={active ? 3 : 1.75}
                strokeDasharray={active ? undefined : "4 3"}
              />
            ) : line.type === "v" ? (
              <line
                x1={line.x}
                x2={line.x}
                y1={line.y1}
                y2={line.y2}
                className={stroke}
                strokeWidth={active ? 3 : 1.75}
                strokeDasharray={active ? undefined : "4 3"}
              />
            ) : (
              <ellipse
                cx={line.cx}
                cy={line.cy}
                rx={line.rx}
                ry={line.ry}
                className={cn(stroke, "fill-none")}
                strokeWidth={active ? 3 : 1.75}
                strokeDasharray={active ? undefined : "4 3"}
              />
            )}
            <circle
              cx={lx}
              cy={ly}
              r="9"
              className={active ? "fill-crimson-700" : "fill-white stroke-gold-700"}
              strokeWidth="1.5"
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="600"
              className={active ? "fill-white" : "fill-charcoal"}
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
