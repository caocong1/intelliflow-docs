import { onMount, onCleanup, createEffect } from "solid-js";
import { untrack } from "solid-js";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { ViewUpdate } from "@codemirror/view";

interface JsonSchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function JsonSchemaEditor(props: JsonSchemaEditorProps) {
  let containerRef!: HTMLDivElement;
  let view: EditorView | undefined;

  onMount(() => {
    const state = EditorState.create({
      doc: props.value || "",
      extensions: [
        basicSetup,
        json(),
        lintGutter(),
        linter(jsonParseLinter()),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            props.onChange(content);
          }
        }),
        EditorView.theme({
          "&": {
            fontSize: "13px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            minHeight: "150px",
            maxHeight: "400px",
          },
          "&.cm-focused": {
            outline: "2px solid #a78bfa",
            outlineOffset: "-1px",
          },
          ".cm-scroller": {
            overflow: "auto",
            maxHeight: "400px",
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
          },
          ".cm-content": {
            minHeight: "140px",
          },
        }),
      ],
    });

    view = new EditorView({
      state,
      parent: containerRef,
    });
  });

  // Push external value changes into the editor
  createEffect(() => {
    const newValue = props.value;
    if (!view) return;
    const currentContent = untrack(() => view!.state.doc.toString());
    if (newValue !== currentContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newValue || "",
        },
      });
    }
  });

  onCleanup(() => {
    view?.destroy();
  });

  return (
    <div
      ref={containerRef}
      class="json-schema-editor"
    />
  );
}
