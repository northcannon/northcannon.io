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
  /** Date the current Gate 1 status statement was founder-attested. */
  statusDate: string;
  /** Zero-based lifecycle stage implied by the governed Gate 1 status. */
  stageIndex: number;
}
