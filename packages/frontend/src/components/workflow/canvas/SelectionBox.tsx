import { Show } from "solid-js";

type SelectionBoxProps = {
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  visible: boolean;
};

export default function SelectionBox(props: SelectionBoxProps) {
  const x = () => Math.min(props.startPos.x, props.currentPos.x);
  const y = () => Math.min(props.startPos.y, props.currentPos.y);
  const width = () => Math.abs(props.currentPos.x - props.startPos.x);
  const height = () => Math.abs(props.currentPos.y - props.startPos.y);

  return (
    <Show when={props.visible}>
      <rect
        x={x()}
        y={y()}
        width={width()}
        height={height()}
        fill="rgba(99, 102, 241, 0.1)"
        stroke="#6366f1"
        stroke-width="1"
        stroke-dasharray="4 2"
        style={{ "pointer-events": "none" }}
      />
    </Show>
  );
}
