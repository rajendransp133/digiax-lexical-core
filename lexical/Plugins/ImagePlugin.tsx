/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from "react";

import {
  $isAutoLinkNode,
  $isLinkNode,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $findMatchingParent,
  $wrapNodeInElement,
  mergeRegister,
} from "@lexical/utils";
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  getDOMSelectionFromTarget,
  isHTMLElement,
  type LexicalCommand,
  type LexicalEditor,
} from "lexical";
import { useEffect, useState } from "react";

import {
  $createImageNode,
  $isImageNode,
  ImageNode,
  type ImagePayload,
} from "../nodes/ImageNode";
import Button from "../ui/Button";
import { DialogActions } from "../ui/Dialog";
import FileInput from "../ui/FileInput";
import TextInput from "../ui/TextInput";

export type InsertImagePayload = Readonly<ImagePayload>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> =
  createCommand("INSERT_IMAGE_COMMAND");

export function InsertImageUploadedDialogBody({
  onClick,
}: {
  onClick: (payload: InsertImagePayload) => void;
}) {
  const [src, setSrc] = useState("");
  const [altText, setAltText] = useState("");

  const isDisabled = src === "";

  const loadImage = (files: FileList | null) => {
    const reader = new FileReader();
    reader.onload = function () {
      if (typeof reader.result === "string") {
        setSrc(reader.result);
      }
      return "";
    };
    if (files !== null) {
      reader.readAsDataURL(files[0]);
    }
  };

  return (
    <>
      <FileInput
        label="Image Upload"
        onChange={loadImage}
        accept="image/*"
        data-test-id="image-modal-file-upload"
      />
      <TextInput
        label="Alt Text"
        placeholder="Descriptive alternative text"
        onChange={setAltText}
        value={altText}
        data-test-id="image-modal-alt-text-input"
      />
      <DialogActions>
        <Button
          data-test-id="image-modal-file-upload-btn"
          disabled={isDisabled}
          onClick={() => onClick({ altText, src })}
        >
          Confirm
        </Button>
      </DialogActions>
    </>
  );
}

export function InsertImageDialog({
  activeEditor,
  onClose,
}: {
  activeEditor: LexicalEditor;
  onClose: () => void;
}): JSX.Element {
  const onClick = (payload: InsertImagePayload) => {
    activeEditor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
    onClose();
  };

  return (
    <>
      <InsertImageUploadedDialogBody onClick={onClick} />
    </>
  );
}

export default function ImagesPlugin({
  captionsEnabled,
}: {
  captionsEnabled?: boolean;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error("ImagesPlugin: ImageNode not registered on editor");
    }

    return mergeRegister(
      editor.registerCommand<InsertImagePayload>(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
          if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
            $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
          }

          return true;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand<DragEvent>(
        DRAGSTART_COMMAND,
        (event) => {
          return $onDragStart(event);
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand<DragEvent>(
        DRAGOVER_COMMAND,
        (event) => {
          return $onDragover(event);
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand<DragEvent>(
        DROP_COMMAND,
        (event) => {
          return $onDrop(event, editor);
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [captionsEnabled, editor]);

  return null;
}

const TRANSPARENT_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const img = document.createElement("img");
img.src = TRANSPARENT_IMAGE;

function $onDragStart(event: DragEvent): boolean {
  const node = $getImageNodeInSelection();
  if (!node) {
    return false;
  }
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return false;
  }
  dataTransfer.setData("text/plain", "_");
  dataTransfer.setDragImage(img, 0, 0);
  dataTransfer.setData(
    "application/x-lexical-drag",
    JSON.stringify({
      data: {
        altText: node.__altText,
        caption: node.__caption,
        height: node.__height,
        key: node.getKey(),
        maxWidth: node.__maxWidth,
        showCaption: node.__showCaption,
        src: node.__src,
        width: node.__width,
      },
      type: "image",
    })
  );

  return true;
}

function $onDragover(event: DragEvent): boolean {
  // Check if we have image drag data
  const data = getDragImageData(event);
  if (!data) {
    return false;
  }

  // Always prevent the default dragover behavior to enable dropping
  event.preventDefault();

  // Only return false if we can't drop the image
  if (!canDropImage(event)) {
    return false;
  }

  return true;
}

function $onDrop(event: DragEvent, editor: LexicalEditor): boolean {
  // Check if we have drag data for an image
  const data = getDragImageData(event);
  if (!data) {
    return false;
  }

  event.preventDefault();

  if (!canDropImage(event)) {
    return false;
  }

  // Find the currently selected/dragged image node
  const draggedNode = $getImageNodeInSelection();
  let existingLink = null;

  // If we have a dragged node, get its link parent and remove it
  if (draggedNode) {
    existingLink = $findMatchingParent(
      draggedNode,
      (parent): parent is LinkNode =>
        !$isAutoLinkNode(parent) && $isLinkNode(parent)
    );
    draggedNode.remove();
  }

  // Get the drop position and set selection there
  const range = getDragSelection(event);
  if (range !== null && range !== undefined) {
    const rangeSelection = $createRangeSelection();
    rangeSelection.applyDOMRange(range);
    $setSelection(rangeSelection);

    // Insert the image at the new position
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, data);

    // Restore link if it existed
    if (existingLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, existingLink.getURL());
    }
  }

  return true;
}

function $getImageNodeInSelection(): ImageNode | null {
  const selection = $getSelection();
  if (!$isNodeSelection(selection)) {
    return null;
  }
  const nodes = selection.getNodes();
  const node = nodes[0];
  return $isImageNode(node) ? node : null;
}

function getDragImageData(event: DragEvent): null | InsertImagePayload {
  const dragData = event.dataTransfer?.getData("application/x-lexical-drag");
  if (!dragData) {
    return null;
  }
  const { type, data } = JSON.parse(dragData);
  if (type !== "image") {
    return null;
  }

  return data;
}

declare global {
  interface DragEvent {
    rangeOffset?: number;
    rangeParent?: Node;
  }
}

function canDropImage(event: DragEvent): boolean {
  const target = event.target;
  if (!isHTMLElement(target)) {
    return false;
  }

  // Don't allow dropping on code blocks or on other images
  if (target.closest("code, .editor-image")) {
    return false;
  }

  // Check if we're within the editor content area
  const editorInput = target.closest(".editor-input");
  const editorContainer = target.closest(".editor-container, .editor-inner");

  return !!(editorInput || editorContainer);
}

function getDragSelection(event: DragEvent): Range | null | undefined {
  let range;
  const domSelection = getDOMSelectionFromTarget(event.target);

  // Try to get range from point first (most browsers)
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY);
  }
  // Fallback for browsers that don't support caretRangeFromPoint
  else if (domSelection && domSelection.rangeCount > 0) {
    range = domSelection.getRangeAt(0);
  }
  // Another fallback using event properties
  else if (event.rangeParent && domSelection !== null) {
    domSelection.collapse(event.rangeParent, event.rangeOffset || 0);
    range = domSelection.getRangeAt(0);
  }
  // Final fallback - create range at the drop target
  else if (isHTMLElement(event.target)) {
    range = document.createRange();
    const target = event.target as HTMLElement;

    // If target is a text node or has text content, try to place at appropriate position
    if (target.firstChild && target.firstChild.nodeType === Node.TEXT_NODE) {
      range.setStart(target.firstChild, 0);
      range.setEnd(target.firstChild, 0);
    } else {
      range.selectNodeContents(target);
      range.collapse(true);
    }
  } else {
    console.warn("Cannot get selection when dragging");
    return null;
  }

  return range;
}
