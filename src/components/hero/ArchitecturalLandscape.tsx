import React from 'react';

export const ArchitecturalLandscape: React.FC = () => {
  return (
    <div className="w-full relative overflow-hidden select-none pointer-events-none mt-4">
      {/* Subtle top gradient transition */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#F5F3ED] to-transparent z-10" />

      <svg
        viewBox="0 0 1440 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto min-h-[180px] max-h-[340px] object-cover object-bottom"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Soft morning sun in warm sand */}
        <circle cx="720" cy="180" r="110" fill="#D9B98C" fillOpacity="0.22" />
        <circle cx="720" cy="180" r="75" fill="#D9B98C" fillOpacity="0.35" />

        {/* Back distant rolling hills (Warm muted forest) */}
        <path
          d="M0 240C240 210 420 250 680 220C940 190 1200 240 1440 215V340H0V240Z"
          fill="#3B5B4C"
          fillOpacity="0.25"
        />

        {/* Mid-ground gentle hills */}
        <path
          d="M0 270C320 230 620 280 920 240C1180 210 1340 250 1440 260V340H0V270Z"
          fill="#244737"
          fillOpacity="0.4"
        />

        {/* Modernist Architectural Villa / Pavilion (Left-Center) */}
        <g id="modernist-villa">
          {/* Villa Foundation / Platform */}
          <rect x="580" y="220" width="280" height="14" rx="2" fill="#D9B98C" fillOpacity="0.9" />

          {/* Main Glass Pavilion */}
          <rect x="600" y="165" width="240" height="58" rx="3" fill="#244737" fillOpacity="0.85" />
          
          {/* Architectural Cantilever Roof */}
          <rect x="585" y="156" width="270" height="10" rx="2" fill="#1B372A" />

          {/* Large Panoramic Windows with Warm Interior Glow */}
          <rect x="612" y="174" width="48" height="42" rx="1.5" fill="#FFFBEB" fillOpacity="0.85" />
          <rect x="668" y="174" width="48" height="42" rx="1.5" fill="#FFFBEB" fillOpacity="0.8" />
          <rect x="724" y="174" width="48" height="42" rx="1.5" fill="#FFFBEB" fillOpacity="0.9" />
          <rect x="780" y="174" width="48" height="42" rx="1.5" fill="#FFFBEB" fillOpacity="0.75" />

          {/* Subtle Window Mullions */}
          <line x1="636" y1="174" x2="636" y2="216" stroke="#244737" strokeWidth="1.5" />
          <line x1="692" y1="174" x2="692" y2="216" stroke="#244737" strokeWidth="1.5" />
          <line x1="748" y1="174" x2="748" y2="216" stroke="#244737" strokeWidth="1.5" />
          <line x1="804" y1="174" x2="804" y2="216" stroke="#244737" strokeWidth="1.5" />

          {/* Terracotta / Sand Steps */}
          <rect x="700" y="234" width="40" height="5" rx="1" fill="#D9B98C" />
          <rect x="696" y="239" width="48" height="5" rx="1" fill="#C7A26F" />
        </g>

        {/* Architectural Pine and Foliage Trees (Left) */}
        <g id="trees-left">
          {/* Trunk */}
          <rect x="420" y="210" width="4" height="40" rx="1" fill="#1B372A" />
          {/* Foliage Cones */}
          <polygon points="422,145 405,190 439,190" fill="#244737" />
          <polygon points="422,170 398,215 446,215" fill="#1E3E30" />
          
          <rect x="460" y="225" width="3" height="30" rx="1" fill="#1B372A" />
          <polygon points="461.5,175 448,210 475,210" fill="#3B5B4C" />
          <polygon points="461.5,195 442,230 481,230" fill="#244737" />
        </g>

        {/* Architectural Pine and Foliage Trees (Right) */}
        <g id="trees-right">
          <rect x="980" y="215" width="4" height="42" rx="1" fill="#1B372A" />
          <polygon points="982,150 964,195 1000,195" fill="#244737" />
          <polygon points="982,175 958,220 1006,220" fill="#1E3E30" />

          <rect x="1030" y="228" width="3" height="32" rx="1" fill="#1B372A" />
          <polygon points="1031.5,180 1018,215 1045,215" fill="#3B5B4C" />
        </g>

        {/* Foreground Solid Ground Layer */}
        <path
          d="M0 295C300 275 600 305 900 280C1150 260 1350 285 1440 290V340H0V295Z"
          fill="#244737"
        />

        {/* Subtle Sand Accent Pathway */}
        <path
          d="M720 244C715 270 710 300 705 340H735C730 300 725 270 720 244Z"
          fill="#D9B98C"
          fillOpacity="0.45"
        />
      </svg>
    </div>
  );
};
