import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import { useAccounts } from "@/features/accounting/api";
import { db, unwrap } from "@/lib/supabase";
import { financeKeys, type BankAccountWithLedger } from "./api";
import type { BankAccountRow } from "@/lib/database.types";

type BankAccountInput = {
  name: string;
  bank_name: string;
  account_number: string | null;
  branch_name: string | null;
  swift_code: string | null;
  currency_code: string;
  ledger_account_id: string;
  opening_balance: number;
  is_default: boolean;
  notes: string | null;
};

async function saveBankAccount(input: BankAccountInput & { id?: string }): Promise<void> {
  const { id, ...values } = input;

  // Only one account may be default, enforced by a partial unique index.
  // Stand the old one down first, or the insert trips the constraint.
  if (values.is_default) {
    const query = db.from("bank_accounts").update({ is_default: false }).eq("is_default", true);
    unwrap(await (id ? query.neq("id", id) : query).select("id"));
  }

  const rows = unwrap(
    id
      ? await db.from("bank_accounts").update(values).eq("id", id).select("id")
      : await db.from("bank_accounts").insert(values).select("id"),
  ) as { id: string }[];

  if (rows.length === 0) {
    throw new Error("The bank account could not be saved. You may not have permission.");
  }
}

export function BankAccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccountWithLedger | null;
}) {
  const queryClient = useQueryClient();
  const { data: accounts } = useAccounts();

  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [swift, setSwift] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: saveBankAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(account ? "Bank account updated" : "Bank account added");
      onOpenChange(false);
    },
    onError: (error: Error) => setServerError(error.message),
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setName(account?.name ?? "");
    setBankName(account?.bank_name ?? "");
    setAccountNumber(account?.account_number ?? "");
    setBranchName(account?.branch_name ?? "");
    setSwift(account?.swift_code ?? "");
    setCurrency(account?.currency_code ?? "USD");
    setLedgerAccountId(account?.ledger_account_id ?? "");
    setOpeningBalance(Number(account?.opening_balance ?? 0));
    setIsDefault(account?.is_default ?? false);
    setNotes(account?.notes ?? "");
  }, [open, account]);

  /**
   * Only postable asset accounts make sense here — a bank balance is an
   * asset, and a heading cannot be posted to.
   */
  const candidates = (accounts ?? []).filter(
    (candidate) => candidate.is_postable && candidate.account_type === "asset",
  );

  const onSubmit = () => {
    setServerError(null);
    if (name.trim() === "") return setServerError("Give the account a name.");
    if (bankName.trim() === "") return setServerError("Name the bank.");
    if (!ledgerAccountId) {
      return setServerError("Choose the ledger account this bank posts to.");
    }

    save.mutate({
      ...(account ? { id: account.id } : {}),
      name: name.trim(),
      bank_name: bankName.trim(),
      account_number: accountNumber.trim() || null,
      branch_name: branchName.trim() || null,
      swift_code: swift.trim() || null,
      currency_code: currency,
      ledger_account_id: ledgerAccountId,
      opening_balance: openingBalance,
      is_default: isDefault,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? `Edit ${account.name}` : "Add bank account"}</DialogTitle>
          <DialogDescription>
            Every movement on this account posts to the ledger account you choose, which is what
            makes reconciliation meaningful.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-td text-destructive"
            >
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Account name"
              htmlFor="bank_name_field"
              required
              hint="What staff call it."
            >
              <Input
                id="bank_name_field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main current account"
              />
            </Field>
            <Field label="Bank" htmlFor="bank_bank" required>
              <Input
                id="bank_bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="CBZ Bank"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account number" htmlFor="bank_number">
              <Input
                id="bank_number"
                className="num"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </Field>
            <Field label="Branch" htmlFor="bank_branch">
              <Input
                id="bank_branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="SWIFT" htmlFor="bank_swift">
              <Input
                id="bank_swift"
                className="num"
                value={swift}
                onChange={(e) => setSwift(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Currency" htmlFor="bank_currency" required>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="bank_currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "ZWG", "ZAR", "GBP", "EUR"].map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Opening balance"
              htmlFor="bank_opening"
              hint={account ? "Changing this moves every balance." : "As at go-live."}
            >
              <Input
                id="bank_opening"
                type="number"
                step="0.01"
                className="num text-right"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(Number(e.target.value || 0))}
              />
            </Field>
          </div>

          <Field
            label="Ledger account"
            htmlFor="bank_ledger"
            required
            hint="Postable asset accounts only."
          >
            <Select value={ledgerAccountId} onValueChange={setLedgerAccountId}>
              <SelectTrigger id="bank_ledger">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.account_code} — {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
              aria-describedby="bank_default_hint"
            />
            <span>
              <span className="text-td font-medium">Use as the default account</span>
              <span id="bank_default_hint" className="block text-helper text-muted-foreground">
                Preselected when paying an expense. Only one account can be the default — setting
                this stands the current one down.
              </span>
            </span>
          </label>

          <Field label="Notes" htmlFor="bank_notes">
            <Textarea
              id="bank_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {account ? "Save changes" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { BankAccountInput, BankAccountRow };
