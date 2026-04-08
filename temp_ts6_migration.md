# TypeScript 5.9.3 -> 6.0.2 Migration

## 1. Update TypeScript version
- [x] Update `package.json` dependency and resolutions to `6.0.2`
- [x] Update `.buildkite/package.json` from `^5.1.6` to `^6.0.2`
- [x] Run `yarn kbn bootstrap`

**Notes:** Bootstrap completed successfully. Three locations updated:
- `package.json` resolutions (`**/typescript`)
- `package.json` devDependencies (`typescript`)
- `.buildkite/package.json` devDependencies (`typescript`)

## 2. Add ignoreDeprecations escape hatch
- [x] Add `"ignoreDeprecations": "6.0"` to `tsconfig.base.json`
- [x] Run initial type check to see baseline errors

**Notes:** Single-project type check passes cleanly with the escape hatch.
All deprecated options (`baseUrl`, `moduleResolution: "node"`, `downlevelIteration`) are silenced.

## 3. Remove baseUrl
- [x] Remove `baseUrl` from `tsconfig.base.json`
- [x] Remove `baseUrl` from `tsconfig.base.type_check.json`
- [x] Remove `baseUrl` from `src/core/packages/chrome/navigation/packaging/example/tsconfig.json`
- [x] Remove `baseUrl` from `src/core/packages/chrome/navigation/packaging/example/tsconfig.type_check.json`
- [x] Prefix all ~2700 path values with `./` (required when `baseUrl` is not set)
- [x] Update path generator in `src/dev/kbn_pm/src/commands/bootstrap/regenerate_base_tsconfig.mjs`
- [x] Fix 3 missed non-relative paths (multiline `node_modules/` entries + `typings/` entry)

**Notes:** TS6 requires `paths` values to be relative (start with `./`) when `baseUrl` is not set.
Since `baseUrl` was `"."`, prefixing all values with `./` is semantically identical.
The path generator also needed updating so `yarn kbn bootstrap` produces correct paths.

## 4. Change moduleResolution from "node" to "bundler"
- [x] `tsconfig.base.json`
- [x] `packages/kbn-dependency-usage/tsconfig.json`
- [x] `src/core/packages/chrome/navigation/packaging/tsconfig.json`
- [x] `.buildkite/tsconfig.test.json`

**Notes:** TS6 supports `module: "commonjs"` + `moduleResolution: "bundler"`, which is the
correct migration path for Kibana. Single-project type check passes. The `bundler` resolution
handles `exports` fields in package.json and is the recommended modern replacement for `node`/`node10`.
Removed stale comment about Node.js require() behavior from tsconfig.base.json.

## 5. Remove downlevelIteration
- [x] Remove `downlevelIteration` from `tsconfig.base.json` (no-op with esnext target)

**Notes:** Was already a no-op since target is `"esnext"`. TS6 deprecates setting this option
at all (even to `false`). Removed along with the stale ES5/ES3 comment.

## 6. Fix target: es5 in tsconfig.browser.json
- [x] Change `target` from `"es5"` to `"es2015"`

**Notes:** ES5 target is deprecated in TS6; lowest supported is now ES2015.
Kibana uses webpack + babel for actual browser transpilation, so this config
was only used for type-checking. `es2015` is the conservative choice; the
base config already uses `"esnext"` for everything else.

## 7. Handle noUncheckedSideEffectImports
- [x] Set `"noUncheckedSideEffectImports": false` in `tsconfig.base.json`

**Notes:** TS6 defaults this to `true`, which would error on ~28 CSS/SCSS/SVG side-effect
imports that are handled by webpack at runtime and have no TS module declarations.
Setting `false` explicitly preserves the 5.9 behavior. This could be revisited later
by adding `.d.ts` declarations for CSS modules, but that's a broader effort.

## 8. Fix .buildkite/tsconfig.test.json
- [ ] Add `"types": ["node"]` since types now defaults to `[]`
- [ ] moduleResolution already handled in step 4

## 9. Remove ignoreDeprecations
- [ ] Remove `"ignoreDeprecations": "6.0"` from `tsconfig.base.json`

## 10. Full validation
- [ ] Run `node scripts/type_check`
- [ ] Run `node scripts/check_changes.ts`
