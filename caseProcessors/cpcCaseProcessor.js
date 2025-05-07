// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class CPCCaseProcessor extends CaseProcessor {
    async getCharges() {
      const chargesTable = this.getCPCChargesTable();
      //console.log("chargesTable:", chargesTable.html());
      const offenses = [];
  
      chargesTable.find("tr:not(:first-child)").each((index, row) => {
        try {
          const cells = $(row).find("td");
          //console.log(`Processing row ${index + 1}, cells found: ${cells.length}`);
  
          if (cells.length < 6) {
            console.log(`Row ${index + 1} has insufficient cells, skipping.`);
            return;
          }
  
          const offenseDetailsHTML = $(cells[1]).html();
          //console.log(`Row ${index + 1} offense details HTML:`, offenseDetailsHTML);
  
          if (!offenseDetailsHTML) {
            console.log(`Row ${index + 1} has no offense details, skipping.`);
            return;
          }
  
          const detailsParts = offenseDetailsHTML
            .split("<br>")
            .map((part) => part.trim());
          //console.log(`Row ${index + 1} details parts:`, detailsParts);
  
          let statuteWithDescription = detailsParts;
          if (detailsParts.length > 1) {
            statuteWithDescription = detailsParts[0].split(" - ");
          }
  
          const dispositionWithDates = $(cells[3]).html().split("<br>");
          const dispositions = [];
          const dispositionDates = [];
  
          dispositionWithDates.forEach((item) => {
            const trimmedItem = item.trim();
            if (trimmedItem) {
              // Only process non-empty strings
              const parts = trimmedItem.split("-");
              if (parts.length == 2) {
                dispositions.push(parts[0].trim());
                dispositionDates.push(parts[1].trim());
              } else if (parts.length > 2) {
                dispositions.push(`${parts[0].trim()}-${parts[1].trim()}`);
                dispositionDates.push(parts[2].trim());
              } else {
                dispositions.push(parts[0].trim());
                dispositionDates.push("");
              }
            }
          });
  
          const offense = {
            count: $(cells[0]).text().trim(),
            statute: statuteWithDescription[0] || "",
            charge: statuteWithDescription[1] || "",
            severity: detailsParts[1] || "",
            offenseDate: (detailsParts[2] || "").replace("Ofs Dt :", "").trim(),
            citationArrestNumbers: (detailsParts[3] || "")
              .replace("Citation/Arrest #:", "")
              .trim(),
            plea: $(cells[2]).text().trim(),
            dispositions: dispositions,
            dispositionDates: dispositionDates,
            //sentencing: $(cells[4]).text().trim(),
            sentencing: $(cells[4]).html(),
            offenseNotes: $(cells[5]).text().trim(),
          };
  
          //console.log(`Row ${index + 1} parsed offense:`, offense);
          offenses.push(offense);
        } catch (error) {
          console.error(`Error processing row ${index + 1}:`, error);
        }
      });
  
      console.log("All parsed offenses:", offenses);
      return offenses;
    }
  
    // async getAdditionalFactors() {
    //   const docket = await this.getCPCDocket();
    //   const withPrejudice = this.checkNolleProsequi(docket);
    //   const deferredAcceptance = this.checkdeferredAcceptance(docket);
    //   return { withPrejudice, deferredAcceptance };
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
        specificInfo: "This is specific to CPC cases",
      };
    }
  
    getCPCChargesTable() {
      const context = this.htmlContent || document;
      return $(context).find("tbody")
        .filter(function () {
          return (
            $(this)
              .find("tr:first th")
              .filter(function () {
                return $(this).text().trim() === "Plea";
              }).length > 0
          );
        })
        .first();
    }
  
    // async getCPCDocket() {
    //   const docketTable = $("tbody")
    //     .filter(function () {
    //       return (
    //         $(this)
    //           .find("tr:first th")
    //           .filter(function () {
    //             return $(this).text().trim() === "Docket";
    //           }).length > 0
    //       );
    //     })
    //     .first();
  
    //   const courtRecords = [];
  
    //   docketTable.find("tr:not(:first-child)").each((index, row) => {
    //     const cells = $(row).find("td");
    //     const record = {
    //       docketNumber: $(cells[0]).text().trim(),
    //       date: $(cells[1]).text().trim(),
    //       defendant: $(cells[3]).text().trim(),
    //       party: $(cells[4]).text().trim(),
    //       docket: {
    //         text: $(cells[2]).text().trim(),
    //         documentLinks: [],
    //       },
    //     };
  
    //     $(cells[2])
    //       .find("img")
    //       .each((index, link) => {
    //         const onclickAttr = $(link).attr("onclick");
    //         const docMatch = onclickAttr.match(
    //           /documentSelection\('([^']+)', '([^']+)'/
    //         );
    //         if (docMatch) {
    //           record.docket.documentLinks.push({
    //             documentId: docMatch[1],
    //             documentType: docMatch[2],
    //             src: $(link).attr("src"),
    //           });
    //         }
    //       });
  
    //     courtRecords.push(record);
    //   });
  
    //   return courtRecords;
    // }
  
    // checkNolleProsequi(docket) {
    //   return docket.some((record) => {
    //     const docketTextLower = record.docket.text.toLowerCase();
    //     return (
    //       docketTextLower.includes(
    //         "ord/nolle-prosequimotion for nolle prosequi with prejudice"
    //       ) && !docketTextLower.includes("den")
    //     );
    //   });
    // }
  
    // checkdeferredAcceptance(docket) {
    //   return docket.some((record) => {
    //     const docketTextLower = record.docket.text.toLowerCase();
    //     return docketTextLower.includes(
    //       "order granting motion for deferred acceptance of"
    //     );
    //   });
    // }
  
    updateUI(charges, overallExpungeabilityStatus) {
      this.removeExistingExpungeabilityColumn();
  
      const chargesTable = this.getCPCChargesTable();
      //console.log('Charges table structure:', chargesTable.html());
  
      chargesTable.find("tr:first").append("<th>Expungeability</th>");
  
      // Add warrant status indicator if there's an active warrant
      if (this.warrantStatus?.hasOutstandingWarrant) {
        chargesTable.before(`
            <div class="alert alert-danger" role="alert">
                <strong>⚠️ Outstanding Warrant</strong>: ${warrantStatus.explanation}
            </div>
        `);
      }
  
      let chargeIndex = 0;
      let rowsToSkip = 0;
  
      chargesTable.find("tr:not(:first)").each((index, row) => {
        const $row = $(row);
        //console.log(`Processing row ${index + 1}:`, $row.html());
  
        if (rowsToSkip > 0) {
          //console.log(`Skipping row ${index + 1} (part of previous charge)`);
          rowsToSkip--;
          return;
        }
  
        const $firstCell = $row.find("td:first");
        const rowspan = parseInt($firstCell.attr("rowspan")) || 1;
  
        if (chargeIndex < charges.length) {
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
  
          const dispositionsText = charge.dispositions
            .map(
              (disp, i) =>
                `${disp} (${charge.dispositionDates[i] || "Date Not Found"})`
            )
            .join(", ");
  
          let tooltipText = charge.isExpungeable.explanation;
          if (charge.dispositions.length > 0) {
            tooltipText = `${tooltipText}\n\nDisposition(s): ${dispositionsText}`;
          }
  
          $row.append(
            utils.createTooltipCell(
              text,
              bgColor,
              tooltipText,
              `rowspan="${rowspan}"`
            )
          );
          //console.log(`Added expungeability cell for charge ${chargeIndex + 1} with rowspan ${rowspan}`);
  
          chargeIndex++;
          rowsToSkip = rowspan - 1;
        } else {
          console.warn(
            `More rows than charges. Row: ${index + 1}, Charges: ${
              charges.length
            }`
          );
        }
      });
  
      // console.log(
      //  `Updated UI for ${chargeIndex} charges out of ${charges.length}`
      //);
  
      // Initialize tooltips
      this.initTooltips();
    }
  }

// Expose the class to the global window object
window.CPCCaseProcessor = CPCCaseProcessor;