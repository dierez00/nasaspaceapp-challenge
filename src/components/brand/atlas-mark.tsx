import { useId } from "react";

/** Shared orbital aperture and combustion nucleus; no text is baked into the mark. */
export function AtlasMark({
  className = "",
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      className={`atlas-mark ${className}`}
      aria-hidden="true"
      data-monochrome={monochrome}
    >
      <defs>
        <linearGradient
          id={`rim-${id}`}
          x1="12"
          y1="5"
          x2="48"
          y2="57"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e4f1ff" />
          <stop offset=".45" stopColor="#83a8cf" />
          <stop offset="1" stopColor="#284563" />
        </linearGradient>
        <radialGradient id={`core-${id}`} cx=".32" cy=".3" r=".8">
          <stop stopColor="#fff1c7" />
          <stop offset=".4" stopColor="#ffb05e" />
          <stop offset=".78" stopColor="#f06835" />
          <stop offset="1" stopColor="#a73c28" />
        </radialGradient>
      </defs>
      <path
        d="M48 12A26 26 0 1 0 54 45"
        fill="none"
        stroke={monochrome ? "currentColor" : `url(#rim-${id})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M8 43C1 39 17 19 39 13C53 9 61 11 58 16"
        fill="none"
        stroke={monochrome ? "currentColor" : "#688cad"}
        strokeWidth="2"
      />
      <path
        d="M34 13C36 25 48 29 46 39C44 50 25 53 20 42C16 33 23 26 27 23C27 29 29 30 30 29C34 25 35 20 34 13Z"
        fill={monochrome ? "currentColor" : `url(#core-${id})`}
      />
      {!monochrome && (
        <path
          d="M34 31C36 37 31 43 25 43C29 50 42 47 44 40C44 35 40 33 38 30C38 36 36 36 34 31Z"
          fill="#953c2c"
          opacity=".7"
        />
      )}
      <path
        d="M7 44C14 50 40 41 55 24C59 20 61 16 58 14"
        fill="none"
        stroke={monochrome ? "currentColor" : `url(#rim-${id})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
