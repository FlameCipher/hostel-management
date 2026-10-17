/** Safe data-shapes used by the management UI. Call outcomes are staff-reported only. */
export const callTestLabels={
 ANSWERED:"Staff reports intended responder answered",
 NO_ANSWER:"Call rang but nobody answered",
 WRONG_RECIPIENT:"Wrong recipient / not designated responder",
 FAILED_TO_CONNECT:"Could not connect the call",
} as const;
export type CallTestResult=keyof typeof callTestLabels;
