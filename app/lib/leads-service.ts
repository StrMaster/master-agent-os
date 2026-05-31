import { getSupabase } from "@/app/lib/supabase";

export type Lead = {
  id?: string;
  name: string;
  email?: string;
  company?: string;
  website?: string;
  industry?: string;
  status: "new" | "contacted" | "replied" | "qualified" | "closed";
  source?: string;
  notes?: string;
  outreachCount: number;
  lastContactedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function saveLead(lead: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads")
    .upsert({
      ...lead,
      created_at: now,
      updated_at: now,
    }, { onConflict: "email" })
    .select()
    .single();

  if (error) return null;
  return data as Lead;
}

export async function getLeads(status?: Lead["status"]): Promise<Lead[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as Lead[];
}

export async function updateLeadStatus(id: string, status: Lead["status"], notes?: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("leads")
    .update({
      status,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return !error;
}

export async function incrementOutreachCount(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.rpc("increment_outreach_count", { lead_id: id });
  await supabase
    .from("leads")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", id);
}
