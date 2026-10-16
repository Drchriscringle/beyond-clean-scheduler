import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { ChildSignIn } from "./ChildSignIn";

const signInAsChild = vi.fn();
vi.mock("../lib/api", () => ({
  signInAsChild: (...args) => signInAsChild(...args),
}));

describe("ChildSignIn", () => {
  it("asks for a username, then a PIN, and signs in after four digits", async () => {
    signInAsChild.mockResolvedValue({ child_id: "c1", family_id: "f1", name: "Ella" });
    renderWithProviders(<ChildSignIn onParent={() => {}} />);

    await userEvent.type(screen.getByLabelText("Username"), "Ella M");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/now your 4-digit pin, ella-m/i)).toBeInTheDocument();

    for (const d of ["1", "2", "3", "4"]) await userEvent.click(screen.getByRole("button", { name: d }));
    expect(signInAsChild).toHaveBeenCalledWith("ella-m", "1234");
  });

  it("goes back to the username step when the username is unknown", async () => {
    signInAsChild.mockRejectedValue(new Error("We couldn't find that username."));
    renderWithProviders(<ChildSignIn onParent={() => {}} />);

    await userEvent.type(screen.getByLabelText("Username"), "nobody");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    for (const d of ["1", "1", "1", "1"]) await userEvent.click(screen.getByRole("button", { name: d }));

    expect(await screen.findByText(/couldn't find that username/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("offers a way back to the parent sign-in", async () => {
    const onParent = vi.fn();
    renderWithProviders(<ChildSignIn onParent={onParent} />);
    await userEvent.click(screen.getByRole("button", { name: /i'm a parent/i }));
    expect(onParent).toHaveBeenCalled();
  });
});
