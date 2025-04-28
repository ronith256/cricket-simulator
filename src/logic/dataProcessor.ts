import { CompletedMatch, Fixture, TeamRef, ManOfTheMatch } from '../types';

// Helper function to extract toss decision
const extractTossDecision = (tossDetails: string | undefined | null): 'Bat' | 'Field' | null => {
    if (!tossDetails) return null;
    if (tossDetails.includes("Elected To Bat")) return "Bat";
    if (tossDetails.includes("Elected To Field")) return "Field";
    return null;
};

// --- Data Processing Logic (Adapted from process_results.py) ---
export const processRawData = (
    inputData: any,
    onError: (message: string) => void // Pass onError callback for handling errors
): { results: CompletedMatch[], fixtures: Fixture[] } => {
    const processedMatches: CompletedMatch[] = [];
    const processedFixtures: Fixture[] = [];

    if (typeof inputData !== 'object' || inputData === null || !inputData.Matchsummary || !Array.isArray(inputData.Matchsummary)) {
        console.error("Error: Input data is not in the expected format (missing or invalid 'Matchsummary' array).", inputData);
        onError("Invalid data structure received. Expected an object with a 'Matchsummary' array.");
        return { results: [], fixtures: [] };
    }

    for (const match of inputData.Matchsummary) {
        if (typeof match !== 'object' || match === null) {
            console.warn("Skipping invalid match entry:", match);
            continue;
        }

        let homeTeamCode = "";
        let awayTeamCode = "";
        let homeTeamLogo = match.MatchHomeTeamLogo || '';
        let awayTeamLogo = match.MatchAwayTeamLogo || '';

        try {
            const firstBattingTeamId = String(match.FirstBattingTeamID ?? '');
            const secondBattingTeamId = String(match.SecondBattingTeamID ?? '');
            const homeTeamId = String(match.HomeTeamID ?? '');

            if (homeTeamId && firstBattingTeamId === homeTeamId) {
                homeTeamCode = match.FirstBattingTeamCode || '';
                awayTeamCode = match.SecondBattingTeamCode || '';
            } else if (homeTeamId && secondBattingTeamId === homeTeamId) {
                homeTeamCode = match.SecondBattingTeamCode || '';
                awayTeamCode = match.FirstBattingTeamCode || '';
            } else {
                homeTeamCode = match.FirstBattingTeamCode || '';
                awayTeamCode = match.SecondBattingTeamCode || '';
                if (homeTeamId) {
                   console.warn(`Warning: Could not definitively determine home/away codes for MatchID ${match.MatchID}. Using batting order as fallback.`);
                }
            }
        } catch (e: any) {
            console.error(`Error determining home/away codes for MatchID ${match.MatchID}: ${e.message}`);
            continue;
        }

        const homeTeamRef: TeamRef = {
            id: String(match.HomeTeamID || ''), name: match.HomeTeamName || 'N/A', code: homeTeamCode, logo: homeTeamLogo
        };
        const awayTeamRef: TeamRef = {
            id: String(match.AwayTeamID || ''), name: match.AwayTeamName || 'N/A', code: awayTeamCode, logo: awayTeamLogo
        };

        // Skip matches involving TBD teams (playoffs before teams are decided)
        if (homeTeamRef.name === 'TBD' || awayTeamRef.name === 'TBD') {
            console.log(`Skipping MatchID ${match.MatchID} because it involves a TBD team.`);
            continue;
        }

        const matchStatus = match.MatchStatus;

        if (matchStatus === 'Post') {
            try {
                const dlsApplied = !!(match.RevisedOver || match.RevisedTarget);
                const manOfTheMatch: ManOfTheMatch | null = (match.MOMPlayerId && match.MOM)
                    ? { player_id: String(match.MOMPlayerId), name: match.MOM, image: (match.MOMImage && match.MOMImage !== '-') ? match.MOMImage : null } : null;
                const tossDecision = extractTossDecision(match.TossDetails);
                if (tossDecision === null && match.TossTeam) {
                    console.warn(`Warning: Could not determine toss decision for completed MatchID ${match.MatchID}. Toss Details: ${match.TossDetails}`);
                }
                const completedMatch: CompletedMatch = {
                    match_id: String(match.MatchID), match_number: String(match.MatchOrder || 'N/A'), date: match.MatchDateNew || 'N/A',
                    venue: `${match.GroundName || ''}, ${match.city || ''}`.replace(/^, |, $/g, '').trim() || 'N/A',
                    home_team: homeTeamRef, away_team: awayTeamRef, toss_winner: match.TossTeam || 'N/A',
                    toss_decision: tossDecision || 'Bat',
                    first_batting_team: { id: String(match.FirstBattingTeamID || ''), name: match.FirstBattingTeamName || 'N/A', code: match.FirstBattingTeamCode || '' },
                    second_batting_team: { id: String(match.SecondBattingTeamID || ''), name: match.SecondBattingTeamName || 'N/A', code: match.SecondBattingTeamCode || '' },
                    innings1_summary: match['1Summary'] || 'N/A', innings2_summary: match['2Summary'] || 'N/A',
                    result: match.Commentss || 'N/A', winner_team_id: match.WinningTeamID ? String(match.WinningTeamID) : null,
                    dls_applied: dlsApplied, revised_overs: match.RevisedOver || undefined, revised_target: match.RevisedTarget || undefined,
                    man_of_the_match: manOfTheMatch
                };
                processedMatches.push(completedMatch);
            } catch (e: any) {
                console.error(`Error processing completed match ${match.MatchID}: ${e.message}`, match);
            }
        } else {
            try {
                const fixture: Fixture = {
                    match_id: String(match.MatchID), match_number: String(match.MatchOrder || 'N/A'), date: match.MatchDateNew || 'N/A',
                    time: match.MatchTime || 'N/A', venue: `${match.GroundName || ''}, ${match.city || ''}`.replace(/^, |, $/g, '').trim() || 'N/A',
                    home_team: homeTeamRef, away_team: awayTeamRef, status: matchStatus || 'Upcoming'
                };
                processedFixtures.push(fixture);
            } catch (e: any) {
                console.error(`Error processing fixture/live match ${match.MatchID}: ${e.message}`, match);
            }
        }
    }
    console.log(`Processed ${processedMatches.length} completed matches and ${processedFixtures.length} fixtures.`);
    return { results: processedMatches, fixtures: processedFixtures };
};
