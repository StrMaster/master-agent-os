import AgentsWorkspace from "../components/AgentsWorkspace";
import { readActivityFile } from "../api/agent-runner/activity";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const activityFile = await readActivityFile();
  const activity = Array.isArray(activityFile.activity)
    ? activityFile.activity
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Agents</h1>
        <p className="mt-2 text-sm text-white/60">
          Core, specialist, and business agent roster.
        </p>
      </div>

      <AgentsWorkspace initialActivity={activity} />
    </div>
  );
}
