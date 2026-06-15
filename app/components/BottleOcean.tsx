"use client";

/**
 * BottleOcean — a hand-crafted floating glass "message in a bottle" for the 404
 * page. Pure inline SVG so it composes over the live ocean scene with no extra
 * draw cost. Golden-hour glass tint (translucent --water-near body lit by
 * --sun-glow / --glitter), a cork, a rolled paper note inside, a soft specular
 * glint, and an elongated shimmering reflection on the water beneath it.
 *
 * Motion: a slow compound bob + lazy rotation on the bottle and an even slower
 * horizontal drift on the whole group, plus a gently breathing reflection. All
 * via CSS keyframes so `prefers-reduced-motion` flattens it to a calm still.
 * Purely decorative — aria-hidden, never focusable.
 */
export default function BottleOcean() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: "min(280px, 70vw)",
        // drift sideways like flotsam carried by the current
        animation: "bottle-drift 13s ease-in-out infinite",
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 260 220"
        width="100%"
        height="100%"
        role="presentation"
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          {/* translucent glass body: deep near-water blue with a golden lit edge */}
          <linearGradient id="bo-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--sun-glow)" stopOpacity="0.72" />
            <stop offset="26%" stopColor="var(--glitter)" stopOpacity="0.46" />
            <stop offset="58%" stopColor="var(--water-near)" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--water-far)" stopOpacity="0.78" />
          </linearGradient>
          {/* warm inner volume so the note reads through the glass */}
          <linearGradient id="bo-inner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sun-glow)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--water-far)" stopOpacity="0.30" />
          </linearGradient>
          {/* the rolled note */}
          <linearGradient id="bo-paper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.96" />
            <stop offset="100%" stopColor="var(--fog)" stopOpacity="0.92" />
          </linearGradient>
          {/* cork */}
          <linearGradient id="bo-cork" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--land-lit)" />
            <stop offset="55%" stopColor="var(--fog)" />
            <stop offset="100%" stopColor="var(--land-shade)" />
          </linearGradient>
          {/* specular glint */}
          <linearGradient id="bo-glint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--sun-glow)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="bo-reflect" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--glitter)" stopOpacity="0.55" />
            <stop offset="60%" stopColor="var(--glitter)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--glitter)" stopOpacity="0" />
          </radialGradient>
          <filter id="bo-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id="bo-reflect-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
        </defs>

        {/* --- shimmering reflection / shadow on the water beneath the bottle --- */}
        <g style={{ animation: "bottle-shimmer 6.5s ease-in-out infinite" }}>
          {/* broad warm gleam the bottle casts onto the sun path */}
          <ellipse
            cx="130"
            cy="166"
            rx="100"
            ry="15"
            fill="url(#bo-reflect)"
            filter="url(#bo-reflect-blur)"
          />
          {/* tighter mirrored streak directly beneath the glass */}
          <ellipse cx="128" cy="162" rx="70" ry="6" fill="var(--sun-glow)" opacity="0.34" filter="url(#bo-soft)" />
          {/* faint cool contact shadow hugging the hull */}
          <ellipse cx="124" cy="156" rx="58" ry="4" fill="var(--water-far)" opacity="0.30" filter="url(#bo-soft)" />
        </g>

        {/* --- the bottle: bobs + lazily rotates as one rigid object --- */}
        <g
          style={{
            transformOrigin: "130px 130px",
            animation: "bottle-bob 7s ease-in-out infinite",
          }}
        >
          {/* tilted ~ -15deg, lying low on the water; neck points up-right.
             Body runs base(left,x~46) -> shoulder(x~150) -> neck -> lip(x~210).
             Centerline at y=108; half-height ~26 at the belly. */}
          <g transform="rotate(-15 130 130)">
            {/* glass body silhouette (single smooth profile, mirrored top/bottom).
               Used both as the warm inner volume and, again, as the tinted glass. */}
            <path
              id="bo-shape"
              d="
                M 50 82
                C 40 82 38 92 38 108
                C 38 124 40 134 50 134
                L 140 134
                C 158 134 168 130 176 122
                C 182 116 186 116 196 116
                C 202 116 204 114 204 108
                C 204 102 202 100 196 100
                C 186 100 182 100 176 94
                C 168 86 158 82 140 82
                Z"
              fill="url(#bo-inner)"
            />

            {/* a faint liquid line low in the belly catches the sun */}
            <path
              d="M 46 124 C 90 130 130 130 150 126 L 168 120 L 168 116 C 130 122 90 122 46 118 Z"
              fill="var(--glitter)"
              opacity="0.20"
            />

            {/* rolled paper note, clipped to the bottle so it sits *inside* */}
            <clipPath id="bo-clip">
              <use href="#bo-shape" />
            </clipPath>
            <g clipPath="url(#bo-clip)">
              <g transform="rotate(-3 96 110)">
                {/* the scroll body */}
                <rect x="68" y="98" width="62" height="26" rx="13" fill="url(#bo-paper)" />
                {/* shaded roll edges for a cylindrical read */}
                <rect x="68" y="98" width="10" height="26" rx="5" fill="var(--fog)" opacity="0.9" />
                <rect x="120" y="98" width="10" height="26" rx="5" fill="var(--land-lit)" opacity="0.55" />
                {/* ruled lines hinting at handwriting */}
                <line x1="85" y1="106" x2="117" y2="106" stroke="var(--land-shade)" strokeWidth="1.3" opacity="0.55" strokeLinecap="round" />
                <line x1="85" y1="111" x2="113" y2="111" stroke="var(--land-shade)" strokeWidth="1.3" opacity="0.46" strokeLinecap="round" />
                <line x1="85" y1="116" x2="119" y2="116" stroke="var(--land-shade)" strokeWidth="1.3" opacity="0.40" strokeLinecap="round" />
              </g>
            </g>

            {/* translucent tinted glass OVER the note (note shows through) */}
            <use
              href="#bo-shape"
              fill="url(#bo-glass)"
              stroke="var(--sun-glow)"
              strokeOpacity="0.6"
              strokeWidth="1.6"
            />

            {/* punt / rounded base — a soft vertical highlight on the bottom end */}
            <path d="M 42 92 C 36 100 36 116 42 124" stroke="var(--sun-glow)" strokeWidth="2.2" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
            <ellipse cx="48" cy="108" rx="5" ry="22" fill="var(--water-far)" opacity="0.32" />

            {/* cork plugged into the lip — slightly tapered barrel */}
            <g>
              <path
                d="M 197 99
                   C 196 102 196 114 197 117
                   L 213 119
                   C 217 118 217 98 213 97
                   Z"
                fill="url(#bo-cork)"
                stroke="var(--land-shade)"
                strokeOpacity="0.4"
                strokeWidth="0.9"
              />
              {/* rounded cork end-cap + grain */}
              <ellipse cx="213" cy="108" rx="2.4" ry="10.5" fill="var(--land-lit)" opacity="0.85" />
              <line x1="202" y1="100" x2="202" y2="116" stroke="var(--land-shade)" strokeWidth="0.8" opacity="0.32" />
              <line x1="207" y1="99" x2="207" y2="117" stroke="var(--land-shade)" strokeWidth="0.8" opacity="0.24" />
              {/* tiny top highlight on the cork */}
              <line x1="199" y1="101" x2="210" y2="100" stroke="var(--sun-glow)" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
            </g>
            {/* glass mouth ring where the cork meets the neck */}
            <ellipse cx="196" cy="108" rx="3" ry="9" fill="none" stroke="var(--sun-glow)" strokeOpacity="0.6" strokeWidth="1.3" />

            {/* soft highlight skimming the lower-front edge — sells the round glass */}
            <path
              d="M 52 128 C 96 134 132 132 156 126"
              stroke="var(--glitter)"
              strokeWidth="2.4"
              strokeOpacity="0.4"
              fill="none"
              strokeLinecap="round"
            />

            {/* long specular glint sweeping the upper shoulder */}
            <path
              d="M 56 88 C 100 84 130 84 162 90 C 124 95 96 95 58 95 Z"
              fill="url(#bo-glint)"
              opacity="0.85"
            />
            {/* a small hot kiss of light near the shoulder bend */}
            <ellipse cx="164" cy="92" rx="5.5" ry="2.4" fill="var(--ink)" opacity="0.75" filter="url(#bo-soft)" />
          </g>
        </g>
      </svg>

      <style>{`
        @keyframes bottle-bob {
          0%   { transform: translateY(0)     rotate(0deg);    }
          25%  { transform: translateY(-5px)  rotate(1.4deg);  }
          50%  { transform: translateY(-7px)  rotate(0deg);    }
          75%  { transform: translateY(-3px)  rotate(-1.4deg); }
          100% { transform: translateY(0)     rotate(0deg);    }
        }
        @keyframes bottle-drift {
          0%, 100% { transform: translateX(-10px); }
          50%      { transform: translateX(10px);  }
        }
        @keyframes bottle-shimmer {
          0%, 100% { transform: scaleX(0.96); opacity: 0.78; }
          50%      { transform: scaleX(1.06); opacity: 1;    }
        }
        /* prefers-reduced-motion is honored globally (globals.css) — these
           keyframes collapse to a calm still under that query. */
      `}</style>
    </div>
  );
}
