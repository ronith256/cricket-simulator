import React from 'react';
import { TeamInfo } from '../types';

// Simple component to display a team with logo and name, allowing selection
const TeamSelector: React.FC<{
  team: TeamInfo | null;
  availableTeams: TeamInfo[];
  onSelectTeam: (team: TeamInfo | null) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ team, availableTeams, onSelectTeam, disabled = false, placeholder = "Select Team" }) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTeamId = event.target.value;
    const selectedTeam = availableTeams.find(t => t.id === selectedTeamId) || null;
    onSelectTeam(selectedTeam);
  };

  return (
    <div className="flex items-center space-x-2 p-2 border border-gray-600 rounded bg-gray-800 min-w-[180px]">
      {team?.logo && <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain" />}
      <select
        value={team?.id || ""}
        onChange={handleChange}
        disabled={disabled}
        className={`bg-gray-700 text-white p-1 rounded text-sm flex-grow ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <option value="" disabled={!team}>{placeholder}</option>
        {availableTeams.map(t => (
          <option key={t.id} value={t.id}>
            {t.code} - {t.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TeamSelector;
