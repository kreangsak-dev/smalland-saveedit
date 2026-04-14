import { useId } from 'react';

/** Welcome hero mark — orbit dots + document scan (replaces prior ring/leaf) */
export function WelcomeAnimatedLogo() {
  const u = useId().replace(/:/g, '');
  const grad = `wv2-grad-${u}`;
  const glow = `wv2-glow-${u}`;
  const clip = `wv2-clip-${u}`;

  return (
    <div className="welcome-v2" role="img" aria-label="Save editor">
      <svg className="welcome-v2-svg" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <linearGradient id={grad} x1="32" y1="168" x2="168" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0d9488" />
            <stop offset="0.55" stopColor="#5eead4" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
          <radialGradient id={glow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(20, 184, 166, 0.45)" />
            <stop offset="70%" stopColor="rgba(20, 184, 166, 0)" />
          </radialGradient>
          <clipPath id={clip}>
            <rect x="64" y="56" width="72" height="88" rx="14" />
          </clipPath>
        </defs>

        <circle className="welcome-v2-glow-disk" cx="100" cy="100" r="78" fill={`url(#${glow})`} />

        <g className="welcome-v2-orbit">
          <circle cx="100" cy="32" r="6" fill={`url(#${grad})`} className="welcome-v2-dot welcome-v2-dot--0" />
          <circle cx="100" cy="32" r="6" fill={`url(#${grad})`} className="welcome-v2-dot welcome-v2-dot--1" transform="rotate(120 100 100)" />
          <circle cx="100" cy="32" r="6" fill={`url(#${grad})`} className="welcome-v2-dot welcome-v2-dot--2" transform="rotate(240 100 100)" />
        </g>

        <g className="welcome-v2-doc-wrap">
          <rect
            x="64"
            y="56"
            width="72"
            height="88"
            rx="14"
            fill="var(--surface)"
            stroke="rgba(13, 148, 136, 0.22)"
            strokeWidth="1"
          />
          <path d="M64 78h72" stroke="rgba(13,148,136,0.18)" strokeWidth="1" />
          <path
            d="M82 98h28M82 108h44M82 118h36"
            stroke="rgba(15,23,42,0.12)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <g clipPath={`url(#${clip})`}>
            <rect className="welcome-v2-scan" x="68" y="62" width="64" height="4" rx="2" fill="#14b8a6" opacity="0.35" />
          </g>
        </g>
      </svg>
    </div>
  );
}
