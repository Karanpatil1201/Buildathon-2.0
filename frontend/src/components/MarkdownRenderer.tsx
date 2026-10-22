import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Parse inline elements (bold, italic, inline code)
  const renderInline = (text: string): React.ReactNode[] => {
    // Split by markdown inline syntax
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Inline code: `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={`code-${keyIdx++}`}
            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#303134] text-[#A8C7FA] border border-[#3C4043]"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Bold: **bold**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={`bold-${keyIdx++}`} className="font-semibold text-white">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic: *italic* or _italic_
      const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
      if (italicMatch) {
        parts.push(
          <em key={`italic-${keyIdx++}`} className="italic text-[#E3E3E3]">
            {italicMatch[2]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Regular text up to the next special char
      const nextSpecial = remaining.search(/[`*_]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial > 0) {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      } else {
        // Character was special but did not match regex (e.g. unmatched *), advance 1 char
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }
    }

    return parts;
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-4 list-disc marker:text-[#A8C7FA]">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableHeaders.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-xl border border-[#3C4043]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1E1F20] border-b border-[#3C4043] text-[#9AA0A6] uppercase font-mono text-[11px]">
                {tableHeaders.map((th, i) => (
                  <th key={i} className="py-2.5 px-3">{th.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3C4043]/50 bg-[#202124]">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#282A2C] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3 text-[#E3E3E3]">
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Table row detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // Check if separator line (e.g. |---|---|)
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        // separator row, ignore
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Blank line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold text-[#A8C7FA] uppercase tracking-wider mt-3 mb-1 font-mono">
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-bold text-white mt-3 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A8C7FA] shrink-0" />
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-bold text-white mt-4 mb-2">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold text-white mt-4 mb-2">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-3 border-[#3C4043]" />);
      continue;
    }

    // Bullet items: - or *
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      inList = true;
      listItems.push(
        <li key={`li-${i}`} className="text-xs text-[#E3E3E3] leading-relaxed">
          {renderInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Numbered items: 1. item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      flushList();
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1 text-xs text-[#E3E3E3]">
          <span className="font-mono text-[#A8C7FA] font-bold shrink-0">{numMatch[1]}.</span>
          <span className="leading-relaxed">{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs text-[#E3E3E3] leading-relaxed my-1.5">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();

  return <div className="space-y-1">{elements}</div>;
};
