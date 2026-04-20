'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

function exec(cmd: string, arg?: string) {
  document.execCommand(cmd, false, arg);
}

export function RichEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // [MED-01] Initialize content once (uncontrolled to avoid caret jumps).
  // Sanitize value in case it was sourced from localStorage/URL/draft restore —
  // authoring-time XSS is still a risk before publish-time render sanitizes.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['p','h1','h2','h3','b','i','u','strong','em','ul','ol','li','blockquote','pre','code','a','br'],
        ALLOWED_ATTR: ['href','target','rel'],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const btn = (label: string, cmd: string, arg?: string, extra?: string) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        exec(cmd, arg);
        handleInput();
      }}
      className={`rounded px-2 py-1 text-xs text-ink-600 hover:bg-purple-100 ${extra ?? ''}`}
      title={label}
    >
      {label}
    </button>
  );

  const link = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      exec('createLink', url);
      handleInput();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1 rounded-t-lg border border-purple-200 bg-purple-50/30 px-2 py-1.5">
        {btn('B', 'bold', undefined, 'font-bold')}
        {btn('I', 'italic', undefined, 'italic')}
        {btn('U', 'underline', undefined, 'underline')}
        <span className="mx-1 w-px bg-purple-200" />
        {btn('H1', 'formatBlock', '<h1>', 'font-semibold')}
        {btn('H2', 'formatBlock', '<h2>', 'font-semibold')}
        {btn('H3', 'formatBlock', '<h3>', 'font-semibold')}
        {btn('P', 'formatBlock', '<p>')}
        <span className="mx-1 w-px bg-purple-200" />
        {btn('• List', 'insertUnorderedList')}
        {btn('1. List', 'insertOrderedList')}
        {btn('Quote', 'formatBlock', '<blockquote>')}
        {btn('Code', 'formatBlock', '<pre>', 'font-mono')}
        <span className="mx-1 w-px bg-purple-200" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); link(); }}
          className="rounded px-2 py-1 text-xs text-ink-600 hover:bg-purple-100"
          title="Insert link"
        >
          Link
        </button>
        {btn('Clear', 'removeFormat')}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder ?? ''}
        className="prose max-w-none min-h-[24rem] rounded-b-lg border border-t-0 border-purple-200 bg-white px-4 py-3 text-sm text-ink-900 focus:border-ink-500 focus:outline-none [&[data-placeholder]:empty:before]:content-[attr(data-placeholder)] [&[data-placeholder]:empty:before]:text-ink-300"
      />
    </div>
  );
}
