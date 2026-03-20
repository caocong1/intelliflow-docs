import type { Viewport } from "../../../lib/flow-engine/types";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

type FlowControlsProps = {
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  fitView: () => void;
};

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

export default function FlowControls(props: FlowControlsProps) {
  function zoomIn() {
    const v = props.viewport;
    const newZoom = clamp(v.zoom * 1.1, MIN_ZOOM, MAX_ZOOM);
    props.setViewport({ ...v, zoom: newZoom });
  }

  function zoomOut() {
    const v = props.viewport;
    const newZoom = clamp(v.zoom * 0.9, MIN_ZOOM, MAX_ZOOM);
    props.setViewport({ ...v, zoom: newZoom });
  }

  function resetZoom() {
    const v = props.viewport;
    props.setViewport({ ...v, zoom: 1 });
  }

  return (
    <div class="absolute bottom-4 left-4 flex flex-col gap-1 bg-white rounded-lg shadow-md border border-slate-200 p-1 z-20">
      <button
        type="button"
        onClick={zoomIn}
        class="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        title="放大"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <title>放大</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={zoomOut}
        class="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        title="缩小"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <title>缩小</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
        </svg>
      </button>
      <div class="w-full h-px bg-slate-200" />
      <button
        type="button"
        onClick={resetZoom}
        class="w-8 h-8 flex items-center justify-center rounded text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        title="重置缩放"
      >
        1:1
      </button>
      <button
        type="button"
        onClick={() => props.fitView()}
        class="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        title="适应视图"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <title>适应视图</title>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  );
}
