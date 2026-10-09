import type { ReactNode } from "react";
import { LagosHeroStrip } from "@/features/games/art";

// No sign-in screens exist in the Paper file, so these reuse the Home hero card and form styles.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[calc(env(safe-area-inset-top)+16px)] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="mx-4 flex flex-col overflow-hidden rounded-[20px] bg-lagoon">
        <LagosHeroStrip />
        <div className="flex flex-col gap-1 px-4 pt-[10px] pb-[14px]">
          <p className="text-[22px] leading-[26px] font-black tracking-tight text-white">Lagos Property</p>
          <p className="text-[14px] leading-[19px] text-lagoon-mist">Buy the city. Build, lend and outlast your friends.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-4 pt-6 pb-4">
        <h1 className="text-heading leading-8 font-black tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[14px] leading-[19px] text-ink-soft">{subtitle}</p>}
      </div>

      <div className="flex flex-col gap-3 px-4">{children}</div>

      {footer && <div className="mt-auto px-4 pt-6 text-center text-[14px] leading-[18px] text-ink-soft">{footer}</div>}
    </main>
  );
}

export const authLinkClass = "font-black text-lagoon";

// Supabase returns technical wording for a few common cases.
export function authErrorMessage(error: { message: string; code?: string | undefined }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "weak_password":
      return "Choose a stronger password (at least 8 characters).";
    case "over_email_send_rate_limit":
      return "Too many emails sent. Please wait a minute and try again.";
    case "same_password":
      return "Your new password must be different from the old one.";
    default:
      return error.message;
  }
}
