import { Fixture, CompletedMatch, TeamInfo, PointsTableEntry, TeamRef, TeamQualifierStats } from '../types';
import { calculatePointsTable } from './scoreCalculator'; // Assuming scoreCalculator is accessible

// Define message types for communication between main thread and worker
interface WorkerInput {
    type: 'VALIDATE_4_TEAMS' | 'CHECK_SINGLE_TEAM' | 'CALCULATE_PROBABILITIES';
    remainingFixtures: Fixture[];
    baseResults: CompletedMatch[];
    allTeams: TeamInfo[];
    targetData?: TargetPlayoffTeams | TargetSingleTeam;
    optimizeNrr?: boolean;
}

// Type definition remains the same
interface TargetPlayoffTeams {
    q1Team1Id: string | null;
    q1Team2Id: string | null;
    elTeam1Id: string | null;
    elTeam2Id: string | null;
}

interface TargetSingleTeam {
    teamId: string;
}

// Simplified WorkerOutput
interface WorkerOutput {
    type: 'RESULT' | 'ERROR';
    isPossible?: boolean; // Optional for error
    message?: string; // Optional for error
    scenario?: CompletedMatch[] | null; // Optional for error
}

// --- Helper to generate plausible scores ---
// Note: This is a simplified version. NRR-specific generation is complex.
const generatePlausibleScores = (
    outcome: 'home_win' | 'away_win' | 'tie',
    homeTeam: TeamRef,
    awayTeam: TeamRef
): Pick<CompletedMatch, 'innings1_summary' | 'innings2_summary' | 'first_batting_team' | 'second_batting_team' | 'result' | 'winner_team_id'> => {
    let score1 = 160 + Math.floor(Math.random() * 60); // Random score between 160-219
    let score2 = 160 + Math.floor(Math.random() * 60);
    let overs1 = 20.0;
    let overs2 = 20.0;
    let wickets1 = Math.floor(Math.random() * 7) + 3; // 3-9 wickets
    let wickets2 = Math.floor(Math.random() * 7) + 3;

    let firstBattingTeam = Math.random() > 0.5 ? homeTeam : awayTeam;
    let secondBattingTeam = firstBattingTeam.id === homeTeam.id ? awayTeam : homeTeam;

    let winner_team_id: string | null = null;
    let result = "";

    if (outcome === 'home_win') {
        winner_team_id = homeTeam.id;
        if (firstBattingTeam.id === homeTeam.id) { // Home bats first and wins
            score2 = Math.max(0, score1 - (Math.floor(Math.random() * 30) + 5)); // Score less
            wickets2 = Math.min(10, wickets2 + 1);
            overs2 = Math.random() > 0.3 ? 20.0 : 18.0 + Math.random() * 2; // Sometimes not all overs bowled
            result = `${homeTeam.code} won by ${score1 - score2} runs`;
        } else { // Home chases and wins
            score1 = Math.max(0, score2 - (Math.floor(Math.random() * 30) + 5)); // Target score
            score2 = score1 + (Math.floor(Math.random() * 5) + 1); // Chase successfully
            wickets2 = Math.min(10, wickets1 - (Math.floor(Math.random() * 3) + 1)); // Fewer wickets lost
            overs2 = 18.0 + Math.random() * 2; // Chase completed early
            result = `${homeTeam.code} won by ${10 - wickets2} wickets`;
        }
    } else if (outcome === 'away_win') {
        winner_team_id = awayTeam.id;
         if (firstBattingTeam.id === awayTeam.id) { // Away bats first and wins
            score2 = Math.max(0, score1 - (Math.floor(Math.random() * 30) + 5));
            wickets2 = Math.min(10, wickets2 + 1);
            overs2 = Math.random() > 0.3 ? 20.0 : 18.0 + Math.random() * 2;
            result = `${awayTeam.code} won by ${score1 - score2} runs`;
        } else { // Away chases and wins
            score1 = Math.max(0, score2 - (Math.floor(Math.random() * 30) + 5));
            score2 = score1 + (Math.floor(Math.random() * 5) + 1);
            wickets2 = Math.min(10, wickets1 - (Math.floor(Math.random() * 3) + 1));
            overs2 = 18.0 + Math.random() * 2;
            result = `${awayTeam.code} won by ${10 - wickets2} wickets`;
        }
    } else { // Tie
        winner_team_id = null;
        score1 = score2; // Scores are equal
        wickets1 = Math.min(10, wickets1);
        wickets2 = Math.min(10, wickets2);
        overs1 = 20.0;
        overs2 = 20.0;
        result = "Match tied";
    }

    // Ensure scores/wickets are within bounds
    score1 = Math.max(0, score1);
    score2 = Math.max(0, score2);
    wickets1 = Math.min(10, Math.max(0, wickets1));
    wickets2 = Math.min(10, Math.max(0, wickets2));
    overs1 = Math.min(20.0, Math.max(0.1, overs1));
    overs2 = Math.min(20.0, Math.max(0.1, overs2));


    const formatOvers = (o: number): string => {
        const fullOvers = Math.floor(o);
        const balls = Math.round((o - fullOvers) * 6);
        return `${fullOvers}.${balls}`;
    }

    return {
        innings1_summary: `${score1}/${wickets1} (${formatOvers(overs1)} Ov)`,
        innings2_summary: `${score2}/${wickets2} (${formatOvers(overs2)} Ov)`,
        first_batting_team: firstBattingTeam,
        second_batting_team: secondBattingTeam,
        result: result,
        winner_team_id: winner_team_id,
    };
};


// --- Logic moved from playoffValidation.ts ---

// Helper function to calculate maximum possible points for a team
const calculateMaxPossiblePoints = (
    teamId: string,
    currentPoints: number,
    fixturesToCheck: Fixture[]
): number => {
    let maxPoints = currentPoints;
    for (const fixture of fixturesToCheck) {
        // Team gets 2 points for a potential win in each of their remaining matches
        if (fixture.home_team.id === teamId || fixture.away_team.id === teamId) {
            maxPoints += 2;
        }
    }
    return maxPoints;
};


// Helper to generate NRR-optimized boundary scores to check tiebreakers
const generateOptimizedScores = (
    outcome: 'home_win' | 'away_win' | 'tie',
    homeTeam: TeamRef,
    awayTeam: TeamRef,
    targetTeamIds: Set<string>
): Pick<CompletedMatch, 'innings1_summary' | 'innings2_summary' | 'first_batting_team' | 'second_batting_team' | 'result' | 'winner_team_id'> => {
    if (outcome === 'tie') {
        return {
            innings1_summary: "160/5 (20.0 Ov)",
            innings2_summary: "160/5 (20.0 Ov)",
            first_batting_team: homeTeam,
            second_batting_team: awayTeam,
            result: "Match tied",
            winner_team_id: null
        };
    }

    const winner = outcome === 'home_win' ? homeTeam : awayTeam;
    const loser = outcome === 'home_win' ? awayTeam : homeTeam;
    const isWinnerTarget = targetTeamIds.has(winner.id);
    const isLoserTarget = targetTeamIds.has(loser.id);

    let firstBattingTeam = winner;
    let secondBattingTeam = loser;
    let innings1Runs = 150;
    let innings1Wickets = 5;
    let innings2Runs = 150;
    let innings2Wickets = 5;
    let result = "";

    if (isWinnerTarget && !isLoserTarget) {
        // Boost target NRR by winning by a massive margin
        firstBattingTeam = winner;
        secondBattingTeam = loser;
        innings1Runs = 250;
        innings1Wickets = 3;
        innings2Runs = 50;
        innings2Wickets = 10;
        result = `${winner.code} won by 200 runs`;
    } else if (!isWinnerTarget && isLoserTarget) {
        // Protect target NRR by losing by a minimal margin
        firstBattingTeam = winner;
        secondBattingTeam = loser;
        innings1Runs = 151;
        innings1Wickets = 5;
        innings2Runs = 150;
        innings2Wickets = 5;
        result = `${winner.code} won by 1 run`;
    } else {
        // Standard plausible score
        firstBattingTeam = winner;
        secondBattingTeam = loser;
        innings1Runs = 170;
        innings1Wickets = 5;
        innings2Runs = 155;
        innings2Wickets = 8;
        result = `${winner.code} won by 15 runs`;
    }

    return {
        innings1_summary: `${innings1Runs}/${innings1Wickets} (20.0 Ov)`,
        innings2_summary: `${innings2Runs}/${innings2Wickets} (20.0 Ov)`,
        first_batting_team: firstBattingTeam,
        second_batting_team: secondBattingTeam,
        result: result,
        winner_team_id: winner.id
    };
};

// Helper to simulate a single match outcome with plausible scores (supporting NRR optimization)
const simulateOutcome = (
    fixture: Fixture, 
    outcome: 'home_win' | 'away_win' | 'tie',
    targetTeamIds?: Set<string>
): CompletedMatch => {
    const scoreDetails = (targetTeamIds && targetTeamIds.size > 0)
        ? generateOptimizedScores(outcome, fixture.home_team, fixture.away_team, targetTeamIds)
        : generatePlausibleScores(outcome, fixture.home_team, fixture.away_team);

    return {
        match_id: fixture.match_id,
        match_number: fixture.match_number,
        date: fixture.date,
        venue: fixture.venue,
        home_team: fixture.home_team,
        away_team: fixture.away_team,
        toss_winner: scoreDetails.first_batting_team.name, // Assume toss winner chose to bat
        toss_decision: 'Bat',
        first_batting_team: scoreDetails.first_batting_team,
        second_batting_team: scoreDetails.second_batting_team,
        innings1_summary: scoreDetails.innings1_summary,
        innings2_summary: scoreDetails.innings2_summary,
        result: scoreDetails.result,
        winner_team_id: scoreDetails.winner_team_id,
        dls_applied: false, // Assume no DLS for simulations
        man_of_the_match: null, // MOTM not relevant for simulation
        isSimulated: true, // Mark as simulated
    };
};

// Recursive backtracking function - MODIFIED TO RETURN SCENARIO
const findPossibleScenario = (
    fixtureIndex: number,
    remainingFixtures: Fixture[],
    currentSimulatedResults: CompletedMatch[],
    baseResults: CompletedMatch[],
    allTeams: TeamInfo[],
    queryType: 'VALIDATE_4_TEAMS' | 'CHECK_SINGLE_TEAM',
    targetData: TargetPlayoffTeams | TargetSingleTeam,
    optimizeNrr: boolean = false,
    targetTeamIds: Set<string> = new Set()
): CompletedMatch[] | null => {

    // Base Case: All remaining fixtures have been simulated
    if (fixtureIndex === remainingFixtures.length) {
        const finalResults = [...baseResults, ...currentSimulatedResults];
        const finalTable = calculatePointsTable(finalResults);

        if (finalTable.length < 4) return null; // Return null if not enough teams

        const top4Ids = finalTable.slice(0, 4).map((entry: PointsTableEntry) => entry.team.id);
        const top4Set = new Set(top4Ids);

        if (queryType === 'VALIDATE_4_TEAMS') {
            const targets = targetData as TargetPlayoffTeams;
            const targetSlots = [targets.q1Team1Id, targets.q1Team2Id, targets.elTeam1Id, targets.elTeam2Id];

            // Check if the calculated top 4 matches the specified targets (if any)
            for (let i = 0; i < 4; i++) {
                const targetId = targetSlots[i];
                const calculatedId = top4Ids[i];
                // If a target is specified for this slot, it MUST match the calculated team
                if (targetId !== null && calculatedId !== targetId) {
                    return null; // Mismatch, this path is invalid
                }
            }

            // Additionally, ensure the final top 4 teams are unique
            if (top4Set.size < 4) {
                return null; // Duplicate team found in top 4, invalid scenario
            }

            // If all checks passed, this scenario is valid
            return [...currentSimulatedResults]; // Return copy of results

        } else if (queryType === 'CHECK_SINGLE_TEAM') {
            const target = targetData as TargetSingleTeam;
            // Check if the target team is in the top 4
            const isScenarioValid = top4Set.has(target.teamId);
            return isScenarioValid ? [...currentSimulatedResults] : null; // Return copy or null
        }
        return null; // Should not happen / Default case
    }

    const currentFixture = remainingFixtures[fixtureIndex];
    const outcomes: ('home_win' | 'away_win' | 'tie')[] = ['home_win', 'away_win', 'tie'];

    // Explore each possible outcome
    for (const outcome of outcomes) {
        const simulatedResult = simulateOutcome(currentFixture, outcome, optimizeNrr ? targetTeamIds : undefined);
        // Add the result for this level
        currentSimulatedResults.push(simulatedResult);

        let foundScenario = null; // Initialize foundScenario for this path

        // --- PRUNING CHECK START ---
        let shouldPrune = false;
        // *** Apply Pruning for BOTH query types ***
        const intermediateResults = [...baseResults, ...currentSimulatedResults];
        const intermediateTable = calculatePointsTable(intermediateResults);
        const remainingFixturesForPruning = remainingFixtures.slice(fixtureIndex + 1);

        if (queryType === 'CHECK_SINGLE_TEAM') {
            const target = targetData as TargetSingleTeam;
            // const intermediateResults = [...baseResults, ...currentSimulatedResults]; // Moved up
            // const intermediateTable = calculatePointsTable(intermediateResults); // Moved up

            const targetTeamEntry = intermediateTable.find(t => t.team.id === target.teamId);
            const currentPoints = targetTeamEntry?.points ?? 0;

            // const remainingFixturesForPruning = remainingFixtures.slice(fixtureIndex + 1); // Moved up
            const maxPossibleTotalPointsForTarget = calculateMaxPossiblePoints(target.teamId, currentPoints, remainingFixturesForPruning);

            // --- Revised Pruning Logic for CHECK_SINGLE_TEAM ---
            // Prune only if the target team's maximum possible points are strictly less
            // than the *current* points of the 4th-placed team in the intermediate table.
            // This is a safer check than comparing max potential vs max potential.
            if (intermediateTable.length >= 4) {
                const fourthTeamEntry = intermediateTable[3];
                // Check if the target team is already below 4th place AND cannot possibly reach the current 4th place score
                const targetRank = intermediateTable.findIndex(t => t.team.id === target.teamId);
                if (targetRank >= 4 && maxPossibleTotalPointsForTarget < fourthTeamEntry.points) {
                    // console.log(`Pruning: Target ${target.teamId} max ${maxPossibleTotalPointsForTarget} < current 4th place points ${fourthTeamEntry.points} at index ${fixtureIndex}`);
                    shouldPrune = true;
                }
                // Add a check: If the target team *is* the 4th team, but their max points
                // are less than the *current* points of the 5th team, they might drop out.
                // However, this is complex with NRR, so we'll keep the simpler check for now.
                // A more robust check would involve NRR or comparing max points vs 5th team's current points.
            }
            // If fewer than 4 teams, no pruning based on 4th place is possible yet.

        } else if (queryType === 'VALIDATE_4_TEAMS') {
            // Pruning for 4-team validation: Check if any *required* team can no longer reach the potential points of the 4th place team (Original logic retained here)
            const targets = targetData as TargetPlayoffTeams;
            const requiredTeams = [targets.q1Team1Id, targets.q1Team2Id, targets.elTeam1Id, targets.elTeam2Id].filter(id => id !== null) as string[];

            if (requiredTeams.length > 0 && intermediateTable.length >= 4) {
                 for (const requiredTeamId of requiredTeams) {
                     const requiredTeamEntry = intermediateTable.find(t => t.team.id === requiredTeamId);
                     const currentPoints = requiredTeamEntry?.points ?? 0;
                     const maxPossiblePointsForRequired = calculateMaxPossiblePoints(requiredTeamId, currentPoints, remainingFixturesForPruning);
                     
                     const fourthTeamEntry = intermediateTable[3];
                     // If a required team cannot possibly reach the points potentially needed for 4th place, prune.
                     // Use strict inequality because NRR tiebreakers are complex.
                     if (maxPossiblePointsForRequired < fourthTeamEntry.points) {
                         shouldPrune = true;
                         // console.log(`Pruning 4-team: Required ${requiredTeamId} max ${maxPossiblePointsForRequired} < ${pointsToReachTop4} (potential 4th place) at index ${fixtureIndex}`);
                         break; // No need to check other required teams
                     }
                 }
            }
        }
        // --- PRUNING CHECK END ---

        if (!shouldPrune) {
            // If not pruned, recurse to the next level
            foundScenario = findPossibleScenario(fixtureIndex + 1, remainingFixtures, currentSimulatedResults, baseResults, allTeams, queryType, targetData, optimizeNrr, targetTeamIds);
        }

        // Backtrack: remove the result added for this level *before* checking if found
        currentSimulatedResults.pop();

        // If a scenario was found in the recursive call, return it immediately
        if (foundScenario) {
            return foundScenario;
        }
        // Otherwise, continue the loop to try the next outcome
    }

    // If loop completes without finding a scenario from this path, return null
    return null;
};


// Helper function to check if NRR is the deciding factor in the 4th/5th place tie breaker
const checkNrrTie = (table: PointsTableEntry[], targetTeamId: string): boolean => {
    if (table.length < 5) return false;
    const fourthPoints = table[3].points;
    const fifthPoints = table[4].points;
    return fourthPoints === fifthPoints;
};

// Exhaustive simulation helper for small N (N <= 9)
const runExhaustiveSimulation = (
    remainingFixtures: Fixture[],
    baseResults: CompletedMatch[],
    allTeams: TeamInfo[],
    progressCallback: (progress: number, processed: number, total: number) => void
): TeamQualifierStats[] => {
    const statsMap: Record<string, { top4: number; top2: number }> = {};
    allTeams.forEach(t => {
        statsMap[t.id] = { top4: 0, top2: 0 };
    });

    const totalScenarios = Math.pow(3, remainingFixtures.length);
    let processedCount = 0;
    const reportInterval = Math.max(1, Math.floor(totalScenarios / 10));

    const traverse = (fixtureIndex: number, currentSimulated: CompletedMatch[]) => {
        if (fixtureIndex === remainingFixtures.length) {
            const finalResults = [...baseResults, ...currentSimulated];
            const finalTable = calculatePointsTable(finalResults);

            finalTable.forEach((entry, rank) => {
                const teamId = entry.team.id;
                if (statsMap[teamId]) {
                    if (rank < 2) statsMap[teamId].top2++;
                    if (rank < 4) statsMap[teamId].top4++;
                }
            });

            processedCount++;
            if (processedCount % reportInterval === 0 || processedCount === totalScenarios) {
                const progress = Math.round((processedCount / totalScenarios) * 100);
                progressCallback(progress, processedCount, totalScenarios);
            }
            return;
        }

        const fixture = remainingFixtures[fixtureIndex];
        const outcomes: ('home_win' | 'away_win' | 'tie')[] = ['home_win', 'away_win', 'tie'];
        for (const outcome of outcomes) {
            currentSimulated.push(simulateOutcome(fixture, outcome));
            traverse(fixtureIndex + 1, currentSimulated);
            currentSimulated.pop();
        }
    };

    traverse(0, []);

    return allTeams.map(t => {
        const top4Count = statsMap[t.id]?.top4 || 0;
        const top2Count = statsMap[t.id]?.top2 || 0;
        return {
            teamId: t.id,
            teamCode: t.code,
            top4Count,
            top2Count,
            totalScenarios,
            top4Percent: (top4Count / totalScenarios) * 100,
            top2Percent: (top2Count / totalScenarios) * 100
        };
    });
};

// Monte Carlo simulation helper for large N (N > 9)
const runMonteCarloSimulation = (
    remainingFixtures: Fixture[],
    baseResults: CompletedMatch[],
    allTeams: TeamInfo[],
    iterations: number = 25000,
    progressCallback: (progress: number, processed: number, total: number) => void
): TeamQualifierStats[] => {
    const statsMap: Record<string, { top4: number; top2: number }> = {};
    allTeams.forEach(t => {
        statsMap[t.id] = { top4: 0, top2: 0 };
    });

    const reportInterval = Math.floor(iterations / 10);

    for (let i = 0; i < iterations; i++) {
        const simulatedResults: CompletedMatch[] = remainingFixtures.map(fixture => {
            const rand = Math.random();
            const outcome = rand < 0.45 ? 'home_win' : rand < 0.90 ? 'away_win' : 'tie';
            return simulateOutcome(fixture, outcome);
        });

        const finalResults = [...baseResults, ...simulatedResults];
        const finalTable = calculatePointsTable(finalResults);

        finalTable.forEach((entry, rank) => {
            const teamId = entry.team.id;
            if (statsMap[teamId]) {
                if (rank < 2) statsMap[teamId].top2++;
                if (rank < 4) statsMap[teamId].top4++;
            }
        });

        if ((i + 1) % reportInterval === 0 || i === iterations - 1) {
            const progress = Math.round(((i + 1) / iterations) * 100);
            progressCallback(progress, i + 1, iterations);
        }
    }

    return allTeams.map(t => {
        const top4Count = statsMap[t.id]?.top4 || 0;
        const top2Count = statsMap[t.id]?.top2 || 0;
        return {
            teamId: t.id,
            teamCode: t.code,
            top4Count,
            top2Count,
            totalScenarios: iterations,
            top4Percent: (top4Count / iterations) * 100,
            top2Percent: (top2Count / iterations) * 100
        };
    });
};

// --- Worker Message Handler ---
self.onmessage = (event: MessageEvent<WorkerInput>) => {
    console.log('Worker received message:', event.data);
    const { type, remainingFixtures, baseResults, allTeams, targetData, optimizeNrr } = event.data;

    try {
        if (type === 'CALCULATE_PROBABILITIES') {
            const progressCallback = (progress: number, processedCount: number, totalCount: number) => {
                self.postMessage({ type: 'PROGRESS_UPDATE', progress, processedCount, totalCount });
            };

            const N = remainingFixtures.length;
            let stats: TeamQualifierStats[];
            if (N <= 9) {
                stats = runExhaustiveSimulation(remainingFixtures, baseResults, allTeams, progressCallback);
            } else {
                stats = runMonteCarloSimulation(remainingFixtures, baseResults, allTeams, 25000, progressCallback);
            }

            self.postMessage({ type: 'PROBABILITY_RESULT', stats });
            return;
        }

        // Build set of target team IDs for NRR optimization
        const targetTeamIds = new Set<string>();
        if (optimizeNrr) {
            if (type === 'CHECK_SINGLE_TEAM' && targetData) {
                const target = targetData as TargetSingleTeam;
                if (target.teamId) targetTeamIds.add(target.teamId);
            } else if (type === 'VALIDATE_4_TEAMS' && targetData) {
                const targets = targetData as TargetPlayoffTeams;
                if (targets.q1Team1Id) targetTeamIds.add(targets.q1Team1Id);
                if (targets.q1Team2Id) targetTeamIds.add(targets.q1Team2Id);
                if (targets.elTeam1Id) targetTeamIds.add(targets.elTeam1Id);
                if (targets.elTeam2Id) targetTeamIds.add(targets.elTeam2Id);
            }
        }

        // Now returns the scenario array or null
        const foundScenario: CompletedMatch[] | null = findPossibleScenario(
            0,
            remainingFixtures,
            [],
            baseResults,
            allTeams,
            type as any,
            targetData as any,
            !!optimizeNrr,
            targetTeamIds
        );

        let message = "";
        const isPossible = foundScenario !== null;

        if (isPossible) {
             if (type === 'VALIDATE_4_TEAMS') {
                // Adjust message based on how many teams were specified
                const currentTargets = targetData as TargetPlayoffTeams; // Use targetData
                const specifiedCount = [currentTargets.q1Team1Id, currentTargets.q1Team2Id, currentTargets.elTeam1Id, currentTargets.elTeam2Id].filter(id => id !== null).length;
                if (specifiedCount === 4) {
                    message = "This specific 4-team playoff scenario IS possible and has been applied.";
                } else if (specifiedCount > 0) {
                     message = `A possible scenario including the specified team(s) was found and applied.`;
                } else {
                     message = "Any playoff combination is possible; showing one example.";
                }
            } else if (type === 'CHECK_SINGLE_TEAM') {
                const target = targetData as TargetSingleTeam;
                const teamName = allTeams.find(t => t.id === target.teamId)?.name || target.teamId;
                message = `A possible scenario where ${teamName} qualifies was found and applied.`;

                // Add NRR tiebreaker note if relevant and not optimized
                if (!optimizeNrr) {
                    const finalResults = [...baseResults, ...foundScenario!];
                    const finalTable = calculatePointsTable(finalResults);
                    if (checkNrrTie(finalTable, target.teamId)) {
                        message += " Note: Qualification depends on winning the NRR tiebreaker.";
                    }
                }
            }
        } else {
             if (type === 'VALIDATE_4_TEAMS') {
                 const currentTargets = targetData as TargetPlayoffTeams; // Use targetData
                 const specifiedCount = [currentTargets.q1Team1Id, currentTargets.q1Team2Id, currentTargets.elTeam1Id, currentTargets.elTeam2Id].filter(id => id !== null).length;
                 if (specifiedCount > 0) {
                    message = "No possible scenario exists for the specified playoff team(s) with the remaining fixtures.";
                 } else {
                     message = "Calculation complete. No specific teams were requested.";
                 }
            } else if (type === 'CHECK_SINGLE_TEAM') {
                const target = targetData as TargetSingleTeam;
                const teamName = allTeams.find(t => t.id === target.teamId)?.name || target.teamId;
                message = `${teamName} CANNOT qualify for the playoffs with the remaining fixtures.`;
            }
        }

        // Send result back to main thread
        const output: WorkerOutput = { type: 'RESULT', isPossible, message, scenario: foundScenario };
        console.log('Worker sending result:', output);
        self.postMessage(output);

    } catch (error) {
        console.error('Error in scenario worker:', error);
        const errorOutput: WorkerOutput = { type: 'ERROR', message: `Calculation failed: ${error instanceof Error ? error.message : String(error)}` };
        self.postMessage(errorOutput);
    }
};

// Export {} to treat this file as a module (helps with TypeScript checks)
export {};
