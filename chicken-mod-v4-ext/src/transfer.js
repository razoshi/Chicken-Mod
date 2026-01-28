function injectScript(file_path) {
    let script = document.createElement("script");
    script.setAttribute("type", "module");
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        script.setAttribute("src", chrome.runtime.getURL(file_path));
    } else if (typeof browser !== 'undefined' && browser.runtime) {
        script.setAttribute("src", browser.runtime.getURL(file_path));
    } else {
        return;
    }
    document.documentElement.appendChild(script);
}
injectScript("src/app.js");