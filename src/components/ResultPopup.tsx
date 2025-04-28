import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultPopupProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const ResultPopup: React.FC<ResultPopupProps> = ({ message, isVisible, onClose }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose} // Close on backdrop click
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full text-center relative"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the popup
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Calculation Result</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResultPopup;
