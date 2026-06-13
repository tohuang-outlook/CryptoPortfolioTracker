import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the portfolio tracker heading", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /crypto portfolio tracker/i })
  ).toBeInTheDocument();
});
