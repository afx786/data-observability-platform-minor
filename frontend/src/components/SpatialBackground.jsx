/**
 * Low-contrast ambient canvas inspired by the Stitch reference: a soft drafting
 * grid, drifting telemetry orbs and a flowing periwinkle/gold ribbon.
 * Purely decorative and removed for reduced-motion users via index.css.
 */
export default function SpatialBackground() {
  return (
    <div className="stitch-spatial" aria-hidden="true">
      <div className="stitch-spatial-grid" />

      <div className="stitch-spatial-orbs">
        <div className="stitch-orb stitch-orb-one" />
        <div className="stitch-orb stitch-orb-two" />
        <div className="stitch-orb stitch-orb-three" />
      </div>

      <svg
        className="stitch-spatial-ribbon"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="stitch-ribbon-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
            <stop offset="52%" stopColor="#8BA0B8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#DFD4BE" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          d="M-120 420 C 180 250, 360 500, 640 300 S 1060 100, 1320 260"
          fill="none"
          stroke="url(#stitch-ribbon-gradient)"
          strokeWidth="150"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
