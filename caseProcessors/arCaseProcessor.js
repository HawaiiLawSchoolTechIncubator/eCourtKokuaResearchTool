// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class ARCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];
      const violationsTable = $(context).find("table.iceDatTbl.data:contains('Violation')").eq(
        0
      );
  
      violationsTable.find("tr:gt(1)").each((index, row) => {
        const $cells = $(row).find("td");
        if ($cells.length >= 11) {
          const charge = {
            count: this.safeText($cells.eq(0)),
            severity: "Violation",
            statute: this.safeText($cells.eq(1)),
            charge: this.safeText($cells.eq(2)),
            offenseDate: this.safeText($cells.eq(3)),
            specialCourtsEligibility: this.safeText($cells.eq(4)),
            dispositionCode: this.safeText($cells.eq(5)),
            dispositions: [this.safeText($cells.eq(6))],
            dispositionDates: [this.safeText($cells.eq(7))],
            sentenceCode: this.safeText($cells.eq(8)),
            sentenceDescription: this.safeText($cells.eq(9)),
            sentenceLength: this.safeText($cells.eq(10)),
            isExpungeable: false,
          };
          charges.push(charge);
        }
      });
  
      return charges;
    }
  
    safeText($element) {
      return $element && $element.text() ? $element.text().trim() : "";
    }
  
    async getAdditionalFactors() {
      return {};
    }
  
    updateUI(charges, overallExpungeabilityStatus) {
      this.removeExistingExpungeabilityColumn();
  
      const violationsTable = $("table.iceDatTbl.data:contains('Violation')").eq(
        0
      );
      if (violationsTable.length === 0) {
        console.warn("Violations table not found for UI update");
        return;
      }
  
      violationsTable
        .find("tr:eq(0)")
        .append('<th rowspan="2">Expungeability</th>');
  
      let currentRow = 2;
      charges.forEach((charge, index) => {
        const $firstChargeRow = violationsTable.find(`tr:eq(${currentRow})`);
        if ($firstChargeRow.length > 0) {
          const chargeRowspan = $firstChargeRow.find("td:first").attr("rowspan");
          const rowspan = chargeRowspan ? parseInt(chargeRowspan) : 1;
  
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
  
          $firstChargeRow.append(
            utils.createTooltipCell(
              text,
              bgColor,
              charge.isExpungeable.explanation,
              `rowspan="${rowspan}"`
            )
          );
  
          currentRow += rowspan;
        } else {
          console.warn(`Row for charge ${index + 1} not found`);
        }
      });
  
      // Initialize tooltips
      this.initTooltips();
    }
  }

// Expose the class to the global window object
window.ARCaseProcessor = ARCaseProcessor;