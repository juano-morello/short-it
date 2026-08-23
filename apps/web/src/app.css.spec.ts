import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");
const spacingTokens = readFileSync(
  resolve(process.cwd(), "../../packages/design-system/src/tokens/spacing.css"),
  "utf8",
);

describe("application styles", () => {
  it("uses the dark ink treatment for primary buttons", () => {
    expect(stylesheet).toMatch(
      /button \{[\s\S]*background: var\(--color-foreground\);[\s\S]*color: var\(--color-background\);/,
    );
  });

  it("includes shared shell gutters in its width so it remains centered", () => {
    expect(stylesheet).toMatch(
      /\.site-shell \{[\s\S]*box-sizing: border-box;[\s\S]*width: min\(100%, var\(--layout-max\)\);/,
    );
  });

  it("only references spacing tokens provided by the design system", () => {
    const definedTokens = new Set(spacingTokens.match(/--space-\d+(?=\s*:)/g));
    const referencedTokens = stylesheet.match(/--space-\d+/g) ?? [];

    for (const token of referencedTokens) {
      expect(definedTokens).toContain(token);
    }
  });
});
