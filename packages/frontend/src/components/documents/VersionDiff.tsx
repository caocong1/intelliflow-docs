import { For, Show } from "solid-js";
import type { VersionDiffLine, VersionDiffResult } from "@intelliflow/shared";

type VersionDiffProps = {
  diffResult: VersionDiffResult;
};

function DiffLine(props: { line: VersionDiffLine }) {
  const bgClass = () => {
    switch (props.line.type) {
      case "added":
        return "bg-green-50";
      case "removed":
        return "bg-red-50";
      default:
        return "";
    }
  };

  const textClass = () => {
    switch (props.line.type) {
      case "added":
        return "text-green-700";
      case "removed":
        return "text-red-700";
      default:
        return "text-gray-700";
    }
  };

  const prefix = () => {
    switch (props.line.type) {
      case "added":
        return "+";
      case "removed":
        return "-";
      default:
        return " ";
    }
  };

  return (
    <div class={`flex text-xs font-mono leading-5 ${bgClass()}`}>
      {/* Old line number */}
      <span class="w-10 text-right pr-2 text-gray-400 select-none flex-shrink-0">
        {props.line.oldLineNumber ?? ""}
      </span>
      {/* New line number */}
      <span class="w-10 text-right pr-2 text-gray-400 select-none flex-shrink-0">
        {props.line.newLineNumber ?? ""}
      </span>
      {/* Prefix and content */}
      <span class={`flex-1 px-2 whitespace-pre-wrap break-all ${textClass()}`}>
        <span class="select-none">{prefix()}</span>
        {props.line.content}
      </span>
    </div>
  );
}

export default function VersionDiff(props: VersionDiffProps) {
  const fieldKeys = () => Object.keys(props.diffResult.diffs);

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
        <div class="text-sm">
          <span class="font-medium text-red-600">
            版本 {props.diffResult.versionA.versionNumber}
          </span>
          <span class="text-gray-400 mx-2">({props.diffResult.versionA.nodeLabel})</span>
        </div>
        <span class="text-gray-400 text-sm">vs</span>
        <div class="text-sm">
          <span class="font-medium text-green-600">
            版本 {props.diffResult.versionB.versionNumber}
          </span>
          <span class="text-gray-400 mx-2">({props.diffResult.versionB.nodeLabel})</span>
        </div>
      </div>

      {/* Diff sections by field */}
      <For each={fieldKeys()}>
        {(key) => (
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span class="text-sm font-medium text-gray-700">{key}</span>
            </div>
            <div class="max-h-96 overflow-y-auto">
              <For each={props.diffResult.diffs[key]}>
                {(line) => <DiffLine line={line} />}
              </For>
            </div>
          </div>
        )}
      </For>

      <Show when={fieldKeys().length === 0}>
        <p class="text-sm text-gray-400 text-center py-8">无差异内容</p>
      </Show>
    </div>
  );
}
