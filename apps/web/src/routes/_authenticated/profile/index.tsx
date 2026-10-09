import { displayNameSchema } from "@bankroll/contracts";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Avatar, Button, ErrorText, errorMessage, Notice, SectionLabel, TextField } from "@/components/ui";
import { authErrorMessage } from "@/features/auth/auth-shell";
import { meQuery, useUpdateMe } from "@/features/auth/queries/me";
import { UsernameField, useUsernameStatus } from "@/features/auth/username-field";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/profile/")({
  component: ProfilePage,
});

function ProfilePage() {
  const me = useQuery(meQuery);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <main className="flex min-h-full flex-col">
      <header className="flex flex-col items-center bg-navy px-4 pt-[calc(env(safe-area-inset-top)+28px)] pb-[22px]">
        {me.data && (
          <>
            <Avatar person={me.data} size={96} className="border-[3px] border-white bg-origin-border" />
            <h1 className="mt-[10px] text-center text-[24px] leading-[28px] font-black tracking-tight text-white">
              {me.data.displayName}
            </h1>
            <p className="mt-[2px] text-[14px] leading-[18px] font-semibold text-navy-mist">
              @{me.data.username}
              {email && ` · ${email}`}
            </p>
          </>
        )}
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {me.data && <EditProfile displayName={me.data.displayName} username={me.data.username} />}
        <ChangePassword />
      </div>

      <div className="mt-auto flex justify-center px-4 pt-6 pb-6">
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="text-body leading-[18px] font-black text-alert"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}

function EditProfile(props: { displayName: string; username: string }) {
  const [displayName, setDisplayName] = useState(props.displayName);
  const [username, setUsername] = useState(props.username);
  const usernameStatus = useUsernameStatus(username, props.username);
  const update = useUpdateMe();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = displayName.trim() !== props.displayName || username.trim() !== props.username;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const name = displayNameSchema.safeParse(displayName);
    if (!name.success) return setError(name.error.issues[0]?.message ?? "Enter a name");
    const usernameChanged = username.trim() !== props.username;
    if (usernameChanged && usernameStatus.status !== "available") return setError("Choose a free, valid username");
    try {
      await update.mutateAsync({
        ...(name.data !== props.displayName && { displayName: name.data }),
        ...(usernameChanged && { username: username.trim() }),
      });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-card bg-white px-4 py-[14px]">
      <SectionLabel className="px-0">Your profile</SectionLabel>
      <TextField label="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
      <UsernameField value={username} onChange={setUsername} status={usernameStatus} />
      <ErrorText>{error}</ErrorText>
      {saved && <Notice>Saved</Notice>}
      <Button type="submit" size="form" variant="lagoon" disabled={!changed || update.isPending}>
        {update.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function ChangePassword() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password"));
    setSaved(false);
    if (password !== String(form.get("confirm"))) return setError("The passwords don't match.");
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    formEl.reset();
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-card bg-white px-4 py-[14px]">
      <SectionLabel className="px-0">Change password</SectionLabel>
      <TextField
        label="New password"
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="8 or more characters"
        autoComplete="new-password"
      />
      <TextField label="Repeat new password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      {saved && <Notice>Password changed</Notice>}
      <Button type="submit" size="form" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
