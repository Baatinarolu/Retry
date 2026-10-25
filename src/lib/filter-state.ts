export type FilterState = {
  from: string;
  to: string;
  accountId: string;
  instrument: string;
  strategyId: string;
  direction: string;
  session: string;
  reviewStatus: string;
};

export const emptyFilters: FilterState = {
  from: "",
  to: "",
  accountId: "",
  instrument: "",
  strategyId: "",
  direction: "",
  session: "",
  reviewStatus: "",
};

export function normalizeFilters(input: Partial<Record<keyof FilterState, unknown>> | null | undefined): FilterState {
  return Object.fromEntries(
    Object.keys(emptyFilters).map((key) => {
      const value = input?.[key as keyof FilterState];
      return [key, typeof value === "string" ? value : ""];
    }),
  ) as FilterState;
}

export function filterQuery(filters: FilterState) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}
