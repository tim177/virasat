import Form from "next/form";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup } from "@/components/ui/choice";
import { categories, categoryByValue, occasionLabels } from "@/lib/catalog";
import type { Occasion } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import type { ListingQuery } from "@/lib/listing-params";

export type Facets = { colours: string[]; fabrics: string[]; occasions: Occasion[] };

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="flex flex-col border-t border-line pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left mb-1 w-full text-body-sm font-medium">{legend}</legend>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          name={name}
          value={option.value}
          label={option.label}
          defaultChecked={selected.includes(option.value)}
        />
      ))}
    </fieldset>
  );
}

/**
 * Filters as a plain GET form: works without JavaScript, and with it next/form navigates
 * without a full page load. Submitting resets to page 1 and keeps the chosen sort.
 */
export function FilterForm({
  action,
  query,
  facets,
  allowCategory,
}: {
  action: string;
  query: ListingQuery;
  facets: Facets;
  allowCategory: boolean;
}) {
  return (
    <Form action={action} className="flex flex-col gap-5">
      {query.sort !== "newest" ? <input type="hidden" name="sort" value={query.sort} /> : null}

      {allowCategory ? (
        <RadioGroup
          legend={en.listing.category}
          name="category"
          defaultValue={query.category ? categoryByValue(query.category).slug : ""}
          options={[
            { value: "", label: en.listing.allCategories },
            ...categories.map((c) => ({ value: c.slug, label: c.label })),
          ]}
        />
      ) : null}

      <CheckboxGroup
        legend={en.listing.occasion}
        name="occasion"
        selected={query.occasions}
        options={facets.occasions.map((o) => ({ value: o, label: occasionLabels[o] }))}
      />
      <CheckboxGroup
        legend={en.listing.colour}
        name="colour"
        selected={query.colours}
        options={facets.colours.map((c) => ({ value: c, label: c }))}
      />
      <CheckboxGroup
        legend={en.listing.fabric}
        name="fabric"
        selected={query.fabrics}
        options={facets.fabrics.map((f) => ({ value: f, label: f }))}
      />

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <Button type="submit" fullWidth>
          {en.listing.apply}
        </Button>
        <Link
          href={action}
          className="inline-flex min-h-11 items-center justify-center text-body-sm underline underline-offset-4"
        >
          {en.listing.clearAll}
        </Link>
      </div>
    </Form>
  );
}
