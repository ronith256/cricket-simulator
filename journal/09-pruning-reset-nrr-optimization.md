# Journal Entry 09: Pruning, Reset Functionality & Conditional NRR Optimization

**Date:** 2025-04-27

## Changes Implemented

1.  **Points-Based Pruning:**
    *   Implemented pruning logic within the `findPossibleScenario` function in `scenarioWorker.ts`.
    *   This applies to both `CHECK_SINGLE_TEAM` and `VALIDATE_4_TEAMS` query types.
    *   The logic calculates the maximum possible points for relevant teams (target teams and potential blockers) during the simulation.
    *   If it becomes mathematically impossible for the target condition (e.g., single team qualifying, specific multi-team scenario) to be met based on points alone, that simulation branch is pruned, significantly reducing computation time.

2.  **Reset Simulated Results:**
    *   Added a `resetSimulatedResults` action to `pointsTableStore.ts`. This action identifies results marked with `isSimulated: true`, removes them, converts them back into `Fixture` objects (with default time/status), adds them back to the `fixtures` array, sorts fixtures, and recalculates the points table based on the remaining non-simulated results.
    *   Added a "Reset Sims" button to `QueryInterface.tsx` and `PlayoffBracket.tsx`. This button is conditionally rendered only when `isSimulated` results exist and calls the `resetSimulatedResults` store action.

3.  **Conditional NRR Tiebreaker Optimization:**
    *   Added an "Attempt NRR Tiebreaker (Slower)" toggle switch to both `QueryInterface.tsx` and `PlayoffBracket.tsx`.
    *   The state of this switch (`optimizeNrr`) is now passed to the `scenarioWorker`.
    *   Modified the base case logic in `findPossibleScenario`:
        *   When a points-possible scenario is found, it checks if the target team(s) are involved in an NRR tie near the 4th position using a new `checkNrrTie` helper function.
        *   **If** an NRR tie exists **and** the `optimizeNrr` flag is `true`:
            *   A new helper `generateNrrOptimizedScores` is called for matches involving the target team(s) in that specific scenario. This helper attempts to generate favorable win/loss margins within defined score bounds (49-300 runs).
            *   The points table is recalculated with these optimized scores.
            *   If the target team(s) now win the NRR tiebreaker, this optimized scenario is returned. Otherwise, `null` is returned for that path (indicating NRR win wasn't achieved even with optimization).
        *   **If** no NRR tie exists **or** `optimizeNrr` is `false`:
            *   The original, non-optimized scenario is returned.
    *   Adjusted the result message sent back to the UI. If `optimizeNrr` is `false` and a points-possible scenario involves an NRR tie, the message now includes "Qualification depends on NRR tiebreaker."

## Current Status

The application now features significantly faster scenario checking due to points-based pruning. Users can easily reset any applied simulations. Furthermore, users have the option to attempt a more detailed (but slower) check that tries to find a specific scenario demonstrating how an NRR tiebreaker could be won, using realistic score limits. This provides more nuanced results when NRR is critical.
