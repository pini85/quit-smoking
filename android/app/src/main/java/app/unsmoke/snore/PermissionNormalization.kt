package app.unsmoke.snore

import com.getcapacitor.PermissionState

/**
 * Pure normalization of Capacitor's own raw permission-check result into
 * exactly the frozen `PermissionState` union (`'granted' | 'denied' |
 * 'prompt'`) from `lib/native/snoreMonitor.ts`. Pulled out of
 * [SnoreMonitorPlugin] specifically so it's unit-testable on the plain JVM
 * (no Robolectric, no `android.content`/`Plugin` dependency, no direct
 * `Build.VERSION.SDK_INT` read) — see `SnoreMonitorPluginTest.kt`.
 */
object PermissionNormalization {

    /**
     * @param alias the permission alias being normalized (compared against
     *   [ALIAS_NOTIFICATIONS] — the only alias with API-version-dependent
     *   behavior).
     * @param raw Capacitor's raw `PermissionState` for this alias (`null` if
     *   it wasn't present in the checked map at all).
     * @param sdkInt the running `Build.VERSION.SDK_INT`, passed in by the
     *   caller rather than read here directly, so this function stays pure.
     */
    fun normalize(alias: String, raw: PermissionState?, sdkInt: Int): String {
        // POST_NOTIFICATIONS is only a real runtime permission from API 33
        // onward; below that, ActivityCompat.checkSelfPermission has
        // nothing to grant and reports it as not granted, which would
        // otherwise surface as 'denied'/'prompt' instead of the
        // brief-mandated 'granted' on those older OS versions.
        if (alias == ALIAS_NOTIFICATIONS && sdkInt < 33) {
            return PermissionState.GRANTED.toString()
        }
        return when (raw) {
            PermissionState.GRANTED -> PermissionState.GRANTED.toString()
            PermissionState.DENIED -> PermissionState.DENIED.toString()
            // PROMPT and PROMPT_WITH_RATIONALE (Capacitor's own extra nuance
            // for "show a rationale before re-prompting") both collapse to
            // 'prompt': the frozen PermissionState union has no
            // 'prompt-with-rationale', and it must never escape this bridge.
            else -> PermissionState.PROMPT.toString()
        }
    }
}
