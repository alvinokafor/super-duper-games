export const lagosArt = {
  featured: "/images/featured-house.jpg",
  villa: "/images/villa.jpg",
  terrace: "/images/terrace.jpg",
  boardCentre: "/images/board-centre.jpg",
  property: "/images/property.jpg",
  payday: "/images/payday.jpg",
} as const;

export function ArtTile({ src, className = "" }: { src: string; className?: string }) {
  return <div className={`bg-cover bg-center ${className}`} style={{ backgroundImage: `url(${src})` }} aria-hidden />;
}

// The three-building strip from the Home and sign-in hero cards.
export function LagosHeroStrip({ badge }: { badge?: string }) {
  return (
    <div className="relative h-[112px] shrink-0 overflow-hidden bg-lagoon-mid">
      <svg viewBox="0 0 358 132" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[132px] w-full" aria-hidden>
        <path d="M0 104 Q90 92 180 104 T358 100 V132 H0z" fill="#1A5A44" />
        <path d="M0 116 Q90 108 180 118 T358 114 V132 H0z" fill="#174E3B" />
      </svg>
      <div className="absolute inset-x-4 top-3 grid grid-cols-3 gap-[10px]">
        <ArtTile src={lagosArt.featured} className="h-[88px] rounded-[14px]" />
        <ArtTile src={lagosArt.villa} className="h-[88px] rounded-[14px]" />
        <ArtTile src={lagosArt.terrace} className="h-[88px] rounded-[14px]" />
      </div>
      {badge && (
        <span className="absolute top-[18px] left-[22px] rounded-pill bg-danfo px-2 py-1 text-[11px] leading-[14px] font-black tracking-[0.04em] text-ink">
          {badge}
        </span>
      )}
    </div>
  );
}
