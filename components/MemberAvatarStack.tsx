"use client";

import { avatarColor, getInitials } from "@/lib/member-avatar";

interface MemberAvatarStackProps {
  names: string[];
  maxVisible?: number;
  size?: "sm" | "md";
}

const SIZE_CLASSES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
};

export default function MemberAvatarStack({
  names,
  maxVisible = 3,
  size = "sm",
}: MemberAvatarStackProps) {
  if (names.length === 0) return null;

  const visibleNames = names.slice(0, maxVisible);
  const hiddenCount = Math.max(0, names.length - visibleNames.length);

  return (
    <div className="flex items-center -space-x-2" title={names.join(", ")}>
      {visibleNames.map((name, index) => (
        <div
          key={`${name}-${index}`}
          className={`${SIZE_CLASSES[size]} ${avatarColor(name)} rounded-full border-2 border-white text-white font-bold flex items-center justify-center shadow-sm`}
        >
          {getInitials(name)}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full border-2 border-white bg-slate-200 text-slate-600 font-semibold flex items-center justify-center shadow-sm`}
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  );
}
