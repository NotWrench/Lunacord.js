import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// biome-ignore lint/suspicious/noExplicitAny: fumadocs-mdx emits internal types that cannot be portably named
export const docs: any = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
