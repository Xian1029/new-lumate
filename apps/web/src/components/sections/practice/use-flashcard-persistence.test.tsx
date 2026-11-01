import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlashcardPersistence } from "./use-quiz-persistence";

describe("useFlashcardPersistence", () => {
  beforeEach(() => localStorage.clear());

  it("restores the exact card position and face after switching between compact and full-page views", () => {
    const compact = renderHook(() => useFlashcardPersistence("course-1", "node-1"));
    act(() => compact.result.current.save({
      index: 7,
      reviewedCount: 7,
      flipped: true,
      cards: Array.from({ length: 20 }, (_, index) => ({ id: `card-${index}` })),
    }));
    compact.unmount();

    const fullPage = renderHook(() => useFlashcardPersistence("course-1", "node-1"));
    expect(fullPage.result.current.load()).toMatchObject({ index: 7, reviewedCount: 7, flipped: true });
    fullPage.unmount();

    const compactAgain = renderHook(() => useFlashcardPersistence("course-1", "node-1"));
    expect(compactAgain.result.current.load()).toMatchObject({ index: 7, reviewedCount: 7, flipped: true });
  });

  it("does not broadcast progress to another knowledge-point session", () => {
    const nodeOne = renderHook(() => useFlashcardPersistence("course-1", "node-1"));
    const nodeTwo = renderHook(() => useFlashcardPersistence("course-1", "node-2"));
    const listener = vi.fn();
    const unsubscribe = nodeTwo.result.current.subscribe(listener);

    act(() => nodeOne.result.current.save({ index: 3, reviewedCount: 3, cards: [] }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("broadcasts the current card face to another view of the same knowledge point", () => {
    const compact = renderHook(() => useFlashcardPersistence("course-1", "node-1"));
    const fullPage = renderHook(() => useFlashcardPersistence("course-1", "node-1"));
    const listener = vi.fn();
    const unsubscribe = fullPage.result.current.subscribe(listener);

    act(() => compact.result.current.save({
      index: 2,
      reviewedCount: 2,
      flipped: true,
      cards: [{ id: "card-1" }, { id: "card-2" }, { id: "card-3" }],
    }));

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      index: 2,
      reviewedCount: 2,
      flipped: true,
    }));
    unsubscribe();
  });
});
