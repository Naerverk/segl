import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/** Native <details> disclosure – keeps rarely used settings out of the way. */
export function Disclosure({ summary, children, testId }: { summary: string; children: ReactNode; testId?: string }) {
  return (
    <details className="group" data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
        {summary}
      </summary>
      <div className="mt-3 space-y-4 pl-5">{children}</div>
    </details>
  );
}
