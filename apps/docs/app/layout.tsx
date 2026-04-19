import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    template: "%s | Lunacord",
    default: "Lunacord — builder-first Lavalink v4 client for Bun + Node.js",
  },
  description:
    "Monorepo of @lunacord/* packages: @lunacord/core (Lavalink v4 manager), @lunacord/discordjs (batteries-included MusicKit), @lunacord/plugins, @lunacord/lyrics, @lunacord/cache-redis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
