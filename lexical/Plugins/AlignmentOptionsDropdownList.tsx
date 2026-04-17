import { useEffect, useRef } from 'react';
import type { LexicalEditor } from 'lexical';
import { FORMAT_ELEMENT_COMMAND } from 'lexical';

export default function AlignmentOptionsDropdownList({
  editor,
  alignmentType,
  toolbarRef,
  buttonRef,
  setShowAlignmentOptionsDropDown,
}: {
  editor: LexicalEditor;
  alignmentType: string;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  setShowAlignmentOptionsDropDown: (show: boolean) => void;
}) {
  const dropDownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const dropDown = dropDownRef.current;

    if (button !== null && dropDown !== null) {
      const { top, left, height, width } = button.getBoundingClientRect();

      // Always position below the button
      (dropDown as HTMLElement).style.top = `${top + height + 5}px`;
      (dropDown as HTMLElement).style.left = `${left}px`;
      (dropDown as HTMLElement).style.minWidth = `${width}px`;
      (dropDown as HTMLElement).style.position = 'fixed';
      (dropDown as HTMLElement).style.zIndex = '9999';
    }
  }, [dropDownRef, buttonRef]);

  useEffect(() => {
    const dropDown = dropDownRef.current;
    const toolbar = toolbarRef.current;

    if (dropDown !== null && toolbar !== null) {
      const handle = (event: MouseEvent) => {
        const target = event.target;

        if (dropDown && target && !dropDown.contains(target as Node) && !toolbar.contains(target as Node)) {
          setShowAlignmentOptionsDropDown(false);
        }
      };
      document.addEventListener('click', handle);

      return () => {
        document.removeEventListener('click', handle);
      };
    }
  }, [dropDownRef, setShowAlignmentOptionsDropDown, toolbarRef]);

  const formatAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
    setShowAlignmentOptionsDropDown(false);
  };

  return (
    <div className="dropdown" ref={dropDownRef}>
      <button type="button" className="item" onClick={() => formatAlignment('left')}>
        <i className="left-align" />
        <span className="text">Left Align</span>
        {alignmentType === 'left' && <span className="active" />}
      </button>
      <button type="button" className="item" onClick={() => formatAlignment('center')}>
        <i className="center-align" />
        <span className="text">Center Align</span>
        {alignmentType === 'center' && <span className="active" />}
      </button>
      <button type="button" className="item" onClick={() => formatAlignment('right')}>
        <i className="right-align" />
        <span className="text">Right Align</span>
        {alignmentType === 'right' && <span className="active" />}
      </button>
      <button type="button" className="item" onClick={() => formatAlignment('justify')}>
        <i className="justify-align" />
        <span className="text">Justify Align</span>
        {alignmentType === 'justify' && <span className="active" />}
      </button>
    </div>
  );
}
