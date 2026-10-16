import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/utils";
import { ChildCard } from "./ChildCard";

describe("ChildCard", () => {
  it("shows the child's name and formatted total balance", () => {
    const kid = { id: "1", name: "Ava", avatar: "A" };
    const balance = { save_pence: 400, spend_pence: 300, give_pence: 300, total_pence: 1000 };
    renderWithProviders(<ChildCard kid={kid} balance={balance} onOpen={() => {}} />);
    expect(screen.getByText("Ava")).toBeInTheDocument();
    expect(screen.getByText("£10.00")).toBeInTheDocument();
    expect(screen.getByText("£4.00")).toBeInTheDocument();
  });

  it("treats a missing balance as zero rather than crashing", () => {
    const kid = { id: "1", name: "Ava", avatar: "A" };
    renderWithProviders(<ChildCard kid={kid} balance={undefined} onOpen={() => {}} />);
    expect(screen.getAllByText("£0.00").length).toBeGreaterThan(0);
  });
});
