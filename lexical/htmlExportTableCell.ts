import { $isTableCellNode } from '@lexical/table';
import type { LexicalEditor, LexicalNode } from 'lexical';
import type { DOMExportOutput } from 'lexical';
import { isHTMLElement } from 'lexical';

/**
 * Lexical's TableCellNode.exportDOM sets `width` to `getWidth() || 75` (see COLUMN_WIDTH in
 * @lexical/table). Cells without an explicit stored width export as 75px, so HTML round-trips
 * collapse tables and wrap text unlike the live editor (where CSS uses min-content sizing).
 */
export function tableCellExportDOMPreserveAutoWidth(editor: LexicalEditor, target: LexicalNode): DOMExportOutput {
  if (!$isTableCellNode(target)) {
    return target.exportDOM(editor);
  }
  const output = target.exportDOM(editor);
  if (output.element != null && isHTMLElement(output.element) && target.getWidth() == null) {
    output.element.style.removeProperty('width');
  }
  return output;
}
