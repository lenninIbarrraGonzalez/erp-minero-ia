import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const map: Record<string, string> = {
      placeholder: "Ask a question...",
      submit: "Send",
      examplesLabel: "Examples",
    };
    const t = (key: string) => map[key] ?? key;
    t.raw = (key: string) => {
      if (key === "examples") return ["Example question 1", "Example question 2"];
      return [];
    };
    return t;
  },
}));

const { QueryInput } = await import("./query-input");

describe("QueryInput", () => {
  it("renders a text input", () => {
    render(<QueryInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<QueryInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("submit button uses Button primary variant — no amber classes", () => {
    render(<QueryInput onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Send" });
    expect(btn.className).not.toContain("amber");
    expect(btn.className).toContain("bg-primary");
  });

  it("calls onSubmit with trimmed input value on form submit", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<QueryInput onSubmit={handleSubmit} />);

    await user.type(screen.getByRole("textbox"), "  hello world  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(handleSubmit).toHaveBeenCalledWith("hello world");
  });

  it("does not call onSubmit when input is empty", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<QueryInput onSubmit={handleSubmit} />);

    // button is disabled when empty, so click won't trigger submit
    const btn = screen.getByRole("button", { name: "Send" });
    expect(btn).toBeDisabled();
    await user.click(btn);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("disables input and button when disabled=true", () => {
    render(<QueryInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  // E1: Char counter
  it("does not render char counter when value is under 400 chars", async () => {
    const user = userEvent.setup();
    render(<QueryInput onSubmit={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "short text");
    expect(screen.queryByTestId("char-counter")).not.toBeInTheDocument();
  });

  it("renders char counter with yellow style when value is between 401 and 499 chars", async () => {
    render(<QueryInput onSubmit={vi.fn()} value={"a".repeat(420)} onValueChange={vi.fn()} />);
    const counter = screen.getByTestId("char-counter");
    expect(counter).toBeInTheDocument();
    expect(counter).toHaveTextContent("420/500");
    expect(counter.className).toContain("yellow");
  });

  it("renders char counter with red style when value is at 500 chars", async () => {
    render(<QueryInput onSubmit={vi.fn()} value={"a".repeat(500)} onValueChange={vi.fn()} />);
    const counter = screen.getByTestId("char-counter");
    expect(counter).toBeInTheDocument();
    expect(counter).toHaveTextContent("500/500");
    expect(counter.className).toContain("red");
  });

  it("accepts value and onValueChange props for controlled mode", async () => {
    const handleChange = vi.fn();
    render(<QueryInput onSubmit={vi.fn()} value="controlled" onValueChange={handleChange} />);
    expect(screen.getByRole("textbox")).toHaveValue("controlled");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new" } });
    expect(handleChange).toHaveBeenCalledWith("new");
  });
});
