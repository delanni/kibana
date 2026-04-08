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
- [ ] Add `"ignoreDeprecations": "6.0"` to `tsconfig.base.json`
- [ ] Run initial type check to see baseline errors

## 3. Remove baseUrl
- [ ] Remove `baseUrl` from `tsconfig.base.json` (paths are already repo-root-relative)
- [ ] Remove `baseUrl` from any other tsconfig files that set it

## 4. Change moduleResolution from "node" to "bundler"
- [ ] `tsconfig.base.json`
- [ ] `packages/kbn-dependency-usage/tsconfig.json`
- [ ] `src/core/packages/chrome/navigation/packaging/tsconfig.json`
- [ ] `.buildkite/tsconfig.test.json`

## 5. Remove downlevelIteration
- [ ] Remove `downlevelIteration` from `tsconfig.base.json` (no-op with esnext target)

## 6. Fix target: es5 in tsconfig.browser.json
- [ ] Change `target` from `"es5"` to `"es2015"` or higher

## 7. Handle noUncheckedSideEffectImports
- [ ] Decide: set `false` in base config, or add module declarations for CSS/SCSS
- [ ] ~28 files with CSS/SCSS/SVG side-effect imports affected

## 8. Fix .buildkite/tsconfig.test.json
- [ ] Add `"types": ["node"]` since types now defaults to `[]`
- [ ] moduleResolution already handled in step 4

## 9. Remove ignoreDeprecations
- [ ] Remove `"ignoreDeprecations": "6.0"` from `tsconfig.base.json`

## 10. Full validation
- [ ] Run `node scripts/type_check`
- [ ] Run `node scripts/check_changes.ts`
