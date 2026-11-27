"use server";

import { z } from "zod";

import { getCustomer } from "@/lib/customer-auth";
import {
  deleteFitProfile,
  FitProfileError,
  fitProfileInputSchema,
  listFitProfiles,
  saveFitProfile,
  type FitProfile,
} from "@/lib/fit-profiles";
import type { MeasurementKind, MeasurementSet } from "@/lib/measurements";

// Fit profiles for the signed-in customer, called from the measurement form (product page, bag)
// and the account pages. Each action reads the session itself and only touches that customer's
// profiles; input is checked with Zod (rule 8).

export type ProfileView = {
  id: string;
  name: string;
  kind: MeasurementKind;
  set: MeasurementSet | null;
};

export type SaveProfileResult =
  | { ok: true; profile: ProfileView }
  | { ok: false; error: "signed_out" | "invalid" | "name_taken" | "too_many" | "not_found" };

function view(profile: FitProfile): ProfileView {
  return { id: profile.id, name: profile.name, kind: profile.kind, set: profile.set };
}

/** This customer's profiles, or null when nobody is signed in. */
export async function getMyFitProfiles(): Promise<ProfileView[] | null> {
  const customer = await getCustomer();
  if (!customer) return null;
  return (await listFitProfiles(customer.id)).map(view);
}

export async function saveMyFitProfile(input: unknown): Promise<SaveProfileResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: "signed_out" };
  const parsed = fitProfileInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    return { ok: true, profile: view(await saveFitProfile(customer.id, parsed.data)) };
  } catch (error) {
    if (error instanceof FitProfileError) return { ok: false, error: error.reason };
    throw error;
  }
}

export async function deleteMyFitProfile(id: unknown): Promise<{ ok: boolean }> {
  const customer = await getCustomer();
  const parsed = z.uuid().safeParse(id);
  if (!customer || !parsed.success) return { ok: false };
  return { ok: await deleteFitProfile(customer.id, parsed.data) };
}
