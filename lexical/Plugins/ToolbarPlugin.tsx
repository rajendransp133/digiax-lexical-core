import { createPortal } from 'react-dom';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';

import { Sigma, Table2 } from 'lucide-react';

import {
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';

import { $isListNode, ListNode } from '@lexical/list';

import { $isHeadingNode } from '@lexical/rich-text';

import useModal from '../hooks/useModel';

import BlockOptionsDropdownList from './BlockOptionsDropdownList';
import AlignmentOptionsDropdownList from './AlignmentOptionsDropdownList';
import SymbolsDropdownList from './SymbolsDropdownList';
import { InsertImageDialog } from './ImagePlugin';
import { InsertEquationDialog } from './EquationPlugin';
import { InsertTableDialog } from './InsertTableDialog';

function Divider() {
  return <div className="divider" />;
}

const blockTypeToBlockName = {
  h1: 'Large Heading',
  h2: 'Small Heading',
  ol: 'Numbered List',
  paragraph: 'Normal',
  quote: 'Quote',
  ul: 'Bulleted List',
};

const alignmentTypeToAlignmentName = {
  left: 'Left Align',
  center: 'Center Align',
  right: 'Right Align',
  justify: 'Justify Align',
};

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const blockButtonRef = useRef<HTMLButtonElement>(null);
  const alignmentButtonRef = useRef<HTMLButtonElement>(null);
  const symbolsButtonRef = useRef<HTMLButtonElement>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');
  const [showBlockOptionsDropDown, setShowBlockOptionsDropDown] = useState(false);
  const [alignmentType, setAlignmentType] = useState('left');
  const [showAlignmentOptionsDropDown, setShowAlignmentOptionsDropDown] = useState(false);
  const [showSymbolsDropDown, setShowSymbolsDropDown] = useState(false);
  const [model, showModal] = useModal();
  const [activeEditor] = useState(editor);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element) ? element.getTag() : element.getType();
          setBlockType(type === 'root' ? 'paragraph' : type);
        }
      }
      // Update text format
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      // Update alignment
      if (elementDOM !== null) {
        const computedStyle = getComputedStyle(elementDOM);
        const textAlign = computedStyle.textAlign;
        setAlignmentType(
          textAlign === 'center'
            ? 'center'
            : textAlign === 'right'
              ? 'right'
              : textAlign === 'justify'
                ? 'justify'
                : 'left',
        );
      } else {
        setAlignmentType('left');
      }
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(
          () => {
            updateToolbar();
          },
          { editor },
        );
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, _newEditor) => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateToolbar]);

  return (
    <>
      {model}
      <div className="toolbar" ref={toolbarRef}>
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => {
            editor.dispatchCommand(UNDO_COMMAND, undefined);
          }}
          className="toolbar-item spaced"
          title="Undo"
          aria-label="Undo"
        >
          <i className="format undo" />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={() => {
            editor.dispatchCommand(REDO_COMMAND, undefined);
          }}
          className="toolbar-item"
          title="Redo"
          aria-label="Redo"
        >
          <i className="format redo" />
        </button>
        <Divider />

        <button
          type="button"
          ref={blockButtonRef}
          className="toolbar-item block-controls"
          onClick={() => {
            setShowBlockOptionsDropDown(!showBlockOptionsDropDown);
            setShowAlignmentOptionsDropDown(false);
            setShowSymbolsDropDown(false);
          }}
          title="Block Format"
          aria-label="Formatting Options"
        >
          <span className={'icon block-type ' + blockType} />
          <span className="text">{blockTypeToBlockName[blockType as keyof typeof blockTypeToBlockName]}</span>
          <i className="chevron-down" />
        </button>
        {showBlockOptionsDropDown &&
          createPortal(
            <BlockOptionsDropdownList
              editor={editor}
              blockType={blockType}
              toolbarRef={toolbarRef}
              buttonRef={blockButtonRef}
              setShowBlockOptionsDropDown={setShowBlockOptionsDropDown}
            />,
            document.body,
          )}
        <Divider />
        <button
          type="button"
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
          }}
          className={'toolbar-item spaced ' + (isBold ? 'active' : '')}
          title="Bold"
          aria-label="Format Bold"
        >
          <i className="format bold" />
        </button>
        <button
          type="button"
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
          }}
          className={'toolbar-item spaced ' + (isItalic ? 'active' : '')}
          title="Italic"
          aria-label="Format Italics"
        >
          <i className="format italic" />
        </button>
        <button
          type="button"
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
          }}
          className={'toolbar-item spaced ' + (isUnderline ? 'active' : '')}
          title="Underline"
          aria-label="Format Underline"
        >
          <i className="format underline" />
        </button>
        <button
          type="button"
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
          }}
          className={'toolbar-item spaced ' + (isStrikethrough ? 'active' : '')}
          title="Strikethrough"
          aria-label="Format Strikethrough"
        >
          <i className="format strikethrough" />
        </button>
        <Divider />
        <button
          type="button"
          ref={alignmentButtonRef}
          className="toolbar-item block-controls"
          onClick={() => {
            setShowAlignmentOptionsDropDown(!showAlignmentOptionsDropDown);
            setShowBlockOptionsDropDown(false);
            setShowSymbolsDropDown(false);
          }}
          title="Text Alignment"
          aria-label="Alignment Options"
        >
          <i className={alignmentType + '-align'} />
          <span className="text">
            {alignmentTypeToAlignmentName[alignmentType as keyof typeof alignmentTypeToAlignmentName]}
          </span>
          <i className="chevron-down" />
        </button>
        {showAlignmentOptionsDropDown &&
          createPortal(
            <AlignmentOptionsDropdownList
              editor={editor}
              alignmentType={alignmentType}
              toolbarRef={toolbarRef}
              buttonRef={alignmentButtonRef}
              setShowAlignmentOptionsDropDown={setShowAlignmentOptionsDropDown}
            />,
            document.body,
          )}
        <Divider />
        <button
          type="button"
          onClick={() => {
            setShowBlockOptionsDropDown(false);
            setShowAlignmentOptionsDropDown(false);
            setShowSymbolsDropDown(false);
            showModal('Insert Image', (onClose: () => void) => (
              <InsertImageDialog activeEditor={activeEditor} onClose={onClose} />
            ));
          }}
          className="toolbar-item spaced"
          title="Insert Image"
          aria-label="Insert Image"
        >
          <i className="format image" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowBlockOptionsDropDown(false);
            setShowAlignmentOptionsDropDown(false);
            setShowSymbolsDropDown(false);
            showModal('Insert Equation', (onClose) => (
              <InsertEquationDialog activeEditor={activeEditor} onClose={onClose} />
            ));
          }}
          className="toolbar-item spaced"
          title="Insert Equation"
          aria-label="Insert Equation"
        >
          <i className="icon equation" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowBlockOptionsDropDown(false);
            setShowAlignmentOptionsDropDown(false);
            setShowSymbolsDropDown(false);
            showModal('Insert Table', (onClose) => (
              <InsertTableDialog activeEditor={activeEditor} onClose={onClose} />
            ));
          }}
          className="toolbar-item spaced"
          title="Insert Table"
          aria-label="Insert Table"
        >
          <Table2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
          }}
          className={'toolbar-item ' + (isSubscript ? 'active' : '')}
          title="Subscript"
          aria-label="Format text with a subscript"
        >
          <i className="format subscript" />
        </button>
        <button
          type="button"
          onClick={() => {
            activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
          }}
          className={'toolbar-item ' + (isSuperscript ? 'active' : '')}
          title="Superscript"
          aria-label="Format text with a superscript"
        >
          <i className="format superscript" />
        </button>
        <Divider />
        <button
          type="button"
          ref={symbolsButtonRef}
          className="toolbar-item spaced"
          onClick={() => {
            setShowSymbolsDropDown(!showSymbolsDropDown);
            setShowBlockOptionsDropDown(false);
            setShowAlignmentOptionsDropDown(false);
          }}
          aria-label="Insert Symbols"
          title="Insert Symbols"
        >
          <Sigma />
        </button>
        {showSymbolsDropDown &&
          createPortal(
            <SymbolsDropdownList
              editor={editor}
              toolbarRef={toolbarRef}
              buttonRef={symbolsButtonRef}
              setShowSymbolsDropDown={setShowSymbolsDropDown}
            />,
            document.body,
          )}
      </div>
    </>
  );
}
