import { createMDX } from "fumadocs-mdx/next";

/** Fumadocs MDX plugin — see https://www.fumadocs.dev/docs/mdx/next */
const withMDX = createMDX();

export default withMDX({
  reactStrictMode: true,
  transpilePackages: ["@lunacord/core", "@lunacord/discordjs", "@lunacord/plugins"],
});
