import type { ComponentProps, ReactNode, Ref } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import { Input as UiInput } from '@ui-sdk/react/input';
import { Textarea as UiTextarea } from '@ui-sdk/react/textarea';
import { Checkbox as UiCheckbox, CheckboxIndicator } from '@ui-sdk/react/checkbox';
import { Switch as UiSwitch, SwitchThumb } from '@ui-sdk/react/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui-sdk/react/select';
import { Check, ChevronDown } from 'lucide-react';

interface RowProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** One labelled control: label, control, then optional description or error. */
export function FieldRow({ label, description, error, children, className }: RowProps) {
  return (
    <Field className={className ? `ui-field ${className}` : 'ui-field'}>
      <FieldLabel className="ui-label">{label}</FieldLabel>
      {children}
      {error ? (
        <FieldError className="ui-error">{error}</FieldError>
      ) : description ? (
        <FieldDescription className="ui-description">{description}</FieldDescription>
      ) : null}
    </Field>
  );
}

interface InputProps extends Omit<ComponentProps<typeof UiInput>, 'value' | 'onValueChange'> {
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ value, onValueChange, invalid, className, ref, ...props }: InputProps) {
  return (
    <UiInput
      ref={ref}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      aria-invalid={invalid || undefined}
      className={className ? `ui-input ${className}` : 'ui-input'}
      {...props}
    />
  );
}

interface TextareaProps extends Omit<ComponentProps<typeof UiTextarea>, 'value' | 'onValueChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

export function Textarea({ value, onValueChange, className, ...props }: TextareaProps) {
  return (
    <UiTextarea
      value={value}
      onValueChange={(next) => onValueChange(next)}
      className={className ? `ui-textarea ${className}` : 'ui-textarea'}
      {...props}
    />
  );
}

interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  ariaLabel,
  className,
}: SelectFieldProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => { if (next !== null) onValueChange(String(next)); }}
      placeholder={placeholder}
      disabled={disabled}
      items={options}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={className ? `ui-select-trigger ${className}` : 'ui-select-trigger'}
      >
        <SelectValue />
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent className="ui-popup">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="ui-menu-item">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface SwitchFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** A setting row: label and description on the left, switch on the right. */
export function SwitchField({ checked, onCheckedChange, label, description, disabled }: SwitchFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{label}</div>
        {description ? (
          <div className="text-xs text-[var(--color-text-secondary)]">{description}</div>
        ) : null}
      </div>
      <UiSwitch
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
        className="ui-switch"
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <SwitchThumb />
      </UiSwitch>
    </div>
  );
}

interface CheckboxFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}

export function CheckboxField({ checked, onCheckedChange, label, disabled }: CheckboxFieldProps) {
  return (
    <label className="ui-check-row">
      <UiCheckbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className="ui-checkbox"
      >
        <CheckboxIndicator>
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </CheckboxIndicator>
      </UiCheckbox>
      <span>{label}</span>
    </label>
  );
}
