import type { Messages } from '../en';
import { common } from './common';
import { chrome } from './chrome';
import { home } from './home';
import { you } from './you';

// `satisfies Messages` makes en/fi key parity a typecheck failure, not a
// runtime surprise. Hand-edit the text freely; the shape is locked.
export const fi = {
  common,
  chrome,
  home,
  you,
} satisfies Messages;
