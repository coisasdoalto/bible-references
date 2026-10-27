import { describe, expect, it } from "vitest";

import { validateStylesheet } from "../scripts/check-package";

const validTailwindPropertiesCss = `
  @layer properties {
    @supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) {
      *,:before,:after,::backdrop {
        --tw-border-style: solid;
        --tw-blur: initial;
        --tw-leading: initial;
      }
    }
  }
  @property --tw-border-style {
    syntax: "*";
    inherits: false;
    initial-value: solid;
  }
  @property --tw-blur {
    syntax: "*";
    inherits: false;
  }
  .br-reference { color: red; }
  .br\\:flex { display: flex; }
  .br-tooltip::after { content: ""; }
`;

describe("validateStylesheet", () => {
  it("accepts valid stylesheet with Tailwind @layer properties fallback and @property --tw-*", () => {
    const css = validTailwindPropertiesCss;
    expect(() => validateStylesheet(css)).not.toThrow();
  });

  it("rejects non---tw-* @property definitions", () => {
    const css = `
      @property --br-theme {
        syntax: "<color>";
        inherits: false;
      }
    `;
    expect(() => validateStylesheet(css)).toThrow(/Disallowed @property rule/);
  });

  it("rejects arbitrary universal selector rules with non---tw-* declarations", () => {
    const css = "* { margin: 0; }";
    expect(() => validateStylesheet(css)).toThrow(/disallowed declaration "margin: 0"/);
  });

  it("rejects universal selectors with custom properties that do not start with --tw-", () => {
    const css = "* { --br-accent: red; }";
    expect(() => validateStylesheet(css)).toThrow(/disallowed declaration "--br-accent: red"/);
  });

  it("rejects disallowed universal selector structures such as descendants or class qualifiers", () => {
    expect(() => validateStylesheet("div * { --tw-border-style: solid; }")).toThrow(
      /Disallowed universal selector/,
    );
    expect(() => validateStylesheet("*.button { --tw-border-style: solid; }")).toThrow(
      /Disallowed universal selector/,
    );
  });

  it("rejects universal selector fallback if any declaration is not a --tw-* property", () => {
    const css = `
      *, :before, :after, ::backdrop {
        --tw-border-style: solid;
        padding: 0;
      }
    `;
    expect(() => validateStylesheet(css)).toThrow(/disallowed declaration "padding: 0"/);
  });

  it("rejects unscoped class names without br- or br: prefix", () => {
    const css = ".button { display: flex; }";
    expect(() => validateStylesheet(css)).toThrow(
      /Stylesheet has classes without the br- or br: prefix/,
    );
  });

  it("rejects selectors targeting :root or :host", () => {
    expect(() => validateStylesheet(":root { --spacing: 1rem; }")).toThrow(
      /Stylesheet must not target :root or :host/,
    );
    expect(() => validateStylesheet(":host { --spacing: 1rem; }")).toThrow(
      /Stylesheet must not target :root or :host/,
    );
  });

  it("permits pseudo-elements on scoped class selectors", () => {
    const css = `
      .br-tooltip-body::after {
        content: "";
        display: block;
      }
    `;
    expect(() => validateStylesheet(css)).not.toThrow();
  });

  it("ignores asterisks in comments and @property syntax descriptors", () => {
    const css = `
      /* Universal comment: * and :before */
      @property --tw-outline-style {
        syntax: "*";
        inherits: false;
        initial-value: solid;
      }
      .br-tooltip { box-sizing: border-box; }
    `;
    expect(() => validateStylesheet(css)).not.toThrow();
  });

  it("rejects unscoped class inside @layer components", () => {
    const css = "@layer components { .bad-unscoped { color: red; } }";
    expect(() => validateStylesheet(css)).toThrow(
      /Stylesheet has classes without the br- or br: prefix: bad-unscoped/,
    );
  });

  it("rejects unscoped class inside @layer utilities", () => {
    const css = "@layer utilities { .bad-unscoped { display: flex; } }";
    expect(() => validateStylesheet(css)).toThrow(
      /Stylesheet has classes without the br- or br: prefix: bad-unscoped/,
    );
  });

  it("rejects unscoped class inside @media query", () => {
    const css = "@media (min-width: 600px) { .bad-unscoped { color: blue; } }";
    expect(() => validateStylesheet(css)).toThrow(
      /Stylesheet has classes without the br- or br: prefix: bad-unscoped/,
    );
  });

  it("accepts scoped class with attribute substring operator", () => {
    const css = '.br-tooltip[data-br-placement*="top"] { color: red; }';
    expect(() => validateStylesheet(css)).not.toThrow();
  });
});
