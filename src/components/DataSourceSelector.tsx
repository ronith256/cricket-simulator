import React, { useState, useCallback, useEffect } from 'react';
import { CompletedMatch, Fixture } from '../types'; // Removed unused TeamRef, ManOfTheMatch
import { AlertCircle } from 'lucide-react';
import { processRawData } from '../logic/dataProcessor'; // Import the processing function

// Define the expected structure of the global variable set by the script
declare global {
    interface Window {
        MatchSchedule?: any; // Use 'any' for now, refine if structure is known
    }
}

interface DataSourceSelectorProps {
    onDataProcessed: (results: CompletedMatch[], fixtures: Fixture[]) => void; // Use specific types
    onError: (message: string) => void;
}

const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({ onDataProcessed, onError }) => {
    const [dataSourceType, setDataSourceType] = useState<'url' | 'upload'>('url');
    const [url, setUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [fileInputKey, setFileInputKey] = useState<number>(Date.now()); // To reset file input
    const [lastUploadTimestamp, setLastUploadTimestamp] = useState<number | null>(null);
    const [showUploadWarning, setShowUploadWarning] = useState<boolean>(false);

    // Load last upload timestamp and persisted choices from localStorage on mount
    useEffect(() => {
        const storedTimestamp = localStorage.getItem('lastUploadTimestamp');
        if (storedTimestamp) {
            setLastUploadTimestamp(parseInt(storedTimestamp, 10));
        }
        const persistedType = localStorage.getItem('dataSourceType') as 'url' | 'upload' | null;
        const persistedUrl = localStorage.getItem('dataSourceUrl');
        if (persistedType) {
            setDataSourceType(persistedType);
            if (persistedType === 'url' && persistedUrl) {
                setUrl(persistedUrl);
            }
        }
    }, []); // Run only once on mount

    // --- URL Handling with Dynamic Script Injection & Caching ---
    const handleUrlSubmit = useCallback(() => {
        if (!url) {
            onError("Please enter a valid URL.");
            return;
        }
        setIsLoading(true);
        onError('');
        setShowUploadWarning(false);

        const cacheKey = `scriptData_${url}`;
        const cachedItem = localStorage.getItem(cacheKey);

        // 1. Check Cache
        if (cachedItem) {
            try {
                const { data, _ } = JSON.parse(cachedItem);
                console.log("Using cached data for URL:", url);
                // Use imported processRawData, passing onError
                const { results, fixtures } = processRawData(data, onError);
                if (results.length > 0 || fixtures.length > 0) {
                    onDataProcessed(results, fixtures);
                    localStorage.setItem('dataSourceUrl', url);
                    localStorage.setItem('dataSourceType', 'url');
                } else {
                    // onError should have been called by processRawData if structure was invalid
                    console.warn("Processing cached data resulted in empty results/fixtures.");
                    localStorage.removeItem(cacheKey); // Remove potentially bad cache
                    // Optionally call onError again if empty is an error state itself
                    // onError("Processing cached data failed or resulted in no matches.");
                }
                setIsLoading(false);
                return;
            } catch (e) {
                console.error("Error parsing cached data:", e);
                localStorage.removeItem(cacheKey);
            }
        }

        // 2. Dynamic Script Loading (JSONP style)
        console.log("No valid cache found, attempting JSONP-style load for:", url);
        const scriptId = `dynamic-schedule-script-${Date.now()}`;
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;

        const timeoutDuration = 10000;
        let timeoutId: number | null = null;

        const cleanup = () => {
            if (timeoutId !== null) clearTimeout(timeoutId);
            delete window.MatchSchedule;
            document.getElementById(scriptId)?.remove();
            setIsLoading(false);
        };

        window.MatchSchedule = (rawData: any) => {
            console.log("MatchSchedule callback executed.");
            if (timeoutId !== null) clearTimeout(timeoutId);
            try {
                // Use imported processRawData
                const { results, fixtures } = processRawData(rawData, onError);

                if (results.length > 0 || fixtures.length > 0) {
                     // Cache the raw data only if processing was somewhat successful
                    localStorage.setItem(cacheKey, JSON.stringify({ data: rawData, timestamp: Date.now() }));
                    localStorage.setItem('dataSourceUrl', url);
                    localStorage.setItem('dataSourceType', 'url');
                    console.log("Cached data from JSONP callback for URL:", url);
                    onDataProcessed(results, fixtures);
                } else {
                     // onError should have been called by processRawData if structure was invalid
                     console.warn("Processing data from script resulted in empty results/fixtures.");
                     // Optionally call onError again if empty is an error state itself
                     // onError("Processing data from script resulted in empty results/fixtures.");
                }
            } catch (e: any) {
                 console.error("Error processing or caching data from script callback:", e);
                 onError(`Error processing data from script callback: ${e.message}`);
            } finally {
                 cleanup();
            }
        };

        script.onerror = (error) => {
            console.error("Error loading dynamic script:", error);
            onError(`Failed to load script from URL: ${url}. Check the URL and network connection.`);
            cleanup();
        };

        script.src = url;
        document.body.appendChild(script);

        timeoutId = window.setTimeout(() => {
            console.error("Script load timeout reached.");
            onError("Loading data from URL timed out.");
            cleanup();
        }, timeoutDuration);

    }, [url, onDataProcessed, onError]); // Removed processRawData from here


    // --- File Upload Handling ---
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            onError("No file selected.");
            return;
        }
        setIsLoading(true);
        onError('');
        setShowUploadWarning(false);

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (lastUploadTimestamp !== null && (now - lastUploadTimestamp > oneDay)) {
            setShowUploadWarning(true);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const textData = e.target?.result as string;
                if (!textData) throw new Error("File content is empty.");
                let jsonData;
                try {
                    jsonData = JSON.parse(textData);
                } catch (parseError) {
                    const match = textData.match(/MatchSchedule\((.*)\)/s);
                    if (match && match[1]) {
                        try { jsonData = JSON.parse(match[1]); } catch (innerE) { throw new Error("Failed to parse JSON from file's MatchSchedule wrapper."); }
                    } else { throw new Error("Invalid JSON format in file and not wrapped in MatchSchedule(...)."); }
                }

                // Use imported processRawData
                const { results, fixtures } = processRawData(jsonData, onError);

                if (results.length > 0 || fixtures.length > 0) {
                    onDataProcessed(results, fixtures);
                    const currentTimestamp = Date.now();
                    localStorage.setItem('lastUploadTimestamp', String(currentTimestamp));
                    localStorage.setItem('dataSourceType', 'upload');
                    localStorage.removeItem('dataSourceUrl');
                    setLastUploadTimestamp(currentTimestamp);
                    setShowUploadWarning(false);
                    setFileInputKey(Date.now());
                } else {
                    console.warn("Processing uploaded file resulted in empty results/fixtures.");
                    // onError should have been called by processRawData if structure was invalid
                    setFileInputKey(Date.now());
                }
            } catch (error: any) {
                console.error("Error reading or processing file:", error);
                onError(`Failed to process file: ${error.message}`);
                setFileInputKey(Date.now());
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            onError("Failed to read the selected file.");
            setIsLoading(false);
            setFileInputKey(Date.now());
        };
        reader.readAsText(file);
    }, [onDataProcessed, onError, lastUploadTimestamp]); // Removed processRawData from here


    // Handler for radio button change
    const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newType = event.target.value as 'url' | 'upload';
        setDataSourceType(newType);
        localStorage.setItem('dataSourceType', newType);
        if (newType === 'upload') {
            localStorage.removeItem('dataSourceUrl');
        } else if (url) {
             localStorage.setItem('dataSourceUrl', url);
        }
        setShowUploadWarning(false);
    };


    return (
        <div className="p-4 border rounded shadow-md bg-gray-800 text-white mb-4">
            <h2 className="text-xl font-semibold mb-3">Load Match Data</h2>
            <div className="mb-3">
                <label className="mr-4">
                    <input
                        type="radio"
                        name="dataSourceType"
                        value="url"
                        checked={dataSourceType === 'url'}
                        onChange={handleTypeChange}
                        className="mr-1"
                    />
                    From URL (Auto-Refresh)
                </label>
                <label>
                    <input
                        type="radio"
                        name="dataSourceType"
                        value="upload"
                        checked={dataSourceType === 'upload'}
                        onChange={handleTypeChange}
                        className="mr-1"
                    />
                    Upload JSON File
                </label>
            </div>

            {dataSourceType === 'url' && (
                <div className="flex flex-wrap items-center gap-2"> {/* Use flex-wrap and gap */}
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter .js data URL (e.g., from S3)"
                        className="flex-grow p-2 border rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" // Added min-w-0
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleUrlSubmit}
                        disabled={isLoading || !url}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Loading...' : 'Load'}
                    </button>
                </div>
            )}

            {dataSourceType === 'upload' && (
                <div className="flex flex-wrap items-center gap-2"> {/* Use flex-wrap and gap */}
                     <input
                        key={fileInputKey}
                        type="file"
                        accept=".json,.js" // Accept both .js and .json
                        onChange={handleFileUpload}
                        className="flex-grow p-1 border rounded bg-gray-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 min-w-0" // Added min-w-0
                        disabled={isLoading}
                    />
                     {isLoading && <span className="text-sm">Processing...</span>} {/* Removed ml-2 as gap handles spacing */}
                </div>
            )}

             {/* Warning Display Area */}
             {showUploadWarning && dataSourceType === 'upload' && (
                <div className="mt-3 p-3 bg-yellow-900 border border-yellow-700 text-yellow-100 rounded flex items-center justify-between">
                    <div className='flex items-center'>
                        <AlertCircle className="mr-2 flex-shrink-0" size={20} />
                        <span>Warning: The last uploaded data is more than a day old. It might be outdated.</span>
                    </div>
                 </div>
             )}

            {/* Disclaimer */}
            <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400">
                <p className="font-semibold mb-1">Disclaimer:</p>
                <p>
                    This tool is a data visualizer/probability calculator. By loading data (either via URL or file upload),
                    you confirm that you have the necessary rights and permissions to use that data.
                    The creator of this tool is not responsible for the source, accuracy, or legality of the data you choose to load.
                </p>
            </div>
        </div>
    );
};

export default DataSourceSelector;
