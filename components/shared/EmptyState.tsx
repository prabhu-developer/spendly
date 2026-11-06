import React, { ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[#E8EDF4] bg-white my-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F6FC] text-[#8992A3] mb-4">
        {icon || <FolderOpen className="h-6 w-6 text-[#2878E5]" />}
      </div>
      <h3 className="text-base font-semibold text-[#202735] mb-1">{title}</h3>
      <p className="text-sm text-[#8992A3] max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-[#2878E5] hover:bg-[#1F65C2]">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
