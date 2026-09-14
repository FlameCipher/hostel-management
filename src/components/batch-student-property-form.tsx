"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  Check,
  LoaderCircle,
  PackageCheck,
  Plus,
  Trash2,
} from "lucide-react";

import {
  createStudentPropertyBatchAction,
  type BatchPropertyState,
} from "@/app/(app)/student-property/new/actions";
import { FormSelect } from "@/components/form-select";

type PropertyCategory =
  | "LAPTOP"
  | "SUITCASE"
  | "MATTRESS"
  | "ELECTRONICS"
  | "BICYCLE"
  | "OTHER";

type ItemCondition =
  | "NEW"
  | "GOOD"
  | "FAIR"
  | "DAMAGED"
  | "MISSING"
  | "NOT_APPLICABLE";

type PropertyItem = {
  id: string;
  name: string;
  category: PropertyCategory;
  checkInCondition: ItemCondition;
  description: string;
  source: "COMMON" | "CUSTOM";
};

type OccupancyOption = {
  id: string;
  label: string;
};

type CommonItem = {
  name: string;
  category: PropertyCategory;
};

const initialState: BatchPropertyState = {
  error: "",
};

const commonItems: CommonItem[] = [
  { name: "Laptop", category: "LAPTOP" },
  { name: "Mobile phone", category: "ELECTRONICS" },
  { name: "Tablet", category: "ELECTRONICS" },
  { name: "Television", category: "ELECTRONICS" },
  { name: "Radio / speaker", category: "ELECTRONICS" },
  { name: "Refrigerator", category: "ELECTRONICS" },
  { name: "Electric cooker", category: "ELECTRONICS" },
  { name: "Electric kettle", category: "ELECTRONICS" },
  { name: "Iron box", category: "ELECTRONICS" },
  { name: "Fan", category: "ELECTRONICS" },
  { name: "Bicycle", category: "BICYCLE" },
  { name: "Suitcase", category: "SUITCASE" },
  { name: "Mattress", category: "MATTRESS" },
];

const categories: Array<{
  value: PropertyCategory;
  label: string;
}> = [
  { value: "LAPTOP", label: "Laptop" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "BICYCLE", label: "Bicycle" },
  { value: "SUITCASE", label: "Suitcase" },
  { value: "MATTRESS", label: "Mattress" },
  { value: "OTHER", label: "Other" },
];

const conditions: Array<{
  value: ItemCondition;
  label: string;
}> = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
];

function commonItemId(name: string) {
  return `common-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function BatchStudentPropertyForm({
  occupancies,
  defaultOccupancyId = "",
}: {
  occupancies: OccupancyOption[];
  defaultOccupancyId?: string;
}) {
  const [state, action, pending] = useActionState(
    createStudentPropertyBatchAction,
    initialState,
  );

  const [items, setItems] = useState<PropertyItem[]>([]);

  const selectedCommonItems = useMemo(
    () =>
      new Set(
        items
          .filter((item) => item.source === "COMMON")
          .map((item) => item.name),
      ),
    [items],
  );

  function toggleCommonItem(commonItem: CommonItem) {
    setItems((currentItems) => {
      const exists = currentItems.some(
        (item) =>
          item.source === "COMMON" && item.name === commonItem.name,
      );

      if (exists) {
        return currentItems.filter(
          (item) =>
            !(
              item.source === "COMMON" &&
              item.name === commonItem.name
            ),
        );
      }

      return [
        ...currentItems,
        {
          id: commonItemId(commonItem.name),
          name: commonItem.name,
          category: commonItem.category,
          checkInCondition: "GOOD",
          description: "",
          source: "COMMON",
        },
      ];
    });
  }

  function addCustomItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: `custom-${crypto.randomUUID()}`,
        name: "",
        category: "OTHER",
        checkInCondition: "GOOD",
        description: "",
        source: "CUSTOM",
      },
    ]);
  }

  function updateItem(
    itemId: string,
    updates: Partial<PropertyItem>,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  }

  function removeItem(itemId: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    );
  }

  const itemsJson = JSON.stringify(
    items.map((item) => ({
      name: item.name,
      category: item.category,
      checkInCondition: item.checkInCondition,
      description: item.description,
    })),
  );

  return (
    <form action={action} className="panel entity-form">
      <input name="itemsJson" type="hidden" value={itemsJson} />

      <div className="form-section-heading">
        <div>
          <p className="panel-kicker">Student inventory</p>
          <h2>Register property items</h2>
          <p>
            Select all the items belonging to one student and save them
            together.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field-group form-span-2">
          <span>Student and room *</span>

          <FormSelect
            aria-label="Student and active room"
            defaultValue={defaultOccupancyId}
            name="occupancyId"
            required
          >
            <option value="">Select active occupancy</option>

            {occupancies.map((occupancy) => (
              <option key={occupancy.id} value={occupancy.id}>
                {occupancy.label}
              </option>
            ))}
          </FormSelect>

          <small>
            Search using the student’s name or room number.
          </small>
        </label>
      </div>

      <section className="mt-7">
        <div className="mb-4">
          <p className="panel-kicker">Common items</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Select everything the student brought
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            You can adjust the condition and details after selecting an
            item.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {commonItems.map((item) => {
            const selected = selectedCommonItems.has(item.name);

            return (
              <button
                aria-pressed={selected}
                className={[
                  "flex min-h-20 items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50",
                ].join(" ")}
                key={item.name}
                onClick={() => toggleCommonItem(item)}
                type="button"
              >
                <span className="text-sm font-medium">{item.name}</span>

                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 text-transparent",
                  ].join(" ")}
                >
                  <Check aria-hidden="true" size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 border-t border-slate-200 pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="panel-kicker">Selected property</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">
              {items.length
                ? `${items.length} item${items.length === 1 ? "" : "s"} selected`
                : "No items selected"}
            </h3>
          </div>

          <button
            className="secondary-button"
            onClick={addCustomItem}
            type="button"
          >
            <Plus size={17} />
            Add another item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <PackageCheck
              className="mx-auto text-slate-400"
              size={28}
            />
            <p className="mt-3 font-medium text-slate-700">
              Select common items above or add a custom item.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {items.map((item, index) => (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                key={item.id}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <strong className="text-sm text-slate-900">
                    Item {index + 1}
                  </strong>

                  <button
                    aria-label={`Remove ${item.name || "custom item"}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                    onClick={() => removeItem(item.id)}
                    type="button"
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field-group">
                    <span>Item name *</span>
                    <input
                      maxLength={80}
                      onChange={(event) =>
                        updateItem(item.id, {
                          name: event.target.value,
                        })
                      }
                      readOnly={item.source === "COMMON"}
                      required
                      value={item.name}
                    />
                  </label>

                  <label className="field-group">
                    <span>Category *</span>
                    <select
                      onChange={(event) =>
                        updateItem(item.id, {
                          category: event.target
                            .value as PropertyCategory,
                        })
                      }
                      value={item.category}
                    >
                      {categories.map((category) => (
                        <option
                          key={category.value}
                          value={category.value}
                        >
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-group">
                    <span>Check-in condition *</span>
                    <select
                      onChange={(event) =>
                        updateItem(item.id, {
                          checkInCondition: event.target
                            .value as ItemCondition,
                        })
                      }
                      value={item.checkInCondition}
                    >
                      {conditions.map((condition) => (
                        <option
                          key={condition.value}
                          value={condition.value}
                        >
                          {condition.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-group">
                    <span>Description or identifying details</span>
                    <input
                      maxLength={250}
                      onChange={(event) =>
                        updateItem(item.id, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Colour, model, serial number, etc."
                      value={item.description}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {state.error ? (
        <p className="form-error mt-5" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="form-actions">
        <Link
          className="secondary-button no-underline"
          href="/student-property"
        >
          Cancel
        </Link>

        <button
          className="primary-button"
          disabled={pending || items.length === 0}
          type="submit"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <PackageCheck size={17} />
          )}

          {pending
            ? "Saving property..."
            : `Save ${items.length || ""} item${
                items.length === 1 ? "" : "s"
              }`}
        </button>
      </div>
    </form>
  );
}