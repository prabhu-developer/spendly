import React from "react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#E8EDF4] bg-white py-4 px-6 text-center text-xs text-[#8992A3]">
      <p>
        Spendly — Personal Finance Management App &bull; Created by{" "}
        <a
          href="https://prabhu-coder.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#2878E5] hover:underline"
        >
          Prabhu
        </a>
      </p>
    </footer>
  );
}
