import React from "react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-white py-4 px-6 text-center text-xs text-muted-foreground">
      <p>
        Spendly — Personal Finance Management App &bull; Created by{" "}
        <a
          href="https://prabhu-coder.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-text hover:underline"
        >
          Prabhu
        </a>
      </p>
    </footer>
  );
}
