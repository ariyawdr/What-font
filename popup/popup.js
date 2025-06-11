document.addEventListener('DOMContentLoaded', () => {
  // Font Settings Elements
  const fontSourceSelect = document.getElementById('fontSource');
  const googleFontSettingsDiv = document.getElementById('googleFontSettings');
  const customFontSettingsDiv = document.getElementById('customFontSettings');
  const googleFontNameInput = document.getElementById('googleFontName');
  const customFontNameInput = document.getElementById('customFontName');
  const customFontUrlInput = document.getElementById('customFontUrl');
  const fontWeightInput = document.getElementById('fontWeight');
  const fontPreviewDiv = document.getElementById('fontPreview');
  const applyFontButton = document.getElementById('applyFont');
  const resetFontButton = document.getElementById('resetFont');

  // Tab Navigation Elements
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Direction Settings Elements
  const directionSettingsTabContainer = document.getElementById('directionSettingsTab');
  const currentDomainLabel = document.getElementById('currentDomainLabel'); // For direction tab
  const autoDirectionToggle = document.getElementById('autoDirectionToggle');

  // Master Toggle Elements
  const masterEnableToggle = document.getElementById('masterEnableToggle');
  const masterCurrentDomainLabel = document.getElementById('masterCurrentDomainLabel');

  let currentTabDomain = null;

  function getDomainFromUrl(url) {
    if (!url) return null;
    try {
      const urlObject = new URL(url);
      if (urlObject.protocol === "file:") {
        return "local_files";
      }
      return urlObject.hostname;
    } catch (e) {
      console.error("Invalid URL, cannot extract domain:", url, e);
      return null;
    }
  }

  function setMainControlsDisabled(disabled) {
    const fontSettingsContainer = document.getElementById('fontSettingsTab');
    if (fontSettingsContainer) {
        const inputs = fontSettingsContainer.querySelectorAll('input, select, button');
        inputs.forEach(input => input.disabled = disabled);
    }
    if (directionSettingsTabContainer) {
      const inputs = directionSettingsTabContainer.querySelectorAll('input, select, button');
      inputs.forEach(input => input.disabled = disabled);
    }
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const tabId = button.getAttribute('data-tab');
      tabContents.forEach(content => {
        content.style.display = content.id === tabId ? 'block' : 'none';
      });

      if (tabId === 'directionSettingsTab') {
        loadDirectionSettingsForCurrentTab();
      }
    });
  });

  if (fontSourceSelect) {
    fontSourceSelect.addEventListener('change', () => {
      if(googleFontSettingsDiv) googleFontSettingsDiv.style.display = fontSourceSelect.value === 'google' ? 'block' : 'none';
      if(customFontSettingsDiv) customFontSettingsDiv.style.display = fontSourceSelect.value === 'custom' ? 'block' : 'none';
    });

    function updateFontPreview() {
      let fontName = '';
      if (fontSourceSelect.value === 'google' && googleFontNameInput && googleFontNameInput.value.trim()) {
        fontName = googleFontNameInput.value.trim();
      } else if (fontSourceSelect.value === 'custom' && customFontNameInput && customFontNameInput.value.trim()) {
        fontName = customFontNameInput.value.trim();
      }
      if (fontPreviewDiv) {
        fontPreviewDiv.style.fontFamily = fontName ? `"${fontName}", sans-serif` : 'sans-serif';
        if(fontWeightInput) fontPreviewDiv.style.fontWeight = fontWeightInput.value.trim() || 'normal';
      }
    }

    [googleFontNameInput, customFontNameInput, fontWeightInput].forEach(input => {
      if (input) input.addEventListener('input', updateFontPreview);
    });

    if(applyFontButton) {
      applyFontButton.addEventListener('click', async () => {
        const fontConfig = {
          source: fontSourceSelect.value,
          name: googleFontNameInput && fontSourceSelect.value === 'google' ? googleFontNameInput.value.trim() : (customFontNameInput ? customFontNameInput.value.trim() : ''),
          url: customFontUrlInput && fontSourceSelect.value === 'custom' ? customFontUrlInput.value.trim() : '',
          weight: fontWeightInput ? fontWeightInput.value.trim() || 'normal' : 'normal'
        };
        if (!fontConfig.name) { alert('Please enter a font name.'); return; }
        if (fontConfig.source === 'custom' && !fontConfig.url) { alert('Please enter a font URL.'); return; }

        await browser.storage.local.set({ globalFontConfig: fontConfig });
        try {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            await browser.tabs.sendMessage(tab.id, { action: "applyFont", fontConfig });
          }
        } catch (error) { console.error("Error sending applyFont message:", error); }
      });
    }

    if(resetFontButton) {
      resetFontButton.addEventListener('click', async () => {
        if(googleFontNameInput) googleFontNameInput.value = '';
        if(customFontNameInput) customFontNameInput.value = '';
        if(customFontUrlInput) customFontUrlInput.value = '';
        if(fontWeightInput) fontWeightInput.value = '';
        updateFontPreview();
        await browser.storage.local.remove('globalFontConfig');
        try {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            await browser.tabs.sendMessage(tab.id, { action: "resetFont" });
          }
        } catch (error) { console.error("Error sending resetFont message:", error); }
      });
    }
  }

  async function loadFontSettings() {
    if (!fontSourceSelect) return;
    const result = await browser.storage.local.get('globalFontConfig');
    if (result.globalFontConfig) {
      const config = result.globalFontConfig;
      fontSourceSelect.value = config.source;
      if (config.source === 'google') {
        if(googleFontNameInput) googleFontNameInput.value = config.name;
      } else {
        if(customFontNameInput) customFontNameInput.value = config.name;
        if(customFontUrlInput) customFontUrlInput.value = config.url;
      }
      if(fontWeightInput) fontWeightInput.value = config.weight || 'normal';

      if (googleFontSettingsDiv && customFontSettingsDiv) {
        if (fontSourceSelect.value === 'google') {
            googleFontSettingsDiv.style.display = 'block';
            customFontSettingsDiv.style.display = 'none';
        } else {
            googleFontSettingsDiv.style.display = 'none';
            customFontSettingsDiv.style.display = 'block';
        }
      }
      updateFontPreview();
    }
  }

  async function loadDirectionSettingsForCurrentTab() {
    if (!currentDomainLabel || !autoDirectionToggle) return;
    if (!currentTabDomain) {
        console.warn("currentTabDomain not set before loading direction settings.");
        currentDomainLabel.textContent = "Error";
        autoDirectionToggle.disabled = true;
        autoDirectionToggle.checked = false;
        return;
    }
    currentDomainLabel.textContent = currentTabDomain === "local_files" ? "Local Files" : currentTabDomain;
    if (!masterEnableToggle || masterEnableToggle.checked) {
        const storageKey = `directionSettings_${currentTabDomain}`;
        const result = await browser.storage.local.get(storageKey);
        const enabled = result[storageKey] ? result[storageKey].autoDirectionEnabled : true;
        autoDirectionToggle.checked = enabled;
    }
  }

  async function persistDirectionSettings() {
    if (!currentTabDomain || !autoDirectionToggle) return;
    if (masterEnableToggle && !masterEnableToggle.checked) {
        console.log("Master toggle is off, not persisting direction settings.");
        return;
    }
    const settings = { autoDirectionEnabled: autoDirectionToggle.checked };
    const storageKey = `directionSettings_${currentTabDomain}`;
    await browser.storage.local.set({ [storageKey]: settings });
    console.log(`Direction settings saved for ${currentTabDomain}:`, settings);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await browser.tabs.sendMessage(tab.id, {
          action: "directionSettingsChanged",
          settings: settings
        });
      }
    } catch (e) { console.error("Error sending directionSettingsChanged message:", e); }
  }

  async function loadMasterToggleState() {
    if (!masterEnableToggle || !masterCurrentDomainLabel) return;
    if (!currentTabDomain) {
      masterCurrentDomainLabel.textContent = "N/A";
      masterEnableToggle.disabled = true;
      masterEnableToggle.checked = false;
      setMainControlsDisabled(true);
      return;
    }

    masterCurrentDomainLabel.textContent = currentTabDomain === "local_files" ? "Local Files" : currentTabDomain;
    masterEnableToggle.disabled = false;

    const storageKey = `masterEnable_${currentTabDomain}`;
    const result = await browser.storage.local.get(storageKey);
    const isEnabled = result[storageKey] ? result[storageKey].masterEnabled : true;
    masterEnableToggle.checked = isEnabled;
    setMainControlsDisabled(!isEnabled);
  }

  async function persistMasterToggleState() {
    if (!currentTabDomain || !masterEnableToggle) return;
    const masterSettings = { masterEnabled: masterEnableToggle.checked };
    const storageKey = `masterEnable_${currentTabDomain}`;
    await browser.storage.local.set({ [storageKey]: masterSettings });
    console.log(`Master enable state for ${currentTabDomain}:`, masterSettings);
    setMainControlsDisabled(!masterEnableToggle.checked);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await browser.tabs.sendMessage(tab.id, {
          action: "masterEnableChanged",
          settings: masterSettings
        });
      }
    } catch (e) { console.error("Error sending masterEnableChanged message:", e); }
  }

  if (autoDirectionToggle) autoDirectionToggle.addEventListener('change', persistDirectionSettings);
  if (masterEnableToggle) masterEnableToggle.addEventListener('change', persistMasterToggleState);

  async function initializePopupState() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
        currentTabDomain = getDomainFromUrl(tab.url);
    } else {
        currentTabDomain = null;
    }

    await loadMasterToggleState();
    await loadFontSettings();

    const activeTabButton = document.querySelector('.tab-button.active');
    let activeTabId = activeTabButton ? activeTabButton.getAttribute('data-tab') : null;

    if (!activeTabId && tabButtons.length > 0) { // If no tab is active, make the first one active
        tabButtons[0].classList.add('active');
        activeTabId = tabButtons[0].getAttribute('data-tab');
        // Also make its content visible
        const firstTabContent = document.getElementById(activeTabId);
        if (firstTabContent) firstTabContent.style.display = 'block';
    }

    // Ensure correct tab content is displayed based on activeTabId
    tabContents.forEach(content => {
      if (content.id !== activeTabId) { // Hide non-active tabs
        content.style.display = 'none';
      } else { // Ensure active tab is displayed
        content.style.display = 'block';
      }
    });

    if (activeTabId === 'directionSettingsTab') {
        await loadDirectionSettingsForCurrentTab();
    }
  }
  initializePopupState();
});
