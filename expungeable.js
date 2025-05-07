// Execute immediately - synchronous approach
console.log("Expungeable.js loaded - using synchronous initialization");

// Log class availability for debugging
console.log("Base CaseProcessor available:", typeof window.CaseProcessor === 'function');
console.log("CPCCaseProcessor available:", typeof window.CPCCaseProcessor === 'function');
console.log("CaseProcessorFactory available:", typeof window.CaseProcessorFactory === 'function');

// Create a direct execution function - completely synchronous
function processCaseSynchronously() {
    console.log("Attempting direct processing");
    
    try {
        // Create processor directly using the factory
        if (window.CaseProcessorFactory) {
            console.log("CaseProcessorFactory found, creating processor");
            const processor = window.CaseProcessorFactory.createProcessor();
            
            if (processor) {
                console.log("Processor created, processing case");
                // NOTE: process() is async but we're calling it directly
                processor.process();
                console.log("Process method called");
            } else {
                console.error("Failed to create processor");
            }
        } else {
            console.error("CaseProcessorFactory not available");
        }
    } catch (error) {
        console.error("Error during synchronous processing:", error);
    }
}

// Execute immediately once DOM is ready - no waiting or timeouts
$(document).ready(function() {
    console.log("Document ready, executing immediately");
    processCaseSynchronously();
});

