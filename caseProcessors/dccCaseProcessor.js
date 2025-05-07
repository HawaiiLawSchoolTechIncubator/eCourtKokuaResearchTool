// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class DCCCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];
      $(context).find("table.iceDatTbl.data:contains('COUNT:')").each((index, table) => {
        const $table = $(table);
        const count = $table
          .find("th")
          .text()
          .trim()
          .replace("COUNT:", "")
          .trim();
        const $nextTable = $table.next("table");
  
        const charge = {
          count: count,
          severity: $nextTable.find("tr:eq(0) td:eq(0)").text().trim(),
          statute: $nextTable.find("tr:eq(0) td:eq(1)").text().trim(),
          charge: $nextTable.find("tr:eq(0) td:eq(2)").text().trim(),
          offenseDate: $nextTable
            .find("tr:eq(1) td:eq(1)")
            .text()
            .trim()
            .replace("Vio Dt:", "")
            .trim(),
            citationArrestNumbers: this.processCitationArrestNumbers($nextTable),
          // citationArrestNumbers: $nextTable
          //   .find("tr:eq(2) td:eq(1)")
          //   .text()
          //   .trim()
          //   .replace("Citation/Arrest #:", "")
          //   .trim(),
          plea: "",
          dispositions: [],
          dispositionDates: [],
          isExpungeable: false,
        };
  
        const $dispositionTable = $nextTable.next("table");
        $dispositionTable.find("tr").each((i, row) => {
          const $cells = $(row).find("td");
          if ($cells.length >= 2) {
            const label = $cells.eq(0).text().trim();
            const value = $cells.eq(1).text().trim();
            if (label === "Plea:") {
              charge.plea = value;
            } else if (label === "Disposition:") {
              charge.dispositions.push(value);
              charge.dispositionDates.push($cells.eq(2).text().trim());
            }
          }
        });
  
        charges.push(charge);
      });
  
      return charges;
    }
  
    // async getAdditionalFactors() {
    //   // Add any DCC-specific factors here if needed
    //   return {};
    // }
    
    async getTypeSpecificFactors() {
      const entries = await this.docketService.getDocketEntries();
      const dismissalStatus = await this.docketService.checkDismissalWithPrejudice(entries);
      const deferralStatus = await this.docketService.checkDeferredAcceptance(entries);
      
      return {
          withPrejudice: dismissalStatus.withPrejudice,
          deferredAcceptance: deferralStatus.deferredAcceptance
      };
    }
  
    getAdditionalDetails() {
      // Add any case-type specific details here
      return {
        // For example:
        specificInfo: "This is specific to DCC cases",
      };
    }
  
    processCitationArrestNumbers($nextTable) {
      const cellHtml = $nextTable.find("tr:eq(2) td:eq(1)").html();
  
      if (!cellHtml) {
        return ""; // Return empty string if cell or HTML is not found
      }
  
      // Split the HTML by the first <br> tag (case-insensitive)
      const parts = cellHtml.split(/<br\s*\/?>/i);
  
      // Take the first part
      let firstPart = parts[0];
  
      // Remove any potential HTML tags from the first part and trim
      let cleanedText = firstPart.replace(/<[^>]*>/g, "").trim();
  
      // Remove the prefix and trim again
      cleanedText = cleanedText.replace("Citation/Arrest #:", "").trim();
  
      return cleanedText;
    }
  
    updateUI(charges, overallExpungeabilityStatus) {
      charges.forEach((charge, index) => {
        const $countTable = $(
          `table.iceDatTbl.data:contains('COUNT: ${charge.count}')`
        );
        const $chargeTable = $countTable.next("table");
  
        $countTable.find("span[data-expungeability]").remove();
  
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
  
        $countTable.find("th").append(`
                  <span style="float: right; background-color: ${bgColor}; padding: 2px 5px; border-radius: 3px;" 
                        data-expungeability data-bs-toggle="tooltip" data-placement="top" 
                        title="${charge.isExpungeable.explanation}">
                      ${text}
                  </span>
              `);
      });
  
      // Initialize tooltips
      this.initTooltips();
    }
  }
  
// Expose the class to the global window object
window.DCCCaseProcessor = DCCCaseProcessor;