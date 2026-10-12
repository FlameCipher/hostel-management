export type ResidentOnboardingMetrics = {
  activeStudents: number;
  portalEnabled: number;
  eligibleForApproval: number;
  pendingRequests: number;
  expiredRequests: number;
  totalVisitorRequests: number;
};

export function summarizeTenantReadiness(input:ResidentOnboardingMetrics) {
  const safe = Object.fromEntries(Object.entries(input).map(([key,value])=>[
    key,Number.isSafeInteger(value)&&value>=0?value:0,
  ])) as ResidentOnboardingMetrics;
  return {
    ...safe,
    notYetEnabled:Math.max(0,safe.activeStudents-safe.portalEnabled),
    approvalRate:safe.activeStudents?Math.round(100*safe.portalEnabled/safe.activeStudents):0,
    onboardingNeeded:safe.activeStudents>safe.portalEnabled,
    canReviewPending:safe.pendingRequests>0,
  };
}
