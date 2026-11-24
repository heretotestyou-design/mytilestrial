"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAccount } from "./hooks";

type Form = { full_name: string; company: string; phone: string };
const FIELDS: (keyof Form)[] = ["full_name", "company", "phone"];

export function ProfileCard() {
  const { account, setAccount } = useAccount();
  const toast = useToast();
  const initial = useMemo<Form>(
    () => ({
      full_name: account?.profile.full_name ?? "",
      company: account?.profile.company ?? "",
      phone: account?.profile.phone ?? "",
    }),
    [account],
  );
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const dirty = FIELDS.some((k) => form[k].trim() !== initial[k]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        full_name: form.full_name.trim() || null,
        company: form.company.trim() || null,
        phone: form.phone.trim() || null,
      });
      await setAccount(updated);
      toast("Profile saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save your profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  const bind = (key: keyof Form) => ({
    id: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input bg-white/80",
  });

  return (
    <form onSubmit={save}>
      <Card
        title="Profile"
        description="Used on your invoices and when our team contacts you."
        footer={
          <>
            {dirty && <span className="mr-auto text-[12.5px] text-stone-600">You have unsaved changes</span>}
            <Button type="submit" loading={saving} disabled={!account || !dirty}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name">
            <input maxLength={120} required autoComplete="name" {...bind("full_name")} />
          </Field>
          <Field label="Company" optional htmlFor="company">
            <input maxLength={120} autoComplete="organization" placeholder="Sharma Tiles" {...bind("company")} />
          </Field>
          <Field label="Phone" optional htmlFor="phone" className="sm:col-span-2">
            <input type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={20} {...bind("phone")} />
          </Field>
        </div>
      </Card>
    </form>
  );
}

function Field({ label, htmlFor, optional, className, children }: Readonly<{ label: string; htmlFor: string; optional?: boolean; className?: string; children: React.ReactNode }>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label} {optional && <span className="font-normal text-stone-500">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
