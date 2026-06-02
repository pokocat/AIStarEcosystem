"use client";

// chip 组 — 设计真源：components.jsx `ChipGroup`。
import * as React from "react";

interface SingleChipGroupProps {
  label?: React.ReactNode;
  items: readonly string[];
  value?: string | null;
  multi?: false;
  onToggle?: (it: string) => void;
}

interface MultiChipGroupProps {
  label?: React.ReactNode;
  items: readonly string[];
  value?: readonly string[];
  multi: true;
  onToggle?: (it: string) => void;
}

export type ChipGroupProps = SingleChipGroupProps | MultiChipGroupProps;

export function ChipGroup(props: ChipGroupProps) {
  const { label, items, onToggle } = props;
  return (
    <div className="col gap-2">
      {label != null && (
        <div className="faint" style={{ fontSize: 12, fontWeight: 600 }}>
          {label}
        </div>
      )}
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {items.map((it) => {
          const on = props.multi
            ? (props.value ?? []).includes(it)
            : props.value === it;
          return (
            <button
              key={it}
              type="button"
              className={"chip" + (on ? " on" : "")}
              onClick={() => onToggle?.(it)}
            >
              {it}
            </button>
          );
        })}
      </div>
    </div>
  );
}
