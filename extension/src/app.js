var mainMenu;

if (location.hostname.includes("moomoo.io")) {
    mainMenu = document.getElementById("mainMenu");

    document.getElementById("gameName").innerHTML = "";
    document.getElementById("loadingText").innerHTML = "";
    document.getElementById("joinPartyButton").style.display = "none";
    document.getElementById("partyButton").style.display = "none";
    document.getElementById("linksContainer2").style.display = "none";
} else {
    mainMenu = document.body;
}

var extensionVersion = "v4";

function getSavedVal(id) {
    return localStorage.getItem(id);
}

function saveVal(id, value) {
    localStorage.setItem(id, value);
}

function injectScript(src) {
    let script = document.createElement("script");
    script.type = "module";
    script.src = src;
    script.onload = () => {
        mainMenu.menuElement.remove();
        mainMenu.createdByElement.remove();
    };
    document.documentElement.appendChild(script);
}

var mainMenu = new class {
    constructor() {
        this.passwordInput = "";

        this.menuElement = document.createElement("div");
        this.menuElement.style = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 650px;
            height: 450px;
        `;

        if (location.hostname.includes("sploop.io")) {
            document.getElementById("homepage").style.display = "none";
            document.getElementById("game-canvas").style.filter = "blur(50px)";
            this.menuElement.style.backgroundColor = "rgb(0, 0, 0, .75)";
            this.menuElement.style.borderRadius = "6px";
        }

        this.gameName = document.createElement("div");
        this.gameName.style = "position: absolute; color: white; top: 0px; left: 0px; font-size: 72px; text-align: center; width: 100%;";
        this.gameName.innerHTML = `Chicken <span style="color: #fff; text-shadow: 0 0 5px #000, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #fff, 0 0 25px #fff, 0 0 30px #fff, 0 0 35px #fff;">V4</span>`;

        this.loadingText = document.createElement("div");
        this.loadingText.style = "position: absolute; left: 50%; top: 50%; text-align: center; transform: translate(-50%, -50%); width: 100%; font-size: 18px; color: white;";
        this.loadingText.innerHTML = "Loading essentials...";

        this.menuElement.innerHTML += `
            <div id="mainMenuItemHolder" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%;">
            </div>
        `;

        mainMenu.appendChild(this.menuElement);

        this.menuElement.appendChild(this.gameName);
        this.menuElement.appendChild(this.loadingText);

        this.mainMenuItemHolder = document.getElementById("mainMenuItemHolder");

        this.createdByElement = document.createElement("div");

        this.createdByElement.style = `
            position: absolute;
            bottom: 5px;
            left: 5px;
            color: white;
        `;

        let chickenSessionData = getSavedVal("chV4-pAss_wordOfd_ata");

        if (chickenSessionData) chickenSessionData = JSON.parse(chickenSessionData);

        this.createdByElement.innerHTML = `
            Importer/Extension Version: <a>${extensionVersion}</a><br>
            Discord ID: <a>${chickenSessionData?.id || "undefined"}</a>
        `;

        mainMenu.appendChild(this.createdByElement);

        this.continue();
    }
    async continue() {
        this.versions = await fetch("https://pond-hallowed-blackcurrant.glitch.me/versions").then(e => e.json());

        this.versions = this.versions.versions.filter(e => e.isSploop ? location.hostname.includes("sploop") : true);

        this.doneLoadingVersions();
    }
    doneLoadingVersions() {
        this.loadingText.innerHTML = "";

        this.mainMenuItemHolder.innerHTML = `
            <div style="margin-bottom: -17.5px; display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;">
                <select id="versionInput" style="cursor: pointer; color: black; font-size: 16px; width: 287.5px; height: 37px; border: none; border-radius: 2.5px;">
                    <option disabled>No servers</option>
                </select>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;">
                <input type="password" id="passwordInput" placeholder="Enter access password" style="font-size: 18px; width: 275px; height: 25px; border: none; padding: 6px; border-radius: 2.5px;">
            </div>
            <div style="margin-top: -17.5px; display: flex; align-items: center; justify-content: center; width: 100%; height: 60px;">
                <button id="authenticateDiscord" style="color: white; margin-left: 10px; background-color: #7ee559; padding: 7.25px; padding-left: 10px; padding-right: 10px; font-size: 18px; text-align: center; border: none; cursor: pointer; border-radius: 2.5px;">
                    Authenticate Discord
                </button>
                <button id="continueButton" style="color: white; margin-left: 10px; background-color: #7ee559; padding: 7.25px; padding-left: 10px; padding-right: 10px; font-size: 18px; text-align: center; border: none; cursor: pointer; border-radius: 2.5px;">
                    Continue
                </button>
            </div>
            <div style="margin-top: -10px; width: 100%; color: white; text-align: center;">
                Welcome back, ${getSavedVal("chV4-pAss_wordOfd_ata") ? JSON.parse(getSavedVal("chV4-pAss_wordOfd_ata")).username : "unknown user"}!
            </div>
        `;

        this.continueButton = document.getElementById("continueButton");
        this.passwordInputElement = document.getElementById("passwordInput");
        this.authenticateDiscord = document.getElementById("authenticateDiscord");
        this.versionInput = document.getElementById("versionInput");

        if (this.continueButton) this.continueButton.onclick = () => {
            if (getSavedVal("chV4-pAss_wordOfd_ata")) {
                injectScript(`https://pond-hallowed-blackcurrant.glitch.me/script-import/get-script?data=${encodeURIComponent(getSavedVal("chV4-pAss_wordOfd_ata"))}&version=${this.versionInput.value}`);
            }

            this.mainMenuItemHolder.remove();

            this.loadingText.innerHTML = "Importing...";

            if (location.hostname.includes("sploop.io")) {
                document.getElementById("homepage").style.display = "flex";
                document.getElementById("game-canvas").style.filter = null;
            }
        };

        if (this.authenticateDiscord) this.authenticateDiscord.onclick = () => {
            this.continueButton.disabled = true;
            this.continueButton.style.backgroundColor = "gray";

            let width = 600;
            let height = 800;
            let left = (window.screen.width / 2) - (width / 2);
            let top = (window.screen.height / 2) - (height / 2);

            const popup = window.open("https://pond-hallowed-blackcurrant.glitch.me/login", "DiscordAuthPopup", `width=${width},height=${height},top=${top},left=${left},resizable=yes`);

            const interval = setInterval(() => {
                popup.postMessage("Hi", "https://pond-hallowed-blackcurrant.glitch.me");
            }, 1e3);

            window.addEventListener("message", (event) => {
                if (event.data) {
                    clearInterval(interval);

                    saveVal("chV4-pAss_wordOfd_ata", JSON.stringify(event.data));

                    this.createdByElement.innerHTML = `
                        Importer/Extension Version: <a>${extensionVersion}</a><br>
                        Discord ID: <a>${event.data.id}</a>
                    `;

                    popup.close();

                    this.doneLoadingVersions();
                }
            });
        };

        if (this.versionInput) {
            this.versionInput.innerHTML = "";

            for (let i = 0; i < this.versions.length; i++) {
                let version = this.versions[i];

                this.versionInput.innerHTML = `
                <option value="${version.id}">${version.name}</option>
                ` + this.versionInput.innerHTML;
            }
        }
    }
};