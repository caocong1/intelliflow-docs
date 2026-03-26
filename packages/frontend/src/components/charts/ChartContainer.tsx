import { createEffect, onCleanup, onMount } from "solid-js";
import { echarts, type EChartsCoreOption } from "../../lib/echarts";

interface ChartContainerProps {
  class?: string;
  option: () => EChartsCoreOption;
}

export default function ChartContainer(props: ChartContainerProps) {
  let el: HTMLDivElement | undefined;
  let chart: ReturnType<typeof echarts.init> | undefined;
  let observer: ResizeObserver | undefined;

  onMount(() => {
    if (!el) return;
    chart = echarts.init(el);
    chart.setOption(props.option());

    observer = new ResizeObserver(() => chart?.resize());
    observer.observe(el);
  });

  createEffect(() => {
    chart?.setOption(props.option(), true);
  });

  onCleanup(() => {
    observer?.disconnect();
    chart?.dispose();
  });

  return <div ref={el} class={props.class ?? "w-full h-64"} />;
}
