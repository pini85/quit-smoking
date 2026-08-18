import type { Messages } from '../en';
import { common } from './common';

// `satisfies Messages` makes en/fi key parity a typecheck failure, not a
// runtime surprise. Hand-edit the text freely; the shape is locked.
export const fi = {
  common,
} satisfies Messages;
