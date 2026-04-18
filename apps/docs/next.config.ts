import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

export default withMDX({
  reactStrictMode: true,
  transpilePackages: ["@lunacord/core", "@lunacord/discordjs", "@lunacord/plugins"],
  // The generated .source files reference internal fumadocs-mdx types that aren't portable.
  // We still run typecheck on hand-written source separately via `tsc --noEmit` in CI.
  typescript: { ignoreBuildErrors: true },
});
