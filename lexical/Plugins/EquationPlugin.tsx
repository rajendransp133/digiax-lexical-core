import type { JSX } from 'react';

import 'katex/dist/katex.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
  type LexicalEditor,
} from 'lexical';
import { useCallback, useEffect } from 'react';

import { $createEquationNode, EquationNode } from '../nodes/EquationNode';
import KatexEquationAlterer from '../ui/KatexEquationAlterer';

type CommandPayload = {
  equation: string;
  inline: boolean;
};

export const INSERT_EQUATION_COMMAND: LexicalCommand<CommandPayload> = createCommand('INSERT_EQUATION_COMMAND');

export function InsertEquationDialog({
  activeEditor,
  onClose,
  initialEquation,
  initialInline,
}: {
  activeEditor: LexicalEditor;
  onClose: () => void;
  initialEquation?: string;
  initialInline?: boolean;
}): JSX.Element {
  const onEquationConfirm = useCallback(
    (equation: string, inline: boolean) => {
      activeEditor.dispatchCommand(INSERT_EQUATION_COMMAND, {
        equation,
        inline,
      });
      onClose();
    },
    [activeEditor, onClose],
  );

  return (
    <KatexEquationAlterer
      onConfirm={onEquationConfirm}
      initialEquation={initialEquation}
      initialInline={initialInline}
    />
  );
}

export default function EquationsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([EquationNode])) {
      throw new Error('EquationsPlugins: EquationsNode not registered on editor');
    }

    return editor.registerCommand<CommandPayload>(
      INSERT_EQUATION_COMMAND,
      (payload) => {
        const { equation, inline } = payload;
        const equationNode = $createEquationNode(equation, inline);

        $insertNodes([equationNode]);

        let paragraphNode;
        if ($isRootOrShadowRoot(equationNode.getParentOrThrow())) {
          paragraphNode = $wrapNodeInElement(equationNode, $createParagraphNode);
        }

        // Position cursor after the equation
        if (inline) {
          // For inline equations, position cursor right after the equation node
          equationNode.selectNext(0, 0);
        } else {
          // For block equations, create a new paragraph after and position cursor there
          const newParagraph = $createParagraphNode();
          if (paragraphNode) {
            paragraphNode.insertAfter(newParagraph);
          } else {
            equationNode.insertAfter(newParagraph);
          }
          newParagraph.select(0, 0);
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}
