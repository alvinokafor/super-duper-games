import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { ClearIcon, SearchIcon } from "./icons";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <main className={`flex min-h-full flex-col pt-[calc(env(safe-area-inset-top)+16px)] ${className}`}>{children}</main>
  );
}

export function ScreenTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-3">
      <h1 className="text-heading leading-8 font-black tracking-tight text-ink">{title}</h1>
      {action}
    </div>
  );
}

// Fixed bottom area for a screen's main action, above the home indicator.
export function BottomBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-auto flex flex-col gap-[10px] px-4 pt-3 pb-[max(30px,env(safe-area-inset-bottom))] ${className}`}>
      {children}
    </div>
  );
}

export const headerActionClass =
  "flex h-10 items-center gap-[6px] rounded-[12px] bg-lagoon px-[14px] text-[14px] leading-[18px] font-black text-white";

export const backButtonClass = "flex size-9 shrink-0 items-center justify-center rounded-[12px] border border-edge bg-white";

export const rowClass = "flex items-center gap-3 rounded-[14px] bg-white px-3 py-2";

export function SectionLabel({
  children,
  tone = "text-ink-soft",
  action,
  className = "",
}: {
  children: ReactNode;
  tone?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-1 ${className}`}>
      <h2 className={`text-caption leading-caption font-black tracking-[0.06em] uppercase ${tone}`}>{children}</h2>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-body leading-[18px] font-black text-ink">{children}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const buttonVariants = {
  lagoon: "bg-lagoon text-white",
  danfo: "bg-danfo text-ink",
  outline: "border-[1.5px] border-edge bg-white text-ink",
  ghost: "font-bold text-ink-soft",
  muted: "bg-paper-deep text-[#6E6860]",
  quiet: "bg-paper-deep text-ink-soft",
} as const;

const buttonSizes = {
  lg: "h-[52px] rounded-[14px] px-4 text-[16px] leading-5",
  md: "h-12 rounded-[14px] px-4 text-[14px] leading-[18px]",
  form: "h-10 rounded-[12px] px-4 text-[14px] leading-[18px]",
  sm: "h-[34px] rounded-button px-[14px] text-label leading-caption",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(variant: ButtonVariant = "lagoon", size: ButtonSize = "lg") {
  return `flex shrink-0 items-center justify-center font-black whitespace-nowrap disabled:opacity-60 ${buttonSizes[size]} ${buttonVariants[variant]}`;
}

export function Button({
  variant = "lagoon",
  size = "lg",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

// ---------------------------------------------------------------------------
// People and groups
// ---------------------------------------------------------------------------

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function pick<T>(list: readonly T[], key: string): T {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return list[hash % list.length]!;
}

const personColors = ["bg-violet", "bg-teal", "bg-brass", "bg-navy", "bg-rose", "bg-lagoon"] as const;

const avatarSizes = {
  24: "size-6 text-[9px] leading-3",
  28: "size-7 text-[10px] leading-3",
  36: "size-9 text-label leading-caption",
  40: "size-10 text-[15px] leading-[18px]",
  44: "size-11 text-[16px] leading-5",
  52: "size-[52px] text-[18px] leading-body",
  96: "size-24 text-[32px] leading-10",
} as const;

export function Avatar({
  person,
  size = 44,
  dimmed = false,
  className = "",
}: {
  person: { id: string; displayName: string; avatarUrl?: string | null };
  size?: keyof typeof avatarSizes;
  dimmed?: boolean;
  className?: string;
}) {
  const base = `${avatarSizes[size]} flex shrink-0 items-center justify-center rounded-pill font-black text-white ${dimmed ? "opacity-70" : ""} ${className}`;
  if (person.avatarUrl) {
    return (
      <div
        className={`${base} bg-[#DDE5E0] bg-cover bg-center`}
        style={{ backgroundImage: `url(${person.avatarUrl})` }}
        role="img"
        aria-label={person.displayName}
      />
    );
  }
  return <div className={`${base} ${pick(personColors, person.id)}`}>{initialsOf(person.displayName)}</div>;
}

const personTextColors = ["text-violet", "text-teal", "text-brass", "text-navy", "text-rose", "text-lagoon"] as const;

// Matches the person's avatar colour, for their name above chat bubbles.
export function personTextColor(id: string) {
  return pick(personTextColors, id);
}

const groupColors = [
  "bg-danfo text-ink",
  "bg-navy text-white",
  "bg-rose text-white",
  "bg-teal text-white",
  "bg-violet text-white",
  "bg-brass text-white",
] as const;

const groupBadgeSizes = {
  36: "size-9 rounded-[12px] text-[14px] leading-[18px]",
  40: "size-10 rounded-[13px] text-body leading-[18px]",
  44: "size-11 rounded-[14px] text-[16px] leading-5",
  52: "size-[52px] rounded-card text-[18px] leading-body",
  72: "size-[72px] rounded-[22px] text-[24px] leading-[30px]",
  76: "size-[76px] rounded-sheet text-[26px] leading-8",
} as const;

// Coloured by name so the preview while creating a group matches the result.
export function GroupBadge({ group, size = 52 }: { group: { name: string }; size?: keyof typeof groupBadgeSizes }) {
  return (
    <div
      className={`${groupBadgeSizes[size]} ${pick(groupColors, group.name.trim().toLowerCase())} flex shrink-0 items-center justify-center font-black`}
    >
      {initialsOf(group.name)}
    </div>
  );
}

export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-alert px-1 text-[11px] leading-[14px] font-black text-white ${className}`}
    >
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const fieldClass =
  "h-[46px] w-full rounded-[12px] border border-edge bg-white px-[14px] text-body leading-[18px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted focus:border-lagoon focus:shadow-[0_0_0_0.5px_#206B52]";

export function TextField({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className={`flex flex-col gap-[6px] ${className}`}>
      {label && <span className="text-caption leading-caption font-bold text-ink-soft">{label}</span>}
      <input {...props} className={fieldClass} />
      {hint}
    </label>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const active = value.length > 0;
  return (
    <div
      className={`flex h-12 shrink-0 items-center gap-2 rounded-[14px] bg-white px-[14px] ${
        active ? "border-[1.5px] border-lagoon" : "border border-edge"
      }`}
    >
      <SearchIcon color={active ? "#206B52" : "#8A958F"} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-body leading-[18px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {active && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-[#E3E6E1]"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

export function ErrorText({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={`text-label leading-[18px] font-semibold text-alert ${className}`}>{children}</p>;
}

export function Notice({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={`text-label leading-[18px] font-semibold text-lagoon ${className}`}>{children}</p>;
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-label leading-[18px] text-ink-soft ${className}`}>{children}</p>;
}

export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : "Something went wrong";
}
