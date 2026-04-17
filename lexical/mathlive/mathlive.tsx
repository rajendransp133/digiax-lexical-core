import './mathlive.css';
import 'mathlive';
import { useRef, useEffect } from 'react';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

interface MathfieldElement extends HTMLElement {
  value: string;
  smartFence: boolean;
  executeCommand: (command: string) => void;
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': DetailedHTMLProps<HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}

type MathLiveInputProps = {
  value: string;
  onChange: (latex: string) => void;
  className?: string;
};

export default function MathLiveInput({ value, onChange, className }: MathLiveInputProps) {
  const mf = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    if (!mf.current) return;

    mf.current.smartFence = true;
    const handleInput = (event: Event) => {
      const target = event.target as MathfieldElement | null;
      if (!target) return;
      onChange(target.value);
    };

    mf.current.addEventListener('input', handleInput);

    return () => mf.current?.removeEventListener('input', handleInput);
  }, [onChange]);

  useEffect(() => {
    if (!mf.current) return;
    if (mf.current.value !== value) {
      mf.current.value = value;
    }
  }, [value]);

  return (
    <math-field ref={mf} className={className}>
      {value}
    </math-field>
  );
}
