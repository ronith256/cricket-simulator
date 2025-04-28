import { useState, useCallback, useEffect } from 'react'; // Re-added useEffect
import './App.css';
import ScenarioTree from './components/ScenarioTree';
import PointsTable from './components/PointsTable';
import QualifierStatsTable from './components/QualifierStatsTable';
import DataSourceSelector from './components/DataSourceSelector'; // Import the new component
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { usePointsTableStore } from './store/pointsTableStore';
import { BarChart2, GripHorizontal, AlertCircle } from 'lucide-react';
import { CompletedMatch, Fixture } from './types';
import { processRawData } from './logic/dataProcessor'; // Import processor

type View = 'tree' | 'points' | 'qualifier';


function App() {
  const [showStatsTable, setShowStatsTable] = useState(false);
  const [activeView, setActiveView] = useState<View>('tree');
  const [dataSourceError, setDataSourceError] = useState<string>(''); // State for data source errors

  // Get state and actions from Zustand store
  const isDataLoaded = usePointsTableStore((state) => state.isDataLoaded);
  const loadInitialData = usePointsTableStore((state) => state.loadInitialData);

  // Effect to load data from cache on initial mount
  useEffect(() => {
    if (isDataLoaded) return; // Don't reload if already loaded by selector

    const persistedType = localStorage.getItem('dataSourceType');
    const persistedUrl = localStorage.getItem('dataSourceUrl');

    if (persistedType === 'url' && persistedUrl) {
        const cacheKey = `scriptData_${persistedUrl}`;
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
            try {
                console.log("App: Attempting to load cached data on mount for URL:", persistedUrl);
                const { data } = JSON.parse(cachedItem);
                // Use imported processRawData, passing handleError for consistency
                const { results, fixtures } = processRawData(data, handleError);
                if (results.length > 0 || fixtures.length > 0) {
                    loadInitialData(results, fixtures); // Load into store
                    console.log("App: Successfully loaded cached data on mount.");
                } else {
                     console.warn("App: Processing cached data on mount resulted in empty data.");
                     localStorage.removeItem(cacheKey); // Clear bad cache
                }
            } catch (e) {
                 console.error("App: Error parsing cached data on mount:", e);
                 localStorage.removeItem(`scriptData_${persistedUrl}`); // Clear bad cache
            }
        }
    }
    // We don't attempt to reload from 'upload' type on refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial mount


  // Callbacks for DataSourceSelector
  const handleDataProcessed = useCallback((results: CompletedMatch[], fixtures: Fixture[]) => {
    console.log("App: Data processed, loading into store...");
    setDataSourceError(''); // Clear any previous errors
    loadInitialData(results, fixtures);
  }, [loadInitialData]);

  const handleError = useCallback((message: string) => {
    setDataSourceError(message);
  }, []);


  const swipeThreshold = 100;
  const swipeVelocityThreshold = 0.3;

  // This handler will be moved to the indicator bar later
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // No longer need to check isScrollingVerticallyRef
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(offset) > swipeThreshold || Math.abs(velocity) > swipeVelocityThreshold) {
      if (offset > 0 || velocity > swipeVelocityThreshold) { // Swipe Right
        setActiveView((prev) => (prev === 'qualifier' ? 'points' : prev === 'points' ? 'tree' : 'tree'));
      } else { // Swipe Left
        setActiveView((prev) => (prev === 'tree' ? 'points' : prev === 'points' ? 'qualifier' : 'qualifier'));
      }
    }
  };

  // Remove touch handlers for inner scrollable div
  // const handleTouchStart = ...
  // const handleTouchMove = ...
  // const handleTouchEnd = ...


  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%', // Slide in from right (1) or left (-1)
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3 } // Add transition for smoother appearance
    }, // Replaced ')' with ','
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%', // Slide out to right (-1) or left (1)
      opacity: 0,
      transition: { duration: 0.2 } // Add transition for smoother disappearance
    }),
  };

  // Store previous view for animation direction
  const [prevView, setPrevView] = useState<View>(activeView);
  useEffect(() => {
    setPrevView(activeView);
  }, [activeView]);

  // Determine swipe direction for animation: +1 for right, -1 for left
  const getDirection = (current: View, prev: View): number => {
    const order: View[] = ['tree', 'points', 'qualifier'];
    return order.indexOf(current) > order.indexOf(prev) ? 1 : -1;
  };

  return (
    <motion.div
      className="h-screen overflow-hidden bg-primary text-text-primary flex flex-col items-center pt-4 sm:pt-8 md:pt-12 pb-4 sm:pb-8 md:pb-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Data Source Selector - Rendered first */}
      {!isDataLoaded && (
          <div className="w-full max-w-4xl px-4 mb-4">
              <DataSourceSelector onDataProcessed={handleDataProcessed} onError={handleError} />
              {dataSourceError && (
                  <div className="mt-2 p-3 bg-red-900 border border-red-700 text-red-100 rounded flex items-center">
                      <AlertCircle className="mr-2" size={20} />
                      <span>Error: {dataSourceError}</span>
                  </div>
              )}
          </div>
      )}

      {/* Main Content - Rendered only if data is loaded */}
      {isDataLoaded && (
        <>
          {/* --- Mobile View (Swipeable) --- */}
          <div className="lg:hidden w-full flex-grow overflow-hidden flex flex-col">
            {/* Swipe Indicator - Add drag handlers back */}
            <motion.div
          className="flex justify-center items-center py-2 text-text-secondary flex-shrink-0 cursor-grab active:cursor-grabbing" // Added motion.div and cursor styles
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
        >
          <GripHorizontal size={24} />
          <span className="ml-2 text-xs uppercase tracking-wider">
            {activeView === 'tree' ? 'Scenario Tree' : activeView === 'points' ? 'Points Table' : 'Qualifier Stats'}
          </span>
        </motion.div>

        {/* Content Container - Remove drag handlers */}
        <div className="flex-grow overflow-hidden relative"> {/* Removed motion.div and drag props */}
          <AnimatePresence initial={false} custom={getDirection(activeView, prevView)}>
            {/* Inner scrollable container */}
            <motion.div
              key={activeView}
              custom={getDirection(activeView, prevView)}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              // Removed transition from here, handled by variants
              className="absolute inset-0 w-full h-full px-2 sm:px-4 overflow-y-auto"
              // Remove touch handlers
              // onTouchStart={handleTouchStart}
              // onTouchMove={handleTouchMove}
              // onTouchEnd={handleTouchEnd}
            >
              {activeView === 'tree' && <ScenarioTree />}
              {activeView === 'points' && <PointsTable />}
              {activeView === 'qualifier' && <QualifierStatsTable />}
            </motion.div>
          </AnimatePresence>
        </div> {/* <--- Corrected closing tag to div */}
        {/* Navigation Dots */}
        <div className="flex justify-center space-x-2 py-2 flex-shrink-0"> {/* Added flex-shrink-0 */}
          {(['tree', 'points', 'qualifier'] as View[]).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`w-2 h-2 rounded-full transition-colors ${
                activeView === view ? 'bg-accent' : 'bg-secondary hover:bg-gray-500'
              }`}
              aria-label={`Go to ${view} view`}
            />
          ))}
            </div>
          </div>

          {/* --- Desktop View (Side-by-Side) --- */}
          <div className="hidden lg:flex w-full px-4 md:px-8 lg:px-12 xl:px-16 flex-row justify-around items-start space-x-8 flex-grow overflow-hidden">
            {/* Scenario Tree */}
            <div className="lg:w-2/3 h-full flex flex-col">
          <ScenarioTree />
        </div>
        {/* Points Table / Stats Table Area */}
        <div className="lg:w-1/3 h-full flex flex-col space-y-4">
          {/* Toggle Button (Only on Desktop) */}
          <div className="flex justify-end px-4">
            <motion.button
              onClick={() => setShowStatsTable(!showStatsTable)}
              className="p-2 rounded-full bg-secondary hover:bg-accent text-text-secondary hover:text-white transition-colors"
              title={showStatsTable ? 'Show Points Table' : 'Show Qualifier Stats'}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <BarChart2 size={20} />
            </motion.button>
          </div>
          {/* Conditional Rendering (Desktop) */}
          <div className="flex-grow overflow-hidden">
            {showStatsTable ? <QualifierStatsTable /> : <PointsTable />}
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default App;
