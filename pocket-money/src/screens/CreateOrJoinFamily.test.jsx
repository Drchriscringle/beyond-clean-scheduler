import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { CreateOrJoinFamily } from "./CreateOrJoinFamily";

vi.mock("../lib/api", () => ({
  createFamily: vi.fn(),
  redeemFamilyInvite: vi.fn(),
}));

describe("CreateOrJoinFamily", () => {
  it("renders both the create-family and join-as-co-parent forms", () => {
    renderWithProviders(<CreateOrJoinFamily />);
    expect(screen.getByPlaceholderText("Family name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Invite code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
  });
});
