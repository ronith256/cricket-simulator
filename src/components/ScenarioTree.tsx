import React from 'react';
// import { useData } from '../context/DataContext'; // Remove old context import
import { usePointsTableStore } from '../store/pointsTableStore'; // Import the Zustand store
import { Fixture, CompletedMatch } from '../types'; // Updated import
import { motion } from 'framer-motion';
import MatchCard from './MatchCard';
import { PlayoffBracket } from './PlayoffBracket'; // Import the PlayoffBracket component

// Placeholder for a potential Playoff Match type if different from normal Match
// interface PlayoffMatch extends Fixture { /* ... playoff specific properties */ } // Updated reference

const ScenarioTree: React.FC = () => {
  // Fetch fixtures and results individually from the Zustand store
  const fixtures = usePointsTableStore((state) => state.fixtures);
  const results = usePointsTableStore((state) => state.results);

  // --- Data Preparation ---
  // Combine results and fixtures into a single list and sort chronologically
  const allMatches = React.useMemo(() => {
    const combined: (Fixture | CompletedMatch)[] = [
        ...(results || []), // Add results if available
        ...(fixtures || [])  // Add fixtures if available
    ];
    // Sort by date ascending (earliest first for tree top-down)
    // Need a robust date parsing logic if formats vary significantly
    return combined.sort((a, b) => {
        try {
            // Attempt to parse dates - adjust format if needed based on actual data
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (isNaN(dateA) || isNaN(dateB)) {
                console.warn("Invalid date found during sorting:", a.date, b.date);
                 return 0; // Keep original order if dates are invalid
             }
             // Sort descending: latest date first
             return dateB - dateA;
         } catch (e) {
             console.error("Error parsing date during sort:", e);
            return 0;
        }
    });
  }, [results, fixtures]); // Recalculate when results or fixtures change

  // Placeholder for playoff fixtures data - needs actual data source and type
  // const playoffFixtures: (Fixture | CompletedMatch)[] = []; // Use combined type

  if (!allMatches || allMatches.length === 0) { // Check combined list
    return <div className="text-center text-text-secondary mt-8">Loading match data...</div>;
  }

  // --- Tree Rendering Logic ---

  // Basic function to render a list of matches (Fixtures or CompletedMatches)
  const renderMatches = (matches: (Fixture | CompletedMatch)[], isPlayoff: boolean = false) => { // Updated type
    return matches.map((match, index) => (
      // Basic vertical stacking for now. A true tree needs complex positioning.
      <motion.div
        key={`${isPlayoff ? 'playoff' : 'normal'}-${match.match_id}`} // Use match_id
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="relative sm:pl-8 my-2 sm:my-4" // Remove base padding, add back for sm+, reduce margin
      >
        {/* Basic connecting line (vertical) - Hide on mobile */}
        {index > 0 && <div className="absolute left-4 top-[-16px] bottom-[calc(50%+8px)] w-0.5 bg-secondary hidden sm:block"></div>}
        {/* Connector to parent (horizontal) - Hide on mobile */}
        <div className="absolute left-4 top-[calc(50%-1px)] w-4 h-0.5 bg-secondary hidden sm:block"></div>

        <MatchCard match={match} />
      </motion.div>
    ));
  };

  return (
    // Added flex-grow, overflow-y-auto, removed mt-8 and max-w-6xl
    <div className="w-full p-4 bg-background rounded-lg shadow-lg overflow-y-auto flex-grow">

      <div className="mb-12">
        <h3 className="text-xl font-semibold mb-4 text-text-primary text-center border-b-2 border-accent pb-2">Playoffs</h3>
        {/* Removed conditional rendering based on playoffFixtures.length */}
        {/* Render PlayoffBracket directly. It handles its own initial state. */}
        <div className="flex flex-col items-center"> {/* Center playoff bracket */}
          <PlayoffBracket />
        </div>
        {/* Removed stray closing tags from previous conditional rendering */}
      </div>

      {/* --- Separator --- */}
      {/* <div className="relative h-1 my-12 bg-gradient-to-r from-transparent via-accent to-transparent">
         <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-sm text-accent font-semibold">League Stage</span>
      </div> */}


       {/* --- League Stage Matches Section (Combined & Sorted) --- */}
       <div className="mt-8">
          <h3 className="text-xl font-semibold mb-6 text-text-primary text-center border-b-2 border-accent pb-2">League Matches (Timeline)</h3>
          {allMatches.length > 0 ? ( // Use allMatches
            <div className="flex flex-col items-center relative"> {/* Changed items-start to items-center */}
               {/* Render all league matches (completed and upcoming), filtering out TBD teams */}
               {renderMatches(allMatches.filter(match => match.home_team.code !== 'TBD' && match.away_team.code !== 'TBD'))}
            </div>
         ) : (
           <div className="text-center text-text-secondary">No league matches loaded.</div>
         )}
      </div>

    </div>
  );
};

export default ScenarioTree;
