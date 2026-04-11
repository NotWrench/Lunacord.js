# Plugins

Lunacord now exposes a dedicated plugin surface through `lunacord/plugins`.

## Plugin shape

Each plugin must declare:

- `name`
- `version`
- `apiVersion`

Optional fields:

- `capabilities`
- `dependencies`
- `timeouts`

Supported hooks:

- `setup(context)`
- `start(context)`
- `stop(context)`
- `dispose(context)`
- `observe(event, context)`
- `beforeRestRequest(context, pluginContext)`
- `afterRestResponse(context, pluginContext)`
- `onRestError(context, pluginContext)`
- `transformSearchResult(context, result, pluginContext)`

## Example

```ts
import { createLoggerPlugin } from "lunacord/plugins";

const plugin = createLoggerPlugin({
  name: "logger",
  version: "1.0.0",
});
```

Plugin failures are isolated from core runtime behavior. Hook exceptions and timeouts emit a single `pluginError` event on the `Lunacord` instance.
