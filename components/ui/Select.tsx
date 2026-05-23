"use client";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: AppSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 data-[disabled]:cursor-not-allowed data-[disabled]:bg-slate-50 data-[disabled]:opacity-70 ${className}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="shrink-0">
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-[9999] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 pr-8 text-sm text-slate-700 outline-none hover:bg-purple-50 hover:text-purple-700 focus:bg-purple-50 focus:text-purple-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-medium"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2.5">
                  <Check className="h-3.5 w-3.5 text-purple-600" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
