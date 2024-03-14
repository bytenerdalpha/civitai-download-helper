// ==UserScript==
// @name         CivitAI resource downloader
// @version      0.1
// @description  Extract resources required to re-create a civitai generation and downloads them
// @author       bytenerdalpha
// @match        https://*civitai.com/images/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=civitai.com
// @grant        GM.xmlHttpRequest
// @updateURL    https://raw.githubusercontent.com/bytenerdalpha/civitai-download-helper/main/civitai-monkey.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @require      https://update.greasyfork.org/scripts/470224/1303666/Tampermonkey%20Config.js
// ==/UserScript==

(function() {
    'use strict';
    const config_desc = { // Config description
        enabled: {
            name: "Pruned model",
            value: true,
            input: "current",
            processor: "not", // Process user inputs, throw error if invalid
            // Built-in processors:
            // "same": Return user input directly (default value)
            // "not": Invert boolean value
            // "int": Convert to integer
            // "int_range-min-max": Convert to integer in range [min, max], raise error if invalid ("" for no limit)
            // "float": Convert to float
            // "float_range-min-max": Convert to float in range [min, max], raise error if invalid ("" for no limit)
            // <function>: Custom function to process value
            //     (input) => stored
            formatter: "boolean", // Format value to be displayed in menu command
            // Built-in formatters:
            // "normal": `${name}: ${value}`
            // "boolean": `${name}: ${value ? "✔" : "✘"}`
            // <function>: Custom function to format value
            //     (name, value) => string
        }
    }
    const config = GM_config(config_desc, false); // Register menu commands
    window.addEventListener(GM_config_event, (e) => { // Listen to config changes
        console.log(e.detail);
    });
    // window.setTimeout(() => { // Change config values, and menu commands will be updated automatically
    //     config.val += 1; // Remember to validate the value before setting it
    // }, 5000);


// Define svg path data for the icons to be used in the extension, one for JSON, one for processing one for error and one for success
    const jsonIconPath = "M20 16v-8l3 8v-8 M15 8a2 2 0 0 1 2 2v4a2 2 0 1 1 -4 0v-4a2 2 0 0 1 2 -2z M1 8h3v6.5a1.5 1.5 0 0 1 -3 0v-.5 M7 15a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1";
    const processingIconPath = "M12 6l0 -3 M16.25 7.75l2.15 -2.15 M18 12l3 0 M16.25 16.25l2.15 2.15 M12 18l0 3 M7.75 16.25l-2.15 2.15 M6 12l-3 0 M7.75 7.75l-2.15 -2.15";
    const errorIconPath = "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 9v4M12 16v.01";
    const successIconPath = "M5 12l5 5l10 -10";

    function postApi(resourceDownUrl, modelVersionId, resourceType, fileName, resourceNameNormalized) {
        fetch('http://localhost:8000/civitai/v1/resource/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'   // CORS allow all
            },
            body: JSON.stringify({
                url: resourceDownUrl,
                modelVersionId: modelVersionId,
                resourceType: resourceType,
                name: fileName,
                resourceNameNormalized: resourceNameNormalized
            })
        }).then(response => response.json())
            .then(data => console.log(data))
            .catch((error) => console.error('Error:', error));
    }

    const civ_down_icon = '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"></path><path d="M7 11l5 5l5 -5"></path><path d="M12 4l0 12"></path>';

    function replaceRunButton() {

        let div = document.createElement('div');
        // div.innerHTML = civ_down_icon;
        // btnBar.prepend(div);


        const iconText = document.querySelector(".mantine-Stack-root.mantine-896gbg")
        const runButton = document.querySelector(".mantine-UnstyledButton-root.mantine-ActionIcon-root.mantine-1tbxpdw").closest("button");
        const icon = document.querySelector(".tabler-icon.tabler-icon-x");
        // icon.innerHTML = civ_down_icon;
        // icon.setAttribute("d", jsonIconPath);
        runButton.style.backgroundColor = "#343a40";
        icon.parentElement.setAttribute("stroke", "white");


        runButton.addEventListener("mouseover", (event) => {
            const tooltip = runButton.previousSibling;
            if (tooltip.classList.contains("mantine-Tooltip-tooltip")) {
                tooltip.innerText = "Download Resources through civ-py";
            }
        });

        const downloadURI = (uri, name) => {
            const link = document.createElement("a");
            link.download = name;
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        runButton.addEventListener("click", async (event) => {
            event.stopImmediatePropagation();
            icon.setAttribute("d", processingIconPath);
            runButton.style.backgroundColor = "#1971c2";
            let els = document.getElementsByClassName("mantine-4xj3rk");

            try {
                for (let i = 0; i < els.length; i++) {
                    const el = els[i];
                    const resourceType = el.querySelector(".mantine-h9iq4m.mantine-Badge-inner").textContent;
                    const resourceNameFull = el.querySelector(".mantine-Text-root.mantine-p6jtwo").textContent;
                    const modelHref = el.href
                    let resourceNameNormalized = resourceNameFull.replace(/[^a-zA-Z0-9]/g, '')
                    const modelVersionId = modelHref.split("modelVersionId=")[1]
                    const resourceTypeMap = {
                        embedding: ".pt",
                        lycoris: ".safetensors",
                        lora: ".safetensors",
                        checkpoint: ".safetensors"
                    };
                    resourceNameNormalized = resourceNameNormalized + resourceTypeMap[resourceType.toLowerCase()]
                    let fileName = resourceType.toLowerCase() + "_" + resourceNameNormalized + resourceTypeMap[resourceType.toLowerCase()];

                    let resourceDownUrl = "https://civitai.com/api/download/models/" + modelVersionId;

                    if (resourceType.toLowerCase() === "checkpoint") {
                        if (config.enabled) {
                            resourceDownUrl += "?type=Model&format=SafeTensor&size=pruned&fp=fp16";
                        } else {
                            resourceDownUrl += "?type=Model&format=SafeTensor&size=full&fp=fp16";
                        }
                    }
                    // downloadURI(resourceDownUrl, fileName);

                    postApi(resourceDownUrl, modelVersionId, resourceType.toLowerCase(), fileName, resourceNameNormalized);


                    // console.log(el);
                    // console.log(resourceType);
                    // console.log(resourceNameFull);
                    // console.log(resourceNameNormalized);
                    // console.log(modelHref)
                    // console.log(modelVersionId)
                    // console.log(fileName)
                }
            } catch (error) {
                console.log(`ERROR: ${error}`);
                icon.setAttribute("d", errorIconPath);
                runButton.style.backgroundColor = "#C92A2A";
                alert("Error. Check console for details.");
                return;
            }
            icon.setAttribute("d", successIconPath);
            runButton.style.backgroundColor = "#2F9E44";
        });
    }

    // Replace the run button when the page loads
    replaceRunButton();

    // use a mutation observer to replace the run button when the page title changes
    const titleObserver = new MutationObserver(replaceRunButton);
    titleObserver.observe(document.querySelector('title'), {childList: true, subtree: true});
})();