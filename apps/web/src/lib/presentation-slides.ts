export interface PresentationSlide {
  page: number;
  title: string;
  body: string;
}

/** Only PowerPoint extraction uses these page markers. Keep the source wording intact. */
export function parsePresentationSlides(content: string): PresentationSlide[] {
  const marker = /<!--\s*OPENTUTOR_SLIDE:(\d+)\s*-->/g;
  const matches = [...content.matchAll(marker)];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const raw = content.slice(start, end).replace(/\s*---\s*$/, "").trim();
    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const titleIndex = lines.findIndex((line) => line !== "---" && !/^\*\*演讲者备注/.test(line));
    const title = titleIndex >= 0 ? lines[titleIndex].replace(/^#{1,6}\s*/, "") : `第 ${match[1]} 页`;
    const body = lines.filter((_, lineIndex) => lineIndex !== titleIndex && lines[lineIndex] !== "---").join("\n\n");
    return { page: Number(match[1]), title, body };
  });
}
