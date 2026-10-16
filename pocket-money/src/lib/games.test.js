import { describe, expect, it } from "vitest";
import { GAMES, gamesFor, coinsFor, coinRounds, fewestCoins, needWantRounds, jarRounds, valueRounds, dailyGame } from "./games";

describe("money games", () => {
  it("gives little ones fewer, simpler games and small coins", () => {
    expect(gamesFor("little").map((g) => g.key)).not.toContain("value");
    expect(gamesFor("big").length).toBe(GAMES.length);
    expect(Math.max(...coinsFor("GBP", "little"))).toBeLessThanOrEqual(20);
    expect(coinsFor("USD", "big")).toEqual([1, 5, 10, 25, 100]);
  });

  it("only sets coin targets that can be made with the coins on offer", () => {
    for (const mode of ["little", "middle", "big"]) {
      const coins = coinsFor("GBP", mode);
      for (const target of coinRounds(mode, coins, 42, 8)) {
        expect(fewestCoins(target, coins), `${mode}:${target}`).toBeLessThan(Infinity);
      }
    }
    expect(fewestCoins(47, [1, 2, 5, 10, 20, 50])).toBe(4); // 20+20+5+2
  });

  it("has balanced, labelled rounds for every band", () => {
    for (const mode of ["little", "middle", "big"]) {
      const nw = needWantRounds(mode, 7, 10);
      expect(nw.filter((r) => r.answer === "need").length).toBe(5);
      expect(nw.every((r) => r.label && r.icon)).toBe(true);
      const jars = jarRounds(mode, 7, 6);
      expect(new Set(jars.map((r) => r.answer))).toEqual(new Set(["save", "spend", "give"]));
    }
  });

  it("works out the better deal per unit", () => {
    const rounds = valueRounds(3, 6);
    const pens = rounds.find((r) => r.per === "pen");
    expect(pens.better).toBe("a"); // 40p each beats 45p
    const pasta = rounds.find((r) => r.per === "500g");
    expect(pasta.better).toBe("b"); // 80p per 500g beats 90p
  });

  it("picks the same game all day and rotates tomorrow", () => {
    const today = new Date("2026-10-16T09:00:00Z");
    const later = new Date("2026-10-16T21:00:00Z");
    const tomorrow = new Date("2026-10-17T09:00:00Z");
    expect(dailyGame("middle", "kid", today)).toBe(dailyGame("middle", "kid", later));
    expect(dailyGame("middle", "kid", today)).not.toBe(dailyGame("middle", "kid", tomorrow));
  });
});
