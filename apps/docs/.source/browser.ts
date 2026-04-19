// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"advanced.mdx": () => import("../content/docs/advanced.mdx?collection=docs"), "builders.mdx": () => import("../content/docs/builders.mdx?collection=docs"), "cache.mdx": () => import("../content/docs/cache.mdx?collection=docs"), "commands.mdx": () => import("../content/docs/commands.mdx?collection=docs"), "embeds.mdx": () => import("../content/docs/embeds.mdx?collection=docs"), "filters.mdx": () => import("../content/docs/filters.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "localization.mdx": () => import("../content/docs/localization.mdx?collection=docs"), "lyrics.mdx": () => import("../content/docs/lyrics.mdx?collection=docs"), "migration.mdx": () => import("../content/docs/migration.mdx?collection=docs"), "musickit-quickstart.mdx": () => import("../content/docs/musickit-quickstart.mdx?collection=docs"), "musickit.mdx": () => import("../content/docs/musickit.mdx?collection=docs"), "persistence.mdx": () => import("../content/docs/persistence.mdx?collection=docs"), "plugins.mdx": () => import("../content/docs/plugins.mdx?collection=docs"), "quickstart.mdx": () => import("../content/docs/quickstart.mdx?collection=docs"), "recipes.mdx": () => import("../content/docs/recipes.mdx?collection=docs"), "core/lunacord.mdx": () => import("../content/docs/core/lunacord.mdx?collection=docs"), "core/node.mdx": () => import("../content/docs/core/node.mdx?collection=docs"), "core/player.mdx": () => import("../content/docs/core/player.mdx?collection=docs"), }),
};
export default browserCollections;