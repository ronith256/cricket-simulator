import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePointsTableStore } from '../store/pointsTableStore';
// import { TeamQualifierStats, TeamWinLoseStats } from '../types'; // Import types

// Worker Initialization (outside component to avoid recreation on re-renders)
let scenarioWorker: Worker | null = null;

const QualifierStatsTable: React.FC = () => {
  // Select individual state slices to prevent unnecessary re-renders
  const fixtures = usePointsTableStore(state => state.fixtures);
  const results = usePointsTableStore(state => state.results);
  const getAllTeams = usePointsTableStore(state => state.getAllTeams);
  const qualifierStats = usePointsTableStore(state => state.qualifierStats);
  const winLoseAllStats = usePointsTableStore(state => state.winLoseAllStats);
  const isCalculatingProbabilities = usePointsTableStore(state => state.isCalculatingProbabilities);
  const probabilityCalculationProgress = usePointsTableStore(state => state.probabilityCalculationProgress);
  const totalProbabilityScenarios = usePointsTableStore(state => state.totalProbabilityScenarios);
  const processedProbabilityScenarios = usePointsTableStore(state => state.processedProbabilityScenarios);
  const startProbabilityCalculation = usePointsTableStore(state => state.startProbabilityCalculation);
  const setProbabilityResults = usePointsTableStore(state => state.setProbabilityResults);
  const updateProbabilityProgress = usePointsTableStore(state => state.updateProbabilityProgress);
  const setProbabilityCalculationStatus = usePointsTableStore(state => state.setProbabilityCalculationStatus);
  const calculateWinLoseAllScenarios = usePointsTableStore(state => state.calculateWinLoseAllScenarios);

  const allTeams = useMemo(() => getAllTeams(), [getAllTeams]); // Memoize team list
  // Ref to track if Win/Lose calculation has been triggered by the user
  const didTriggerWinLoseCalcRef = useRef(false);

  // Effect to initialize and terminate worker
  useEffect(() => {
    // Initialize worker
    scenarioWorker = new Worker(new URL('../logic/scenarioWorker.ts', import.meta.url), { type: 'module' });

    // Worker message handler
    scenarioWorker.onmessage = (event) => {
      const data = event.data;
      console.log("UI received message from worker:", data); // Debug log

      if (data.type === 'PROGRESS_UPDATE') {
        updateProbabilityProgress(data.progress, data.processedCount, data.totalCount);
      } else if (data.type === 'PROBABILITY_RESULT') {
        setProbabilityResults(data.stats);
      } else if (data.type === 'ERROR') {
        console.error("Worker Error:", data.message);
        setProbabilityCalculationStatus(false); // Stop loading on error
        // TODO: Show error message to user
      }
    };

    scenarioWorker.onerror = (error) => {
        console.error("Worker onerror:", error);
        setProbabilityCalculationStatus(false);
        // TODO: Show error message to user
    };

    // Cleanup worker on component unmount
    return () => {
      if (scenarioWorker) {
        console.log("Terminating scenario worker...");
        scenarioWorker.terminate();
        scenarioWorker = null;
      }
    };
  }, [updateProbabilityProgress, setProbabilityResults, setProbabilityCalculationStatus]); // Dependencies for store actions used in handler

  // NOTE: Win/Lose All calculation is now triggered within handleCalculate if needed.

  const handleCalculate = () => {
    if (!scenarioWorker) {
        console.error("Worker not initialized!");
        return;
    }

    // Calculate Win/Lose All scenarios if not already done
    if (!didTriggerWinLoseCalcRef.current) {
        console.log("QualifierStatsTable: Triggering Win/Lose All calculation on button click.");
        calculateWinLoseAllScenarios();
        didTriggerWinLoseCalcRef.current = true; // Mark as triggered
    }

    startProbabilityCalculation(); // Update store state (loading, progress=0)
    // Send message to worker for probability calculation
    scenarioWorker.postMessage({
        type: 'CALCULATE_PROBABILITIES',
        remainingFixtures: fixtures, // Send current remaining fixtures
        baseResults: results,       // Send current base results
        allTeams: allTeams          // Send all teams info
    });
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="w-full p-4 bg-secondary rounded-lg shadow-lg relative min-h-[300px] flex flex-col justify-center items-center">
      <h2 className="text-2xl font-semibold mb-6 text-accent text-center">Qualifier Analysis</h2>

      {/* Overlay for Calculation Button / Progress */}
      <AnimatePresence>
        {/* Show overlay if probability stats haven't been calculated OR if currently calculating */}
        {(!qualifierStats || isCalculatingProbabilities) && (
          <motion.div
            key="overlay"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/80 backdrop-blur-sm flex flex-col justify-center items-center z-10 rounded-lg p-4"
          >
            <p className="text-text-secondary mb-2 text-center">
              Remaining Matches: {fixtures.length}
            </p>
            <p className="text-text-secondary mb-4 text-center">
              Total Possible Scenarios: {formatNumber(Math.pow(3, fixtures.length))}
              {totalProbabilityScenarios > 0 && ` (~${formatNumber(totalProbabilityScenarios)})`}
            </p>
            {!isCalculatingProbabilities ? (
              <motion.button
                onClick={handleCalculate}
                className="px-6 py-2 bg-interactive text-white rounded-lg shadow hover:bg-interactive/80 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={fixtures.length === 0} // Disable if no fixtures left
                title={fixtures.length === 0 ? "No remaining matches to calculate" : "Calculate Probabilities"}
              >
                Calculate Probabilities
              </motion.button>
            ) : (
              <div className="w-full max-w-md text-center">
                <p className="text-text-primary mb-2">
                    Calculating... ({probabilityCalculationProgress}%)
                    {processedProbabilityScenarios > 0 && totalProbabilityScenarios > 0 && (
                        <span className="text-xs text-text-secondary block">
                            ({formatNumber(processedProbabilityScenarios)} / {formatNumber(totalProbabilityScenarios)})
                        </span>
                    )}
                </p>
                <div className="w-full bg-primary rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="bg-success h-2.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${probabilityCalculationProgress}%` }}
                    transition={{ duration: 0.1, ease: "linear" }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual Table Content - Show when stats are available */}
      {/* Conditionally render table only when win/lose stats are available */}
      {/* Remove overflow-x-auto wrapper */}
      <div className={`w-full transition-opacity duration-300 ${winLoseAllStats ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <table className="w-full divide-y divide-gray-600 table-fixed"> {/* Use w-full and table-fixed */}
          <thead className="bg-primary sticky top-0 z-0">
            <tr>
              {/* Adjust padding and potentially widths */}
              <th scope="col" className="w-1/5 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider pl-1 pr-1">Team</th>
              <th scope="col" className="w-1/5 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-1" title="Probability of finishing in Top 4">Qual%</th>
              <th scope="col" className="w-1/5 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-1" title="Probability of finishing in Top 2">Top2%</th>
              <th scope="col" className="w-1/5 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-1" title="Outcome if team wins all remaining matches">WinAll</th>
              <th scope="col" className="w-1/5 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-1" title="Outcome if team loses all remaining matches">LoseAll</th>
            </tr>
          </thead>
          <tbody className="bg-secondary divide-y divide-gray-700">
            {/* Combine stats - assumes qualifierStats and winLoseStats align by teamId */}
            {allTeams.map(team => {
                const qStats = qualifierStats?.find(qs => qs.teamId === team.id);
                const wlStats = winLoseAllStats?.find(wls => wls.teamId === team.id);

                return (
                  <tr key={team.id} className="hover:bg-primary/50 transition-colors">
                    {/* Remove whitespace-nowrap, adjust padding */}
                    <td className="py-3 text-sm font-medium text-text-primary flex items-center pl-1 pr-1">
                        <img src={team.logo} alt={team.code} className="w-5 h-5 mr-1 sm:mr-2 rounded-full flex-shrink-0"/>
                        <span className="truncate">{team.code}</span> {/* Allow truncation if needed */}
                    </td>
                    <td className="px-1 py-3 text-sm text-center text-text-primary">
                        {qStats?.top4Percent !== undefined ? `${qStats.top4Percent.toFixed(1)}%` : '--'}
                    </td>
                    <td className="px-1 py-3 text-sm text-center text-text-primary">
                        {qStats?.top2Percent !== undefined ? `${qStats.top2Percent.toFixed(1)}%` : '--'}
                    </td>
                    <td className={`px-1 py-3 text-xs sm:text-sm text-center font-medium break-words ${wlStats?.winAllResult === 'Qualify' ? 'text-success' : 'text-danger'}`}>
                        {wlStats ? `${wlStats.winAllResult}${wlStats.winAllRank ? `(${wlStats.winAllRank})` : ''}` : '--'}
                    </td>
                    <td className={`px-1 py-3 text-xs sm:text-sm text-center font-medium break-words ${wlStats?.loseAllResult === 'Qualify' ? 'text-success' : 'text-danger'}`}>
                        {wlStats ? `${wlStats.loseAllResult}${wlStats.loseAllRank ? `(${wlStats.loseAllRank})` : ''}` : '--'}
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QualifierStatsTable;
