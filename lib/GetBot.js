const {interfaces: Ci} = Components;

const chrome = window.QueryInterface(Ci.nsIInterfaceRequestor)
  .getInterface(Ci.nsIWebNavigation)
  .QueryInterface(Ci.nsIDocShellTreeItem).rootTreeItem
  .QueryInterface(Ci.nsIInterfaceRequestor)
  .getInterface(Ci.nsIDOMWindow);

//const iMacros = chrome.iMacros

export default chrome.GetBot;
