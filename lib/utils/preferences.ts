import type { Preferences } from '@/domain/types';
import { toLocalIso } from './iso';

/**
 * Fallback used when a write needs a full `Preferences` object but none has
 * been persisted yet. Defensive only — onboarding (`WelcomeWizard`) always
 * saves a real one, so this exists purely so You-screen writes (money
 * equivalents, install-hint dismissal, etc.) never crash on a theoretical
 * `null` preferences row.
 */
export function defaultPreferences(now: Date): Preferences {
  return {
    id: 'singleton',
    theme: 'system',
    showEmergingEvidence: true,
    updatedAt: toLocalIso(now),
  };
}

export default defaultPreferences;
