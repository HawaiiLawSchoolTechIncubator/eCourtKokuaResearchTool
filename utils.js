// Utility functions
const utils = {
    formatName(name) {
      // Format a name string to capitalize the first letter of each word,
      // with special handling for Mc/Mac prefixes and single-letter names.
  
      // Add a period after any single-letter name part not already ending in a period
      name = name.replace(/\b([A-Za-z])\b(?!\.)/g, "$1.");
      name = name.replace(/,? et al\.?/i, "");
  
      // Defer to capitalization if first character is uppercase and second is lowercase
      if (/^[A-Z][a-z]/.test(name)) {
        return name;
      }
  
      // Helper function to capitalize a single word
      const capitalizeWord = (word) => {
        if (word.length === 0) return "";
        return word[0].toUpperCase() + word.slice(1).toLowerCase();
      };
  
      // Helper function to handle Mc/Mac prefixes
      const handleMcMac = (word) => {
        if (word.length <= 2) return capitalizeWord(word);
        const lowerWord = word.toLowerCase();
        if (lowerWord.startsWith("mc") && word.length > 2) {
          return "Mc" + word[2].toUpperCase() + word.slice(3).toLowerCase();
        }
        if (lowerWord.startsWith("mac") && word.length > 3) {
          return "Mac" + word[3].toUpperCase() + word.slice(4).toLowerCase();
        }
        return capitalizeWord(word);
      };
  
      // Remove a trailing "Etc" or "Etc." from the name
      name = name.replace(/\s+etc\.?$/i, "");
  
      // Split the name into parts (by space and hyphen)
      const parts = name.split(/[\s-]+/);
  
      // Process each part
      const processedParts = parts.map((part) => {
        // Split by apostrophe and process each subpart
        const subParts = part.split("'");
        const processedSubParts = subParts.map(handleMcMac);
        return processedSubParts.join("'");
      });
  
      // Join the processed parts, preserving original separators
      let result = "";
      let partIndex = 0;
      for (let i = 0; i < name.length; i++) {
        if (name[i] === " " || name[i] === "-") {
          result += name[i];
        } else if (partIndex < processedParts.length) {
          result += processedParts[partIndex];
          partIndex++;
          // Skip to the end of this part in the original name
          while (i < name.length && name[i] !== " " && name[i] !== "-") {
            i++;
          }
          i--; // Adjust for the loop's increment
        }
      }
  
      return result;
    },
  
    processCaseName: function (caseName) {
      // Finish processing case name (previously unimportant so existing caseName is rough...)
      // Original logic: caseName = caseInfo.slice(27, caseInfo.indexOf("Type:"))
      caseName = caseName.slice(0, caseName.indexOf("Type:"));
      caseName = caseName.split(" -NON JURY-")[0];
      caseName = caseName.split(" -JURY-")[0];
      caseName = caseName.split(" - ")[1] || caseName.split(" -")[1];
      return caseName.trim();
    },
  
    extractCaseInfo: function (htmlContent = null) {
      const context = htmlContent || document;
      /**
       * Extracts case information from the provided HTML document.
       *
       * @returns {Object} An object containing the extracted case information.
       * @property {string} caseId - The ID of the case.
       * @property {string} caseName - The name of the case.
       * @property {string} caseTypeDescription - The description of the case type, e.g., 'TC - Traffic Crime'.
       * @property {string} courtLocation - The location of the court.
       * @property {string} courtCircuit - The case's Hawaii circuit.
       * @property {string} filingDate - The filing date of the case.
       * @property {string} defendantName - The name of the defendant.
       */
  
      // Extract the case ID and the defendant's name
        const caseInfoElement = $(context).find(
          ".iceDatTbl,.data:first > tbody > tr > td"
        ).first();
      const caseInfo = caseInfoElement.text();
      const caseId = caseInfo.slice(9, 24).trim().split(" ")[0];
      const caseName = utils.processCaseName(caseInfo);
      
      let caseTypeDescription = caseInfoElement.html().slice(caseInfoElement.html().indexOf("Type:"));
      caseTypeDescription = caseTypeDescription.slice(5, caseTypeDescription.length - 1);
      caseTypeDescription = caseTypeDescription.replace("</b>", "");
      caseTypeDescription = caseTypeDescription.slice(0, caseTypeDescription.indexOf("<br>")).trim();
  
      let defendantName = null;
      // console.log(`caseInfo: '${caseInfo}'`);
      let match = caseInfo.match(
        /Case ID:\s+(.*?)\s+-\s+State (of Hawaii )?vs?\.?\s+(.*)/i
      );
      let secondary_match = caseInfo.match(/ vs?\.?\s+(.*)/i);
      if (match && match[3]) {
        defendantName = match[3].trim().split("Type:")[0];
      } else if (secondary_match && secondary_match[1]) {
        defendantName = secondary_match[1].trim().split("Type:")[0];
      } else {
        console.log("Defendant Name not found");
      }
      // console.log(`Defendant Name as found: '${defendantName}'`);
      if (defendantName) {
        defendantName = defendantName.split(" -NON JURY-")[0];
        defendantName = defendantName.split(" -JURY-")[0];
        defendantName = utils.formatName(defendantName);
        // console.log(`Defendant Name formatted: '${defendantName}'`);
      }
  
      // Extract the court location and filing date
      const locationElement = context.querySelector(
        ".iceDatTbl.data > tbody > tr > td:nth-child(2)"
      );
      if (!locationElement) {
        // console.log("locationElement not found");
        return;
      }
      // console.log("locationElement:", locationElement);
  
      const locationText = locationElement.innerHTML;
      const locationMatch = locationText.match(/<b>Location: <\/b>([^<]*)/);
      const courtLocation = locationMatch
        ? locationMatch[1].trim()
        : "Location not found";
      // console.log("courtLocation:", courtLocation);
  
      const filingDateMatch = locationText.match(/<b>Filing Date: <\/b>([^<]*)/);
      const filingDate = filingDateMatch
        ? filingDateMatch[1].trim()
        : "Filing Date not found";
      // console.log("filingDate:", filingDate);
  
      // Extract the court circuit (the first character of the case ID if a digit)
      // and convert to ordinal number (e.g., "1" to "First")
      const digitToOrdinal = {
        "1": "first",
        "2": "second",
        "3": "third",
        "4": "fourth", // Not used in Hawaii
        "5": "fifth",
      };
      const courtCircuit = digitToOrdinal[caseId[0]] || "Unknown";
  
      return { caseId, caseName, caseTypeDescription, courtLocation, courtCircuit, filingDate, defendantName, caseTypeDescription };
    },
    // Function to create and show the dialog
    showDialog(title, message, htmlContent = null) {
      /**
       * Displays a dialog box with the specified title and message.
       *
       * @param {string} title - The title of the dialog.
       * @param {string} message - The message to be displayed in the dialog.
       * @returns {void}
       */
  
      // Create dialog elements
      const context = htmlContent ? $(htmlContent)[0] : document;
      const body = context.querySelector('body') || document.body;
    
      // Create dialog elements
      const dialog = document.createElement("div");
      dialog.className = "dialog-overlay";
    
      const dialogContent = document.createElement("div");
      dialogContent.className = "dialog-content";
    
      const dialogTitle = document.createElement("h2");
      dialogTitle.textContent = title;
    
      const dialogMessage = document.createElement("p");
      dialogMessage.textContent = message;
    
      const closeButton = document.createElement("button");
      closeButton.textContent = "Close";
      closeButton.onclick = () => {
        body.removeChild(dialog);
      };
    
      // Assemble dialog
      dialogContent.appendChild(dialogTitle);
      dialogContent.appendChild(dialogMessage);
      dialogContent.appendChild(closeButton);
      dialog.appendChild(dialogContent);
    
      // Add dialog to body
      body.appendChild(dialog);
    
      // Force a reflow to ensure the dialog is rendered
      void dialog.offsetWidth;
    
      // Add a class to trigger any CSS transitions
      dialog.classList.add("visible");
    },
    normalizeSeverity(chargeObject, caseType = "") {
      // Return a normalized severity string based on the charge object and case type.
  
      let severity = chargeObject?.severity;
      if (severity) {
        severity = severity.toLowerCase();
      } else {
        severity = "";
      }
      const charge = chargeObject.charge.toLowerCase();
      const statute = chargeObject.statute;
  
      let normalizedSeverity = severity;
      if (
        severity.includes("§701-108(1) felony") ||
        chargeObject.charge.toLowerCase().includes("murder")
      ) {
        normalizedSeverity = "§701-108(1) Felony";
      } else if (
        charge.toLowerCase().includes("sexual assault1") ||
        charge.toLowerCase().includes("sexual assault2")
      ) {
        normalizedSeverity = "§701-108(1) Felony";
      } else if (statute.includes("707-733.6")) {
        normalizedSeverity = "§707-733.6 Felony";
      } else if (
        (charge.includes("manslaughter") || severity === "§701-108(2) felony") &&
        !charge.toLowerCase().includes("vehic")
      ) {
        normalizedSeverity = "§701-108(2) Felony";
      } else if (
        severity.includes("pm") ||
        severity.includes("petty misdemeanor")
      ) {
        normalizedSeverity = "Petty Misdemeanor";
      } else if (severity.includes("md") || severity.includes("misdemeanor")) {
        normalizedSeverity = "Misdemeanor";
      } else if (
        ["fa -", "class a", "felony a"].some((s) => severity.includes(s)) ||
        severity === "fa"
      ) {
        normalizedSeverity = "Felony A";
      } else if (
        ["fb -", "class b", "felony b"].some((s) => severity.includes(s)) ||
        severity === "fb"
      ) {
        normalizedSeverity = "Felony B";
      } else if (
        ["fc -", "class c", "felony c"].some((s) => severity.includes(s)) ||
        severity === "fc"
      ) {
        normalizedSeverity = "Felony C";
      } else if (
        severity === "vl"
      ) {
        normalizedSeverity = "violation";
      } else if (caseType) {
        if (caseType == "DTI") {
          normalizedSeverity = "violation";
        } else if (caseType == "DTA" || caseType == "DTC") {
          normalizedSeverity = "misdemeanor";
        } else {
          normalizedSeverity = "unknown";
        }
      } else {
        normalizedSeverity = "unknown";
      }
  
      if (normalizedSeverity.includes("felony") && statute.includes("HRS 708")) {
        normalizedSeverity = "§708 fraud felony";
      }
      return normalizedSeverity;
    },
    createTooltipCell(text, bgColor, explanation, additionalAttributes = "") {
      // Create a table cell with tooltip attributes for displaying expungeability information.
      return `<td align="LEFT" style="vertical-align: top; background-color: ${bgColor};" data-expungeability ${additionalAttributes} data-bs-toggle="tooltip" data-bs-placement="top" title="${explanation}">${text}</td>`;
    },
  };