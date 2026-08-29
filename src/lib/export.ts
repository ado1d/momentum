"use client";

// Export utilities — Markdown / JSON downloads and PDF via the
// browser print pipeline (zero heavy dependencies: works on phones).

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadMarkdown(md: string, filename: string) {
  downloadFile(md, filename, "text/markdown");
}

export function downloadJson(json: string, filename: string) {
  downloadFile(json, filename, "application/json");
}

/**
 * Word count + estimated reading time (≈200 wpm) for a piece of
 * writing — powers the "342 words · 2 min read" meta in read mode.
 */
export function readingStats(content: string): { words: number; minutes: number } {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  return { words, minutes: words === 0 ? 0 : Math.max(1, Math.round(words / 200)) };
}

/**
 * PDF export via a hidden print container + window.print().
 * Fills #print-root with styled HTML, prints, then restores.
 * On mobile this triggers the native "Save as PDF" sheet.
 */
export function printHtml(title: string, bodyHtml: string) {
  const root = document.createElement("div");
  root.id = "momentum-print";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "9999";
  root.style.background = "white";
  root.style.overflow = "auto";
  root.innerHTML = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 720px; margin: 0 auto; padding: 32px 28px;">
      <div style="display:flex; align-items:center; gap:10px; border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 24px;">
        <div style="font-size:26px;">⚡</div>
        <div>
          <div style="font-size:20px; font-weight:700; letter-spacing:0.5px;">Momentum</div>
          <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:2px;">${escapeHtml(title)}</div>
        </div>
        <div style="margin-left:auto; font-size:11px; color:#888;">${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
      </div>
      ${bodyHtml}
      <div style="margin-top:32px; border-top:1px solid #ddd; padding-top:10px; font-size:10px; color:#999; text-align:center;">
        Exported from Momentum · Your productivity companion
      </div>
    </div>
  `;
  document.body.appendChild(root);
  document.body.style.overflow = "hidden";

  const cleanup = () => {
    root.remove();
    document.body.style.overflow = "";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  // Give the browser a frame to lay out the print container
  setTimeout(() => {
    window.print();
    // Fallback cleanup for browsers that don't fire afterprint reliably
    setTimeout(cleanup, 1500);
  }, 80);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape user content that goes into the print document */
export function esc(s: string | null | undefined): string {
  return escapeHtml(s ?? "");
}

/** Render a very small subset of markdown (headings, lists, bold, italics, line breaks) to HTML for print */
export function miniMarkdownToHtml(md: string): string {
  const lines = (md || "").split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = escapeHtml(raw);
    const inline = (t: string) =>
      t
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|\s)\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>");
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = [20, 16, 14][h[1].length - 1];
      out.push(
        `<div style="font-size:${size}px; font-weight:700; margin:16px 0 6px;">${inline(h[2])}</div>`
      );
      continue;
    }
    if (!line.trim()) {
      out.push("<div style='height:8px;'></div>");
      continue;
    }
    out.push(`<div style="margin:4px 0; line-height:1.55;">${inline(line)}</div>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
