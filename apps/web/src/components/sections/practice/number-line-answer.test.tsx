import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  isNumberLineDrawingQuestion,
  NumberLineAnswer,
  parseNumberLineAnswer,
} from "./number-line-answer";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <NumberLineAnswer value={value} onChange={setValue} />
      <output data-testid="answer-value">{value}</output>
    </>
  );
}

describe("NumberLineAnswer", () => {
  it("only activates for number-line drawing questions", () => {
    expect(isNumberLineDrawingQuestion("画出数轴，并在数轴上表示 -2 和 3/4。")).toBe(true);
    expect(isNumberLineDrawingQuestion("在数轴上标出下列各数。")).toBe(true);
    expect(isNumberLineDrawingQuestion("说明什么是数轴。")).toBe(false);
  });

  it("serializes clicked and fractional points for the existing grader", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "标记-2" }));
    await user.type(screen.getByLabelText("要标记的数值"), "3/4");
    await user.click(screen.getByRole("button", { name: "添加到数轴" }));

    const answer = screen.getByTestId("answer-value").textContent ?? "";
    expect(parseNumberLineAnswer(answer)).toEqual(["-2", "3/4"]);
    expect(answer).toContain("原点、正方向、单位长度");
  });
});
