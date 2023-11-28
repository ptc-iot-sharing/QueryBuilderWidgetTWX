import { mergeWithCustomize, customizeObject } from "webpack-merge";
import { createConfig } from "./webpack/webpack.common";

module.exports = (env, argv) =>
  mergeWithCustomize({
    customizeObject: customizeObject({
      entry: "replace",
      externals: "replace",
    }),
  })(createConfig(env, argv), {
    entry: {
      // the entry point for the runtime widget
      widgetRuntime: `./src/QueryBuilder.runtime.ts`,
      // the entry point for the ide widget
      widgetIde: `./src/QueryBuilder.ide.ts`,
    },
    // moment is available directly on window inside the thingworx runtime and mashup builder
    externals: { moment: "moment", jquery: "jQuery" },
  });
