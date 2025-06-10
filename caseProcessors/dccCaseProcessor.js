// Not needed when using manifest.json (must get sequence right!)
// import { CaseProcessor } from "./caseProcessor.js";
// import * as utils from "../utils.js";

class DCCCaseProcessor extends CaseProcessor {
    async getCharges() {
      const context = this.htmlContent || document;
      const charges = [];
      
      // First, try to get charges from the violations table if it exists
      console.log('DCC: Looking for violations table...');
      
      // Look for a violations table with the column-based format
      const violationsTable = $(context).find("table.iceDatTbl.data").filter(function() {
        const tableText = $(this).text();
        const hasViolation = tableText.includes('Violation');
        const hasColumns = $(this).find('th:contains("Code"), th:contains("Description"), th:contains("Length")').length >= 3;
        console.log(`DCC: Table with Violation: ${hasViolation}, Has sentence columns: ${hasColumns}`);
        return hasViolation && hasColumns;
      }).first();
      
      console.log(`DCC: Violations table with sentence columns found: ${violationsTable.length > 0}`);
      
      if (violationsTable.length > 0) {
        console.log('DCC: Found violations table with sentence columns, extracting charges...');
        charges.push(...this.extractChargesFromViolationsTable(violationsTable));
      }
      
      // If no violations table found or no charges extracted, fall back to the original method
      if (charges.length === 0) {
        console.log('DCC: No violations table found or no charges extracted, using COUNT tables method...');
        charges.push(...this.extractChargesFromCountTables(context));
      }
      
      console.log(`DCC: Extracted ${charges.length} charges total`);
      return charges;
    }

    extractChargesFromViolationsTable(violationsTable) {
      const charges = [];
      const rows = violationsTable.find("tr:gt(1)"); // Skip header rows
      console.log(`DCC: Found ${rows.length} data rows in violations table`);
      
      let currentCharge = null;
      let expectedRowsForCurrentCharge = 0;
      let rowsProcessedForCurrentCharge = 0;
      
      rows.each((index, row) => {
        const $cells = $(row).find("td");
        console.log(`DCC: Row ${index}: ${$cells.length} cells`);
        
        if ($cells.length >= 11) {
          // Check if this is a new charge (first cell has content)
          const firstCell = $cells.eq(0);
          const isNewCharge = firstCell.text().trim() !== '';
          
          if (isNewCharge) {
            // Save previous charge if exists
            if (currentCharge) {
              charges.push(currentCharge);
              console.log(`DCC: Completed charge ${currentCharge.count} with sentence: "${currentCharge.sentenceDescription}", citation: "${currentCharge.citationArrestNumbers}"`);
            }
            
            // Start new charge
            currentCharge = {
              count: this.safeText($cells.eq(0)),
              severity: "Misdemeanor", // Default for DCC cases
              statute: this.safeText($cells.eq(1)),
              charge: this.safeText($cells.eq(2)),
              offenseDate: this.safeText($cells.eq(3)),
              specialCourtsEligibility: this.safeText($cells.eq(4)),
              dispositionCode: this.safeText($cells.eq(5)),
              dispositions: [this.safeText($cells.eq(6))],
              dispositionDates: [this.safeText($cells.eq(7))],
              sentenceCode: "",
              sentenceDescription: "",
              sentenceLength: "",
              citationArrestNumbers: "",
              plea: "", // Will be extracted from detail tables if available
            };
            
            expectedRowsForCurrentCharge = parseInt(firstCell.attr('rowspan')) || 1;
            rowsProcessedForCurrentCharge = 0;
            console.log(`DCC: Starting new charge ${currentCharge.count}, expecting ${expectedRowsForCurrentCharge} rows`);
          }
          
          // Collect sentence information from this row
          if (currentCharge) {
            const sentenceCode = this.safeText($cells.eq(8));
            const sentenceDescription = this.safeText($cells.eq(9));
            const sentenceLength = this.safeText($cells.eq(10));
            
            console.log(`DCC: Row sentence data: Code="${sentenceCode}", Desc="${sentenceDescription}", Length="${sentenceLength}"`);
            
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
        charges.push(currentCharge);
        console.log(`DCC: Completed final charge ${currentCharge.count} with sentence: "${currentCharge.sentenceDescription}", citation: "${currentCharge.citationArrestNumbers}"`);
      }
      
      console.log(`DCC: Extracted ${charges.length} charges from violations table`);
      return charges;
    }

    extractChargesFromCountTables(context) {
      const charges = [];
      console.log('DCC: Using COUNT tables method...');
      $(context).find("table.iceDatTbl.data:contains('COUNT:')").each((index, table) => {
        const $table = $(table);
        const count = $table
          .find("th")
          .text()
          .trim()
          .replace("COUNT:", "")
          .trim();
        const $nextTable = $table.next("table");
        
        console.log(`DCC: Found COUNT table ${index + 1} with count: ${count}`);

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
          plea: "",
          dispositions: [],
          dispositionDates: [],
          sentenceCode: "",
          sentenceDescription: "",
          sentenceLength: "",
        };

        // Extract sentence information from the disposition table
        const $dispositionTable = $nextTable.next("table");
        let isCollectingSentences = false;
        
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
          } else if ($cells.length === 1 && isCollectingSentences) {
            // Additional sentence information in single cell
            const value = $cells.eq(0).text().trim();
            if (value) {
              charge.sentenceDescription += (charge.sentenceDescription ? " " : "") + value;
            }
          }
        });

        console.log(`DCC: Charge ${charge.count} extracted:`, {
          statute: charge.statute,
          charge: charge.charge,
          sentenceDescription: charge.sentenceDescription,
          citationArrestNumbers: charge.citationArrestNumbers,
          dispositions: charge.dispositions
        });
        charges.push(charge);
      });

      console.log(`DCC: Extracted ${charges.length} charges from COUNT tables`);
      return charges;
    }

    safeText($element) {
      return $element && $element.text() ? $element.text().trim() : "";
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
    // Remove expungeability-related UI methods - not needed for this tool
    updateUI(charges, overallExpungeabilityStatus) {
      // This method is kept for compatibility but doesn't perform any UI updates
      // since expungeability logic is not needed for this tool
      console.log('DCC: case charges processed:', charges.length);
    }
  }
  
// Expose the class to the global window object
window.DCCCaseProcessor = DCCCaseProcessor;