const GITHUB_API = "https://api.github.com";

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");
  return token;
}

export type CreateRepoResult = {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  owner: string;
};

export async function createGithubRepo(input: {
  name: string;
  description?: string;
  private?: boolean;
}): Promise<CreateRepoResult> {
  const token = getToken();

  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? "",
      private: input.private ?? false,
      auto_init: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create repo: ${res.status} ${text}`);
  }

  const data = await res.json();

  return {
    repoName: data.name,
    repoUrl: data.html_url,
    cloneUrl: data.clone_url,
    owner: data.owner.login,
  };
}

export async function createFileInRepo(input: {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
}): Promise<void> {
  const token = getToken();

  const encoded = Buffer.from(input.content).toString("base64");

  const res = await fetch(
    `${GITHUB_API}/repos/${input.owner}/${input.repo}/contents/${input.path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: input.message,
        content: encoded,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create file ${input.path}: ${res.status} ${text}`);
  }
}

export async function scaffoldNextjsProject(input: {
  owner: string;
  repo: string;
  projectName: string;
  description: string;
}): Promise<void> {
  const files = [
    {
      path: "package.json",
      content: JSON.stringify({
        name: input.repo,
        version: "0.1.0",
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: {
          next: "14.2.0",
          react: "^18",
          "react-dom": "^18",
          "@anthropic-ai/sdk": "^0.54.0",
        },
        devDependencies: {
          typescript: "^5",
          "@types/node": "^20",
          "@types/react": "^18",
          tailwindcss: "^3",
        },
      }, null, 2),
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "es5",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      }, null, 2),
    },
    {
      path: "next.config.js",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig`,
    },
    {
      path: "app/layout.tsx",
      content: `export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
    },
    {
      path: "app/page.tsx",
      content: `export default function Home() {
  return (
    <main>
      <h1>${input.projectName}</h1>
      <p>${input.description}</p>
    </main>
  )
}`,
    },
    {
      path: "README.md",
      content: `# ${input.projectName}\n\n${input.description}\n\nBuilt with Master Agent OS.`,
    },
  ];

  for (const file of files) {
    await createFileInRepo({
      owner: input.owner,
      repo: input.repo,
      path: file.path,
      content: file.content,
      message: `scaffold: add ${file.path}`,
    });
    // Small delay to avoid GitHub rate limiting
    await new Promise(r => setTimeout(r, 300));
  }
}
