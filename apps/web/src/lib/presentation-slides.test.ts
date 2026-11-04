import { describe, expect, it } from "vitest";
import { parsePresentationSlides } from "./presentation-slides";

describe("parsePresentationSlides", () => {
  it("turns extraction markers into ordered slides without dropping their content", () => {
    const slides = parsePresentationSlides("<!-- OPENTUTOR_SLIDE:1 -->\n\n封面\n\n报告内容\n\n---\n\n<!-- OPENTUTOR_SLIDE:2 -->\n\n## 研究结论\n\n核心数据\n\n**演讲者备注：** 请核对来源");
    expect(slides).toEqual([
      { page: 1, title: "封面", body: "报告内容" },
      { page: 2, title: "研究结论", body: "核心数据\n\n**演讲者备注：** 请核对来源" },
    ]);
  });

  it("leaves documents without PowerPoint markers to the existing reader", () => {
    expect(parsePresentationSlides("普通 Word 和 TXT 正文")).toEqual([]);
  });
});
