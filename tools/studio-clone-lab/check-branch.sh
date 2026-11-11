#!/bin/sh
set -eu
pnpm -r --workspace-concurrency=1 run typecheck
pnpm typecheck:admin
pnpm check:api-contract
pnpm check:wire-mirror
pnpm --filter @ai-star-eco/web-aiavatar exec vitest run --maxWorkers=1 --no-file-parallelism src/ip/scenes/scene-video-clone.test.tsx src/ip/scenes/scene-studios.test.tsx src/ip/scenes/scene-video-workspace.test.tsx src/ip/scenes/scene-query.test.ts src/canvas-bridge/studio-video-clone-flow.test.ts src/canvas-bridge/studio-video-tasks.test.ts src/shell/desktop-top-bar.test.tsx
node --check tools/studio-clone-lab/provider.mjs
python3 - <<'PY'
import ast
from pathlib import Path
for p in Path('tools/studio-clone-lab').glob('*.py'):ast.parse(p.read_text(),filename=str(p))
PY
cd apps/server
./mvnw compile -q -o
./mvnw -q -o -DforkCount=1 -DreuseForks=true -Dtest=StudioCloneVideoPlanTest,StudioDepthVideoServiceTest,StudioPlanExecutionServiceTest,StudioSegmentedRetryPolicyTest,H3ControlVideoTest,StudioPlanValidatorSkillTest,StudioFilmStudyCapTest,IpProjectServiceTest,IpSavedAssetServiceTest,IpLibrarySaveMediaTest,SegmentedVideoFlowTest,StudioPromptStageParityTest test
