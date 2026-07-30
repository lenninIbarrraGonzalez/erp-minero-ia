import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  describe("variant: primary (default)", () => {
    it("renders children text", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("applies primary background class", () => {
      render(<Button data-testid="btn">Save</Button>);
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("bg-primary");
    });

    it("applies primary contrast text class", () => {
      render(<Button data-testid="btn">Save</Button>);
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("text-primary-contrast");
    });
  });

  describe("variant: secondary", () => {
    it("applies secondary surface class", () => {
      render(
        <Button variant="secondary" data-testid="btn">
          Cancel
        </Button>
      );
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("bg-surface");
      expect(btn.className).toContain("border-border");
    });

    it("does not apply primary background class", () => {
      render(
        <Button variant="secondary" data-testid="btn">
          Cancel
        </Button>
      );
      const btn = screen.getByTestId("btn");
      expect(btn.className).not.toContain("bg-primary");
    });
  });

  describe("variant: ghost", () => {
    it("applies ghost text class without primary background", () => {
      render(
        <Button variant="ghost" data-testid="btn">
          Ghost
        </Button>
      );
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("text-primary");
      expect(btn.className).not.toContain("bg-primary");
    });
  });

  describe("size", () => {
    it("applies md size class by default", () => {
      render(<Button data-testid="btn">Save</Button>);
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("px-4");
    });

    it("applies sm size class when size='sm'", () => {
      render(
        <Button size="sm" data-testid="btn">
          Small
        </Button>
      );
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("px-3");
    });
  });

  describe("disabled", () => {
    it("does not call onClick when disabled", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick} data-testid="btn">
          Save
        </Button>
      );
      await user.click(screen.getByTestId("btn"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("applies opacity class when disabled", () => {
      render(
        <Button disabled data-testid="btn">
          Save
        </Button>
      );
      const btn = screen.getByTestId("btn");
      expect(btn.className).toContain("opacity-50");
    });

    it("has disabled attribute when disabled", () => {
      render(
        <Button disabled data-testid="btn">
          Save
        </Button>
      );
      expect(screen.getByTestId("btn")).toBeDisabled();
    });
  });

  it("merges extra className", () => {
    render(
      <Button className="my-custom-class" data-testid="btn">
        Styled
      </Button>
    );
    expect(screen.getByTestId("btn").className).toContain("my-custom-class");
  });

  it("forwards onClick handler", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole("button", { name: "Click" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
