import { cn } from "@/lib/utils"

/** A KPI number that pops in digit by digit: the transitions.dev number
 *  pop-in (app/transitions.css). The last two characters ride in a beat
 *  behind the others, as the snippet documents (data-stagger 1 and 2).
 *
 *  It replays whenever the text changes: the group is keyed by the text, so
 *  a new value is a new element and the CSS animation starts again (the
 *  snippet's "remove the class, reflow, add it back", done by React). A
 *  space becomes a no-break space so it keeps its width inside an
 *  inline-block digit. "Reduce motion" is handled by the snippet itself. */
export function PopNumber({ value, className }: { value: string | number; className?: string }) {
  const text = String(value)
  const chars = Array.from(text)

  return (
    <span key={text} className={cn("t-digit-group is-animating", className)}>
      {chars.map((char, index) => (
        <span
          key={index}
          className="t-digit"
          data-stagger={index === chars.length - 2 ? "1" : index === chars.length - 1 ? "2" : undefined}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  )
}
