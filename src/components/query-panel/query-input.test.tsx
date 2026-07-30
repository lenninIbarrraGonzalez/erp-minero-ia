import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      placeholder: "Ask a question...",
      submit: "Send",
    };
    return map[key] ?? key;
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
});
