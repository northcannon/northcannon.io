/** Build-time copy access for one route in one build mode. */
export interface Copy {
  /** The statement when this build may render it; production omits unapproved copy. */
  t: (id: string) => string | undefined;
  /** True when every listed statement renders in this build. */
  all: (...ids: string[]) => boolean;
  /** Paragraphs of a multi-paragraph statement, or none. */
  paragraphs: (id: string) => string[];
  /** The route path when it exists in this build, otherwise undefined. */
  href: (path: string) => string | undefined;
  review: boolean;
  /** A named status entry; no global experiment status. */
  status: (entryId: string) => { stage: string; claim_id: string } | undefined;
}
