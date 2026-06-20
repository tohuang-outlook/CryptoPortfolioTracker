import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PriceStatus } from "./PriceStatus";

describe("PriceStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T16:45:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a readable same-day timestamp when prices are ready", () => {
    render(
      <PriceStatus status="ready" lastUpdated="2026-06-19T16:41:00.000Z" />
    );

    expect(screen.getByText(/live prices updated/i)).toBeInTheDocument();
    expect(screen.getByText(/updated today at/i)).toBeInTheDocument();
  });

  it("shows the last successful update when a refresh fails", () => {
    render(
      <PriceStatus status="error" lastUpdated="2026-06-18T16:41:00.000Z" />
    );

    expect(
      screen.getByText(/live prices are temporarily unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/showing the last successful update from/i)
    ).toBeInTheDocument();
  });

  it("shows a retry message when no successful refresh has happened yet", () => {
    render(<PriceStatus status="error" lastUpdated={null} />);

    expect(
      screen.getByText(/we will try again automatically in about a minute/i)
    ).toBeInTheDocument();
  });
});
