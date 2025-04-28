# Journal Entry 07: Playoff Scenario Validation Feature

**Date:** 2025-04-27

## Goals

1.  Implement a playoff bracket UI section.
2.  Allow users to select teams for Qualifier 1 and Eliminator slots.
3.  Implement logic to validate if the selected playoff configuration (Top 4 teams in specific ranks) is achievable based on simulating remaining league fixtures.
4.  Refactor code to remove dependency on `teams.json` and derive team data dynamically.
5.  Fix bugs related to state management and component rendering.

## Implementation Steps

1.  **Types (`types.ts`):**
    *   Defined new types for playoff state management: `PlayoffStage`, `PlayoffResult`, `PlayoffMatch`, and `PlayoffState`.
    *   Ensured these types used existing core types like `TeamInfo`.
2.  **Store (`pointsTableStore.ts`):**
    *   Added the `playoffState` slice to the Zustand store, including initial empty playoff matches.
    *   Added actions:
        *   `initializePlayoffs`: Populates Q1 (1 vs 2) and Eliminator (3 vs 4) based on the current `pointsTable` after the initial calculation.
        *   `updatePlayoffTeam`: Allows the UI to update the selected team for Q1 or Eliminator.
        *   `triggerPlayoffValidation`: Initiates the validation process.
    *   Added a helper `getAllTeams` to dynamically generate a unique list of `TeamInfo` objects from fixtures and results, removing the need for `teams.json`.
    *   Refactored `calculatePointsTable` action to call the extracted logic from `scoreCalculator.ts`.
    *   Added logic to `calculatePointsTable` to call `initializePlayoffs` only *once* after the first table calculation completes, fixing initialization order issues.
3.  **Score Calculation (`scoreCalculator.ts`):**
    *   Extracted the `calculatePointsTable` logic from the store into this file for better reusability.
    *   Modified `calculatePointsTable` to dynamically build the internal `teamsMap` from the provided match results, removing the `allTeams` parameter.
    *   Extracted the `parseScoreSummary` helper function here as well.
4.  **Playoff Validation Logic (`playoffValidation.ts`):**
    *   Created a new file for the core validation algorithm.
    *   Implemented `isPlayoffScenarioPossible`:
        *   Takes remaining fixtures, target playoff teams (Q1/EL), base results, and the dynamically generated list of all teams.
        *   Uses a recursive backtracking function (`findPossibleScenario`) to explore permutations of outcomes ('win', 'loss', 'tie') for remaining fixtures.
        *   For each complete simulation path, it calls the refactored `calculatePointsTable`.
        *   Checks if the resulting top 4 teams match the target teams *and* their required ranks (1 vs 2 for Q1, 3 vs 4 for EL).
        *   Returns `true` if at least one valid scenario is found, `false` otherwise.
    *   Updated the function signature and internal calls to `calculatePointsTable` to reflect the removal of the `allTeams` parameter.
5.  **Playoff UI (`PlayoffBracket.tsx`):**
    *   Created the main component to display the bracket structure (Q1, EL, Q2, Final).
    *   Used `TeamSelector` sub-component (with dropdowns) to allow users to change teams in Q1 and Eliminator slots.
    *   Populated dropdowns using the `getAllTeams` helper from the store.
    *   Added a "Check if Possible" button linked to the `triggerPlayoffValidation` action.
    *   Displays validation status (In Progress, Possible, Impossible).
    *   Removed the redundant `useEffect` hook for `initializePlayoffs`.
    *   Fixed Zustand hook usage by selecting individual state slices/actions to avoid issues with `shallow` comparison and prevent infinite loops.
6.  **App Layout (`App.tsx`):**
    *   Integrated the `PlayoffBracket` component into the main application view below other sections.
7.  **Bug Fixing:**
    *   Addressed "Maximum update depth exceeded" errors by fixing the Zustand selector pattern in `PlayoffBracket` and the initialization logic in the store.
    *   Resolved React hydration warnings in `PointsTable.tsx` by removing extraneous whitespace.
    *   Corrected various TypeScript errors related to imports, types, and function signatures during the refactoring process.

## Outcome

The application now features a functional Playoff Scenario section. Users can modify the initial playoff matchups (Q1 and Eliminator) and trigger a validation check. The system simulates remaining league games to determine if the user's chosen playoff configuration is mathematically possible. The codebase is more robust by dynamically deriving team information instead of relying on a potentially inconsistent `teams.json`. Several bugs related to state management and rendering have been fixed.
