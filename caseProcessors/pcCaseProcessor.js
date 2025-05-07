// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class PCCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];
      $(context).find("table.iceDatTbl.data:contains('Offense Details')").each(
        (index, table) => {
          const $rows = $(table).find("tr");
          $rows.each((rowIndex, row) => {
            if (rowIndex === 0) return; // Skip header row
  
            const $cells = $(row).find("td");
            if ($cells.length >= 6) {
              const offenseDetailsHTML = $cells.eq(1).html();
              const detailsParts = offenseDetailsHTML.split("<br>");
              let statuteWithDescription = detailsParts;
              if (detailsParts.length > 1) {
                statuteWithDescription = detailsParts[0].split(" - ");
              }
  
              const dispositionWithDate = $cells.eq(3).text().trim();
              const dispositionParts = dispositionWithDate.split("-");
              const disposition = dispositionParts[0].trim();
              const dispositionDate = dispositionParts[1]
                ? dispositionParts[1].trim()
                : "";
  
              // count, statute, charge, severity, plea, sentencing, and offenseNotes have fixed locations
              let temp_count = $cells.eq(0).text().trim();
              let temp_statute = statuteWithDescription[0] || "";
              let temp_charge = statuteWithDescription[1] || "";
              let temp_severity = detailsParts[1] || "";
              let temp_plea = $cells.eq(2).text().trim();
              let temp_sentencing = $cells.eq(4).html();
              let temp_offenseNotes = $cells.eq(5).text().trim();
              
              // citationArrestNumbers will be detailsParts[3] if offenseDate
              // is present, and will otherwise be detailsParts[2] and OTN # will
              // be detailsParts[3]
              let temp_citationArrestNumbers = "";
              let temp_otnNumbers = "";
              let temp_offenseDate = "";
  
              if (detailsParts[2].includes("Citation/Arrest #:")) {
                temp_citationArrestNumbers = detailsParts[2].replace("Citation/Arrest #:", "").trim();
                if (detailsParts[3].includes("OTN #:")) {
                  temp_otnNumbers = detailsParts[3].replace("OTN #:", "").trim();
                }
              } else {
                temp_citationArrestNumbers = detailsParts[3].replace("Citation/Arrest #:", "").trim();
                temp_offenseDate = detailsParts[2].replace("Ofs Dt :", "").trim();
              }
  
              const charge = {
                count: temp_count,
                statute: temp_statute,
                charge: temp_charge,
                severity: temp_severity,
                offenseDate: temp_offenseDate,
                citationArrestNumbers: temp_citationArrestNumbers,
                otnNumbers: temp_otnNumbers,
                plea: temp_plea,
                dispositions: [disposition],
                dispositionDates: [dispositionDate],
                sentencing: temp_sentencing,
                offenseNotes: temp_offenseNotes,
                isExpungeable: false,
              }
  
              charges.push(charge);
            }
          });
        }
      );
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
  
    getAdditionalDetails() {
      // Add any case-type specific details here
      return {
        // For example:
        specificInfo: "This is specific to PC cases",
      };
    }
  
  
    updateUI(charges, overallExpungeabilityStatus) {
      this.removeExistingExpungeabilityColumn();
  
      const chargesTable = $("table.iceDatTbl.data:contains('Offense Details')");
      chargesTable.find("tr:first").append("<th>Expungeability</th>");
      chargesTable.find("tr:not(:first)").each((index, row) => {
        const charge = charges[index];
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
          utils.createTooltipCell(text, bgColor, charge.isExpungeable.explanation)
        );
      });
  
      // Initialize tooltips
      this.initTooltips();
    }
  }

// Expose the class to the global window object
window.PCCaseProcessor = PCCaseProcessor;