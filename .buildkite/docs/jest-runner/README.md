# Jest CI runner

Docs for how Jest unit and integration tests are orchestrated and executed in CI,
and for the in-progress refactor of that harness.

- [status-quo.md](./status-quo.md) — how the runner works **today**: the two CI
  phases, every env-setup point, and each shell/JS/subprocess boundary crossing.
- [migration-plan.md](./migration-plan.md) — target 3-layer architecture and the
  phased plan to get there (readability, JS testability, negative testing,
  simplification, Jest modernization).

> Scope: the `Jest Tests` and `Jest Integration Tests` Buildkite steps, the
> `Pick Test Group Run Order` step that generates them, and the `@kbn/test`
> code they invoke. FTR/Scout are only referenced where they share plumbing.
