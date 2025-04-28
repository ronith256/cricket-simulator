# Journal Entry 05: Zustand for Points Table Calculation

**Date:** 2025-04-27

## Goals

1.  Implement the points table calculation logic based on `results.json`.
2.  Calculate Points and Net Run Rate (NRR).
3.  Use Zustand for state management to store and provide the calculated table.
4.  Refactor components to use the new Zustand store instead of the previous `DataContext`.
5.  Address performance issues and errors encountered during implementation.

## Implementation Steps

1.  **Installed Zustand:** Added Zustand as a project dependency (`npm install zustand`).
2.  **Created Zustand Store (`pointsTableStore.ts`):**
    *   Defined a new store `usePointsTableStore` in `src/store/pointsTableStore.ts`.
    *   Initially loaded `fixtures.json` and `results.json` into the store state.
    *   Included state for `userScenario` (initially empty) and the calculated `pointsTable`.
    *   Added data transformation logic (previously in `DataContext`) to handle potential inconsistencies (like string vs. number IDs) in the source JSON data during initial load.
3.  **Implemented Points Table Logic:**
    *   Created a `calculatePointsTable` action within the store.
    *   This action processes the `results` array.
    *   It dynamically builds a map (`teamsMap`) of team statistics as it iterates through results, avoiding reliance on a separate `teams.json` for the core calculation and fixing "Team data missing" warnings.
    *   Calculates Played, Won, Lost, Tied, and Points for each team.
    *   Includes NRR calculation:
        *   Added a `parseScoreSummary` helper function to extract runs, wickets, and balls faced/bowled from the summary strings (e.g., "201/4 (20.0 Over)").
        *   Accumulated runs scored/conceded and balls faced/bowled for each team.
        *   Calculated NRR using the formula `(Runs Scored / Balls Faced * 6) - (Runs Conceded / Balls Bowled * 6)`.
    *   Formats the final data into `PointsTableEntry[]`, including team details derived from the processed results.
    *   Sorts the table by Points (desc), NRR (desc), and Wins (desc).
    *   Updates the `pointsTable` state in the store.
4.  **Component Refactoring:**
    *   **`App.tsx`:** Added a `useEffect` hook (with an empty dependency `[]` to run only once) to call `calculatePointsTable` on initial mount.
    *   **`PointsTable.tsx`:** Modified to fetch `pointsTable` state directly from `usePointsTableStore` instead of `useData`.
    *   **`ScenarioTree.tsx`:** Modified to fetch `fixtures` and `results` from `usePointsTableStore`. Optimized selectors to fetch individual state slices to prevent unnecessary re-renders.
    *   **`MatchCard.tsx`:** Modified to fetch `userScenario` and `setUserScenario` from `usePointsTableStore`. Removed dependency on the separate `teams` state, getting team codes/logos directly from the `match` prop. Optimized selectors. Fixed `setUserScenario` call to pass the new state directly instead of using a functional update.
5.  **Removed `DataContext`:**
    *   Removed the `DataProvider` wrapper in `main.tsx`.
    *   Deleted `src/context/DataContext.tsx`.
    *   Deleted `src/logic/pointsTableLogic.ts`.
6.  **Troubleshooting:**
    *   Addressed "Maximum update depth exceeded" errors by fixing `useEffect` dependencies in `App.tsx` and optimizing Zustand selectors in `ScenarioTree.tsx` and `MatchCard.tsx`.
    *   Removed extra whitespace in `PointsTable.tsx` to resolve React hydration warnings.

## Outcome

The application now uses Zustand for managing state related to fixtures, results, scenarios, and the points table. The points table is calculated dynamically based on the results data, including NRR, and displayed correctly. The previous `DataContext` has been successfully removed, centralizing state logic within the Zustand store. Performance warnings related to selectors have been addressed.
