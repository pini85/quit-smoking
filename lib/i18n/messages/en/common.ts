// Shared, cross-screen strings. Leaves must stay inferred as `string` (no
// `as const`) so the Finnish dictionary can `satisfies Messages` with
// different text.
export const common = {
  saveFailed: "Couldn't save — please try again.",
  noted: 'Noted.',
  // Joiner for a two-item list built at runtime ("3 x and 1 y").
  andJoiner: ' and ',
  stepper: {
    decrease: 'Decrease {label}',
    increase: 'Increase {label}',
  },
};
