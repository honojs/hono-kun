/** A reference to a GitHub repository. */
export interface RepositoryRef {
  owner: string
  repo: string
}

/** A pull request event received from a GitHub webhook, normalized for workflows. */
export interface PullRequestEvent {
  /** The webhook action, e.g. "opened", "synchronize", "closed". */
  action: string
  repository: RepositoryRef
  number: number
  title: string
  author: string
  url: string
  /** The label name, present only for "labeled" / "unlabeled" actions. Labeling a PR is also the manual way to invoke Hono-kun on it. */
  label?: string
}
