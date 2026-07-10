// Parses **double asterisk** markdown-lite bold segments out of a plain
// string and renders them as <strong>, so the one scannable/emphasized part
// of a sentence stands out from the rest. Always wraps in a single <span>
// (never a bare Fragment): inside a flex container, a Fragment's children
// each become their own flex item and wrap independently, breaking the
// sentence into a disjointed multi-column layout instead of one flowing line.
export function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </span>
  );
}
