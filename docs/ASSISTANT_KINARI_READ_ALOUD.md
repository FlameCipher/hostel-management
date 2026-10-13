# Kinari-style read-aloud for MMAMBUGUA Hostel Assistant

## Goal
Add a compact speaker beside every AI reply, based on Kinari teaching's listen/pause/resume/stop workflow. It is user-triggered; no autoplay, recording, microphone or automatic broadcast.

## Voice implementation actually reused
Kinari app's verified narrator uses `gpt-4o-mini-tts`, voice `onyx`, with a warm mature deep male audiobook narration style. Hostel AI uses the **same provider model and voice profile** on its own authenticated `/api/assistant/voice` endpoint. It does NOT reuse Kinari's wallet authorization or expose either app's credentials. Narration is described as the hostel assistant, not Kinari's sacred identity.

## Data safety
The hostel maintains a stronger privacy boundary for deterministic live queries than ordinary Kinari teachings. Each general AI-generated reply can carry a server-signed five-minute voice ticket, bound to organization, authenticated staff/tenant user, current session version and the exact text SHA-256. The audio endpoint independently checks same origin, authenticated active session, length and ticket, then calls the same OpenAI TTS model using the already provider-processed text. It stores no generated MP3, sends no text to Kinari itself, sets no-store and applies hourly/minute per-account and organization budgets.

**Individual payment/room/student/visitor records and protected action replies never receive a cloud narrator ticket.** Those messages get the device's speech synthesizer: reading occurs in the phone's installed speech engine, not in the app's external OpenAI TTS route. The operating system may implement or configure its own speech service, so device-level privacy depends on the phone settings; the hostel web application does not newly submit private record text to the Kinari-style provider.

## Accessible mobile behavior
Each non-error assistant response has a Listen button. On Kinari premium-compatible general answers the button says `Listen · Kinari voice`. On protected operational answers it says `Listen`. First tap starts, second tap pauses, next tap resumes from the same point, and a Stop button interrupts it. Only one response speaks at once. New responses do not autoplay. Premium failures fall back to the device voice; Android browser audio restrictions can require an extra Resume tap. Button labels convey each state to screen readers; reduced-motion is honored.

Device fallback voice selection prefers a deep male voice when available, using lower pitch and a slow natural pace. English and Kiswahili are recognized; Kikuyu attempts a matching voice but falls back to Kiswahili/English if none exists. Voice availability depends on the phone's installed TTS engines.

## Acceptance
Full Vercel build runs `npm run test:assistant-voice` and all existing finance, assistant, visitor, communication, tenancy and auth tests. Verify no schema changes, the exact preview and production READY commits, then physically test Listen/Pause/Resume/Stop for both a public/policy answer and a private debtor balance on Android. Voice quality and device audio autoplay permission require physical acceptance even when the build passes.

## Costs
Kinari-style premium voice uses the existing OpenAI API key; each actual premium narration request can incur voice generation usage charges. Device speech does not incur a hostel-side API usage charge. Premium requests are optional and never generated in the background.
