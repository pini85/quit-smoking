import { common } from './common';

/**
 * The English dictionary is the schema: `Messages` is inferred from it, and
 * `fi` must `satisfies Messages`, so a key missing from either locale is a
 * compile error — parity needs no runtime test. Text is looked up by object
 * path (`m.common.saveFailed`), never by string key.
 */
export const en = {
  common,
};

export type Messages = typeof en;
