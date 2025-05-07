// Not needed when using manifest.json (must get sequence right!)
// import { utils } from '../utils.js';
// import { DocketService } from '../docketService.js';
// import { ExpungeabilityEvaluator } from '../expungeabilityEvaluator.js';

class CaseProcessor {
    constructor() {
      this.caseInfo = utils.extractCaseInfo();
      this.caseType = this.constructor.name.replace("CaseProcessor", "");
      this.expungeabilityColumnId = `expungeability-column-${this.caseInfo.caseId}`;
      this.docketService = new DocketService();
      this.warrantStatus = null;  // Store warrant status
      this.htmlContent = null;
      this.shouldUpdateUI = true;
    }
  
    setHTMLContent(htmlContent) {
      // console.log('Setting HTML content in processor');
      this.htmlContent = htmlContent;
      this.shouldUpdateUI = false;
      this.caseInfo = utils.extractCaseInfo(htmlContent);
      this.expungeabilityColumnId = `expungeability-column-${this.caseInfo.caseId}`;
      this.docketService.setHTMLContext(htmlContent);
  }
  
    async collectCaseDetails() {
      let charges = await this.getCharges();
      for (let charge of charges) {
        // const deferralPeriod = ExpungeabilityEvaluator.hasDeferralPeriodExpired(charge, this.caseInfo.filingDate);
        const statuteOfLimitations =
          ExpungeabilityEvaluator.hasStatuteOfLimitationsExpired(
            charge,
            this.caseInfo.filingDate,
            this.caseType
          );
        charge.severity = utils.normalizeSeverity(charge, this.caseType);
        charge.statuteOfLimitationsPeriod =
          statuteOfLimitations.period != "Unlimited"
            ? `${statuteOfLimitations.period} year(s)`
            : statuteOfLimitations.period;
        charge.statuteOfLimitationsExpiryDate = statuteOfLimitations.expiryDate;
        charge.statuteOfLimitationsCertainty = statuteOfLimitations.certainty;
        charge.statuteOfLimitationsStatus = statuteOfLimitations.status;
      }
  
      // Extract party information
      const parties = this.extractParties();
      
      const additionalFactors = await this.getAdditionalFactors();
      let caseDetails = {
        caseType: this.caseType,
        caseId: this.caseInfo.caseId,
        courtLocation: this.caseInfo.courtLocation,
        courtCircuit: this.caseInfo.courtCircuit,
        filingDate: this.caseInfo.filingDate,
        defendantName: this.caseInfo.defendantName,
        charges: charges,
        parties: parties, // Add parties to case details
        additionalFactors: additionalFactors,
        warrantStatus: additionalFactors.warrantDetails, // New field for warrant information
        ...this.getAdditionalDetails(),
      };
      for (let charge of caseDetails.charges) {
        // Evaluate expungeability for each charge
        charge.isExpungeable = ExpungeabilityEvaluator.isChargeExpungeable(
          charge,
          this.caseType,
          this.caseInfo.filingDate,
          additionalFactors
        );
  
        // If dispositions are all empty but additionalFactors?.dismissedOnOralMotion,
        // set all dispositions to "Dismissed on State's oral motion"
        if (
          charge.dispositions.every((disposition) => !disposition) &&
          additionalFactors?.dismissedOnOralMotion
        ) {
          charge.dispositions = Array(charge.dispositions.length).fill(
            "Dismissed on State's oral motion"
          );
          
          if (additionalFactors?.dismissalDate) {
            charge.dispositionDates = Array(charge.dispositionDates.length).fill(
              additionalFactors.dismissalDate
            );
          }
        }
  
        // Set deferral period expiry date if applicable
        charge.deferralPeriodExpiryDate = charge.isExpungeable
          ?.deferralPeriodExpiryDate
          ? charge.isExpungeable.deferralPeriodExpiryDate
          : null;
      }
      for (let charge of caseDetails.charges) {
        // Set Statute of Limitations status if disposition is not a final judgment, not a deferred acceptance disposition, and not a commitment/remand
        if (charge?.dispositions && charge.dispositions.length > 0) {
          if (
            charge.isExpungeable.finalJudgment ||
            charge.dispositions[charge.dispositions.length - 1].includes(
              "Defer"
            ) ||
            charge.dispositions[charge.dispositions.length - 1].includes(
              "Commit"
            ) ||
            charge.dispositions[charge.dispositions.length - 1].includes("Remand")
          ) {
            charge.statuteOfLimitationsStatus = "N/A";
          }
        }
      }
      return caseDetails;
    }
  
    getAdditionalDetails() {
      return {};
    }
  
    isExpungeabilityAdded() {
      return $(`#${this.expungeabilityColumnId}`).length > 0;
    }
  
    markExpungeabilityAdded() {
      $("body").append(
        `<div id="${this.expungeabilityColumnId}" style="display:none;"></div>`
      );
    }
  
    removeExistingExpungeabilityColumn() {
      $(`#${this.expungeabilityColumnId}`).remove();
      $('th:contains("Expungeability")').remove();
      $('th:contains("Status")').remove();
      $("td[data-expungeability]").remove();
      $("span[data-expungeability]").remove();
    }
  
    async process() {
      const caseDetails = await this.collectCaseDetails();
      this.warrantStatus = caseDetails.warrantStatus;  // Store warrant status
  
      const overallExpungeability =
        ExpungeabilityEvaluator.determineOverallExpungeability(
          caseDetails.charges
        );
  
      // Retrieve the existing override status if the case already exists
      let existingOverride = false; // Override expungement determination
      let existingOverrideWarrant = false; // Override warrant status
      await new Promise((resolve) => {
          chrome.storage.local.get('cases', function(result) {
              const existingCase = result.cases?.find(c => c.CaseNumber === caseDetails.caseId);
              if (existingCase) {
                  existingOverride = existingCase.Override || false;
                  existingOverrideWarrant = existingCase.OverrideWarrant || false;
              }
              resolve();
          });
      });
  
      // console.log(`caseDetails before saving to Chrome local storage:`);
      // console.log(caseDetails);
  
      saveToChromeLocalStorage(
        this.caseInfo.caseId,
        this.caseInfo.caseName,
        overallExpungeability.status,
        this.caseInfo.courtLocation,
        this.caseInfo.filingDate,
        this.caseInfo.defendantName,
        {
          ...caseDetails,
          overallExpungeability,
        },
        existingOverride,
        existingOverrideWarrant
      );
  
      console.log("Saving case to storage:", {
        caseId: this.caseInfo.caseId,
        caseName: this.caseInfo.caseName,
        status: overallExpungeability.status,
        override: existingOverride,
        overrideWarrant: existingOverrideWarrant
      });
      
  
      // Only update UI if triggered from case record page (not from search page)
      // if (this.shouldUpdateUI) {
      //   this.updateUI(caseDetails.charges, overallExpungeability.status, caseDetails.warrantStatus);
      // }
  
      if (this.isExpungeabilityAdded()) {
        console.log(
          "Information already added. Not adding column."
        );
        return;
      }
      this.markExpungeabilityAdded();
    }
  
    async getCharges() {
      const context = this.htmlContent || document;
      throw new Error("getCharges method must be implemented by subclasses");
    }
  
    async getAdditionalFactors() {
      const entries = await this.docketService.getDocketEntries();
      
      // Get warrant status
      const warrantStatus = await this.docketService.analyzeWarrantStatus(entries);
      
      // Get case-type specific factors
      const typeSpecificFactors = await this.getTypeSpecificFactors();
      
      return {
          warrantDetails: warrantStatus,
          hasOutstandingWarrant: warrantStatus.hasOutstandingWarrant,
          ...typeSpecificFactors
      };
    }
  
  // New method for case-type specific factors
  async getTypeSpecificFactors() {
      return {};  // Override in specific processors
  }
  
  /**
   * Extracts party information from the party table if it exists on the page
   * @returns {Array} Array of party objects with name, id, and role
   */
  extractParties() {
      const context = this.htmlContent || document;
      const parties = [];
      
      // Find the party table by its ID pattern - using a partial match since the exact ID may vary
      const partyTable = context.querySelector('table[id*="searchResultsPtyTable"]');
      
      if (!partyTable) {
          console.log("Party table not found on this page");
          return parties;
      }
      
      // Get all rows except the header row
      const rows = partyTable.querySelectorAll('tbody tr');
      
      // Process each row to extract party information
      rows.forEach(row => {
          // Type (role) is in the 4th column (0-indexed)
          const roleCell = row.querySelector('td:nth-child(4)');
          // ID is in the 5th column
          const idCell = row.querySelector('td:nth-child(5)');
          // Name is in the 6th column
          const nameCell = row.querySelector('td:nth-child(6)');
          
          if (roleCell && idCell && nameCell) {
              const role = roleCell.textContent.trim();
              // Extract ID from anchor tag or use text content
              const idLink = idCell.querySelector('a');
              const id = idLink ? idLink.textContent.trim() : idCell.textContent.trim();
              const name = nameCell.textContent.trim();
              
              // Only add if we have all required information
              if (role && id && name) {
                  parties.push({
                      name,
                      id,
                      role
                  });
              }
          }
      });
      
      console.log(`Found ${parties.length} parties in the party table`, parties);
      return parties;
  }
  
    updateUI(charges, overallExpungeabilityStatus) {
      if (!this.shouldUpdateUI) {
        return; // Skip UI updates when analyzing from HTML content
      }
  
      throw new Error("updateUI method must be implemented by subclasses");
    }
  
    // Normal bootstrap tooltips (not enough room for content)
    initTooltips() {
      if (
        typeof bootstrap !== "undefined" &&
        typeof bootstrap.Tooltip === "function"
      ) {
        const tooltipTriggerList = [].slice.call(
          document.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.map(
          (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
        );
      } else {
        console.warn(
          "Bootstrap Tooltip not available. Tooltips will not be initialized."
        );
      }
    }
  }

// Expose the base class to the global window object
window.CaseProcessor = CaseProcessor;