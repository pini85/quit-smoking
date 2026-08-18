import type { Messages } from '../en';
import { common } from './common';
import { chrome } from './chrome';
import { home } from './home';
import { craving } from './craving';
import { freedom } from './freedom';
import { brain } from './brain';
import { welcome } from './welcome';
import { you } from './you';
import { progress } from './progress';
import { health } from './health';
import { sleep } from './sleep';

// `satisfies Messages` makes en/fi key parity a typecheck failure, not a
// runtime surprise. Hand-edit the text freely; the shape is locked.
export const fi = {
  common,
  chrome,
  home,
  craving,
  freedom,
  brain,
  welcome,
  you,
  progress,
  health,
  sleep,
} satisfies Messages;
