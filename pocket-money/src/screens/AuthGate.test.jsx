import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { AuthGate } from "./AuthGate";

vi.mock("../lib/api", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

describe("AuthGate", () => {
  it("renders the sign-in form by default", () => {
    renderWithProviders(<AuthGate />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("switches to the signup form", async () => {
    renderWithProviders(<AuthGate />);
    await userEvent.click(screen.getByText(/create a parent account/i));
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });
});
