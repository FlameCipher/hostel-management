/** Safe configuration metadata only: never return the API key. */
export function assistantConfiguration(env: Record<string, string | undefined> = process.env) {
  const model = (env.HOSTEL_AI_MODEL ?? "").trim().replace(/^openai\//, "");
  const enabled = env.HOSTEL_AI_ENABLED === "true";
  const code = !enabled ? "AI_DISABLED"
    : !model || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(model) ? "OPENAI_MODEL_MISSING_OR_INVALID"
    : !env.OPENAI_API_KEY?.trim() ? "OPENAI_API_KEY_MISSING"
    : "READY";
  return { provider: "openai" as const, model, enabled, configured: code === "READY", code };
}

export function assistantEnabled(env: Record<string, string | undefined> = process.env) {
  return assistantConfiguration(env).configured;
}
