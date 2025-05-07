/////////////////////////// Docket Analysis Service ///////////////////////////
class DocketService {
    constructor() {
      this.initialized = false;
      this.columnMap = {}; // Store column index for each type of data
      this.htmlContext = null; // Add this
    }
  
    // Add method to set HTML context
    setHTMLContext(htmlContent) {
      // console.log('Setting HTML context in DocketService');
      this.htmlContent = htmlContent;
  }
  
  async initialize() {
    if (this.initialized) {
        return;
    }
  
    console.log('Initializing DocketService, HTML content exists:', !!this.htmlContent);
    
    const context = this.htmlContent ? $(this.htmlContent) : document;
    
    console.log('Looking for docket table in context');
    // Look directly for a table containing "Docket"
    const docketTable = $(context).find('table:contains("Docket")');
    console.log('Found docket tables:', docketTable.length);
  
    // Try old method if no tables found
    if (!docketTable.length) {
        this.docketTable = $(context).find("tbody")
            .filter(function () {
                return (
                    $(this)
                        .find("tr:first th")
                        .filter(function () {
                            return $(this).text().trim().toLowerCase().includes("docket");
                        }).length > 0
                );
            })
            .first();
        console.log('Found docket table via tbody method:', !!this.docketTable.length);
    } else {
        this.docketTable = docketTable.first();
    }
  
    if (!this.docketTable.length) {
        console.log('HTML content snippet:', $(context).html().substring(0, 500));
        throw new Error("Docket table not found");
    }
  
      // Map column indices based on headers
      const headerRow = this.docketTable.find("tr:first th");
      headerRow.each((index, header) => {
        const headerText = $(header).text().trim().toLowerCase();
        if (headerText.includes("docket #") || headerText === "#") {
          this.columnMap.entryNumber = index;
        }
        else if (headerText === "date") {
          this.columnMap.date = index;
        }
        else if (headerText === "docket") {
          this.columnMap.docketText = index;
        }
        else if (headerText === "defendant") {
          this.columnMap.defendant = index;
        }
        else if (headerText === "party") {
          this.columnMap.party = index;
        }
      });
  
      // Verify we found the essential docket text column
      if (!('docketText' in this.columnMap)) {
        throw new Error("Required docket text column not found");
      }
  
      this.initialized = true;
    }
  
    // Main method to get parsed docket entries
    async getDocketEntries() {
      const context = this.htmlContent || document;
      await this.initialize();
      return this.parseDocketTable();
    }
  
    // Private parsing methods
    parseDocketTable() {
      const entries = [];
      this.docketTable.find("tr:not(:first-child)").each((index, row) => {
        const cells = $(row).find("td");
        const entry = this.parseDocketRow(cells);
        if (entry) {
          entries.push(entry);
        }
      });
      console.log('Parsed docket entries: ', entries);
      return entries;
    }
  
    parseDocketRow(cells) {
      if (!cells) return null;
  
      const documentLinks = [];
      if ('docketText' in this.columnMap) {
        $(cells[this.columnMap.docketText])
          .find("img")
          .each((index, link) => {
            const onclickAttr = $(link).attr("onclick");
            const docMatch = onclickAttr.match(
              /documentSelection\('([^']+)', '([^']+)'/
            );
            if (docMatch) {
              documentLinks.push({
                documentId: docMatch[1],
                documentType: docMatch[2],
                imageSource: $(link).attr("src"),
              });
            }
          });
      }
  
      // Build entry object with nulls for missing columns
      return {
        entryNumber: 'entryNumber' in this.columnMap ? 
          $(cells[this.columnMap.entryNumber]).text().trim() : null,
        date: 'date' in this.columnMap ? 
          new Date($(cells[this.columnMap.date]).text().trim()) : null,
        docketText: 'docketText' in this.columnMap ? 
          $(cells[this.columnMap.docketText]).html().replace(/<img[^>]*>/g, '') : null,
        defendant: 'defendant' in this.columnMap ? 
          $(cells[this.columnMap.defendant]).text().trim() : null,
        party: 'party' in this.columnMap ? 
          $(cells[this.columnMap.party]).text().trim() : null,
        documentLinks: documentLinks
      };
    }
  
    // Analysis utilities
    // Warrant analysis patterns
    static TYPE_PATTERNS = {
      arrest: {
          pattern: /bench warrant|bw issued|arrest warrant|warrant of arrest|WOA|return of service/i,
          type: 'arrest'                              // Provisionally including "return of service"
      },                                              // ...hoping this is only for bench warrants...
      penal: {
          pattern: /penal summons/i,
          type: 'penal summons'
      },
      warrant_related: {
          pattern: /defendant not present|failed to appear|failure to appear/i,
          type: 'warrant related'
      }
    };
  
    static ACTION_PATTERNS = {
      execution: {
        pattern: /executed|execution|exec |return of service/i, // Provisionally including "return of service"
        action: 'execution'                                     // as "execution" often not explicitly stated
      },
      recall: {
          pattern: /recalled|quashed|returned/i,
          action: 'recall'
      },
      service: {
          pattern: /served|service/i,
          action: 'service'
      },
      set_bail: {
          pattern: /bail set|bail amount/i,
          action: 'bail set'
      },
      request_warrant: {
        pattern: /request bench warrant/i,
        action: 'request'
      },
      non_appearance: {
        pattern: /defendant not present|failed to appear|failure to appear/i,
        action: 'non-appearance'
      },
      issue: {
        pattern: /issued|ordered| Bench Warrant Circuit Criminal/i,
        action: 'issue'
      },
      // under_advisement: {
      //   pattern: /under advisement/i,
      //   action: 'under advisement'
      // }
    };
  
    analyzeWarrantText(text) {
      const analysis = {
          isWarrantRelated: false,
          type: null,
          action: null,
          bailAmount: null,
      };
  
      // Check for warrant type
      for (const [key, {pattern, type}] of Object.entries(DocketService.TYPE_PATTERNS)) {
          if (pattern.test(text)) {
              analysis.isWarrantRelated = true;
              analysis.type = type;
              
              // Extract bail amount
              const bailMatch = text.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
              if (bailMatch) {
                  analysis.bailAmount = bailMatch[1];
              }
          }
      }
  
      // Separate check for action type (in descending order of priority)
      for (const [key, {pattern, action}] of Object.entries(DocketService.ACTION_PATTERNS)) {
          if (pattern.test(text)) {
              analysis.action = action;
              break;
          }
      }
      ////// Actions that are not mutually exclusive
      // Set action to "bail set" if bail amount is found (or append "bail set"
      // to existing action if it's already set)
      if (analysis.bailAmount) {
        if (!analysis.action) {
          analysis.action = 'bail set';
        } else if (analysis.action !== 'bail set') {
          analysis.action += '; bail set';
        }
      }
      // Set/append action to "non-appearance" if it's found
      if (DocketService.ACTION_PATTERNS.non_appearance.pattern.test(text)) {
        if (!analysis.action) {
          analysis.action = 'non-appearance';
          analysis.isWarrantRelated = true;
        } else if (!analysis.action.includes('non-appearance')) {
          analysis.action += '; non-appearance';
          analysis.isWarrantRelated = true;
        }
      }
      // console.log('Warrant text:', text);
      // console.log('Warrant analysis:', analysis);
      // console.log('Warrant Type', analysis.type);
  
      return analysis;
    }
  
    // Main warrant analysis method
    async analyzeWarrantStatus(entries = null) {
      if (!entries) {
        entries = await this.getDocketEntries();
      }
  
      const warrantResults = {
        hasOutstandingWarrant: false,
        warrantEntries: [],
        latestWarrantType: null,
        latestWarrantDate: null,
        latestRecallDate: null,
        latestBailAmount: null,
        latestNonAppearanceDate: null,
        explanation: ""
      };
  
      // Find and categorize relevant entries
      this.findWarrantRelatedEntries(entries, warrantResults);
  
      // Set the latest dates
      //this.determineWarrantDates(warrantResults);
  
      // Analyze status and set explanation
      this.determineWarrantStatus(warrantResults);
  
      return warrantResults;
    }
  
    // Find entries and enrich them with warrant analysis
    findWarrantRelatedEntries(entries, results) {
      // Find all warrant-related entries and enrich them with analysis
      results.warrantEntries = entries
          .map(entry => {
              const warrantAnalysis = this.analyzeWarrantText(entry.docketText);
              if (warrantAnalysis.isWarrantRelated) {
                  return {
                      ...entry,
                      warrantType: warrantAnalysis.type,
                      warrantAction: warrantAnalysis.action,
                      warrantBailAmount: warrantAnalysis.bailAmount
                  };
              }
              return null;
          })
          .filter(entry => entry !== null);
  
      // Sort by date (newest first)
      results.warrantEntries.sort((a, b) => b.date - a.date);
  
      // Set latest dates based on actions
      const latestWarrant = results.warrantEntries.find(entry => entry.warrantAction?.includes('issue'));
      const latestRecall = results.warrantEntries.find(entry => entry.warrantAction?.includes('recall'));
      const latestBailAmount = results.warrantEntries.find(entry => entry.warrantAction?.includes('bail set'));
      const latestNonAppearance = results.warrantEntries.find(entry => entry.warrantAction?.includes('non-appearance'));
      const latestWarrantType = results.warrantEntries.find(entry => entry.warrantType);
      
      if (latestWarrant && latestWarrantType) {
        let latestWarrantTypePhrase = latestWarrant.warrantType
          results.latestWarrantType = this.warrantTypeToPhrase(latestWarrantTypePhrase);
        // try {
        //   let latestWarrantTypePhrase = latestWarrant.warrantType
        //   results.latestWarrantType = this.warrantTypeToPhrase(latestWarrantTypePhrase);
        // } catch (error) {
        //   console.error('Error converting warrant type to phrase:', error);
        //   console.log('Latest warrant:', latestWarrant);
        //   console.log('Latest warrant type:', latestWarrantType);
        // }
      }
  
      if (latestWarrant) {
          results.latestWarrantDate = latestWarrant.date;
      }
      if (latestRecall) {
          results.latestRecallDate = latestRecall.date;
      }
      if (latestBailAmount) {
          results.latestBailAmount = latestBailAmount.warrantBailAmount;
      }
      if (latestNonAppearance) {
        results.latestNonAppearanceDate = latestNonAppearance.date;
      }
    }
  
    // Convert warrant type to phrase suitable for a sentence
    warrantTypeToPhrase(type, cap_first = false) {
      if (!type) {
          return null;
      }
      console.log('WARRANT TYPE TO PHRASE INPUT:', type);
      // Everything other than a penal summons has 'warrant' appended
      if (type.toLowerCase() != 'penal summons') {
        type += ' warrant';
      }
      if (cap_first) {
        type = type.charAt(0).toUpperCase() + type.slice(1);
      }
      return type;
    }
  
    // Helper method to determine final warrant status
    determineWarrantStatus(results) {
      console.log('Warrant entries:', results.warrantEntries);
      if (results.warrantEntries.length === 0) {
          results.explanation = "No warrant entries found in docket.";
          return;
      }
  
      // Get all executions, recalls, and services
      const terminatingActions = results.warrantEntries.filter(entry => 
        entry.warrantAction?.includes('recall') || entry.warrantAction?.includes('execution') || entry.warrantAction?.includes('serv')
      );
  
      // Find the most recent warrant issuance
      const latestWarrant = results.warrantEntries.find(entry => entry.warrantAction?.includes('issue'));
      
      if (!latestWarrant) {
          // No warrant issuance found, but check if there are execution/recall/service entries
          if (terminatingActions.length > 0) {
              // Sort by date to get the most recent
              terminatingActions.sort((a, b) => b.date - a.date);
              const latestAction = terminatingActions[0];
              
              results.hasOutstandingWarrant = false;
              results.explanation = 
                  `Found ${this.warrantTypeToPhrase(latestAction.warrantType)} ${latestAction.warrantAction} on ${latestAction.date.toLocaleDateString()} ` +
                  `but no corresponding issuance entry. ` +
                  `${latestAction.warrantbailAmount ? 
                      `(Bail amount: $${latestAction.warrantbailAmount})` : 
                      ''}`;               
              return;
          }
          
          results.explanation = "No warrant entries found in docket.";
          return;
      }
  
      // Check for any recall/execution/service after the latest issuance
      const subsequentActions = terminatingActions.filter(entry => 
          entry.date > latestWarrant.date
      );
  
      // Sort by date if there are multiple actions
      subsequentActions.sort((a, b) => b.date - a.date);
      const latestAction = subsequentActions[0];
  
      if (latestAction) {
          // Warrant was recalled or executed in latest warrant action
          results.hasOutstandingWarrant = false;
          console.log('Latest warrant type:', results.latestWarrantType);
          results.explanation = 
              `${this.warrantTypeToPhrase(results.latestWarrantType, true)} issued on ${latestWarrant.date.toLocaleDateString()} was ` +
              `${latestAction.warrantAction === 'recall' ? 'recalled' : 'executed'} ` +
              `on ${latestAction.date.toLocaleDateString()}.` +
              `${latestWarrant.warrantbailAmount ? 
                  ` (Bail was set at $${latestWarrant.warrantbailAmount})` : 
                  ''}`;
      } else {
          // Warrant is still outstanding
          results.hasOutstandingWarrant = true;
          let latestWarrantTypePhrase = latestWarrant.warrantType
          latestWarrantTypePhrase = this.warrantTypeToPhrase(latestWarrantTypePhrase, true);
  
          results.explanation = 
              `${latestWarrantTypePhrase} ` +
              `issued on ${latestWarrant.date.toLocaleDateString()} ` +
              `${latestWarrant.warrantbailAmount ? 
                  `with bail set at $${latestWarrant.warrantbailAmount} ` : 
                  ''}` +
              `remains outstanding.`;
      }
    }
  
    async checkDismissalWithPrejudice(entries = null) {
      if (!entries) {
        entries = await this.getDocketEntries();
      }
  
      const dismissalEntry = entries.find((entry) => {
        const docketTextLower = entry.docketText.toLowerCase();
        return (
          docketTextLower.includes(
            "ord/nolle-prosequimotion for nolle prosequi with prejudice"
          ) && !docketTextLower.includes("den")
        );
      });
  
      return {
        withPrejudice: Boolean(dismissalEntry),
        dismissalDate: dismissalEntry ? dismissalEntry.date : null,
        dismissalText: dismissalEntry ? dismissalEntry.docketText : null,
      };
    }
  
    async checkDeferredAcceptance(entries = null) {
      if (!entries) {
        entries = await this.getDocketEntries();
      }
  
      const deferralEntry = entries.find((entry) => {
        const docketTextLower = entry.docketText.toLowerCase();
        return docketTextLower.includes(
          "order granting motion for deferred acceptance of"
        );
      });
  
      return {
        deferredAcceptance: Boolean(deferralEntry),
        deferralDate: deferralEntry ? deferralEntry.date : null,
        deferralText: deferralEntry ? deferralEntry.docketText : null,
      };
    }
  }
  