import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { AuthGate } from "./AuthGate";

const sendPasswordReset = vi.fn();
vi.mock("../lib/api", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  sendPasswordReset: (...args) => sendPasswordReset(...args),
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

  it("emails a reset link from the forgot-password screen", async () => {
    sendPasswordReset.mockResolvedValue();
    renderWithProviders(<AuthGate />);
    await userEvent.click(screen.getByText(/forgot password/i));
    await userEvent.type(screen.getByLabelText("Email"), "mum@example.com");
    await userEvent.click(screen.getByRole("button", { name: /email me a reset link/i }));
    expect(sendPasswordReset).toHaveBeenCalledWith("mum@example.com");
    expect(await screen.findByText(/emailed a link to reset/i)).toBeInTheDocument();
  });
});
