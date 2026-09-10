import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Realtime Kanban",
  description: "A realtime collaboration kanban board"
};

// Every page is client-rendered and auth-gated — no build-time prerendering needed.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}