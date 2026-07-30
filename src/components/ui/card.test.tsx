import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Hello Card</Card>);
    expect(screen.getByText("Hello Card")).toBeInTheDocument();
  });

  it("renders as div by default", () => {
    render(<Card data-testid="card">content</Card>);
    const el = screen.getByTestId("card");
    expect(el.tagName.toLowerCase()).toBe("div");
  });

  it("renders as section when as='section'", () => {
    render(
      <Card as="section" data-testid="card">
        content
      </Card>
    );
    const el = screen.getByTestId("card");
    expect(el.tagName.toLowerCase()).toBe("section");
  });

  it("renders as article when as='article'", () => {
    render(
      <Card as="article" data-testid="card">
        content
      </Card>
    );
    const el = screen.getByTestId("card");
    expect(el.tagName.toLowerCase()).toBe("article");
  });

  it("applies base surface classes", () => {
    render(<Card data-testid="card">content</Card>);
    const el = screen.getByTestId("card");
    expect(el.className).toContain("bg-surface");
    expect(el.className).toContain("border-border");
  });

  it("merges extra className with base classes", () => {
    render(
      <Card className="mt-4 p-8" data-testid="card">
        content
      </Card>
    );
    const el = screen.getByTestId("card");
    expect(el.className).toContain("mt-4");
    expect(el.className).toContain("p-8");
    expect(el.className).toContain("bg-surface");
  });
});
