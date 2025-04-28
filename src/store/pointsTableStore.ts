import { create } from 'zustand';
import {
  CompletedMatch,
  PointsTableEntry,
  Fixture,
  ScenarioInput,
  TeamRef,
  TeamInfo,
  PlayoffState, // Added
  // PlayoffMatch, // Added
  PlayoffStage, // Added
  // PlayoffResult, // Added
  TeamQualifierStats, // Added from worker types
  TeamWinLoseStats, // Added new type
} from '../types'; // Assuming types are updated or defined here
// Removed import of initialFixturesData
// Removed import of initialResultsData
// Removed import of initialTeamsData
import {
  calculateImpliedResult,
    calculatePointsTable, // Import extracted function
    parseScoreSummary, // Import extracted helper
} from '../logic/scoreCalculator';

const transformFixtures = (fixtures: any[]): Fixture[] => {
  // Ensure team objects within fixtures have string IDs if needed, matching results transform
  return fixtures.map(fixture => ({
      ...fixture,
      match_id: String(fixture.match_id),
      // Assuming Fixture also uses TeamRef which might have numeric IDs initially
      home_team: { ...fixture.home_team, id: String(fixture.home_team.id) },
      away_team: { ...fixture.away_team, id: String(fixture.away_team.id) },
  }));
};


const transformResults = (results: any[]): CompletedMatch[] => {
  return results.map(result => ({
    ...result,
    match_id: String(result.match_id),
    home_team: { ...result.home_team, id: String(result.home_team.id) },
    away_team: { ...result.away_team, id: String(result.away_team.id) },
    first_batting_team: result.first_batting_team
      ? { ...result.first_batting_team, id: String(result.first_batting_team.id) }
      : undefined,
    second_batting_team: result.second_batting_team
      ? { ...result.second_batting_team, id: String(result.second_batting_team.id) }
      : undefined,
    winner_team_id: result.winner_team_id != null ? String(result.winner_team_id) : null,
    toss_decision: ((result.toss_decision === 'Bat' || result.toss_decision === 'Field') ? result.toss_decision : 'Bat') as 'Bat' | 'Field',
    man_of_the_match: result.man_of_the_match
      ? {
          ...result.man_of_the_match,
          player_id: result.man_of_the_match.player_id != null ? String(result.man_of_the_match.player_id) : null
        }
      : null,
    isSimulated: false, // Initialize original results as not simulated
  }));
};


// --- Store Definition ---

export interface PointsTableState { // Added export
  // Removed teams state
  fixtures: Fixture[];
  results: CompletedMatch[];
  userScenario: ScenarioInput[];
  pointsTable: PointsTableEntry[];
  calculatePointsTable: (resultsToUse?: CompletedMatch[]) => void;
  setUserScenario: (scenario: ScenarioInput[]) => void;
    updateMatchResult: (matchId: string, editDetails: ScenarioInput['editDetails']) => void;
    // Playoff State & Actions
    playoffState: PlayoffState;
    initializePlayoffs: () => void; // Action to set initial playoff teams based on table
    updatePlayoffTeam: (stage: PlayoffStage, teamIndex: 1 | 2, team: TeamInfo | null) => void; // Action to manually change a team
    // Removed triggerPlayoffValidation as logic moved to worker/UI
    // Internal flag
    _initialCalculationDone: boolean;
    // Derived state/selector helper
    getAllTeams: () => TeamInfo[];
    // Action to apply a found scenario
    applyScenarioResults: (scenarioResults: CompletedMatch[]) => void;
    // Action to reset simulated results
    resetSimulatedResults: () => void;
    // Probability Calculation State & Actions
    qualifierStats: TeamQualifierStats[] | null;
    isCalculatingProbabilities: boolean;
    probabilityCalculationProgress: number; // 0-100
    totalProbabilityScenarios: number;
    processedProbabilityScenarios: number;
    startProbabilityCalculation: () => void; // Action to trigger worker
    setProbabilityResults: (stats: TeamQualifierStats[]) => void; // Action for worker result
    updateProbabilityProgress: (progress: number, processed: number, total: number) => void; // Action for worker progress
    setProbabilityCalculationStatus: (status: boolean) => void; // Action to set loading state
    // Win/Lose All State & Actions
    winLoseAllStats: TeamWinLoseStats[] | null;
    calculateWinLoseAllScenarios: () => void; // Action to trigger calculation
    setWinLoseAllResults: (stats: TeamWinLoseStats[]) => void; // Action to store results
    // Playoff Validation Action
    // updateValidationProgress: (progress: number) => void; // Removed progress action
    setValidationResult: (result: boolean | null, message?: string) => void;
    // Action to load initial data
    loadInitialData: (rawResults: any[], rawFixtures: any[]) => void; // Added action
    // State to track if data is loaded
    isDataLoaded: boolean; // Added state
  }

type StatsUpdate = {
    points: number;
    won: number;
    lost: number;
    tied: number;
    runsScored: number;
    ballsFaced: number;
    runsConceded: number;
    ballsBowled: number;
};

// Apply transformations to initial data
// Removed transformedTeams
// Removed transformedFixtures initialization here
// Removed transformedResults initialization here


export const usePointsTableStore = create<PointsTableState>((set, get) => ({
  // Initial state
  // Removed teams state
  fixtures: [], // Initialize as empty
  results: [], // Initialize as empty
  userScenario: [],
  pointsTable: [],
  // Initial Playoff State
  playoffState: {
    matches: [
      { id: 'Qualifier 1', matchNumber: 71, team1: null, team2: null, status: 'pending' },
      { id: 'Eliminator', matchNumber: 72, team1: null, team2: null, status: 'pending' },
      { id: 'Qualifier 2', matchNumber: 73, team1: null, team2: null, status: 'pending' },
      { id: 'Final', matchNumber: 74, team1: null, team2: null, status: 'pending' },
    ],
    selectedWinner: null,
    isValidationInProgress: false,
    validationResult: null,
    // validationProgress: 0, // Removed progress state
  },
  _initialCalculationDone: false,
  // Probability State
  qualifierStats: null,
  isCalculatingProbabilities: false,
  probabilityCalculationProgress: 0,
  totalProbabilityScenarios: 0,
  processedProbabilityScenarios: 0,
  // Win/Lose All State
  winLoseAllStats: null,
  // Initial data loaded state
  isDataLoaded: false, // Initialize as false


  // Helper to get all unique teams from fixtures and results
  getAllTeams: () => {
    const { fixtures, results } = get();
    const teamMap = new Map<string, TeamInfo>();

    const addTeam = (teamRef: TeamRef | undefined) => {
      if (teamRef && !teamMap.has(teamRef.id)) {
        // Convert TeamRef to TeamInfo (assuming necessary fields are present)
        teamMap.set(teamRef.id, {
          id: teamRef.id,
          name: teamRef.name,
          code: teamRef.code,
          logo: teamRef.logo || '/placeholder_logo.png', // Provide fallback logo
        });
      }
    };

    fixtures.forEach(f => {
      addTeam(f.home_team);
      addTeam(f.away_team);
    });
    results.forEach(r => {
      addTeam(r.home_team);
      addTeam(r.away_team);
      // Add teams from batting/MOTM if needed, though home/away should cover all participants
      // addTeam(r.first_batting_team);
      // addTeam(r.second_batting_team);
    });

    return Array.from(teamMap.values());
  },

  setUserScenario: (scenario) => set({ userScenario: scenario }),

  updateMatchResult: (matchId, editDetails) => {
    const { fixtures, results, pointsTable } = get();
    let updatedFixtures = [...fixtures];
    let updatedResults = [...results];
    let originalMatchData: CompletedMatch | null = null; // Store original result if exists
    let matchFound = false;
    let isNewResult = false; // Was this originally a fixture?

    // --- 1. Find Original Match & Calculate New Result ---
    const resultIndex = updatedResults.findIndex(r => r.match_id === matchId);
    let matchContext: Fixture | CompletedMatch;

    if (resultIndex !== -1) {
      // Match already exists in results, store its original data
      originalMatchData = { ...updatedResults[resultIndex] }; // Deep copy original
      matchContext = originalMatchData;
      matchFound = true;
    } else {
      // Match must be in fixtures
      const fixtureIndex = updatedFixtures.findIndex(f => f.match_id === matchId);
      if (fixtureIndex !== -1) {
        matchContext = updatedFixtures[fixtureIndex];
        matchFound = true;
        isNewResult = true; // This is the first result for this fixture
      } else {
        console.error(`Match with ID ${matchId} not found.`);
        return;
      }
    }

    if (!matchContext) return; // Should be caught above, but safety check

    const calculatedDetails = calculateImpliedResult(editDetails, matchContext.home_team, matchContext.away_team);
    if (!calculatedDetails) {
      console.error(`Could not calculate implied result for match ${matchId}`);
      return;
    }

    // Construct the new CompletedMatch object
    const newResultData: CompletedMatch = {
      match_id: matchContext.match_id,
      match_number: matchContext.match_number,
      date: matchContext.date,
      venue: matchContext.venue,
      home_team: matchContext.home_team,
      away_team: matchContext.away_team,
      ...calculatedDetails,
      toss_winner: (originalMatchData?.toss_winner) || matchContext.home_team.name,
      toss_decision: (originalMatchData?.toss_decision) || 'Bat',
      dls_applied: (originalMatchData?.dls_applied) || false,
      man_of_the_match: (originalMatchData?.man_of_the_match) || null,
      isSimulated: true, // Mark this result as simulated
    };

    // --- 2. Calculate Stats Delta ---
    const homeTeamId = newResultData.home_team.id;
    const awayTeamId = newResultData.away_team.id;

    // Helper to get stats impact of a single result
    const getStatsUpdate = (result: CompletedMatch | null): Record<string, StatsUpdate> => {
        const updates: Record<string, StatsUpdate> = {
            [homeTeamId]: { points: 0, won: 0, lost: 0, tied: 0, runsScored: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0 },
            [awayTeamId]: { points: 0, won: 0, lost: 0, tied: 0, runsScored: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0 },
        };
        if (!result) return updates; // No impact if no result

        const winnerId = result.winner_team_id;
        // Points, W/L/T
        if (winnerId) {
            if (winnerId === homeTeamId) {
                updates[homeTeamId].points += 2; updates[homeTeamId].won += 1; updates[awayTeamId].lost += 1;
            } else {
                updates[awayTeamId].points += 2; updates[awayTeamId].won += 1; updates[homeTeamId].lost += 1;
            }
        } else { // Tie
            updates[homeTeamId].points += 1; updates[homeTeamId].tied += 1;
            updates[awayTeamId].points += 1; updates[awayTeamId].tied += 1;
        }

        // NRR Components
        const innings1 = parseScoreSummary(result.innings1_summary);
        const innings2 = parseScoreSummary(result.innings2_summary);
        const firstBatId = result.first_batting_team?.id;
        const secondBatId = result.second_batting_team?.id;

        if (innings1 && firstBatId && secondBatId) {
            updates[firstBatId].runsScored += innings1.runs; updates[firstBatId].ballsFaced += innings1.balls;
            updates[secondBatId].runsConceded += innings1.runs; updates[secondBatId].ballsBowled += innings1.balls;
        }
        if (innings2 && firstBatId && secondBatId) {
            updates[secondBatId].runsScored += innings2.runs; updates[secondBatId].ballsFaced += innings2.balls;
            updates[firstBatId].runsConceded += innings2.runs; updates[firstBatId].ballsBowled += innings2.balls;
        }
        return updates;
    };

    const originalStats = getStatsUpdate(originalMatchData);
    const newStats = getStatsUpdate(newResultData);

    // --- 3. Update Points Table ---
    let updatedPointsTable = [...pointsTable]; // Copy current table

    [homeTeamId, awayTeamId].forEach(teamId => {
        const tableIndex = updatedPointsTable.findIndex(entry => entry.team.id === teamId);
        if (tableIndex === -1) {
            console.error(`Team ${teamId} not found in points table during update.`);
            return; // Should not happen if table is initialized
        }

        const updatedEntry = { ...updatedPointsTable[tableIndex] }; // Copy entry

        // Adjust Played count
        if (isNewResult) {
            updatedEntry.played += 1;
        } // Played count doesn't change if only modifying an existing result

        // Reverse original stats impact
        updatedEntry.points -= originalStats[teamId].points;
        updatedEntry.won -= originalStats[teamId].won;
        updatedEntry.lost -= originalStats[teamId].lost;
        updatedEntry.tied -= originalStats[teamId].tied;
        // Note: NRR raw components are not stored directly in PointsTableEntry,
        // so we calculate the final NRR based on adjusted totals later.
        // We need temporary storage or recalculation based on full results if we were
        // storing raw NRR components. Let's stick to recalculating NRR here.

        // Apply new stats impact
        updatedEntry.points += newStats[teamId].points;
        updatedEntry.won += newStats[teamId].won;
        updatedEntry.lost += newStats[teamId].lost;
        updatedEntry.tied += newStats[teamId].tied;

        // --- NRR Recalculation for the two affected teams ---
        // This is the tricky part of the optimization. To avoid a full table recalc,
        // we need the *total* NRR components for these two teams across *all* matches.
        // The simplest way is to recalculate just for these two teams based on the *updated* full results list.

        let teamRunsScored = 0, teamBallsFaced = 0, teamRunsConceded = 0, teamBallsBowled = 0;
        const finalResultsList = isNewResult
            ? [...updatedResults, newResultData] // Add new result if it was a fixture
            : updatedResults.map(r => r.match_id === matchId ? newResultData : r); // Replace existing result

        finalResultsList.forEach(match => {
            if (match.home_team.id === teamId || match.away_team.id === teamId) {
                const innings1 = parseScoreSummary(match.innings1_summary);
                const innings2 = parseScoreSummary(match.innings2_summary);
                const firstBatId = match.first_batting_team?.id;
                const secondBatId = match.second_batting_team?.id;

                if (innings1 && firstBatId && secondBatId) {
                    if (firstBatId === teamId) { teamRunsScored += innings1.runs; teamBallsFaced += innings1.balls; }
                    if (secondBatId === teamId) { teamRunsConceded += innings1.runs; teamBallsBowled += innings1.balls; }
                }
                if (innings2 && firstBatId && secondBatId) {
                    if (secondBatId === teamId) { teamRunsScored += innings2.runs; teamBallsFaced += innings2.balls; }
                    if (firstBatId === teamId) { teamRunsConceded += innings2.runs; teamBallsBowled += innings2.balls; }
                }
            }
        });

        let nrr = 0;
        if (teamBallsFaced > 0 && teamBallsBowled > 0) {
            const runRateScored = (teamRunsScored / teamBallsFaced) * 6;
            const runRateConceded = (teamRunsConceded / teamBallsBowled) * 6;
            nrr = runRateScored - runRateConceded;
        }
        updatedEntry.nrr = parseFloat(nrr.toFixed(3));
        // --- End NRR Recalculation ---

        updatedPointsTable[tableIndex] = updatedEntry; // Put updated entry back
    });

    // --- 4. Sort and Update State ---
    // Sort the updated table
    updatedPointsTable.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.nrr !== a.nrr) return b.nrr - a.nrr;
        if (b.won !== a.won) return b.won - a.won;
        return a.team.name.localeCompare(b.team.name);
    });

    // Update the results/fixtures arrays
    if (isNewResult) {
        updatedFixtures = updatedFixtures.filter(f => f.match_id !== matchId);
        updatedResults.push(newResultData);
    } else {
        updatedResults[resultIndex] = newResultData; // Overwrite the original result
    }

    // Set the final state
    set({
        fixtures: updatedFixtures,
        results: updatedResults,
        pointsTable: updatedPointsTable
    });
  },

   // Initial calculation logic - Now calls the external function
   calculatePointsTable: (resultsToUse) => {
    // console.log("Store: calculatePointsTable action started."); // DEBUG REMOVED
    const { results } = get(); // Only need results now
    const currentResults = resultsToUse || results;
    // Call the extracted function (no longer needs teams)
    // console.log("Store: Calling external calculatePointsTable function..."); // DEBUG REMOVED
    const table = calculatePointsTable(currentResults);
    // console.log("Store: External calculatePointsTable returned:", table); // DEBUG REMOVED
    const initialCalculationDone = get()._initialCalculationDone;
    // console.log("Store: Initial calculation done flag:", initialCalculationDone); // DEBUG REMOVED

    set({ pointsTable: table, _initialCalculationDone: true }); // Set table and mark initial calc as done

    // Initialize playoffs only after the very first calculation
    if (!initialCalculationDone) {
        // console.log("Store: First calculation, calling initializePlayoffs..."); // DEBUG REMOVED
        get().initializePlayoffs();
        // console.log("Store: initializePlayoffs call completed."); // DEBUG REMOVED
    } else {
        // console.log("Store: Not the first calculation, skipping initializePlayoffs."); // DEBUG REMOVED
    }
    // console.log("Store: calculatePointsTable action finished."); // DEBUG REMOVED
  },

  // --- Playoff Actions ---
  initializePlayoffs: () => {
    // console.log("Store: initializePlayoffs action started."); // DEBUG REMOVED
    const { pointsTable } = get(); // Only need pointsTable here
    // console.log("Store: Points table for playoff initialization:", pointsTable); // DEBUG REMOVED
    const top4 = pointsTable.slice(0, 4).map(entry => entry.team); // Get top 4 teams
    // console.log("Store: Derived top 4 teams:", top4); // DEBUG REMOVED

    if (top4.length < 4) {
      console.warn("Store: Not enough teams in points table to initialize playoffs."); // DEBUG REMOVED
      // Keep existing playoff teams or set all to null
      return;
    }

    set(state => ({
      playoffState: {
        ...state.playoffState,
        matches: [
          { ...state.playoffState.matches[0], team1: top4[0], team2: top4[1], status: 'scheduled' }, // Q1: 1 vs 2
          { ...state.playoffState.matches[1], team1: top4[2], team2: top4[3], status: 'scheduled' }, // EL: 3 vs 4
          { ...state.playoffState.matches[2], team1: null, team2: null, status: 'pending' }, // Q2: Loser Q1 vs Winner EL
          { ...state.playoffState.matches[3], team1: null, team2: null, status: 'pending' }, // Final: Winner Q1 vs Winner Q2
        ],
        validationResult: null, // Reset validation on re-initialization
      }
    }));
    // TODO: Need logic to determine Q2/Final teams based on Q1/EL results if they exist
  },

  updatePlayoffTeam: (stage, teamIndex, team) => {
    set(state => {
      const matchIndex = state.playoffState.matches.findIndex(m => m.id === stage);
      if (matchIndex === -1) return {}; // No change if stage not found

      const updatedMatches = [...state.playoffState.matches];
      const matchToUpdate = { ...updatedMatches[matchIndex] };

      if (teamIndex === 1) {
        matchToUpdate.team1 = team;
      } else {
        matchToUpdate.team2 = team;
      }
      updatedMatches[matchIndex] = matchToUpdate;

      // Reset validation status when teams are manually changed
      return {
        playoffState: {
          ...state.playoffState,
          matches: updatedMatches,
          validationResult: null, // Reset validation result
          isValidationInProgress: false, // Reset validation progress flag too
          // validationProgress: 0 // Reset progress as well - REMOVED
        }
      };
    });
    // Validation is now triggered directly from UI components using the worker
    // get().triggerPlayoffValidation(); // Removed call
    // ---------------------------------------------------------
  },

  // Removed triggerPlayoffValidation action entirely
  // triggerPlayoffValidation: async () => { ... },

  applyScenarioResults: (scenarioResults) => {
    console.log("Store: Applying scenario results:", scenarioResults);
    const { results, fixtures } = get();

    // Create a map of the scenario results for quick lookup
    // const scenarioResultMap = new Map(scenarioResults.map(r => [r.match_id, r]));
    const scenarioMatchIds = new Set(scenarioResults.map(r => r.match_id));

    // Filter out original results that are part of the new scenario
    const updatedBaseResults = results.filter(r => !scenarioMatchIds.has(r.match_id));

    // Combine base results with the new scenario results
    const finalResults = [...updatedBaseResults, ...scenarioResults];

    // Filter fixtures to remove matches included in the scenario
    const updatedFixtures = fixtures.filter(f => !scenarioMatchIds.has(f.match_id));

    // Update state and recalculate points table
    set({
        results: finalResults,
        fixtures: updatedFixtures,
        userScenario: [], // Clear any manual user scenario inputs as we've applied a full one
    });

    // Recalculate the points table based on the newly applied results
    get().calculatePointsTable(finalResults);
    console.log("Store: Scenario applied and points table recalculated.");
  },

  resetSimulatedResults: () => {
    console.log("Store: Resetting simulated results...");
    // 'get' and 'set' are accessible here because this function is now part of the object returned by create
    const { results, fixtures } = get();

    // Add explicit types for filter parameters
    const simulatedResults = results.filter((r: CompletedMatch) => r.isSimulated === true);
    const nonSimulatedResults = results.filter((r: CompletedMatch) => r.isSimulated !== true);

    if (simulatedResults.length === 0) {
        console.log("Store: No simulated results to reset.");
        return; // Nothing to do
    }

    // Convert simulated results back to fixtures
    // Add explicit type for map parameter
    const restoredFixtures: Fixture[] = simulatedResults.map((simResult: CompletedMatch) => ({
        match_id: simResult.match_id,
        match_number: simResult.match_number,
        date: simResult.date,
        venue: simResult.venue,
        home_team: simResult.home_team,
        away_team: simResult.away_team,
        // Add missing required Fixture fields with default values
        time: "", // Assuming default empty string for time
        status: "Scheduled", // Assuming default status
    }));

    // Combine existing fixtures with restored ones and sort by numeric match number
    const finalFixtures = [...fixtures, ...restoredFixtures];
    finalFixtures.sort((a, b) => parseInt(a.match_number, 10) - parseInt(b.match_number, 10));

    // Update state using 'set'
    set({
        results: nonSimulatedResults,
        fixtures: finalFixtures,
        userScenario: [], // Also clear manual edits if desired upon reset
    });

    // Recalculate points table with only non-simulated results using 'get'
    get().calculatePointsTable(nonSimulatedResults);
    console.log(`Store: Reset ${simulatedResults.length} simulated results.`);
  },

  // --- Probability Calculation Actions ---
  startProbabilityCalculation: () => {
    // This action primarily signals the intent.
    // The actual worker interaction (creation, posting message, listening)
    // should happen in the UI layer (e.g., QualifierStatsTable component)
    // which then calls other actions like setProbabilityCalculationStatus,
    // updateProbabilityProgress, and setProbabilityResults based on worker messages.
    set({
        isCalculatingProbabilities: true,
        probabilityCalculationProgress: 0,
        processedProbabilityScenarios: 0,
        totalProbabilityScenarios: 0, // Will be updated by progress message
        qualifierStats: null, // Clear previous results
    });
    console.log("Store: Probability calculation initiated (worker interaction expected from UI).");
    // Placeholder: In a real scenario, the UI would now postMessage to the worker.
  },

  setProbabilityCalculationStatus: (status) => {
    set({ isCalculatingProbabilities: status });
  },

  updateProbabilityProgress: (progress, processed, total) => {
    set({
        probabilityCalculationProgress: progress,
        processedProbabilityScenarios: processed,
        totalProbabilityScenarios: total, // Update total based on first progress message
        isCalculatingProbabilities: progress < 100, // Still calculating if not 100%
    });
  },

  setProbabilityResults: (stats) => {
    set({
        qualifierStats: stats,
        isCalculatingProbabilities: false, // Calculation finished
        probabilityCalculationProgress: 100, // Ensure progress is 100
    });
    console.log("Store: Probability results received and stored.");
  },

  // --- Win/Lose All Calculation Actions ---
  calculateWinLoseAllScenarios: () => {
    // This calculation is simpler and might not need a worker,
    // but could still take a moment. We'll do it synchronously for now.
    console.log("Store: Calculating Win All / Lose All scenarios...");
    const { fixtures, results, getAllTeams } = get();
    const allTeamsInfo = getAllTeams();
    const winLoseResults: TeamWinLoseStats[] = [];

    allTeamsInfo.forEach(team => {
        const teamId = team.id;
        const teamFixtures = fixtures.filter(f => f.home_team.id === teamId || f.away_team.id === teamId);

        // --- Win All Scenario ---
        const winAllSimulated: CompletedMatch[] = teamFixtures.map(fixture => {
            // const outcome = fixture.home_team.id === teamId ? 'home_win' : 'away_win';
            // Use simulateOutcome helper from worker logic (or replicate it here)
            // For simplicity, let's assume simulateOutcome is available or replicated
            // Need to import or define simulateOutcome if not already accessible
            // const { simulateOutcome } = require('../logic/scenarioWorker'); // Example import (adjust path)
            // For now, just placeholder logic:
             return {
                 ...fixture, // Spread fixture details
                 result: `${team.code} Won (Simulated)`,
                 winner_team_id: teamId,
                 isSimulated: true,
                 // Add other required CompletedMatch fields with defaults
                 innings1_summary: '180/5 (20.0 Ov)',
                 innings2_summary: '170/8 (20.0 Ov)',
                 first_batting_team: fixture.home_team,
                 second_batting_team: fixture.away_team,
                 toss_winner: fixture.home_team.name,
                 toss_decision: 'Bat',
                 dls_applied: false,
                 man_of_the_match: null,
             } as CompletedMatch; // Type assertion needed if using placeholder
        });
        const winAllFinalResults = [...results, ...winAllSimulated];
        const winAllTable = calculatePointsTable(winAllFinalResults);
        const winAllRank = winAllTable.findIndex(entry => entry.team.id === teamId) + 1;
        const winAllResult = winAllRank > 0 && winAllRank <= 4 ? 'Qualify' : 'Eliminated';

        // --- Lose All Scenario ---
        const loseAllSimulated: CompletedMatch[] = teamFixtures.map(fixture => {
            // const outcome = fixture.home_team.id === teamId ? 'away_win' : 'home_win';
            const winnerId = fixture.home_team.id === teamId ? fixture.away_team.id : fixture.home_team.id;
            const winnerCode = fixture.home_team.id === teamId ? fixture.away_team.code : fixture.home_team.code;
             return {
                 ...fixture,
                 result: `${winnerCode} Won (Simulated)`,
                 winner_team_id: winnerId,
                 isSimulated: true,
                 innings1_summary: '170/8 (20.0 Ov)',
                 innings2_summary: '180/5 (20.0 Ov)',
                 first_batting_team: fixture.away_team,
                 second_batting_team: fixture.home_team,
                 toss_winner: fixture.away_team.name,
                 toss_decision: 'Bat',
                 dls_applied: false,
                 man_of_the_match: null,
             } as CompletedMatch;
        });
        const loseAllFinalResults = [...results, ...loseAllSimulated];
        const loseAllTable = calculatePointsTable(loseAllFinalResults);
        const loseAllRank = loseAllTable.findIndex(entry => entry.team.id === teamId) + 1;
        const loseAllResult = loseAllRank > 0 && loseAllRank <= 4 ? 'Qualify' : 'Eliminated';

        winLoseResults.push({
            teamId: team.id,
            teamCode: team.code,
            winAllResult: winAllResult,
            winAllRank: winAllRank > 0 ? winAllRank : undefined,
            loseAllResult: loseAllResult,
            loseAllRank: loseAllRank > 0 ? loseAllRank : undefined,
        });
    });

    set({ winLoseAllStats: winLoseResults });
    console.log("Store: Win All / Lose All scenarios calculated.");
  },

   setWinLoseAllResults: (stats) => {
       set({ winLoseAllStats: stats });
   },

   // --- Playoff Validation Action ---
   // updateValidationProgress removed
   /*
   updateValidationProgress: (progress: number) => {
       set(state => ({
           playoffState: {
               ...state.playoffState,
               // validationProgress: progress, // Removed
           }
       }));
   },
   */

   // --- Action to set validation result and loading state (progress reset removed) ---
   setValidationResult: (result: boolean | null, _?: string) => {
        set(state => ({
            playoffState: {
                ...state.playoffState,
                validationResult: result,
                // Set loading to true only when result is null (start), false otherwise (end)
                isValidationInProgress: result === null,
                // validationProgress: 0, // Removed progress reset
                // validationMessage: message // Optional: store message too
            }
        }));
   },

   // Action to load and transform initial data
   loadInitialData: (rawResults, rawFixtures) => {
       console.log("Store: Loading initial data...");
       const transformedResultsData = transformResults(rawResults);
       const transformedFixturesData = transformFixtures(rawFixtures);
       set({
           results: transformedResultsData,
           fixtures: transformedFixturesData,
           isDataLoaded: true, // Mark data as loaded
           userScenario: [], // Reset any previous scenario
           pointsTable: [], // Reset points table before calculation
           playoffState: { // Reset playoff state as well
                matches: [
                  { id: 'Qualifier 1', matchNumber: 71, team1: null, team2: null, status: 'pending' },
                  { id: 'Eliminator', matchNumber: 72, team1: null, team2: null, status: 'pending' },
                  { id: 'Qualifier 2', matchNumber: 73, team1: null, team2: null, status: 'pending' },
                  { id: 'Final', matchNumber: 74, team1: null, team2: null, status: 'pending' },
                ],
                selectedWinner: null,
                isValidationInProgress: false,
                validationResult: null,
                // validationProgress: 0, // Removed progress state reset
           },
           qualifierStats: null, // Reset stats
           winLoseAllStats: null, // Reset stats
           _initialCalculationDone: false, // Reset initial calc flag
       });
       console.log(`Store: Loaded ${transformedResultsData.length} results and ${transformedFixturesData.length} fixtures.`);
       // Trigger initial points table calculation
       get().calculatePointsTable();
   },


}));
