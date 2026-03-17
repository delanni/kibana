# Affected Package Detection

Generic utilities for detecting which packages have been affected by changes in a PR, allowing filtering of any files (test configs, build targets, etc.) to only those in affected packages and their downstream dependents.

## CLI Usage

### List Affected Packages

```bash
.buildkite/pipeline-utils/affected-packages/list_affected [options]
```

Each setting is resolved as **CLI flag > environment variable > default**.

**Options:**
- `--deep` - Include downstream dependencies
- `--json` - Output as JSON array (default: one package per line)
- `--merge-base <commit>` - Git commit to compare against
- `--strategy <git|moon>` - Strategy to use
- `--help, -h` - Show help message

| Setting    | CLI flag       | Env var                | Default        |
|------------|----------------|------------------------|----------------|
| Strategy   | `--strategy`   | `AFFECTED_STRATEGY`    | `git`          |
| Downstream | `--deep`       | `AFFECTED_DOWNSTREAM`  | `false`        |
| Merge base | `--merge-base` | `GITHUB_PR_MERGE_BASE` | `origin/main`  |

**Examples:**

```bash
# List directly affected packages
.buildkite/pipeline-utils/affected-packages/list_affected

# Include downstream dependencies
.buildkite/pipeline-utils/affected-packages/list_affected --deep

# JSON output
.buildkite/pipeline-utils/affected-packages/list_affected --deep --json

# Custom merge base
.buildkite/pipeline-utils/affected-packages/list_affected --merge-base HEAD~10

# Use Moon strategy instead
.buildkite/pipeline-utils/affected-packages/list_affected --strategy moon --deep

# Configure via environment
AFFECTED_STRATEGY=moon AFFECTED_DOWNSTREAM=true .buildkite/pipeline-utils/affected-packages/list_affected
```

## Programmatic Usage

### Get Affected Packages

```typescript
import { getAffectedPackages } from '../affected-packages';

const affectedPackages = await getAffectedPackages(
  'main',  // merge base
  {
    strategy: 'git',       // default, can also be 'moon' or 'disabled'
    includeDownstream: true,
    logging: false
  }
);
// Returns: Set<string> of module IDs (e.g. "@kbn/core", "@kbn/my-plugin")
```

### Filter Files by Affected Packages

```typescript
import { getAffectedPackages, filterFilesByPackages } from '../affected-packages';

// Step 1: Get affected packages (handles all edge cases)
const affectedPackages = await getAffectedPackages(
  process.env.GITHUB_PR_MERGE_BASE
);
// Returns: Set<string> | null
// - Set<string>: affected package IDs
// - null: skip filtering (disabled/no merge base/critical files changed)

// Step 2: Filter any file list
const filteredFiles = filterFilesByPackages(
  allFiles,  // Can be test configs, build targets, etc.
  affectedPackages
);
```

### Use Cases

- **Test filtering**: Filter test configs to run only affected tests
- **Linting**: Lint only affected packages
- **Type checking**: Type check only affected packages

## Environment Variables

| Variable               | Values                          | CLI default  | Programmatic default |
|------------------------|---------------------------------|--------------|----------------------|
| `AFFECTED_STRATEGY`    | `git`, `moon`, `disabled`       | `git`        | `git`                |
| `AFFECTED_DOWNSTREAM`  | `true`, `false`                 | `false`      | `true`               |
| `AFFECTED_LOGGING`     | `true`, `false`                 | `false`      | `true`               |
| `GITHUB_PR_MERGE_BASE` | any git ref                    | `origin/main`| —                    |

## How It Works

### Git Strategy (default)
1. Get changed files via `git diff`
2. Discover modules by scanning `kibana.jsonc` files across the repo
3. Map changed files to modules (longest directory prefix match)
4. Optionally traverse downstream dependency graph (from `tsconfig.json` `kbn_references`)

**Performance**: ~500ms (first call, includes module discovery); subsequent calls use cache

### Moon Strategy
1. Query Moon with `--affected [--downstream deep]`
2. Return affected project IDs

**Performance**: ~30-120 seconds
