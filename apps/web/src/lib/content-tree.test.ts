import { describe, expect, it } from "vitest";
import {
  buildFocusTerms,
  collectContentNodes,
  findFirstContentNode,
  findNodeById,
  findPathToNode,
  getContentNodeMaterialKey,
  getPreferredLearningNode,
  hasStudyContent,
  isLearnableContentNode,
  isPracticeEligibleContentNode,
  isStudyEligibleContentNode,
} from "./content-tree";
import type { ContentNode } from "@/lib/api";

const tree: ContentNode[] = [
  {
    id: "chapter-1",
    title: "Chapter 1",
    type: "section",
    content: "",
    level: 1,
    order_index: 0,
    source_type: "file",
    children: [
      {
        id: "node-a",
        title: "Binary Search",
        type: "topic",
        content: "How binary search works",
        level: 2,
        order_index: 0,
        source_type: "file",
        children: [],
      },
      {
        id: "node-b",
        title: "Two Pointers",
        type: "section",
        content: "",
        level: 2,
        order_index: 1,
        source_type: "file",
        children: [
          {
            id: "node-c",
            title: "Sliding Window",
            type: "topic",
            content: "Window technique notes",
            level: 3,
            order_index: 0,
            source_type: "file",
            children: [],
          },
        ],
      },
    ],
  },
];

describe("getPreferredLearningNode", () => {
  it("opens a chapter at its first lesson instead of the chapter container", () => {
    expect(getPreferredLearningNode(tree[0] as never).id).toBe("node-a");
  });
});

describe("content-tree helpers", () => {
  it("allows a short readable assessment section to display its AI note", () => {
    const section: ContentNode = {
      id: "fill-blank", title: "二、填空题", type: "section",
      content: "7. 已知角平分线，求这个角的度数。", level: 2,
      order_index: 0, source_type: "file", content_category: "assessment", children: [],
    };
    expect(isStudyEligibleContentNode(section)).toBe(true);
  });
  it("finds the first node with content", () => {
    expect(findFirstContentNode(tree)?.id).toBe("node-a");
  });

  it("finds nodes by id", () => {
    expect(findNodeById(tree, "node-c")?.title).toBe("Sliding Window");
    expect(findNodeById(tree, "missing")).toBeNull();
  });

  it("collects content nodes in traversal order", () => {
    expect(collectContentNodes(tree).map((node) => node.id)).toEqual(["node-a", "node-c"]);
  });

  it("builds the path to a nested node", () => {
    expect(findPathToNode(tree, "node-c").map((node) => node.id)).toEqual([
      "chapter-1",
      "node-b",
      "node-c",
    ]);
  });

  it("builds deduplicated focus terms from titles", () => {
    expect(buildFocusTerms(tree[0].children![1]).slice(0, 4)).toEqual([
      "two",
      "pointers",
      "sliding",
      "window",
    ]);
  });

  it("keeps textbook front matter out of learning and practice contexts", () => {
    const preface: ContentNode = { ...tree[0].children![0], id: "preface", title: "前言与目录", content: "目录\n第一章" };
    expect(isLearnableContentNode(preface)).toBe(false);
    expect(isPracticeEligibleContentNode(preface)).toBe(false);
  });

  it("keeps generic Word document sections available for learning", () => {
    const genericSection: ContentNode = {
      ...tree[0].children![0],
      id: "word-section",
      title: "调研目的",
      content: "这是从无正式目录的 Word 正文生成的学习章节。",
      content_category: "other",
      source_file: "调研内容.docx",
    };
    expect(isLearnableContentNode(genericSection)).toBe(true);
    expect(collectContentNodes([genericSection]).map((node) => node.id)).toEqual(["word-section"]);
  });

  it("requires a specific leaf lesson for practice", () => {
    const sectionWithChildren: ContentNode = { ...tree[0], content: "Chapter overview" };
    expect(isPracticeEligibleContentNode(sectionWithChildren)).toBe(false);
    expect(isPracticeEligibleContentNode({ ...tree[0].children![0], content: "二分查找通过反复比较中间元素缩小搜索范围。".repeat(5) })).toBe(true);
  });

  it("keeps a business report readable without offering study generation", () => {
    const report: ContentNode = {
      ...tree[0].children![0],
      content: "作品数量和账号表现的原始分析内容。".repeat(8),
      source_file: "陕西某公司作品情况分析.docx",
      content_category: "notes",
    };
    expect(isLearnableContentNode(report)).toBe(true);
    expect(hasStudyContent([report])).toBe(false);
    expect(isPracticeEligibleContentNode(report)).toBe(false);
  });

  it("resolves material context from an ancestor for older imported trees", () => {
    const materialTree: ContentNode[] = [{
      ...tree[0], id: "book", source_file: "数学上册.pdf", children: [{
        ...tree[0].children![0], id: "lesson", source_file: null,
      }],
    }];
    expect(getContentNodeMaterialKey(materialTree, "lesson")).toBe("数学上册.pdf");
  });
});
