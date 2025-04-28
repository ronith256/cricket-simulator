import { ScenarioInput, TeamRef, CompletedMatch, TeamInfo, PointsTableEntry } from '../types';

// --- Helper Functions ---

// Helper function to parse score summary string: "Runs/Wickets (Overs.Balls Ov)"
// Returns { runs: number, wickets: number, balls: number } or null if parsing fails
export const parseScoreSummary = (summary: string | undefined | null): { runs: number; wickets: number; balls: number } | null => {
  if (!summary) return null;
  // Regex to capture runs, wickets, overs, and balls
  // Handles formats like "201/4 (20.0 Ov)", "180/7 (19.5 Ov)", "150 (20 Ov)" (all out)
  // Updated regex to handle optional wickets and flexible spacing around '/'
  const match = summary.match(/(\d+)(?:\s*\/\s*(\d+))?\s*\((\d+)(?:\.(\d+))?\s*Ov(?:ers?)?\)/);

  if (match) {
    const runs = parseInt(match[1], 10);
    // Wickets: If not present (e.g., "150 (20 Ov)"), assume 10. If present, parse it.
    const wickets = match[2] ? parseInt(match[2], 10) : 10;
    const overs = parseInt(match[3], 10);
    const ballsInOver = match[4] ? parseInt(match[4], 10) : 0; // Balls part of the decimal
    const totalBalls = overs * 6 + ballsInOver;
    return { runs, wickets, balls: totalBalls };
  }
  // Handle cases like "Did not bat" or other non-standard formats if necessary
  // For now, return null if the main regex doesn't match
  console.warn(`Could not parse score summary: ${summary}`);
  return null;
};


// Helper to format score string: e.g., 154/10 (19.5 Overs)
const formatScoreString = (runs: number, wickets: number, balls: number): string => {
    if (balls === 0) return "0/0 (0.0 Overs)"; // Handle edge case
    const overs = Math.floor(balls / 6);
    const ballsInOver = balls % 6;
    const oversStr = `${overs}.${ballsInOver}`;
    // Assume 10 wickets if balls < 120 and wickets not specified or 10
    const displayWickets = (wickets >= 10 && balls < 120) ? 10 : wickets;
    return `${runs}/${displayWickets} (${oversStr} Overs)`;
};

// Helper to convert remaining overs/balls to total balls bowled/faced
const calculateBallsFromRemaining = (value: number | '', unit: 'Overs' | 'Balls'): number => {
    if (value === '') return 120; // Default to 20 overs if nothing specified
    const numericValue = Number(value);
    if (isNaN(numericValue)) return 120;

    if (unit === 'Overs') {
        // Assuming standard 20 over match
        const oversBowled = 20 - numericValue;
        return Math.max(0, Math.min(120, Math.floor(oversBowled * 6))); // Clamp between 0 and 120 balls
    } else { // unit === 'Balls'
        // Assuming standard 120 balls match
        return Math.max(0, Math.min(120, 120 - numericValue)); // Clamp between 0 and 120 balls
    }
};

// Type for the return value, omitting fields that are part of the original match context
type CalculatedResultDetails = Omit<CompletedMatch, 'match_id' | 'match_number' | 'date' | 'venue' | 'home_team' | 'away_team' | 'toss_winner' | 'toss_decision' | 'dls_applied' | 'revised_overs' | 'revised_target' | 'man_of_the_match'>;

export const calculateImpliedResult = (
    editDetails: ScenarioInput['editDetails'],
    homeTeam: TeamRef,
    awayTeam: TeamRef
): CalculatedResultDetails | null => {

    if (!editDetails) return null;

    const { teamChoice, outcome, marginValue, marginUnit, remainingValue, remainingUnit } = editDetails;

    // Determine winner and loser based on perspective
    let winner: TeamRef;
    let loser: TeamRef;
    if (outcome === 'Won') {
        winner = teamChoice === homeTeam.id ? homeTeam : awayTeam;
        loser = teamChoice === homeTeam.id ? awayTeam : homeTeam;
    } else if (outcome === 'Lost') {
        winner = teamChoice === homeTeam.id ? awayTeam : homeTeam;
        loser = teamChoice === homeTeam.id ? homeTeam : awayTeam;
    } else { // Tied
        winner = homeTeam; // Arbitrary for structure, winner_team_id will be null
        loser = awayTeam;
    }

    let firstBattingTeam: TeamRef;
    let secondBattingTeam: TeamRef;
    let innings1Runs = 150; // Default plausible score
    let innings1Wickets = 7; // Default plausible wickets
    let innings1Balls = 120; // Default 20 overs
    let innings2Runs = 150; // Default
    let innings2Wickets = 7; // Default
    let innings2Balls = 120; // Default
    let winnerTeamId: string | null = winner.id;
    let resultString = `${winner.code} Won`; // Start building result string

    const marginNum = marginValue === '' ? 0 : Number(marginValue);
    const remainingNum = remainingValue === '' ? undefined : Number(remainingValue); // Keep undefined if empty

    if (outcome === 'Tied') {
        firstBattingTeam = homeTeam; // Assume home bats first in a tie for simplicity
        secondBattingTeam = awayTeam;
        // Use default scores/wickets/balls for a tie, maybe make score dynamic later
        innings1Runs = 165;
        innings2Runs = 165;
        innings1Wickets = 6;
        innings2Wickets = 8;
        innings1Balls = 120;
        innings2Balls = 120;
        winnerTeamId = null;
        resultString = "Match Tied";

    } else if (marginUnit === 'Runs') {
        // Team winning by runs batted first
        firstBattingTeam = winner;
        secondBattingTeam = loser;
        innings1Runs = 170; // Default score for winner
        innings1Wickets = 5; // Default wickets for winner
        innings1Balls = 120; // Winner bats 20 overs
        innings2Runs = innings1Runs - marginNum; // Loser's score
        innings2Wickets = 10; // Assume loser is all out or finishes overs
        // Calculate loser's balls based on 'remaining' if provided (e.g., "with 1 ball left")
        innings2Balls = remainingNum !== undefined
            ? calculateBallsFromRemaining(remainingNum, remainingUnit)
            : 120; // Default to 20 overs if remaining not specified
        // Adjust wickets if not all out based on overs
        if (innings2Balls < 120) innings2Wickets = 9; // Assume not all out if overs incomplete

        resultString = `${winner.code} Won by ${marginNum} Runs`;
        if (remainingNum !== undefined && remainingValue !== '') {
             resultString += ` with ${remainingValue} ${remainingUnit} left`; // Append remaining if exists
        }


    } else { // marginUnit === 'Wickets'
        // Team winning by wickets batted second
        firstBattingTeam = loser;
        secondBattingTeam = winner;
        innings1Runs = 160; // Default score for loser (target)
        innings1Wickets = 8; // Default wickets for loser
        innings1Balls = 120; // Loser bats 20 overs
        innings2Runs = innings1Runs + 1; // Winner's score (target + 1)
        innings2Wickets = 10 - marginNum; // Winner's wickets lost
        // Calculate winner's balls based on 'remaining'
        innings2Balls = calculateBallsFromRemaining(remainingValue ?? 0, remainingUnit); // Default to 0 remaining if empty

        resultString = `${winner.code} Won by ${marginNum} Wickets`;
         if (remainingNum !== undefined && remainingValue !== '') {
             resultString += ` with ${remainingValue} ${remainingUnit} left`; // Append remaining if exists
         }
    }

    // Basic validation/clamping
    innings1Runs = Math.max(0, innings1Runs);
    innings2Runs = Math.max(0, innings2Runs);
    innings1Wickets = Math.max(0, Math.min(10, innings1Wickets));
    innings2Wickets = Math.max(0, Math.min(10, innings2Wickets));
    innings1Balls = Math.max(0, Math.min(120, innings1Balls));
    innings2Balls = Math.max(0, Math.min(120, innings2Balls));


    return {
        first_batting_team: firstBattingTeam,
        second_batting_team: secondBattingTeam,
        innings1_summary: formatScoreString(innings1Runs, innings1Wickets, innings1Balls),
        innings2_summary: formatScoreString(innings2Runs, innings2Wickets, innings2Balls),
        result: resultString,
        winner_team_id: winnerTeamId,
    };
};


// --- Points Table Calculation Logic (Extracted from Store) ---

interface TeamStats {
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  ballsFaced: number;
  runsConceded: number;
  ballsBowled: number;
  // Store team details encountered in results for final table generation
  teamDetails: TeamRef | TeamInfo; // Can be either initially
}

export const calculatePointsTable = (
    resultsToUse: CompletedMatch[]
    // Removed allTeams parameter
): PointsTableEntry[] => {

    const teamsMap: Record<string, TeamStats> = {};

    // Process results and dynamically build team map
    resultsToUse.forEach(match => {
      const teamsInMatch = [match.home_team, match.away_team];

      // Initialize team in map if not present using data from the match
      teamsInMatch.forEach(teamRef => {
        if (teamRef && teamRef.id && !teamsMap[teamRef.id]) {
          teamsMap[teamRef.id] = {
            played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
            runsScored: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0,
            teamDetails: teamRef, // Store the TeamRef encountered
          };
        }
      });

      const homeTeamId = match.home_team?.id;
      const awayTeamId = match.away_team?.id;
      const winnerId = match.winner_team_id;

      // Ensure teams exist in the map (should be guaranteed by above initialization)
      if (!homeTeamId || !awayTeamId || !teamsMap[homeTeamId] || !teamsMap[awayTeamId]) {
         // This warning should ideally not trigger if results have consistent team refs
        console.warn(`Team refs missing or inconsistent for match ${match.match_id}. Home: ${homeTeamId}, Away: ${awayTeamId}`);
        return;
      }

      // --- Update Stats ---
      teamsMap[homeTeamId].played++;
      teamsMap[awayTeamId].played++;

      if (winnerId) {
        if (winnerId === homeTeamId) {
          teamsMap[homeTeamId].won++;
          teamsMap[homeTeamId].points += 2;
          teamsMap[awayTeamId].lost++;
        } else {
          teamsMap[awayTeamId].won++;
          teamsMap[awayTeamId].points += 2;
          teamsMap[homeTeamId].lost++;
        }
      } else { // Tie or No Result (Assuming ties give 1 point, NR needs specific handling if applicable)
        // TODO: Differentiate Tie vs No Result if NR gives points differently
        teamsMap[homeTeamId].tied++;
        teamsMap[homeTeamId].points++;
        teamsMap[awayTeamId].tied++;
        teamsMap[awayTeamId].points++;
      }

      // --- NRR Calculation Data ---
      const innings1 = parseScoreSummary(match.innings1_summary);
      const innings2 = parseScoreSummary(match.innings2_summary);
      const firstBattingTeamId = match.first_batting_team?.id;
      const secondBattingTeamId = match.second_batting_team?.id;

      if (innings1 && firstBattingTeamId && secondBattingTeamId && teamsMap[firstBattingTeamId] && teamsMap[secondBattingTeamId]) {
        teamsMap[firstBattingTeamId].runsScored += innings1.runs;
        teamsMap[firstBattingTeamId].ballsFaced += innings1.balls;
        teamsMap[secondBattingTeamId].runsConceded += innings1.runs;
        teamsMap[secondBattingTeamId].ballsBowled += innings1.balls;
      }

      if (innings2 && secondBattingTeamId && firstBattingTeamId && teamsMap[secondBattingTeamId] && teamsMap[firstBattingTeamId]) {
        teamsMap[secondBattingTeamId].runsScored += innings2.runs;
        teamsMap[secondBattingTeamId].ballsFaced += innings2.balls;
        teamsMap[firstBattingTeamId].runsConceded += innings2.runs;
        teamsMap[firstBattingTeamId].ballsBowled += innings2.balls;
      }
    });

    // --- Generate Final Points Table ---
    const table: PointsTableEntry[] = Object.values(teamsMap).map(stats => {
      let nrr = 0;
      if (stats.ballsFaced > 0 && stats.ballsBowled > 0) {
        const runRateScored = (stats.runsScored / stats.ballsFaced) * 6;
        const runRateConceded = (stats.runsConceded / stats.ballsBowled) * 6;
        nrr = runRateScored - runRateConceded;
      }

      // Construct TeamInfo from the stored TeamRef for the final entry
      const teamInfoForTable: TeamInfo = {
        id: stats.teamDetails.id,
        name: stats.teamDetails.name,
        code: stats.teamDetails.code,
        logo: stats.teamDetails.logo || '/placeholder_logo.png', // Use logo from TeamRef or fallback
      };

      return {
        team: teamInfoForTable, // Use the constructed TeamInfo
        played: stats.played,
        won: stats.won,
        lost: stats.lost,
        tied: stats.tied,
        noResult: stats.noResult,
        points: stats.points,
        nrr: parseFloat(nrr.toFixed(3)), // Format NRR
      };
    });

    // Sort the table
    table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      if (b.won !== a.won) return b.won - a.won;
      return a.team.name.localeCompare(b.team.name);
    });

    return table;
};
