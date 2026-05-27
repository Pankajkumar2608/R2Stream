import type { Env, TriggerResponse } from "./types.js";

const WORKFLOW_FILE = "sync.yml";

/**
 * Trigger the GitHub Actions sync workflow via the REST API.
 * Uses workflow_dispatch with playlist_urls as input.
 */
export async function triggerSync(
  urls: string[],
  env: Env,
): Promise<TriggerResponse> {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return {
      ok: false,
      message: "GitHub secrets not configured on the Worker.",
    };
  }

  // Validate URLs before sending
  const validUrls = urls.filter((u) => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return { ok: false, message: "No valid URLs provided." };
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "musync-worker/1.0",
    },
    body: JSON.stringify({
      ref: "main", // branch to run on
      inputs: {
        playlist_urls: validUrls.join("\n"),
      },
    }),
  });

  // GitHub returns 204 No Content on success
  if (resp.status === 204) {
    const runUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`;
    return {
      ok: true,
      message: `Sync triggered for ${validUrls.length} URL(s). Songs will appear in ~2 minutes.`,
      runUrl,
    };
  }

  // Parse error from GitHub
  let errMsg = `GitHub API error: ${resp.status}`;
  try {
    const body = (await resp.json()) as { message?: string };
    if (body.message) errMsg += ` — ${body.message}`;
  } catch {
    /* ignore parse errors */
  }

  return { ok: false, message: errMsg };
}
