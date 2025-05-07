// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class DTCCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const violations = [];
      let currentViolation = null;
  
      $(context).find("table.iceDatTbl.data:contains('Violation'):contains('Disposition')")
        .eq(0)
        .find("tr")
        .each(function (index, row) {
          const cells = $(row).find("td");
          if (cells.length >= 7) {
            const violationNumber = cells.eq(0).text().trim();
            if (violationNumber) {
              if (currentViolation) {
                violations.push(currentViolation);
              }
              currentViolation = {
                count: violationNumber,
                statute: cells.eq(1).text().trim(),
                charge: cells.eq(2).text().trim(),
                offenseDate: cells.eq(3).text().trim(),
                dispositions: [cells.eq(6).text().trim()],
                dispositionDates: [cells.eq(7).text().trim()],
                isExpungeable: false,
                rowspan: parseInt(cells.eq(0).attr("rowspan")) || 1,
              };
            } else if (currentViolation) {
              currentViolation.dispositions.push(cells.eq(6).text().trim());
              currentViolation.dispositionDates.push(cells.eq(7).text().trim());
            }
          }
        });
  
      if (currentViolation) {
        violations.push(currentViolation);
      }
  
      return violations;
    }
  
    // async getTypeSpecificFactors() {
    //   const entries = await this.docketService.getDocketEntries();
    //   const dismissalStatus = await this.docketService.checkDismissalWithPrejudice(entries);
    //   const deferralStatus = await this.docketService.checkDeferredAcceptance(entries);
      
    //   return {
    //       withPrejudice: dismissalStatus.withPrejudice,
    //       deferredAcceptance: deferralStatus.deferredAcceptance
    //   };
    // }
  
    // DEBUGGING
    async getTypeSpecificFactors() {
      console.log("DTCCaseProcessor: Starting getTypeSpecificFactors");
      try {
        const entries = await this.docketService.getDocketEntries();
        console.log("DTCCaseProcessor: Got docket entries:", entries);
        
        const dismissalStatus = await this.docketService.checkDismissalWithPrejudice(entries);
        console.log("DTCCaseProcessor: Dismissal status:", dismissalStatus);
        
        const deferralStatus = await this.docketService.checkDeferredAcceptance(entries);
        console.log("DTCCaseProcessor: Deferral status:", deferralStatus);
        
        return {
          withPrejudice: dismissalStatus.withPrejudice,
          deferredAcceptance: deferralStatus.deferredAcceptance
        };
      } catch (error) {
        console.error("DTCCaseProcessor: Error in getTypeSpecificFactors:", error);
        throw error;
      }
    }
  
    // DEBUGGING (this shouldn't even normally be in this subclass)
    async getAdditionalFactors() {
      console.log("DTCCaseProcessor: Starting getAdditionalFactors");
      // Call the parent class's getAdditionalFactors
      const factors = await super.getAdditionalFactors();
      console.log("DTCCaseProcessor: Additional factors:", factors);
      return factors;
    }
  
    getAdditionalDetails() {
      // Add any case-type specific details here
      return {
        // For example:
        specificInfo: "This is specific to DTC cases",
      };
    }
  
    updateUI(charges, overallExpungeabilityStatus) {
      this.removeExistingExpungeabilityColumn();
  
      const table = $(
        "table.iceDatTbl.data:contains('Violation'):contains('Disposition')"
      ).eq(0);
  
      table.find("tr:first").append("<th align='CENTER'>Expungeability</th>");
  
      const secondHeaderRow = table.find("tr:eq(1)");
      const existingHeaderStyle = secondHeaderRow.find("th:first").attr("style");
      secondHeaderRow.append(`<th ${existingHeaderStyle}>Status</th>`);
  
      let chargeIndex = 0;
      table.find("tr:gt(1)").each((index, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 7) {
          const violationNumber = cells.eq(0).text().trim();
          if (violationNumber && chargeIndex < charges.length) {
            const charge = charges[chargeIndex];
            let bgColor, text;
  
            switch (charge.isExpungeable.status) {
              case "Expungeable":
                bgColor = "lightgreen";
                text = "Expungeable";
                break;
              case "Possibly Expungeable":
                bgColor = "darkorange";
                text = "Possibly Expungeable";
                break;
              case "Not Expungeable":
                bgColor = "lightcoral";
                text = "Not Expungeable";
                break;
              default:
                bgColor = "rgb(255, 193, 7)";
                text = charge.isExpungeable.status;
            }
  
            $(row).append(
              utils.createTooltipCell(
                text,
                bgColor,
                charge.isExpungeable.explanation,
                `rowspan="${charge.rowspan}"`
              )
            );
            chargeIndex++;
          }
        }
      });
  
      // Initialize tooltips
      this.initTooltips();
    }
  }
  
// Expose the class to the global window object
window.DTCCaseProcessor = DTCCaseProcessor;