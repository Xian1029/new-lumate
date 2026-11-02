import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { countQuestionBlanks, FillBlankAnswer } from "./fill-blank-answer";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <FillBlankAnswer question="上升____米，记作（ ）；下降____米，记作（ ）。" value={value} onChange={setValue} />
      <output data-testid="fill-value">{value}</output>
    </>
  );
}

describe("FillBlankAnswer", () => {
  it("detects common blank markers", () => {
    expect(countQuestionBlanks("填写____和（ ）")).toBe(2);
    expect(countQuestionBlanks("直接填写答案")).toBe(1);
  });

  it("keeps multiple blanks separate in the backend-compatible value", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("第 1 空"), "3");
    await user.type(screen.getByLabelText("第 2 空"), "+3");
    expect(screen.getByTestId("fill-value")).toHaveTextContent("3；+3");
  });
});
