const OWNER = "StrMaster";

const REPO =
  "master-agent-os";

export async function createGithubBranch(
  branchName: string
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN"
    );
  }

  const mainRefRes =
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/main`,
      {
        headers: {
          Authorization: `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",
        },
      }
    );

  const mainRef =
    await mainRefRes.json();

  const sha =
    mainRef.object.sha;

  const createRes =
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/refs`,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,

          sha,
        }),
      }
    );

  return createRes.json();
}

export async function createPullRequest(
  branchName: string,

  title: string,

  body: string
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN"
    );
  }

  const prRes =
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/pulls`,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          title,

          body,

          head: branchName,

          base: "main",
        }),
      }
    );

  return prRes.json();
}

export async function findOpenPullRequest(
  branchName: string
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN"
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls?state=open&head=${OWNER}:${branchName}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,

        Accept:
          "application/vnd.github+json",
      },

      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to search pull requests"
    );
  }

  const pulls =
    await res.json();

  return Array.isArray(pulls)
    ? pulls[0]
    : null;
}

export async function getPullRequest(
  prNumber: number
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN"
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,

        Accept:
          "application/vnd.github+json",
      },

      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to fetch PR"
    );
  }

  return res.json();
}

export async function validatePullRequest(
  prNumber: number
) {
  const pr =
    await getPullRequest(
      prNumber
    );

  return {
    mergeable:
      pr.mergeable,

    state: pr.state,

    merged:
      pr.merged,

    draft:
      pr.draft,
  };
}

export async function mergePullRequest(
  prNumber: number
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN"
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${prNumber}/merge`,
    {
      method: "PUT",

      headers: {
        Authorization: `Bearer ${token}`,

        Accept:
          "application/vnd.github+json",

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        merge_method:
          "squash",
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to merge PR"
    );
  }

  return res.json();
}
