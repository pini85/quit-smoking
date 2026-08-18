# Snore monitoring — manual Android verification checklist

Snore monitoring (`/sleep`) touches Android APIs that no unit or component
test can exercise: `MediaRecorder`, foreground services, notifications,
process death, and reboot. This checklist is for a human running the app on
a real device before this feature ships. Work through it in order — several
steps depend on state left behind by earlier ones (a completed night's
session, a running recording, etc.).

Build and install the debug APK first:

```
pnpm build:android && cd android && ./gradlew assembleDebug
```

The output lands in `android/app/build/outputs/apk/debug/app-debug.apk`.
Install it on the test device (`adb install -r app-debug.apk` or sideload).

## Checklist

1. **Install and open.** Install the debug APK. Open the app and navigate to
   Sleep — via the "Snoring" entry card on the Progress page, not a direct
   deep link, so the normal navigation path is exercised too.
2. **First Start prompts permissions.** Tap Start for the first time. Confirm
   the OS prompts for both microphone access and notification permission
   (the latter only matters on API 33+).
3. **Deny then grant microphone.** Deny the microphone prompt and confirm the
   screen shows a clear inline error (not a silent failure or a crash). Then
   grant the permission via Settings → Apps → Unsmoke → Permissions and
   confirm Start now succeeds.
4. **Persistent notification.** While monitoring is active, confirm a
   persistent "Snore monitoring active" notification is showing, and that its
   Stop action actually stops the recording (not just dismisses the
   notification).
5. **Lock through a segment rotation.** Start monitoring, lock the phone, and
   leave it locked for at least 25 minutes — long enough to span a 20-minute
   segment rotation. Reopen the app and confirm the elapsed duration and
   active/running state were restored correctly. Then confirm the rotation
   actually happened:
   - `adb shell run-as app.unsmoke ls files/snore/sessions/<id>/` should show
     both `seg_0000.m4a` and `seg_0001.m4a` (or later segments) for that
     session.
   - Check logcat for `NEXT_OUTPUT_FILE_STARTED` firing at the rotation
     boundary, and confirm there's no spurious "interrupted" state logged
     around the rotation — a false interruption there indicates the rotation
     handoff dropped a segment.
6. **Backgrounding.** Start monitoring, switch to a different app, and leave
   it in the foreground for 5 minutes. Return to Unsmoke and confirm
   recording never stopped.
7. **Double-tap guards.** Rapidly double-tap Start — confirm only a single
   recorder instance starts (not two overlapping recordings). Rapidly
   double-tap Stop — confirm only a single finalized result is produced (not
   a duplicate or corrupted session).
8. **Stop via notification after app is killed.** Start monitoring, then kill
   the app from the recent-apps list (not force-stop — just swipe it away).
   Use the notification's Stop action. Reopen the app and confirm the
   session was finalized and analysis ran normally.
9. **Force-stop mid-recording.** Start monitoring, then force-stop the app
   from Settings → Apps while it's recording. Reopen the app and confirm the
   session is reported as interrupted, and that whatever segments did
   complete before the kill are still analyzed (not discarded wholesale).
10. **Reboot mid-recording.** Start monitoring, then reboot the device while
    it's recording. After reboot, confirm the app does **not** auto-resume
    recording, and that the interrupted session is reported as such rather
    than silently lost or silently completed.
11. **Full overnight run.** Leave the phone on the charger near the bed
    overnight with monitoring on, and make some audible test snore-like
    sounds during the night. In the morning, confirm:
    - Snore events were detected and the summary metrics are plausible given
      the test sounds made.
    - If "keep audio clips" is ON, the loudest-event clips are present and
      playable; if OFF, no clips exist.
    - The full night's raw recording is deleted after analysis completes,
      regardless of the clips setting — the session directory should be
      gone, and only the clips directory (if the preference is on) should
      remain.
12. **Battery drain.** With the screen off and monitoring running, confirm
    battery drain stays under roughly 3-4%/hour. Separately, check whether
    the device's OEM battery-killer (common on Samsung and Xiaomi) kills the
    recording — if the OEM has an aggressive battery optimizer, confirm
    exempting the app from it (as the in-app guidance should instruct) fixes
    it.
13. **Logcat privacy check.** While a session is running and being analyzed,
    watch `adb logcat` for anything that shouldn't be there: no raw audio
    data, no file contents, nothing beyond session IDs, durations, and
    similar metadata.
14. **Pre-API-33 device (if available).** On a device below Android 13,
    confirm the notification-permission check reports "granted" without
    prompting (no runtime permission exists pre-33), and that recording works
    normally.
15. **Release-build manifest check.** Build a release variant and inspect the
    merged manifest (`apkanalyzer manifest print` or `aapt dump permissions`)
    to confirm both of the following. These are the two manifest-level
    guarantees the README's privacy section makes, and a Capacitor manifest
    regeneration can quietly drop either one:
    - It does **not** request the `INTERNET` permission — snore monitoring and
      its data must stay fully on-device. (Debug builds legitimately do declare
      it, for live reload; check the *release* merged manifest.)
    - The `<application>` tag carries
      `android:dataExtractionRules="@xml/data_extraction_rules"` alongside
      `android:allowBackup="false"`, and the referenced XML is present in the
      APK's `res/xml/` with the `files/snore/` and `snore_session.xml`
      exclusions intact under **both** `<cloud-backup>` and
      `<device-transfer>`.
16. **Short nap session.** Record a session under an hour (a nap rather than
    a full night). Confirm it's still analyzed and shown in history, but
    excluded from the trend charts (which should only reflect full-night
    data).
17. **Import/export round trip.** With at least one night of snore data
    present, export a backup, wipe the app's data, then import that backup.
    Confirm the nights and their stats are restored, but that audio clips are
    absent — and that the UI hides the dangling clip references cleanly
    rather than showing broken playback controls.
18. **The captured track is really 16 kHz mono.** Every threshold in
    `domain/snore/*` was tuned against 16 kHz mono frames, and the feature
    extractor asserts that rate — but some OEM audio stacks silently hand back
    a different sample rate or channel count than `MediaRecorder` was asked
    for, which shows up as an `EXTRACTION_FAILED` loop or, worse, plausible
    numbers computed from mis-scaled audio. Verify the actual bytes rather than
    the request:

    ```
    adb shell run-as app.unsmoke ls files/snore/sessions/<id>/
    adb exec-out run-as app.unsmoke cat files/snore/sessions/<id>/seg_0000.m4a > seg_0000.m4a
    ffprobe -v error -select_streams a:0 \
      -show_entries stream=sample_rate,channels,codec_name seg_0000.m4a
    ```

    Expect `sample_rate=16000`, `channels=1`, AAC. (`mediainfo seg_0000.m4a`
    works equally well if ffprobe isn't to hand.) Do this on each distinct OEM
    device available, not just one — this is precisely the check that varies by
    vendor.

## Known device-dependent risks to watch for

These aren't separate checklist items so much as things to keep an eye on
while running the steps above, since they vary by OEM/vendor and won't show
up on every device:

- **Vendor `MediaRecorder` rotation quirks.** Some OEM camera/media stacks
  handle `setNextOutputFile` rotation unreliably. The watchdog exists to
  catch this — if a rotation silently fails, confirm the watchdog detects it
  rather than leaving a corrupted or truncated segment unflagged.
- **Muxer flush latency vs. the 8-second watchdog.** On slower storage or
  under memory pressure, the muxer's flush can lag enough to trip the
  watchdog's 8-second timeout even when nothing is actually wrong. Watch for
  false-positive "stalled" detections during step 5 or step 11.
- **AAC priming-sample drift.** Expect roughly 64ms of drift per rotation
  from AAC encoder priming samples. This is expected and small, but worth
  confirming it doesn't compound into a noticeably wrong duration over a
  multi-rotation overnight session (step 11).
