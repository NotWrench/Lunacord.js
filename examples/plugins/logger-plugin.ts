import { createLoggerPlugin } from "../../src/plugins";

export const loggerPlugin = createLoggerPlugin(
  {
    name: "example-logger",
    version: "1.0.0",
  },
  {
    includeEvents: ["nodeCreate", "trackStart", "trackEnd"],
  }
);
