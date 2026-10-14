import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { Settings } from "./Settings";

vi.mock("../lib/api", () => ({
  updateFamilyCurrency: vi.fn(),
  deleteMyAccount: vi.fn(),
  createBillingPortalSession: vi.fn(),
}));

const family = { id: "fam-1", name: "The Smiths", currency: "GBP" };

describe("Settings", () => {
  it("only enables the delete button once DELETE is typed exactly", async () => {
    renderWithProviders(<Settings family={family} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /delete my family/i }));

    const deleteButton = screen.getByRole("button", { name: /permanently delete/i });
    expect(deleteButton).toBeDisabled();

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "delete");
    expect(deleteButton).toBeDisabled(); // wrong case — must be exact

    await userEvent.clear(input);
    await userEvent.type(input, "DELETE");
    expect(deleteButton).toBeEnabled();
  });
});
