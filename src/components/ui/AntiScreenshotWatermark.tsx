"use client";

import React from "react";

interface AntiScreenshotWatermarkProps {
  roomCode: string;
  nickname?: string;
}

export function AntiScreenshotWatermark({
  roomCode,
  nickname = "GUEST",
}: AntiScreenshotWatermarkProps) {
  const watermarkText = `5MIN • ${roomCode} • ${nickname.toUpperCase()} • DO NOT CAPTURE`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none fixed inset-0 z-0 overflow-hidden opacity-[0.03] sm:opacity-[0.045] flex flex-wrap gap-x-20 gap-y-24 -rotate-12 scale-125 justify-center items-center"
    >
      {Array.from({ length: 40 }).map((_, i) => (
        <span
          key={i}
          className="text-[11px] font-mono font-bold tracking-[0.25em] text-white whitespace-nowrap uppercase"
        >
          {watermarkText}
        </span>
      ))}
    </div>
  );
}
