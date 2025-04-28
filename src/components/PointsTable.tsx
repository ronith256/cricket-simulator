// Removed React import as it's not explicitly needed after removing useMemo
// import { useMemo } from 'react'; // Remove useMemo
// import { useData } from '../context/DataContext'; // Remove old context import
import { usePointsTableStore } from '../store/pointsTableStore'; // Import the Zustand store
import { PointsTableEntry } from '../types';
import { motion } from 'framer-motion';


const PointsTable: React.FC = () => {
  // Get the points table from the Zustand store
  const pointsTable = usePointsTableStore((state) => state.pointsTable);

  const tableVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }, // Stagger row animation
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    // Removed flex-grow, overflow-y-auto
    <div className="w-full p-4 bg-secondary rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-6 text-accent text-center">Points Table</h2> {/* Use theme color */}
      {pointsTable.length === 0 ? ( // Use pointsTable from the store
        <div className="text-center text-text-secondary">Points table data is loading or not available yet.</div>
      ) : (
        // Add overflow-x-auto wrapper here
        <div className="overflow-x-auto">
          <motion.table
            className="min-w-full divide-y divide-gray-600 table-auto" // Use min-w-full and table-auto for better responsiveness with scroll
            variants={tableVariants}
            initial="hidden"
            animate="visible"
          >
            <thead className="bg-primary sticky top-0 z-10">
              <tr>
                {/* Adjusted padding, removed fixed widths for better auto-sizing */}
                <th scope="col" className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Pos</th>
                <th scope="col" className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Team</th>
                <th scope="col" className="py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Pld</th>
                <th scope="col" className="py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Won</th>
                <th scope="col" className="py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Lost</th>
                <th scope="col" className="py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Tied</th>
                <th scope="col" className="py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-2">Pts</th>
                <th scope="col" className="py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-2">NRR</th>
              </tr>
            </thead>
            <tbody className="bg-secondary divide-y divide-gray-700">
              {pointsTable.map((entry: PointsTableEntry, index: number) => (
                <motion.tr
                  key={entry.team.id}
                  className="hover:bg-primary transition-colors duration-200"
                  variants={rowVariants}
                >
                  {/* Remove whitespace-nowrap, adjust padding */}
                  <td className="py-3 text-sm text-text-secondary pl-1 pr-1">{index + 1}</td>
                  <td className="px-1 py-3 text-sm font-medium text-text-primary break-words">{entry.team.code}</td>
                  <td className="px-1 py-3 text-sm text-center text-text-primary">{entry.played}</td>
                  <td className="px-1 py-3 text-sm text-center text-text-primary">{entry.won}</td>
                  <td className="px-1 py-3 text-sm text-center text-text-primary">{entry.lost}</td>
                  <td className="px-1 py-3 text-sm text-center text-text-primary">{entry.tied}</td>
                  <td className="px-1 py-3 text-sm text-center font-bold text-text-primary">{entry.points}</td>
                  <td className={`py-3 text-sm text-right pl-1 pr-1 ${entry.nrr > 0 ? 'text-success' : entry.nrr < 0 ? 'text-red-500' : 'text-text-primary'}`}>
                    {entry.nrr >= 0 ? '+' : ''}{entry.nrr.toFixed(3)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </motion.table>
         </div> // End of overflow-x-auto wrapper
      )} {/* End of conditional rendering */}
    </div> // End of main component div
  );
};

export default PointsTable;
