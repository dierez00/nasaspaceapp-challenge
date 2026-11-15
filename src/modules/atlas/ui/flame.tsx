"use client";
import { useId } from "react";
import type { Gravity, Experiment } from "../domain/experiment";

export function Flame({
  gravity,
  outcome = "ignition",
  compact = false,
}: {
  gravity: Gravity;
  outcome?: Experiment["outcome"];
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const color =
    outcome === "extinction"
      ? "#059669"
      : gravity === "micro"
        ? "#3B82F6"
        : "#FF5A1F";
  return (
    <svg
      className={`flame-art ${compact ? "compact" : ""}`}
      viewBox="0 0 100 110"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`heat${id}`}>
          <stop stopColor="#fff8d2" />
          <stop offset=".25" stopColor={color} stopOpacity=".95" />
          <stop offset=".62" stopColor={color} stopOpacity=".55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`body${id}`} x1=".2" y1="0" x2=".8" y2="1">
          <stop stopColor={gravity === "micro" ? "#b5e4ff" : "#fff1b7"} />
          <stop
            offset=".35"
            stopColor={gravity === "micro" ? "#54b8ff" : "#ffb338"}
          />
          <stop
            offset="1"
            stopColor={gravity === "micro" ? "#154aaf" : "#c53618"}
            stopOpacity=".35"
          />
        </linearGradient>
        <filter id={`noise${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".045"
            numOctaves="2"
            seed="8"
          />
          <feDisplacementMap
            in="SourceGraphic"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      {outcome === "extinction" ? (
        <g fill="none" stroke={color}>
          <circle cx="50" cy="63" r="19" strokeWidth="2" />
          <circle cx="50" cy="63" r="12" opacity=".3" />
          <circle cx="50" cy="63" r="3" fill="#d5ddd9" stroke="none" />
        </g>
      ) : outcome === "unknown" ? (
        <text
          x="50"
          y="70"
          textAnchor="middle"
          fill="currentColor"
          fontSize="30"
        >
          ?
        </text>
      ) : (
        <g
          className={`flame-body flame-${gravity}`}
          style={{ transformOrigin: "50px 70px" }}
        >
          <ellipse
            cx="50"
            cy={gravity === "earth" ? 52 : 61}
            rx={gravity === "micro" ? 36 : 28}
            ry={gravity === "earth" ? 48 : gravity === "lunar" ? 31 : 36}
            fill={`url(#heat${id})`}
            filter={`url(#noise${id})`}
          />
          <path
            d={
              gravity === "earth"
                ? "M50 20 C47 42 25 56 37 76 C45 90 67 82 65 65 C65 48 53 41 50 20"
                : gravity === "lunar"
                  ? "M49 37 C42 47 23 61 33 76 C42 90 71 82 68 64 C65 49 53 48 49 37"
                  : "M50 42 C25 42 24 82 50 83 C77 82 76 42 50 42"
            }
            fill={`url(#body${id})`}
            opacity=".88"
            filter={compact ? undefined : `url(#noise${id})`}
          />
          <ellipse
            cx="50"
            cy="70"
            rx="7"
            ry={gravity === "earth" ? 13 : 7}
            fill={gravity === "micro" ? "#b6e7ff" : "#fff0c6"}
            opacity=".75"
          />
          <circle cx="50" cy="73" r="3" fill={color} />
        </g>
      )}
    </svg>
  );
}
