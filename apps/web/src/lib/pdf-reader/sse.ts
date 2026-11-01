export interface PdfStreamEvent {
  event: string;
  data: string;
}

/** Consume complete SSE records while retaining a record split across reads. */
export function takePdfStreamEvents(buffer: string): { events: PdfStreamEvent[]; remainder: string } {
  const events: PdfStreamEvent[] = [];
  const boundary = /(?:\r\n|\n){2}/g;
  let consumed = 0;
  let match: RegExpExecArray | null;

  while ((match = boundary.exec(buffer)) !== null) {
    const record = buffer.slice(consumed, match.index);
    consumed = boundary.lastIndex;
    let event = "message";
    const data: string[] = [];
    for (const line of record.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length) events.push({ event, data: data.join("\n") });
  }

  return { events, remainder: buffer.slice(consumed) };
}
