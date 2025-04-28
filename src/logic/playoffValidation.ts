// This file previously contained the synchronous playoff validation logic.
// That logic has been moved to src/logic/scenarioWorker.ts to run asynchronously
// and prevent blocking the main UI thread.

// Interface for the target playoff setup (still potentially useful)
export interface TargetPlayoffTeams {
    q1Team1Id: string | null;
    q1Team2Id: string | null;
    elTeam1Id: string | null;
    elTeam2Id: string | null;
}

// The main validation function `isPlayoffScenarioPossible` is now obsolete
// as the logic resides within the web worker.

// Keeping the file for the type definition and historical context.
