/**
 * Geometric Frontage "F" monogram — a placeholder emblem component meant to
 * be swapped for the final brand SVG. Hexagonal frame with a stepped F
 * cut, so it reads as engineered rather than typographic.
 */
export function FrontageEmblem({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 1.5 21.1 6.75v10.5L12 22.5 2.9 17.25V6.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 17V7h7M9 12h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
