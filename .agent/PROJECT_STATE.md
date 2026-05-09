# Master Agent OS — Project State

## Current Architecture

Master Agent OS is built on the existing Next.js architecture.

Do not rebuild from scratch.
Do not create a parallel execution system.
Do not return to legacy propose/apply routes.

## Main Execution Engine

The primary execution engine is:

app/api/agent-runner/route.ts

Target flow:

task
→ execution-started
→ patch validation
→ branch
→ PR created
→ PR validation
→ optional safe auto-merge
→ deploy monitoring
→ recovery if needed

## Forbidden Legacy Flow

Do not use:

- app/api/propose-changes
- app/api/apply-changes
- direct main apply
- separate legacy changes page flow

## Active Runtime Systems

- Control state: .agent/state.json
- Task queue: .agent/tasks.json
- Activity log: .agent/activity.json
- Runtime state API: app/api/runtime-state/route.ts
- Control state API: app/api/control-state/route.ts
- Auto-run API: app/api/auto-run/route.ts
- Recovery task API: app/api/recovery-task/route.ts
- Pending PR API: app/api/pending-prs/route.ts

## Safety Rules

Auto-run must stop if:

- emergencyStop is true
- paused is true
- recoveryActive is true
- latest deploy is BUILDING, QUEUED, or ERROR
- no queued/todo tasks exist
- cooldown is active

Auto-merge is allowed only if:

- autoMergeEnabled is true
- PR validation passes
- PR is mergeable
- PR is not draft
- PR is open
- target file is safe
- no recovery mode is active

## Recovery Rules

Recovery mode should activate when:

- too many failed runs
- too many validation failures
- too many merge failures
- deploy failure threshold reached

When recovery mode is active:

- autoRunEnabled should be false
- autoMergeEnabled should be false
- system should not continue autonomous execution
- recovery task may be created manually from dashboard

## Deploy Rules

Runtime telemetry must not write commits to main.

Do not update .agent/state.json from deploy-status polling in a way that triggers deploy loops.

Deploy status should be read-only unless using a safe non-deploying storage layer.

## Current Stage

Stage 2 — Autonomous Core System

Completed foundation:

- PR-only runner
- control state
- control center UI
- emergency stop
- safe auto-merge foundation
- stop conditions
- runtime intelligence
- deploy intelligence
- deploy guard
- recovery intelligence
- recovery task generator
- pending PR queue
- manual auto-run cycle

Deferred:

- scheduled cron auto-run
- full overnight mode
- database/KV storage
- advanced recovery orchestration

## Next Priorities

1. Prompt to structured tasks
2. Planner waves
3. Context-aware patching
4. Recovery task execution flow
5. Optional scheduled autonomy after safety validation