console.log("Background script loaded.");

// Listener for messages (can be expanded later for more complex state management)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);

  // Example: if you need background to do something specific upon font application
  if (message.action === "fontAppliedLog") {
    console.log(`Background: Font ${message.fontName} was applied on tab ${sender.tab.id}`);
    sendResponse({status: "logged"});
  }

  // Add more message handlers as needed for settings that require background processing

  return true; // Indicates that the response will be sent asynchronously for other handlers
});

// Optional: Listen for tab updates to re-apply fonts if necessary,
// though content script applying on load is generally preferred for simplicity.
// browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
//   if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('about:')) {
//     try {
//       const result = await browser.storage.local.get('globalFontConfig');
//       if (result.globalFontConfig) {
//         // Ensure content script is ready before sending message
//         // This might require a handshake or checking if script is injected
//         // For now, relying on content script's own load logic.
//         // browser.tabs.sendMessage(tabId, {
//         //   action: "applyFont",
//         //   fontConfig: result.globalFontConfig
//         // }).catch(e => console.log("Error resending font on tab update", e));
//       }
//     } catch (error) {
//       console.error("Error in background.js onUpdated listener:", error);
//     }
//   }
// });
