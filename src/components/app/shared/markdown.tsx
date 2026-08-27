"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lazy-loaded markdown renderer. react-markdown is chunked so the
 * initial bundle stays light — important for phone browsers.
 */
const ReactMarkdown = React.lazy(() =>
  import("react-markdown").then((m) => ({ default: m.default }))
);

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!content?.trim()) return null;

  if (!mounted) {
    // Server/first-paint fallback: plain pre-wrap text
    return (
      <div className={cn("whitespace-pre-wrap break-words text-sm", className)}>
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:font-bold [&_h1]:text-lg [&_h2]:font-semibold [&_h2]:text-base [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1",
        className
      )}
    >
      <React.Suspense
        fallback={<div className="whitespace-pre-wrap text-sm">{content}</div>}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </React.Suspense>
    </div>
  );
}
