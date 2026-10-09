import type { ReactNode } from "react";

export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}
