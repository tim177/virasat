"use client";

import Image from "next/image";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { saveProductAction, type ProductActionState } from "@/app/admin/(panel)/products/actions";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Checkbox, RadioGroup } from "@/components/ui/choice";
import { Input, Select, Textarea } from "@/components/ui/field";
import { AlertCircleIcon, CheckIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { slugify } from "@/lib/admin-products-input";
import { categories, genderLabels, occasionLabels } from "@/lib/catalog";
import type { Gender, Occasion, ProductStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import { MAX_IMAGE_BYTES } from "@/lib/image-file";
import { standardSizeLabels } from "@/lib/size-guide";

const t = en.admin.product;

/** The form's starting values; money and numbers as the text shown in the inputs. */
export type ProductFormInitial = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  gender: Gender;
  fabric: string;
  work: string;
  colour: string;
  occasions: Occasion[];
  care: string;
  hsCode: string;
  price: string;
  compareAt: string;
  readyDays: string;
  customFitAvailable: boolean;
  customFitExtra: string;
  customDays: string;
  status: ProductStatus;
  sizes: Array<{ id?: string; size: string; sku: string; stock: string }>;
  photos: Array<{ url: string; alt: string }>;
};

type SizeRow = ProductFormInitial["sizes"][number] & { key: string };
type PhotoRow = ProductFormInitial["photos"][number] & { key: string };

const newKey = () => crypto.randomUUID();

/** Stock as typed → the number sent to the server (-1 makes the server reject bad input). */
function stockValue(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : -1;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-card border border-line bg-white p-5 sm:p-6">
      <h2 className="font-display text-h3">{title}</h2>
      {children}
    </section>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-body-sm text-error">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

export function ProductForm({ initial, notice }: { initial: ProductFormInitial; notice?: string }) {
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(
    saveProductAction,
    null,
  );
  const errors = state?.fieldErrors ?? {};
  const summaryRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.id));
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [customFit, setCustomFit] = useState(initial.customFitAvailable);
  const [sizes, setSizes] = useState<SizeRow[]>(() =>
    initial.sizes.map((row) => ({ ...row, key: newKey() })),
  );
  const [photos, setPhotos] = useState<PhotoRow[]>(() =>
    initial.photos.map((photo) => ({ ...photo, key: newKey() })),
  );
  const [uploading, setUploading] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const lastAltRef = useRef<HTMLInputElement>(null);
  const focusNewPhoto = useRef(false);

  // After a failed save, move focus to the list of problems so it is read out.
  useEffect(() => {
    if (state && !state.ok) summaryRef.current?.focus();
  }, [state]);

  // After an upload, put the cursor in the new photo's description.
  useEffect(() => {
    if (focusNewPhoto.current) {
      focusNewPhoto.current = false;
      lastAltRef.current?.focus();
    }
  }, [photos.length]);

  function submit(event: FormEvent<HTMLFormElement>) {
    // Dispatched by hand so a failed save keeps what was typed (a form `action` resets it).
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErrors([]);
    for (const file of Array.from(files)) {
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadErrors((list) => [...list, t.uploadErrors.too_large(file.name)]);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.set("file", file);
        const response = await fetch("/api/admin/uploads", { method: "POST", body });
        const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
        if (response.ok && data.url) {
          focusNewPhoto.current = true;
          setPhotos((list) => [...list, { key: newKey(), url: data.url as string, alt: "" }]);
        } else {
          const message =
            data.error === "too_large" || data.error === "not_an_image"
              ? t.uploadErrors[data.error](file.name)
              : t.uploadErrors.failed(file.name);
          setUploadErrors((list) => [...list, message]);
        }
      } catch {
        setUploadErrors((list) => [...list, t.uploadErrors.failed(file.name)]);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function movePhoto(index: number, by: -1 | 1) {
    setPhotos((list) => {
      const next = [...list];
      const [photo] = next.splice(index, 1);
      next.splice(index + by, 0, photo);
      return next;
    });
  }

  function addStandardSizes() {
    setSizes((list) => {
      const have = new Set(list.map((row) => row.size.toLowerCase()));
      const extra = standardSizeLabels(gender)
        .filter((size) => !have.has(size.toLowerCase()))
        .map((size) => ({ key: newKey(), size, sku: "", stock: "" }));
      return [...list, ...extra];
    });
  }

  const sizesJson = JSON.stringify(
    sizes.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      size: row.size,
      sku: row.sku,
      stock: stockValue(row.stock),
    })),
  );
  const photosJson = JSON.stringify(photos.map(({ url, alt }) => ({ url, alt })));
  const errorList = Object.values(errors);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="sizes" value={sizesJson} />
      <input type="hidden" name="photos" value={photosJson} />

      {notice && !state ? (
        <p role="status" className="flex items-center gap-2 text-emerald-700">
          <CheckIcon className="size-4" />
          {notice}
        </p>
      ) : null}
      {state && !state.ok ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="flex flex-col gap-2 rounded-card border border-error bg-white p-4 text-error"
        >
          <p className="font-medium">{state.message}</p>
          <ul className="list-disc pl-5 text-body-sm">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title={t.sections.basics}>
        <Input
          label={t.title}
          name="title"
          value={title}
          maxLength={120}
          error={errors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
        <Input
          label={t.slug}
          name="slug"
          value={slug}
          maxLength={80}
          help={t.slugHelp(slug)}
          error={errors.slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
        />
        <Textarea
          label={t.description}
          name="description"
          defaultValue={initial.description}
          rows={6}
          maxLength={4000}
          error={errors.description}
        />
      </Section>

      <Section title={t.sections.details}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label={t.category}
            name="category"
            defaultValue={initial.category}
            placeholder={t.chooseCategory}
            options={categories.map((c) => ({ value: c.value, label: c.label }))}
            error={errors.category}
          />
          <Select
            label={t.gender}
            name="gender"
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender)}
            options={Object.entries(genderLabels).map(([value, label]) => ({ value, label }))}
            error={errors.gender}
          />
          <Input
            label={t.fabric}
            name="fabric"
            defaultValue={initial.fabric}
            error={errors.fabric}
          />
          <Input label={t.work} name="work" defaultValue={initial.work} error={errors.work} />
          <Input
            label={t.colour}
            name="colour"
            defaultValue={initial.colour}
            error={errors.colour}
          />
          <Input
            label={t.hsCode}
            name="hsCode"
            defaultValue={initial.hsCode}
            help={t.hsCodeHelp}
            inputMode="decimal"
            error={errors.hsCode}
          />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-body-sm font-medium">{t.occasions}</legend>
          <div className="grid gap-x-6 sm:grid-cols-3">
            {Object.entries(occasionLabels).map(([value, label]) => (
              <Checkbox
                key={value}
                name="occasions"
                value={value}
                label={label}
                defaultChecked={initial.occasions.includes(value as Occasion)}
              />
            ))}
          </div>
        </fieldset>
        <Textarea
          label={t.care}
          name="care"
          defaultValue={initial.care}
          rows={3}
          maxLength={1000}
          error={errors.care}
        />
      </Section>

      <Section title={t.sections.price}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label={t.price}
            name="price"
            defaultValue={initial.price}
            inputMode="decimal"
            help={t.priceHelp}
            error={errors.price}
          />
          <Input
            label={t.compareAt}
            name="compareAt"
            defaultValue={initial.compareAt}
            inputMode="decimal"
            help={t.compareAtHelp}
            optional
            error={errors.compareAt}
          />
          <Input
            label={t.readyDays}
            name="readyDays"
            defaultValue={initial.readyDays}
            inputMode="numeric"
            error={errors.readyDays}
          />
        </div>
        <Checkbox
          label={t.customFit}
          name="customFitAvailable"
          checked={customFit}
          onChange={(event) => setCustomFit(event.target.checked)}
        />
        {customFit ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label={t.customFitExtra}
              name="customFitExtra"
              defaultValue={initial.customFitExtra}
              inputMode="decimal"
              error={errors.customFitExtra}
            />
            <Input
              label={t.customDays}
              name="customDays"
              defaultValue={initial.customDays}
              inputMode="numeric"
              error={errors.customDays}
            />
          </div>
        ) : null}
      </Section>

      <Section title={t.sections.sizes}>
        <p className="text-body-sm text-stone-700">{t.sizesHelp}</p>
        <FieldError message={errors.sizes} />
        {sizes.length === 0 ? <p className="text-body-sm">{t.noSizes}</p> : null}
        <ul className="flex flex-col gap-4">
          {sizes.map((row, index) => (
            <li
              key={row.key}
              className="grid items-end gap-3 border-b border-line pb-4 sm:grid-cols-[2fr_1.5fr_1fr_auto]"
            >
              <Input
                label={t.size}
                value={row.size}
                maxLength={40}
                onChange={(event) =>
                  setSizes((list) =>
                    list.map((r, i) => (i === index ? { ...r, size: event.target.value } : r)),
                  )
                }
              />
              <Input
                label={t.sku}
                value={row.sku}
                maxLength={40}
                optional
                autoCapitalize="characters"
                onChange={(event) =>
                  setSizes((list) =>
                    list.map((r, i) => (i === index ? { ...r, sku: event.target.value } : r)),
                  )
                }
              />
              <Input
                label={t.stock}
                value={row.stock}
                inputMode="numeric"
                optional
                onChange={(event) =>
                  setSizes((list) =>
                    list.map((r, i) => (i === index ? { ...r, stock: event.target.value } : r)),
                  )
                }
              />
              <IconButton
                label={t.removeSize(row.size)}
                onClick={() => setSizes((list) => list.filter((_, i) => i !== index))}
              >
                <CloseIcon />
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              setSizes((list) => [...list, { key: newKey(), size: "", sku: "", stock: "" }])
            }
          >
            <PlusIcon className="size-4" />
            {t.addSize}
          </Button>
          <Button variant="ghost" onClick={addStandardSizes}>
            {t.addStandardSizes}
          </Button>
        </div>
      </Section>

      <Section title={t.sections.photos}>
        <p className="text-body-sm text-stone-700">{t.photosHelp}</p>
        <FieldError message={errors.photos} />
        {photos.length === 0 ? <p className="text-body-sm">{t.noPhotos}</p> : null}
        <ol className="flex flex-col gap-4">
          {photos.map((photo, index) => (
            <li key={photo.key} className="flex flex-wrap gap-4 border-b border-line pb-4">
              <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-card bg-jaali">
                <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" />
              </div>
              <div className="flex min-w-60 flex-1 flex-col gap-3">
                <p className="text-body-sm font-medium">{t.photoLabel(index + 1)}</p>
                <Input
                  ref={index === photos.length - 1 ? lastAltRef : undefined}
                  label={t.alt}
                  help={t.altHelp}
                  value={photo.alt}
                  maxLength={200}
                  onChange={(event) =>
                    setPhotos((list) =>
                      list.map((p, i) => (i === index ? { ...p, alt: event.target.value } : p)),
                    )
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    aria-disabled={index === 0 || undefined}
                    onClick={() => index > 0 && movePhoto(index, -1)}
                  >
                    {t.moveUp(index + 1)}
                  </Button>
                  <Button
                    variant="ghost"
                    aria-disabled={index === photos.length - 1 || undefined}
                    onClick={() => index < photos.length - 1 && movePhoto(index, 1)}
                  >
                    {t.moveDown(index + 1)}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPhotos((list) => list.filter((_, i) => i !== index))}
                  >
                    {t.removePhoto(index + 1)}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {uploadErrors.length > 0 ? (
          <ul role="alert" className="flex flex-col gap-1">
            {uploadErrors.map((message) => (
              <li key={message}>
                <FieldError message={message} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <label
            className={buttonClasses({
              variant: "secondary",
              className: "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2",
            })}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              className="sr-only"
              onChange={(event) => {
                void upload(event.target.files);
                event.target.value = "";
              }}
            />
            <PlusIcon className="size-4" />
            {t.addPhotos}
          </label>
          {uploading > 0 ? (
            <p role="status" className="text-body-sm text-stone-700">
              {t.uploading}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={t.sections.status}>
        <RadioGroup
          legend={t.sections.status}
          name="status"
          defaultValue={initial.status}
          options={[
            { value: "draft", label: t.statusDraft },
            { value: "published", label: t.statusPublished },
          ]}
          error={errors.status}
        />
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={pending || uploading > 0}>
          {t.save}
        </Button>
        {state?.ok ? (
          <p role="status" className="flex items-center gap-2 text-emerald-700">
            <CheckIcon className="size-4" />
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
