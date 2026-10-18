"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import "../styles/select-field.css";

type Option = { value: string; label: string; disabled: boolean; title?: string };
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<{children?: React.ReactNode}>(child) ? text(child.props.children) : String(child)).join("");
}
function optionsFrom(children: React.ReactNode, disabled = false): Option[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    if (child.type === "option") return [{ value: String(child.props.value ?? text(child.props.children)), label: child.props.label ?? text(child.props.children), disabled: disabled || !!child.props.disabled, title: child.props.title }];
    return optionsFrom(child.props.children, disabled || !!child.props.disabled);
  });
}

type SelectFieldProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  value?: string | number; defaultValue?: string | number; name?: string; required?: boolean;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onCloseAutoFocus?: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>["onCloseAutoFocus"];
};

/** Single-value HTML-select adapter. Existing callbacks receive a real select
 * change event; Radix owns the visible menu, keyboard navigation and focus. */
export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ children, value, defaultValue, onChange, className, style, id, disabled, name, required, autoFocus, title, form, onCloseAutoFocus, ...rest }, forwardedRef) {
  const native = React.useRef<HTMLSelectElement>(null);
  const nativeId = React.useId();
  const trigger = React.useRef<HTMLButtonElement>(null);
  React.useImperativeHandle(forwardedRef, () => {
    const select = native.current!;
    select.focus = options => trigger.current?.focus(options);
    return select;
  });
  const options = optionsFrom(children);
  const initial = String(defaultValue ?? options.find(option => !option.disabled)?.value ?? "");
  const [uncontrolled, setUncontrolled] = React.useState(initial);
  const current = value === undefined ? uncontrolled : String(value);
  // Encode by index so a genuine empty-string option is selectable in Radix.
  const index = options.findIndex(option => option.value === current);
  const [palette, setPalette] = React.useState<React.CSSProperties>();
  React.useEffect(() => {
    const form = native.current?.form;
    const reset = () => { if (value === undefined) setUncontrolled(initial); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial, value]);
  return <>
    <SelectPrimitive.Root value={index < 0 ? "" : String(index)} disabled={disabled}
      onOpenChange={open => {
        if (!open || !trigger.current) return;
        const css = getComputedStyle(trigger.current);
        const token = (...names: string[]) => names.map(name => css.getPropertyValue(name).trim()).find(Boolean);
        setPalette({ "--select-paper": token("--surface", "--popover", "--background") || "#fff", "--select-ink": token("--ink", "--foreground") || css.color,
          "--select-line": token("--line", "--border") || "#d9dcde", "--select-soft": token("--surface-2", "--accent-soft", "--muted") || "#f1f2f4", fontFamily: css.fontFamily } as React.CSSProperties);
      }}
      onValueChange={key => {
        const option = options[Number(key)], select = native.current;
        if (!select || !option || option.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", {bubbles:true}));
      }}>
      <SelectPrimitive.Trigger ref={trigger} form={form} id={id} disabled={disabled} autoFocus={autoFocus} title={title} aria-required={required || undefined}
        {...rest}
        value={current} data-select-native={nativeId} data-select-field="true" data-canvas-shortcuts-ignore="true" className={`aep-select-field ${className || ""}`} style={style}>
        <SelectPrimitive.Value placeholder="请选择"/>
        <SelectPrimitive.Icon asChild><ChevronDown size={15} aria-hidden="true"/></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal><SelectPrimitive.Content onCloseAutoFocus={onCloseAutoFocus} className="aep-select-menu" style={palette} position="popper" sideOffset={6} collisionPadding={12}>
        <SelectPrimitive.ScrollUpButton className="aep-select-scroll"><ChevronUp size={15}/></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>{options.map((option, i) => <SelectPrimitive.Item key={`${i}-${option.value}`} value={String(i)} disabled={option.disabled} className="aep-select-option" title={option.title || option.label}>
          <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator><Check size={15}/></SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>)}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="aep-select-scroll"><ChevronDown size={15}/></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content></SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    <select ref={native} form={form} id={nativeId} name={name} value={current} required={required} disabled={disabled} onChange={event => { setUncontrolled(event.target.value); onChange?.(event); }}
      tabIndex={-1} aria-hidden="true" style={{display:"none"}} onInvalid={event => { event.preventDefault(); trigger.current?.focus(); }}>{children}</select>
  </>;
});
