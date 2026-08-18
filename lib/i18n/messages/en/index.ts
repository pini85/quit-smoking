import { common } from './common';
import { chrome } from './chrome';
import { home } from './home';
import { craving } from './craving';
import { freedom } from './freedom';
import { brain } from './brain';
import { you } from './you';

/**
 * The English dictionary is the schema: `Messages` is inferred from it, and
 * `fi` must `satisfies Messages`, so a key missing from either locale is a
 * compile error — parity needs no runtime test. Text is looked up by object
 * path (`m.common.saveFailed`), never by string key.
 */
export const en = {
  common,
  chrome,
  home,
  craving,
  freedom,
  brain,
  you,
};

export type Messages = typeof en;
