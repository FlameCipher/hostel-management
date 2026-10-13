# MMAMBUGUA AI — Exact Kinari Teaching Voice

## Why this revision
The original #110 hostel speaker silently switched to a phone-synthesized voice for protected room/student/financial responses and whenever the premium narration service failed. It also changed Kinari's actual teaching narration instructions. That sounds noticeably different. The owner explicitly requested **the same voice as Kinari teaching**, not a substitute.

## Source of truth
Kinari's source `FlameCipher/kinari-app/src/server/voice/kinariVoiceService.ts` specifies:
- OpenAI Audio Speech API model `gpt-4o-mini-tts` (unless Kinari production environment overrides it);
- voice `onyx` by default;
- the exact `KINARI_VOICE_INSTRUCTIONS` beginning `Speak as Kinari: a calm, mature, deep male sacred narrator ...`;
- `toKinariSpeechText` stripping markdown before synthesis; and
- MP3 playback with pause/resume/stop controls.

The hostel now uses **the identical voice instructions and markdown-cleaning logic**, the identical default OpenAI TTS model/voice, and native MP3 playback. It does not use the Kinari wallet or call Kinari's production API. This reuses the audio voice technology without giving Kinari's system access to hostel credentials, wallet or database.

## Private record consent
Because the premium voice provider is an external speech service, clicking Listen on a protected operational response displays an explicit consent prompt for that specific answer. Only after confirmation is the exact text sent to the authenticated `/api/assistant/voice` route and then to OpenAI. This is an additional transfer compared to simply reading the private ledger on screen. Users who don't consent still see the full written response and no speech request occurs.

A staff/tenant message receives a signed five-minute voice ticket only after the assistant authorizes the current session and returns its exact text. Ticket validation binds the requested text hash, organization, account identity, audience and session version. The voice route revalidates session, same-origin and active user access, and enforces per-minute/per-hour spending limits. Audio and private text aren't stored by the hostel voice route. Existing provider privacy policies apply to speech processing.

## Voice behavior
One Kinari narrator at a time. Tap Listen to request Kinari audio; tap Pause to pause the same clip, Resume to continue and Stop to clear it. New responses never autoplay. If Kinari/OpenAI TTS is unavailable, the app shows a clear error instead of substituting Android/browser speech. Kinari voice generation incurs per-request API charges; attempts are rate-limited and never triggered in the background.

The UI labels the voice `Kinari voice` and never claims Android's default speech reader is identical. On a device that restricts async audio playback, the same already-generated MP3 can require a second Resume tap; it must not regenerate speech or use another voice.

## Acceptance
Run `npm run test:assistant-voice` and the full build, ensure type check and full regression pass, release preview and production only when READY. Owner must physically test Kinari and MMAMBUGUA side by side with the same non-sensitive paragraph to compare voice identity, then test a private balance with explicit consent and pause/resume/stop. Deployment READY does not prove audible parity on the device.
