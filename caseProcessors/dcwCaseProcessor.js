// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class DCWCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];      // First, try to get charges from the violations table if it exists
      console.log('Looking for violations table...');
      
      // Debug: Check all tables first
      const allTables = $(context).find("table.iceDatTbl.data");
      console.log(`Found ${allTables.length} tables with class 'iceDatTbl data'`);
      
      // Look for a violations table with the column-based format (like dcw_sentence_table.html)
      const violationsTable = $(context).find("table.iceDatTbl.data").filter(function() {
        const tableText = $(this).text();
        const hasViolation = tableText.includes('Violation');
        const hasColumns = $(this).find('th:contains("Code"), th:contains("Description"), th:contains("Length")').length >= 3;
        console.log(`Table with Violation: ${hasViolation}, Has sentence columns: ${hasColumns}`);
        return hasViolation && hasColumns;
      }).first();
      
      console.log(`Violations table with sentence columns found: ${violationsTable.length > 0}`);
      
      if (violationsTable.length > 0) {
        console.log('Found violations table with sentence columns, extracting charges...');
        charges.push(...this.extractChargesFromViolationsTable(violationsTable));
      }
        // If no violations table found or no charges extracted, fall back to the original method
      if (charges.length === 0) {
        console.log('No violations table found or no charges extracted, using COUNT tables method...');
        charges.push(...this.extractChargesFromCountTables(context));
      }
      
      console.log(`DCW: Extracted ${charges.length} charges total`);
      
      return charges;
    }    extractChargesFromViolationsTable(violationsTable) {
      const charges = [];
      const rows = violationsTable.find("tr:gt(1)"); // Skip header rows
      console.log(`Found ${rows.length} data rows in violations table`);
      
      let currentCharge = null;
      let expectedRowsForCurrentCharge = 0;
      let rowsProcessedForCurrentCharge = 0;
      
      rows.each((index, row) => {
        const $cells = $(row).find("td");
        console.log(`Row ${index}: ${$cells.length} cells`);
        
        if ($cells.length >= 11) {
          // Check if this is a new charge (first cell has content)
          const firstCell = $cells.eq(0);
          const isNewCharge = firstCell.text().trim() !== '';
          
          if (isNewCharge) {
            // Save previous charge if exists
            if (currentCharge) {
              charges.push(currentCharge);              console.log(`Completed charge ${currentCharge.count} with sentence: "${currentCharge.sentenceDescription}", citation: "${currentCharge.citationArrestNumbers}"`);
            }
            
            // Start new charge
            currentCharge = {
              count: this.safeText($cells.eq(0)),
              severity: "Misdemeanor", // Default for DCW cases
              statute: this.safeText($cells.eq(1)),
              charge: this.safeText($cells.eq(2)),
              offenseDate: this.safeText($cells.eq(3)),
              specialCourtsEligibility: this.safeText($cells.eq(4)),
              dispositionCode: this.safeText($cells.eq(5)),
              dispositions: [this.safeText($cells.eq(6))],
              dispositionDates: [this.safeText($cells.eq(7))],              sentenceCode: "",
              sentenceDescription: "",
              sentenceLength: "",
              citationArrestNumbers: "",
              plea: "", // Will be extracted from detail tables if available
            };
            
            expectedRowsForCurrentCharge = parseInt(firstCell.attr('rowspan')) || 1;
            rowsProcessedForCurrentCharge = 0;
            console.log(`Starting new charge ${currentCharge.count}, expecting ${expectedRowsForCurrentCharge} rows`);
          }
          
          // Collect sentence information from this row
          if (currentCharge) {
            const sentenceCode = this.safeText($cells.eq(8));
            const sentenceDescription = this.safeText($cells.eq(9));
            const sentenceLength = this.safeText($cells.eq(10));
            
            console.log(`Row sentence data: Code="${sentenceCode}", Desc="${sentenceDescription}", Length="${sentenceLength}"`);
            
            // Concatenate sentence parts with spaces
            if (sentenceCode) {
              currentCharge.sentenceCode += (currentCharge.sentenceCode ? " " : "") + sentenceCode;
            }
            if (sentenceDescription) {
              currentCharge.sentenceDescription += (currentCharge.sentenceDescription ? " " : "") + sentenceDescription;
            }
            if (sentenceLength) {
              currentCharge.sentenceLength += (currentCharge.sentenceLength ? " " : "") + sentenceLength;
            }
            
            rowsProcessedForCurrentCharge++;
          }
        }
      });
      
      // Don't forget the last charge
      if (currentCharge) {
        charges.push(currentCharge);        console.log(`Completed final charge ${currentCharge.count} with sentence: "${currentCharge.sentenceDescription}", citation: "${currentCharge.citationArrestNumbers}"`);
      }
      
      console.log(`Extracted ${charges.length} charges from violations table`);
      return charges;
    }    extractChargesFromCountTables(context) {
      const charges = [];
      console.log('Using COUNT tables method...');
      $(context).find("table.iceDatTbl.data:contains('COUNT:')").each((index, table) => {
        const $table = $(table);
        let count = $table.find("th").text().trim().replace("COUNT:", "").trim();
        let $nextTable = $table.next("table");
        
        console.log(`Found COUNT table ${index + 1} with count: ${count}`);
  
        let count_arr = count.split(" ");
        if (count_arr.length > 1) {
          count = count_arr[0];
        }        const charge = {
          count: count,
          statute: "",
          plea: "",
          dispositions: [],
          dispositionDates: [],
          sentenceCode: "",
          sentenceDescription: "",
          sentenceLength: "",
          citationArrestNumbers: "",
        };while (
          $nextTable.length &&
          !$nextTable.is("table.iceDatTbl.data:contains('COUNT:')")
        ) {
          let isCollectingDispositions = false;
          let isCollectingSentences = false;
  
          $nextTable.find("tr").each((i, row) => {
            const $cells = $(row).find("td");
            if ($cells.length >= 2) {
              const label = $cells.eq(0).text().trim();
              const value = $cells.eq(1).text().trim();
              const date = $cells.eq(2).text().trim();
  
              if ($cells.eq(1).text().includes("HRS")) {
                charge.severity = $cells.eq(0).text().trim();
                charge.statute = $cells.eq(1).text().trim();
                charge.charge = $cells.eq(2).text().trim();              } else if (value.includes("Vio Dt: ")) {
                charge.offenseDate =
                  charge.offenseDate || value.replace("Vio Dt: ", "").trim();
              } else if (value.includes("Citation/Arrest #:")) {
                charge.citationArrestNumbers = value.replace("Citation/Arrest #:", "").trim();
              } else if (label === "Plea:") {
                charge.plea = charge.plea || value;
              } else if (label === "Disposition:" || isCollectingDispositions) {
                if (value && date && !["Sentence:", "Plea:"].includes(label)) {
                  charge.dispositions.push(value);
                  charge.dispositionDates.push(date);
                  isCollectingDispositions = true;
                } else if (label === "Sentence:") {
                  isCollectingDispositions = false;
                  isCollectingSentences = true;
                  // Capture the first sentence information
                  charge.sentenceDescription = value;
                }
              } else if (label === "Sentence:" || isCollectingSentences) {
                if (label === "Sentence:") {
                  // First sentence row
                  charge.sentenceDescription = value;
                  isCollectingSentences = true;
                } else if (isCollectingSentences && value && label === "") {
                  // Additional sentence rows (no label, just value)
                  charge.sentenceDescription += (charge.sentenceDescription ? " " : "") + value;
                }
              }
            } else if ($cells.length === 1 && isCollectingDispositions) {
              // This handles cases where there's no date for a disposition
              const value = $cells.eq(0).text().trim();
              if (value) {
                charge.dispositions.push(value);
                charge.dispositionDates.push("");
              }
            } else if ($cells.length === 1 && isCollectingSentences) {
              // Additional sentence information in single cell
              const value = $cells.eq(0).text().trim();
              if (value) {
                charge.sentenceDescription += (charge.sentenceDescription ? " " : "") + value;
              }
            }
          });          $nextTable = $nextTable.next("table");
        }        console.log(`Charge ${charge.count} extracted:`, {
          statute: charge.statute,
          charge: charge.charge,
          sentenceDescription: charge.sentenceDescription,
          citationArrestNumbers: charge.citationArrestNumbers,
          dispositions: charge.dispositions
        });
        charges.push(charge);
      });

      console.log(`Extracted ${charges.length} charges from COUNT tables`);
      return charges;
    }safeText($element) {
      return $element && $element.text() ? $element.text().trim() : "";
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
    }    // Remove expungeability-related UI methods - not needed for this tool
    updateUI(charges, overallExpungeabilityStatus) {
      // This method is kept for compatibility but doesn't perform any UI updates
      // since expungeability logic is not needed for this tool
      console.log('DCW case charges processed:', charges.length);
    }
  }

// Expose the class to the global window object
window.DCWCaseProcessor = DCWCaseProcessor;