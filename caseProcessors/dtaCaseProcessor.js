// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class DTACaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];
      const violationsTable = $(context).find("table.iceDatTbl.data:contains('Violation')").eq(
        0
      );
  
      violationsTable.find("tr:gt(0)").each((index, row) => {
        const $cells = $(row).find("td");
        if ($cells.length >= 11) {
          const charge = {
            count: this.safeText($cells.eq(0)),
            severity: "Misdemeanor",
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
  
    // async getAdditionalFactors() {
    //   // Add any case-type specific details here
    //   const docket = await this.getDTADocket();
    //   // Temporary code to return docket for inspection
    //   //return { docket };\
    //   const dismissedOnOralMotionData = this.checkDismissedOnOralMotion(docket)
    //   const dismissedOnOralMotion = dismissedOnOralMotionData.dismissalFound;
    //   const dismissalDate = dismissedOnOralMotionData.dismissalDate;
    //   return { dismissedOnOralMotion, dismissalDate };
    //   //return {};
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
      return {
        specificInfo: "This is specific to DTA cases",
      };
    }
  
    async getDTADocket() {
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
  
    checkDismissedOnOralMotion(docket) {
      // Find the record with docket text "Motion to Dismiss" and "orally entered by the state-plea"
      let motionToDismissRecord = null;
      let orderGrantingMotionRecord = null;
  
      motionToDismissRecord = docket.find(
        (record) =>
          record.docket.text.includes("Motion to Dismiss") &&
          record.docket.text.includes("orally entered by the state-plea")
      );
  
      // Find the record with docket text "Oral Order Motion Granted"
      orderGrantingMotionRecord = docket.find(
        (record) =>
          record.docket.text.includes("Oral Order Motion Granted")
      );
      // Print text of record with order granting motion
      console.log(`Order granting motion record: ${JSON.stringify(orderGrantingMotionRecord)}`);
  
      // Check if orderGrantingMotionRecord.docketNumber > motionToDismissRecord.docketNumber
      // (These are strings and need to be compared as numbers)
      const dismissalFound = (
          motionToDismissRecord &&
          orderGrantingMotionRecord &&
          parseInt(orderGrantingMotionRecord.docketNumber) >
            parseInt(motionToDismissRecord.docketNumber)
        );
      const dismissalDate = dismissalFound ? orderGrantingMotionRecord.date : null;
  
      return { dismissalFound, dismissalDate };
  
      // return (
      //   motionToDismissRecord &&
      //   orderGrantingMotionRecord &&
      //   parseInt(orderGrantingMotionRecord.docketNumber) >
      //     parseInt(motionToDismissRecord.docketNumber)
      // );
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
window.DTACaseProcessor = DTACaseProcessor;