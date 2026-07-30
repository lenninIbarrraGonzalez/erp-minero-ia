import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge variant="positive">Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  describe("variant: positive", () => {
    it("applies positive text color class", () => {
      render(
        <Badge variant="positive" data-testid="badge">
          +5%
        </Badge>
      );
      const el = screen.getByTestId("badge");
      expect(el.className).toContain("text-positive");
    });

    it("applies light positive background", () => {
      render(
        <Badge variant="positive" data-testid="badge">
          +5%
        </Badge>
      );
      const el = screen.getByTestId("badge");
      expect(el.className).toContain("bg-[#E6F4EF]");
    });
  });

  describe("variant: negative", () => {
    it("applies negative text color class", () => {
      render(
        <Badge variant="negative" data-testid="badge">
          -3%
        </Badge>
      );
      const el = screen.getByTestId("badge");
      expect(el.className).toContain("text-negative");
    });

    it("applies light negative background", () => {
      render(
        <Badge variant="negative" data-testid="badge">
          -3%
        </Badge>
      );
      const el = screen.getByTestId("badge");
      expect(el.className).toContain("bg-[#FDECEA]");
    });
  });

  describe("variant: neutral", () => {
    it("applies surface-2 background and muted text", () => {
      render(
        <Badge variant="neutral" data-testid="badge">
          0%
        </Badge>
      );
      const el = screen.getByTestId("badge");
      expect(el.className).toContain("bg-surface-2");
      expect(el.className).toContain("text-text-muted");
    });
  });

  it("merges extra className", () => {
    render(
      <Badge variant="positive" className="ml-2" data-testid="badge">
        ok
      </Badge>
    );
    expect(screen.getByTestId("badge").className).toContain("ml-2");
  });
});
