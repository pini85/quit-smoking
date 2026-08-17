import type {
  QuitProfile,
  CravingSession,
  AchievementUnlock,
  PersonalReason,
  Preferences,
} from '@/domain/types';

export interface ProfileRepository {
  get(): Promise<QuitProfile | undefined>;
  save(p: QuitProfile): Promise<void>;
}

export interface CravingRepository {
  add(s: CravingSession): Promise<void>;
  update(s: CravingSession): Promise<void>; // full put by id
  get(id: string): Promise<CravingSession | undefined>;
  getAll(): Promise<CravingSession[]>; // sorted by startedAt ascending
  getOpen(): Promise<CravingSession[]>; // outcome == null (for the abandonment finalizer)
  bulkPut(s: CravingSession[]): Promise<void>;
}

export interface AchievementRepository {
  getUnlocks(): Promise<AchievementUnlock[]>;
  addUnlocks(u: AchievementUnlock[]): Promise<void>; // idempotent put
}

export interface ReasonRepository {
  getAll(): Promise<PersonalReason[]>; // sorted by createdAt asc
  add(r: PersonalReason): Promise<void>;
  update(r: PersonalReason): Promise<void>;
  remove(id: string): Promise<void>;
  bulkPut(r: PersonalReason[]): Promise<void>;
}

export interface PreferencesRepository {
  get(): Promise<Preferences | undefined>;
  save(p: Preferences): Promise<void>;
}

export interface Snapshot {
  profile: QuitProfile | null;
  cravings: CravingSession[];
  achievementUnlocks: AchievementUnlock[];
  reasons: PersonalReason[];
  preferences: Preferences | null;
}

export interface Repositories {
  profile: ProfileRepository;
  cravings: CravingRepository;
  achievements: AchievementRepository;
  reasons: ReasonRepository;
  preferences: PreferencesRepository;
  readSnapshot(): Promise<Snapshot>; // one consistent read across all stores
  replaceAll(s: Snapshot): Promise<void>; // transactional: clear all stores + write snapshot
  clearAll(): Promise<void>;
}
