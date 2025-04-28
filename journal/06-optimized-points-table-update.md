# Journal Entry 06: Optimized Points Table Update on Simulation

**Date:** 2025-04-27

## Goals

1.  Implement the functionality where editing a match outcome via the `MatchCard` form updates the points table.
2.  Ensure the points table update is optimized, only recalculating/adjusting stats for the two teams involved in the edited match.
3.  Correctly display the status ("Simulated", "Completed", "Upcoming") on the `MatchCard`.

## Implementation Steps

1.  **Score Calculation Logic (`scoreCalculator.ts`):**
    *   Created `src/logic/scoreCalculator.ts`.
    *   Implemented the `calculateImpliedResult` function. This function takes the `editDetails` from the simulation form and the involved teams (`homeTeam`, `awayTeam`).
    *   It calculates the implied `innings1_summary`, `innings2_summary`, `first_batting_team`, `second_batting_team`, `winner_team_id`, and `result` string based on the specified win margin (runs/wickets) and remaining balls/overs, adhering to the logic defined in the prompt.
2.  **Zustand Store Update (`pointsTableStore.ts`):**
    *   Modified the `updateMatchResult` action:
        *   It now finds the original match data (either from `results` or `fixtures`).
        *   Calls `calculateImpliedResult` to get the new outcome details.
        *   Constructs a new `CompletedMatch` object, marking it with `isSimulated: true`.
        *   **Optimization:** Instead of triggering a full `calculatePointsTable`, it now directly modifies the existing `pointsTable` state:
            *   Calculates the statistical impact (points, W/L/T, NRR components) of the original result (if any) and the new result for the two involved teams.
            *   Adjusts the `played`, `won`, `lost`, `tied`, and `points` for the two teams in the `pointsTable` array based on the difference between the original and new stats.
            *   Recalculates the NRR specifically for the two affected teams by iterating through the *updated* full list of results (`finalResultsList`) to get their total runs/balls scored/conceded.
            *   Updates the NRR for the two teams in the `pointsTable` array.
        *   Re-sorts the `pointsTable` array based on the updated values.
        *   Updates the `fixtures` and `results` arrays in the store state (moving the match from fixtures to results if it was newly simulated, or updating the existing entry in results).
        *   Sets the final state with updated `fixtures`, `results`, and the adjusted `pointsTable`.
3.  **Type Update (`types.ts`):**
    *   Added an optional `isSimulated?: boolean` flag to the `CompletedMatch` interface to distinguish between original results and user-generated simulations.
    *   Ensured the initial data transformation in `pointsTableStore.ts` sets `isSimulated: false` for results loaded from `results.json`.
4.  **Match Card Update (`MatchCard.tsx`):**
    *   Modified `handleSave` to call the new `updateMatchResult` action from the store, removing the previous logic that updated `userScenario`.
    *   Updated the score and result summary display logic to prioritize showing data from the potentially updated `CompletedMatch` object found in the store's `results` array.
    *   Corrected the status tag display logic to use the `isSimulated` flag from the `updatedMatchData`. It now correctly shows "Simulated" only for user-edited results, "Completed" for original results, and "Upcoming" for fixtures.

## Outcome

Editing a match outcome now triggers an optimized update to the points table, adjusting only the relevant teams' statistics and NRR. The `MatchCard` correctly reflects the simulated result and displays the appropriate status tag ("Simulated" or "Completed").
