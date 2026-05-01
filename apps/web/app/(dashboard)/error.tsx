"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@ewos/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-md border p-6">
        <h2 className="text-lg font-semibold">Dashboard failed to load</h2>
        <p className="mt-2 text-sm text-muted-foreground">The request could not be completed. Retry after the backend finishes recovering.</p>
        <Button className="mt-4" onClick={() => reset()}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Retry
        </Button>
      </div>
    </div>
  );
}

