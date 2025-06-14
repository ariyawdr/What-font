const STYLE_ELEMENT_ID = 'smart-font-tweaker-style';
const ARABIC_SCRIPT_REGEX = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LTR_CHAR_REGEX = /[a-zA-Z0-9 -À-ÿĀ-ſ]/;

let masterEnabledState = { masterEnabled: true };
let currentDomainDirectionSettings = { autoDirectionEnabled: true };
let pageDirectionAnalysisDone = false;
let appliedDirectionElements = new Set();

function getStyleElement() {
  let styleElement = document.getElementById(STYLE_ELEMENT_ID);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
    styleElement.textContent = "/* --- Font CSS Start --- */\n/* --- Font CSS End --- */\n/* --- Direction CSS Start --- */\n/* --- Direction CSS End --- */";
  } else if (!styleElement.textContent.includes("/* --- Font CSS Start --- */")) {
    styleElement.textContent = "/* --- Font CSS Start --- */\n/* --- Font CSS End --- */\n/* --- Direction CSS Start --- */\n/* --- Direction CSS End --- */";
  }
  return styleElement;
}

function applyFontToPage(fontConfig) {
  if (!masterEnabledState.masterEnabled) {
    console.log("CS: Master DISABLED, font not applied.");
    return;
  }
  const styleElement = getStyleElement();
  let existingDirectionCSS = "";
  const dirMatch = styleElement.textContent.match(/\/\* --- Direction CSS Start --- \*\/(.*?)\/\* --- Direction CSS End --- \*\//s);
  existingDirectionCSS = (dirMatch && dirMatch[1]) ? dirMatch[1] : "";

  let fontCSS = '';
  if (fontConfig.source === 'custom' && fontConfig.url) {
    fontCSS += `@font-face { font-family: "${fontConfig.name}"; src: url('${fontConfig.url}'); font-weight: ${fontConfig.weight || 'normal'}; }\n`;
  }
  fontCSS += `body, body * { font-family: "${fontConfig.name}", sans-serif !important; font-weight: ${fontConfig.weight || 'normal'} !important; }\n`;
  
  styleElement.textContent = `/* --- Font CSS Start --- */\n${fontCSS}/* --- Font CSS End --- */\n/* --- Direction CSS Start --- */${existingDirectionCSS}/* --- Direction CSS End --- */`;
  console.log(`CS: Applied font: ${fontConfig.name}`);
}

function resetFontOnPage() {
  const styleElement = getStyleElement();
  let existingDirectionCSS = "";
  const dirMatch = styleElement.textContent.match(/\/\* --- Direction CSS Start --- \*\/(.*?)\/\* --- Direction CSS End --- \*\//s);
  existingDirectionCSS = (dirMatch && dirMatch[1]) ? dirMatch[1] : "";
  styleElement.textContent = `/* --- Font CSS Start --- */\n/* --- Font CSS End --- */\n/* --- Direction CSS Start --- */${existingDirectionCSS}/* --- Direction CSS End --- */`;
  console.log("CS: Font styles reset.");
}

function updateDirectionStylesOnPage(cssContent) {
    const styleElement = getStyleElement();
    let existingFontCSS = "";
    const fontMatch = styleElement.textContent.match(/\/\* --- Font CSS Start --- \*\/(.*?)\/\* --- Font CSS End --- \*\//s);
    existingFontCSS = (fontMatch && fontMatch[1]) ? fontMatch[1] : "";
    styleElement.textContent = `/* --- Font CSS Start --- */${existingFontCSS}/* --- Font CSS End --- */\n/* --- Direction CSS Start --- */\n${cssContent}\n/* --- Direction CSS End --- */`;
}

function hasSignificantArabicText(text) {
  if (!text || text.length < 10) return false;
  let arabicChars = 0;
  for (let i = 0; i < text.length; i++) if (ARABIC_SCRIPT_REGEX.test(text[i])) arabicChars++;
  return (arabicChars / text.length) > 0.3 || arabicChars > 5;
}

function isPrimarilyLtr(text) {
  if (!text || text.length < 5) return false;
  let ltrChars = 0, rtlChars = 0;
  for (let char of text) {
    if (LTR_CHAR_REGEX.test(char)) ltrChars++;
    else if (ARABIC_SCRIPT_REGEX.test(char)) rtlChars++;
  }
  if (ltrChars === 0 && rtlChars === 0) return false;
  return ltrChars / (ltrChars + rtlChars + 0.01) > 0.6;
}

function normalizeChildrenDirection(parentElement) {
  if (['PRE', 'CODE', 'KBD', 'SAMP', 'TEXTAREA', 'INPUT', 'STYLE', 'SCRIPT', 'NOSCRIPT'].includes(parentElement.tagName)) return;
  for (let i = 0; i < parentElement.childNodes.length; i++) {
    const child = parentElement.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE && child.id !== STYLE_ELEMENT_ID) {
      const childTextContent = child.textContent;
      if (isPrimarilyLtr(childTextContent)) {
        const childStyle = window.getComputedStyle(child);
        if (childStyle.direction !== 'ltr' || (childStyle.textAlign !== 'left' && childStyle.textAlign !== 'start')) {
          child.style.setProperty('direction', 'ltr', 'important');
          child.style.setProperty('text-align', 'left', 'important');
          child.setAttribute('data-sft-normalized-ltr', 'true');
          appliedDirectionElements.add(child);
        }
      } else if (ARABIC_SCRIPT_REGEX.test(childTextContent)) {
        const childStyle = window.getComputedStyle(child);
        if (childStyle.textAlign === 'left' || (childStyle.textAlign === 'start' && window.getComputedStyle(parentElement).direction === 'rtl')) {
          child.style.setProperty('text-align', 'right', 'important');
          child.setAttribute('data-sft-realigned-rtl-child', 'true');
          appliedDirectionElements.add(child);
        }
        normalizeChildrenDirection(child);
      }
    }
  }
}

function applyDirectionStylesToElement(element, needsRtl, needsTextAlignRight) {
  let stylesApplied = false;
  if (needsRtl) {
    if (element.style.direction !== 'rtl' || element.style.getPropertyPriority('direction') !== 'important') {
      element.style.setProperty('direction', 'rtl', 'important');
      element.style.setProperty('text-align', 'right', 'important');
      element.setAttribute('data-sft-rtl-applied', 'true');
      stylesApplied = true;
    } else if (element.style.textAlign !== 'right' || element.style.getPropertyPriority('text-align') !== 'important') {
      element.style.setProperty('text-align', 'right', 'important');
      stylesApplied = true;
    }
  } else if (needsTextAlignRight) {
    if (element.style.textAlign !== 'right' || element.style.getPropertyPriority('text-align') !== 'important') {
      element.style.setProperty('text-align', 'right', 'important');
      element.setAttribute('data-sft-text-align-applied', 'true');
      stylesApplied = true;
    }
  }

  if (stylesApplied) {
    appliedDirectionElements.add(element);
    if (needsRtl) normalizeChildrenDirection(element);
  }
}

function analyzeElementDirection(element) {
  if (element.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT', 'BR', 'HR'].includes(element.tagName) || element.id === STYLE_ELEMENT_ID || element.closest('#' + STYLE_ELEMENT_ID) || element.isContentEditable) {
    return;
  }
  let directText = '';
  for (let childNode of element.childNodes) if (childNode.nodeType === Node.TEXT_NODE) directText += childNode.textContent;

  if (hasSignificantArabicText(directText)) {
    const computedStyle = window.getComputedStyle(element);
    let needsRtl = computedStyle.direction !== 'rtl';
    let needsTextAlignRight = (needsRtl || computedStyle.textAlign === 'left' || (computedStyle.textAlign === 'start' && computedStyle.direction === 'rtl'));
    if(needsRtl || needsTextAlignRight) applyDirectionStylesToElement(element, needsRtl, needsTextAlignRight);
  }
  for (let child of element.children) analyzeElementDirection(child);
}

function runPageDirectionAnalysis() {
  if (!masterEnabledState.masterEnabled) {
    console.log("CS: Master DISABLED, skipping direction analysis.");
    resetAllAppliedDirectionStyles(); 
    return;
  }
  if (!currentDomainDirectionSettings.autoDirectionEnabled) {
    console.log("CS: Auto direction handling is DISABLED for this domain. Resetting styles.");
    resetAllAppliedDirectionStyles();
    return;
  }
  if (pageDirectionAnalysisDone && currentDomainDirectionSettings.autoDirectionEnabled) {
      console.log("CS: Direction analysis already performed and enabled.");
      return;
  }
  console.log("CS: Starting page direction analysis (Master & Domain Direction enabled).");
  resetAllAppliedDirectionStyles(); 
  if (document.body) analyzeElementDirection(document.body);
  pageDirectionAnalysisDone = true;
  console.log("CS: Page direction analysis finished.");
}

function resetAllAppliedDirectionStyles() {
  console.log("CS: Resetting all applied direction styles for", appliedDirectionElements.size, "elements.");
  appliedDirectionElements.forEach(element => {
    if(element.getAttribute('data-sft-rtl-applied') || element.getAttribute('data-sft-text-align-applied')) {
        element.style.removeProperty('direction');
        element.style.removeProperty('text-align');
    }
    if(element.getAttribute('data-sft-normalized-ltr')) {
        element.style.removeProperty('direction');
        element.style.removeProperty('text-align');
    }
    ['data-sft-rtl-applied', 'data-sft-text-align-applied', 'data-sft-normalized-ltr', 'data-sft-realigned-rtl-child'].forEach(attr => {
        if (element.hasAttribute(attr)) element.removeAttribute(attr);
    });
  });
  appliedDirectionElements.clear();
  updateDirectionStylesOnPage(""); 
  console.log("CS: All direction styles reset and cleared from style tag.");
  pageDirectionAnalysisDone = false;
}

async function loadInitialSettingsAndRun() {
  const domain = window.location.hostname || (window.location.protocol === "file:" ? "local_files" : null);

  if (domain) {
    const masterStorageKey = `masterEnable_${domain}`;
    const masterResult = await browser.storage.local.get(masterStorageKey);
    masterEnabledState = masterResult[masterStorageKey] || { masterEnabled: true }; 
  } else { // For pages like about:blank where content scripts might not run or have no domain
    masterEnabledState = { masterEnabled: false }; // Default to disabled
  }
  console.log(`CS: Initial master state for '${domain || 'page'}':`, masterEnabledState);

  if (!masterEnabledState.masterEnabled) {
    console.log("CS: Master DISABLED at init. Resetting all features.");
    resetFontOnPage(); 
    resetAllAppliedDirectionStyles(); 
    return; 
  }

  // Master is ENABLED
  try {
    const fontResult = await browser.storage.local.get('globalFontConfig');
    if (fontResult.globalFontConfig) {
      applyFontToPage(fontResult.globalFontConfig); 
    } else {
      resetFontOnPage(); 
    }
  } catch (error) { console.error("CS: Error applying stored font:", error); }
  
  if (domain) { // Load direction settings only if we have a domain (and master is enabled)
    const dirStorageKey = `directionSettings_${domain}`;
    const dirResult = await browser.storage.local.get(dirStorageKey);
    currentDomainDirectionSettings = dirResult[dirStorageKey] || { autoDirectionEnabled: true };
  } else { 
    // This case (no domain but master enabled) should be rare. Default direction to true.
    currentDomainDirectionSettings = { autoDirectionEnabled: true }; 
  }
  console.log(`CS: Master enabled. Direction settings for '${domain || 'page'}':`, currentDomainDirectionSettings);

  if (document.readyState === "complete" || document.readyState === "interactive" || document.readyState === "loaded") {
    setTimeout(runPageDirectionAnalysis, 600); 
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(runPageDirectionAnalysis, 600));
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("CS: Received message:", message);
  if (message.action === "applyFont" && message.fontConfig) {
    applyFontToPage(message.fontConfig); 
    sendResponse({ status: "font apply attempt done" });
  } else if (message.action === "resetFont") {
    resetFontOnPage(); 
    sendResponse({ status: "font reset" });
  } else if (message.action === "directionSettingsChanged") {
    console.log("CS: Direction settings changed:", message.settings);
    currentDomainDirectionSettings = message.settings;
    if (masterEnabledState.masterEnabled) { 
        pageDirectionAnalysisDone = false; 
        runPageDirectionAnalysis(); 
    }
    sendResponse({ status: "direction settings updated" });
  } else if (message.action === "masterEnableChanged") {
    console.log("CS: Master enable changed:", message.settings);
    masterEnabledState = message.settings;
    pageDirectionAnalysisDone = false; 

    if (!masterEnabledState.masterEnabled) {
      resetFontOnPage(); 
      resetAllAppliedDirectionStyles(); 
    } else {
      (async () => {
        const fontResult = await browser.storage.local.get('globalFontConfig');
        if (fontResult.globalFontConfig) applyFontToPage(fontResult.globalFontConfig);
        else resetFontOnPage();
        // Need to re-load domain specific direction settings before running analysis
        const domain = window.location.hostname || (window.location.protocol === "file:" ? "local_files" : null);
        if(domain){
            const dirStorageKey = `directionSettings_${domain}`;
            const dirResult = await browser.storage.local.get(dirStorageKey);
            currentDomainDirectionSettings = dirResult[dirStorageKey] || { autoDirectionEnabled: true };
        } else {
            currentDomainDirectionSettings = { autoDirectionEnabled: true };
        }
        runPageDirectionAnalysis(); 
      })();
    }
    sendResponse({ status: "master enable updated" });
  }
  return true; 
});

loadInitialSettingsAndRun();
console.log("Smart Font & Direction Tweaker content script initialized.");
