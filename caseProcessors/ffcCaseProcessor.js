// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class FFCCaseProcessor extends CaseProcessor {
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
  
              const charge = {
                count: $cells.eq(0).text().trim(),
                statute: statuteWithDescription[0] || "",
                charge: statuteWithDescription[1] || "",
                severity: detailsParts[1].replace("Severity:", "").trim(),
                offenseDate: (detailsParts[2] || "")
                  .replace("Ofs Dt :", "")
                  .trim(),
                citationArrestNumbers: (detailsParts[3] || "")
                  .replace("Citation/Arrest #:", "")
                  .trim(),
                plea: $cells.eq(2).text().trim(),
                dispositions: [disposition],
                dispositionDates: [dispositionDate],
                sentencing: $cells.eq(4).text().trim(),
                offenseNotes: $cells.eq(5).text().trim(),
                isExpungeable: false,
              };
              charges.push(charge);
            }
          });
        }
      );
      return charges;
    }
  
    checkNolleProsequi(docket) {
      return docket.some((record) => {
        const docketTextLower = record.docket.text.toLowerCase();
        return (
          docketTextLower.includes(
            "ord/nolle-prosequimotion for nolle prosequi with prejudice"
          ) && !docketTextLower.includes("den")
        );
      });
    }
  
    checkdeferredAcceptance(docket) {
      return docket.some((record) => {
        const docketTextLower = record.docket.text.toLowerCase();
        return docketTextLower.includes(
          "order granting motion for deferred acceptance of"
        );
      });
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
        specificInfo: "This is specific to FFC cases",
      };
    }
  
    async getPCDocket() {
      const docketTable = $("tbody")
        .filter(function () {
          return (
            $(this)
              .find("tr:first th")
              .filter(function () {
                return $(this).text().trim() === "Docket";
              }).length > 0
          );
        })
        .first();
  
      const courtRecords = [];
  
      docketTable.find("tr:not(:first-child)").each((index, row) => {
        const cells = $(row).find("td");
        const record = {
          docketNumber: $(cells[0]).text().trim(),
          date: $(cells[1]).text().trim(),
          defendant: $(cells[3]).text().trim(),
          party: $(cells[4]).text().trim(),
          docket: {
            text: $(cells[2]).text().trim(),
            documentLinks: [],
          },
        };
  
        $(cells[2])
          .find("img")
          .each((index, link) => {
            const onclickAttr = $(link).attr("onclick");
            const docMatch = onclickAttr.match(
              /documentSelection\('([^']+)', '([^']+)'/
            );
            if (docMatch) {
              record.docket.documentLinks.push({
                documentId: docMatch[1],
                documentType: docMatch[2],
                src: $(link).attr("src"),
              });
            }
          });
  
        courtRecords.push(record);
      });
      return courtRecords;
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
window.FFCCaseProcessor = FFCCaseProcessor;