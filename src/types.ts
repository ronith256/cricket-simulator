// --- Data Types based on DATA.md ---

// From teams.json
export interface TeamInfo {
  id: string; // Team identifier used in API/other JSONs
  name: string; // Full team name (e.g., "Mumbai Indians")
  code: string; // Short team code (e.g., "MI")
  logo: string; // URL to the team's logo image
  // primaryColor?: string; // Optional
  // secondaryColor?: string; // Optional
}

// Minimal Team representation used within Fixture/CompletedMatch
export interface TeamRef { // <-- Export added
  id: string;
  name: string;
  code: string;
  logo?: string; // Logo might be included directly or looked up via id
}

// From fixtures.json
export interface Fixture {
  match_id: string; // Unique identifier for the match
  match_number: string; // The sequential number of the match (e.g., "Match 45")
  date: string; // Formatted match date (e.g., "27 Apr 2025")
  time: string; // Scheduled match start time (e.g., "15:30")
  venue: string; // Combined ground name and city
  home_team: TeamRef;
  away_team: TeamRef;
  status: string; // The current status from the API (e.g., "Live", "Upcoming")
}

// From results.json
export interface CompletedMatch {
  match_id: string;
  match_number: string;
  date: string; // Formatted match date
  venue: string;
  home_team: TeamRef;
  away_team: TeamRef;
  toss_winner: string; // Name of the team
  toss_decision: 'Bat' | 'Field';
  first_batting_team: TeamRef; // Contains id, name, code
  second_batting_team: TeamRef; // Contains id, name, code
  innings1_summary: string; // e.g., "201/4 (20.0 Ov)"
  innings2_summary: string;
  result: string; // Text description (e.g., "Sunrisers Hyderabad Won by 5 Wickets")
  winner_team_id: string | null; // ID of the winning team, or null
  dls_applied: boolean;
  revised_overs?: string; // Optional, present if DLS applied
  revised_target?: string; // Optional, present if DLS applied
  man_of_the_match: ManOfTheMatch | null; // Can be null if not awarded
  isSimulated?: boolean; // Flag to indicate if this result is from user simulation
}

export interface ManOfTheMatch {
  player_id: string | null;
  name: string | null;
  image: string | null;
}


// --- Simulation & UI Types (May need refinement based on new data types) ---

// Points Table Entry (Using TeamInfo now)
export interface PointsTableEntry {
  team: TeamInfo;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number; // For abandoned matches (if applicable)
  points: number;
  nrr: number;
}

// --- Playoff Types ---

export type PlayoffStage = 'Qualifier 1' | 'Eliminator' | 'Qualifier 2' | 'Final';

// Simplified result structure for playoff matches
export interface PlayoffResult {
  winnerTeamId: string | null; // ID of the winning team, null for tie/pending
  resultSummary: string; // e.g., "CSK won", "Match Pending"
}

export interface PlayoffMatch {
  id: PlayoffStage;
  matchNumber: number; // e.g., 71, 72, 73, 74
  team1: TeamInfo | null; // Use TeamInfo for full details
  team2: TeamInfo | null; // Use TeamInfo for full details
  status: 'pending' | 'scheduled' | 'completed'; // Status of the playoff match
  result?: PlayoffResult; // Use the simplified PlayoffResult
  venue?: string; // Optional venue
  date?: string; // Optional date
}

export interface PlayoffState {
  matches: PlayoffMatch[];
  selectedWinner: TeamInfo | null; // Use TeamInfo
  isValidationInProgress: boolean;
  validationResult: boolean | null; // null = not run, true = possible, false = impossible
  // validationProgress: number; // Removed progress state
}

// Type for storing probability stats per team (matches worker definition)
export interface TeamQualifierStats {
    teamId: string;
    teamCode: string;
    top4Count: number;
    top2Count: number;
    totalScenarios: number;
    top4Percent?: number; // Calculated later in store or component
    top2Percent?: number; // Calculated later in store or component
}

// Type for storing Win All / Lose All scenario results per team
export interface TeamWinLoseStats {
    teamId: string;
    teamCode: string;
    winAllResult: 'Qualify' | 'Eliminated';
    winAllRank?: number; // Rank if they qualify
    loseAllResult: 'Qualify' | 'Eliminated';
    loseAllRank?: number; // Rank if they qualify
}


// TODO: Re-evaluate ScenarioInput and AppState based on the new Fixture/CompletedMatch types.
// The structure might need to change to reference Fixture.match_id instead of a numeric id.
// The concept of 'Match' might merge or be replaced by Fixture/CompletedMatch.

// Scenario Definition (User Input for Simulation) - Needs review
export interface ScenarioInput {
  matchId: string; // Changed to string to match Fixture/CompletedMatch match_id
  // Basic outcome for simple representation or initial state
  outcome: 'home_win' | 'away_win' | 'tie' | 'no_result' | 'pending'; // Adjusted outcomes
  // Detailed input for simulation based on TREE_DESIGN.md
  editDetails?: {
    teamChoice: string; // ID of the team perspective (e.g., match.home_team.id or match.away_team.id)
    outcome: 'Won' | 'Lost' | 'Tied'; // Result from the chosen team's perspective
    marginValue: number | ''; // Numerical margin (allow empty string for input)
    marginUnit: 'Runs' | 'Wickets';
    remainingValue: number | ''; // Numerical remaining value (allow empty string for input)
    remainingUnit: 'Overs' | 'Balls';
  };
  resultSummary?: string; // Generated summary string based on editDetails or actual result
}

// Overall Application State (Example, might evolve) - Needs review
export interface AppState {
  teams: TeamInfo[]; // Use TeamInfo
  fixtures: Fixture[]; // List of upcoming/live matches
  results: CompletedMatch[]; // List of completed matches
  userScenario: ScenarioInput[]; // User overrides for upcoming matches (references Fixture match_id)
  calculatedPointsTable: PointsTableEntry[];
  qualificationProbabilities?: Record<string, number>; // Team ID -> Probability %
}


// --- Old Types (To be reviewed/removed) ---

// Team Information (Replaced by TeamInfo)
// export interface Team {
//   id: string; // e.g., 'CSK'
//   name: string; // e.g., 'Chennai Super Kings'
//   logoUrl?: string; // Optional logo URL
// }

// Match Fixture (Replaced by Fixture/CompletedMatch)
// export interface Match {
//   id: number; // Unique match ID
//   matchNumber: number;
//   team1: Team;
//   team2: Team;
//   venue: string;
//   date: string; // ISO Date string
//   status: 'scheduled' | 'completed' | 'simulated'; // Status of the match
//   result?: MatchResult; // Result if completed or simulated
// }

// Match Result (Replaced by CompletedMatch structure)
// export interface MatchResult {
//   winner: Team | null; // null for a tie
//   loser: Team | null; // null for a tie
//   tie: boolean;
//   method?: 'runs' | 'wickets' | 'superover' | 'dls'; // How the match was won/decided
//   margin?: number; // Runs or wickets margin
//   team1Score?: { runs: number; wickets: number; overs: number };
//   team2Score?: { runs: number; wickets: number; overs: number };
//   pointsTeam1: number; // Points awarded to team1
//   pointsTeam2: number; // Points awarded to team2
//   resultSummary?: string; // e.g., "MI won by 6 wickets with 2 overs left"
// }
