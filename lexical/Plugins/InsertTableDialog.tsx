import type { JSX } from 'react';

import { INSERT_TABLE_COMMAND } from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { useCallback, useState } from 'react';

import Button from '../ui/Button';
import { DialogActions } from '../ui/Dialog';
import TextInput from '../ui/TextInput';

const MIN_DIM = 1;
const MAX_DIM = 50;

function clampTableDim(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(MAX_DIM, Math.max(MIN_DIM, n));
}

export function InsertTableDialog({
  activeEditor,
  onClose,
}: {
  activeEditor: LexicalEditor;
  onClose: () => void;
}): JSX.Element {
  const [rows, setRows] = useState('5');
  const [columns, setColumns] = useState('5');

  const onConfirm = useCallback(() => {
    const r = clampTableDim(rows, 5);
    const c = clampTableDim(columns, 5);
    activeEditor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: String(c),
      includeHeaders: true,
      rows: String(r),
    });
    onClose();
  }, [activeEditor, columns, onClose, rows]);

  return (
    <>
      <TextInput label="Rows" onChange={setRows} placeholder="e.g. 5" type="number" value={rows} />
      <TextInput label="Columns" onChange={setColumns} placeholder="e.g. 5" type="number" value={columns} />
      <DialogActions>
        <Button onClick={onConfirm}>Confirm</Button>
      </DialogActions>
    </>
  );
}
