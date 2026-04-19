// @ts-nocheck

import { server } from 'fumadocs-mdx/runtime/server';
import * as __fd_glob_1 from "../content/docs/advanced.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/builders.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/cache.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/commands.mdx?collection=docs"
import * as __fd_glob_17 from "../content/docs/core/lunacord.mdx?collection=docs"
import * as __fd_glob_18 from "../content/docs/core/node.mdx?collection=docs"
import * as __fd_glob_19 from "../content/docs/core/player.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/embeds.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/filters.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/localization.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/lyrics.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import * as __fd_glob_10 from "../content/docs/migration.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/musickit.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/musickit-quickstart.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/persistence.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/plugins.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/quickstart.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/recipes.mdx?collection=docs"
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"advanced.mdx": __fd_glob_1, "builders.mdx": __fd_glob_2, "cache.mdx": __fd_glob_3, "commands.mdx": __fd_glob_4, "embeds.mdx": __fd_glob_5, "filters.mdx": __fd_glob_6, "index.mdx": __fd_glob_7, "localization.mdx": __fd_glob_8, "lyrics.mdx": __fd_glob_9, "migration.mdx": __fd_glob_10, "musickit-quickstart.mdx": __fd_glob_11, "musickit.mdx": __fd_glob_12, "persistence.mdx": __fd_glob_13, "plugins.mdx": __fd_glob_14, "quickstart.mdx": __fd_glob_15, "recipes.mdx": __fd_glob_16, "core/lunacord.mdx": __fd_glob_17, "core/node.mdx": __fd_glob_18, "core/player.mdx": __fd_glob_19, });