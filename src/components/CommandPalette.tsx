import { useMemo, type ComponentType } from 'react';
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandSeparator,
} from '@ui-sdk/react/command';
import { Search } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';
import type { Service } from '../types';

export interface PaletteAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
  run: () => void;
  /** Actions land under "Actions"; services get their own group above them. */
  group?: string;
}

interface CommandPaletteProps {
  onClose: () => void;
  actions: PaletteAction[];
  onEditService?: (index: number) => void;
}

/**
 * Ctrl+K palette: fuzzy-search every service and jump to it, or run a tool
 * action. Services are indexed by their global config index so a name shared by
 * two entries still resolves to the right card.
 */
export function CommandPalette({ onClose, actions, onEditService }: CommandPaletteProps) {
  const { config, isEditMode } = useDashboard();
  const { authenticated } = useAuth();

  const services = useMemo(
    () => config.services.map((service, index) => ({ service, index })),
    [config.services],
  );

  const runService = (service: Service, index: number) => {
    if (isEditMode && authenticated && onEditService) {
      onEditService(index);
    } else {
      window.open(service.url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} closeOnOutsidePress>
      <DialogBackdrop className="ui-dialog-backdrop" />
      <DialogContent className="ui-dialog ui-dialog-palette" aria-label="Command palette">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          filter="fuzzy"
          onAction={(value) => {
            const action = actions.find((item) => `action:${item.id}` === value);
            if (action) {
              action.run();
              onClose();
            }
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4">
            <Search className="size-4 shrink-0 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <CommandInput
              aria-label="Search services and commands"
              placeholder="Search services, or type a command…"
              className="h-12 w-full bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
            <kbd className="ui-kbd shrink-0">esc</kbd>
          </div>

          <CommandEmpty className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            Nothing matches. Try a service name or “settings”.
          </CommandEmpty>

          <CommandList className="max-h-[min(60dvh,26rem)] overflow-y-auto p-2">
            {services.length > 0 && (
              <CommandGroup>
                <CommandGroupLabel className="ui-menu-label">Services</CommandGroupLabel>
                {services.map(({ service, index }) => (
                  <CommandItem
                    key={`${service.name}-${index}`}
                    value={`service:${index}:${service.name}`}
                    className="ui-menu-item"
                    onSelect={() => runService(service, index)}
                  >
                    <CommandItemIcon className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--surface-sunken)]">
                      {service.icon ? (
                        <img src={service.icon} alt="" className="size-4 object-contain" />
                      ) : (
                        <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">
                          {service.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </CommandItemIcon>
                    <span className="min-w-0 flex-1 truncate">{service.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--text-tertiary)]">
                      {service.category}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator className="ui-menu-separator" />

            <CommandGroup>
              <CommandGroupLabel className="ui-menu-label">Actions</CommandGroupLabel>
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={`action:${action.id}`}
                    className="ui-menu-item"
                    onSelect={() => {
                      action.run();
                      onClose();
                    }}
                  >
                    <CommandItemIcon className="grid size-6 shrink-0 place-items-center text-[var(--color-text-secondary)]">
                      <Icon className="size-4" />
                    </CommandItemIcon>
                    <span className="flex-1 truncate">{action.label}</span>
                    {action.hint ? <kbd className="ui-kbd ml-auto">{action.hint}</kbd> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
