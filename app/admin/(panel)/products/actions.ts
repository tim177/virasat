"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { fieldErrors, productFormFields, productFormSchema } from "@/lib/admin-products-input";
import { ProductSaveError, saveProduct } from "@/lib/admin-products";
import { refreshShop } from "@/lib/cache-refresh";
import { en } from "@/lib/i18n/en";
import { clientIpFromHeaders } from "@/lib/rate-limit";

// Saving a product from the admin form: admin check (rule 7), Zod (rule 8), one transaction
// with its admin_log entry, then the shop pages are refreshed (rule 6).

export type ProductActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
} | null;

const t = en.admin.product;

const saveErrors: Record<string, { field: string; message: string }> = {
  slug_taken: { field: "slug", message: t.errors.slugTaken },
  sku_taken: { field: "sizes", message: t.errors.skuTaken },
  duplicate_size: { field: "sizes", message: t.errors.duplicateSize },
  unknown_size: { field: "sizes", message: t.errors.sizes },
  foreign_photo: { field: "photos", message: t.errors.photos },
  not_found: { field: "form", message: t.errors.notFound },
};

export async function saveProductAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const admin = await requireAdmin();
  const actor = { adminId: admin.id, ip: clientIpFromHeaders(await headers()) };

  const parsed = productFormSchema.safeParse(productFormFields(formData));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, message: t.fixErrors(Object.keys(errors).length), fieldErrors: errors };
  }

  let saved: Awaited<ReturnType<typeof saveProduct>>;
  try {
    saved = await saveProduct(parsed.data, actor);
  } catch (error) {
    if (error instanceof ProductSaveError) {
      const known = saveErrors[error.reason] ?? { field: "form", message: t.errors.sizes };
      return {
        ok: false,
        message: t.fixErrors(1),
        fieldErrors: { [known.field]: known.message },
      };
    }
    throw error;
  }

  refreshShop();
  if (saved.created) redirect(`/admin/products/${saved.id}?created=1`);
  refresh();
  return { ok: true, message: t.saved };
}
