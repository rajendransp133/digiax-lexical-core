import type { JSX } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNodeByKey, $getSelection, $isNodeSelection, type NodeKey } from 'lexical';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import useModal from '../hooks/useModel';
import KatexEquationAlterer from '../ui/KatexEquationAlterer';
import KatexRenderer from '../ui/KatexRenderer';
import { $createEquationNode, $isEquationNode } from './EquationNode';

type EquationComponentProps = {
  equation: string;
  inline: boolean;
  nodeKey: NodeKey;
};

export default function EquationComponent({ equation, inline, nodeKey }: EquationComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [equationValue, setEquationValue] = useState(equation);
  const [modal, showModal] = useModal();

  const openEditModal = useCallback(() => {
    showModal('Edit Equation', (onClose) => {
      const handleConfirm = (newEquation: string, newInline: boolean) => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isEquationNode(node)) {
            // If inline mode changed, we need to replace the node
            if (newInline !== inline) {
              const newNode = $createEquationNode(newEquation, newInline);
              node.replace(newNode);
              newNode.selectNext(0, 0);
            } else {
              node.setEquation(newEquation);
              node.selectNext(0, 0);
            }
          }
        });
        onClose();
      };

      return <KatexEquationAlterer onConfirm={handleConfirm} initialEquation={equationValue} initialInline={inline} />;
    });
  }, [editor, equationValue, inline, nodeKey, showModal]);

  useEffect(() => {
    if (equationValue !== equation) {
      setEquationValue(equation);
    }
  }, [equation, equationValue]);

  useEffect(() => {
    if (!isEditable) {
      return;
    }
    return editor.registerUpdateListener(({ editorState }) => {
      const isSelected = editorState.read(() => {
        const selection = $getSelection();
        return $isNodeSelection(selection) && selection.has(nodeKey) && selection.getNodes().length === 1;
      });
      if (isSelected) {
        openEditModal();
      }
    });
  }, [editor, nodeKey, isEditable, openEditModal]);

  return (
    <>
      {modal}
      <ErrorBoundary onError={(e) => editor._onError(e)} fallback={null}>
        <KatexRenderer
          equation={equationValue}
          inline={inline}
          onDoubleClick={() => {
            if (isEditable) {
              openEditModal();
            }
          }}
        />
      </ErrorBoundary>
    </>
  );
}
