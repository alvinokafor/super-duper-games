type IconProps = { color?: string; size?: number };

export function BackIcon({ color = "#202A25", size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <path d="M10 3L5 8l5 5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronIcon({ color = "#8A958F" }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <path d="M6 3l5 5-5 5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ color = "#FFFFFF", size = 16, strokeWidth = 2 }: IconProps & { strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <path d="M8 3v10M3 8h10" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ color = "#8A958F" }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <circle cx="7" cy="7" r="4.5" fill="none" stroke={color} strokeWidth="1.7" />
      <path d="M10.5 10.5L14 14" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ClearIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
      <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="#5C6B64" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden>
      <path
        d="M4.5 12.5V8a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5H3z M7.5 15.5h3"
        fill="none"
        stroke="#202A25"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function JoinRoomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M7 4H4v10h3M10 6l3 3-3 3M13 9H6"
        fill="none"
        stroke="#9A6B12"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InviteFriendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="7" cy="7" r="2.6" fill="none" stroke="#BE3A62" strokeWidth="1.7" />
      <path
        d="M2.5 14.5c.6-2.2 2.4-3.3 4.5-3.3s3.9 1.1 4.5 3.3M14 6v5M11.5 8.5h5"
        fill="none"
        stroke="#BE3A62"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M3 9l12-6-4.5 13-2-5.5z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function CrownIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 40 28" aria-hidden>
      <path d="M3 24L6 6l9 9 5-13 5 13 9-9 3 18z" fill="#F5BF45" stroke="#C4922A" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function WhotIcon() {
  return (
    <svg width="44" height="36" viewBox="0 0 44 36" aria-hidden>
      <rect x="6" y="6" width="20" height="28" rx="4" transform="rotate(-12 16 20)" fill="#FFFFFF" stroke="#7A5EA8" strokeWidth="2" />
      <rect x="18" y="4" width="20" height="28" rx="4" transform="rotate(8 28 18)" fill="#FFFFFF" stroke="#7A5EA8" strokeWidth="2" />
      <circle cx="28" cy="18" r="4" fill="#7A5EA8" />
    </svg>
  );
}

export function AyoIcon() {
  return (
    <svg width="56" height="28" viewBox="0 0 56 28" aria-hidden>
      <rect x="1" y="1" width="54" height="26" rx="8" fill="#E2B867" stroke="#9A6B12" strokeWidth="2" />
      {[10, 19, 28, 37, 46].flatMap((cx) => [
        <circle key={`${cx}-9`} cx={cx} cy="9" r="3" fill="#9A6B12" />,
        <circle key={`${cx}-19`} cx={cx} cy="19" r="3" fill="#9A6B12" />,
      ])}
    </svg>
  );
}

const TAB_GREY = "#8A958F";
const TAB_GREEN = "#206B52";
const TAB_FILL = "#E6F0EB";

export function TabIcon({ name, active }: { name: "home" | "games" | "friends" | "groups" | "profile"; active: boolean }) {
  const stroke = active ? TAB_GREEN : TAB_GREY;
  const fill = active ? TAB_FILL : "none";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      {name === "home" && <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill={fill} stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />}
      {name === "games" && (
        <>
          <rect x="3" y="7" width="18" height="11" rx="5" fill={fill} stroke={stroke} strokeWidth="1.8" />
          <path d="M8 10.5v3M6.5 12h3" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="11.5" r="1.1" fill={stroke} />
        </>
      )}
      {name === "friends" && (
        <>
          <circle cx="9" cy="9" r="3.5" fill={fill} stroke={stroke} strokeWidth="1.8" />
          <path
            d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M16 5.2a3 3 0 0 1 0 5.6M17 14c2 .4 3.4 1.7 4 4"
            fill="none"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
      {name === "groups" && (
        <>
          <path
            d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M20 9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2v2l-3-2h-3"
            fill="none"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {name === "profile" && (
        <>
          <circle cx="12" cy="8" r="4" fill={fill} stroke={stroke} strokeWidth="1.8" />
          <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
