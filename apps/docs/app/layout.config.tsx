import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <span style={{ fontWeight: 700 }}>Lunacord</span>,
  },
  links: [
    {
      text: "Docs",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "GitHub",
      url: "https://github.com/NotWrench/Lunacord.js",
      external: true,
    },
  ],
};
