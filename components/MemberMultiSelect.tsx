"use client";

import MemberAvatarStack from "@/components/MemberAvatarStack";
import { avatarColor, getInitials } from "@/lib/member-avatar";

export interface MemberChoice {
  id: number;
  name: string;
}

interface MemberMultiSelectProps {
  members: MemberChoice[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

export default function MemberMultiSelect({
  members,
  selectedIds,
  onChange,
  disabled = false,
}: MemberMultiSelectProps) {
  const selectedMembers = members.filter((member) => selectedIds.includes(member.id));

  const toggleMember = (id: number) => {
    if (disabled) return;

    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((memberId) => memberId !== id));
      return;
    }

    onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-slate-700">Owners</label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {selectedMembers.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <div className="flex items-center gap-3">
            <MemberAvatarStack
              names={selectedMembers.map((member) => member.name)}
              size="md"
              maxVisible={4}
            />
            <p className="text-xs text-slate-500">
              {selectedMembers.map((member) => member.name).join(", ")}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
          No owners assigned yet
        </div>
      )}

      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        {members.map((member) => {
          const checked = selectedIds.includes(member.id);

          return (
            <label
              key={member.id}
              className={`flex items-center gap-3 px-3 py-2 ${
                disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleMember(member.id)}
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
              />
              <div
                className={`w-8 h-8 rounded-full ${avatarColor(member.name)} text-white text-xs font-bold flex items-center justify-center shadow-sm shrink-0`}
              >
                {getInitials(member.name)}
              </div>
              <span className="text-sm text-slate-700">{member.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
