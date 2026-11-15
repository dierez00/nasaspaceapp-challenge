"use client";
import dynamic from "next/dynamic";

// react-markdown is only needed for prose answers, so keep it out of the initial bundle
const Markdown = dynamic(() => import("react-markdown"));

export function Prose({ markdown }: { markdown: string }) {
  return (
    <div className="prose">
      <Markdown skipHtml>{markdown}</Markdown>
    </div>
  );
}
