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

  it("maps every icon key to a component", () => {
    for (const [key, Icon] of Object.entries(THEME_ICONS)) {
      expect(typeof Icon === "function" || typeof Icon === "object", key).toBe(true);
    }
  });
});
