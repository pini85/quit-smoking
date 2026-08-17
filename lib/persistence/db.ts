import Dexie, { type Table } from 'dexie';
import type {
  QuitProfile,
  CravingSession,
  AchievementUnlock,
  PersonalReason,
  Preferences,
} from '@/domain/types';

export class QuitDb extends Dexie {
  profile!: Table<QuitProfile, string>;
  cravings!: Table<CravingSession, string>;
  achievementUnlocks!: Table<AchievementUnlock, string>;
  reasons!: Table<PersonalReason, string>;
  preferences!: Table<Preferences, string>;

  constructor(name = 'quit-smoking') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      cravings: 'id, startedAt, trigger, outcome',
      achievementUnlocks: 'id',
      reasons: 'id, createdAt',
      preferences: 'id',
    });
  }
}

export function createDb(name?: string): QuitDb {
  return new QuitDb(name);
}
