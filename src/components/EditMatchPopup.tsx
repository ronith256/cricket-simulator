import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { Fixture, CompletedMatch, ScenarioInput } from "../types";

// --- Edit Popup Component ---
interface EditMatchPopupProps {
    match: Fixture | CompletedMatch;
    initialData: ScenarioInput['editDetails'];
    onSave: (data: ScenarioInput['editDetails']) => void;
    onClose: () => void;
}

const EditMatchPopup: React.FC<EditMatchPopupProps> = ({ match, initialData, onSave, onClose }) => {
    const [formData, setFormData] = useState<ScenarioInput['editDetails']>(initialData);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
          if (!prev) return prev;
          const updatedValue = (name === 'marginValue' || name === 'remainingValue')
            ? (value === '' ? '' : Number(value))
            : value;
          return { ...prev, [name]: updatedValue };
        });
    };

    const handleSaveClick = () => {
        if (formData) {
            onSave(formData);
        }
    };

    // Prevent background scroll when popup is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);


    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" // Increased backdrop opacity
            onClick={onClose} // Close on backdrop click
        >
            <motion.div
                initial={{ scale: 0.9, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-primary rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md relative border border-secondary"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside popup
            >
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-text-secondary hover:text-accent p-1 rounded-full transition-colors"
                    aria-label="Close popup"
                >
                    <X size={20} />
                </button>
                <h3 className="text-lg font-semibold mb-4 text-center text-accent border-b border-secondary pb-2">
                    Edit {match.home_team.code} v/s {match.away_team.code} Result
                </h3>
                <div className="space-y-4 text-sm"> {/* Increased spacing */}
                    {/* --- Edit Form Inputs --- */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2 text-text-secondary">
                        {/* Team Choice */}
                        <label className="flex items-center gap-2 flex-1 min-w-[120px]">
                            <span className="w-16">Team:</span>
                            <select
                                name="teamChoice"
                                value={formData?.teamChoice || ''}
                                onChange={handleInputChange}
                                className="flex-grow p-1.5 rounded border border-secondary bg-gray-700 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                                <option value={match.home_team.id}>{match.home_team.code}</option>
                                <option value={match.away_team.id}>{match.away_team.code}</option>
                            </select>
                        </label>

                        {/* Outcome */}
                         <label className="flex items-center gap-2 flex-1 min-w-[120px]">
                            <span className="w-16">Outcome:</span>
                            <select
                                name="outcome"
                                value={formData?.outcome || 'Won'}
                                onChange={handleInputChange}
                                className="flex-grow p-1.5 rounded border border-secondary bg-gray-700 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                                <option value="Tied">Tied</option>
                            </select>
                        </label>
                    </div>

                    {/* Margin (Conditional) */}
                    {formData?.outcome !== 'Tied' && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2 text-text-secondary border-t border-secondary pt-3 mt-3">
                             <label className="flex items-center gap-2 flex-1 min-w-[120px]">
                                <span className="w-16">By:</span>
                                <input
                                    type="number"
                                    name="marginValue"
                                    value={formData?.marginValue ?? ''}
                                    onChange={handleInputChange}
                                    className="flex-grow p-1.5 rounded border border-secondary bg-gray-700 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                    min="0"
                                    placeholder="Margin"
                                />
                            </label>
                             <label className="flex items-center gap-2 flex-1 min-w-[120px]">
                                <span className="w-16">Unit:</span>
                                <select
                                    name="marginUnit"
                                    value={formData?.marginUnit || 'Runs'}
                                    onChange={handleInputChange}
                                    className="flex-grow p-1.5 rounded border border-secondary bg-gray-700 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                >
                                    <option value="Runs">Runs</option>
                                    <option value="Wickets">Wickets</option>
                                </select>
                            </label>
                        </div>
                    )}
                     {/* Remaining (Conditional) */}
                     {formData?.outcome !== 'Tied' && (
                         <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2 text-text-secondary">
                             <label className="flex items-center gap-2 flex-1 min-w-[120px]">
                                <span className="w-16">With:</span>
                                <input
                                    type="number"
                                    name="remainingValue"
                                    value={formData?.remainingValue ?? ''}
                                    onChange={handleInputChange}
                                    className="flex-grow p-1.5 rounded border border-secondary bg-gray-700 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                    min="0"
                                    placeholder="Left"
                                />
                             </label>
                             <label className="flex items-center gap-2 flex-1 min-w-[120px]">
                                <span className="w-16">Unit:</span>
                                <select
                                    name="remainingUnit"
                                    value={formData?.remainingUnit || 'Overs'}
                                    onChange={handleInputChange}
                                    className="flex-grow p-1.5 rounded border border-secondary bg-gray-700 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                >
                                    <option value="Overs">Overs</option>
                                    <option value="Balls">Balls</option>
                                </select>
                                <span className="ml-1">left</span>
                            </label>
                        </div>
                    )}
                </div>
                {/* --- Save/Cancel Buttons --- */}
                <div className="flex justify-end space-x-3 mt-6 pt-3 border-t border-secondary">
                    <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm rounded bg-secondary text-text-secondary transition-colors duration-200 hover:bg-gray-600"
                    >
                        Cancel
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={handleSaveClick}
                        className="px-4 py-1.5 text-sm rounded bg-success text-white transition-colors duration-200 hover:bg-success/80"
                    >
                        Save Result
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default EditMatchPopup;