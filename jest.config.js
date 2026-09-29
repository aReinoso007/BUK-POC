import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default {
  watchman: false,
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx", ".mts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFilesAfterEnv: [require.resolve("./jest.setup.ts")],
  transform: {
    "^.+\\.m?tsx?$": [
      require.resolve("ts-jest"),
      {
        useESM: true,
      },
    ],
  },
};
