"use client";

import ActionIcon from "@/components/ui/ActionIcon";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "./buttonStyles";

type Props = {
  text: string | (() => string);
  label?: string;
  copiedMessage?: string;
  errorMessage?: string;
  fallbackLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export default function CopyText({
  text,
  label = "Copy text",
  copiedMessage = "Text copied!",
  errorMessage = "Could not copy the text. You can copy it below.",
  fallbackLabel = "Text to copy",
  size = "lg",
  variant = "primary",
}: Props) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const busy = useRef(false);
  const revision = useRef(0);

  useEffect(() => () => { revision.current++; }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    if (busy.current) return;
    const value = typeof text === "function" ? text() : text;
    busy.current = true;
    const request = ++revision.current;
    setPending(true);
    setCopied(false);
    setFallbackText(null);
    try {
      await navigator.clipboard.writeText(value);
      if (request === revision.current) setCopied(true);
    } catch {
      if (request === revision.current) setFallbackText(value);
    } finally {
      busy.current = false;
      if (request === revision.current) setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button size={size} variant={variant} disabled={pending} onClick={() => void share()}>
        <ActionIcon action={pending ? "refresh" : "share"} />
        {pending ? "Copying…" : label}
      </Button>
      {copied ? <p role="status" className="text-sm text-success">{copiedMessage}</p> : null}
      {fallbackText !== null ? (
        <>
          <p role="alert" className="text-sm">{errorMessage}</p>
          <textarea
            aria-label={fallbackLabel}
            readOnly
            value={fallbackText}
            onFocus={event => event.currentTarget.select()}
            className="w-full min-w-0 rounded border border-border bg-surface p-2 text-sm"
          />
        </>
      ) : null}
    </div>
  );
}
