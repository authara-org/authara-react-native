import { describe, expect, it } from "vitest";

import packageJSON from "../package.json" with { type: "json" };

describe("package peer contract", () => {
  it("supports the verified Expo 56 and 57 adapter package lines", () => {
    expect(packageJSON.peerDependencies).toMatchObject({
      "expo-apple-authentication": ">=7 <9 || >=56 <58",
      "expo-auth-session": ">=6 <8 || >=56 <58",
      "expo-secure-store": ">=14 <16 || >=56 <58",
    });
  });

  it("exposes every public entry point to import and default resolvers", () => {
    for (const entry of Object.values(packageJSON.exports)) {
      expect(entry).toMatchObject({
        import: expect.stringMatching(/^\.\/dist\/.*\.js$/),
        types: expect.stringMatching(/^\.\/dist\/.*\.d\.ts$/),
        default: expect.stringMatching(/^\.\/dist\/.*\.js$/),
      });
    }
  });
});
