import { Button, type ButtonProps } from '@/components/ui/button';

export function SaveButton({ saving, children = 'Save', ...props }: ButtonProps & { saving: boolean }) {
  return <Button {...props} disabled={saving || props.disabled}>{saving ? 'Saving...' : children}</Button>;
}
