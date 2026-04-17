import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INSERT_TAB_COMMAND,
  KEY_TAB_COMMAND,
  TabNode,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useEffect } from 'react';

/** Spaces per Tab (≈ common 8-col tab stop); spaces avoid messy TabNode HTML export. */
const EDITOR_TAB_INDENT = '        ';

function insertIndentInUpdate() {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertText(EDITOR_TAB_INDENT);
    return;
  }
  $insertNodes([$createTextNode(EDITOR_TAB_INDENT)]);
}

/**
 * - TabIndentationPlugin uses INSERT_TAB_COMMAND for “type a tab” cases; we replace that with spaces at HIGH priority.
 * - KEY_TAB edge cases (no selection / empty doc) also insert spaces, not Lexical TabNode.
 */
function TabKeyPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerNodeTransform(TabNode, (node) => {
        node.replace($createTextNode(EDITOR_TAB_INDENT));
      }),
      editor.registerCommand(
        INSERT_TAB_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }
          selection.insertText(EDITOR_TAB_INDENT);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const selection = $getSelection();

          if (event.shiftKey && (!selection || !$isRangeSelection(selection))) {
            return false;
          }

          if (selection != null && !$isRangeSelection(selection)) {
            return false;
          }

          if (!selection || !$isRangeSelection(selection)) {
            event.preventDefault();
            editor.update(() => insertIndentInUpdate());
            return true;
          }

          const root = $getRoot();
          const isEmpty =
            root.getChildrenSize() === 1 &&
            root.getFirstChild()?.getTextContentSize() === 0;
          if (isEmpty && !event.shiftKey) {
            event.preventDefault();
            editor.update(() => insertIndentInUpdate());
            return true;
          }

          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);

  return null;
}

export default TabKeyPlugin;
