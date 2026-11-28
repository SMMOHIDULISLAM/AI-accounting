import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LedgerStorage } from "./db";

export const cloudEnabled = import.meta.env.VITE_CLOUD_MODE === "true";
export type Company = {
  id: string;
  name: string;
  trial_started_at: string;
  trial_ends_at: string;
};
let instance: SupabaseClient | undefined;
export function cloudClient(): SupabaseClient {
  if (!instance) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !key.startsWith("sb_publishable_"))
      throw Error("Cloud registration is not configured.");
    instance = createClient(url, key);
  }
  return instance;
}
export class CompanyDocument {
  private revision: number | undefined;
  constructor(
    private client: SupabaseClient,
    private table: "accounting_ledgers" | "accounting_operations",
    private companyId: string,
  ) {}
  async load(): Promise<unknown | undefined> {
    const { data, error } = await this.client
      .from(this.table)
      .select("content,revision")
      .eq("company_id", this.companyId)
      .maybeSingle();
    if (error) throw error;
    this.revision = data ? Number(data.revision) : undefined;
    return data?.content;
  }
  async save(content: unknown): Promise<void> {
    if (this.revision === undefined) {
      const { data, error } = await this.client
        .from(this.table)
        .insert({ company_id: this.companyId, content })
        .select("revision")
        .single();
      if (error)
        throw Error(
          "Cloud save failed or another session created this workspace. Reload before retrying.",
        );
      this.revision = Number(data.revision);
    } else {
      const { data, error } = await this.client
        .from(this.table)
        .update({ content })
        .eq("company_id", this.companyId)
        .eq("revision", this.revision)
        .select("revision")
        .maybeSingle();
      if (error || !data)
        throw Error(
          "Cloud save was refused, the trial expired, or another session changed the record. Download your backup and reload.",
        );
      this.revision = Number(data.revision);
    }
  }
}
export function companyLedgerStorage(
  company: Company,
  client = cloudClient(),
): LedgerStorage {
  const document = new CompanyDocument(
    client,
    "accounting_ledgers",
    company.id,
  );
  return {
    id: "cloud-company-" + company.id,
    async read() {
      const value = await document.load();
      if (value === undefined) return undefined;
      if (typeof value !== "string" || value.length > 5500000)
        throw Error("Invalid cloud ledger backup");
      return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    },
    async write(bytes) {
      if (bytes.byteLength > 4_000_000)
        throw Error(
          "Cloud trial ledger limit is 4 MB. Export a backup for local use.",
        );
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      await document.save(btoa(binary));
    },
  };
}
