export type ExecutiveEmailInput = { firstName: string; marketLabel: string; relevance: string; findings: string[]; reportUrl: string; senderName: string; senderTitle: string };

export function buildInitialExecutiveEmail(input: ExecutiveEmailInput) {
  return {
    subject: `What the ${input.marketLabel} ALPR records show`,
    bodyText: `${input.firstName} —\n\nWe reviewed ${input.marketLabel}'s publicly available ALPR/Flock records because of your work involving ${input.relevance}.\n\n${input.findings.slice(0, 3).map((finding) => `• ${finding}`).join("\n")}\n\nVIEW THE RED DOT → ${input.reportUrl}\n\nIf this is not something you handle directly, who is the person you would forward this to?\n\n${input.senderName}\n${input.senderTitle}\nRed Dot`,
  };
}

export function buildFirmReferralEmail(input: Pick<ExecutiveEmailInput, "firstName" | "reportUrl" | "senderName" | "senderTitle">) {
  return {
    subject: "ALPR evidence and case files",
    bodyText: `${input.firstName} —\n\nRed Dot is building evidence-backed case files around the rapidly changing use of automated license plate reader systems, including Flock Safety deployments, policies, contracts, locations, data practices, public records, and related government activity.\n\nIf your firm is handling—or evaluating—matters involving ALPR evidence, privacy, surveillance, or Flock systems, I would like to put Red Dot in front of the appropriate attorney.\n\nAnd if that is not you, who is the person you would forward this to?\n\nVIEW A RED DOT CASE → ${input.reportUrl}\n\n${input.senderName}\n${input.senderTitle}\nRed Dot`,
  };
}
