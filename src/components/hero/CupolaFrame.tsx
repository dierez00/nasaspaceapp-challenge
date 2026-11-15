// The ISS cupola seen from the inside: an octagonal window ringed by eight
// trapezoidal panels split by ribs that radiate from the viewer. Geometry is
// generated per orientation so the bevels keep their proportions on phones.

type Point = [number, number];

interface Layout {
  w: number;
  h: number;
  /** Horizontal and vertical inset of the window from the viewport edge. */
  ix: number;
  iy: number;
  /** Chamfer of the window's corners. */
  c: number;
}

// Panel tones, clockwise from the top: lit from above, falling into shadow below.
const PANEL_TONES = [
  "#33466b",
  "#2b3d60",
  "#223250",
  "#18253f",
  "#121d34",
  "#18253f",
  "#223250",
  "#2b3d60",
];

function build({ w, h, ix, iy, c }: Layout) {
  const opening: Point[] = [
    [ix + c, iy],
    [w - ix - c, iy],
    [w - ix, iy + c],
    [w - ix, h - iy - c],
    [w - ix - c, h - iy],
    [ix + c, h - iy],
    [ix, h - iy - c],
    [ix, iy + c],
  ];
  const cx = w / 2;
  const cy = h / 2;
  // Extend each window vertex along the ray from the centre until it meets the viewport edge.
  const outer: Point[] = opening.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const k = Math.min(
      dx === 0 ? Infinity : (dx > 0 ? w - cx : cx) / Math.abs(dx),
      dy === 0 ? Infinity : (dy > 0 ? h - cy : cy) / Math.abs(dy),
    );
    return [cx + dx * k, cy + dy * k];
  });
  const corners: Record<number, Point> = {
    1: [w, 0],
    3: [w, h],
    5: [0, h],
    7: [0, 0],
  };
  const panels = opening.map((v, i) => {
    const n = (i + 1) % 8;
    const pts: Point[] = [v, outer[i]];
    if (corners[i]) pts.push(corners[i]);
    pts.push(outer[n], opening[n]);
    return pts;
  });
  const bolts = opening.map(([x, y], i): Point => {
    const [ox, oy] = outer[i];
    return [x + (ox - x) * 0.34, y + (oy - y) * 0.34];
  });
  return { opening, outer, panels, bolts };
}

const str = (pts: Point[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function Orientation({ layout, className }: { layout: Layout; className: string }) {
  const { opening, outer, panels, bolts } = build(layout);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {panels.map((pts, i) => (
        <polygon key={i} points={str(pts)} fill={PANEL_TONES[i]} />
      ))}
      {/* Ribs: a dark seam with a lit edge beside it. */}
      {opening.map(([x, y], i) => (
        <g key={i} fill="none" strokeLinecap="round">
          <line
            x1={x}
            y1={y}
            x2={outer[i][0]}
            y2={outer[i][1]}
            stroke="#050a16"
            strokeWidth="5"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x}
            y1={y}
            x2={outer[i][0]}
            y2={outer[i][1]}
            stroke="rgba(233,237,243,0.16)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            transform="translate(2.5 0)"
          />
        </g>
      ))}
      {bolts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="6"
          fill="#0a1324"
          stroke="rgba(233,237,243,0.28)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* Window seal: a deep shadow band, then the lit rim of the glass. */}
      <polygon
        points={str(opening)}
        fill="none"
        stroke="#03060e"
        strokeWidth="14"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={str(opening)}
        fill="none"
        stroke="rgba(233,237,243,0.55)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function CupolaFrame() {
  return (
    <div className="cupola-frame" aria-hidden="true">
      <Orientation
        className="cupola-landscape"
        layout={{ w: 1600, h: 900, ix: 150, iy: 100, c: 120 }}
      />
      <Orientation
        className="cupola-portrait"
        layout={{ w: 900, h: 1600, ix: 62, iy: 150, c: 110 }}
      />
    </div>
  );
}

export default CupolaFrame;
