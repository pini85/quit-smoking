// Shared, cross-screen strings. Leaves must stay inferred as `string` (no
// `as const`) so the Finnish dictionary can `satisfies Messages` with
// different text.
export const common = {
  saveFailed: "Couldn't save — please try again.",
};
