let removals = 0;
let observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
            if (node.nodeName == "SCRIPT") {
                if (node.src.includes("index-")) {
                    removals++;
                    window.loadedScript = true;
                    node.parentNode.removeChild(node);
                    if (removals == 1) {
                        observer.disconnect();
                    }
                };
            };
        });
    });
});
observer.observe(document, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
});