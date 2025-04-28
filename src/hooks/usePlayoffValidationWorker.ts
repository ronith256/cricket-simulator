import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePointsTableStore } from '../store/pointsTableStore';
import { TeamInfo, CompletedMatch, Fixture, PlayoffMatch } from '../types';

// Define the expected structure of messages from the worker
interface WorkerOutput {
    type: 'RESULT' | 'ERROR' | 'VALIDATION_PROGRESS_UPDATE';
    isPossible?: boolean;
    message?: string;
    scenario?: CompletedMatch[] | null;
    progress?: number;
}

interface UsePlayoffValidationWorkerProps {
    qualifier1: PlayoffMatch | undefined;
    eliminator: PlayoffMatch | undefined;
    fixtures: Fixture[];
    results: CompletedMatch[];
    availableTeams: TeamInfo[];
}

interface UsePlayoffValidationWorkerReturn {
    checkScenarioPossibility: () => void;
    isValidationInProgress: boolean;
    // validationProgress removed
    showPopup: boolean;
    popupMessage: string;
    setShowPopup: (show: boolean) => void;
    attemptNrrOptimization: boolean;
    setAttemptNrrOptimization: (attempt: boolean) => void;
}

export const usePlayoffValidationWorker = ({
    qualifier1,
    eliminator,
    fixtures,
    results,
    availableTeams,
}: UsePlayoffValidationWorkerProps): UsePlayoffValidationWorkerReturn => {
    // Get necessary state and actions from Zustand store
    const isValidationInProgress = usePointsTableStore((state) => state.playoffState.isValidationInProgress);
    // validationProgress and updateValidationProgress removed from store
    const setValidationResult = usePointsTableStore((state) => state.setValidationResult);
    const applyScenarioResults = usePointsTableStore((state) => state.applyScenarioResults);

    // Local state for popup and NRR toggle
    const [showPopup, setShowPopup] = useState<boolean>(false);
    const [popupMessage, setPopupMessage] = useState<string>('');
    const [attemptNrrOptimization, setAttemptNrrOptimization] = useState<boolean>(false);
    const workerRef = useRef<Worker | null>(null);

    // Derive remaining fixtures
    const completedMatchIds = useMemo(() => new Set(results.map(r => r.match_id)), [results]);
    const remainingFixtures = useMemo(() => fixtures.filter(f => !completedMatchIds.has(f.match_id)), [fixtures, completedMatchIds]);

    // Initialize worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('../logic/scenarioWorker.ts', import.meta.url), {
            type: 'module'
        });

        workerRef.current.onmessage = (event: MessageEvent<WorkerOutput>) => {
            const data = event.data;
            console.log("usePlayoffValidationWorker received from worker:", data);

            // Removed VALIDATION_PROGRESS_UPDATE handling as progress state is removed
            if (data.type === 'RESULT') {
                setValidationResult(data.isPossible ?? false, data.message);
                setPopupMessage(data.message || 'Validation complete.');
                setShowPopup(true);
                if (data.isPossible && data.scenario) {
                    console.log("Applying found scenario from hook...");
                    applyScenarioResults(data.scenario);
                }
            } else if (data.type === 'ERROR') {
                console.error('usePlayoffValidationWorker Worker error:', data.message);
                setValidationResult(null, `Error: ${data.message || 'Unknown worker error'}`);
                setPopupMessage(`Error: ${data.message || 'Unknown worker error'}`);
                setShowPopup(true);
            }
        };

        workerRef.current.onerror = (error) => {
            console.error('usePlayoffValidationWorker Worker onerror:', error);
            setValidationResult(null, 'An error occurred during possibility check. Check console.');
            setPopupMessage('An error occurred during possibility check. Check console.');
            setShowPopup(true);
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, [setValidationResult, applyScenarioResults]); // Dependencies for store actions, removed updateValidationProgress

    // Function to trigger worker validation
    const checkScenarioPossibility = useCallback(() => {
        if (!qualifier1 || !eliminator || !workerRef.current || isValidationInProgress) return;

        // Reset previous result and set loading state via action
        setValidationResult(null, ''); // Resets result, clears message, sets loading=true, progress=0

        const q1Team1 = qualifier1.team1;
        const q1Team2 = qualifier1.team2;
        const elTeam1 = eliminator.team1;
        const elTeam2 = eliminator.team2;

        const selectedTeams = [q1Team1, q1Team2, elTeam1, elTeam2];
        if (selectedTeams.every(team => team === null)) {
            setPopupMessage("Please select at least one team for the playoff scenario.");
            setShowPopup(true);
            setValidationResult(null, "No teams selected"); // Also reset loading state
            return;
        }

        const specifiedTeamIds = selectedTeams.filter(team => team !== null).map(team => team!.id);
        if (new Set(specifiedTeamIds).size < specifiedTeamIds.length) {
            setPopupMessage("The same team cannot be selected in multiple playoff slots.");
            setShowPopup(true);
            setValidationResult(null, "Duplicate teams selected"); // Also reset loading state
            return;
        }

        const specifiedCount = specifiedTeamIds.length;
        console.log(`Sending ${specifiedCount}-team playoff check from hook to worker...`);
        setPopupMessage(''); // Clear previous message

        workerRef.current.postMessage({
            type: 'VALIDATE_4_TEAMS',
            remainingFixtures,
            baseResults: results,
            allTeams: availableTeams,
            targetData: {
                q1Team1Id: q1Team1?.id || null,
                q1Team2Id: q1Team2?.id || null,
                elTeam1Id: elTeam1?.id || null,
                elTeam2Id: elTeam2?.id || null,
            },
            optimizeNrr: attemptNrrOptimization,
        });
    }, [
        qualifier1, eliminator, isValidationInProgress, setValidationResult,
        remainingFixtures, results, availableTeams, attemptNrrOptimization
    ]); // Dependencies for the callback

    return {
        checkScenarioPossibility,
        isValidationInProgress,
        // validationProgress removed
        showPopup,
        popupMessage,
        setShowPopup,
        attemptNrrOptimization,
        setAttemptNrrOptimization,
    };
};
