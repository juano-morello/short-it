import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "./MetricCard.js";

describe("MetricCard", () => {
  it("renders its label, value, and supporting detail", () => {
    render(<MetricCard label="CLICKS" value="124" detail="Last 24 hours" />);

    expect(screen.getByText("CLICKS")).toBeInTheDocument();
    expect(screen.getByText("124")).toBeInTheDocument();
    expect(screen.getByText("Last 24 hours")).toBeInTheDocument();
  });
});
