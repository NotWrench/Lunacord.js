import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        padding: "6rem 1.5rem 4rem",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.7,
        }}
      >
        Lunacord · Monorepo · Bun + Node.js + TypeScript
      </div>
      <h1
        style={{
          fontSize: "clamp(2.5rem, 6vw, 4rem)",
          lineHeight: 1.1,
          fontWeight: 800,
          textAlign: "center",
          margin: 0,
        }}
      >
        Lavalink v4, builder-first.
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          maxWidth: "40rem",
          textAlign: "center",
          opacity: 0.8,
          margin: 0,
        }}
      >
        A ready-made music layer for discord.js bots, with a fluent manager, unified events, player
        persistence, pluggable lyrics, and a batteries-included slash command pack.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/docs"
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            background: "var(--color-fd-primary, #8b5cf6)",
            color: "var(--color-fd-primary-foreground, white)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Read the docs
        </Link>
        <Link
          href="/docs/quickstart"
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--color-fd-border, rgba(255,255,255,.15))",
            color: "var(--color-fd-foreground, currentColor)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Quickstart
        </Link>
        <Link
          href="https://github.com/NotWrench/Lunacord.js"
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--color-fd-border, rgba(255,255,255,.15))",
            color: "var(--color-fd-foreground, currentColor)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          GitHub
        </Link>
      </div>
    </main>
  );
}
