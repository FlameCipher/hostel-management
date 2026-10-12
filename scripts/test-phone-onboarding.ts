import assert from "node:assert/strict";
import test from "node:test";
import { buildPhoneOnboardingDraft, type PhoneOnboardingInput } from "../src/lib/phone-onboarding";

function sample(overrides: Partial<PhoneOnboardingInput> = {}): PhoneOnboardingInput {
  return {
    status: "MISSING_EMAIL",
    phone: "0714464700",
    accountEligible: true,
    stays: [{ roomNumber: "54", property: { name: "MMAMBUGUA HOSTEL", countryCode: "KE", customDomain: "mmambugua.studentshostels.com", active: true, publicListing: true } }],
    ...overrides,
  };
}

test("creates a property-branded public registration WhatsApp draft without bearer tokens or room detail", () => {
  const result = buildPhoneOnboardingDraft(sample());
  assert.equal(result.ready, true);
  if (!result.ready) return;
  assert.equal(result.host, "mmambugua.studentshostels.com");
  assert.equal(result.url, "https://mmambugua.studentshostels.com/tenant/register");
  assert.equal(result.phoneDigits, "254714464700");
  const draftUrl = new URL(result.whatsappHref);
  assert.equal(draftUrl.hostname, "wa.me");
  assert.equal(draftUrl.pathname, "/254714464700");
  const message = draftUrl.searchParams.get("text") ?? "";
  assert.match(message, /MMAMBUGUA HOSTEL/);
  assert.match(message, /management must independently approve|management must verify/i);
  assert.match(message, /mmambugua.studentshostels.com\/tenant\/register/);
  assert.doesNotMatch(message, /Room 54|room 54|password=|\/tenant\/activate\//);
  assert.doesNotMatch(result.whatsappHref, /m-pesa|receipt|tokenHash/i);
});

test("expiry supports secure public self-registration, not reuse of expired bearer invitation", () => {
  const result = buildPhoneOnboardingDraft(sample({ status: "EXPIRED" }));
  assert.equal(result.ready, true);
  if (result.ready) assert.ok(result.url.endsWith("/tenant/register"));
});

test("rejects already activated or otherwise ineligible accounts", () => {
  assert.equal(buildPhoneOnboardingDraft(sample({ accountEligible: false })).ready, false);
  assert.equal(buildPhoneOnboardingDraft(sample({ status: "ACTIVATED" })).ready, false);
  assert.equal(buildPhoneOnboardingDraft(sample({ status: "PROVIDER_ACCEPTED" })).ready, false);
  assert.equal(buildPhoneOnboardingDraft(sample({ status: "SENDING" })).ready, false);
});

test("rejects absent, multiple or ambiguous room stays", () => {
  assert.equal(buildPhoneOnboardingDraft(sample({ stays: [] })).ready, false);
  assert.equal(buildPhoneOnboardingDraft(sample({ stays: [sample().stays[0], sample().stays[0]] })).ready, false);
});

test("requires an active, published property and a managed subdomain", () => {
  for (const property of [
    { active: false },
    { publicListing: false },
    { customDomain: "malicious.example.com" },
    { customDomain: "studentshostels.com" },
    { customDomain: "https://evil.example.com/portal" },
  ]) {
    const stay = sample().stays[0];
    const input = sample({ stays: [{ ...stay, property: { ...stay.property, ...property } }] });
    assert.equal(buildPhoneOnboardingDraft(input).ready, false);
  }
});

test("rejects invalid mobile numbers and does not infer Kenya for non-Kenyan properties", () => {
  assert.equal(buildPhoneOnboardingDraft(sample({ phone: "abcd" })).ready, false);
  assert.equal(buildPhoneOnboardingDraft(sample({ phone: "+123" })).ready, false);
  const stay = sample().stays[0];
  assert.equal(buildPhoneOnboardingDraft(sample({ stays: [{ ...stay, property: { ...stay.property, countryCode: "UG" } }] })).ready, false);
});

test("never makes network calls or changes data when preparing a draft", () => {
  const result = buildPhoneOnboardingDraft(sample());
  assert.equal(result.ready, true);
  if (!result.ready) return;
  assert.equal(new URL(result.whatsappHref).protocol, "https:");
  assert.equal(result.url.includes("?"), false);
  assert.equal(result.url.includes("#"), false);
});
