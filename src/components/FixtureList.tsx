import React from 'react';
import { useData } from '../context/DataContext';
import { Match } from '../types';

const FixtureList: React.FC = () => {
  const { fixtures } = useData();

  if (!fixtures || fixtures.length === 0) {
    return <div className="text-center text-gray-500 mt-8">Loading fixtures...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 p-4 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-cyan-400 text-center">Match Fixtures</h2>
      <div className="space-y-4">
        {fixtures.map((match: Match) => (
          <div key={match.id} className="p-4 bg-gray-700 rounded shadow flex justify-between items-center">
            <span className="font-medium">{`Match ${match.matchNumber}: ${match.team1.name} vs ${match.team2.name}`}</span>
            <span className={`text-sm font-semibold px-2 py-1 rounded ${match.status === 'completed' ? 'bg-green-600' : match.status === 'scheduled' ? 'bg-yellow-500 text-black' : 'bg-blue-500'}`}>
              {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
            </span>
            {/* Placeholder for MatchCard component or more details */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FixtureList;
