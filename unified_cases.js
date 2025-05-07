// Initialize global object to hold our API
window.CourtKokua = window.CourtKokua || {};

// Case Processor Factory
class CaseProcessorFactory {
  // Safely get processor class, check if it exists in window scope
  static getProcessorClass(name) {
    return window[name] || null;
  }

  // Dynamically build the processor map when needed
  static get PROCESSOR_MAP() {
    return {
      'CPC': this.getProcessorClass('CPCCaseProcessor'),
      'PC': this.getProcessorClass('PCCaseProcessor'),
      'FFC': this.getProcessorClass('FFCCaseProcessor'),
      'DTC': this.getProcessorClass('DTCCaseProcessor'),
      'DCW': this.getProcessorClass('DCWCaseProcessor'),
      'DCC': this.getProcessorClass('DCCCaseProcessor'),
      'DTA': this.getProcessorClass('DTACaseProcessor'),
      'DTI': this.getProcessorClass('DTICaseProcessor'),
      'AR': this.getProcessorClass('ARCaseProcessor'),
    };
  }

  static DESCRIPTION_TYPE_MAP = {
    "TC - Traffic Crime": ["DTA", "DTC"],
    "CW - Criminal Written Complaint": ["DCW"],
    "PC - Circuit Court Criminal": ["CPC", "PC"],
    "SS - Temp Restraining Order": ["DSS", "SS"],
    "CC - Criminal Citation": ["DCC"],
    "TI - Traffic Infraction": ["DTI"],
    "TP - Traffic Parking": ["DTP"],
    "DV - Divorce": ["DV", "FDV"],
    "WC - Appln for Writ of Certiorari": ["SCWC"],
    "LD - Land Court": ["LD", "CLD"],
    "AP - Appeal": ["CAAP"],
    "SP - Special Proceeding": ["SP"],
    "CV - Circuit Court Civil": ["CCV", "CC"],
    "UJ - Unif Child Cust Juris&Enf Act": ["UJ"],
    "FC - Family Court Criminal": ["FFC"],
    "RC - Regular Claim": ["RC"],
    "DA - Domestic Abuse": ["DA"],
    "GD - Guardianship": ["GD"],
    "CU - Civil Union": ["CU"],
    "AA - Adult Abuse": ["AA"],
    "AR - Administrative Review": ["AR"],
  };

  // Check processor availability - but we'll use any processors we can find
  static areProcessorsAvailable() {
    const requiredProcessors = [
      'CPCCaseProcessor', 'PCCaseProcessor', 'FFCCaseProcessor',
      'DTCCaseProcessor', 'DCWCaseProcessor', 'DCCCaseProcessor',
      'DTACaseProcessor', 'DTICaseProcessor', 'ARCaseProcessor'
    ];
    
    console.log("Checking for processor availability...");
    
    // Log required processor presence
    for (const processor of requiredProcessors) {
      console.log(`${processor} available:`, typeof window[processor] === 'function');
    }
    
    // Check base processor - this one is really required
    if (typeof window.CaseProcessor !== 'function') {
      console.error("Base CaseProcessor class missing - this will cause problems");
      return false;
    }
    
    // We're going to be lenient and return true even if not all processors are available
    console.log("Some processors may be missing, but we'll proceed anyway");
    return true;
  }

  static handleInvalidCase(formElement, caseInfoElement, htmlContent = null) {
    const caseInfo = caseInfoElement.text() || "";
    
    if (formElement.action.includes("CaseSearch") && caseInfo.includes("Case ID:")) {
      utils.showDialog(
        "Unsupported Case Type",
        "This case type is not currently supported.",
        htmlContent
      );
    } else if (formElement.action.includes("CaseSearch") && caseInfo.includes("cases found")) {
      utils.showDialog(
        "Please Select a Case",
        "Cannot check expungeability from the search results page. Please click on a case and try again.",
        htmlContent
      );
    } else {
      utils.showDialog(
        "Case Record Not Recognized",
        "This page does not appear to be a case record.",
        htmlContent
      );
    }
    window.__suppressErrorHandlerTwice = true;
    return null;
  }

  static createProcessor() {
    // First ensure all processor classes are available
    if (!this.areProcessorsAvailable()) {
      console.error("Not all processor classes are available. Make sure all scripts are loaded.");
      return null;
    }
    
    let caseId, caseTypeDescription;
    try {
      ({ caseId, caseTypeDescription } = utils.extractCaseInfo());
      console.log(`Case Description: ${caseTypeDescription}`);
    } catch (error) {
      utils.showDialog(
        "Case Record Not Recognized",
        "This page does not appear to be a case record."
      );
      window.__suppressErrorHandlerTwice = true;
      return null;
    }

    // Find matching processor type in PROCESSOR_MAP lookup table
    const matchingType = Object.keys(this.PROCESSOR_MAP).find(type => caseId.includes(type));
    if (matchingType && this.PROCESSOR_MAP[matchingType]) {
      return new (this.PROCESSOR_MAP[matchingType])();
    } else {
      // Try again by looking up caseTypeDescription in DESCRIPTION_TYPE_MAP
      const matchingDescription = Object.keys(this.DESCRIPTION_TYPE_MAP).find(description => caseTypeDescription.includes(description));
      if (matchingDescription) {
        const processorTypes = this.DESCRIPTION_TYPE_MAP[matchingDescription];
        const processorType = processorTypes[0];
        if (processorType in this.PROCESSOR_MAP && this.PROCESSOR_MAP[processorType]) {
          return new (this.PROCESSOR_MAP[processorType])();
        }
      }
    }

    // Handle invalid/unsupported case types
    const formElement = document.querySelector("form");
    const caseInfoElement = $(".iceDatTbl,.data:first > tbody > tr > td").first();
    return this.handleInvalidCase(formElement, caseInfoElement);
  }

  // Add to CaseProcessorFactory class
  static createProcessorFromHTML(htmlContent) {
    // First ensure all processor classes are available
    if (!this.areProcessorsAvailable()) {
      console.error("Not all processor classes are available. Make sure all scripts are loaded.");
      return null;
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Extract case info from the HTML content
    let caseId, caseTypeDescription;
    try {
        const caseInfoElement = $(tempDiv).find(".iceDatTbl,.data:first > tbody > tr > td").first();
        if (!caseInfoElement.length) {
            console.log('No case info element found in HTML');
            return null;
        }


        const caseInfo = caseInfoElement.text();
        caseId = caseInfo.slice(9, 24).trim().split(" ")[0];
        caseTypeDescription = caseInfo.slice(caseInfo.indexOf("Type:") + 5).trim();

        // Find matching processor type
        const matchingType = Object.keys(this.PROCESSOR_MAP).find(type => caseId.includes(type));
        if (matchingType) {
          console.log('Found matching processor type:', matchingType);
          const processor = new this.PROCESSOR_MAP[matchingType]();
          processor.setHTMLContent(tempDiv); // Changed to pass tempDiv instead of original HTML
          return processor;
      }
        
        // Try again with case type description if no match found
        const matchingDescription = Object.keys(this.DESCRIPTION_TYPE_MAP)
            .find(description => caseTypeDescription.includes(description));
        if (matchingDescription) {
            const processorTypes = this.DESCRIPTION_TYPE_MAP[matchingDescription];
            const processorType = processorTypes[0];
            if (processorType in this.PROCESSOR_MAP) {
                const processor = new this.PROCESSOR_MAP[processorType]();
                processor.setHTMLContent(tempDiv);
                return processor;
            }
        }
    } catch (error) {
        console.error("Error creating processor from HTML:", error);
        return null;
    }

    return null;
  }
}

////////////////////////////////////////////////////////////////////////////////

// Main processing function - no retries
async function processAllCases() {
  try {
    // Log processor availability (for debugging)
    const requiredProcessors = [
      'CPCCaseProcessor', 'PCCaseProcessor', 'FFCCaseProcessor',
      'DTCCaseProcessor', 'DCWCaseProcessor', 'DCCCaseProcessor',
      'DTACaseProcessor', 'DTICaseProcessor', 'ARCaseProcessor'
    ];
    
    // Log which processors are actually available
    const availableProcessors = requiredProcessors.filter(name => typeof window[name] === 'function');
    console.log(`Available processors: ${availableProcessors.length}/${requiredProcessors.length}`);
    
    // Check processor availability - continue even if some are missing
    const processorCheck = CaseProcessorFactory.areProcessorsAvailable();
    console.log("Processor availability check:", processorCheck);
    if (!processorCheck) {
      console.warn("Not all processors are available, but continuing anyway");
    }
    
    // Get cases and create processor
    const cases = await getCases();
    console.log("Cases obtained:", cases);

    console.log("Creating processor");
    const processor = CaseProcessorFactory.createProcessor();
    
    if (processor) {
      console.log("Processor created successfully, processing case");
      await processor.process();
      console.log("Case processed successfully");
    } else {
      console.error("Could not create a processor for this case.");
    }
  } catch (error) {
    console.error("Failed to process cases:", error);
    console.error(error.stack); // Log the full stack trace
  }
}

// Synchronous initialization - no timeouts or async checks
console.log("Unified_cases.js loaded - initializing synchronously");

// Initialize the CourtKokua object immediately
window.CourtKokua = window.CourtKokua || {};

// Export the initialize function immediately
window.CourtKokua.initialize = function() {
  console.log("CourtKokua.initialize called");
  // Any initialization code can go here
  return {
    processAllCases: processAllCases,
    areProcessorsReady: CaseProcessorFactory.areProcessorsAvailable.bind(CaseProcessorFactory)
  };
};

// Make sure CaseProcessorFactory is globally available
window.CaseProcessorFactory = CaseProcessorFactory;
console.log("CaseProcessorFactory explicitly registered to window");

// Log processor availability for debugging
console.log("Processor availability check:");
console.log("Base CaseProcessor available:", typeof window.CaseProcessor === 'function');
console.log("CPCCaseProcessor available:", typeof window.CPCCaseProcessor === 'function');
console.log("CaseProcessorFactory available:", typeof window.CaseProcessorFactory === 'function');

// Processors will be checked directly in expungeable.js when needed
console.log("Unified_cases.js initialization complete");