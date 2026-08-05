import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Hash, Loader2, Pencil, Plus, Power, Ruler, Tag } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/erp/form-field";
import {
  DOC_TYPE_LABELS,
  previewNumber,
  useBrands,
  useCategories,
  useSaveBrand,
  useSaveCategory,
  useSaveUnit,
  useSequences,
  useSetReferenceStatus,
  useUnits,
  useUpdateSequence,
} from "@/features/settings/reference";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { plural } from "@/lib/format";
import type {
  BrandRow,
  DocumentSequenceRow,
  ProductCategoryRow,
  UnitOfMeasureRow,
} from "@/lib/database.types";

export const Route = createFileRoute("/_app/settings/system")({
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  return (
    <RequirePermission require={PERMISSIONS.SETTINGS_SYSTEM_MANAGE} what="system settings">
      <SystemSettingsScreen />
    </RequirePermission>
  );
}

function SystemSettingsScreen() {
  return (
    <>
      <PageHeader
        title="System settings"
        description="Document numbering and the reference data every other module reads."
        breadcrumbs={[{ label: "Settings" }, { label: "System" }]}
      />

      <Tabs defaultValue="numbering">
        <TabsList>
          <TabsTrigger value="numbering">Numbering</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>

        <TabsContent value="numbering" className="mt-4">
          <NumberingTab />
        </TabsContent>
        <TabsContent value="units" className="mt-4">
          <UnitsTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <BrandsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------

function NumberingTab() {
  const sequences = useSequences();
  const [editing, setEditing] = useState<DocumentSequenceRow | null>(null);

  return (
    <>
      <div
        role="note"
        className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
        <div>
          <p className="font-semibold">Numbering cannot go backwards</p>
          <p className="mt-0.5 text-muted-foreground">
            The counter is what keeps every document number unique. Lowering it would hand out
            numbers already issued, so the database refuses. Changing a prefix is safe — existing
            documents keep the number they were given.
          </p>
        </div>
      </div>

      <SectionCard
        title="Document numbering"
        description="Applies to the next document raised, not to anything already issued."
        bodyClassName="p-0"
      >
        {sequences.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={4} rows={8} />
          </div>
        ) : sequences.isError ? (
          <ErrorState error={sequences.error} onRetry={() => void sequences.refetch()} />
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-2 text-left font-semibold">Document</th>
                  <th className="p-2 text-left font-semibold">Prefix</th>
                  <th className="p-2 text-right font-semibold">Next</th>
                  <th className="p-2 text-left font-semibold">Looks like</th>
                  <th className="w-16 p-2" />
                </tr>
              </thead>
              <tbody>
                {sequences.data?.map((sequence) => (
                  <tr key={sequence.doc_type} className="border-b border-border last:border-0">
                    <td className="p-2">
                      <p className="text-sm">
                        {DOC_TYPE_LABELS[sequence.doc_type] ?? sequence.doc_type}
                      </p>
                      <p className="num text-[11px] text-muted-foreground">{sequence.doc_type}</p>
                    </td>
                    <td className="num p-2">{sequence.prefix}</td>
                    <td className="num p-2 text-right">{sequence.next_number}</td>
                    <td className="num p-2 text-muted-foreground">
                      {previewNumber(sequence.prefix, sequence.padding, sequence.next_number)}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit numbering for ${DOC_TYPE_LABELS[sequence.doc_type] ?? sequence.doc_type}`}
                        onClick={() => setEditing(sequence)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SequenceDialog sequence={editing} onOpenChange={() => setEditing(null)} />
    </>
  );
}

function SequenceDialog({
  sequence,
  onOpenChange,
}: {
  sequence: DocumentSequenceRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateSequence();
  const [prefix, setPrefix] = useState("");
  const [padding, setPadding] = useState(5);
  const [next, setNext] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sequence) return;
    setPrefix(sequence.prefix);
    setPadding(sequence.padding);
    setNext(sequence.next_number);
    setError(null);
  }, [sequence]);

  // Mirror the database guard so the refusal is explained before saving.
  const goesBackwards = sequence !== null && next < sequence.next_number;

  const onSubmit = async () => {
    setError(null);
    if (prefix.trim() === "") return setError("A prefix is needed.");
    if (padding < 3 || padding > 10) return setError("Padding must be between 3 and 10 digits.");
    if (goesBackwards) {
      return setError(
        `The counter cannot go below ${sequence?.next_number}. Those numbers are already issued.`,
      );
    }

    try {
      await update.mutateAsync({
        docType: sequence?.doc_type ?? "",
        patch: { prefix: prefix.trim(), padding, next_number: next },
      });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "It could not be saved.");
    }
  };

  return (
    <Dialog open={Boolean(sequence)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Numbering — {sequence ? (DOC_TYPE_LABELS[sequence.doc_type] ?? sequence.doc_type) : ""}
          </DialogTitle>
          <DialogDescription>
            Affects the next document raised. Anything already issued keeps its number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefix" htmlFor="seq_prefix" required>
              <Input
                id="seq_prefix"
                className="num"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Digits" htmlFor="seq_padding" required hint="3 to 10.">
              <Input
                id="seq_padding"
                type="number"
                min="3"
                max="10"
                className="num text-right"
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value || 0))}
              />
            </Field>
            <Field label="Next number" htmlFor="seq_next" required>
              <Input
                id="seq_next"
                type="number"
                min={sequence?.next_number ?? 1}
                className="num text-right"
                value={next}
                onChange={(e) => setNext(Number(e.target.value || 0))}
              />
            </Field>
          </div>

          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            Next document will be{" "}
            <span className="num font-semibold">{previewNumber(prefix, padding, next)}</span>
          </p>

          {goesBackwards && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Below {sequence?.next_number}, which has already been issued. The database will refuse
              this.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={update.isPending || goesBackwards}>
            {update.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save numbering
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------

function UnitsTab() {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.PRODUCTS_UPDATE);
  const units = useUnits();
  const save = useSaveUnit();
  const setStatus = useSetReferenceStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasureRow | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [allowDecimal, setAllowDecimal] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setAllowDecimal(editing?.allow_decimal ?? true);
    setError(null);
  }, [open, editing]);

  const onSubmit = async () => {
    setError(null);
    if (code.trim() === "" || name.trim() === "") return setError("A code and a name are needed.");
    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        allow_decimal: allowDecimal,
      });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "It could not be saved.");
    }
  };

  return (
    <>
      <SectionCard
        title="Units of measure"
        description="Whether a unit allows decimals decides if half a bag can be sold."
        bodyClassName="p-0"
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add unit
            </Button>
          ) : undefined
        }
      >
        {units.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={3} rows={5} />
          </div>
        ) : units.isError ? (
          <ErrorState error={units.error} onRetry={() => void units.refetch()} />
        ) : (units.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Ruler className="size-5" />}
            title="No units yet"
            description="Every product needs one — each, kilogram, metre, bag."
          />
        ) : (
          <ul className="divide-y divide-border">
            {units.data?.map((unit) => (
              <li key={unit.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{unit.name}</p>
                  <p className="num text-[11px] text-muted-foreground">{unit.code}</p>
                </div>
                {!unit.allow_decimal && (
                  <Badge variant="secondary" className="text-[10px]">
                    whole numbers only
                  </Badge>
                )}
                {unit.status !== "active" && (
                  <Badge variant="secondary" className="text-[10px]">
                    inactive
                  </Badge>
                )}
                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${unit.name}`}
                      onClick={() => {
                        setEditing(unit);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${unit.status === "active" ? "Deactivate" : "Activate"} ${unit.name}`}
                      onClick={() =>
                        setStatus.mutate({
                          table: "units_of_measure",
                          id: unit.id,
                          status: unit.status === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      <Power className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add unit"}</DialogTitle>
            <DialogDescription>
              Used on every product, order line and stock movement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" htmlFor="unit_code" required>
                <Input
                  id="unit_code"
                  className="num"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="KG"
                />
              </Field>
              <Field label="Name" htmlFor="unit_name" required>
                <Input
                  id="unit_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kilogram"
                />
              </Field>
            </div>
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={allowDecimal}
                onCheckedChange={(checked) => setAllowDecimal(checked === true)}
              />
              <span>
                <span className="text-sm font-medium">Allow decimal quantities</span>
                <span className="block text-xs text-muted-foreground">
                  Off for things counted whole — a bag, a door, a window frame.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------
// Categories and brands
// ---------------------------------------------------------------------

function CategoriesTab() {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.PRODUCTS_UPDATE);
  const categories = useCategories();
  const save = useSaveCategory();
  const setStatus = useSetReferenceStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategoryRow | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setError(null);
  }, [open, editing]);

  const onSubmit = async () => {
    setError(null);
    if (code.trim() === "" || name.trim() === "") return setError("A code and a name are needed.");
    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
      });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "It could not be saved.");
    }
  };

  return (
    <>
      <SectionCard
        title="Product categories"
        description={plural(categories.data?.length ?? 0, "category", "categories")}
        bodyClassName="p-0"
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add category
            </Button>
          ) : undefined
        }
      >
        {categories.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={3} rows={5} />
          </div>
        ) : categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
        ) : (categories.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Tag className="size-5" />}
            title="No categories yet"
            description="Categories group products for reporting and stock reviews."
          />
        ) : (
          <ul className="divide-y divide-border">
            {categories.data?.map((category) => (
              <li key={category.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  <p className="num truncate text-[11px] text-muted-foreground">
                    {category.code}
                    {category.description ? ` · ${category.description}` : ""}
                  </p>
                </div>
                {category.status !== "active" && (
                  <Badge variant="secondary" className="text-[10px]">
                    inactive
                  </Badge>
                )}
                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => {
                        setEditing(category);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${category.status === "active" ? "Deactivate" : "Activate"} ${category.name}`}
                      onClick={() =>
                        setStatus.mutate({
                          table: "product_categories",
                          id: category.id,
                          status: category.status === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      <Power className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add category"}</DialogTitle>
            <DialogDescription>Products are grouped by these for reporting.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" htmlFor="cat_code" required>
                <Input
                  id="cat_code"
                  className="num"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CEMENT"
                />
              </Field>
              <Field label="Name" htmlFor="cat_name" required>
                <Input
                  id="cat_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cement and aggregates"
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="cat_description">
              <Textarea
                id="cat_description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BrandsTab() {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.PRODUCTS_UPDATE);
  const brands = useBrands();
  const save = useSaveBrand();
  const setStatus = useSetReferenceStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setError(null);
  }, [open, editing]);

  const onSubmit = async () => {
    setError(null);
    if (code.trim() === "" || name.trim() === "") return setError("A code and a name are needed.");
    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        code: code.trim().toUpperCase(),
        name: name.trim(),
      });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "It could not be saved.");
    }
  };

  return (
    <>
      <SectionCard
        title="Brands"
        description={plural(brands.data?.length ?? 0, "brand")}
        bodyClassName="p-0"
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Add brand
            </Button>
          ) : undefined
        }
      >
        {brands.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={2} rows={4} />
          </div>
        ) : brands.isError ? (
          <ErrorState error={brands.error} onRetry={() => void brands.refetch()} />
        ) : (brands.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Hash className="size-5" />}
            title="No brands yet"
            description="Optional — useful where the same product comes from several makers."
          />
        ) : (
          <ul className="divide-y divide-border">
            {brands.data?.map((brand) => (
              <li key={brand.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{brand.name}</p>
                  <p className="num text-[11px] text-muted-foreground">{brand.code}</p>
                </div>
                {brand.status !== "active" && (
                  <Badge variant="secondary" className="text-[10px]">
                    inactive
                  </Badge>
                )}
                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${brand.name}`}
                      onClick={() => {
                        setEditing(brand);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${brand.status === "active" ? "Deactivate" : "Activate"} ${brand.name}`}
                      onClick={() =>
                        setStatus.mutate({
                          table: "brands",
                          id: brand.id,
                          status: brand.status === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      <Power className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add brand"}</DialogTitle>
            <DialogDescription>Optional on a product.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" htmlFor="brand_code" required>
                <Input
                  id="brand_code"
                  className="num"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Name" htmlFor="brand_name" required>
                <Input id="brand_name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
