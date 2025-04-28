import React from 'react';
import { TeamInfo, PlayoffStage } from '../types';
import TeamSelector from './TeamSelector'; // Import the extracted TeamSelector

// Component for a single playoff match
const PlayoffMatchCard: React.FC<{
  stage: PlayoffStage;
  matchNumber: number;
  team1: TeamInfo | null;
  team2: TeamInfo | null;
  availableTeams: TeamInfo[];
  onUpdateTeam: (stage: PlayoffStage, teamIndex: 1 | 2, team: TeamInfo | null) => void;
  isEditable: boolean; // Only Q1 and EL are directly editable
}> = ({ stage, matchNumber, team1, team2, availableTeams, onUpdateTeam, isEditable }) => {

  const handleTeam1Select = (team: TeamInfo | null) => {
    onUpdateTeam(stage, 1, team);
  };

  const handleTeam2Select = (team: TeamInfo | null) => {
    onUpdateTeam(stage, 2, team);
  };

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-md mb-4 flex flex-col items-center">
      <h3 className="text-lg font-semibold text-teal-400 mb-3">{stage} (Match {matchNumber})</h3>
      <div className="flex flex-col space-y-3 w-full items-center">
        <TeamSelector
          team={team1}
          availableTeams={availableTeams}
          onSelectTeam={handleTeam1Select}
          disabled={!isEditable}
          placeholder={isEditable ? "Select Team 1" : (team1 ? team1.code : "TBD")}
        />
        <span className="text-gray-400 font-bold">vs</span>
        <TeamSelector
          team={team2}
          availableTeams={availableTeams}
          onSelectTeam={handleTeam2Select}
          disabled={!isEditable}
          placeholder={isEditable ? "Select Team 2" : (team2 ? team2.code : "TBD")}
        />
      </div>
      {/* TODO: Add result display later */}
    </div>
  );
};

export default PlayoffMatchCard;
