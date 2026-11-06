import React from "react";
import * as Icons from "lucide-react";

interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export function IconRenderer({ name, className = "h-4 w-4", size }: IconRendererProps) {
  const IconComponent = (Icons as any)[name] || Icons.Tag;
  return <IconComponent className={className} size={size} />;
}
