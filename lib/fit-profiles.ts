import "server-only";

import { z } from "zod";

import { getDb } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { checkedMeasurements, measurementSetSchema, type MeasurementSet } from "@/lib/measurements";

// Saved measurements ("fit profiles") for signed-in customers. Every function takes the
// customer's id and only ever touches that customer's profiles.

export const MAX_FIT_PROFILES = 10;

export type FitProfile = {
  id: string;
  name: string;
  updatedAt: Date;
  /** Null if the saved values no longer pass the checks (e.g. a range changed). */
  set: MeasurementSet | null;
  kind: MeasurementSet["kind"];
};

export const profileNameSchema = z.string().trim().min(1).max(40);

export const fitProfileInputSchema = z.object({
  /** Leave out to add a new profile. */
  id: z.uuid().optional(),
  name: profileNameSchema,
  set: measurementSetSchema,
});

export type FitProfileInput = z.input<typeof fitProfileInputSchema>;

export class FitProfileError extends Error {
  constructor(readonly reason: "name_taken" | "too_many" | "not_found") {
    super(reason);
    this.name = "FitProfileError";
  }
}

type Row = {
  id: string;
  name: string;
  kind: MeasurementSet["kind"];
  unit: string;
  measurements: Prisma.JsonValue;
  updatedAt: Date;
};

function toProfile(row: Row): FitProfile {
  const stored = (row.measurements ?? {}) as { values?: unknown; notes?: unknown };
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    updatedAt: row.updatedAt,
    set: checkedMeasurements({
      kind: row.kind,
      unit: row.unit,
      values: stored.values,
      ...(typeof stored.notes === "string" ? { notes: stored.notes } : {}),
    }),
  };
}

const select = {
  id: true,
  name: true,
  kind: true,
  unit: true,
  measurements: true,
  updatedAt: true,
} as const;

export async function listFitProfiles(userId: string): Promise<FitProfile[]> {
  const rows = await getDb().fitProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select,
  });
  return rows.map(toProfile);
}

export async function getFitProfile(userId: string, id: string): Promise<FitProfile | null> {
  const row = await getDb().fitProfile.findFirst({ where: { id, userId }, select });
  return row ? toProfile(row) : null;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Adds a profile, or updates one of this customer's profiles. Input is checked again here. */
export async function saveFitProfile(
  userId: string,
  rawInput: FitProfileInput,
): Promise<FitProfile> {
  const input = fitProfileInputSchema.parse(rawInput);
  const data = {
    name: input.name,
    kind: input.set.kind,
    unit: input.set.unit,
    measurements: {
      values: input.set.values,
      ...(input.set.notes ? { notes: input.set.notes } : {}),
    } as Prisma.InputJsonObject,
  };
  const db = getDb();
  try {
    if (input.id) {
      const { count } = await db.fitProfile.updateMany({ where: { id: input.id, userId }, data });
      if (count === 0) throw new FitProfileError("not_found");
      return toProfile(await db.fitProfile.findUniqueOrThrow({ where: { id: input.id }, select }));
    }
    if ((await db.fitProfile.count({ where: { userId } })) >= MAX_FIT_PROFILES) {
      throw new FitProfileError("too_many");
    }
    return toProfile(await db.fitProfile.create({ data: { ...data, userId }, select }));
  } catch (error) {
    if (isUniqueViolation(error)) throw new FitProfileError("name_taken");
    throw error;
  }
}

export async function deleteFitProfile(userId: string, id: string): Promise<boolean> {
  const { count } = await getDb().fitProfile.deleteMany({ where: { id, userId } });
  return count > 0;
}
