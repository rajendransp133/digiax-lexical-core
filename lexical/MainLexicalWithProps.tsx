import './Main.css';

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $isTextNode,
  $isElementNode,
  $isDecoratorNode,
  $createParagraphNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type DOMExportOutputMap,
  isHTMLElement,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  ParagraphNode,
  TextNode,
  $getRoot,
  // PASTE_COMMAND,
  // COMMAND_PRIORITY_HIGH,
} from 'lexical';

import ExampleTheme from './ExampleTheme';
import { tableCellExportDOMPreserveAutoWidth } from './htmlExportTableCell';
import ToolbarPlugin from './Plugins/ToolbarPlugin';
import { parseAllowedColor, parseAllowedFontSize } from './styleConfig';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import TabKeyPlugin from './Plugins/TabKeyPlugin';
import { HeadingNode } from '@lexical/rich-text';
import { ListNode } from '@lexical/list';
import { ListItemNode } from '@lexical/list';
import { QuoteNode } from '@lexical/rich-text';
import { ImageNode } from './nodes/ImageNode';
import ImagesPlugin from './Plugins/ImagePlugin';
import { EquationNode } from './nodes/EquationNode';
import EquationsPlugin from './Plugins/EquationPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { useEffect, useRef } from 'react';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';

export type EditorType = 'question' | 'option' | 'default';

interface MainLexicalWithPropsProps {
  value?: string;
  onChange?: (htmlContent: string) => void;
  placeholder?: string;
  editorType?: EditorType;
  /** When true (default), Lexical auto-focuses the editor (may scroll the page). Set false for e.g. translator navigation. */
  autoFocus?: boolean;
}

const removeStylesExportDOM = (editor: LexicalEditor, target: LexicalNode): DOMExportOutput => {
  const blockIndent = $isElementNode(target) ? target.getIndent() : 0;
  const output = target.exportDOM(editor);
  if (output && isHTMLElement(output.element)) {
    // Remove all inline styles and classes if the element is an HTMLElement
    // Children are checked as well since TextNode can be nested
    // in i, b, and strong tags.
    for (const el of [output.element, ...output.element.querySelectorAll('[style],[class]')]) {
      // Preserve text-align style before removing all styles
      const textAlign = (el as HTMLElement).style.textAlign;
      el.removeAttribute('class');
      el.removeAttribute('style');
      // Restore text-align if it was present
      if (textAlign) {
        (el as HTMLElement).style.textAlign = textAlign;
      }
    }
    // TabIndentationPlugin block indent is exported as padding-inline-start; do not strip it
    // (matches Lexical ElementNode.exportDOM: indent * 40px; import reads the same).
    if (blockIndent > 0) {
      output.element.style.paddingInlineStart = `${blockIndent * 40}px`;
    }
  }
  return output;
};

const exportMap: DOMExportOutputMap = new Map<
  Klass<LexicalNode>,
  (editor: LexicalEditor, target: LexicalNode) => DOMExportOutput
>([
  [ParagraphNode, removeStylesExportDOM],
  [TextNode, removeStylesExportDOM],
  [TableCellNode, tableCellExportDOMPreserveAutoWidth],
]);

const getExtraStyles = (element: HTMLElement): string => {
  let extraStyles = '';
  const fontSize = parseAllowedFontSize(element.style.fontSize);
  const backgroundColor = parseAllowedColor(element.style.backgroundColor);
  const color = parseAllowedColor(element.style.color);
  const textAlign = element.style.textAlign;

  if (fontSize !== '' && fontSize !== '15px') {
    extraStyles += `font-size: ${fontSize};`;
  }
  if (backgroundColor !== '' && backgroundColor !== 'rgb(255, 255, 255)') {
    extraStyles += `background-color: ${backgroundColor};`;
  }
  if (color !== '' && color !== 'rgb(0, 0, 0)') {
    extraStyles += `color: ${color};`;
  }
  if (textAlign && textAlign !== 'start' && textAlign !== 'left') {
    extraStyles += `text-align: ${textAlign};`;
  }
  return extraStyles;
};

const constructImportMap = (): DOMConversionMap => {
  const importMap: DOMConversionMap = {};

  // Wrap all TextNode importers with a function that also imports
  // the custom styles implemented by the playground
  for (const [tag, fn] of Object.entries(TextNode.importDOM() || {})) {
    importMap[tag] = (importNode) => {
      const importer = fn(importNode);
      if (!importer) {
        return null;
      }
      return {
        ...importer,
        conversion: (element) => {
          const output = importer.conversion(element);
          if (output === null || output.forChild === undefined || output.after !== undefined || output.node !== null) {
            return output;
          }
          const extraStyles = getExtraStyles(element);
          if (extraStyles) {
            const { forChild } = output;
            return {
              ...output,
              forChild: (child, parent) => {
                const textNode = forChild(child, parent);
                if ($isTextNode(textNode)) {
                  textNode.setStyle(textNode.getStyle() + extraStyles);
                }
                return textNode;
              },
            };
          }
          return output;
        },
      };
    };
  }

  return importMap;
};

const editorConfig = {
  html: {
    export: exportMap,
    import: constructImportMap(),
  },
  namespace: 'React.js Demo',
  nodes: [
    ParagraphNode,
    TextNode,
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    ImageNode,
    EquationNode,
    TableNode,
    TableCellNode,
    TableRowNode,
  ],
  onError(error: Error) {
    throw error;
  },
  theme: ExampleTheme,
};

function ContentPopulatorPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  const prevContentRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevContentRef.current;
    prevContentRef.current = content;

    let currentHtml = '';
    editor.getEditorState().read(() => {
      currentHtml = $generateHtmlFromNodes(editor, null);
    });

    const isFirstRun = prev === null;
    const propsChanged = prev !== content;
    const editorMatchesProp = currentHtml === content;
    // First mount: always apply (matches Create QP navigation). Later: only when the `value`
    // prop changed from outside and the editor is not already showing that HTML (avoids
    // wiping Lexical while the user types, which would also clear selection).
    if (!isFirstRun && (!propsChanged || editorMatchesProp)) {
      return;
    }

    editor.update(
      () => {
        const root = $getRoot();
        root.clear();

        if (content != null && content !== '') {
          const parser = new DOMParser();
          const dom = parser.parseFromString(content, 'text/html');
          // Lexical HTML import collapses space runs unless an inline `white-space: pre*` ancestor exists.
          if (dom.body) {
            dom.body.style.whiteSpace = 'pre-wrap';
          }
          const nodes = $generateNodesFromDOM(editor, dom);
          if (nodes.length > 0) {
            const rootNodes: LexicalNode[] = [];
            let pendingInline: LexicalNode[] = [];

            const flushPending = () => {
              if (pendingInline.length > 0) {
                const para = $createParagraphNode();
                para.append(...(pendingInline as Parameters<typeof para.append>));
                rootNodes.push(para);
                pendingInline = [];
              }
            };

            for (const node of nodes) {
              if ($isElementNode(node) || $isDecoratorNode(node)) {
                flushPending();
                rootNodes.push(node);
              } else {
                pendingInline.push(node);
              }
            }
            flushPending();

            if (rootNodes.length > 0) {
              root.append(...(rootNodes as Parameters<typeof root.append>));
            }
          }
        }
      },
      {
        discrete: true,
      },
    );
  }, [content, editor]);

  return null;
}

function ContentChangePlugin({ onChange }: { onChange?: (htmlContent: string) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onChange) return;

    const unregisterListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const htmlContent = $generateHtmlFromNodes(editor, null);
        onChange(htmlContent);
      });
    });

    return unregisterListener;
  }, [editor, onChange]);

  return null;
}

// function DisableCopyPastePlugin() {
//   const [editor] = useLexicalComposerContext();

//   useEffect(() => {
//     const rootElement = editor.getRootElement();
//     if (!rootElement) return;

//     // Prevent copy, cut, and paste using native DOM events
//     const preventCopy = (e: ClipboardEvent) => {
//       e.preventDefault();
//       e.stopPropagation();
//     };

//     const preventCut = (e: ClipboardEvent) => {
//       e.preventDefault();
//       e.stopPropagation();
//     };

//     const preventPaste = (e: ClipboardEvent) => {
//       e.preventDefault();
//       e.stopPropagation();
//     };

//     // Add event listeners to the root element
//     rootElement.addEventListener('copy', preventCopy, true);
//     rootElement.addEventListener('cut', preventCut, true);
//     rootElement.addEventListener('paste', preventPaste, true);

//     // Also register Lexical commands as a backup
//     const removePasteListener = editor.registerCommand(PASTE_COMMAND, () => true, COMMAND_PRIORITY_HIGH);

//     return () => {
//       // Clean up event listeners
//       rootElement.removeEventListener('copy', preventCopy, true);
//       rootElement.removeEventListener('cut', preventCut, true);
//       rootElement.removeEventListener('paste', preventPaste, true);
//       removePasteListener();
//     };
//   }, [editor]);

//   return null;
// }

const EDITOR_CLASSES: Record<EditorType, { container: string; inner: string; input: string; placeholder: string }> = {
  question: {
    container: 'editor-container',
    inner: 'editor-inner',
    input: 'editor-input-question',
    placeholder: 'editor-placeholder',
  },
  option: {
    container: 'editor-container-option',
    inner: 'editor-inner-option',
    input: 'editor-input-option',
    placeholder: 'editor-placeholder-option',
  },
  default: {
    container: '',
    inner: 'editor-inner',
    input: 'editor-input',
    placeholder: 'editor-placeholder',
  },
};

function MainLexicalWithProps({
  value = '',
  onChange,
  placeholder = 'Enter some rich text...',
  editorType = 'default',
  autoFocus = true,
}: MainLexicalWithPropsProps) {
  const classes = EDITOR_CLASSES[editorType];
  const containerClass = classes.container ? `lexical-wrapper ${classes.container}` : 'lexical-wrapper';

  return (
    <>
      <LexicalComposer initialConfig={editorConfig}>
        <div className={containerClass}>
          <ToolbarPlugin />
          <div className={classes.inner}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={classes.input}
                  aria-placeholder={placeholder}
                  placeholder={<div className={classes.placeholder}>{placeholder}</div>}
                  spellCheck={true}
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            {autoFocus ? <AutoFocusPlugin /> : null}
            <ListPlugin />
            <TabKeyPlugin />
            <TabIndentationPlugin maxIndent={7} />
            <ImagesPlugin />
            <EquationsPlugin />
            <TablePlugin hasHorizontalScroll />
            <ContentPopulatorPlugin content={value} />
            <ContentChangePlugin onChange={onChange} />
            {/* <DisableCopyPastePlugin /> */}
          </div>
        </div>
      </LexicalComposer>
    </>
  );
}

export default MainLexicalWithProps;
