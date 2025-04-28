import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'; // Added hooks
import { usePointsTableStore } from '../store/pointsTableStore';
import ResultPopup from './ResultPopup';
import PlayoffMatchCard from './PlayoffMatchCard';
import { CompletedMatch } from '../types'; // Add types needed

// Worker Output Interface (needed locally now)
interface WorkerOutput {
    type: 'RESULT' | 'ERROR' | 'VALIDATION_PROGRESS_UPDATE';
    isPossible?: boolean;
    message?: string;
    scenario?: CompletedMatch[] | null;
    progress?: number;
}

// Main Playoff Bracket Component
export const PlayoffBracket: React.FC = () => {
  // Select state and actions individually for better performance
  const matches = usePointsTableStore((state) => state.playoffState.matches);
  const isValidationInProgress = usePointsTableStore((state) => state.playoffState.isValidationInProgress); // Get directly from store
  // const validationProgress = usePointsTableStore((state) => state.playoffState.validationProgress); // Removed
  // const updateValidationProgress = usePointsTableStore((state) => state.updateValidationProgress); // Removed
  const setValidationResult = usePointsTableStore((state) => state.setValidationResult); // Get action
  const applyScenarioResults = usePointsTableStore((state) => state.applyScenarioResults); // Get action
  const getAllTeams = usePointsTableStore((state) => state.getAllTeams);
  const updatePlayoffTeam = usePointsTableStore((state) => state.updatePlayoffTeam);
  const fixtures = usePointsTableStore((state) => state.fixtures);
  const results = usePointsTableStore((state) => state.results);
  const resetSimulatedResults = usePointsTableStore((state) => state.resetSimulatedResults);

  // Local state for popup and NRR toggle (moved from hook)
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [attemptNrrOptimization, setAttemptNrrOptimization] = useState<boolean>(false); // Keep NRR toggle state if needed
  const workerRef = useRef<Worker | null>(null); // Add worker ref

  const availableTeams = useMemo(() => getAllTeams(), [getAllTeams]);

  // Check if there are any simulated results
  const hasSimulatedResults = useMemo(() => results.some(r => r.isSimulated === true), [results]);

  // Find specific playoff matches
  const qualifier1 = matches.find((m) => m.id === 'Qualifier 1');
  const eliminator = matches.find((m) => m.id === 'Eliminator');

  // Derive remaining fixtures (moved from hook)
  const completedMatchIds = useMemo(() => new Set(results.map(r => r.match_id)), [results]);
  const remainingFixtures = useMemo(() => fixtures.filter(f => !completedMatchIds.has(f.match_id)), [fixtures, completedMatchIds]);

  // Worker initialization useEffect (adapted from hook)
  useEffect(() => {
      workerRef.current = new Worker(new URL('../logic/scenarioWorker.ts', import.meta.url), {
          type: 'module'
      });

      workerRef.current.onmessage = (event: MessageEvent<WorkerOutput>) => {
          const data = event.data;
          console.log("PlayoffBracket received from worker:", data);

          // Handle different message types
          // Removed VALIDATION_PROGRESS_UPDATE handling
          if (data.type === 'RESULT') {
              setValidationResult(data.isPossible ?? false, data.message); // Use store action to set final result and stop loading
              setPopupMessage(data.message || 'Validation complete.');
              setShowPopup(true);
              if (data.isPossible && data.scenario) {
                  console.log("Applying found scenario from PlayoffBracket...");
                  applyScenarioResults(data.scenario); // Use store action
              }
          } else if (data.type === 'ERROR') {
              console.error('PlayoffBracket Worker error:', data.message);
              setValidationResult(null, `Error: ${data.message || 'Unknown worker error'}`); // Use store action
              setPopupMessage(`Error: ${data.message || 'Unknown worker error'}`);
              setShowPopup(true);
          }
      };

      workerRef.current.onerror = (error) => {
          console.error('PlayoffBracket Worker onerror:', error);
          setValidationResult(null, 'An error occurred during possibility check. Check console.'); // Use store action
          setPopupMessage('An error occurred during possibility check. Check console.');
          setShowPopup(true);
      };

      return () => {
          workerRef.current?.terminate();
      };
  }, [setValidationResult, applyScenarioResults]); // Removed updateValidationProgress from dependencies

  // checkScenarioPossibility function (adapted from hook and old QueryInterface)
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
      console.log(`Sending ${specifiedCount}-team playoff check from PlayoffBracket to worker...`);
      setPopupMessage(''); // Clear previous message

      // Post message directly to the worker
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
          // optimizeNrr: attemptNrrOptimization, // Pass NRR flag if worker supports it and toggle exists
      });
  }, [
      qualifier1, eliminator, isValidationInProgress, setValidationResult,
      remainingFixtures, results, availableTeams, // Removed attemptNrrOptimization if not used by worker
  ]); // Dependencies for the callback

  return (
    <>
      <div className="p-4 bg-gray-800 rounded-lg shadow-xl">
        {/* Adjusted title style */}
        <h2 className="text-xl font-semibold text-center text-teal-300 mb-4 border-b border-gray-700 pb-2">
          Playoff Scenario Setup
        </h2>

        {/* Progress Bar Area Removed */}

        {/* Simplified layout - Q1/EL side-by-side or stacked on small screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start relative"> {/* Added relative positioning for loader */}
          {/* Q1 */}
          <div className="flex flex-col">
            {qualifier1 && (
              <PlayoffMatchCard
                stage={qualifier1.id}
                matchNumber={qualifier1.matchNumber}
                team1={qualifier1.team1}
                team2={qualifier1.team2}
                availableTeams={availableTeams}
                onUpdateTeam={updatePlayoffTeam}
                isEditable={true} // Q1 is editable
              />
            )}
          </div>

          {/* Eliminator */}
          <div className="flex flex-col">
            {eliminator && (
              <PlayoffMatchCard
                stage={eliminator.id}
                matchNumber={eliminator.matchNumber}
                team1={eliminator.team1}
                team2={eliminator.team2}
                availableTeams={availableTeams}
                onUpdateTeam={updatePlayoffTeam}
                isEditable={true} // Eliminator is editable
              />
            )}
          </div>
        </div>

        {/* Manual Validation Trigger Button - Uses component's checkScenarioPossibility */}
        <div className="mt-6 text-center">
            <button
                onClick={checkScenarioPossibility} // Use the local function
                className={`px-6 py-2 bg-interactive text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isValidationInProgress ? 'animate-pulse' : ''}`}
                // Disable only if checking or if *no* teams are selected at all
                disabled={isValidationInProgress || (!qualifier1?.team1 && !qualifier1?.team2 && !eliminator?.team1 && !eliminator?.team2)}
            >
                {isValidationInProgress ? 'Checking...' : 'Check Scenario Possibility'}
            </button>
            {/* Reset Button - Conditionally Rendered */}
            {hasSimulatedResults && (
                <button
                    onClick={resetSimulatedResults}
                    className="ml-4 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                    disabled={isValidationInProgress} // Disable while checking
                    title="Reset all simulated match results"
                >
                    Reset Sims
                </button>
            )}
        </div>
        {/* NRR Optimization Toggle - Uses local state */}
        <div className="mt-4 text-center">
            <label htmlFor="nrr-toggle-bracket" className="inline-flex items-center cursor-pointer">
                <div className="relative">
                    <input
                        type="checkbox"
                        id="nrr-toggle-bracket"
                        className="sr-only"
                        checked={attemptNrrOptimization}
                        onChange={() => setAttemptNrrOptimization(!attemptNrrOptimization)}
                        disabled={isValidationInProgress}
                    />
                    <div className={`block bg-gray-600 w-10 h-6 rounded-full ${isValidationInProgress ? 'opacity-50' : ''}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${attemptNrrOptimization ? 'transform translate-x-full bg-interactive' : ''} ${isValidationInProgress ? 'bg-gray-400' : ''}`}></div>
                </div>
                <div className="ml-3 text-text-secondary text-sm">
                    Attempt NRR Tiebreaker (Slower)
                </div>
            </label>
        </div>
      </div>

      {/* Result Popup - Uses local state */}
      <ResultPopup
        message={popupMessage}
        isVisible={showPopup}
        onClose={() => setShowPopup(false)}
      />
    </>
  );
};
