import './Main.css';
import 'katex/dist/katex.css';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
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
} from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { useEffect } from 'react';
import { $generateNodesFromDOM } from '@lexical/html';

import ExampleTheme from './ExampleTheme';
import { tableCellExportDOMPreserveAutoWidth } from './htmlExportTableCell';
import { ImageNode } from './nodes/ImageNode';
import { EquationNode } from './nodes/EquationNode';
import { parseAllowedColor, parseAllowedFontSize } from './styleConfig';

interface ReadOnlyLexicalProps {
  value?: string;
  placeholder?: string;
  className?: string;
  editorType?: 'question' | 'option' | 'default';
  showToolbarSpacer?: boolean;
}

const removeStylesExportDOM = (editor: LexicalEditor, target: LexicalNode): DOMExportOutput => {
  const blockIndent = $isElementNode(target) ? target.getIndent() : 0;
  const output = target.exportDOM(editor);
  if (output && isHTMLElement(output.element)) {
    for (const el of [output.element, ...output.element.querySelectorAll('[style],[class]')]) {
      const textAlign = (el as HTMLElement).style.textAlign;
      el.removeAttribute('class');
      el.removeAttribute('style');
      if (textAlign) {
        (el as HTMLElement).style.textAlign = textAlign;
      }
    }
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
  namespace: 'ReadOnlyViewer',
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
  editable: false,
};

function ContentPopulatorPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let cancelled = false;
    // Defer Lexical updates so RichTextPlugin does not call flushSync while React
    // is still committing passive effects (hydration/sync path).
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      editor.update(
        () => {
          const root = $getRoot();
          root.clear();
          // Import whenever non-empty string is passed; avoid trim-only skip so e.g. minimal HTML still loads.
          if (content != null && content !== '') {
            const parser = new DOMParser();
            const dom = parser.parseFromString(content, 'text/html');
            // Lexical HTML import collapses space runs unless an inline `white-space: pre*` ancestor exists.
            if (dom.body) {
              dom.body.style.whiteSpace = 'pre-wrap';
            }
            const nodes = $generateNodesFromDOM(editor, dom);
            // Root only accepts element or decorator nodes. Wrap any bare text/inline
            // nodes in a paragraph so they can be safely appended to root.
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
        { discrete: true },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [content, editor]);

  return null;
}

const READONLY_EDITOR_CLASSES = {
  question: {
    container: 'editor-container',
    inner: 'editor-inner',
    input: 'editor-input-question',
    placeholder: 'editor-placeholder-option',
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

export default function ReadOnlyLexical({
  value = '',
  placeholder = '',
  className = '',
  editorType = 'default',
  showToolbarSpacer = false,
}: ReadOnlyLexicalProps) {
  const classes = READONLY_EDITOR_CLASSES[editorType];
  const wrapperClass = classes.container
    ? `lexical-wrapper ${classes.container} ${className || ''}`.trim()
    : `lexical-wrapper ${className || ''}`.trim();
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className={wrapperClass}>
        {showToolbarSpacer && <div className="toolbar-spacer" />}
        <div className={classes.inner}>
          <RichTextPlugin
            contentEditable={<ContentEditable className={classes.input} spellCheck={false} />}
            placeholder={<div className={classes.placeholder}>{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <ContentPopulatorPlugin content={value} />
          <TablePlugin hasHorizontalScroll />
        </div>
      </div>
    </LexicalComposer>
  );
}
