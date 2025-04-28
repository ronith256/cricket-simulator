# Journal Entry 03: Data Integration, Context Setup, and Bug Fixes

**Date:** 27 Apr 2025

## Goals

1.  Integrate the actual project data (`teams.json`, `fixtures.json`, `results.json`) based on `DATA.md`.
2.  Define accurate TypeScript types for the data.
3.  Set up the `DataContext` to load, transform, and provide this data.
4.  Update core logic (`pointsTableLogic`) and components (`MatchCard`, `ScenarioTree`) to use the new types and data.
5.  Implement the initial rendering of the match timeline in `ScenarioTree`.
6.  Address bugs identified during testing (sorting, NRR parsing, logo display).

## Implementation Steps

1.  **Type Definitions (`types.ts`):**
    *   Defined `TeamInfo`, `Fixture`, `CompletedMatch`, `TeamRef`, and `ManOfTheMatch` interfaces based on the structures outlined in `DATA.md`.
    *   Updated `PointsTableEntry` and `ScenarioInput` (placeholder) to use the new types.
    *   Marked old types (`Team`, `Match`, `MatchResult`) for review/removal.

2.  **Data Context (`DataContext.tsx`):**
    *   Imported `results.json` alongside `teams.json` and `fixtures.json`.
    *   Added state for `results: CompletedMatch[]`.
    *   Updated `DataContextProps` to include `results`.
    *   Modified the `useEffect` hook to:
        *   Load all three JSON files.
        *   Transform the raw data to match the defined TypeScript types (e.g., mapping `logoUrl` to `logo`, converting numeric string IDs where necessary, ensuring `toss_decision` validity).
    *   Updated the `calculatedPointsTable` memoization to depend on `results`, `fixtures`, `teams`, and `userScenario`.
    *   Updated the call to `calculatePointsTable` to pass all required arguments (`results`, `fixtures`, `userScenario`, `teams`).
    *   Refined the placeholder `applyScenarioToFixtures` function signature and comments.

3.  **Points Table Logic (`pointsTableLogic.ts`):**
    *   Updated `calculatePointsTable` function signature to accept `results`, `fixtures`, `scenario`, and `teams` (using new types).
    *   Modified the core logic to iterate separately over `results` (completed matches) and `fixtures` (applying `scenario` outcomes).
    *   Updated team lookups and point calculations based on `CompletedMatch` properties (`winner_team_id`) and `ScenarioInput` outcomes.
    *   Updated the `calculateNRR` function signature to accept `CompletedMatch[]`.
    *   Refined the `parseScore` regex for better flexibility with score summary strings (e.g., `205/5 (20.0 Overs)`).
    *   Updated `calculateNRR` internal logic to use `CompletedMatch` properties and the `parseScore` helper.
    *   Updated the `oversToBalls` helper to correctly handle the `isAllOut` condition based on parsed wickets.

4.  **Match Card (`MatchCard.tsx`):**
    *   Updated component props and internal logic to accept and handle `Fixture | CompletedMatch`.
    *   Implemented `isCompletedMatch` type guard.
    *   Refactored `generateResultSummary` to use `CompletedMatch` data or scenario details (placeholder).
    *   Updated score display (`displayHomeScore`, `displayAwayScore`) to use `innings1_summary` and `innings2_summary` from `CompletedMatch`.
    *   Corrected the `getTeamLogo` function to look up teams based on their `code` (from `match.home_team.code` / `match.away_team.code`) in the `teams` array from context, fixing the placeholder logo issue.
    *   Updated status display logic.
    *   Commented out/added TODOs for the simulation edit form logic pending definition of `ScenarioInput.editDetails`.

5.  **Scenario Tree (`ScenarioTree.tsx`):**
    *   Updated component to fetch both `results` and `fixtures` from `DataContext`.
    *   Combined `results` and `fixtures` into a single `allMatches` array.
    *   Implemented sorting for `allMatches` by date **descending** (latest first) to show upcoming matches at the top.
    *   Updated the rendering logic to map over `allMatches` and pass each item to `MatchCard`.

## Outcome

*   The application now correctly loads, transforms, and utilizes the data from the three core JSON files (`teams`, `fixtures`, `results`).
*   TypeScript types align with the actual data structures.
*   The `DataContext` provides the necessary data to components.
*   The points table calculation logic processes completed matches and placeholder scenarios.
*   The `ScenarioTree` displays a combined, chronologically sorted (latest first) list of completed and upcoming matches.
*   NRR parsing errors and incorrect logo displays have been fixed.

## Next Steps

*   Define the structure for `ScenarioInput.editDetails` in `types.ts`.
*   Implement the simulation edit form logic within `MatchCard.tsx`.
*   Refine the `applyScenarioToFixtures` function or adjust `calculatePointsTable` to fully handle scenario application for points calculation (and potentially NRR simulation later).
*   Implement the actual tree layout/styling in `ScenarioTree.tsx` instead of a simple list.
*   Address playoff logic and rendering.
