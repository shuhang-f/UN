import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { resolveModel } from "agent-core";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UN — Your property review desk",
  description: "A daily review desk for property managers. Prepare renewal drafts, reconcile evidence, and keep every next step on record.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let modelConfigured = false;
  try { resolveModel(); modelConfigured = true; } catch { /* Guided mode works without credentials. */ }
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers enabled={modelConfigured}>{children}</Providers>
      </body>
    </html>
  );
}
