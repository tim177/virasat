import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { getDb } from "@/lib/db";
import {
  deleteFitProfile,
  FitProfileError,
  getFitProfile,
  listFitProfiles,
  MAX_FIT_PROFILES,
  saveFitProfile,
} from "@/lib/fit-profiles";
import { Prisma } from "@/lib/generated/prisma/client";
import type { MeasurementSet } from "@/lib/measurements";

// Fit profiles against the real database: each customer only reaches their own, and the
// database rules hold. Every user made here is deleted (their profiles go with them).

const db = getDb();
const DOMAIN = "@it-fit.example.com";

afterEach(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
});

afterAll(async () => {
  await db.$disconnect();
});

async function newCustomer() {
  return db.user.create({
    data: { email: `c-${randomUUID().slice(0, 8)}${DOMAIN}`, name: "", emailVerified: true },
  });
}

const mens: MeasurementSet = {
  kind: "men",
  unit: "in",
  values: {
    chest: 40,
    shoulder: 18,
    neck: 15.5,
    upperArm: 13,
    waist: 34,
    seat: 40,
    sleeveLength: 25,
    kurtaLength: 40,
    trouserLength: 40,
    height: 70,
  },
};

describe("fit profiles", () => {
  it("saves, lists, updates and deletes a customer's profiles", async () => {
    const customer = await newCustomer();
    const saved = await saveFitProfile(customer.id, { name: "  Me  ", set: mens });
    expect(saved).toMatchObject({ name: "Me", kind: "men", set: mens });

    const updated = await saveFitProfile(customer.id, {
      id: saved.id,
      name: "Me",
      set: {
        ...mens,
        unit: "cm",
        values: {
          ...mens.values,
          chest: 101.5,
          neck: 39,
          shoulder: 46,
          upperArm: 33,
          waist: 86,
          seat: 101,
          sleeveLength: 63.5,
          kurtaLength: 101.5,
          trouserLength: 101.5,
          height: 178,
        },
        notes: "Slim fit",
      },
    });
    expect(updated.set).toMatchObject({ unit: "cm", notes: "Slim fit", values: { chest: 101.5 } });
    expect(await listFitProfiles(customer.id)).toHaveLength(1);

    expect(await deleteFitProfile(customer.id, saved.id)).toBe(true);
    expect(await listFitProfiles(customer.id)).toEqual([]);
  });

  it("keeps each customer's profiles to themselves", async () => {
    const owner = await newCustomer();
    const other = await newCustomer();
    const profile = await saveFitProfile(owner.id, { name: "Me", set: mens });

    expect(await getFitProfile(other.id, profile.id)).toBeNull();
    expect(await listFitProfiles(other.id)).toEqual([]);
    await expect(
      saveFitProfile(other.id, { id: profile.id, name: "Mine now", set: mens }),
    ).rejects.toMatchObject({ reason: "not_found" });
    expect(await deleteFitProfile(other.id, profile.id)).toBe(false);
    expect((await getFitProfile(owner.id, profile.id))?.name).toBe("Me");
  });

  it("refuses a second profile with the same name, and more than the limit", async () => {
    const customer = await newCustomer();
    await saveFitProfile(customer.id, { name: "Me", set: mens });
    await expect(saveFitProfile(customer.id, { name: "Me", set: mens })).rejects.toEqual(
      new FitProfileError("name_taken"),
    );
    for (let i = 1; i < MAX_FIT_PROFILES; i += 1) {
      await saveFitProfile(customer.id, { name: `Profile ${i}`, set: mens });
    }
    await expect(saveFitProfile(customer.id, { name: "One too many", set: mens })).rejects.toEqual(
      new FitProfileError("too_many"),
    );
  });

  it("checks the measurements and the name before saving", async () => {
    const customer = await newCustomer();
    await expect(
      saveFitProfile(customer.id, {
        name: "Me",
        set: { ...mens, values: { ...mens.values, chest: 5 } },
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(saveFitProfile(customer.id, { name: "   ", set: mens })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      saveFitProfile(customer.id, { name: "x".repeat(41), set: mens }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await db.fitProfile.count({ where: { userId: customer.id } })).toBe(0);
  });

  it("goes when the customer's account is deleted", async () => {
    const customer = await newCustomer();
    await saveFitProfile(customer.id, { name: "Me", set: mens });
    await db.user.delete({ where: { id: customer.id } });
    expect(await db.fitProfile.count({ where: { userId: customer.id } })).toBe(0);
  });
});

describe("fit profile database rules", () => {
  async function insert(overrides: Record<string, unknown>) {
    const customer = await newCustomer();
    return db.fitProfile.create({
      data: {
        userId: customer.id,
        name: "Me",
        kind: "men",
        unit: "in",
        measurements: { values: mens.values },
        ...overrides,
      },
    });
  }

  it.each([
    ["a blank name", { name: "   " }],
    ["untrimmed name", { name: " Me" }],
    ["a name over 40 characters", { name: "x".repeat(41) }],
    ["an unknown unit", { unit: "mm" }],
    ["measurements without values", { measurements: { notes: "hi" } }],
    ["measurements that aren't an object", { measurements: [1, 2] }],
  ])("rejects %s", async (_name, overrides) => {
    await expect(insert(overrides)).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
