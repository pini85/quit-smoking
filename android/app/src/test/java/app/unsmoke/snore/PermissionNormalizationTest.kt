package app.unsmoke.snore

import com.getcapacitor.PermissionState
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for [PermissionNormalization] — covers IMPORTANT review
 * findings 3 and 4: `PermissionState.PROMPT_WITH_RATIONALE` must never
 * escape the frozen `'granted' | 'denied' | 'prompt'` union from
 * `lib/native/snoreMonitor.ts`, and the `notifications` alias must report
 * `'granted'` on API < 33 regardless of the underlying (raw) check.
 */
class PermissionNormalizationTest {

    private val preNotificationsApi = 32
    private val postNotificationsApi = 33

    // --- microphone alias: sdkInt is irrelevant, only the raw state maps -----

    @Test
    fun `microphone alias maps GRANTED to granted`() {
        assertEquals(
            "granted",
            PermissionNormalization.normalize("microphone", PermissionState.GRANTED, postNotificationsApi),
        )
    }

    @Test
    fun `microphone alias maps DENIED to denied`() {
        assertEquals(
            "denied",
            PermissionNormalization.normalize("microphone", PermissionState.DENIED, postNotificationsApi),
        )
    }

    @Test
    fun `microphone alias maps PROMPT to prompt`() {
        assertEquals(
            "prompt",
            PermissionNormalization.normalize("microphone", PermissionState.PROMPT, postNotificationsApi),
        )
    }

    @Test
    fun `microphone alias collapses PROMPT_WITH_RATIONALE to prompt`() {
        assertEquals(
            "prompt",
            PermissionNormalization.normalize("microphone", PermissionState.PROMPT_WITH_RATIONALE, postNotificationsApi),
        )
    }

    @Test
    fun `microphone alias maps a missing (null) raw state to prompt`() {
        assertEquals(
            "prompt",
            PermissionNormalization.normalize("microphone", null, postNotificationsApi),
        )
    }

    @Test
    fun `microphone alias is unaffected by sdkInt in either direction`() {
        assertEquals(
            "granted",
            PermissionNormalization.normalize("microphone", PermissionState.GRANTED, preNotificationsApi),
        )
        assertEquals(
            "denied",
            PermissionNormalization.normalize("microphone", PermissionState.DENIED, preNotificationsApi),
        )
    }

    // --- notifications alias: below API 33, always 'granted' regardless of raw --

    @Test
    fun `notifications alias reports granted below API 33 even when raw is DENIED`() {
        assertEquals(
            "granted",
            PermissionNormalization.normalize("notifications", PermissionState.DENIED, preNotificationsApi),
        )
    }

    @Test
    fun `notifications alias reports granted below API 33 even when raw is null`() {
        assertEquals(
            "granted",
            PermissionNormalization.normalize("notifications", null, preNotificationsApi),
        )
    }

    @Test
    fun `notifications alias reports granted below API 33 even when raw is PROMPT_WITH_RATIONALE`() {
        assertEquals(
            "granted",
            PermissionNormalization.normalize("notifications", PermissionState.PROMPT_WITH_RATIONALE, preNotificationsApi),
        )
    }

    // --- notifications alias: at/above API 33, the raw state maps normally ------

    @Test
    fun `notifications alias maps the raw state normally at API 33 and above`() {
        assertEquals(
            "granted",
            PermissionNormalization.normalize("notifications", PermissionState.GRANTED, postNotificationsApi),
        )
        assertEquals(
            "denied",
            PermissionNormalization.normalize("notifications", PermissionState.DENIED, postNotificationsApi),
        )
        assertEquals(
            "prompt",
            PermissionNormalization.normalize("notifications", PermissionState.PROMPT, postNotificationsApi),
        )
    }

    @Test
    fun `notifications alias collapses PROMPT_WITH_RATIONALE to prompt at API 33 and above`() {
        assertEquals(
            "prompt",
            PermissionNormalization.normalize("notifications", PermissionState.PROMPT_WITH_RATIONALE, postNotificationsApi),
        )
    }
}
