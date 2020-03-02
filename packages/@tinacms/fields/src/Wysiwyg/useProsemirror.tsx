/**

Copyright 2019 Forestry.io Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

import * as React from 'react'
import { EditorView, NodeView } from 'prosemirror-view'
import { Plugin } from '@tinacms/core'

import { createEditorState } from './state'
import { useProsemirrorSchema } from './useProsemirrorSchema'
import { useProsemirrorTranslator } from './useProsemirrorTranslator'
import { nodeViews } from './node-views'
import { Format } from './Translator'

interface CheckableEditorView extends EditorView {
  docView: NodeView | null
}

export interface Input {
  value: string
  onChange(value: string): void
  onFocus(): void
  onBlur(): void
}

export function useProsemirror(
  input: Input,
  plugins: Plugin[] = [],
  format?: Format
) {
  /**
   * Construct the Prosemirror Schema
   */
  const [schema] = useProsemirrorSchema(plugins)

  /**
   * Create a MarkdownTranslattor based on the schema
   */
  const [translator] = useProsemirrorTranslator(schema, format)

  /**
   * A reference to the DOM Node where the prosemirror editor will be added.
   */
  const [el, setEl] = React.useState<Node>()

  const elRef = React.useCallback((nextEl: Node) => {
    if (nextEl !== el) {
      setEl(nextEl)
    }
  }, [])

  /**
   * CreateState
   */
  const createState = React.useCallback((value: string) => {
    return createEditorState(schema, translator, plugins, value)
  }, [])

  /**
   * The Prosemirror EditorView instance
   */
  const [editorView, setEditorView] = React.useState<{ view: EditorView }>()

  React.useEffect(
    function setupEditor() {
      /**
       * Exit early if the target Node has not yet been set.
       */
      if (!el) {
        return
      }

      /**
       * Create a new Prosemirror EditorView on in the DOM
       */
      const view = new EditorView(el, {
        nodeViews: nodeViews as any,
        /**
         * The initial state of the Wysiwyg
         */
        state: createState(input.value),
        /**
         * Call input.onChange with the translated content after updating
         * the Prosemiror state.
         * @param tr
         */
        dispatchTransaction(tr) {
          const nextState: any = view.state.apply(tr as any)

          view.updateState(nextState as any)
          setEditorView({ view })

          if (tr.docChanged) {
            input.onChange(translator!.stringFromNode(tr.doc))
          }
        },
      })

      setEditorView({ view })
      /**
       * Destroy the EditorView to prevent duplicates
       */
      return () => {
        setEditorView(undefined)
        if (editorView) view.destroy()
      }
    },
    /**
     * Rerender if the target Node has changed.
     */
    [el]
  )

  React.useEffect(() => {
    /**
     * The editorView may exist, even if it's docView does not.
     * Trying to updateState when the docView dne throws an error.
     */
    if (!el) return
    if (!editorView || !editorView.view) return
    if (!(editorView.view as CheckableEditorView).docView) return

    const wysiwygIsActive = el.contains(document.activeElement)

    if (!wysiwygIsActive) {
      editorView.view.updateState(createState(input.value))
    }
  }, [input.value, editorView, document])

  return { elRef, editorView, translator }
}
