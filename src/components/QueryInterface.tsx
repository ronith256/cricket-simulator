import React, { useState, useEffect, useRef, useMemo } from 'react'; // Added useMemo
import { motion } from 'framer-motion';
import { usePointsTableStore } from '../store/pointsTableStore';
import ResultPopup from './ResultPopup'; // Import the popup
import { TeamInfo, CompletedMatch } from '../types'; // Import TeamInfo and CompletedMatch types

// Define the expected structure of messages from the worker
interface WorkerOutput {
  type: 'RESULT' | 'ERROR';
  isPossible?: boolean;
  message: string;
  scenario: CompletedMatch[] | null; // Added scenario field
}

const QueryInterface: React.FC = () => {
  // Add resetSimulatedResults to the destructured actions
  const { allTeams, fixtures, results, applyScenarioResults, resetSimulatedResults } = usePointsTableStore((state) => ({
    allTeams: state.getAllTeams(),
    fixtures: state.fixtures,
    results: state.results,
    applyScenarioResults: state.applyScenarioResults,
    resetSimulatedResults: state.resetSimulatedResults, // Get the reset action
  }));

  // Check if there are any simulated results
  const hasSimulatedResults = useMemo(() => results.some(r => r.isSimulated === true), [results]);

  // Derive remaining fixtures
  const completedMatchIds = new Set(results.map(r => r.match_id));
  const remainingFixtures = fixtures.filter(f => !completedMatchIds.has(f.match_id));

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupMessage, setPopupMessage] = useState<string>('');
  const [attemptNrrOptimization, setAttemptNrrOptimization] = useState<boolean>(false); // State for the switch

  const workerRef = useRef<Worker | null>(null);

  // Initialize worker
  useEffect(() => {
    // Create the worker instance using the new URL syntax
    // Ensure the path is correct relative to the public directory or build output
    // Vite handles worker imports like this: new Worker(new URL('./path/to/worker.ts', import.meta.url))
    workerRef.current = new Worker(new URL('../logic/scenarioWorker.ts', import.meta.url), {
        type: 'module' // Important for using ES modules inside the worker
    });

    // Handle messages from worker
    workerRef.current.onmessage = (event: MessageEvent<WorkerOutput>) => {
      console.log("Main thread received:", event.data);
      const { isPossible, message, scenario } = event.data;
      setIsLoading(false);
      setPopupMessage(message); // Show the message from worker
      setShowPopup(true);

      // If a possible scenario was found, apply it to the main state
      if (isPossible && scenario) {
        console.log("Applying found scenario to store...");
        applyScenarioResults(scenario);
      }
    };

    // Handle errors from worker
    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error);
      setIsLoading(false);
      setPopupMessage('An error occurred during calculation. Check console.');
      setShowPopup(true);
    };

    // Cleanup worker on component unmount
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleSingleTeamCheck = () => {
    if (!selectedTeamId || !workerRef.current || isLoading) return;

    console.log("Sending single team check to worker for:", selectedTeamId);
    setIsLoading(true);
    setPopupMessage(''); // Clear previous message

    // Send data to worker
    workerRef.current.postMessage({
      type: 'CHECK_SINGLE_TEAM',
      remainingFixtures, // Use the derived remaining fixtures
      baseResults: results, // Use the results state directly
      allTeams: allTeams, // Use the teams from getAllTeams()
      targetData: { teamId: selectedTeamId },
      optimizeNrr: attemptNrrOptimization, // Pass the switch state
    });
  };

  return (
    <>
      <motion.div
        className="w-full max-w-4xl mx-auto mt-8 p-6 bg-secondary rounded-lg shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-2xl font-semibold mb-6 text-accent text-center">Qualification Queries</h2>
        <div className="flex flex-col items-center space-y-4">
          {/* Single Team Qualification Check */}
          <div className="w-full md:w-2/3 lg:w-1/2 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
             <label htmlFor="team-select" className="text-text-primary mb-1 sm:mb-0 whitespace-nowrap">Can this team qualify?</label>
             <select
                id="team-select"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="flex-grow p-2 border border-gray-600 rounded bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-interactive focus:border-transparent"
                disabled={isLoading}
             >
                <option value="">-- Select a Team --</option>
                {allTeams.map((team: TeamInfo) => ( // Use allTeams from the selector
                    <option key={team.id} value={team.id}>
                        {team.name} ({team.code}) {/* Added team code for clarity */}
                    </option>
                ))}
             </select>
             <button
                onClick={handleSingleTeamCheck}
                className="w-full sm:w-auto px-5 py-2 bg-interactive text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedTeamId || isLoading}
             >
                {isLoading ? (
                    <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Checking...
                    </div>
                ) : (
                    'Check Qualification'
                )}
             </button>
             {/* Reset Button - Conditionally Rendered */}
             {hasSimulatedResults && (
                <button
                    onClick={resetSimulatedResults}
                    className="w-full sm:w-auto px-5 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading} // Disable while checking qualification
                    title="Reset all simulated match results"
                >
                    Reset Sims
                </button>
             )}
          </div>
          {/* NRR Optimization Toggle */}
          <div className="w-full md:w-2/3 lg:w-1/2 flex items-center justify-center mt-2">
              <label htmlFor="nrr-toggle-query" className="flex items-center cursor-pointer">
                  <div className="relative">
                      <input
                          type="checkbox"
                          id="nrr-toggle-query"
                          className="sr-only"
                          checked={attemptNrrOptimization}
                          onChange={() => setAttemptNrrOptimization(!attemptNrrOptimization)}
                          disabled={isLoading}
                      />
                      <div className={`block bg-gray-600 w-10 h-6 rounded-full ${isLoading ? 'opacity-50' : ''}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${attemptNrrOptimization ? 'transform translate-x-full bg-interactive' : ''} ${isLoading ? 'bg-gray-400' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-text-secondary text-sm">
                      Attempt NRR Tiebreaker (Slower)
                  </div>
              </label>
          </div>

          {/* Placeholder for 4-team validation (can be added later or kept in PlayoffBracket) */}
          {/* <hr className="w-full border-gray-600 my-6" />
          <p className="text-text-secondary">
            Or check a specific 4-team playoff scenario...
          </p> */}

        </div>
      </motion.div>

      {/* Result Popup */}
      <ResultPopup
        message={popupMessage}
        isVisible={showPopup}
        onClose={() => setShowPopup(false)}
      />
    </>
  );
};

export default QueryInterface;
