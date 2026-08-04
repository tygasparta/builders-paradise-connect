import { useNavigate } from "@tanstack/react-router";
import { Building2, Warehouse, User } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useBranches } from "@/features/branches/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { useUsers } from "@/features/users/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { NAVIGATION, type NavItem } from "@/lib/navigation";

/**
 * Global search across everything Phase 1 actually holds: navigation,
 * branches, warehouses and people. Later phases add products, invoices,
 * orders and journals to the same dialog.
 *
 * Results respect permissions — a cashier searching "branches" finds
 * nothing they cannot open.
 */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { satisfies, can } = usePermissions();

  // Only fetch while the dialog is open.
  const { data: branches } = useBranches(false);
  const { data: warehouses } = useWarehouses(null, false);
  const { data: users } = useUsers();

  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to });
  };

  const navItems: NavItem[] = NAVIGATION.flatMap((section) => section.items)
    .flatMap((item) => [item, ...(item.children ?? [])])
    .filter((item) => item.to && !item.phase && satisfies(item.require));

  const canSeeUsers = can(PERMISSIONS.USERS_VIEW);
  const canSeeWarehouses = can(PERMISSIONS.WAREHOUSES_VIEW);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search screens, branches, warehouses, people…" />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>

        <CommandGroup heading="Go to">
          {navItems.map((item) => (
            <CommandItem
              key={`nav-${item.label}-${item.to}`}
              value={`screen ${item.label}`}
              onSelect={() => go(item.to as string)}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {branches && branches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Branches">
              {branches.map((branch) => (
                <CommandItem
                  key={branch.id}
                  value={`branch ${branch.name} ${branch.code} ${branch.city ?? ""}`}
                  onSelect={() => go("/settings/branches")}
                >
                  <Building2 className="size-4" />
                  <span>{branch.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{branch.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canSeeWarehouses && warehouses && warehouses.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Warehouses">
              {warehouses.map((warehouse) => (
                <CommandItem
                  key={warehouse.id}
                  value={`warehouse ${warehouse.name} ${warehouse.code}`}
                  onSelect={() => go("/warehouses")}
                >
                  <Warehouse className="size-4" />
                  <span>{warehouse.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{warehouse.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canSeeUsers && users && users.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="People">
              {users.slice(0, 20).map((user) => (
                <CommandItem
                  key={user.id}
                  value={`person ${user.full_name} ${user.email} ${user.employee_code ?? ""}`}
                  onSelect={() => go("/users")}
                >
                  <User className="size-4" />
                  <span>{user.full_name}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
