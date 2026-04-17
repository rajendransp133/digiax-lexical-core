import { useEffect, useRef } from 'react';
import type { LexicalEditor } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';

const SYMBOL_CATEGORIES = {
  'Greek Letters': [
    'α',
    'β',
    'γ',
    'δ',
    'ε',
    'ζ',
    'η',
    'θ',
    'ι',
    'κ',
    'λ',
    'μ',
    'ν',
    'ξ',
    'π',
    'ρ',
    'σ',
    'τ',
    'φ',
    'χ',
    'ψ',
    'ω',
  ],
  'Greek Upper': ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Φ', 'Ψ', 'Ω'],
  'Arrows & Symbols': [
    '→',
    '←',
    '↑',
    '↓',
    '↔',
    '⇒',
    '⇐',
    '⇔',
    '∈',
    '∉',
    '∀',
    '∃',
    '∅',
    '⊂',
    '⊃',
    '∩',
    '∪',
    '°',
    '′',
    '″',
  ],
};

export default function SymbolsDropdownList({
  editor,
  toolbarRef,
  buttonRef,
  setShowSymbolsDropDown,
}: {
  editor: LexicalEditor;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  setShowSymbolsDropDown: (show: boolean) => void;
}) {
  const dropDownRef = useRef<HTMLDivElement>(null);

  const positionDropdown = () => {
    const button = buttonRef.current;
    const dropDown = dropDownRef.current;

    if (button !== null && dropDown !== null) {
      const rect = button.getBoundingClientRect();
      const { top, left, width, height } = rect;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 4;

      // Measure dropdown dimensions (temporarily position off-screen for measurement)
      dropDown.style.visibility = 'hidden';
      dropDown.style.position = 'fixed';
      dropDown.style.top = '0';
      dropDown.style.left = '0';
      const dropRect = dropDown.getBoundingClientRect();
      dropDown.style.visibility = '';

      const dropW = dropRect.width;
      const dropH = dropRect.height;

      // Prefer: below > above > right > left (based on available space)
      const spaceBelow = viewportHeight - (top + height + gap);
      const spaceAbove = top - gap;
      const spaceRight = viewportWidth - (left + width + gap);
      const spaceLeft = left - gap;

      let finalTop: number;
      let finalLeft: number;

      if (spaceBelow >= dropH) {
        // Place below button
        finalTop = top + height + gap;
        finalLeft = left;
      } else if (spaceAbove >= dropH) {
        // Place above button
        finalTop = top - dropH - gap;
        finalLeft = left;
      } else if (spaceRight >= dropW) {
        // Place to the right of button
        finalTop = top;
        finalLeft = left + width + gap;
      } else if (spaceLeft >= dropW) {
        // Place to the left of button
        finalTop = top;
        finalLeft = left - dropW - gap;
      } else {
        // Fallback: below, clamped to viewport
        finalTop = top + height + gap;
        finalLeft = left;
      }

      // Clamp to viewport
      finalTop = Math.max(gap, Math.min(finalTop, viewportHeight - dropH - gap));
      finalLeft = Math.max(gap, Math.min(finalLeft, viewportWidth - dropW - gap));

      const el = dropDown as HTMLElement;
      el.style.top = `${finalTop}px`;
      el.style.left = `${finalLeft}px`;
      el.style.position = 'fixed';
      el.style.zIndex = '9999';
    }
  };

  useEffect(() => {
    const getScrollParents = (element: Element): Element[] => {
      const parents: Element[] = [];
      let current: Element | null = element.parentElement;
      while (current) {
        const style = getComputedStyle(current);
        const overflow = style.overflow + style.overflowX + style.overflowY;
        if (/(auto|scroll|overlay)/.test(overflow)) {
          parents.push(current);
        }
        current = current.parentElement;
      }
      return parents;
    };

    positionDropdown();

    const button = buttonRef.current;
    const scrollTargets = [window, ...(button ? getScrollParents(button) : [])];

    scrollTargets.forEach((target) => {
      target.addEventListener('scroll', positionDropdown, { passive: true });
    });
    window.addEventListener('resize', positionDropdown);

    return () => {
      scrollTargets.forEach((target) => {
        target.removeEventListener('scroll', positionDropdown);
      });
      window.removeEventListener('resize', positionDropdown);
    };
  }, [buttonRef]);

  useEffect(() => {
    const dropDown = dropDownRef.current;
    const toolbar = toolbarRef.current;

    if (dropDown !== null && toolbar !== null) {
      const handle = (event: MouseEvent) => {
        const target = event.target;

        if (dropDown && target && !dropDown.contains(target as Node) && !toolbar.contains(target as Node)) {
          setShowSymbolsDropDown(false);
        }
      };
      document.addEventListener('click', handle);

      return () => {
        document.removeEventListener('click', handle);
      };
    }
  }, [dropDownRef, setShowSymbolsDropDown, toolbarRef]);

  const insertSymbol = (symbol: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(symbol);
      }
    });
  };

  return (
    <div
      className="dropdown symbols-dropdown"
      ref={dropDownRef}
    >
      <button
        type="button"
        className="symbols-dropdown__close"
        onClick={() => setShowSymbolsDropDown(false)}
        aria-label="Close"
      >
        ×
      </button>
      {Object.entries(SYMBOL_CATEGORIES).map(([category, symbols]) => (
        <div key={category} className="symbols-dropdown__category">
          <div className="symbols-dropdown__category-title">{category}</div>
          <div className="symbols-dropdown__grid">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className="symbol-item"
                onClick={() => insertSymbol(symbol)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f0f0';
                  e.currentTarget.style.borderColor = '#999';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.borderColor = '#ddd';
                }}
                title={symbol}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
