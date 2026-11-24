"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { cn, formatDate, formatNumber } from "@/lib/format";
import type { AdminUser } from "@/lib/types";
import s from "./admin.module.css";

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const users = useSWR(["admin-users", query, offset] as const, ([, q, start]) => api.adminUsers(q, start));
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditing(null);
    setOffset(0);
    setQuery(search.trim());
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim() || null;
    setSaving(true);
    setMessage(undefined);
    try {
      await api.adminUpdateUser(editing.id, { full_name: value("full_name"), company: value("company"), phone: value("phone") });
      setEditing(null);
      await users.mutate();
      setMessage({ text: "User profile updated." });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Couldn’t save user.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.55rem)] font-bold tracking-tight">Users</h1>
        <p className={cn(s.muted, "mt-1 text-sm")}>Search accounts, view credit balances, and edit contact details.</p>
      </header>
      {message && <p role={message.error ? "alert" : "status"} className={cn(s.panel, "p-3 text-sm", message.error ? "text-rose-200" : "text-emerald-200")}>{message.text}</p>}
      <section aria-label="User directory" className={cn(s.panel, "overflow-hidden")}>
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold">User directory</h2>
          <form onSubmit={runSearch} className="flex min-w-0 flex-wrap gap-2" role="search">
            <label htmlFor="admin-user-search" className="sr-only">Search users</label>
            <input id="admin-user-search" className={cn(s.input, "min-w-0 flex-1 sm:min-w-52")} placeholder="Name, email or company" maxLength={120}
              value={search} onChange={(event) => setSearch(event.target.value)} />
            <button className={s.button} type="submit" disabled={saving}>Search</button>
          </form>
        </header>
        {editing && (
          <form key={editing.id} onSubmit={saveUser} className="space-y-3 border-t border-white/10 bg-[#251e34] p-5">
            <h3 className="break-all text-sm font-semibold">Edit {editing.email}</h3>
            <fieldset disabled={saving} className="grid gap-3 md:grid-cols-3">
              <label className={cn(s.muted, "text-xs font-semibold")}>Name<input name="full_name" className={cn(s.input, "mt-1 block w-full")} maxLength={120} defaultValue={editing.full_name ?? ""} /></label>
              <label className={cn(s.muted, "text-xs font-semibold")}>Company<input name="company" className={cn(s.input, "mt-1 block w-full")} maxLength={120} defaultValue={editing.company ?? ""} /></label>
              <label className={cn(s.muted, "text-xs font-semibold")}>Contact<input name="phone" type="tel" className={cn(s.input, "mt-1 block w-full")} maxLength={20} defaultValue={editing.phone ?? ""} /></label>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={s.button} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              <button type="button" className={s.button} disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        )}
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead><tr><th scope="col">User</th><th scope="col">Company</th><th scope="col">Contact</th><th scope="col">Credits</th><th scope="col">Joined</th><th scope="col"><span className="sr-only">Manage</span></th></tr></thead>
            <tbody>
              {users.data?.users.map((user) => (
                <tr key={user.id}>
                  <td><p className="font-semibold">{user.full_name || "Unnamed user"}</p><p className={cn(s.muted, "text-xs")}>{user.email}</p></td>
                  <td>{user.company || "—"}</td><td className="whitespace-nowrap">{user.phone || "—"}</td>
                  <td className="tabular-nums">{formatNumber(user.balance)}</td><td className="whitespace-nowrap">{formatDate(user.created_at)}</td>
                  <td className="text-right"><button type="button" className={s.button} aria-label={`Edit ${user.email}`} disabled={saving} onClick={() => setEditing(user)}>Edit</button></td>
                </tr>
              ))}
              {!users.data?.users.length && <tr><td colSpan={6}><span className={s.muted}>{users.error ? "Couldn’t load users." : users.isLoading ? "Loading users…" : "No matching users."}</span>
                {users.error && <button className={cn(s.button, "ml-3")} onClick={() => void users.mutate()}>Retry</button>}</td></tr>}
            </tbody>
          </table>
        </div>
        {(offset > 0 || users.data?.next_offset != null) && (
          <div className="flex justify-end gap-2 border-t border-white/10 p-4">
            <button className={s.button} onClick={() => { setEditing(null); setOffset(Math.max(0, offset - 25)); }} disabled={saving || offset === 0 || users.isLoading}>Previous</button>
            <button className={s.button} onClick={() => { setEditing(null); setOffset(users.data?.next_offset ?? offset); }} disabled={saving || users.data?.next_offset == null || users.isLoading}>Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
