"use client";

import { useState, type CSSProperties } from 'react';
import { Select } from 'radix-ui';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { studioOverlayContainer } from './studio-overlay';

/** Same Radix interaction primitive as the canvas, with Studio's paper styling.
 * Encode values by index so real empty-string options remain selectable. */
export function StudioSelect({ label, value, onChange, options, disabled, compact, placeholder, style }: {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean; compact?: boolean; placeholder?: string; style?: CSSProperties;
}) {
  const [container, setContainer] = useState<HTMLElement>();
  const selected = options.findIndex(option => option.value === value);
  return <Select.Root value={selected < 0 ? '' : String(selected)} disabled={disabled}
    onOpenChange={open => { if (open) setContainer(studioOverlayContainer()); }}
    onValueChange={key => { const option = options[Number(key)]; if (option && !option.disabled) onChange(option.value); }}>
    <Select.Trigger aria-label={label} className={`studio-select-trigger${compact ? ' is-compact' : ''}`} style={style}>
      <Select.Value placeholder={placeholder}/><Select.Icon asChild><ChevronDown size={16} aria-hidden="true"/></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={container}>
      <Select.Content className="studio-select-menu" position="popper" align="start" sideOffset={6} collisionPadding={12}>
        <Select.ScrollUpButton className="studio-select-scroll"><ChevronUp size={15}/></Select.ScrollUpButton>
        <Select.Viewport className="studio-select-viewport">{options.map((option, index) => <Select.Item key={option.value} value={String(index)} disabled={option.disabled} className="studio-select-option">
          <Select.ItemText><span className="studio-select-label" title={option.label}>{option.label}</span></Select.ItemText>
          <Select.ItemIndicator className="studio-select-check"><Check size={15}/></Select.ItemIndicator>
        </Select.Item>)}</Select.Viewport>
        <Select.ScrollDownButton className="studio-select-scroll"><ChevronDown size={15}/></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
