import { describe, expect, it } from "vitest";
import { suggestPlayers } from "./matchPlayers";
import type { Player } from "./types";

const roster: Player[] = [
  { id: "1", name: "אלכסיי", strength: 4, active: true },
  { id: "2", name: "אבי חוסרבי", strength: 3, active: true },
  { id: "3", name: "רונן פיין", strength: 2, active: true },
  { id: "4", name: "נרי מדר", strength: 2, active: true },
];

describe("suggestPlayers", () => {
  it("matches substring and token names", () => {
    expect(suggestPlayers("אלכסי", roster)[0]?.player.name).toBe("אלכסיי");
    expect(suggestPlayers("חוסרבי", roster)[0]?.player.name).toBe("אבי חוסרבי");
    expect(suggestPlayers("רונן", roster)[0]?.player.name).toBe("רונן פיין");
    expect(suggestPlayers("נרי", roster)[0]?.player.name).toBe("נרי מדר");
  });
});
