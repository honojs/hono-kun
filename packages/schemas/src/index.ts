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
}
