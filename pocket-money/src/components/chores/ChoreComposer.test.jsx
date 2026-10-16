import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/utils";
import { ChoreComposer } from "./ChoreComposer";

const addChore = vi.fn();
vi.mock("../../lib/api", () => ({
  addChore: (...args) => addChore(...args),
  getAvatarSignedUrl: vi.fn(),
}));

const kids = [
  { id: "k1", name: "Ava", weekly_budget_pence: 700 },
  { id: "k2", name: "Ben", weekly_budget_pence: 0 },
];

describe("ChoreComposer", () => {
  it("offers eight days to plan when 'Pick days' is chosen and saves them", async () => {
    addChore.mockResolvedValue({});
    renderWithProviders(<ChoreComposer familyId="f1" kids={kids} idea={{ name: "Make bed", icon: "bed" }} />);

    await userEvent.click(screen.getByRole("button", { name: "Pick days" }));
    const dayButtons = screen.getAllByRole("button", { pressed: false }).filter((b) => /^(Today|Tomorrow|\w{3}) \d+ \w{3}$/.test(b.getAttribute("aria-label") || ""));
    expect(dayButtons).toHaveLength(8);

    await userEvent.click(dayButtons[0]);
    await userEvent.click(dayButtons[2]);
    await userEvent.click(screen.getByRole("button", { name: /add chore/i }));

    expect(addChore).toHaveBeenCalledTimes(1);
    const call = addChore.mock.calls[0][0];
    expect(call.schedule).toBe("dates");
    expect(call.dates).toHaveLength(2);
    expect(call.childId).toBe("k1");
    expect(call.icon).toBe("bed");
  });

  it("can give one chore to several children at once, every day", async () => {
    addChore.mockResolvedValue({});
    renderWithProviders(<ChoreComposer familyId="f1" kids={kids} />);

    await userEvent.type(screen.getByLabelText("Chore name"), "Brush teeth");
    await userEvent.click(screen.getByRole("button", { name: /Ben/ }));
    await userEvent.click(screen.getByRole("button", { name: "Every day" }));
    await userEvent.click(screen.getByRole("button", { name: /add for 2 children/i }));

    expect(addChore).toHaveBeenCalledTimes(2);
    expect(addChore.mock.calls.map((c) => c[0].childId).sort()).toEqual(["k1", "k2"]);
    expect(addChore.mock.calls[0][0].schedule).toBe("daily");
  });

  it("won't save a planned chore with no days picked", async () => {
    renderWithProviders(<ChoreComposer familyId="f1" kids={kids} idea={{ name: "Wash up", icon: "droplets" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick days" }));
    await userEvent.click(screen.getByRole("button", { name: /add chore/i }));
    expect(screen.getAllByText(/pick at least one day/i).length).toBeGreaterThan(0);
    expect(addChore).not.toHaveBeenCalledWith(expect.objectContaining({ name: "Wash up" }));
  });
});
