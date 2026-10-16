import { describe, expect, it } from "vitest";
import { THEME_COLORS, THEME_ICONS, WALLPAPERS, themeColor, wallpaperStyle } from "./theme";

describe("theme helpers", () => {
  it("returns the chosen colour when one is set", () => {
    expect(themeColor({ color: "teal" }, "anything").key).toBe("teal");
  });

  it("derives a stable colour from the name when none is chosen", () => {
    const a = themeColor({}, "Ella-Marie");
    const b = themeColor(undefined, "Ella-Marie");
    expect(a.key).toBe(b.key);
    expect(THEME_COLORS.map((c) => c.key)).toContain(a.key);
  });

  it("produces a background for every wallpaper and colour", () => {
    for (const w of WALLPAPERS) {
      for (const c of THEME_COLORS) {
        const style = wallpaperStyle(w.key, c);
        expect(style.backgroundColor).toBeTruthy();
        if (w.key !== "plain") expect(style.backgroundImage).toBeTruthy();
      }
    }
  });

  it("offers plenty of colours, each with unique keys and the three shades", () => {
    expect(THEME_COLORS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(THEME_COLORS.map((c) => c.key)).size).toBe(THEME_COLORS.length);
    for (const c of THEME_COLORS) {
      for (const shade of ["main", "soft", "dark"]) expect(c[shade], `${c.key}.${shade}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the original default colour for a child who hasn't picked one", () => {
    // Derived from the first eight colours only, so adding more never
    // changes an existing child's look.
    const originals = ["violet", "blue", "teal", "green", "orange", "pink", "red", "slate"];
    for (const name of ["Ella-Marie", "Tom", "Ava", "Noah", "Zara"]) {
      expect(originals).toContain(themeColor({}, name).key);
    }
  });

  it("maps every icon key to a component", () => {
    for (const [key, Icon] of Object.entries(THEME_ICONS)) {
      expect(typeof Icon === "function" || typeof Icon === "object", key).toBe(true);
    }
  });
});
