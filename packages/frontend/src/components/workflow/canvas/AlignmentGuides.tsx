import { For } from "solid-js";
import type { Guide } from "../../../lib/flow-engine/alignment";

type AlignmentGuidesProps = {
  guides: Guide[];
};

/**
 * Renders SVG alignment guide lines during node drag.
 * Vertical guides are vertical lines at a given X position.
 * Horizontal guides are horizontal lines at a given Y position.
 */
export default function AlignmentGuides(props: AlignmentGuidesProps) {
  return (
    <For each={props.guides}>
      {(guide) => {
        if (guide.type === "vertical") {
          return (
            <line
              x1={guide.position}
              y1={-10000}
              x2={guide.position}
              y2={10000}
              stroke="#6366f1"
              stroke-width={1}
              stroke-dasharray="4 2"
              opacity={0.6}
              style={{ "pointer-events": "none" }}
            />
          );
        }
        return (
          <line
            x1={-10000}
            y1={guide.position}
            x2={10000}
            y2={guide.position}
            stroke="#6366f1"
            stroke-width={1}
            stroke-dasharray="4 2"
            opacity={0.6}
            style={{ "pointer-events": "none" }}
          />
        );
      }}
    </For>
  );
}
