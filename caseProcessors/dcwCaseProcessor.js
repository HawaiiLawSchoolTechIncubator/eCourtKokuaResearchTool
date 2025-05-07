// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class DCWCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];
      $(context).find("table.iceDatTbl.data:contains('COUNT:')").each((index, table) => {
        const $table = $(table);
        let count = $table.find("th").text().trim().replace("COUNT:", "").trim();
        let $nextTable = $table.next("table");
  
        let count_arr = count.split(" ");
        if (count_arr.length > 1) {
          count = count_arr[0];
        }
  
        const charge = {
          count: count,
          statute: "",
          plea: "",
          dispositions: [],
          dispositionDates: [],
        };
  
        while (
          $nextTable.length &&
          !$nextTable.is("table.iceDatTbl.data:contains('COUNT:')")
        ) {
          let isCollectingDispositions = false;
  
          $nextTable.find("tr").each((i, row) => {
            const $cells = $(row).find("td");
            if ($cells.length >= 2) {
              const label = $cells.eq(0).text().trim();
              const value = $cells.eq(1).text().trim();
              const date = $cells.eq(2).text().trim();
  
              if ($cells.eq(1).text().includes("HRS")) {
                charge.severity = $cells.eq(0).text().trim();
                charge.statute = $cells.eq(1).text().trim();
                charge.charge = $cells.eq(2).text().trim();
              } else if (value.includes("Vio Dt: ")) {
                charge.offenseDate =
                  charge.offenseDate || value.replace("Vio Dt: ", "").trim();
              } else if (label === "Plea:") {
                charge.plea = charge.plea || value;
              } else if (label === "Disposition:" || isCollectingDispositions) {
                if (value && date && !["Sentence:", "Plea:"].includes(label)) {
                  charge.dispositions.push(value);
                  charge.dispositionDates.push(date);
                  isCollectingDispositions = true;
                } else if (label === "Sentence:") {
                  isCollectingDispositions = false;
                }
              }
            } else if ($cells.length === 1 && isCollectingDispositions) {
              // This handles cases where there's no date for a disposition
              const value = $cells.eq(0).text().trim();
              if (value) {
                charge.dispositions.push(value);
                charge.dispositionDates.push("");
              }
            }
          });
  
          $nextTable = $nextTable.next("table");
        }
  
        charges.push(charge);
      });
  
      return charges;
    }
  
    async getTypeSpecificFactors() {
      const entries = await this.docketService.getDocketEntries();
      const dismissalStatus = await this.docketService.checkDismissalWithPrejudice(entries);
      const deferralStatus = await this.docketService.checkDeferredAcceptance(entries);
      
      return {
          withPrejudice: dismissalStatus.withPrejudice,
          deferredAcceptance: deferralStatus.deferredAcceptance
      };
    }
  
    // async getAdditionalFactors() {
    //   // Add any DCW-specific factors here if needed
    //   return {};
    // }
  
    getAdditionalDetails() {
      // Add any DCW-specific details here
      return {
        // For example:
        dcwSpecificInfo: "This is specific to DCW cases",
      };
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
window.DCWCaseProcessor = DCWCaseProcessor;