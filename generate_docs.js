const DocumentGenerator = (function () {
  class DocumentGenerator {
    constructor() {
      this.attorneyInfo = null;
      this.alternateInfo = {
        firstName: "",
        middleName: "",
        lastName: "",
        addressLine1: "",
        addressLine2: "",
        addressLine3: "",
        phone: "",
        email: "",
        dob: "",
        sex: "",
      };

      this.headPdDefaults = null;
    }

    async initialize() {
      // Load default head PD data
      const defaultDataUrl = chrome.runtime.getURL("settings.json");
      const defaultResponse = await fetch(defaultDataUrl);
      this.headPdDefaults = await defaultResponse.json();
      this.eCourtCodes = await this.loadECourtCodes();

      // Load alternate info
      await this.loadAlternateInfo();
    }

    async loadECourtCodes() {
      // Load eCourt codes from JSON file
      const eCourtCodes = await fetch(
        chrome.runtime.getURL("ecourt_kokua_codes.json")
      )
        .then((response) => response.json())
        .catch((error) => {
          overviewLog("Error loading court codes:", error);
          return {};
        });
      console.log("Loaded eCourt Kokua codes");
      return eCourtCodes;
    }

    ////////////////////////// Warrant Replacement Map //////////////////////////
    static WARRANT_TEMPLATES = {
      publicDefender: {
        filename: "bench_warrant_paperwork_public_defender.docx",
        mapping: {
          α: "attorneyName",
          β: "headPdName",
          γ: "headPdRegistration",
          ι: "attorneyRegistration",
          χ: "attorneySignatureLocation",
          κ: "defendantNameFull",
          τ: "caseNumber",
          λ: "warrantIssueMonth",
          μ: "warrantIssueDay",
          ν: "warrantIssueYear",
          ξ: "warrantAmount",
          ο: "nonAppearanceMonth",
          π: "nonAppearanceDay",
          ρ: "nonAppearanceYear",
          σ: "consultationMonth",
          ω: "consultationDay",
          υ: "consultationYear",
          ψ: "consultVerbPhrase",
          Ϝ: "courtCircuit",
          "{{year}}": `literal: ${new Date().getFullYear().toString()}`,
        },
      },
      privateAttorney: {
        filename: "bench_warrant_paperwork_private_attorney.docx",
        mapping: {
          φ: "firmName",
          α: "attorneyName",
          β: "attorneyAddress1",
          γ: "attorneyAddress2",
          δ: "attorneyAddress3",
          ε: "attorneyAddress4",
          ζ: "attorneyTelephone",
          η: "attorneyFax",
          θ: "attorneyEmail",
          ι: "attorneyRegistration",
          χ: "attorneySignatureLocation",
          κ: "defendantNameFull",
          τ: "caseNumber",
          λ: "warrantIssueMonth",
          μ: "warrantIssueDay",
          ν: "warrantIssueYear",
          ξ: "warrantAmount",
          ο: "nonAppearanceMonth",
          π: "nonAppearanceDay",
          ρ: "nonAppearanceYear",
          σ: "consultationMonth",
          ω: "consultationDay",
          υ: "consultationYear",
          ψ: "consultVerbPhrase",
          Ϝ: "courtCircuit",
          "{{year}}": new Date().getFullYear().toString(),
        },
      },
    };

    ////////////////////////// Optional Paragraph Patterns //////////////////////////
    static OPTIONAL_PARAGRAPH_PATTERNS = {
      expungement: {
        dddressLine3: {
          placeholder: "ξ",
          pattern: /<w:p w14:paraId="20DEE2BC".*?ξ<\/w:t><\/w:r><\/w:p>/,
          emptyReplacement: "", // Removing entire paragraph when empty
        },
        phone: {
          placeholder: "φ",
          pattern: /<w:p w14:paraId="32400D1D".*?φ<\/w:t><\/w:r><\/w:p>/,
          emptyReplacement: "",
        },
        email: {
          placeholder: "ω",
          pattern: /<w:p w14:paraId="011CD49E".*?ω<\/w:t><\/w:r><\/w:p>/,
          emptyReplacement: "",
        },
      },
      warrant: {
        privateAttorney: {
          firmName: {
            placeholder: "φ",
            pattern: /<w:r.*?φ<\/w:t>.*?><w:br\/><\/w:r>/,
            emptyReplacement: "", // Currently just empty string
          },
          attorneyAddress3: {
            placeholder: "δ",
            pattern: /<w:p w14:paraId="5BB03E26".*δ<\/w:t><\/w:r><\/w:p>/,
            emptyReplacement: "",
          },
          attorneyAddress4: {
            placeholder: "ε",
            pattern: /<w:p w14:paraId="463A85AE".*ε<\/w:t><\/w:r><\/w:p>/,
            emptyReplacement: "",
          },
          attorneyFax: {
            placeholder: "η",
            pattern: /<w:p w14:paraId="23E48E27".*η<\/w:t><\/w:r><\/w:p>/,
            emptyReplacement: "",
          },
          attorneyEmail: {
            placeholder: "θ",
            pattern: /<w:p w14:paraId="6C48E1FB".*θ<\/w:t><\/w:r><\/w:p>/,
            emptyReplacement: "",
          },
          attorneySignatureLocation: {
            // Special: alters two adjacent runs; does not remove a paragraph
            placeholder: "χ",
            pattern: /<w:r w:rsidR="007A17FE".*?χ.*?<w:t>, /,
            emptyReplacement: "<w:r><w:t>",
          },
        },
        publicDefender: {
          attorneySignatureLocation: {
            // Special: alters two adjacent runs; does not remove a paragraph
            placeholder: "χ",
            pattern: /<w:r w:rsidR="001D517E".*?χ.*?>, /,
            emptyReplacement: '<w:r><w:t xml:space="preserve">',
          },
        },
      },
    };

    ////////////////////////// Load Attorney Info //////////////////////////
    async loadAttorneyInfo() {
        // First load the default data
        const defaultDataUrl = chrome.runtime.getURL('settings.json');
        const defaultResponse = await fetch(defaultDataUrl);
        const defaultData = await defaultResponse.json();

      return new Promise((resolve) => {
        chrome.storage.local.get("attorneyInfo", (result) => {
          // Set default values for required fields
          this.attorneyInfo = {
            isPublicDefender: true, // Default value
            firmName: "",
            attorneyName: "",
            attorneyRegistration: "",
            attorneySignatureLocation: "",
            //headPdName: "Jon N. Ikenaga",
            //headPdRegistration: "6284",
            headPdName: defaultData.head_public_defender_name,
            headPdRegistration: defaultData.head_public_defender_registration,
            attorneyAddress1: "",
            attorneyAddress2: "",
            attorneyAddress3: "",
            attorneyAddress4: "",
            attorneyTelephone: "",
            attorneyFax: "",
            attorneyEmail: "",
            courtCircuit: "",
            ...result.attorneyInfo, // Overlay with stored values if they exist
          };
          resolve(this.attorneyInfo);
        });
      });
    }

    ////////////////////////// Load Alternate Client Info //////////////////////////

    async loadAlternateInfo() {
      const fields = [
        "alternateFirstName",
        "alternateMiddleName",
        "alternateLastName",
        "alternateAddressLine1",
        "alternateAddressLine2",
        "alternateAddressLine3",
        "alternatePhone",
        "alternateEmail",
        "alternateDOB",
        "alternateSex",
      ];

      return new Promise((resolve) => {
        chrome.storage.local.get(fields, (result) => {
          this.alternateInfo = {
            firstName: result.alternateFirstName || "",
            middleName: result.alternateMiddleName || "",
            lastName: result.alternateLastName || "",
            addressLine1: result.alternateAddressLine1 || "",
            addressLine2: result.alternateAddressLine2 || "",
            addressLine3: result.alternateAddressLine3 || "",
            phone: result.alternatePhone || "",
            email: result.alternateEmail || "",
            dob: result.alternateDOB || "",
            sex: result.alternateSex || "",
          };
          console.log("Mapped alternate info:", this.alternateInfo);
          resolve();
        });
      });
    }

    ////////// Load Warrant Details (function also present in popup.js for UI purposes) //////////
    async loadWarrantDetails(caseNumber) {
      if (!caseNumber) {
        console.warn("No case number provided to loadWarrantDetails");
        return null;
      }

      return new Promise((resolve) => {
        chrome.storage.local.get("warrantDetails", function (result) {
          if (result.warrantDetails && result.warrantDetails[caseNumber]) {
            console.log("Found warrant details for case:", caseNumber);
            resolve(result.warrantDetails[caseNumber]);
          } else {
            console.log("No warrant details found for case:", caseNumber);
            resolve({
              consultationDate: "",
              consultationTown: "",
              consultVerbPhrase: "",
              nonAppearanceDate: "",
              warrantIssueDate: "",
              warrantAmount: "",
            });
          }
        });
      });
    }

    ////////////////////////// Whether to Generate Documents //////////////////////////

    async generateAllDocuments(mode) {
      // Ensure initialization is complete
      await this.initialize();
      const cases = await this.getCases();
      if (mode == "expungement") {
        const clientCases = this.groupCasesByClient(cases);

        for (const [normalizedName, clientCaseList] of Object.entries(
          clientCases
        )) {
          await this.generateExpungementDocuments(
            normalizedName,
            clientCaseList
          );
        }
      } else if (mode == "warrant") {
        for (const caseObj of cases) {
          if (this.shouldGenerateWarrantPaperwork(caseObj)) {
            await this.generateWarrantDocuments(caseObj);
          }
        }
      } else if (mode == "research") {
        await this.generateResearchCsv(cases);

      } else {
        console.log(`Document generation not implemented for ${mode} mode`);
        return;
      }
    }

    isExpungeableEnoughForPaperwork(caseObj) {
      return caseObj.Expungeable === "All Expungeable" || caseObj.Override;
    }

    shouldGenerateWarrantPaperwork(caseObj) {
      return (
        caseObj.warrantStatus?.hasOutstandingWarrant || caseObj.OverrideWarrant
      );
    }

    ////////////////////////// Utility Methods //////////////////////////
    async getCases() {
      return new Promise((resolve) => {
        chrome.storage.local.get("cases", function (result) {
          resolve(result.cases || []);
        });
      });
    }

    groupCasesByClient(cases) {
      const clientCases = {};
      cases.forEach((caseObj) => {
        const normalizedName = this.normalizeDefendantName(
          caseObj.DefendantName
        );
        if (!clientCases[normalizedName]) {
          clientCases[normalizedName] = [];
        }
        clientCases[normalizedName].push(caseObj);
      });
      return clientCases;
    }

    normalizeDefendantName(name, format = "last, first middle") {
      let lastName, firstName, middleName;
      let returnName = "";
      // Use alternate names if any exist
      if (
        this.alternateInfo.firstName ||
        this.alternateInfo.middleName ||
        this.alternateInfo.lastName
      ) {
        firstName = this.alternateInfo.firstName;
        middleName = this.alternateInfo.middleName;
        lastName = this.alternateInfo.lastName;
      } else {
        // Original name analysis
        const nameParts = name.trim().split(/\s+/);
        
        if (nameParts[0].endsWith(",")) {
          lastName = nameParts[0].slice(0, -1);
          firstName = nameParts[1] || "";
          middleName = nameParts.slice(2).join(" ");
        } else if (nameParts.length > 1) {
          lastName = nameParts[nameParts.length - 1];
          firstName = nameParts[0];
          middleName = nameParts.slice(1, -1).join(" ");
        } else {
          lastName = name.trim();
          firstName = "";
          middleName = "";
        }
      }

      if (format === "last, first middle") {
        returnName = `${lastName}, ${firstName} ${middleName}`.trim();
      } else if (format === "first, middle, last") {
        returnName = `${firstName}, ${middleName}, ${lastName}`.trim();
      } else if (format === "first middle last") {
        returnName = `${firstName} ${middleName} ${lastName}`.trim();
      } else if (format === "first last") {
        returnName = `${firstName} ${lastName}`.trim();
      } else if (format === "last") {
        returnName = `${lastName}`.trim();
      } else if (format === "first") {
        returnName = `${firstName}`.trim();
      } else if (format === "middle") {
        returnName = `${middleName}`.trim();
      } else {
        returnName = name;
      }
      returnName = returnName.replace(/\s,/g, '');
      returnName = returnName.replace(/\s{2,}/g, ' ');
      return returnName;
      //return `${lastName}, ${firstName} ${middleName}`.trim();
    }

    createClientObject(normalizedName) {
      const [lastName, firstMiddle] = normalizedName.split(", ");
      const [firstName, ...middleParts] = (firstMiddle || "").split(" ");
      const middleName = middleParts.join(" ");

      let letterName = `${firstName} ${middleName} ${lastName}`.trim();
      letterName = letterName.replace(/\s{2,}/g, ' ');

      return {
        "Last Name": lastName,
        "First Name": firstName,
        "Middle Name": middleName,
        "PDF Name": normalizedName,
        "Letter Name": letterName,
      };
    }

    /**
     * Handles optional paragraphs in document XML based on document type and data
     * @param {string} content - The XML content of the document
     * @param {string} templateType - The type of template ('expungement' or 'warrant')
     * @returns {string} Modified XML content with appropriate replacements
     */
    handleOptionalParagraphs(content, templateType) {
      if (templateType === "expungement") {
        const patterns = DocumentGenerator.OPTIONAL_PARAGRAPH_PATTERNS.expungement;
    
        for (const [key, pattern] of Object.entries(patterns)) {
          const value = this.alternateInfo[key];  // Access through alternateInfo
          if (value) {
            content = content.replace(pattern.placeholder, value);
          } else {
            content = content.replace(pattern.pattern, pattern.emptyReplacement);
          }
        }
      } else if (templateType === "warrant") {
        if (this.attorneyInfo.isPublicDefender) {
          // Public Defender specific optional paragraphs
          const patterns =
            DocumentGenerator.OPTIONAL_PARAGRAPH_PATTERNS.warrant
              .publicDefender;

          for (const [key, pattern] of Object.entries(patterns)) {
            const value = this.attorneyInfo[key];
            if (value) {
              content = content.replace(pattern.placeholder, value);
            } else {
              content = content.replace(
                pattern.pattern,
                pattern.emptyReplacement
              );
            }
          }
          return content;
        } else {
          // Private attorney specific optional paragraphs
          const patterns =
            DocumentGenerator.OPTIONAL_PARAGRAPH_PATTERNS.warrant
              .privateAttorney;

          for (const [key, pattern] of Object.entries(patterns)) {
            const value = this.attorneyInfo[key];
            if (value) {
              content = content.replace(pattern.placeholder, value);
            } else {
              content = content.replace(
                pattern.pattern,
                pattern.emptyReplacement
              );
            }
          }
        }
      }

      return content;
    }

    ////////////////////////// Generate Expungement Documents //////////////////////////
    selectWarrantTemplate() {
      const template =
        DocumentGenerator.WARRANT_TEMPLATES[
          this.attorneyInfo.isPublicDefender
            ? "publicDefender"
            : "privateAttorney"
        ];

      if (!template) {
        throw new Error("Could not determine appropriate warrant template");
      }

      return template;
    }

    async generateExpungementDocuments(normalizedName, clientCaseList) {
      const pdfTemplatePath = "ExpungementForm.pdf";
      const client = this.createClientObject(normalizedName);
      const pdfBytes = await this.loadPdfTemplate(pdfTemplatePath);
      const pdfDoc = await this.initializeNewPDF(pdfBytes, client);

      let newPage = pdfDoc.addPage([600, 400]);
      let yPosition = this.initializeNewPage(newPage, client["PDF Name"]);

      let hasExpungeableCase = false;

      for (const caseObj of clientCaseList) {
        yPosition = this.addCaseToPage(newPage, caseObj, yPosition);

        if (this.isExpungeableEnoughForPaperwork(caseObj)) {
          await this.generateExpungementLetterDOCX(
            caseObj,
            client,
            client["Letter Name"]
          );
          hasExpungeableCase = true;
        }

        if (yPosition < 50) {
          newPage = pdfDoc.addPage([600, 400]);
          yPosition = this.initializeNewPage(newPage, client["PDF Name"]);
        }
      }

      if (hasExpungeableCase) {
        await this.downloadPDF(pdfDoc, client);
      }
    }

    async loadPdfTemplate(path) {
      const response = await fetch(path);
      return await response.arrayBuffer();
    }
    async initializeNewPDF(pdfBytes, client) {
      const pdfDoc = await window.PDFLib.PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
    
      const clientNameField = form.getTextField("Client_Name");
      const clientHomeAddressField = form.getTextField("Home_Address");
      const clientMailingAddressField = form.getTextField("Mailing_Address");
      const clientPhoneField = form.getTextField("Phone_Number");
      const clientEmailField = form.getTextField("Email");
      const clientDOBField = form.getTextField("Date of Birth");
      const signingDateField = form.getTextField("Signing_Date");
      const sexField = form.getRadioGroup("Sex");
    
      const clientAddressOneLine = [
        this.alternateInfo.addressLine1,
        this.alternateInfo.addressLine2,
        this.alternateInfo.addressLine3
      ]
        .filter(Boolean)
        .join(", ");
    
      clientNameField.setText(client["PDF Name"]);
      clientHomeAddressField.setText(clientAddressOneLine);
      clientMailingAddressField.setText(clientAddressOneLine);
      clientPhoneField.setText(this.alternateInfo.phone);
      clientEmailField.setText(this.alternateInfo.email);
      clientDOBField.setText(this.alternateInfo.dob);
      signingDateField.setText(
        new Date().toLocaleDateString("en-US", {
          timeZone: "HST",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    
      if (this.alternateInfo.sex) {
        sexField.select(this.alternateInfo.sex);
      }
    
      return pdfDoc;
    }

    // async initializeNewPDF(pdfBytes, client) {
    //   const pdfDoc = await window.PDFLib.PDFDocument.load(pdfBytes);
    //   const form = pdfDoc.getForm();

    //   const clientNameField = form.getTextField("Client_Name");
    //   const clientHomeAddressField = form.getTextField("Home_Address");
    //   const clientMailingAddressField = form.getTextField("Mailing_Address");
    //   const clientPhoneField = form.getTextField("Phone_Number");
    //   const clientEmailField = form.getTextField("Email");
    //   const clientDOBField = form.getTextField("Date of Birth");
    //   const signingDateField = form.getTextField("Signing_Date");
    //   const sexField = form.getRadioGroup("Sex");

    //   const clientAddressOneLine = [
    //     this.alternateAddressLine1,
    //     this.alternateAddressLine2,
    //     this.alternateAddressLine3,
    //   ]
    //     .filter(Boolean)
    //     .join(", ");

    //   clientNameField.setText(client["PDF Name"]);
    //   clientHomeAddressField.setText(clientAddressOneLine);
    //   clientMailingAddressField.setText(clientAddressOneLine);
    //   clientPhoneField.setText(this.alternatePhone);
    //   clientEmailField.setText(this.alternateEmail);
    //   clientDOBField.setText(this.alternateDOB);
    //   signingDateField.setText(
    //     new Date().toLocaleDateString("en-US", {
    //       timeZone: "HST",
    //       year: "numeric",
    //       month: "long",
    //       day: "numeric",
    //     })
    //   );

    //   if (this.alternateSex) {
    //     sexField.select(this.alternateSex);
    //   }

    //   return pdfDoc;
    // }

    initializeNewPage(page, clientName) {
      page.drawText(`Client: ${clientName}`, {
        x: 50,
        y: page.getHeight() - 50,
        size: 12,
      });

      const formattedDate = new Date().toLocaleString("en-US", {
        timeZone: "HST",
      });
      page.drawText(`Date and Time (HST): ${formattedDate}`, {
        x: 50,
        y: page.getHeight() - 70,
        size: 10,
      });

      page.drawText(`Cases Reviewed For Expungement`, {
        x: 50,
        y: page.getHeight() - 90,
        size: 10,
      });

      return page.getHeight() - 110;
    }

    addCaseToPage(page, caseObj, yPosition) {
      page.drawText(
        `Case Number: ${caseObj.CaseNumber}: ${caseObj.Expungeable}`,
        {
          x: 50,
          y: yPosition,
          size: 10,
        }
      );
      return yPosition - 20;
    }

    async generateExpungementLetterDOCX(caseObj, client, letterName) {
      const templateUrl = chrome.runtime.getURL(
        "expungement_letter_template.docx"
      );
      const templateResponse = await fetch(templateUrl);
      const templateArrayBuffer = await templateResponse.arrayBuffer();

      const courtLocation = caseObj.CourtLocation;
      const courtAddresses = await window.DataLoaders.loadCourtAddresses();
      const caseNumber = caseObj.CaseNumber;
      const allSearchReplaceTables =
        await window.DataLoaders.loadSearchReplaceTables();
      const searchReplaceTable = allSearchReplaceTables.expungement;

      const courtInfo = this.findCourtAddress(courtAddresses, courtLocation);
      console.log(
        `Generating letter for case ${caseNumber} at ${courtLocation}`
      );

      let courtName = "";
      let courtAddress1 = "";
      let courtAddress2 = "";
      let courtAddress3 = "";

      if (courtInfo) {
        courtName = courtInfo.name;
        [courtAddress1, courtAddress2, courtAddress3 = ""] = courtInfo.address;
      }

      const letterDate = new Date().toLocaleDateString("en-US", {
        timeZone: "HST",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const zip = await JSZip.loadAsync(templateArrayBuffer);
      let documentXmlContent = await zip
        .file("word/document.xml")
        .async("string");

      documentXmlContent = this.handleOptionalParagraphs(
        documentXmlContent,
        "expungement"
      );

      const placeholderToValue = {
        κ: letterName,
        δ: letterDate,
        τ: caseNumber,
        μ: this.alternateInfo.addressLine1,
        ν: this.alternateInfo.addressLine2,
        ε: courtName,
        ζ: courtAddress1,
        η: courtAddress2,
        θ: courtAddress3,
      };

      for (const [placeholder, value] of Object.entries(placeholderToValue)) {
        documentXmlContent = documentXmlContent.replace(
          new RegExp(placeholder, "g"),
          value || ""
        );
      }

      zip.file("word/document.xml", documentXmlContent);
      await this.generateAndDownloadDOCX(zip, client, caseNumber);
    }

    findCourtAddress(courtAddresses, location) {
      for (const circuit of courtAddresses.circuits) {
        for (const court of circuit.courts) {
          if (court.location.some((loc) => location.includes(loc))) {
            return {
              name: court.name,
              address: court.address,
            };
          }
        }
      }
      return null;
    }

    // handleOptionalParagraphs(content) {
    //   if (this.alternateAddressLine3) {
    //     content = content.replace("ξ", this.alternateAddressLine3);
    //   } else {
    //     content = content.replace(
    //       /<w:p w14:paraId="20DEE2BC".*?ξ<\/w:t><\/w:r><\/w:p>/,
    //       ""
    //     );
    //   }

    //   if (this.alternatePhone) {
    //     content = content.replace("φ", this.alternatePhone);
    //   } else {
    //     content = content.replace(
    //       /<w:p w14:paraId="32400D1D".*?φ<\/w:t><\/w:r><\/w:p>/,
    //       ""
    //     );
    //   }

    //   if (this.alternateEmail) {
    //     content = content.replace("ω", this.alternateEmail);
    //   } else {
    //     content = content.replace(
    //       /<w:p w14:paraId="011CD49E".*?ω<\/w:t><\/w:r><\/w:p>/,
    //       ""
    //     );
    //   }

    //   return content;
    // }

    async generateAndDownloadDOCX(zip, client, caseNumber) {
      try {
        const zipContent = await zip.generateAsync({ type: "blob" });
        const docxDownloadLink = document.createElement("a");
        docxDownloadLink.href = URL.createObjectURL(zipContent);
        docxDownloadLink.download = `${
          client["Last Name"] || "name_unavailable"
        }_letter_${caseNumber}.docx`;
        document.body.appendChild(docxDownloadLink);
        docxDownloadLink.click();
        document.body.removeChild(docxDownloadLink);
      } catch (error) {
        console.error("Error generating DOCX file:", error);
      }
    }

    async downloadPDF(pdfDoc, client) {
      try {
        const modifiedPdfBytes = await pdfDoc.save();
        const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${
          client["Last Name"] || "name_unavailable"
        }_form_and_summary.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } catch (error) {
        console.error("Error in downloadPDF:", error);
      }
    }
    ///////////////////////////// Generate Research CSV ////////////////////////////
    // FORMAT FOR NORTH CAROLINA PROFESSOR
    ordinalToCircuitPhrase(ordinal) {
        const ordinalPhraseMap = {
          "first": "1st Circuit",
          "second": "2nd Circuit",
          "third": "3rd Circuit",
          "fourth": "4th Circuit", // Not used in Hawaii
          "fifth": "5th Circuit"
        };
      return ordinalPhraseMap[ordinal] || ordinal;
      }

      ordinalToCircuitNumber(ordinal) {
        const circuitNumberMap = {
          "first": 1,
          "second": 2,
          "third": 3,
          "fourth": 4, // Not used in Hawaii
          "fifth": 5
        };
        return circuitNumberMap[ordinal] || ordinal;
      }

    convertToMMDDYYYY(dateString) {
      // Convert to date object
      const date = new Date(dateString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
          return null; // Invalid date
      }
      // Format the date to MM/DD/YYYY
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }

    getYear(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);

            // Check if date is valid
      if (isNaN(date.getTime())) {
        const parsedDate = dateString.split(',')[1] ? 
        new Date(dateString.split(',')[1] + ',' + dateString.split(',')[2]) : 
        new Date(dateString);
        date = parsedDate;
      }

      if (isNaN(date.getTime())) {
        return "";
      }

      // Format as YYYY
      const year = date.getFullYear();
      return `${year}`;
    }

    // Better case type lookup (from case number or description)
    lookupCaseTypeCode(caseNumber, caseTypeDescription) {
      const lookup = Object.entries(this.eCourtCodes.case_type).reduce(
        (acc, [code, type]) => {
          if (acc[type]) {
            acc[type].push(code);
          } else {
            acc[type] = [code];
          }
          return acc;
        },
        {}
      );

      // Create the reverse lookup map: description -> code
      const reverseLookup = Object.entries(this.eCourtCodes.case_type).reduce(
        (acc, [code, description]) => {
          // Use the first code found for a given description
          if (!acc[description]) {
        acc[description] = code;
          }
          return acc;
        },
        {}
      );

      console.log('caseTypeDescription:', caseTypeDescription);

      // 1. Try lookup by description
      const codeFromDescription = reverseLookup[caseTypeDescription];
      if (codeFromDescription) {
        return codeFromDescription;
      }

      // 2. Try parsing the case number if description lookup failed
      let caseNumberPrefix
      if (caseNumber) {
        //console.log("Case number and case type exist");
        caseNumberPrefix = caseNumber.replace(/^\d+/, "");
        caseNumberPrefix = caseNumberPrefix.split("-")[0];
        caseNumberPrefix = caseNumberPrefix.split(/\d/)[0];
        caseNumberPrefix = caseNumberPrefix.slice(-2);
        return caseNumberPrefix;
      }
      return "";
    }

    // Look up case type description from case type code
    lookupCaseTypeDescription(caseTypeCode) {
      // Create the lookup map: code -> description
      const reverseLookup = Object.entries(this.eCourtCodes.case_type).reduce(
        (acc, [code, description]) => {
          // Use the first code found for a given description
          if (!acc[code]) {
            acc[code] = description;
          }
          return acc;
        },
        {}
      );
      if (reverseLookup[caseTypeCode]) {
        return reverseLookup[caseTypeCode];
      } else if (caseTypeCode.length >= 2) {
        return reverseLookup[caseTypeCode.slice(-2)];
      } else {
        return caseTypeCode;
      }
    }

    unConvertSeverity(severity) {
      const severityToCode = {
        "misdemeanor": "MD",
        "petty misdemeanor": "PM",
        "unknown": "unknown",
        "violation": "VL",
        "felony a": "FA",
        "felony b": "FB",
        "felony c": "FC",
        "§701-108(1) felony": "FA",
        "§701-108(2) felony": "FA",
        "§707-733.6 felony": "FA"
        };
      return severityToCode[severity.toLowerCase()] || severity;
    }

    // GENERATE CSV
    async generateResearchCsv(cases) {
      // Matching North Carolina Prof's field names & format
      const csv_rows = [];
      for (const caseObj of cases) {
        for (const charge of caseObj.charges) {
            csv_rows.push({
              "Defendant": caseObj.DefendantName,
              "Filing Date": this.convertToMMDDYYYY(caseObj.FilingDate),
              "Case ID": caseObj.CaseNumber,
              "Case Title": caseObj.CaseName,
              "Case Type": caseObj.caseType,
              "Case Type Description": this.lookupCaseTypeDescription(caseObj.caseType),
              "Circuit": this.ordinalToCircuitNumber(caseObj.courtCircuit),
              "Offense Date": this.convertToMMDDYYYY(charge.offenseDate),
              "Citation/Arrest #": charge.citationArrestNumbers,
              "Count": charge.count,
              "Charge": charge.charge,
              "Severity": charge.severity,
              "Statute": charge.statute,
              "Disposition": charge.dispositions.length > 0 ? charge.dispositions[charge.dispositions.length - 1] : "",
              "Disposition Code": charge.dispositionCode,
              "Sentence": charge.sentenceDescription,
              "Sentence Length": charge.sentenceLength,
              "Sentence Code": charge.sentenceCode,
              "Court Location": caseObj.CourtLocation,
            })
          }
        }
      
      try {
        // Extract headers from the first row
        if (csv_rows.length === 0) {
          console.warn("No data available to generate CSV");
          return;
        }
        
        const headers = Object.keys(csv_rows[0]);
        
        // Create CSV content with headers as first row
        let csvContent = headers.join(',') + '\n';
        
        // Add data rows
        for (const row of csv_rows) {
          const values = headers.map(header => {
            // Handle values that might contain commas, quotes, or newlines
            const value = row[header] || "";
            const escapedValue = String(value).replace(/"/g, '""');
            return `"${escapedValue}"`;
          });
          csvContent += values.join(',') + '\n';
        }
        
        // Create blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const downloadLink = document.createElement("a");
        
        // Generate filename with current date and system's local time
        // YYYY-MM-DD_HH-MM-SS format
        const now = new Date();
        const dateStr = now.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/[\/,:]/g, '-').replace(' ', '_'); 
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `case_research_data_${dateStr}.csv`;
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        console.log(`CSV with ${csv_rows.length} rows generated successfully`);
      } catch (error) {
        console.error("Error generating research CSV:", error);
      }
    }

    ////////////////////////// Generate Warrant Documents //////////////////////////
    async generateAllWarrantDocuments() {
      const cases = await this.getCases();

      for (const caseObj of cases) {
        if (this.shouldGenerateWarrantPaperwork(caseObj)) {
          await this.generateWarrantDocuments(caseObj);
        }
      }
    }

    async generateWarrantDocuments(caseObj) {
      // Load attorney and warrant information
      await this.loadAttorneyInfo();
      const warrantDetails = await this.loadWarrantDetails(caseObj.CaseNumber);

      // Select template based on attorney type
      const template = this.selectWarrantTemplate();

      // Load template
      const templateUrl = chrome.runtime.getURL(template.filename);
      const templateResponse = await fetch(templateUrl);
      const templateArrayBuffer = await templateResponse.arrayBuffer();

      // Process document with JSZip (similar to expungement letter)
      const zip = await JSZip.loadAsync(templateArrayBuffer);
      let documentXmlContent = await zip
        .file("word/document.xml")
        .async("string");

      // Prepare replacement data
      const replacementData = await this.prepareWarrantReplacementData(
        caseObj,
        warrantDetails
      );

      // Apply replacements
      documentXmlContent = this.applyWarrantReplacements(
        documentXmlContent,
        replacementData,
        template.mapping
      );

      // Save and download
      zip.file("word/document.xml", documentXmlContent);
      await this.generateAndDownloadWarrantDOCX(zip, caseObj);
    }

    async prepareWarrantReplacementData(caseObj, warrantDetails) {
      // Helper function to split date into components
      const getDateComponents = (dateString) => {
        if (!dateString) return { month: "", day: "", year: "" };
        
        // Append timezone if missing to ensure date is parsed as local time and not UTC and then converted
        if (!dateString.includes('T')) {
            dateString = dateString + 'T00:00:00';
        }
        
        const date = new Date(dateString);
        return {
          month: date.toLocaleString("en-US", { month: "long" }),
          day: date.getDate().toString(),
          year: date.getFullYear().toString(),
        };
      };

      // Get date components for all relevant dates
      const warrantIssueDates = getDateComponents(
        warrantDetails.warrantIssueDate
      );
      const nonAppearanceDates = getDateComponents(
        warrantDetails.nonAppearanceDate
      );
      const consultationDates = getDateComponents(
        warrantDetails.consultationDate
      );

      // Format warrant amount (remove any non-numeric characters except decimal point)
      let formattedWarrantAmount = warrantDetails.warrantAmount
        ? warrantDetails.warrantAmount.replace(/[^\d.]/g, "")
        : "";
      // Add commas to separate thousands (accounting for any decimal point)
      const decimalIndex = formattedWarrantAmount.indexOf(".");
      if (decimalIndex > -1) {
        formattedWarrantAmount =
          formattedWarrantAmount
            .slice(0, decimalIndex)
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
          formattedWarrantAmount.slice(decimalIndex);
      } else {
        formattedWarrantAmount = formattedWarrantAmount.replace(
          /\B(?=(\d{3})+(?!\d))/g,
          ","
        );
      }

      // Combine all data sources into a single object
      console.log("Attorney Info:", this.attorneyInfo);
      const replacementData = {
        // Attorney Information
        attorneyName: this.attorneyInfo.attorneyName || "",
        attorneyRegistration: this.attorneyInfo.attorneyRegistration || "",
        attorneySignatureLocation:
          this.attorneyInfo.attorneySignatureLocation || "",

        // Public Defender specific fields
        headPdName: this.attorneyInfo.headPdName || "",
        headPdRegistration: this.attorneyInfo.headPdRegistration || "",

        // Private Attorney specific fields
        firmName: this.attorneyInfo.firmName || "",
        attorneyAddress1: this.attorneyInfo.attorneyAddress1 || "",
        attorneyAddress2: this.attorneyInfo.attorneyAddress2 || "",
        attorneyAddress3: this.attorneyInfo.attorneyAddress3 || "",
        attorneyAddress4: this.attorneyInfo.attorneyAddress4 || "",
        attorneyTelephone: this.attorneyInfo.attorneyTelephone || "",
        attorneyFax: this.attorneyInfo.attorneyFax || "",
        attorneyEmail: this.attorneyInfo.attorneyEmail || "",

        // Case Information
        caseNumber: caseObj.CaseNumber || "",
        //defendantNameFull: caseObj.DefendantName || "",
        defendantNameFull: this.normalizeDefendantName(caseObj.DefendantName, "first middle last") || "",
        courtCircuit: caseObj.courtCircuit || "",

        // Warrant Information
        warrantIssueMonth: warrantIssueDates.month,
        //warrantIssueMonth: new Date(warrantDetails.warrantIssueDate).toLocaleString('en-US', { month: 'long' }),
        warrantIssueDay: warrantIssueDates.day,
        warrantIssueYear: warrantIssueDates.year,
        warrantAmount: formattedWarrantAmount,

        // Non-appearance Information
        nonAppearanceMonth: nonAppearanceDates.month,
        nonAppearanceDay: nonAppearanceDates.day,
        nonAppearanceYear: nonAppearanceDates.year,

        // Consultation Information
        consultationMonth: consultationDates.month,
        consultationDay: consultationDates.day,
        consultationYear: consultationDates.year,
        consultationTown: warrantDetails.consultationTown || "",
        consultVerbPhrase: warrantDetails.consultVerbPhrase || "",        
      };
      
      // Literal values will be handled when replacements are performed

      // Log prepared data for debugging
      console.log("Prepared warrant replacement data:", replacementData);

      return replacementData;
    }

    applyWarrantReplacements(
      documentXmlContent,
      replacementData,
      templateMapping
    ) {
      // 
      console.log("Applying warrant replacements to document XML content");
      console.log("Replacement data:", replacementData);

      // First handle optional paragraphs based on attorney type
      documentXmlContent = this.handleOptionalParagraphs(
        documentXmlContent,
        "warrant"
      );

      // Then handle all regular replacements using the template mapping
      for (let [placeholder, dataKey] of Object.entries(templateMapping)) {
        let replacementValue
        // Remove "literal: " from dataKey starting with "literal: ..."
        // and set replacementValue to the part of the string removed
        if (dataKey.startsWith("literal: ")) {
          replacementValue = dataKey.slice(8);
        } else {
          replacementValue = replacementData[dataKey] || '';
        }
        
        console.log(`Replacing ${placeholder} with ${dataKey}`);

        
        //const replacementValue = replacementData[dataKey] || "";
        const placeholderRegex = new RegExp(placeholder, "g");
        documentXmlContent = documentXmlContent.replace(
          placeholderRegex,
          replacementValue
        );
      }

      return documentXmlContent;
    }

    async generateAndDownloadWarrantDOCX(zip, caseObj) {
      try {
        // Generate the zip content
        const zipContent = await zip.generateAsync({ type: "blob" });

        // Create filename based on case info
        const filename = this.generateWarrantFilename(caseObj);

        // Create download link
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(zipContent);
        downloadLink.download = filename;

        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Log success
        console.log(
          `Warrant paperwork generated for case ${caseObj.CaseNumber}`
        );
      } catch (error) {
        console.error("Error generating warrant DOCX file:", error);
        throw new Error(
          `Failed to generate warrant paperwork for case ${caseObj.CaseNumber}: ${error.message}`
        );
      }
    }

    generateWarrantFilename(caseObj) {
      const safeName = (this.normalizeDefendantName(caseObj.DefendantName, "last") || "unknown_defendant")
        .replace(/\.[a-zA-Z]/g, "").replace(/[^a-zA-Z0-9, ]/g, "_")
        //.toLowerCase();

      return `${safeName}_warrant_${caseObj.CaseNumber}.docx`;
    }
  }
  return DocumentGenerator;
})();

// Make DocumentGenerator available globally
window.DocumentGenerator = DocumentGenerator;
