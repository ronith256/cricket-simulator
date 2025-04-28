import React, { useState, useEffect, useCallback } from 'react';
import { Fixture, CompletedMatch, ScenarioInput, TeamRef } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { usePointsTableStore } from '../store/pointsTableStore';
import EditMatchPopup from './EditMatchPopup';

interface MatchCardProps {
  match: Fixture | CompletedMatch;
}

// Type guard to check if the match is completed
const isCompletedMatch = (match: Fixture | CompletedMatch): match is CompletedMatch => {
  return (match as CompletedMatch).result !== undefined;
};

// Unified helper to generate result summary string
const generateResultSummary = (
    source: ScenarioInput['editDetails'] | CompletedMatch | undefined,
    homeTeam: TeamRef,
    awayTeam: TeamRef,
    winnerTeamRef: TeamRef | undefined
): string => {
    const TEAM_NAME_MAX_LENGTH = 18;

    if (!source) return "Awaiting Match Results";

    // Case 1: Source is CompletedMatch (actual result)
    if ('winner_team_id' in source) {
        const matchResult = source as CompletedMatch;
        if (!matchResult.result) return "Result unavailable";
        if (winnerTeamRef) {
            const winnerName = winnerTeamRef.name;
            const winnerCode = winnerTeamRef.code;
            if (winnerName.length > TEAM_NAME_MAX_LENGTH && matchResult.result.includes(winnerName)) {
                 return matchResult.result.replace(winnerName, winnerCode);
            }
        }
        return matchResult.result;
    }
    // Case 2: Source is editDetails (simulation)
    else if (source && typeof source === 'object' && source !== null && 'teamChoice' in source) {
        const details = source as ScenarioInput['editDetails'];
        if (!details || !details.teamChoice || !details.outcome) return "Simulation Incomplete";
        const chosenTeamCode = details.teamChoice === homeTeam.id ? homeTeam.code : awayTeam.code;
        if (!chosenTeamCode) return "Invalid Team Code";

        let summary = `${chosenTeamCode} ${details.outcome}`;
        if (details.outcome === 'Won' || details.outcome === 'Lost') {
            summary += ` by ${details.marginValue || '?'} ${details.marginUnit}`;
            if (details.remainingValue !== undefined && details.remainingValue !== '') {
                 summary += ` with ${details.remainingValue} ${details.remainingUnit} left`;
            }
        }
        return summary;
    }

    return "Result unavailable";
};

// --- Main MatchCard Component ---
const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const updateMatchResult = usePointsTableStore((state) => state.updateMatchResult);
  const userScenario = usePointsTableStore((state) => state.userScenario);
  const [isEditingInline, setIsEditingInline] = useState(false); // For desktop inline edit
  const [showEditPopup, setShowEditPopup] = useState(false); // For mobile popup edit

  const currentScenarioInput = userScenario.find(input => input.matchId === match.match_id);

  // Use useCallback for memoization
  const getInitialEditDetails = useCallback((): ScenarioInput['editDetails'] => {
    if (currentScenarioInput?.editDetails) {
      return currentScenarioInput.editDetails;
    }
    if (isCompletedMatch(match)) {
        const completed = match as CompletedMatch;
        let outcome: 'Won' | 'Lost' | 'Tied' = 'Tied';
        let teamChoice = completed.home_team.id;
        if (completed.winner_team_id) {
            if (completed.winner_team_id === completed.home_team.id) {
                outcome = 'Won'; teamChoice = completed.home_team.id;
            } else {
                outcome = 'Lost'; teamChoice = completed.home_team.id;
            }
        }
        return {
            teamChoice: teamChoice, outcome: outcome, marginValue: '',
            marginUnit: 'Runs', remainingValue: '', remainingUnit: 'Overs'
        };
    }
    return {
      teamChoice: match.home_team.id, outcome: 'Won', marginValue: 10,
      marginUnit: 'Runs', remainingValue: '', remainingUnit: 'Overs',
    };
  }, [match, currentScenarioInput]);

  // State for inline edit form data (used only for desktop)
  const [inlineEditFormData, setInlineEditFormData] = useState<ScenarioInput['editDetails']>(getInitialEditDetails());

  // Effect to reset forms when match or scenario changes
  useEffect(() => {
    const initialDetails = getInitialEditDetails();
    setInlineEditFormData(initialDetails);
    if (!currentScenarioInput) {
        setIsEditingInline(false);
        setShowEditPopup(false);
    }
  }, [match.match_id, currentScenarioInput, getInitialEditDetails]);

  // --- Handlers for Inline Edit (Desktop) ---
  const handleInlineInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInlineEditFormData(prev => {
      if (!prev) return prev;
      const updatedValue = (name === 'marginValue' || name === 'remainingValue')
        ? (value === '' ? '' : Number(value)) : value;
      return { ...prev, [name]: updatedValue };
    });
  };

  const handleInlineSave = () => {
    if (!inlineEditFormData) return;
    updateMatchResult(match.match_id, inlineEditFormData);
    setIsEditingInline(false);
  };

  const handleInlineCancel = () => {
    setInlineEditFormData(getInitialEditDetails());
    setIsEditingInline(false);
  };

  // --- Handlers for Popup Edit (Mobile) ---
  const handlePopupSave = (data: ScenarioInput['editDetails']) => {
    updateMatchResult(match.match_id, data);
    setShowEditPopup(false);
  };

  const handlePopupClose = () => {
    setShowEditPopup(false);
  };

  // --- Click Handler ---
  const handleCardClick = () => {
      // Tailwind 'sm' breakpoint is 640px
      if (window.innerWidth < 640) {
          setShowEditPopup(true);
      } else {
          setIsEditingInline(true);
      }
  };

  // --- Data for Display ---
  const results = usePointsTableStore((state) => state.results);
  const updatedMatchData = results.find(r => r.match_id === match.match_id);
  const summarySource = updatedMatchData || (isCompletedMatch(match) ? match : undefined);
  let winnerTeamRef: TeamRef | undefined = undefined;
  if (summarySource && 'winner_team_id' in summarySource && summarySource.winner_team_id) {
      winnerTeamRef = summarySource.home_team.id === summarySource.winner_team_id ? summarySource.home_team : summarySource.away_team;
  }
  const displayResultText = generateResultSummary(summarySource, match.home_team, match.away_team, winnerTeamRef);
  let displayHomeScore = '-';
  let displayAwayScore = '-';
  const matchToDisplay = updatedMatchData || (isCompletedMatch(match) ? match : null);
  if (matchToDisplay && isCompletedMatch(matchToDisplay)) {
    displayHomeScore = matchToDisplay.innings1_summary || '-';
    displayAwayScore = matchToDisplay.innings2_summary || '-';
  }

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
  };

  return (
    <> {/* Use Fragment to allow popup rendering alongside card */}
      <motion.div
        layout
        className="flex items-center justify-center space-x-2 sm:space-x-4 p-4 sm:p-5 bg-primary rounded-lg shadow-md border border-secondary my-2 relative"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.3 }}
      >
          {/* Absolute positioned Match Info */}
          <div className="absolute top-1 left-1 sm:left-2 text-xs text-text-secondary">{`${match.match_number} | ${new Date(match.date).toLocaleDateString('en-CA')}`}</div>
          {/* Status Display Logic */}
          <div className={`absolute top-1 right-1 sm:right-2 text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
            updatedMatchData?.isSimulated ? 'bg-interactive text-white' :
            isCompletedMatch(match) || updatedMatchData ? 'bg-success text-primary' :
            'bg-highlight text-primary'
          }`}>
            {updatedMatchData?.isSimulated ? 'Simulated' : (isCompletedMatch(match) || updatedMatchData ? 'Completed' : 'Upcoming')}
          </div>

        {/* Home Team Logo */}
        <motion.img
          src={match.home_team.logo || '/placeholder_logo.png'} alt={match.home_team.name}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-secondary flex-shrink-0"
          whileHover={{ scale: 1.1 }}
        />
        {/* Home Team Score */}
        <div className="text-center text-xs sm:text-sm text-text-secondary w-12 sm:w-16 flex-shrink-0">{displayHomeScore}</div>

        {/* Result Card */}
        <motion.div
          layout
          className="flex-grow sm:min-w-[240px] max-w-md bg-secondary p-1.5 sm:p-3 rounded-md shadow-inner cursor-pointer transition-colors duration-200 hover:bg-indigo-700"
          onClick={handleCardClick} // Use unified click handler
          whileTap={{ scale: 0.98 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {/* Show inline edit form only on larger screens */}
            {isEditingInline && window.innerWidth >= 640 ? (
               // Inline Edit State (Desktop)
               <motion.div
                key="edit-inline"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1 sm:space-y-2 text-xs"
                onClick={(e) => e.stopPropagation()} // Prevent card click from closing edit
              >
                {/* --- Inline Edit Form Inputs --- */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-secondary">
                   {/* Team Choice */}
                   <select name="teamChoice" value={inlineEditFormData?.teamChoice || ''} onChange={handleInlineInputChange} className="p-1 rounded border border-secondary bg-primary text-text-primary text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-accent">
                     <option value={match.home_team.id}>{match.home_team.code}</option> <option value={match.away_team.id}>{match.away_team.code}</option>
                   </select>
                   {/* Outcome */}
                   <select name="outcome" value={inlineEditFormData?.outcome || 'Won'} onChange={handleInlineInputChange} className="p-1 rounded border border-secondary bg-primary text-text-primary text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-accent">
                     <option value="Won">Won</option> <option value="Lost">Lost</option> <option value="Tied">Tied</option>
                   </select>
                   {/* Margin (Conditional) */}
                   {inlineEditFormData?.outcome !== 'Tied' && (
                     <>
                       <span className="text-text-secondary flex-shrink-0">By</span>
                       <input type="number" name="marginValue" value={inlineEditFormData?.marginValue ?? ''} onChange={handleInlineInputChange} className="w-12 p-1 rounded border border-secondary bg-primary text-text-primary text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-accent" min="0" placeholder="Margin"/>
                       <select name="marginUnit" value={inlineEditFormData?.marginUnit || 'Runs'} onChange={handleInlineInputChange} className="p-1 rounded border border-secondary bg-primary text-text-primary text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-accent">
                         <option value="Runs">Runs</option> <option value="Wickets">Wickets</option>
                       </select>
                       <span className="text-text-secondary flex-shrink-0">with</span>
                       <input type="number" name="remainingValue" value={inlineEditFormData?.remainingValue ?? ''} onChange={handleInlineInputChange} className="w-12 p-1 rounded border border-secondary bg-primary text-text-primary text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-accent" min="0" placeholder="Left"/>
                       <select name="remainingUnit" value={inlineEditFormData?.remainingUnit || 'Overs'} onChange={handleInlineInputChange} className="p-1 rounded border border-secondary bg-primary text-text-primary text-xs flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-accent">
                         <option value="Overs">Overs</option> <option value="Balls">Balls</option>
                       </select>
                       <span className="text-text-secondary flex-shrink-0">left</span>
                     </>
                   )}
                 </div>
                 {/* --- Save/Cancel Buttons --- */}
                 <div className="flex justify-end space-x-2 mt-2">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleInlineSave} className="px-2 py-1 text-xs rounded bg-success text-white transition-colors duration-200 hover:bg-success/80">Save</motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleInlineCancel} className="px-2 py-1 text-xs rounded bg-danger text-white transition-colors duration-200 hover:bg-danger/80">Cancel</motion.button>
                 </div>
               </motion.div>
            ) : (
               // Display State (Default)
               <motion.div
                 key="display"
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 transition={{ duration: 0.2 }}
                 className="text-center text-text-primary font-medium text-xs sm:text-sm"
               >
                 {displayResultText}
               </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Away Team Score */}
        <div className="text-center text-xs sm:text-sm text-text-secondary w-12 sm:w-16 flex-shrink-0">{displayAwayScore}</div>
        {/* Away Team Logo */}
        <motion.img
          src={match.away_team.logo || '/placeholder_logo.png'} alt={match.away_team.name}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-secondary flex-shrink-0"
          whileHover={{ scale: 1.1 }}
        />
      </motion.div>

      {/* Conditionally render the Edit Popup */}
      <AnimatePresence>
        {showEditPopup && (
          <EditMatchPopup
            match={match}
            initialData={getInitialEditDetails()} // Pass initial data
            onSave={handlePopupSave}
            onClose={handlePopupClose}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MatchCard;
