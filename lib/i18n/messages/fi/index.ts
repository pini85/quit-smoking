import type { Messages } from '../en';
import { common } from './common';
import { chrome } from './chrome';
import { home } from './home';
import { craving } from './craving';
import { freedom } from './freedom';
import { brain } from './brain';
import { you } from './you';

// `satisfies Messages` makes en/fi key parity a typecheck failure, not a
// runtime surprise. Hand-edit the text freely; the shape is locked.
export const fi = {
  common,
  chrome,
  home,
  craving,
  freedom,
  brain,
  you,
} satisfies Messages;
