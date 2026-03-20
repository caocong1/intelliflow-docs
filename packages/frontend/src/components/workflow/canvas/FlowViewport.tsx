import type { JSX } from "solid-js";

type FlowViewportProps = {
  panX: number;
  panY: number;
  zoom: number;
  children: JSX.Element;
};

export default function FlowViewport(props: FlowViewportProps) {
  return (
    <div
      style={{
        transform: `translate(${props.panX}px, ${props.panY}px) scale(${props.zoom})`,
        "transform-origin": "0 0",
        position: "absolute",
        top: "0",
        left: "0",
        width: "10000px",
        height: "10000px",
      }}
    >
      {props.children}
    </div>
  );
}
