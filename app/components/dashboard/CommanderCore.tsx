import { FrontageEmblem } from "../hud/FrontageEmblem";

/**
 * The illuminated AI core at the center of the Growth Commander network:
 * bloom, radial tick ring, dashed + segmented + plain concentric rings,
 * two orbiting indicator dots, a periodic light sweep, and the Frontage
 * emblem breathing in the middle. Pure CSS/SVG — no canvas, no video.
 */
export function CommanderCore() {
  // 60 radial tick marks drawn once as SVG, rotated slowly as a group.
  // Coordinates are fixed-precision strings so server and client markup
  // stringify identically (avoids React hydration mismatches).
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    const r0 = long ? 94 : 97;
    return {
      x1: (100 + r0 * Math.cos(angle)).toFixed(2),
      y1: (100 + r0 * Math.sin(angle)).toFixed(2),
      x2: (100 + 100 * Math.cos(angle)).toFixed(2),
      y2: (100 + 100 * Math.sin(angle)).toFixed(2),
      strong: long,
    };
  });

  return (
    <div className="fg-core" aria-hidden="true">
      <div className="fg-core-bloom" />

      <svg className="fg-core-ticks" viewBox="0 0 200 200">
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.strong ? "rgba(47,212,245,0.5)" : "rgba(120,165,255,0.22)"}
            strokeWidth={t.strong ? 1.4 : 0.8}
          />
        ))}
      </svg>

      <div className="fg-core-ring fg-core-ring--outer" />
      <div className="fg-core-ring fg-core-ring--seg" />
      <div className="fg-core-ring fg-core-ring--mid" />
      <div className="fg-core-ring fg-core-ring--inner" />

      <div className="fg-core-orbit">
        <span className="fg-core-orbit-dot" />
      </div>
      <div className="fg-core-orbit fg-core-orbit--slow">
        <span className="fg-core-orbit-dot" />
      </div>

      <div className="fg-core-sweep" />

      <div className="fg-core-body">
        <span className="fg-core-emblem">
          <FrontageEmblem size={44} />
        </span>
      </div>
    </div>
  );
}
