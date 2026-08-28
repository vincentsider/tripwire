// src/ui/CodeBlock.tsx
//
// A copy-to-clipboard code block. Plain text in, one-click copy out — used for
// the ownership-proof snippets and the badge embed. Keeps its own "Copied!"
// state and cleans up the timer on unmount.

import { useEffect, useRef, useState } from 'react';

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the user can still select the text */
    }
  };

  return (
    <div className="code">
      <button className="copybtn" onClick={copy} type="button" aria-label={label ? `Copy ${label}` : 'Copy'}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre>{code}</pre>
    </div>
  );
}
