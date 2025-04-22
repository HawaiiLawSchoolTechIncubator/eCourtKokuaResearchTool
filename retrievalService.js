// retrievalService.js
function retrieveRecord(caseID, action = 'log') {
    // 1. Identify the form element and search page type
    const form = document.forms["frm"];
    const pageTitle = document.querySelector('.main-content-pagetitle').textContent;
    console.log(`Search results type: ${pageTitle}`);

    // 2. Find the link element for this case to get its correct index
    // const caseLink = [...document.querySelectorAll('[id*="caseIdLink"]')].find(
    //     link => link.textContent.trim() === caseID
    // );
    const caseLink = [...document.querySelectorAll('[id*="caseIdLink"]')].find(
        link => link.getAttribute('onclick')?.includes(caseID)
    );

    if (!caseLink) {
        console.error(`Could not find link element for case ${caseID}`);
        return Promise.reject(new Error(`Case link not found for ${caseID}`));
    }

    // Extract the index from the link ID (format is "frm:partyNameSearchResultsTableIntECC:XX:caseIdLink")
    const linkIndex = caseLink.id.split(':')[2];
    console.log(`Using index ${linkIndex} for case ${caseID}`);

    // 3. Set hidden fields using the correct index
    if (pageTitle === "Case Search Results") {
        form["frm:j_idcl"].value = `frm:searchResultsTable:${linkIndex}:caseIdLink`;
    } else if (pageTitle === "Name Search") {
        form["frm:j_idcl"].value = `frm:partyNameSearchResultsTableIntECC:${linkIndex}:caseIdLink`;
    }

    form["caseID"].value = caseID;

    // 3. Build a FormData object
    const formData = new FormData(form);

    // 4. Send the POST request
    return fetch(form.action, {
        method: "POST",
        body: formData,
        credentials: "include"
    })
    .then(response => response.text())
    .then(responseText => {
        if (action === 'log') {
            console.log("Response from server:", responseText);
            return responseText;
        } else if (action === 'return') {
            return responseText;
        } else {
            console.error("Invalid action:", action);
            return null;
        }
    })
    .catch(error => {
        console.error("Error:", error);
        return null;
    })
    .finally(() => {
        // 5. Clear the hidden fields
        form["frm:j_idcl"].value = "";
        form["caseID"].value = "";
    });
}

async function retrieveAllAndReturn() {
    console.log("Starting retrieveAllAndReturn");
    const results = [];
    const caseIDLinks = document.querySelectorAll('[id*="caseIdLink"]');
    
    for (const link of caseIDLinks) {
        //const caseID = link.textContent.trim();
        let caseID
        const onclickAttr = link.getAttribute("onclick");
        if (onclickAttr) {
            const match = onclickAttr.match(/form\['caseID'\]\.value='(.*?)'/);
            if (match) {
                caseID = match[1]; // Extract the correct case ID
            }
            console.log('Extracted onClick case ID:', caseID);
        } else {
            caseID = link.textContent.trim();
            console.log('Using text content case ID:', caseID);
        }
        console.log(`Retrieving record for case ID: ${caseID}...`);
        
        try {
            const htmlResponse = await retrieveRecord(caseID, 'return');
            
            // Emit result immediately for each case
            const result = {
                caseID,
                html: htmlResponse
            };
            results.push(result);

            // Dispatch custom event with the result
            const resultEvent = new CustomEvent('caseProcessed', { 
                detail: result 
            });
            document.dispatchEvent(resultEvent);
            
        } catch (error) {
            console.error(`Error retrieving case ${caseID}:`, error);
            // Still dispatch event but with error info
            const resultEvent = new CustomEvent('caseProcessed', {
                detail: {
                    caseID,
                    error: error.message
                }
            });
            document.dispatchEvent(resultEvent);
        }
    }
    
    return results;
}