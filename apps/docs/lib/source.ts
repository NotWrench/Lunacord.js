import { loader } from "fumadocs-core/source";
import { docs } from "@/.source";

export const source = loader({
  baseUrl: "/docs",
  // biome-ignore lint/suspicious/noExplicitAny: fumadocs-mdx generated object lacks portable types
  source: (docs as any).toFumadocsSource(),
});
