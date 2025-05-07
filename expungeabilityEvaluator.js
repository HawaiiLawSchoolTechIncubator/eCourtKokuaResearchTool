// Legal Logic
class ExpungeabilityEvaluator {
    /**
     * Class representing an Expungeability Evaluator.
     * This class provides methods to evaluate the expungeability of a charge based on its dispositions and additional factors.
     */
    static DISPOSITION_RULES = {
      // NB: A disposition rule will be applied if the disposition string contains the key as a substring.
      // Order of rules is important, as the first matching rule will be applied.
      "Not Guilty": (charge, additionalFactors) => ({
        status: "Expungeable",
        explanation: "Defendant found not guilty.",
        finalJudgment: true,
      }),
  
      "Dismissed With Prejudice": (charge, additionalFactors) => ({
        status: "Expungeable",
        explanation: "Charge dismissed with prejudice.",
        finalJudgment: true,
      }),
  
      "Dsm With Prejudice": (charge, additionalFactors) => ({
        status: "Expungeable",
        explanation: "Charge dismissed with prejudice.",
        finalJudgment: true,
      }),
  
      "Dsm With Prejudice Rule 48": (charge, additionalFactors) => ({
        status: "Expungeable",
        explanation: "Charge dismissed with prejudice under Rule 48.",
        finalJudgment: true,
      }),
  
      "Defer-Accept Guilty Plea": (charge, additionalFactors) => ({
        status: "Deferred",
        explanation:
          "Deferred acceptance disposition normally requires subsequent dismissal and one-year waiting period for expungement eligibility.",
        finalJudgment: false,
      }),
  
      "Defer-No Contest Plea": (charge, additionalFactors) => ({
        status: "Deferred",
        explanation:
          "Deferred acceptance disposition normally requires subsequent dismissal and one-year waiting period for expungement eligibility.",
        finalJudgment: false,
      }),
  
      "Commitment to Circuit Court": (charge, additionalFactors) => ({
        status: "Possibly Expungeable",
        explanation: "See Circuit Court case for expungement determination.",
        finalJudgment: false,
      }),
  
      "Remanded to District Court": (charge, additionalFactors) => ({
        status: "Possibly Expungeable",
        explanation: "See District Court case for expungement determination.",
        finalJudgment: false,
      }),
  
      "Dismissed Without Prejudice": (charge, additionalFactors) => ({
        status: "Possibly Expungeable",
        explanation: "Unable to determine if eligible for expungement.",
        finalJudgment: true,
      }),
  
      // "Dismissed Upon Nolle Prosequi": (charge, additionalFactors) => ({
      //   status: "Expungeable",
      //   explanation: "Nolle prosequi and dismissed with prejudice.",
      //   finalJudgment: true,
      // }),
  
      "Dismissed Upon Nolle Prosequi": (charge, additionalFactors) => {
        let result = {
          status: "Possibly Expungeable",
          explanation: "Expungeable if dismissed with prejudice.",
        };
        if (additionalFactors?.withPrejudice) {
          result = {
            status: "Expungeable",
            explanation: "Nolle prosequi and dismissed with prejudice.",
            finalJudgment: true,
          };
        } else {
          result = {
            status: "Possibly Expungeable",
            explanation: "Nolle prosequi without prejudice.",
            finalJudgment: false,
          };
        }
        return result;
      },
  
      Dismissed: (charge, additionalFactors) => ({
        status: "Possibly Expungeable",
        explanation: "Unable to determine if eligible for expungement.",
        finalJudgment: false,
      }),
  
      "Nolle Prosequi": (charge, additionalFactors) => {
        let result = {
          status: "Possibly Expungeable",
          explanation: "Expungeable if dismissed with prejudice.",
        };
        if (additionalFactors?.withPrejudice) {
          result = {
            status: "Expungeable",
            explanation: "Nolle prosequi and dismissed with prejudice.",
            finalJudgment: true,
          };
        } else {
          result = {
            status: "Possibly Expungeable",
            explanation: "Nolle prosequi without prejudice.",
            finalJudgment: false,
          };
        }
        return result;
      },
  
      "Guilty": (charge, additionalFactors) => {
        const postConvictionResult = this.expungeAfterConviction(charge);
        let result = postConvictionResult
          ? postConvictionResult
          : {
              status: "Not Expungeable",
              explanation: "Non-expungeable adverse disposition.",
              finalJudgment: true,
            };
        return result;
      },
      "Nolo Contendere": (charge, additionalFactors) => {
        const postConvictionResult = this.expungeAfterConviction(charge);
        let result = postConvictionResult
          ? postConvictionResult
          : {
              status: "Not Expungeable",
              explanation: "Non-expungeable adverse disposition.",
              finalJudgment: true,
            };
        return result;
      },
      "Judgment for State": (charge, additionalFactors) => ({
        status: "Not Expungeable",
        explanation: "Non-expungeable adverse disposition.",
        finalJudgment: true,
      }),
  
      "Default Judgment": (charge, additionalFactors) => ({
        status: "Not Expungeable",
        explanation: "Non-expungeable adverse disposition.",
        finalJudgment: false,
      }),
    };
  
    //////////////// DYNAMICALLY GENERATED LISTS OF DISPOSITION TYPES ////////////////
    // List of adverse final dispositions that are not expungeable
    // NB: Some might actually be expungeable (e.g., first time class C property felonies)
    //    depending on result of expungeAfterConviction method
    static ADVERSE_FINAL_DISPOSITIONS = Object.keys(this.DISPOSITION_RULES).filter(key => {
      const result = this.DISPOSITION_RULES[key]({}, {});
      return result.status === "Not Expungeable";
    });
  
    // List of deferred dispositions
    static DEFERRED_DISPOSITIONS = Object.keys(this.DISPOSITION_RULES).filter(key => {
      const result = this.DISPOSITION_RULES[key]({}, {});
      return result.status === "Deferred";
    })
  
    // List of dispositions that are definitely expungeable
    static EXPUNGEABLE_DISPOSITIONS = Object.keys(this.DISPOSITION_RULES).filter(key => {
      const result = this.DISPOSITION_RULES[key]({}, {});
      return result.status === "Expungeable";
    });
  
    // List of dispositions that are definitely not determinable ("possibly expungeable"),
    // i.e., committed to Circuit Court or remanded to District Court
    static NOT_DETERMINABLE_DISPOSITIONS = Object.keys(this.DISPOSITION_RULES).filter(key => {
      const result = this.DISPOSITION_RULES[key]({}, {});
      return result.status === "Possibly Expungeable";
    });
  
    ///////////////////////////////// END OF DYNAMIC LISTS /////////////////////////////////
  
    static isChargeExpungeable(
      charge,
      caseType,
      filingDate,
      additionalFactors = {}
    ) {
      console.log(`Evaluating charge:`, charge);
      //console.log(`Additional factors: ${JSON.stringify(additionalFactors)}`);
  
      // No disposition found (but check docket for dismissal on State's oral motion where implemented)
      const noDispositionFoundResult_Pending = {
        status: "Pending",
        explanation: "Unable to find disposition. Case may still be pending.",
      };
      
      const noDispositionFound_oralMotionDismissalInDocket = {
        status: "Expungeable",
        explanation:
          "Dismissed on State's oral motion but could not find explicit presence/absence of prejudice in data. Charge is probably expungeable.",
      };
  
      if (charge.dispositions.length === 0) {
        // ...because no dispositions are present
        if (additionalFactors?.dismissedOnOralMotion) {
          // Dismissed on oral motion: HRS 831-3.2(3)
          return noDispositionFound_oralMotionDismissalInDocket;
        } 
        return noDispositionFoundResult_Pending;
        
        //return result;
      } else if (charge.dispositions.every((disposition) => !disposition)) {
        // ...because dispositions are present but all are empty
        if (additionalFactors?.dismissedOnOralMotion) {
          // Dismissed on oral motion: HRS 831-3.2(3)
          return noDispositionFound_oralMotionDismissalInDocket;
        } 
        return noDispositionFoundResult_Pending;
      }
  
      // Charge is violation: not expungeable under HRS b/c not a crime
      if (charge?.severity === "violation") {
        return {
          status: "Not Expungeable",
          explanation: "Civil infractions are not expungeable.",
        };
      }
      
      let currentStatus = {
        status: "Unknown",
        explanation: "Unrecognized disposition.",
        disposition: "",
        dispositionDate: "",
      };
  
      let hasDeferred = false;
      let deferralDate = null;
      let dismissalAfterDeferral = false;
      let dismissalDate = null;
  
      // DEBUG: list static lists of dispositions
      // console.log('STATIC LISTS OF DISPOSITIONS:');
      // console.log('Adverse final dispositions:', this.ADVERSE_FINAL_DISPOSITIONS);
      // console.log('Deferred dispositions:', this.DEFERRED_DISPOSITIONS);
      // console.log('Expungeable dispositions:', this.EXPUNGEABLE_DISPOSITIONS);
  
  
      // Handle all dispositions for each charge by evaluating them in chronological order
      for (let i = 0; i < charge.dispositions.length; i++) {
        const disposition = this.safeString(charge.dispositions[i]);
        const dispositionDate = new Date(charge.dispositionDates[i]);
  
        // Check if disposition matches a known rule (match is case-insensitive
        // and checks if the disposition string contains the rule key as a substring)
        const ruleKey = Object.keys(this.DISPOSITION_RULES).find((key) =>
          this.safeIncludes(disposition, key)
        );
  
        if (ruleKey) {
          const result = this.DISPOSITION_RULES[ruleKey](
            charge,
            additionalFactors
          );
  
          console.log(`Disposition: '${disposition}' matched rule: '${ruleKey}'`);
          console.log(`Result:`, result);
  
          // Handle innocence/definitely expungeable
          // if (this.safeIncludes(disposition, "Not Guilty")) {
          if (this.EXPUNGEABLE_DISPOSITIONS.some(disp => this.safeIncludes(disposition, disp))) {
            return {
              ...result,
              disposition,
              dispositionDate: charge.dispositionDates[i],
            };
          }
  
          // Handle guilt - check for any adverse final dispositions using list
          if (this.ADVERSE_FINAL_DISPOSITIONS.some(disp => this.safeIncludes(disposition, disp))) {
            return result;
          }
          
          // Handle not determinable dispositions
          if (this.NOT_DETERMINABLE_DISPOSITIONS.some(disp => this.safeIncludes(disposition, disp))) {
            return result;
          }
  
          // Handle deferred acceptance dispositions
          if (
            result.status === "Deferred" ||
            additionalFactors?.deferredAcceptance
          ) {
            hasDeferred = true;
            deferralDate = dispositionDate;
            currentStatus = {
              ...result,
              disposition,
              dispositionDate: charge.dispositionDates[i],
            };
          }
  
          if (
            hasDeferred &&
            (ruleKey === "Dismissed With Prejudice" ||
              ruleKey === "Dsm With Prejudice" ||
              ruleKey === "Dsm With Prejudice Rule 48" ||
              ruleKey === "Dismissed")
          ) {
            dismissalAfterDeferral = true;
            dismissalDate = dispositionDate;
            currentStatus = {
              ...result,
              disposition,
              dispositionDate: charge.dispositionDates[i],
            };
            currentStatus = this.expungeAfterDeferral(
              currentStatus,
              deferralDate,
              dismissalAfterDeferral,
              dismissalDate
            );
          // } else {
          //   console.log('Block: no deferred acceptance or no dismissal after deferral');
          //   // currentStatus = {
          //   //   ...result,
          //   //   disposition,
          //   //   dispositionDate: charge.dispositionDates[i],
          //   // };
          //   currentStatus = this.expungeAfterDeferral(
          //     currentStatus,
          //     deferralDate,
          //     dismissalAfterDeferral,
          //     dismissalDate
          //   );
          }
        }
      }
  
      // Handle statute of limitations
      // if (
      //   !currentStatus.explanation.includes("Deferred disposition") &&
      //   (
      //     currentStatus.status === "Possibly Expungeable" ||
      //     currentStatus.status === "Unknown"
      //   )
  
  
      if (
          this.expungeabilityDependsOnSoL(
            currentStatus.status,
            currentStatus.explanation
          )
      ) {
        const limitationsResult = this.expungeAfterLimitations(
          charge,
          caseType,
          filingDate,
          additionalFactors
        );
        currentStatus = {
          ...limitationsResult,
          disposition: currentStatus.disposition,
          dispositionDate: currentStatus.dispositionDate,
        };
  
        return currentStatus;
      }
  
      return currentStatus;
    }
  
    static safeString(value) {
      return value ? String(value).trim() : "";
    }
  
    /**
     * Safely checks if a string includes a search string, ignoring case.
     * @param {string|null|undefined} str - The string to search within
     * @param {string|null|undefined} searchString - The string to search for
     * @returns {boolean} True if searchString is found within str, false otherwise
     */
    static safeIncludes(str, searchString) {
      
      return this.safeString(str)
        .toLowerCase()
        .includes(this.safeString(searchString).toLowerCase());
    }
  
    static expungeAfterConviction(charge) {
      // Handle expungeability after conviction for eligible offenses
      if (charge?.statute) {
        const statute = charge.statute;
  
        if (this.safeIncludes(statute, "291E-64(b)(1)")) {
          // DUI under 21: HRS 291E-64
          return {
            status: "Expungeable at 21",
            explanation:
              'If there are no prior alcohol enforcement contacts, the subsequently well-behaved defendant "may apply to the court" to expunge this first-time under-21 DUI after turning 21: HRS §291E-64(e).',
          };
        }
  
        // 1st/2nd-time drug offender (2004 or later): HRS 706-622.5
        if (
          this.safeIncludes(statute, "329-43.5") &&
          Date(charge.dispositionDates[charge.dispositionDates.length - 1]) >
            Date("12/31/2003") &&
          !this.safeIncludes(statute, "43.5(a)") &&
          !this.safeIncludes(statute, "43.5(b)")
        ) {
          return {
            status: "1st/2nd Expungeable",
            explanation:
              'If this is a first- or second-time offense, the court "shall" expunge it upon written application after successful completion of the substance abuse treatment program and satisfaction of probation conditions: HRS §706-622.5(4).',
          };
        }
  
        // First-time drug offender prior to 2004: HRS 706-622.8
        if (this.safeIncludes(statute, "329-43.5")) {
          return {
            status: "1st Expungeable",
            explanation:
              'The defendant/probation officer "may apply to the court" to expunge a pre-2004 first-time drug offense upon meeting the requirements of HRS §706-622.5(4): HRS §706-622.8.',
          };
        }
  
        // First-time property offender: HRS 706-622.9
        if (
          this.safeIncludes(statute, "708") &&
          charge?.severity &&
          charge.severity == "Felony C"
        ) {
          return {
            status: "Possibly Expungeable",
            explanation:
              "If this class C property felony is a first offense, the court &quot;shall&quot; expunge it upon the defendant's/probation officer's written application after successful completion of the substance abuse treatment program and satisfaction of probation conditions: HRS §706-622.9(3).",
          };
        }
      }
      return null;
    }
  
    static expungeAfterDeferral(
      currentStatus,
      deferralDate,
      dismissalAfterDeferral,
      dismissalDate
    ) {
      if (dismissalAfterDeferral) {
        const deferralResult = this.hasDeferralPeriodExpired(dismissalDate);
        let result;
        if (deferralResult.status === "Expired") {
          
          result = {
            status: "Expungeable",
            explanation: `Deferred disposition followed by dismissal. ${deferralResult.explanation}`,
            disposition: currentStatus.disposition,
            dispositionDate: currentStatus.dispositionDate,
          };
        } else {
          result = {
            status: `Expungeable After ${deferralResult.expiryDate}`,
            explanation: `Deferred disposition followed by dismissal. ${deferralResult.explanation}`,
            disposition: currentStatus.disposition,
            dispositionDate: currentStatus.dispositionDate,
          };
        }
        if (result) {
          if (deferralResult?.expiryDate) {
            result.deferralPeriodExpiryDate = deferralResult.expiryDate;
          }
        }
        // console.log('ExpungeAfterDeferral result:', result);
        return result;
      } else {
        let result = {
          status: "Possibly Expungeable",
          explanation:
            "Deferred disposition found, but no subsequent dismissal as required by HRS 831-3.2(5) for expungement eligibility.",
          disposition: currentStatus.disposition,
          dispositionDate: currentStatus.dispositionDate,
        };
        // console.log('ExpungeAfterDeferral result:', result);
        return result
      }
    }
  
    static hasDeferralPeriodExpired(dismissalDate) {
      const now = new Date();
      dismissalDate = new Date(dismissalDate);
      const timeSinceDismissal = now - dismissalDate;
      const deferralPeriodMilliseconds = 365 * 24 * 60 * 60 * 1000; // 1 year after discharge & dismissal of deferred acceptance disposition (in milliseconds)
  
      if (isNaN(dismissalDate.getTime())) {
        return {
          status: "Unknown",
          explanation:
            "Unable to determine deferral period due to invalid dismissal date.",
        };
      }
  
      const daysRemaining = Math.ceil(
        (deferralPeriodMilliseconds - timeSinceDismissal) / (24 * 60 * 60 * 1000)
      );
      const expiryDate = new Date(
        dismissalDate.getTime() + deferralPeriodMilliseconds
      ).toLocaleDateString();
  
      if (timeSinceDismissal > deferralPeriodMilliseconds) {
        return {
          status: "Expired",
          explanation: `One-year period afer discharge & dismissal of deferred acceptance disposition expired on ${expiryDate}.`,
          expiryDate: expiryDate,
          daysRemaining: daysRemaining,
        };
      } else {
        return {
          status: "Running",
          explanation: `One-year period afer discharge & dismissal of deferred acceptance disposition will expire on ${expiryDate}.`,
          expiryDate: expiryDate,
          daysRemaining: daysRemaining,
        };
      }
    }
  
    static hasPriorDeferredDisposition(charge) {
      return charge.dispositions.some(disposition => 
        this.DEFERRED_DISPOSITIONS.some(deferredType => 
          this.safeIncludes(disposition, deferredType)
        )
      );
    }
  
    // Determine whether expungeability depends on statute of limitations based on charge
    // disposition status and explanation properties (for use with is ChargeExpungeable method)
    static expungeabilityDependsOnSoL(dispositionStatus, explanation) {
      console.log('In expungeabilityDependsOnSoL method');
      console.log('dispositionStatus:', dispositionStatus);
      console.log('explanation:', explanation);
      // No: disposition is in static list ADVERSE_FINAL_DISPOSITIONS
      if (this.ADVERSE_FINAL_DISPOSITIONS.some(disp => this.safeIncludes(explanation, disp))) {
        console.log('Expungeability does NOT depend on statute of limitations: adverse final disposition');
        return false;
      }
      // No: disposition explanation is some kind of deferral
      if (this.safeIncludes(explanation, "Deferred disposition")) {
        console.log('Expungeability does NOT depend on statute of limitations: deferred disposition');
        return false;
      }
      // No: disposition is definitely expungeable
      if (this.EXPUNGEABLE_DISPOSITIONS.some(disp => this.safeIncludes(explanation, disp))) {
        console.log('Expungeability does NOT depend on statute of limitations: disposition is definitely expungeable');
        return false;
      }
  
      // No: case was committed to Circuit Court or remanded to District Court
      if (this.safeIncludes(explanation, "See Circuit Court case") || this.safeIncludes(explanation, "See District Court case")) {
        console.log('Expungeability does NOT depend on statute of limitations: case was committed to Circuit Court or remanded to District Court');
        return false;
      }
  
      // Yes: expungement may depend on statute of limitations
      console.log('Expungeability depends on statute of limitations');
      return true;
    }
  
    // Evaluate expungeability based on statute of limitations
    static expungeAfterLimitations(
      charge,
      caseType,
      filingDate,
      additionalFactors
    ) {
      const statuteResult = this.hasStatuteOfLimitationsExpired(
        charge,
        filingDate,
        caseType
      );
      if (statuteResult.status === "Expired") {
        return {
          status: "Expungeable",
          explanation: statuteResult.explanation,
        };
      } else if (statuteResult.status === "Unlimited") {
        return {
          status: "Possibly Expungeable",
          explanation: statuteResult.explanation,
        };
      } else if (statuteResult.status === "Running") {
        return {
          status: `Statute of Limitations ${statuteResult.expiryDate}`,
          explanation: statuteResult.explanation,
        };
      } else if (statuteResult.status === "Possibly Expired") {
        return {
          status: "Possibly Expungeable",
          explanation: statuteResult.explanation,
        };
      } else if (statuteResult.status === "Unlimited") {
        return {
          status: "Not Expungeable",
          explanation: statuteResult.explanation,
        };
      }
      return {
        status: "Possibly Expungeable",
        explanation: `Unknown statute of limitations for charge: ${charge.charge}.`,
      };
    }
  
    static hasStatuteOfLimitationsExpired(charge, filingDate, caseType = "") {
      const now = new Date();
      const filingDateObj = new Date(filingDate);
      const offenseDateObj = new Date(charge.offenseDate);
      const lastDispositionDateObj = new Date(
        charge.dispositionDates[charge.dispositionDates.length - 1]
      );
  
      // Determine the severity and corresponding statute of limitations
      let statuteOfLimitations;
      let severityDescription;
      const normalizedSeverity = utils
        .normalizeSeverity(charge, caseType)
        .toLowerCase();
  
      console.log(`Normalized severity: '${normalizedSeverity}'`);
  
      if (normalizedSeverity == "petty misdemeanor") {
        statuteOfLimitations = 1 * 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
        severityDescription = "Petty Misdemeanor";
      } else if (normalizedSeverity == "misdemeanor") {
        statuteOfLimitations = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
        severityDescription = "Misdemeanor";
      } else if (normalizedSeverity == "felony a") {
        statuteOfLimitations = 6 * 365 * 24 * 60 * 60 * 1000; // 6 years in milliseconds
        severityDescription = "Felony A";
      } else if (normalizedSeverity == "§708 fraud felony") {
        statuteOfLimitations = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years in milliseconds
        severityDescription = "§708 fraud felony";
      } else if (normalizedSeverity == "felony b") {
        statuteOfLimitations = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years in milliseconds
        severityDescription = "Felony B";
      } else if (normalizedSeverity == "felony c") {
        statuteOfLimitations = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years in milliseconds
        severityDescription = "Felony C";
      } else if (normalizedSeverity == "§701-108(2) felony") {
        statuteOfLimitations = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years in milliseconds
        severityDescription = "§701-108(2) felony";
      } else if (normalizedSeverity == "§701-108(1) felony") {
        statuteOfLimitations = 999 * 365 * 24 * 60 * 60 * 1000; // 999 years in milliseconds (i.e., no statute of limitations)
        severityDescription = "§701-108(1) felony";
      } else if (normalizedSeverity == "§707-733.6 felony") {
        statuteOfLimitations = 999 * 365 * 24 * 60 * 60 * 1000; // 999 years in milliseconds (i.e., no statute of limitations)
        severityDescription = "§707-733.6 Felony";
      } else if (normalizedSeverity == "violation") {
        statuteOfLimitations = 1 * 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
        severityDescription = "Violation";
      } else {
        console.log(
          `Returning unknown statute of limitations for severity: ${normalizedSeverity}`
        );
        return {
          status: "Unknown",
          explanation:
            "Unable to determine statute of limitations due to unknown severity.",
        };
      }
  
      if (statuteOfLimitations === 999 * 365 * 24 * 60 * 60 * 1000) {
        return {
          status: "Unlimited",
          explanation: `No statute of limitations for a ${severityDescription}.`,
          period: "Unlimited",
        };
      }
  
      console.log(
        `Statute of limitations for ${severityDescription}: ${statuteOfLimitations} ms`
      );
  
      let expiryDate, status, certainty, explanation;
  
      if (
        !isNaN(offenseDateObj.getTime()) &&
        !isNaN(filingDateObj.getTime()) &&
        lastDispositionDateObj &&
        !isNaN(lastDispositionDateObj.getTime())
      ) {
        // Calculate tolling period
        const tollingPeriod =
          lastDispositionDateObj.getTime() - filingDateObj.getTime();
  
        // Calculate expiry date considering tolling
        expiryDate = new Date(
          offenseDateObj.getTime() + statuteOfLimitations + tollingPeriod
        );
        certainty = "Certain";
  
        if (now > expiryDate) {
          status = "Expired";
          explanation = `Statute of limitations expired on ${expiryDate.toLocaleDateString()}, accounting for ${Math.round(
            tollingPeriod / (24 * 60 * 60 * 1000)
          )} days of tolling during prosecution.`;
        } else {
          status = "Running";
          explanation = `Statute of limitations will expire on ${expiryDate.toLocaleDateString()}, accounting for ${Math.round(
            tollingPeriod / (24 * 60 * 60 * 1000)
          )} days of tolling during prosecution.`;
        }
      } else if (!isNaN(lastDispositionDateObj.getTime())) {
        // If filing date available but disposition is, calculate from then
        expiryDate = new Date(
          lastDispositionDateObj.getTime() + statuteOfLimitations
        );
        certainty = "Uncertain";
  
        if (now > expiryDate) {
          status = "Possibly Expired";
          explanation = `Statute of limitations may have expired on ${expiryDate.toLocaleDateString()}, calculating from disposition date. Unable to account for tolling due to missing filing date.`;
        } else {
          status = "Possibly Running";
          explanation = `Statute of limitations may expire on ${expiryDate.toLocaleDateString()}, calculating from disposition date. Unable to account for tolling due to missing filing date.`;
        }
      } else if (!isNaN(offenseDateObj.getTime())) {
        // Use offense date if available, but without tolling information
        expiryDate = new Date(offenseDateObj.getTime() + statuteOfLimitations);
        certainty = "Uncertain";
  
        if (now > expiryDate) {
          status = "Possibly Expired";
          explanation = `Statute of limitations may have expired on ${expiryDate.toLocaleDateString()}. Unable to account for tolling due to missing filing or disposition dates.`;
        } else {
          status = "Possibly Running";
          explanation = `Statute of limitations may expire on ${expiryDate.toLocaleDateString()}. Unable to account for tolling due to missing filing or disposition dates.`;
        }
      } else {
        // Fall back to filing date if offense date is not available
        expiryDate = new Date(filingDateObj.getTime() + statuteOfLimitations);
        certainty = "Uncertain";
  
        if (now > expiryDate) {
          status = "Possibly Expired";
          explanation = `Statute of limitations may have expired. Latest possible expiry was on ${expiryDate.toLocaleDateString()} (calculated from filing date as offense date not found). Unable to account for tolling.`;
        } else {
          status = "Possibly Running";
          explanation = `Statute of limitations may still be running. Will expire no later than ${expiryDate.toLocaleDateString()} (calculated from filing date as offense date not found). Unable to account for tolling.`;
        }
      }
  
      const daysRemaining = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
  
      return {
        status,
        explanation,
        expiryDate: expiryDate.toLocaleDateString(),
        certainty,
        daysRemaining,
        period: statuteOfLimitations / (365 * 24 * 60 * 60 * 1000),
      };
    }
  
    static determineOverallExpungeability(charges) {
      let expungeableCount = 0;
      let possiblyExpungeableCount = 0;
      let notExpungeableCount = 0;
      let deferredCount = 0;
      let noDispositionCount = 0;
      let limitationsCount = 0;
      let whenDefendantTurns21Count = 0;
      let latestExpiryDate = null;
      let explanations = [];
  
      charges.forEach((charge) => {
        switch (charge.isExpungeable.status) {
          case "Expungeable":
            expungeableCount++;
            break;
          case "1st Expungeable":
          case "1st/2nd Expungeable":
          case "Possibly Expungeable":
            possiblyExpungeableCount++;
            break;
          case "Expungeable at 21":
            whenDefendantTurns21Count++;
            break;
          case "Not Expungeable":
            notExpungeableCount++;
            break;
          case "No Disposition Found":
            noDispositionCount++;
            break;
          case "Pending":
            noDispositionCount++;
            break;
          default:
            let expungeStatus = charge.isExpungeable.status;
            expungeStatus = expungeStatus.toLowerCase();
            if (
              expungeStatus.includes("deferred") ||
              expungeStatus.includes("expungeable after")
            ) {
              deferredCount++;
              if (charge.deferralPeriodExpiryDate) {
                updateLatestExpiryDate(
                  charge.deferralPeriodExpiryDate,
                  "Deferral",
                  "Certain"
                );
              }
            } else if (expungeStatus.includes("statute")) {
              limitationsCount++;
              if (charge.statuteOfLimitationsExpiryDate) {
                updateLatestExpiryDate(
                  charge.statuteOfLimitationsExpiryDate,
                  "Statute",
                  charge.statuteOfLimitationsCertainty
                );
              }
            }
        }
        explanations.push(
          `Charge ${charge.count}: ${charge.isExpungeable.status} - ${charge.isExpungeable.explanation}`
        );
      });
  
      function updateLatestExpiryDate(newDate, type, certainty) {
        const newDateObj = new Date(newDate);
        if (!latestExpiryDate || newDateObj > new Date(latestExpiryDate.date)) {
          latestExpiryDate = { date: newDate, type: type, certainty: certainty };
        }
      }
  
      let status, explanation;
      if (deferredCount + limitationsCount === charges.length) {
        if (latestExpiryDate) {
          const expiryPhrase =
            latestExpiryDate.type === "Statute"
              ? latestExpiryDate.certainty === "Certain"
                ? "statute of limitations expires"
                : "statute of limitations may expire"
              : "one-year period after dismissal and discharge ends";
          if (latestExpiryDate.certainty === "Uncertain") {
            status = `Possibly Expungeable After ${latestExpiryDate.date}`;
          } else {
            status = `Expungeable After ${latestExpiryDate.date}`;
            explanation = `All charges expungeable when the ${expiryPhrase}`;
          }
        } else {
          status = "Expungeable After Unknown Period";
          explanation =
            "All charges may be expungeable after the applicable waiting period (see case for details).";
        }
      } else if (expungeableCount === charges.length) {
        status = "All Expungeable";
        explanation = "All charges in this case are expungeable.";
      } else if (notExpungeableCount === charges.length) {
        status = "None Expungeable";
        explanation = "None of the charges in this case are expungeable.";
      } else if (noDispositionCount === charges.length) {
        status = "Pending";
        explanation = "Cannot locate disposition(s). Case may still be pending.";
      } else if (whenDefendantTurns21Count === charges.length) {
        status = "Expungeable at 21";
        explanation =
          "All first-offense charges may be expungeable when the defendant turns 21 if subsequently well-behaved.";
      } else if (
        possiblyExpungeableCount + whenDefendantTurns21Count ===
        charges.length
      ) {
        status = "All Possibly Expungeable";
        explanation = "All charges in this case are possibly expungeable.";
      } else {
        if (expungeableCount > 0) {
          status = "Some Expungeable";
          explanation =
            "This case has a mix of expungeable, possibly expungeable, and/or non-expungeable charges.";
        } else {
          status = "Some Possibly Expungeable";
          explanation = "Some charge in this case may be expungeable.";
        }
      }
      console.log("Overall expungeability status:", status);
  
      return {
        status,
        explanation,
        chargeDetails: explanations.join("\n"),
      };
    }
  }