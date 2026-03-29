# Changelog

All notable changes to this project are documented in this file.

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
