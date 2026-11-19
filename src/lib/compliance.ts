// Flags wording in marketing copy that can breach the Ontario Human Rights
// Code (who a home is "for") or RECO advertising rules (unprovable claims).
// A guide, not legal advice: it catches common phrasings, and the agent
// stays responsible for the final copy.

export type ComplianceCategory =
  | "family"
  | "age"
  | "religion"
  | "origin"
  | "disability"
  | "safety"
  | "schools"
  | "claims";

export const COMPLIANCE_CATEGORIES: Record<ComplianceCategory, string> = {
  family: "Family status",
  age: "Age",
  religion: "Religion",
  origin: "Ethnicity or origin",
  disability: "Disability",
  safety: "Safety claim",
  schools: "School claim",
  claims: "Unprovable claim",
};

type Rule = {
  category: ComplianceCategory;
  pattern: RegExp;
  why: string;
  suggestion: string;
};

const RULES: Rule[] = [
  // Human Rights Code: describe the home and area, not who should live there.
  {
    category: "family",
    pattern:
      /\b(?:perfect|ideal|great|made)\s+for\s+(?:young\s+|growing\s+|small\s+|large\s+)?(?:famil(?:y|ies)|kids|children|couples?|newlyweds|singles?|bachelors?)\b/gi,
    why: "Says who the home suits by family status.",
    suggestion:
      "Describe the feature instead, e.g. “three bedrooms and a fenced yard”.",
  },
  {
    category: "family",
    pattern:
      /\b(?:family|kid|child)[-\s]?(?:friendly|oriented|neighbourhood|neighborhood|community|area|street)\b/gi,
    why: "Implies the area is for families.",
    suggestion:
      "Name what's nearby, e.g. “parks and schools within a short walk”.",
  },
  {
    category: "family",
    pattern: /\bno\s+(?:kids|children|pets\s+or\s+children)\b/gi,
    why: "Excludes buyers or tenants by family status.",
    suggestion: "Remove it.",
  },
  {
    category: "age",
    pattern:
      /\b(?:empty[-\s]nesters?|retirees?|seniors?|young\s+professionals?|millennials?|students?\s+only|adults?\s+only|mature\s+(?:couple|tenant|buyer)s?|retirement\s+(?:living|community))\b/gi,
    why: "Targets buyers by age.",
    suggestion:
      "Describe needs, e.g. “low-maintenance living” or “easy commute”.",
  },
  {
    category: "religion",
    pattern:
      /\b(?:walk(?:ing)?\s+(?:distance\s+)?to|steps\s+(?:from|to)|close\s+to|near)\s+(?:the\s+|a\s+)?(?:church|mosque|synagogue|temple|gurdwara|mandir|cathedral|chapel)(?:es|s)?\b/gi,
    why: "Highlights one place of worship, which can signal a preferred faith.",
    suggestion: "Use “places of worship nearby” or leave it out.",
  },
  {
    category: "religion",
    pattern:
      /\b(?:christian|catholic|jewish|muslim|islamic|hindu|sikh|buddhist)\s+(?:famil(?:y|ies)|community|neighbourhood|neighborhood|area|buyers?|tenants?)\b/gi,
    why: "Describes the area or buyers by religion.",
    suggestion: "Remove the reference.",
  },
  {
    category: "origin",
    pattern:
      /\b(?:ethnic|exclusive|restricted|integrated|traditional)\s+(?:neighbourhood|neighborhood|community|area|enclave)\b|\b(?:chinese|indian|italian|portuguese|korean|filipino|jamaican|south\s+asian|asian|european|caribbean)\s+(?:community|neighbourhood|neighborhood|area|enclave|famil(?:y|ies))\b/gi,
    why: "Describes the area or buyers by ethnicity or origin.",
    suggestion:
      "Name specific places instead, e.g. “restaurants and grocers on Main St”.",
  },
  {
    category: "disability",
    pattern:
      /\b(?:no\s+wheelchairs?|able[-\s]bodied|not\s+suitable\s+for\s+(?:the\s+)?(?:disabled|handicapped)|handicapped)\b/gi,
    why: "Excludes or labels people by disability.",
    suggestion: "Describe the property's accessibility features factually.",
  },
  // RECO: claims you can't stand behind.
  {
    category: "safety",
    pattern:
      /\b(?:safe(?:st)?|secure|crime[-\s]free|low[-\s]crime|high[-\s]crime|dangerous|quiet\s+and\s+safe)\s+(?:neighbourhood|neighborhood|area|community|street|location|place)\b|\blow[-\s]crime\b|\bcrime[-\s]free\b/gi,
    why: "A safety claim you can't guarantee (RECO).",
    suggestion:
      "Leave safety out of marketing, or cite a source in the playbook.",
  },
  {
    category: "schools",
    pattern:
      /\b(?:best|top|top[-\s]rated|top[-\s]ranked|highly[-\s]ranked|#\s?1|number\s+one|award[-\s]winning)\s+(?:\w+\s+)?schools?\b/gi,
    why: "Ranks schools, which the report's data doesn't support.",
    suggestion:
      "Name the school and the distance, e.g. “Maple Public School, 6 min walk”.",
  },
  {
    category: "schools",
    pattern:
      /\b(?:in|within)\s+(?:the\s+)?(?:catchment|boundar(?:y|ies)|school\s+district|zone)\b|\bschool\s+district\b/gi,
    why: "Catchments change and must be confirmed with the board.",
    suggestion:
      "Say “steps to …” with the distance, and “confirm catchment with the board”.",
  },
  {
    category: "claims",
    pattern:
      /\b(?:guaranteed?|will\s+(?:appreciate|increase\s+in\s+value|go\s+up)|can'?t\s+lose|sure\s+(?:thing|bet)|won'?t\s+last|best\s+(?:deal|value|investment|home)|investment\s+of\s+a\s+lifetime|the\s+best\s+in\s+(?:the\s+)?(?:city|area|neighbourhood|neighborhood))\b/gi,
    why: "A promise or superlative you can't prove (RECO).",
    suggestion:
      "State the fact behind it, e.g. “Ontario Line station under construction 300 m away”.",
  },
];

export type ComplianceFinding = {
  category: ComplianceCategory;
  /** The matched words, as written. */
  match: string;
  index: number;
  why: string;
  suggestion: string;
};

/** Every flagged phrase in `text`, in reading order, without overlaps. */
export function checkCompliance(text: string): ComplianceFinding[] {
  const found: ComplianceFinding[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      found.push({
        category: rule.category,
        match: m[0],
        index: m.index ?? 0,
        why: rule.why,
        suggestion: rule.suggestion,
      });
    }
  }
  found.sort((a, b) => a.index - b.index);
  // Drop matches inside an earlier one.
  const result: ComplianceFinding[] = [];
  let end = -1;
  for (const f of found) {
    if (f.index < end) continue;
    result.push(f);
    end = f.index + f.match.length;
  }
  return result;
}

/** `text` split into plain and flagged runs, for highlighting. */
export function complianceSegments(
  text: string,
  findings: ComplianceFinding[],
) {
  const segments: { text: string; finding?: ComplianceFinding }[] = [];
  let at = 0;
  for (const f of findings) {
    if (f.index > at) segments.push({ text: text.slice(at, f.index) });
    segments.push({ text: f.match, finding: f });
    at = f.index + f.match.length;
  }
  if (at < text.length) segments.push({ text: text.slice(at) });
  return segments;
}
