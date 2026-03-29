# Changelog

All notable changes to this project are documented in this file.

## [0.1.2.0] - 2026-03-29

### Changed

- Reworked the shared-buffer flow around real `?session=` links, explicit session joining, weekly buffer check-ins, and rule memory resurfacing instead of the earlier dashboard prototype.
- Split Supabase persistence into `shared_sessions`, `session_participants`, `weekly_states`, and `rule_memories`, and added `revision`-based overwrite protection for shared edits.
- Debounced remote saves and reordered writes so session metadata lands before dependent weekly state writes.

### Fixed

- Stopped flooding the browser console with repeated Supabase 404s when the shared-session tables are missing.
- Fixed false conflict warnings that appeared when two tabs simply opened the same session without making local edits.
- Fixed early shared-write races that could trigger `409` conflicts during initial session participation.

### Tested

- `npm run lint`
- `npm run test`
- `npm run build`

## [0.1.1.0] - 2026-03-29

### Added

- Replaced the static landing page with a stateful shared-buffer experience covering home, timeline, check-in, and rules.
- Added local persistence, optional Supabase sync wiring, and a starter `supabase/schema.sql` table for `app_state`.
- Added Vitest coverage for the interactive client, public env resolution, and Supabase client bootstrap.

### Changed

- Updated the global visual system to match the warmer shared-budget product direction.
- Set the root document language to Korean by default and passed public Supabase config through a dedicated env helper.
- Rewrote the README around the actual product surface, commands, and testing workflow.

### Fixed

- Fixed `Reset local` so it actually clears saved state instead of immediately writing a default snapshot back to storage.
