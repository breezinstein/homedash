import type { ComponentProps, ReactNode } from 'react';
import { Button as UiButton } from '@ui-sdk/react/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline-danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends Omit<ComponentProps<typeof UiButton>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <UiButton
      data-variant={variant}
      data-size={size === 'md' ? undefined : size}
      className={className ? `ui-btn ${className}` : 'ui-btn'}
      {...props}
    />
  );
}

interface IconButtonProps extends Omit<ComponentProps<typeof TooltipTrigger>, 'children' | 'aria-label' | 'className' | 'render'> {
  label: string;
  hint?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

/** Icon-only action: the tooltip both names the control and shows its shortcut. */
export function IconButton({ label, hint, variant = 'ghost', className, children, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        data-variant={variant}
        data-size="icon"
        className={className ? `ui-btn ${className}` : 'ui-btn'}
        {...props}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="ui-tooltip">
        {label}
        {hint ? <> <kbd className="ui-kbd">{hint}</kbd></> : null}
      </TooltipContent>
    </Tooltip>
  );
}
