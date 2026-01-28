import config from "./js/config.js";
import io from "./js/io-client.js";
import * as UTILS from "./js/utils.js";
import * as animText from "./js/animText.js";
import items from "./js/items.js";
import Player from "./js/player.js";
import store from "./js/store.js";
import Projectile from "./js/projectile.js";
import ProjectileManager from "./js/projectileManager.js";
import VultrClient from "./js/VultrClient.js";
import AiManager from "./js/aiManager.js";
import AI from "./js/ai.js";

(function () {
    var managerPasscode = "token_551";
    document.body.append(document.getElementById("pingDisplay"));
    window.loadedScript = true;
    window.onbeforeunload = null;
    var textManager = new animText.TextManager();
    var vultrClient = null;
    vultrClient = new VultrClient("moomoo.io", 3000, config.maxPlayers, 5, false);
    vultrClient.debugLog = false;
    var firstSetup = true;
    var closeObjects = [];
    var allianceNotifications = [];
    var alliancePlayers = [];
    var gameObjects = [];
    class GameObject {
        constructor(sid) {
            this.sid = sid;
        }
        init(x, y, dir, scale, type, data, owner) {
            data = data || {};
            this.sentTo = {};
            this.gridLocations = [];
            this.active = true;
            this.doUpdate = data.doUpdate;
            this.x = x;
            this.y = y;
            this.dir = dir;
            this.xWiggle = 0;
            this.yWiggle = 0;
            this.scale = scale;
            this.type = type;
            this.colorType = UTILS.randInt(0, 10);
            this.id = data.id;
            this.owner = owner;
            this.name = data.name;
            this.isItem = (this.id != undefined);
            this.group = data.group;
            this.health = data.health;
            this.currentHealth = this.health;
            this.reload = (config.serverUpdateSpeed / 2200);
            this.layer = 2;
            if (this.group != undefined) {
                this.layer = this.group.layer;
            } else if (this.type == 0) {
                this.layer = 3;
            } else if (this.type == 2) {
                this.layer = 0;
            } else if (this.type == 4) {
                this.layer = -1;
            }
            this.colDiv = data.colDiv || 1;
            this.blocker = data.blocker;
            this.ignoreCollision = data.ignoreCollision;
            this.dontGather = data.dontGather;
            this.hideFromEnemy = data.hideFromEnemy;
            this.friction = data.friction;
            this.projDmg = data.projDmg;
            this.dmg = data.dmg;
            this.pDmg = data.pDmg;
            this.pps = data.pps;
            this.zIndex = data.zIndex || 0;
            this.turnSpeed = data.turnSpeed;
            this.req = data.req;
            this.trap = data.trap;
            this.healCol = data.healCol;
            this.teleport = data.teleport;
            this.boostSpeed = data.boostSpeed;
            this.projectile = data.projectile;
            this.shootRange = data.shootRange;
            this.shootRate = data.shootRate;
            this.shootCount = this.shootRate;
            this.spawnPoint = data.spawnPoint;
        }
        getScale(sM, ig) {
            sM = sM || 1;
            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
        }
        update(delta) {
            if (this.active) {
                if (this.xWiggle) {
                    this.xWiggle *= Math.pow(0.99, delta);
                }
                if (this.yWiggle) {
                    this.yWiggle *= Math.pow(0.99, delta);
                }
                if (this.turnSpeed) {
                    this.dir += this.turnSpeed * delta;
                }
            }
        }
    }
    class ObjectManager {
        constructor() {
            var tmpObj;
            this.disableObj = function (obj) {
                obj.active = false;
            };
            this.disableBySid = function (sid) {
                for (var i = 0; i < gameObjects.length; ++i) {
                    if (gameObjects[i].sid == sid) {
                        this.disableObj(gameObjects[i]);
                        break;
                    }
                }
            };
            this.removeAllItems = function (sid) {
                for (var i = 0; i < gameObjects.length; ++i) {
                    if (gameObjects[i].active && gameObjects[i].owner && gameObjects[i].owner.sid == sid) {
                        this.disableObj(gameObjects[i]);
                    }
                }
            };
            this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater) {
                const cantPlace = gameObjects.find(tmp => tmp.active && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
                if (cantPlace) {
                    return false;
                }
                if (!ignoreWater && indx !== 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) {
                    return false;
                }
                return true;
            };
            this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
                tmpObj = null;
                for (var i = 0; i < gameObjects.length; ++i) {
                    if (gameObjects[i].sid == sid) {
                        tmpObj = gameObjects[i];
                        break;
                    }
                }
                if (!tmpObj) {
                    for (var i = 0; i < gameObjects.length; ++i) {
                        if (!gameObjects[i].active) {
                            tmpObj = gameObjects[i];
                            break;
                        }
                    }
                }
                if (!tmpObj) {
                    tmpObj = new GameObject(sid);
                    gameObjects.push(tmpObj);
                }
                if (setSID) tmpObj.sid = sid;
                if (tmpObj.initTimes == null) tmpObj.initTimes = 0;
                if (tmpObj.initTimes < 2) {
                    tmpObj.initTimes++;
                    tmpObj.init(x, y, dir, s, type, data, owner);
                }
            };
        }
    }
    var objectManager = new ObjectManager();
    var skinSprites = {};
    var skinPointers = {};
    var tmpSkin;
    function renderSkin(index, ctxt, parentSkin, owner) {
        tmpSkin = skinSprites[index + (toggles.texturepack() ? "lol" : 0)];
        if (!tmpSkin) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = getTexturePackImg(index, "hat");
            skinSprites[index + (toggles.texturepack() ? "lol" : 0)] = tmpImage;
            tmpSkin = tmpImage;
        }
        var tmpObj = parentSkin || skinPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < hats.length; ++i) {
                if (hats[i].id == index) {
                    tmpObj = hats[i];
                    break;
                }
            }
            skinPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded)
            ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
        if (!parentSkin && tmpObj.topSprite) {
            ctxt.save();
            ctxt.rotate(owner.skinRot);
            renderSkin(index + "_top", ctxt, tmpObj, owner);
            ctxt.restore();
        }
    }
    var isSandbox = location.hostname === "sandbox-dev.moomoo.io" || location.hostname === "sandbox.moomoo.io";
    async function processServers() {
        let link = `${isSandbox ? "https://api-sandbox.moomoo.io" : "https://api.moomoo.io"}/servers?v=1.22`;
        try {
            const e = await fetch(link);
            const e_1 = await e.json();
            return await vultrClient.processServers(e_1);
        } catch (e_2) {
            console.error("Failed to load server data with status code:", e_2);
        }
    }
    async function tryConnect() {
        setupServerStatus();
        setInterval(() => { setupServerStatus(); }, 6e3);
        if (!window.grecaptcha) {
            location.href = location.href;
            return;
        }
        window.grecaptcha.ready(() => {
            window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", { action: "homepage" }).then((token) => {
                connectSocket("re:" + token);
            });
        });
    }
    function showLoadingText(text) {
        mainMenu.style.display = "block";
        gameUI.style.display = "none";
        menuCardHolder.style.display = "none";
        diedText.style.display = "none";
        loadingText.style.display = "block";
        loadingText.innerHTML = text + "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>";
    }
    var chickenModSocket;
    function sendToSocketServer(type) {
        if (chickenModSocket && chickenModSocket.readyState == 1) {
            let data = Array.prototype.slice.call(arguments, 1);
            chickenModSocket.send(JSON.stringify({
                type: type,
                data: data
            }));
        }
    }
    window.addEventListener('load', function () {
        loadingText.innerHTML = "Connecting to server...";
    });
    function connectChickenSocket() {
        //chickenModSocket = new WebSocket(`wss://season-dot-xenoposeidon.glitch.me/`);
        if (!socketReady()) {
            connectSocketIfReady();
        }

        /*
        chickenModSocket.onopen = function () {
            if (e) {
                sendToSocketServer("setUp", location.href, null, managerPasscode);
            }
        };
        chickenModSocket.onmessage = function (message) {
            let Data = JSON.parse(message.data);
            let { type, data } = Data;
            if (type == "chat") {
                if (chatLoggerPage == 0) {
                    document.getElementById("chatNotiThing").style.display = "block";
                }
            }
        }
        chickenModSocket.onclose = function ({ reason }) {
            //showLoadingText("reconnecting to script server");
            connectChickenSocket(true);
        }
        */
    }
    connectChickenSocket();
    function connectSocketIfReady() {
        // loadingText.innerHTML = "Connecting to moomoo...";
        if (window.frvrSdkInitPromise) {
            window.frvrSdkInitPromise.then(() => {
                window.FRVR.bootstrapper.complete()
            }).then(() => {
                processServers().then(tryConnect).catch(e => {
                    console.error("mega did something wrong!", e);
                });
            });
        } else {
            processServers().then(tryConnect).catch(e => {
                console.error("mega did something wrong!", e);
            });
        }
    }
    var websocket = "";
    var useNativeResolution;
    var showPing;
    var pixelDensity = 1;
    var delta, now, lastSent;
    var lastUpdate = Date.now();
    var keys, attackState;
    var ais = [];
    var players = [];
    var alliances = [];
    var gameObjects = [];
    var projectiles = [];
    var projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
    var aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);
    var player, playerSID, tmpObj;
    var waterMult = 1;
    var waterPlus = 0;
    var mouseX = 0;
    var mouseY = 0;
    var controllingTouch = {
        id: -1,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    };
    var camX, camY;
    var tmpDir;
    var skinColor = 0;
    var maxScreenWidth = config.maxScreenWidth;
    var maxScreenHeight = config.maxScreenHeight;
    var screenWidth, screenHeight;
    var inGame = false;
    var adContainer = document.getElementById("ad-container");
    var mainMenu = document.getElementById("mainMenu");
    var enterGameButton = document.getElementById("enterGame");
    var promoImageButton = document.getElementById("promoImg");
    var partyButton = document.getElementById("partyButton");
    var joinPartyButton = document.getElementById("joinPartyButton");
    var settingsButton = document.getElementById("settingsButton");
    var settingsButtonTitle = settingsButton.getElementsByTagName("span")[0];
    var allianceButton = document.getElementById("allianceButton");
    var storeButton = document.getElementById("storeButton");
    var chatButton = document.getElementById("chatButton");
    var gameCanvas = document.getElementById("gameCanvas");
    var mainContext = gameCanvas.getContext("2d");
    var serverBrowser = document.createElement("select");
    var oldServerBrowser = document.getElementById("serverBrowser");
    oldServerBrowser.parentNode.replaceChild(serverBrowser, oldServerBrowser);
    oldServerBrowser.remove();
    serverBrowser.style = `
    width: 100%;
    height: 24px;
    `;
    var nativeResolutionCheckbox = document.getElementById("nativeResolution");
    var showPingCheckbox = document.getElementById("showPing");
    var playMusicCheckbox = document.getElementById("playMusic");
    var pingDisplay = document.getElementById("pingDisplay");
    var shutdownDisplay = document.getElementById("shutdownDisplay");
    var menuCardHolder = document.getElementById("menuCardHolder");
    var guideCard = document.getElementById("guideCard");
    var loadingText = document.getElementById("loadingText");
    var gameUI = document.getElementById("gameUI");
    var actionBar = document.getElementById("actionBar");
    var scoreDisplay = document.getElementById("scoreDisplay");
    var foodDisplay = document.getElementById("foodDisplay");
    var woodDisplay = document.getElementById("woodDisplay");
    var stoneDisplay = document.getElementById("stoneDisplay");
    var killCounter = document.getElementById("killCounter");
    var leaderboardData = document.getElementById("leaderboardData");
    var nameInput = document.getElementById("nameInput");
    var itemInfoHolder = document.getElementById("itemInfoHolder");
    var ageText = document.getElementById("ageText");
    var ageBarBody = document.getElementById("ageBarBody");
    var upgradeHolder = document.getElementById("upgradeHolder");
    upgradeHolder.style.top = "50px";
    var upgradeCounter = document.getElementById("upgradeCounter");
    upgradeCounter.style.top = "125px";
    var allianceMenu = document.getElementById("allianceMenu");
    var allianceHolder = document.getElementById("allianceHolder");
    var allianceManager = document.getElementById("allianceManager");
    var mapDisplay = document.getElementById("mapDisplay");
    var diedText = document.getElementById("diedText");
    var skinColorHolder = document.getElementById("skinColorHolder");
    var mapContext = mapDisplay.getContext("2d");
    mapDisplay.width = 300;
    mapDisplay.height = 300;
    var storeMenu = document.getElementById("storeMenu");
    var storeHolder = document.getElementById("storeHolder");
    storeHolder.style.height = "300px";
    var noticationDisplay = document.getElementById("noticationDisplay");
    noticationDisplay.style.top = "20px";
    noticationDisplay.style.right = "20px";
    var hats = store.hats;
    var accessories = store.accessories;
    var outlineColor = "#525252";
    var darkOutlineColor = "#3d3f42";
    var outlineWidth = 5.5;
    function disconnect(reason) {
        io.socket.close();
        showLoadingText(reason);
    }
    var lastPing = Date.now();
    function pingSocket() {
        lastPing = Date.now();
        io.send("0");
    }
    function saveVal(name, val) {
        localStorage.setItem(name, val);
    }
    function deleteVal(name) {
        localStorage.removeItem(name);
    }
    function getSavedVal(name) {
        return localStorage.getItem(name);
    }
    function socketReady() {
        return (io.connected);
    }
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        if (r < 0) r = 0;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    }
    function renderMinimap(delta) {
        if (player && player.alive) {
            mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);
            mapContext.strokeStyle = "#fff";
            mapContext.lineWidth = 4;
            for (var i = 0; i < mapPings.length; ++i) {
                tmpPing = mapPings[i];
                tmpPing.update(mapContext, delta);
            }
            mapContext.globalAlpha = 1;
            mapContext.fillStyle = "#fff";
            renderCircle((player.x / config.mapScale) * mapDisplay.width, (player.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
            mapContext.fillStyle = "rgba(255,255,255,0.35)";
            if (player.team && minimapData) {
                for (var i = 0; i < minimapData.length;) {
                    renderCircle((minimapData[i] / config.mapScale) * mapDisplay.width, (minimapData[i + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                    i += 2;
                }
            }
            if (toggles.infiniteRange()) {
                for (let i = 0; i < breakMarker.length; i++) {
                    let marker = breakMarker[i];
                    mapContext.fillStyle = "#fff";
                    mapContext.font = "34px Hammersmith One";
                    mapContext.textBaseline = "middle";
                    mapContext.textAlign = "center";
                    mapContext.fillText("L", (marker.x / config.mapScale) * mapDisplay.width, (marker.y / config.mapScale) * mapDisplay.height);
                }
            }
            if (lastDeath) {
                mapContext.fillStyle = "#fc5553";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width, (lastDeath.y / config.mapScale) * mapDisplay.height);
            }
            if (mapMarker) {
                mapContext.fillStyle = "#fff";
                mapContext.font = "34px Hammersmith One";
                mapContext.textBaseline = "middle";
                mapContext.textAlign = "center";
                mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                    (mapMarker.y / config.mapScale) * mapDisplay.height);
            }
        }
    }
    document.onload = function () {
        menuCardHolder.style.display = "block";
    }
    function enterGame() {
        if (document.getElementById("ot-sdk-btn-floating")) document.getElementById("ot-sdk-btn-floating").style.display = "none";
        saveVal("moo_name", nameInput.value);
        if (!inGame && socketReady()) {
            inGame = true;
            showLoadingText("Loading...");
            io.send("M", {
                name: nameInput.value,
                moofoll: moofoll,
                skin: skinColor
            });
        }
    }
    function bindEvents() {
        enterGameButton.onclick = UTILS.checkTrusted(function () {
            enterGame();
        });
        UTILS.hookTouchEvents(enterGameButton);
        joinPartyButton.onclick = UTILS.checkTrusted(function () {
            setTimeout(function () { joinParty(); }, 10);
        });
        UTILS.hookTouchEvents(joinPartyButton);
        settingsButton.onclick = UTILS.checkTrusted(function () {
            toggleSettings();
        });
        UTILS.hookTouchEvents(settingsButton);
        allianceButton.onclick = UTILS.checkTrusted(function () {
            toggleAllianceMenu();
        });
        UTILS.hookTouchEvents(allianceButton);
        storeButton.onclick = UTILS.checkTrusted(function () {
            toggleStoreMenu();
        });
        UTILS.hookTouchEvents(storeButton);
        chatButton.onclick = UTILS.checkTrusted(function () {
            toggleChat();
        });
        UTILS.hookTouchEvents(chatButton);
        mapDisplay.onclick = UTILS.checkTrusted(function () {
            sendMapPing();
        });
        UTILS.hookTouchEvents(mapDisplay);
    }
    var iconSprites = {};
    var deathAnimations = [];
    var icons = ["crown", "skull", "crosshair"];
    function loadIcons() {//"https://quintessential-furtive-hawthorn.glitch.me/*"
        let prefix = "../."
        for (var i = 0; i < icons.length; ++i) {
            var tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            };
            tmpSprite.src = icons[i] == "crosshair" ? "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Crosshairs_Red.svg/1200px-Crosshairs_Red.svg.png" : prefix + "/img/icons/" + icons[i] + ".png";
            iconSprites[icons[i]] = tmpSprite;
        }
    }
    function setUseNativeResolution(useNative) {
        useNativeResolution = useNative;
        pixelDensity = useNative ? (window.devicePixelRatio || 1) : 1;
        nativeResolutionCheckbox.checked = useNative;
        saveVal("native_resolution", useNative.toString());
        resize();
    }
    function updateActionBarUI() {
        for (var i = 0; i < (items.list.length + items.weapons.length); ++i) {
            (function (i) {
                var tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = tmpCanvas.height = 66;
                var tmpContext = tmpCanvas.getContext('2d');
                tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                tmpContext.imageSmoothingEnabled = false;
                tmpContext.webkitImageSmoothingEnabled = false;
                tmpContext.mozImageSmoothingEnabled = false;
                if (items.weapons[i]) {
                    tmpContext.rotate((Math.PI / 4) + Math.PI);
                    var tmpSprite = new Image();
                    toolSprites[items.weapons[i].src] = tmpSprite;
                    tmpSprite.onload = function () {
                        this.isLoaded = true;
                        var tmpPad = 1 / (this.height / this.width);
                        var tmpMlt = (items.weapons[i].iPad || 1);
                        tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                            tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                        tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                        tmpContext.globalCompositeOperation = "source-atop";
                        tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                        document.getElementById('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                    };
                    tmpSprite.src = ".././img/weapons/" + items.weapons[i].src + ".png";
                    var tmpUnit = document.getElementById('actionBarItem' + i);
                    tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                        showItemInfo(items.weapons[i], true);
                    });
                    tmpUnit.onclick = UTILS.checkTrusted(function () {
                        selectToBuild(i, true);
                    });
                    UTILS.hookTouchEvents(tmpUnit);
                } else {
                    var tmpSprite = getItemSprite(items.list[i - items.weapons.length], true);
                    var tmpScale = Math.min(tmpCanvas.width - config.iconPadding, tmpSprite.width);
                    tmpContext.globalAlpha = 1;
                    tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                    document.getElementById('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                    var tmpUnit = document.getElementById('actionBarItem' + i);
                    tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                        showItemInfo(items.list[i - items.weapons.length]);
                    });
                    tmpUnit.onclick = UTILS.checkTrusted(function () {
                        selectToBuild(i - items.weapons.length);
                    });
                    UTILS.hookTouchEvents(tmpUnit);
                }
            })(i);
        }
    }
    function prepareUI() {
        var savedNativeValue = getSavedVal("native_resolution");
        if (!savedNativeValue) {
            setUseNativeResolution(typeof cordova !== "undefined");
        } else {
            setUseNativeResolution(savedNativeValue == "true");
        }
        showPing = true;//getSavedVal("show_ping") == "true";
        pingDisplay.hidden = !showPing;
        setInterval(function () {
            if (window.cordova) {
                document.getElementById("downloadButtonContainer").classList.add("cordova");
                document.getElementById("mobileDownloadButtonContainer").classList.add("cordova");
            }
        }, 1000);
        updateSkinColorPicker();
        UTILS.removeAllChildren(actionBar);
        for (var i = 0; i < (items.weapons.length + items.list.length); ++i) {
            (function (i) {
                UTILS.generateElement({
                    id: "actionBarItem" + i,
                    class: "actionBarItem",
                    style: "display:none",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: actionBar
                });
            })(i);
        }
        updateActionBarUI();
        nameInput.ontouchstart = UTILS.checkTrusted(function (e) {
            e.preventDefault();
            var newValue = prompt("enter name", e.currentTarget.value);
            e.currentTarget.value = newValue.slice(0, 15);
        });
        nativeResolutionCheckbox.checked = useNativeResolution;
        nativeResolutionCheckbox.onchange = UTILS.checkTrusted(function (e) {
            setUseNativeResolution(e.target.checked);
        });
        showPingCheckbox.checked = showPing;
        showPingCheckbox.onchange = UTILS.checkTrusted(function (e) {
            showPing = showPingCheckbox.checked;
            pingDisplay.hidden = !showPing;
            saveVal("show_ping", showPing ? "true" : "false");
        });
    }
    gameCanvas.oncontextmenu = function () {
        return false;
    };
    var moofoll = getSavedVal("moofoll");
    function follmoo() {
        if (!moofoll) {
            moofoll = true;
            saveVal("moofoll", 1);
        }
    }
    follmoo();
    window.addEventListener('resize', UTILS.checkTrusted(resize));
    function resize() {
        screenWidth = window.innerWidth;
        screenHeight = window.innerHeight;
        var scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
        gameCanvas.width = screenWidth * pixelDensity;
        gameCanvas.height = screenHeight * pixelDensity;
        gameCanvas.style.width = screenWidth + "px";
        gameCanvas.style.height = screenHeight + "px";
        mainContext.setTransform(
            scaleFillNative, 0,
            0, scaleFillNative,
            (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
            (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
        );
    }
    resize();
    function updateSkinColorPicker() {
        var tmpHTML = "";
        for (var i = 0; i < config.skinColors.length; ++i) {
            if ((i == skinColor) || (i == 10 && skinColor == "constructor")) {
                tmpHTML += ("<div class='skinColorItem activeSkin' style='background-color:" + config.skinColors[i] + "' onclick='selectSkinColor(" + i + ")'></div>");
            } else {
                tmpHTML += ("<div class='skinColorItem' style='background-color:" + config.skinColors[i] + "' onclick='selectSkinColor(" + i + ")'></div>");
            }
        }
        skinColorHolder.innerHTML = tmpHTML;
    }
    function selectSkinColor(index) {
        if (index == 10) {
            skinColor = "constructor";
        } else {
            skinColor = index;
        }
        updateSkinColorPicker();
    }
    window.selectSkinColor = selectSkinColor;
    function setupServerStatus() {
        let tmpText = "";
        //tmpText += "<select>";
        for (let i in vultrClient.servers) {
            let servers = vultrClient.servers[i];
            tmpText += `<option disabled>${vultrClient.regionInfo[i].name}</option>`;
            for (let t = 0; t < servers.length; t++) {
                let server = servers[t];
                tmpText += `<option value="${i}:${server.name}" ${server.selected ? "selected" : ""}>${vultrClient.regionInfo[i].name} ${server.name} [${server.playerCount}/${config.maxPlayers}] [${server.ping} ms]</option>`
            }
            tmpText += `<option disabled></option>`;
        }
        //tmpText += "</select>";
        serverBrowser.innerHTML = tmpText;
        let altServerText;
        let altServerURL;
        if (location.hostname == "sandbox.moomoo.io") {
            altServerText = "Back to MooMoo";
            altServerURL = "//moomoo.io/";
        } else {
            altServerText = "Try the sandbox";
            altServerURL = "//sandbox.moomoo.io/";
        }
        document.getElementById("altServer").innerHTML = "<a href='" + altServerURL + "'>" + altServerText + "<i class='material-icons' style='font-size:10px;vertical-align:middle'>arrow_forward_ios</i></a>";
    }
    var toolSprites = {};
    var newHatImgs = {
        7: "https://i.imgur.com/vAOzlyY.png",
        15: "https://i.imgur.com/YRQ8Ybq.png",
        40: "https://i.imgur.com/pe3Yx3F.png",
        26: "https://i.imgur.com/I0xGtyZ.png",
    };
    var newAccImgs = {
        18: "https://i.imgur.com/0rmN7L9.png",
        21: "https://i.imgur.com/4ddZert.png",
    };
    var newWeaponImgs = {
        "sword_1_r": "https://i.imgur.com/V9dzAbF.png",
        "samurai_1_r": "https://i.imgur.com/vxLZW0S.png"
    };
    var tankAim = 0;
    function getTexturePackImg(id, type) {
        let prefix = "../.";
        if (toggles.texturepack()) {
            if (newHatImgs[id] && type == "hat") {
                return newHatImgs[id];
            } else if (newAccImgs[id] && type == "acc") {
                return newAccImgs[id];
            } else if (newWeaponImgs[id] && type == "weapons") {
                return newWeaponImgs[id];
            } else {
                if (type == "acc") {
                    return prefix + "/img/accessories/access_" + id + ".png";
                } else if (type == "hat") {
                    return prefix + "/img/hats/hat_" + id + ".png";
                } else {
                    return prefix + "/img/weapons/" + id + ".png";
                }
            }
        } else {
            if (type == "acc") {
                return prefix + "/img/accessories/access_" + id + ".png";
            } else if (type == "hat") {
                return prefix + "/img/hats/hat_" + id + ".png";
            } else {
                return prefix + "/img/weapons/" + id + ".png";
            }
        }
    }
    function renderTool(obj, variant, x, y, ctxt) {
        var tmpSrc = obj.src + (variant || "");
        var tmpSprite = toolSprites[tmpSrc + (toggles.texturepack() ? "lol" : 0)];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            }
            tmpSprite.src = getTexturePackImg(tmpSrc, "weapons");
            toolSprites[tmpSrc + (toggles.texturepack() ? "lol" : 0)] = tmpSprite;
        }
        if (tmpSprite.isLoaded) ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
    }
    var accessSprites = {};
    var accessPointers = {};
    var tmpSkin;
    function renderTail(index, ctxt, owner) {
        tmpSkin = accessSprites[index + (toggles.texturepack() ? "lol" : 0)];
        if (!tmpSkin) {
            var tmpImage = new Image();
            tmpImage.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImage.src = getTexturePackImg(index, "acc");
            accessSprites[index + (toggles.texturepack() ? "lol" : 0)] = tmpImage;
            tmpSkin = tmpImage;
        }
        var tmpObj = accessPointers[index];
        if (!tmpObj) {
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].id == index) {
                    tmpObj = accessories[i];
                    break;
                }
            }
            accessPointers[index] = tmpObj;
        }
        if (tmpSkin.isLoaded) {
            ctxt.save();
            ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
            if (tmpObj.spin) ctxt.rotate(owner.skinRot);
            ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
            ctxt.restore();
        }
    }
    function renderLeaf(x, y, l, r, ctxt) {
        var endX = x + (l * Math.cos(r));
        var endY = y + (l * Math.sin(r));
        var width = l * 0.4;
        ctxt.moveTo(x, y);
        ctxt.beginPath();
        ctxt.quadraticCurveTo(((x + endX) / 2) + (width * Math.cos(r + Math.PI / 2)),
            ((y + endY) / 2) + (width * Math.sin(r + Math.PI / 2)), endX, endY);
        ctxt.quadraticCurveTo(((x + endX) / 2) - (width * Math.cos(r + Math.PI / 2)),
            ((y + endY) / 2) - (width * Math.sin(r + Math.PI / 2)), x, y);
        ctxt.closePath();
        ctxt.fill();
        ctxt.stroke();
    }
    function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
        tmpContext = tmpContext || mainContext;
        tmpContext.beginPath();
        tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
        if (!dontFill) tmpContext.fill();
        if (!dontStroke) tmpContext.stroke();
    }
    function renderStar(ctxt, spikes, outer, inner, ha) {
        var rot = Math.PI / 2 * 3;
        var x, y;
        var step = Math.PI / spikes;
        if (ha) ctxt.rotate(Math.PI / 2);
        ctxt.beginPath();
        if (!navigator.platform.includes("Mac")) ctxt.moveTo(0, -outer);
        for (var i = 0; i < spikes; i++) {
            x = Math.cos(rot) * outer;
            y = Math.sin(rot) * outer;
            ctxt.lineTo(x, y);
            rot += step;
            x = Math.cos(rot) * inner;
            y = Math.sin(rot) * inner;
            ctxt.lineTo(x, y);
            rot += step;
        }
        if (!navigator.platform.includes("Mac")) ctxt.lineTo(0, -outer);
        ctxt.closePath();
    }
    function renderRect(x, y, w, h, ctxt, stroke) {
        ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
        if (!stroke)
            ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
    }
    function renderRectCircle(x, y, s, sw, seg, ctxt, stroke) {
        ctxt.save();
        ctxt.translate(x, y);
        seg = Math.ceil(seg / 2);
        for (var i = 0; i < seg; i++) {
            renderRect(0, 0, s * 2, sw, ctxt, stroke);
            ctxt.rotate(Math.PI / seg);
        }
        ctxt.restore();
    }
    function renderBlob(ctxt, spikes, outer, inner) {
        var rot = Math.PI / 2 * 3;
        var x, y;
        var step = Math.PI / spikes;
        var tmpOuter;
        ctxt.beginPath();
        ctxt.moveTo(0, -inner);
        for (var i = 0; i < spikes; i++) {
            tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
            ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter,
                Math.cos(rot + (step * 2)) * inner, Math.sin(rot + (step * 2)) * inner);
            rot += step * 2;
        }
        ctxt.lineTo(0, -inner);
        ctxt.closePath();
    }
    function renderTriangle(s, ctx) {
        ctx = ctx || mainContext;
        var h = s * (Math.sqrt(3) / 2);
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(-s / 2, h / 2);
        ctx.lineTo(s / 2, h / 2);
        ctx.lineTo(0, -h / 2);
        ctx.fill();
        ctx.closePath();
    }
    function MapPing() {
        this.init = function (x, y) {
            this.scale = 0;
            this.x = x;
            this.y = y;
            this.active = true;
        };
        this.update = function (ctxt, delta) {
            if (this.active) {
                this.scale += 0.05 * delta;
                if (this.scale >= config.mapPingScale) {
                    this.active = false;
                } else {
                    ctxt.globalAlpha = (1 - Math.max(0, this.scale / config.mapPingScale));
                    ctxt.beginPath();
                    ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale)
                        * mapDisplay.width, this.scale, 0, 2 * Math.PI);
                    ctxt.stroke();
                }
            }
        };
    }
    var minimapData;
    var mapMarker;
    var mapPings = [];
    var tmpPing;
    function renderWaterBodies(xOffset, yOffset, ctxt, padding) {
        var tmpW = config.riverWidth + padding;
        var tmpY = (config.mapScale / 2) - yOffset - (tmpW / 2);
        if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
            ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
        }
    }
    var mathPI2 = Math.PI * 2;
    var mathPI3 = Math.PI * 3;
    var itemSprites = {};
    function isAlly(id) {
        return alliancePlayers.includes(id);
    }
    window.isAlly = isAlly;
    function getItemSprite(obj, asIcon) {
        var tmpSprite = itemSprites[obj.id + (player && obj.owner && obj.owner.sid == player.sid ? 0 : player && player.team && obj.owner && isAlly(obj.owner.sid) ? 25 : 50) + obj.scale.toString()];
        if (!tmpSprite || asIcon) {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.6) + outlineWidth + (items.list[obj.id].spritePadding || 0);
            var tmpContext = tmpCanvas.getContext('2d');
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
            if (obj.name == "apple") {
                tmpContext.fillStyle = "#c15555";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#89a54c";
                var leafDir = -(Math.PI / 2);
                renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                    25, leafDir + Math.PI / 2, tmpContext);
            } else if (obj.name == "cookie") {
                tmpContext.fillStyle = "#cca861";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#937c4b";
                var chips = 4;
                var rotVal = mathPI2 / chips;
                var tmpRange;
                for (var i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "cheese") {
                tmpContext.fillStyle = "#f4f3ac";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c3c28b";
                var chips = 4;
                var rotVal = mathPI2 / chips;
                var tmpRange;
                for (var i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                    "#a5974c" : "#939393";
                var sides = (obj.name == "castle wall") ? 4 : 3;
                renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                    "#c9b758" : "#bcbcbc";
                renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes"
                || obj.name == "spinning spikes") {
                tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";
                var tmpScale = (obj.scale * 0.6);
                renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale * 0.5, tmpContext);
            } else if (obj.name == "mine") {
                tmpContext.fillStyle = "#939393";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#bcbcbc";
                renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "sapling") {
                for (var i = 0; i < 2; ++i) {
                    var tmpScale = obj.scale * (!i ? 1 : 0.5);
                    renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                    tmpContext.fill();
                    if (!i) tmpContext.stroke();
                }
            } else if (obj.name == "pit trap") {
                tmpContext.fillStyle = "#a5974c";
                renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = outlineColor;
                renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "boost pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#dbd97d";
                renderTriangle(obj.scale * 1, tmpContext);
            } else if (obj.name == "turret") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#939393";
                var tmpLen = 50;
                renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
            } else if (obj.name == "platform") {
                tmpContext.fillStyle = "#cebd5f";
                var tmpCount = 4;
                var tmpS = obj.scale * 2;
                var tmpW = tmpS / tmpCount;
                var tmpX = -(obj.scale / 2);
                for (var i = 0; i < tmpCount; ++i) {
                    renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpX += tmpS / tmpCount;
                }
            } else if (obj.name == "healing pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "spawn pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#71aad6";
                renderCircle(0, 0, obj.scale * 0.6, tmpContext);
            } else if (obj.name == "blocker") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "teleporter") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, obj.scale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#d76edb";
                renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
            }
            tmpSprite = tmpCanvas;
            if (!asIcon) {
                tmpContext.globalAlpha = 0.6;
                tmpContext.fillStyle = player && obj.owner && obj.owner.sid == player.sid ? "" : (obj.owner && player && player.team && isAlly(obj.owner.sid)) ? "" : "#780c0c";
                if (player && obj.owner && obj.owner.sid == player.sid) {
                } else if (obj.owner && player && player.team && isAlly(obj.owner.sid)) {
                } else {
                    if (obj.name.includes("spike") || obj.name.includes("pit trap")) {
                        if (obj.name.includes("spike")) {
                            tmpContext.globalAlpha = 0.6;
                        } else {
                            tmpContext.globalAlpha = 1;
                        }
                        tmpContext.fill();
                    }
                }
            }
            if (!asIcon)
                itemSprites[obj.id + (player && obj.owner && obj.owner.sid == player.sid ? 0 : player && player.team && obj.owner && isAlly(obj.owner.sid) ? 25 : 50) + obj.scale.toString()] = tmpSprite;
        }
        return tmpSprite;
    }
    var namesBySid = [];
    function findPlayerByID(id) {
        for (var i = 0; i < players.length; ++i) {
            if (players[i].id == id) {
                return players[i];
            }
        } return null;
    }
    function findPlayerBySID(sid) {
        for (var i = 0; i < players.length; ++i) {
            if (players[i].sid == sid) {
                return players[i];
            }
        } return null;
    }
    function findAIBySID(sid) {
        for (var i = 0; i < ais.length; ++i) {
            if (ais[i].sid == sid) {
                return ais[i];
            }
        } return null;
    }
    function findObjectBySid(sid) {
        for (var i = 0; i < gameObjects.length; ++i) {
            if (gameObjects[i].sid == sid) {
                let object = gameObjects[i];
                return object;
            }
        }
        return null;
    }
    var projectileSprites = {};
    function renderProjectile(x, y, obj, ctxt, debug) {
        if (obj.src) {
            var tmpSrc = items.projectiles[obj.indx].src;
            var tmpSprite = projectileSprites[tmpSrc];
            if (!tmpSprite) {
                tmpSprite = new Image();
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                }
                tmpSprite.src = ".././img/weapons/" + tmpSrc + ".png";
                projectileSprites[tmpSrc] = tmpSprite;
            }
            if (tmpSprite.isLoaded)
                ctxt.drawImage(tmpSprite, x - (obj.scale / 2), y - (obj.scale / 2), obj.scale, obj.scale);
        } else if (obj.indx == 1) {
            ctxt.fillStyle = "#939393";
            renderCircle(x, y, obj.scale, ctxt);
        }
    }
    function updateItems(data, wpn) {
        if (data) {
            if (wpn) player.weapons = data;
            else player.items = data;
        }
        for (var i = 0; i < items.list.length; ++i) {
            var tmpI = (items.weapons.length + i);
            document.getElementById("actionBarItem" + tmpI).style.display = (player.items.indexOf(items.list[i].id) >= 0) ? "inline-block" : "none";
        }
        for (var i = 0; i < items.weapons.length; ++i) {
            document.getElementById("actionBarItem" + i).style.display =
                (player.weapons[items.weapons[i].type] == items.weapons[i].id) ? "inline-block" : "none";
        }
    }
    function updateStatusDisplay() {
        let diff1 = player.wood - parseInt(woodDisplay.innerText);
        let diff2 = player.stone - parseInt(stoneDisplay.innerText);
        let diff4 = player.food - parseInt(foodDisplay.innerText);
        doNextTick(() => {
            let total = diff1 + diff2 + diff4;
            if (player.weaponIndex < 9 && !isNaN(total)) {
                if (total >= 0) {
                    player.primary.xp += total;
                }
            } else if (!isNaN(total)) {
                if (total >= 0) {
                    player.secondary.xp += total;
                }
            }
        });
        scoreDisplay.innerText = player.points;
        foodDisplay.innerText = player.food;
        woodDisplay.innerText = player.wood;
        stoneDisplay.innerText = player.stone;
        if (player.kills > killCounter.innerText) {
            if (toggles.killChat()) {
                io.send("6", "Dumbasses down: " + player.kills);
                setTimeout(() => {
                    io.send("6", "I'm Super Pro");
                }, 750);
            }
        }
        killCounter.innerText = player.kills;
    }
    function updateAge(xp, mxp, age) {
        if (xp != undefined)
            player.XP = xp;
        if (mxp != undefined)
            player.maxXP = mxp;
        if (age != undefined)
            player.age = age;
        if (age == config.maxAge) {
            ageText.innerHTML = "MAX AGE";
            ageBarBody.style.width = "100%";
        } else {
            ageText.innerHTML = "AGE " + player.age;
            ageBarBody.style.width = ((player.XP / player.maxXP) * 100) + "%";
        }
    }
    function showItemInfo(item, isWeapon, isStoreItem) {
        if (player && item) {
            UTILS.removeAllChildren(itemInfoHolder);
            itemInfoHolder.classList.add("visible");
            UTILS.generateElement({
                id: "itemInfoName",
                text: UTILS.capitalizeFirst(item.name),
                parent: itemInfoHolder
            });
            UTILS.generateElement({
                id: "itemInfoDesc",
                text: item.desc,
                parent: itemInfoHolder
            });
            if (isStoreItem) {
            } else if (isWeapon) {
                UTILS.generateElement({
                    class: "itemInfoReq",
                    text: !item.type ? "primary" : "secondary",
                    parent: itemInfoHolder
                });
            } else {
                for (var i = 0; i < item.req.length; i += 2) {
                    UTILS.generateElement({
                        class: "itemInfoReq",
                        html: item.req[i] + "<span class='itemInfoReqVal'> x" + item.req[i + 1] + "</span>",
                        parent: itemInfoHolder
                    });
                }
                if (item.group.limit) {
                    UTILS.generateElement({
                        class: "itemInfoLmt",
                        text: (player.itemCounts[item.group.id] || 0) + "/" + (isSandbox ? (item.group.sandboxLimit || item.group.limit) : item.group.limit),
                        parent: itemInfoHolder
                    });
                }
            }
        } else {
            itemInfoHolder.classList.remove("visible");
        }
    }
    var tmpList = [];
    function updateUpgrades(points, age) {
        player.upgradePoints = points;
        player.upgrAge = age;
        if (points > 0) {
            tmpList.length = 0;
            UTILS.removeAllChildren(upgradeHolder);
            for (var i = 0; i < items.weapons.length; ++i) {
                if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                    var e = UTILS.generateElement({
                        id: "upgradeItem" + i,
                        class: "actionBarItem",
                        onmouseout: function () { showItemInfo(); },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = document.getElementById("actionBarItem" + i).style.backgroundImage;
                    tmpList.push(i);
                }
            }
            for (var i = 0; i < items.list.length; ++i) {
                if (items.list[i].age == age) {
                    var tmpI = (items.weapons.length + i);
                    var e = UTILS.generateElement({
                        id: "upgradeItem" + tmpI,
                        class: "actionBarItem",
                        onmouseout: function () { showItemInfo(); },
                        parent: upgradeHolder
                    });
                    e.style.backgroundImage = document.getElementById("actionBarItem" + tmpI).style.backgroundImage;
                    tmpList.push(tmpI);
                }
            }
            for (var i = 0; i < tmpList.length; i++) {
                (function (i) {
                    var tmpItem = document.getElementById('upgradeItem' + i);
                    tmpItem.onmouseover = function () {
                        if (items.weapons[i]) {
                            showItemInfo(items.weapons[i], true);
                        } else {
                            showItemInfo(items.list[i - items.weapons.length]);
                        }
                    };
                    tmpItem.onclick = UTILS.checkTrusted(function () {
                        io.send("H", i);
                    });
                    UTILS.hookTouchEvents(tmpItem);
                })(tmpList[i]);
            }
            if (tmpList.length) {
                upgradeHolder.style.display = "block";
                upgradeCounter.style.display = "block";
                upgradeCounter.innerHTML = "SELECT ITEMS (" + points + ")";
            } else {
                upgradeHolder.style.display = "none";
                upgradeCounter.style.display = "none";
                showItemInfo();
            }
        } else {
            upgradeHolder.style.display = "none";
            upgradeCounter.style.display = "none";
            showItemInfo();
        }
    }
    function toggleStoreMenu() {
        if (storeMenu.style.display != "block") {
            storeMenu.style.display = "block";
            allianceMenu.style.display = "none";
            generateStoreList();
        } else {
            storeMenu.style.display = "none";
        }
    }
    function toggleAllianceMenu() {
        resetMoveDir();
        if (allianceMenu.style.display != "block") {
            showAllianceMenu();
        } else {
            allianceMenu.style.display = "none";
        }
    }
    var bots = [];
    window.variantMulti = function (id) {
        return config.weaponVariants[id].val;
    };
    function dist(a, b) {
        return Math.sqrt(Math.pow((b.y2 || b.y) - a[2], 2) + Math.pow((b.x2 || b.x) - a[1], 2))
    }
    function dist2(a, b) {
        try {
            return Math.sqrt(Math.pow((b.y2 || b.y) - (a.y2 || a.y), 2) + Math.pow((b.x2 || b.x) - (a.x2 || a.x), 2))
        } catch (e) { }
    }
    function drawTracer(_) {
        if (!document.getElementById("enemyradar" + _.sid)) {
            let newE = document.createElement("div");
            newE.id = `enemyradar${_.sid}`;
            newE.style = `
            display: none;
            position: absolute;
            left: 0;
            top: 0;
            color: #fff;
            width: 0;
            height: 0;
            border: solid;
            border-color: transparent transparent transparent #ffffff;
            `;
            document.body.appendChild(newE);
        }
        let center_x = window.innerWidth / 2, center_y = window.innerHeight / 2;
        let rad = Math.atan2(_.y2 - player.y2, _.x2 - player.x2), alpha = Math.sqrt(Math.pow(0 - (player.x2 - _.x2), 2) + Math.pow(0 - (player.y2 - _.y2) * (16 / 9), 2)) * 100 / (maxScreenHeight / 2) / center_y;
        if (alpha > 1.0) alpha = 1.0;
        let tx = center_x + (center_y * alpha) * Math.cos(rad) - 20 / 2, ty = center_y + (center_y * alpha) * Math.sin(rad) - 20 / 2;
        document.getElementById("enemyradar" + _.sid).style.borderWidth = "10px 0px 10px 20px";
        document.getElementById("enemyradar" + _.sid).style.pointerEvents = "none";
        document.getElementById("enemyradar" + _.sid).style.left = tx + "px";
        document.getElementById("enemyradar" + _.sid).style.top = ty + "px";
        document.getElementById("enemyradar" + _.sid).style.opacity = alpha;
        document.getElementById("enemyradar" + _.sid).style.transform = `rotate(${((rad * 180) / Math.PI)}deg)`;
        document.getElementById("enemyradar" + _.sid).style.display = (player.team === null || player.team !== _.team) ? "block" : "none";
    }
    var enemies = {
        all: [],
        near: [],
        closest: null,
        angle: 0
    };
    var lastDeath;
    function sendJoin(index) {
        io.send("b", alliances[index].sid);
    }
    function kickFromClan(sid) {
        io.send("Q", sid);
    }
    function leaveAlliance() {
        allianceNotifications = [];
        updateNotifications();
        io.send("N");
    }
    function aJoinReq(join) {
        io.send("P", allianceNotifications[0].sid, join);
        if (!join) {
            allianceNotifications.shift();
            setTickout(() => {
                updateNotifications();
            }, 2);
        }
    }
    noticationDisplay.style.top = "280px";
    function updateNotifications() {
        if (allianceNotifications[0]) {
            var tmpN = allianceNotifications[0];
            UTILS.removeAllChildren(noticationDisplay);
            noticationDisplay.style.display = "block";
            UTILS.generateElement({
                class: "notificationText",
                text: `${tmpN.name} {${tmpN.sid}}`,
                parent: noticationDisplay
            });
            UTILS.generateElement({
                class: "notifButton",
                html: "<i class='material-icons' style='cursor: pointer;font-size:28px;color:#cc5151;'>&#xE14C;</i>",
                parent: noticationDisplay,
                onclick: function () { aJoinReq(0); },
                hookTouch: true
            });
            UTILS.generateElement({
                class: "notifButton",
                html: "<i class='material-icons' style='cursor: pointer;font-size:28px;color:#8ecc51;'>&#xE876;</i>",
                parent: noticationDisplay,
                onclick: function () { aJoinReq(1); },
                hookTouch: true
            });
        } else {
            noticationDisplay.style.display = "none";
        }
    }
    function showAllianceMenu() {
        if (player && player.alive) {
            storeMenu.style.display = "none";
            allianceMenu.style.display = "block";
            UTILS.removeAllChildren(allianceHolder);
            if (player.team) {
                for (var i = 0; i < alliancePlayers.length; i += 2) {
                    (function (i) {
                        var tmp = UTILS.generateElement({
                            class: "allianceItem",
                            style: "color:" + (alliancePlayers[i] == player.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                            text: alliancePlayers[i + 1],
                            parent: allianceHolder
                        });
                        if (player.isOwner && alliancePlayers[i] != player.sid) {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                text: "Kick",
                                onclick: function () { kickFromClan(alliancePlayers[i]); },
                                hookTouch: true,
                                parent: tmp
                            });
                        }
                    })(i);
                }
            } else {
                if (alliances.length) {
                    for (var i = 0; i < alliances.length; ++i) {
                        (function (i) {
                            var tmp = UTILS.generateElement({
                                class: "allianceItem",
                                style: "color:" + (alliances[i].sid == player.team ? "#fff" : "rgba(255,255,255,0.6)"),
                                text: alliances[i].sid,
                                parent: allianceHolder
                            });
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                text: "Join",
                                onclick: function () { sendJoin(i); },
                                hookTouch: true,
                                parent: tmp
                            });
                        })(i);
                    }
                } else {
                    UTILS.generateElement({
                        class: "allianceItem",
                        text: "No Tribes Yet",
                        parent: allianceHolder
                    });
                }
            }
            UTILS.removeAllChildren(allianceManager);
            if (player.team) {
                UTILS.generateElement({
                    class: "allianceButtonM",
                    style: "width: 360px",
                    text: player.isOwner ? "Delete Tribe" : "Leave Tribe",
                    onclick: function () { leaveAlliance() },
                    hookTouch: true,
                    parent: allianceManager
                });
            } else {
                UTILS.generateElement({
                    tag: "input",
                    type: "text",
                    id: "allianceInput",
                    maxLength: 7,
                    placeholder: "unique name",
                    ontouchstart: function (ev) {
                        ev.preventDefault();
                        var newValue = prompt("unique name", ev.currentTarget.value);
                        ev.currentTarget.value = newValue.slice(0, 7);
                    },
                    parent: allianceManager
                });
                UTILS.generateElement({
                    tag: "div",
                    class: "allianceButtonM",
                    style: "width: 140px;",
                    text: "Create",
                    onclick: function () { createAlliance(); },
                    hookTouch: true,
                    parent: allianceManager
                });
            }
        }
    }
    var restrictedEquip = false;
    function storeEquip(id, index) {
        if (restrictedEquip) return;
        if (onlyEMP == true && player.skinIndex != 22) {
            io.send("c", 0, 22, 0);
            restrictedEquip = true;
            setTimeout(() => {
                restrictedEquip = false;
            }, 20);
        } else if ((onlySoldier == true || otSoldier == true || trapSoldier == true || rangedSoldier == true || spikeSoldier == true) && player.skinIndex != 6) {
            io.send("c", 0, 6, 0);
            restrictedEquip = true;
            setTimeout(() => {
                restrictedEquip = false;
            }, 20);
        } else if (!index) {
            if (onlyEMP == true) {
                if (player.skinIndex != 22) {
                    io.send("c", 0, 22, 0);
                    restrictedEquip = true;
                    setTimeout(() => {
                        restrictedEquip = false;
                    }, 20);
                }
            } else if (onlySoldier == true || otSoldier == true || trapSoldier == true || rangedSoldier == true || spikeSoldier == true) {
                if (player.skinIndex != 6) {
                    io.send("c", 0, 6, 0);
                    restrictedEquip = true;
                    setTimeout(() => {
                        restrictedEquip = false;
                    }, 20);
                }
            } else {
                if (player.skinIndex != id && player.skins[id] && id > 0) {
                    io.send("c", 0, id, 0);
                    restrictedEquip = true;
                    setTimeout(() => {
                        restrictedEquip = false;
                    }, 20);
                }
            }
        } else {
            if (player.tailIndex != id && player.tails[id] && id > 0) {
                io.send("c", 0, id, 1);
                restrictedEquip = true;
                setTimeout(() => {
                    restrictedEquip = false;
                }, 20);
            } else if (player.tailIndex != 0 && !player.tails[id]) {
                io.send("c", 0, 0, 1);
                restrictedEquip = true;
                setTimeout(() => {
                    restrictedEquip = false;
                }, 20);
            }
        }
    }
    function storeBuy(id, index) {
        io.send("c", 1, id, index);
    }
    var shopList = [{
        id: 11,
        price: 2e3,
        acc: 1
    }, {
        id: 15,
        price: 600,
        acc: 0
    }, {
        id: 6,
        price: 4e3,
        acc: 0
    }, {
        id: 7,
        price: 6e3,
        acc: 0
    }, {
        id: 22,
        price: 6e3,
        acc: 0
    }, {
        id: 40,
        price: 15e3,
        acc: 0
    }, {
        id: 53,
        topSprite: true,
        price: 10e3,
        acc: 0
    }, {
        id: 31,
        price: 25e2,
        acc: 0
    }, {
        id: 12,
        price: 6e3,
        acc: 0
    }, {
        id: 11,
        topSprite: true,
        price: 10e3,
        acc: 0
    }, {
        id: 19,
        price: 15e3,
        acc: 1
    }, {
        id: 21,
        price: 20e3,
        acc: 1
    }, {
        id: 20,
        price: 12e3,
        acc: 0
    }, {
        id: 18,
        price: 20e3,
        acc: 1
    }];
    var autobuy = setInterval(() => {
        if (player && toggles.autobuy()) {
            let item = shopList.find(e => (e.acc ? !player.tails[e.id] : !player.skins[e.id]));
            if (item && player && player.points >= item.price) {
                storeBuy(item.id, item.acc);
                item.bought = true;
            }
            if (!item) {
                clearInterval(autobuy);
                document.getElementById("autobuy").checked = false;
                document.getElementById("autobuy").disabled = true;
            }
        }
    }, 500);
    function isBlocked(object1, object2, scale = 20) {
        let oDist = Math.hypot((object2.y2 || object2.y) - (object1.y2 || object1.y), (object2.x2 || object2.x) - (object1.x2 || object1.x));
        let dir = Math.atan2((object2.y2 || object2.y) - (object1.y2 || object1.y), (object2.x2 || object2.x) - (object1.x2 || object1.x));
        let Objects = gameObjects;
        for (let i = 0; i < Objects.length; i++) {
            let obj = Objects[i];
            if (!obj.ignoreCollision && obj != object1 && obj != object2 && Math.hypot(obj.y - (object1.y2 || object1.y), obj.x - (object1.x2 || object1.x)) < oDist) {
                let dist = Math.hypot((object2.y2 || object2.y) - obj.y, (object2.x2 || object2.x) - obj.x)
                let newX = object1.x + Math.cos(dir) * dist;
                let newY = object1.y + Math.sin(dir) * dist;
                if (Math.hypot(newY - obj.y, newX - obj.x) <= obj.scale + scale) {
                    return true;
                }
            }
        }
        return false;
    }
    var currentStoreIndex = 0;
    var playerItems = {};
    function changeStoreIndex(index) {
        if (currentStoreIndex != index) {
            currentStoreIndex = index;
            generateStoreList();
        }
    }
    window.changeStoreIndex = changeStoreIndex;
    function createAlliance() {
        io.send("L", document.getElementById("allianceInput").value);
    }
    function generateStoreList() {
        if (player) {
            UTILS.removeAllChildren(storeHolder);
            var index = currentStoreIndex;
            var tmpArray = index ? accessories : hats;
            for (var i = 0; i < tmpArray.length; ++i) {
                if (!tmpArray[i].dontSell) {
                    (function (i) {
                        var tmp = UTILS.generateElement({
                            id: "storeDisplay" + i,
                            class: "storeItem",
                            onmouseout: function () { showItemInfo(); },
                            onmouseover: function () { showItemInfo(tmpArray[i], false, true); },
                            parent: storeHolder
                        });
                        UTILS.hookTouchEvents(tmp, true);
                        UTILS.generateElement({
                            tag: "img",
                            class: "hatPreview",
                            src: "../img/" + (index ? "accessories/access_" : "hats/hat_") + tmpArray[i].id + (tmpArray[i].topSprite ? "_p" : "") + ".png",
                            parent: tmp
                        });
                        UTILS.generateElement({
                            tag: "span",
                            text: tmpArray[i].name,
                            parent: tmp
                        });
                        if (index ? (!player.tails[tmpArray[i].id]) : (!player.skins[tmpArray[i].id])) {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                style: "margin-top: 5px",
                                text: "Buy",
                                onclick: function () { storeBuy(tmpArray[i].id, index); },
                                hookTouch: true,
                                parent: tmp
                            });
                            UTILS.generateElement({
                                tag: "span",
                                class: "itemPrice",
                                text: tmpArray[i].price,
                                parent: tmp
                            })
                        } else if ((index ? player.tailIndex : player.skinIndex) == tmpArray[i].id) {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                style: "margin-top: 5px",
                                text: "Unequip",
                                onclick: function () { storeEquip(0, index); },
                                hookTouch: true,
                                parent: tmp
                            });
                        } else {
                            UTILS.generateElement({
                                class: "joinAlBtn",
                                style: "margin-top: 5px",
                                text: "Equip",
                                onclick: function () { storeEquip(tmpArray[i].id, index); },
                                hookTouch: true,
                                parent: tmp
                            });
                        }
                    })(i);
                }
            }
        }
    }
    var hitting = false;
    var oneTickBowInsta = false;
    var moveTicking = false;
    function hideAllWindows() {
        storeMenu.style.display = "none";
        allianceMenu.style.display = "none";
    }
    function renderPlayer(obj, ctxt) {
        ctxt = ctxt || mainContext;
        ctxt.lineWidth = outlineWidth;
        ctxt.lineJoin = "miter";
        var handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
        var oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
        var oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;
        if (obj.tailIndex > 0) {
            renderTail(obj.tailIndex, ctxt, obj);
        }
        if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
            let index = obj.weaponIndex == 3 && toggles.katanaTexture() ? 4 : obj.weaponIndex;
            renderTool(items.weapons[index], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[index].projectile != undefined && !items.weapons[index].hideProjectile) {
                renderProjectile(obj.scale, 0, items.projectiles[items.weapons[index].projectile], mainContext);
            }
        }
        ctxt.fillStyle = config.skinColors[obj.skinColor];
        renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
        renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle), (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);
        if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
            let index = obj.weaponIndex == 3 && toggles.katanaTexture() ? 4 : obj.weaponIndex;
            renderTool(items.weapons[index], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
            if (items.weapons[index].projectile != undefined && !items.weapons[index].hideProjectile) {
                renderProjectile(obj.scale, 0, items.projectiles[items.weapons[index].projectile], mainContext);
            }
        }
        if (obj.buildIndex >= 0) {
            var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
            ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
        }
        renderCircle(0, 0, obj.scale, ctxt);
        if (obj.skinIndex > 0) {
            ctxt.rotate(Math.PI / 2);
            renderSkin(obj.skinIndex, ctxt, null, obj);
        }
    }
    var keys = {};
    var moveKeys = {
        87: [0, -1],
        //38: [0, -1],
        83: [0, 1],
        //40: [0, 1],
        65: [-1, 0],
        //37: [-1, 0],
        68: [1, 0],
        //39: [1, 0]
    };
    var lastDir;
    var waitTicks = [];
    function doNextTick(action) {
        waitTicks.push(action);
    }
    var insta = {
        oneShot: false,//13 - angel, 19 - shadow wings, 18 - blood wings, 21 - corrupt x
        end: function () {
            hitting = false;
            autoaim = false;
            attackLoop.change(false);
            autoPrimary.change(false);
            autoSecondary.change(false);
        },
        resetSecondary: function () {
            if ([15, 12, 13, 14].includes(player.weapons[1])) {
                player.secondary.reload = -config.serverUpdateSpeed / items.weapons[player.weapons[1]].speed;
            }
        },
        bullHit: function () {
            autoaim = true;
            hitting = true;
            storeEquip(7);
            selectToBuild(player.weapons[0], true);
            autoSecondary.change(false);
            autoPrimary.change(true);
            attackLoop.change(true);
            setTickout(() => {
                this.end();
            }, 2);
        },
        normal: function () {
            autoaim = true;
            storeEquip(7);
            selectToBuild(player.weapons[0], true);
            autoPrimary.change(true);
            autoSecondary.change(false);
            hitting = true;
            attackLoop.change(true);
            setTickout(() => {
                io.send("D", enemies.angle);
                storeEquip(53);
                selectToBuild(player.weapons[1], true);
                autoSecondary.change(true);
                autoPrimary.change(false);
                this.resetSecondary();
                setTickout(() => {
                    this.end();
                }, 1);
            }, 1);
        },
        nobull: function () {
            autoaim = true;
            storeEquip(6);
            selectToBuild(player.weapons[0], true);
            autoPrimary.change(true);
            autoSecondary.change(false);
            hitting = true;
            attackLoop.change(true);
            setTickout(() => {
                io.send("D", enemies.angle);
                storeEquip(53);
                selectToBuild(player.weapons[1], true);
                autoSecondary.change(true);
                autoPrimary.change(false);
                this.resetSecondary();
                setTickout(() => {
                    this.end();
                }, 1);
            }, 1);
        },
        reverse: function () {
            autoaim = true;
            selectToBuild(player.weapons[1], true);
            autoSecondary.change(true);
            autoPrimary.change(false);
            storeEquip(53);
            hitting = true;
            this.resetSecondary();
            attackLoop.change(true);
            setTickout(() => {
                autoSecondary.change(false);
                selectToBuild(player.weapons[0], true);
                storeEquip(7);
                autoPrimary.change(true);
                setTickout(() => {
                    this.end();
                }, 1);
            }, 1);
        },
        bow: function () {
            autoaim = true;
            autoPrimary.change(false);
            autoSecondary.change(true);
            storeEquip(53);
            selectToBuild(player.weapons[1], true);
            attackLoop.change(true);
            setTickout(() => {
                io.send("H", 12);
                player.secondary.reload = -config.serverUpdateSpeed / items.weapons[12].speed;
                storeEquip(53, 0);
                setTickout(() => {
                    io.send("H", 15);
                    player.secondary.reload = -config.serverUpdateSpeed / items.weapons[15].speed;
                    storeEquip(53, 0);
                    setTickout(() => {
                        autoaim = false;
                        autoPrimary.change(false);
                        autoSecondary.change(false);
                        attackLoop.change(false);
                    }, 1);
                }, 1);
            }, 1);
        },
        onetick: function () {
            oneticking = true;
            autoaim = true;
            io.send("a", enemies.angle);
            storeEquip(53);
            selectToBuild(player.weapons[1], true);
            hitting = true;
            setTimeout(() => {
                selectToBuild(player.weapons[0], true);
                autoSecondary.change(false);
                autoPrimary.change(true);
                storeEquip(7);
                io.send("d", 1, enemies.angle);
                io.send("d", 0, enemies.angle);
                setTimeout(() => {
                    autoaim = false;
                    oneticking = false;
                    autoPrimary.change(false);
                    autoSecondary.change(false);
                }, 100);
            }, config.serverUpdateSpeed);
        },
        do: function (type = "normal") {
            if (type == "bow") {
                this.bow();
            } else if (type == "bullhit") {
                this.bullHit();
            } else if (type == "onetick") {
                this.onetick();
            } else if (type == "reverse") {
                this.oneShot = false;
                this.reverse();
            } else if (type == "nobull") {
                this.oneShot = false;
                this.nobull();
            } else {
                this.oneShot = false;
                this.normal();
            }
        }
    };
    function selectToBuild(index, wpn) {
        io.send("G", index, wpn);
    }
    function sendMapPing() {
        insta.oneShot = !insta.oneShot;
    }
    var bowSpam = false, scriptStatus = "none";
    var autoPrimary = {
        interval: null,
        status: false,
        change: function (boolean) {
            if (boolean == true) {
                clearInterval(this.interval);
                this.status = true;
                this.interval = setInterval(() => {
                    if (player.weaponIndex != player.weapons[0]) {
                        selectToBuild(player.weapons[0], true);
                    }
                }, 50);
            } else {
                this.status = false;
                clearInterval(this.interval);
            }
        }
    };
    var autoSecondary = {
        interval: null,
        status: false,
        change: function (boolean) {
            if (boolean == true) {
                clearInterval(this.interval);
                this.status = true;
                this.interval = setInterval(() => {
                    if (player.weaponIndex != player.weapons[1]) {
                        selectToBuild(player.weapons[1], true);
                    }
                }, 50);
            } else {
                this.status = false;
                clearInterval(this.interval);
            }
        }
    }, trapSoldier = false;
    var chatBox = document.getElementById("chatBox");
    var chatHolder = document.getElementById("chatHolder");
    function sendChat(message) {
        io.send("6", message.slice(0, 30));
    }
    function toggleChat() {
        if (document.activeElement.id.toLowerCase() !== "chatbox") {
            if (spamchat == true) {
                for (let i = 0; i < audios.length; i++) {
                    audios[i].pause();
                }
            }
            resetMoveDir();
            chatHolder.style.display = "block";
            chatBox.focus();
        } else {
            if (spamchat == true) {
                audios[document.getElementById("chatType").value].play();
            }
            sendChat(chatBox.value);
            commands.style.display = "none";
            chatHolder.style.display = "none";
            chatBox.blur();
        }
        chatBox.value = "";
    }
    var audios = [
        new Audio("https://cdn.discordapp.com/attachments/748171769155944448/1149859824264294470/taking_over.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/967213871267971072/1027001423034065006/DR._LOVE___DONT_STAND_SO_CLOSED_INITIAL_D.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/967213871267971072/1027051825871990845/YT2mp3.info_-_Imagine_Dragons_-_Warriors_Lyrics_320kbps.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/967213871267971072/1027003301465706537/Ken_Blast_-_The_Top_Lyrics_Video_Eurobeat_Initial_D_REUPLOAD.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/836319356186263552/1080645434428641340/Ace_-_Adrenaline_Lyrics_and_Visualizer.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/836319356186263552/1081055603440484433/v-o-e-giants-lyrics-lyrical-video_tBpPyVYB_1.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/836319356186263552/1088629720603697173/tomp3.cc_-_RISE_Lyrics_ft_The_Glitch_Mob_Mako_and_The_Word_Alive.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/967213871267971072/1112484656303050762/Invincible.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/967213871267971072/1112485411999191090/burn_it_all_down.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/1086262250647584800/1094139045547876402/Initial_D_-_Deja_Vu_1-1.mp3"),
        new Audio("https://cdn.discordapp.com/attachments/748171769155944448/1157779922111184930/Jonth_Tom_Wilson_Facading_MAGNUS_Jagsy_Vosai_RudeLies__Domastic_-_Heartless_NCS_Release.mp3?ex=6519da13&is=65188893&hm=fbeb9edd17226760a8d88f0f1a0473adb2e4015637d1fd93fe3524b17b1bb9ba&"),
        new Audio("https://cdn.discordapp.com/attachments/748171769155944448/1157779341405589666/Zack_Merci_X_CRVN_-_Nobody_NCS_Release.mp3?ex=6519d989&is=65188809&hm=10ca9d434b87666af67d04a79aef734a6a45aecb8fcf79a3fd46dbaf7c41ea0f&")
    ];
    function turnIntoMS(t, n) {
        let a = 0;
        a += 1e3 * n
        a += 6e4 * t;
        return a;
    }
    var chatData = {
        0: [{ chat: "We at the top again, now what?", delay: 16e3 }, { chat: "Heavy lay the crown, but", delay: 18e3 }, { chat: "Count us", delay: 2e4 }, { chat: "Higher than the mountain", delay: 21e3 }, { chat: "And we be up here", delay: 23e3 }, { chat: "for the long run", delay: 24e3 }, { chat: "Strap in for a long one", delay: 25e3 }, { chat: "We got everybody on one", delay: 27e3 }, { chat: "Now you're coming at the king", delay: 29e3 }, { chat: "so you better not miss", delay: 31e3 }, { chat: "And we only get stronger", delay: 33e3 }, { chat: "With everthing I carry", delay: 36e3 }, { chat: "up on my back", delay: 37e3 }, { chat: "you should paint it up", delay: 39e3 }, { chat: "you should paint it up", delay: 39e3 }, { chat: "with a target", delay: 41e3 }, { chat: "Why would you dare me to", delay: 46e3 }, { chat: "do it again?", delay: 47e3 }, { chat: "Come get your spoiler up ahead", delay: 5e4 }, { chat: "We're taking over,", delay: 53e3 }, { chat: "We're taking over", delay: 56e3 }, { chat: "Look at you come at my name,", delay: 61e3 }, { chat: "you 'oughta know by now,", delay: 63e3 }, { chat: "That We're Taking Over,", delay: 66e3 }, { chat: "We're Taking Over", delay: 69e3 }, { chat: "Maybe you wonder what", delay: 74e3 }, { chat: "you're futures gonna be, but", delay: 75e3 }, { chat: "I got it all locked up", delay: 77e3 }, { chat: "Take a lap, now", delay: 93e3 }, { chat: "Don't be mad, now", delay: 95e3 }, { chat: "Run it back, run it back,", delay: 97e3 }, { chat: "run it back, now", delay: 98e3 }, { chat: "I got bodies lining up,", delay: 1e5 }, { chat: "think you're dreaming", delay: 101e3 }, { chat: "of greatness", delay: 102e3 }, { chat: "Send you back home,", delay: 103e3 }, { chat: "let you wake up", delay: 105e3 }, { chat: "Why would you dare me to", delay: 11e4 }, { chat: "do it again?", delay: 111e3 }, { chat: "Come get your spoiler up ahead", delay: 114e3 }, { chat: "We're taking over,", delay: 117e3 }, { chat: "We're taking over", delay: 12e4 }, { chat: "Look at you come at my name,", delay: 125e3 }, { chat: "you 'oughta know by now,", delay: 127e3 }, { chat: "That We're Taking Over,", delay: 13e4 }, { chat: "We're Taking Over", delay: 133e3 }, { chat: "Maybe you wonder what", delay: 138e3 }, { chat: "you're futures gonna be, but", delay: 14e4 }, { chat: "I got it all locked up", delay: 141e3 }, { chat: "毕竟, 什么还存在", trans: true, delay: 157e3 }, { chat: "除了打架", trans: true, delay: 158e3 }, { chat: "我周围,", trans: true, delay: 16e4 }, { chat: "键盘发出咔嗒声,", trans: true, delay: 161e3 }, { chat: "时钟在滴答作响", trans: true, delay: 162e3 }, { chat: "还不够, 让我", trans: true, delay: 164e3 }, { chat: "保护你的坚持", trans: true, delay: 165e3 }, { chat: "即使为时已晚", trans: true, delay: 167e3 }, { chat: "放开战斗,", trans: true, delay: 168e3 }, { chat: "就在这一刻", trans: true, delay: 169e3 }, { chat: "I got the heart of lion", delay: 17e4 }, { chat: "I know the higher you climbing", delay: 171e3 }, { chat: "the harder you fall", delay: 172e3 }, { chat: "I'm at the top of the mount", delay: 173e3 }, { chat: "Too many bodies to count,", delay: 174e3 }, { chat: "I've been through it all", delay: 175e3 }, { chat: "I had to weather the storm", delay: 176e3 }, { chat: "to get to level I'm on", delay: 178e3 }, { chat: "That's how the legend was born", delay: 179e3 }, { chat: "All of my enemies already dead", delay: 18e4 }, { chat: "I'm bored, I'm ready for more", delay: 182e3 }, { chat: "They know I'm ready for war", delay: 183e3 }, { chat: "I told em", delay: 184e3 }, { chat: "We're Taking Over,", delay: 185e3 }, { chat: "We're Taking Over", delay: 186e3 }, { chat: "Look at you come at my name,", delay: 192e3 }, { chat: "you 'oughta know by now,", delay: 194e3 }, { chat: "That We're Taking Over,", delay: 197e3 }, { chat: "We're Taking Over", delay: 2e5 }, { chat: "Maybe you wonder what", delay: 205e3 }, { chat: "you're futures gonna be, but", delay: 206e3 }, { chat: "I got it all locked up", delay: 208e3 }],
        1: [{ chat: "We'll be together", delay: 16428 }, { chat: "'till the morning light", delay: 17431 }, { chat: "Don't stand so", delay: 19430 }, { chat: "Don't stand so", delay: 20537 }, { chat: "Don't stand so close to me", delay: 22394 }, { chat: "Baby you belong to me", delay: 37544 }, { chat: "Yes you do, yes you do", delay: 40608 }, { chat: "You're my affection", delay: 42118 }, { chat: "I can make a woman cry", delay: 43959 }, { chat: "Yes I do, yes I do", delay: 46846 }, { chat: "I will be good", delay: 48323 }, { chat: "You're like a cruel device", delay: 50330 }, { chat: "your blood is cold like ice", delay: 51530 }, { chat: "Posion for my veins", delay: 53126 }, { chat: "I'm breaking my chains", delay: 54520 }, { chat: "One look and you can kill", delay: 56534 }, { chat: "my pain now is your thrill", delay: 58353 }, { chat: "Your love is for me", delay: 60466 }, { chat: "I say Try me", delay: 62135 }, { chat: "take a chance on emotions", delay: 63844 }, { chat: "For now and ever", delay: 65424 }, { chat: "close to your heart", delay: 66521 }, { chat: "I say Try me", delay: 68012 }, { chat: "take a chance on my passion", delay: 69655 }, { chat: "We'll be together all the time", delay: 71915 }, { chat: "I say Try me", delay: 73862 }, { chat: "take a chance on emotions", delay: 76381 }, { chat: "For now and ever", delay: 77832 }, { chat: "into my heart", delay: 79038 }, { chat: "I say Try me", delay: 80568 }, { chat: "take a chance on my passion", delay: 81941 }, { chat: "We'll be together", delay: 83895 }, { chat: "'till the morning light", delay: 85005 }, { chat: "Don't stand so", delay: 87068 }, { chat: "Don't stand so", delay: 88647 }, { chat: "Don't stand so close to me", delay: 90090 }, { chat: "Baby let me take control", delay: 106239 }, { chat: "Yes I do, yes I do", delay: 108257 }, { chat: "You are my target", delay: 110121 }, { chat: "No one ever made me cry", delay: 111761 }, { chat: "What you do, what you do", delay: 114535 }, { chat: "Baby's so bad", delay: 116056 }, { chat: "You're like a cruel device", delay: 118376 }, { chat: "your blood is cold like ice", delay: 119797 }, { chat: "Posion for my veins", delay: 121602 }, { chat: "I'm breaking my chains", delay: 123250 }, { chat: "One look and you can kill", delay: 124849 }, { chat: "my pain now is your thrill", delay: 126381 }, { chat: "Your love is for me", delay: 128096 }, { chat: "I say Try me", delay: 129310 }, { chat: "take a chance on emotions", delay: 131038 }, { chat: "For now and ever", delay: 132844 }, { chat: "close to your heart", delay: 134255 }, { chat: "I say Try me", delay: 135932 }, { chat: "take a chance on my passion", delay: 137255 }, { chat: "We'll be together all the time", delay: 139257 }, { chat: "I say Try me", delay: 141863 }, { chat: "take a chance on emotions", delay: 143342 }, { chat: "For now and ever into my heart", delay: 145433 }, { chat: "I say Try me", delay: 148679 }, { chat: "take a chance on my passion", delay: 150190 }, { chat: "We'll be together", delay: 151716 }, { chat: "'till the morning light", delay: 153966 }, { chat: "Don't stand so", delay: 155878 }, { chat: "Don't stand so", delay: 156935 }, { chat: "Don't stand so close to me", delay: 158061 }, { chat: "I say Try me", delay: 185081 }, { chat: "take a chance on emotions", delay: 186492 }, { chat: "For now and ever", delay: 188577 }, { chat: "close to your heart", delay: 189819 }, { chat: "I say Try me", delay: 191359 }, { chat: "take a chance on my passion", delay: 193068 }, { chat: "We'll be together all the time", delay: 194729 }, { chat: "I say Try me", delay: 197008 }, { chat: "take a chance on emotions", delay: 198865 }, { chat: "For now and ever", delay: 200708 }, { chat: "into my heart", delay: 201879 }, { chat: "I say Try me", delay: 203396 }, { chat: "take a chance on my passion", delay: 204804 }, { chat: "We'll be together", delay: 206818 }, { chat: "'till the morning light", delay: 208209 }, { chat: "Don't stand so", delay: 210163 }, { chat: "Don't stand so", delay: 211692 }, { chat: "Don't stand so close to me", delay: 213290 }, { chat: "Try me", delay: 228763 }, { chat: "take a chance on emotions", delay: 229917 }, { chat: "For now and ever", delay: 232175 }, { chat: "close to your heart", delay: 233605 }, { chat: "I say Try me", delay: 234494 }, { chat: "take a chance on my passion", delay: 235826 }, { chat: "We'll be together all the time", delay: 237819 }, { chat: "I say Try me", delay: 240095 }, { chat: "take a chance on emotions", delay: 241754 }, { chat: "For now and ever", delay: 244041 }, { chat: "into my heart", delay: 245137 }, { chat: "I say Try me", delay: 246804 }, { chat: "take a chance on my passion", delay: 248067 }, { chat: "We'll be together", delay: 249872 }, { chat: "'till the morning light", delay: 251107 }, { chat: "Don't stand so", delay: 253246 }, { chat: "Don't stand so", delay: 254803 }, { chat: "Don't stand so close to me", delay: 256372 }, { delay: 259025 }, { delay: 260829 }, { delay: 261174 }],
        2: [{ chat: "As a child you would wait", delay: 6e3 }, { chat: "And watch from far away", delay: 9e3 }, { chat: "But you always knew", delay: 12e3 }, { chat: "that you'd be the one", delay: 14e3 }, { chat: "That work while they all play", delay: 15e3 }, { chat: "In youth you'd lay", delay: 18e3 }, { chat: "Awake at night and scheme", delay: 21e3 }, { chat: "Of all the things", delay: 24e3 }, { chat: "that you would change", delay: 26e3 }, { chat: "But it was just a dream", delay: 27e3 }, { chat: "Here we are,", delay: 31e3 }, { chat: "Don't turn away now", delay: 33e3 }, { chat: "We are the warriors", delay: 37e3 }, { chat: "that built this town", delay: 39e3 }, { chat: "Here we are", delay: 43e3 }, { chat: "Don't turn away now", delay: 45e3 }, { chat: "We are the warriors", delay: 49e3 }, { chat: "that built this town", delay: 51e3 }, { chat: "from dust", delay: 55e3 }, { chat: "The time will come", delay: 57e3 }, { chat: "When you'll have to rise", delay: 58e3 }, { chat: "above the best", delay: 61e3 }, { chat: "and prove yourself", delay: 63e3 }, { chat: "Your spirit never dies", delay: 64e3 }, { chat: "Farewell, I've gone", delay: 67e3 }, { chat: "to take my throne above", delay: 71e3 }, { chat: "But don't weep for me", delay: 73e3 }, { chat: "Cause this will be", delay: 75e3 }, { chat: "The labor of my love", delay: 77e3 }, { chat: "Here we are,", delay: 8e4 }, { chat: "Don't turn away now", delay: 82e3 }, { chat: "We are the warriors", delay: 86e3 }, { chat: "that built this town", delay: 89e3 }, { chat: "Here we are", delay: 92e3 }, { chat: "Don't turn away now", delay: 94e3 }, { chat: "We are the warriors", delay: 98e3 }, { chat: "that built this town", delay: 101e3 }, { chat: "from dust", delay: 104e3 }, { chat: "Here we are,", delay: 129e3 }, { chat: "Don't turn away now", delay: 132e3 }, { chat: "We are the warriors", delay: 136e3 }, { chat: "that built this town", delay: 132e3 }, { chat: "Here we are", delay: 142e3 }, { chat: "Don't turn away now", delay: 144e3 }, { chat: "We are the warriors", delay: 148e3 }, { chat: "that built this town", delay: 15e4 }, { chat: "from dust", delay: 154e3 }],
        3: [{ chat: "Final lap", delay: 39e3 }, { chat: "I'm on top of the world", delay: 4e4 }, { chat: "And I will never", delay: 41e3 }, { chat: "rest for second again!", delay: 42e3 }, { chat: "One more time", delay: 45e3 }, { chat: "I have beaten them out", delay: 46e3 }, { chat: "The scent of gasoline", delay: 47e3 }, { chat: "announces the end!", delay: 49e3 }, { chat: "They all said", delay: 51e3 }, { chat: "I'd best give it up", delay: 52e3 }, { chat: "What a fool", delay: 53e3 }, { chat: "to believe their lies!", delay: 54e3 }, { chat: "Now they've fallen", delay: 57e3 }, { chat: "and I'm at the top", delay: 58e3 }, { chat: "Are you ready", delay: 59e3 }, { chat: "now to die-ie-ie?!", delay: 6e4 }, { chat: "I came up from the bottom,", delay: 63e3 }, { chat: "and into the top", delay: 64e3 }, { chat: "For the first time", delay: 65e3 }, { chat: "I feel alive!", delay: 66e3 }, { chat: "I can fly like an eagle,", delay: 69e3 }, { chat: "and strike like a hawk!", delay: 7e4 }, { chat: "Do you think you can survive", delay: 72e3 }, { chat: "the top?", delay: 75e3 }, { chat: "One more turn", delay: 87e3 }, { chat: "and I'll settle the score", delay: 88e3 }, { chat: "A rubber fire screams", delay: 89e3 }, { chat: "into the night", delay: 91e3 }, { chat: "Crash and burn is", delay: 93e3 }, { chat: "what you're gonna do", delay: 94e3 }, { chat: "I am a master of", delay: 95e3 }, { chat: "the asphalt fight!", delay: 97e3 }, { chat: "They all said", delay: 99e3 }, { chat: "I'd best give it up", delay: 1e5 }, { chat: "What a fool to", delay: 101e3 }, { chat: "believe their lies!", delay: 104e3 }, { chat: "Now they've fallen", delay: 105e3 }, { chat: "and I'm at the top", delay: 106e3 }, { chat: "Are you ready", delay: 107e3 }, { chat: "now to die-ie-ie?!", delay: 108e3 }, { chat: "I came up from the bottom,", delay: 11e4 }, { chat: "and into the top", delay: 112e3 }, { chat: "For the first time", delay: 113e3 }, { chat: "I feel alive!", delay: 114e3 }, { chat: "I can fly like an eagle,", delay: 117e3 }, { chat: "and strike like a hawk!", delay: 118e3 }, { chat: "Do you think you can survive", delay: 12e4 }, { chat: "I came up from the bottom,", delay: 123e3 }, { chat: "and into the top", delay: 124e3 }, { chat: "For the first time", delay: 125e3 }, { chat: "I feel alive!", delay: 126e3 }, { chat: "I can fly like an eagle,", delay: 129e3 }, { chat: "and strike like a hawk!", delay: 13e4 }, { chat: "Do you think you can survive", delay: 131e3 }, { chat: "the top?", delay: 134e3 }, { chat: "I came up from the bottom,", delay: 171e3 }, { chat: "and into the top", delay: 172e3 }, { chat: "For the first time", delay: 173e3 }, { chat: "I feel alive!", delay: 174e3 }, { chat: "I can fly like an eagle,", delay: 177e3 }, { chat: "and strike like a hawk!", delay: 178e3 }, { chat: "Do you think you can survive", delay: 18e4 }, { chat: "I came up from the bottom,", delay: 183e3 }, { chat: "and into the top", delay: 184e3 }, { chat: "For the first time", delay: 185e3 }, { chat: "I feel alive!", delay: 186e3 }, { chat: "I can fly like an eagle,", delay: 189e3 }, { chat: "and strike like a hawk!", delay: 19e4 }, { chat: "Do you think you can survive", delay: 192e3 }, { chat: "the top?", delay: 194e3 }, { chat: "I came up from the bottom,", delay: 23e4 }, { chat: "and into the top", delay: 232e3 }, { chat: "For the first time", delay: 233e3 }, { chat: "I feel alive!", delay: 234e3 }, { chat: "I can fly like an eagle,", delay: 237e3 }, { chat: "and strike like a hawk!", delay: 238e3 }, { chat: "Do you think you can survive", delay: 239e3 }, { chat: "I came up from the bottom,", delay: 243e3 }, { chat: "and into the top", delay: 244e3 }, { chat: "For the first time", delay: 245e3 }, { chat: "I feel alive!", delay: 246e3 }, { chat: "I can fly like an eagle,", delay: 249e3 }, { chat: "and strike like a hawk!", delay: 25e4 }, { chat: "Do you think you can survive", delay: 252e3 }, { chat: "the top?", delay: 255e3 }],
        4: [{ chat: "Energy, a heart explosion", delay: 7e3 }, { chat: "All I need, adrenaline", delay: 11e3 }, { chat: "Never stop to is in my mind", delay: 13e3 }, { chat: "Fire away, adrenaline", delay: 16e3 }, { chat: "Energy, a heart explosion", delay: 2e4 }, { chat: "All I need, adrenaline", delay: 23e3 }, { chat: "Never stop to is in my mind", delay: 26e3 }, { chat: "Fire away, adrenaline", delay: 29e3 }, { chat: "Body feels like lava flowin'", delay: 59e3 }, { chat: "Hard adrenaline", delay: turnIntoMS(1, 2) }, { chat: "Rushin' through", delay: turnIntoMS(1, 5) }, { chat: "the pain and squeezing", delay: turnIntoMS(1, 6) }, { chat: "Power's runnin' in my veins", delay: turnIntoMS(1, 8) }, { chat: "Fight or flight", delay: turnIntoMS(1, 10) }, { chat: "And my mind turns crazy", delay: turnIntoMS(1, 12) }, { chat: "It's time to do or die", delay: turnIntoMS(1, 15) }, { chat: "Fear thunders in", delay: turnIntoMS(1, 17) }, { chat: "my heart and I, and I", delay: turnIntoMS(1, 19) }, { chat: "Energy, a heart explosion", delay: turnIntoMS(1, 23) }, { chat: "All I need, adrenaline", delay: turnIntoMS(1, 26) }, { chat: "Never stop to is in my mind", delay: turnIntoMS(1, 29) }, { chat: "Fire away, adrenaline", delay: turnIntoMS(1, 32) }, { chat: "Rollercoaster of emotion", delay: turnIntoMS(1, 36) }, { chat: "I just need adrenaline", delay: turnIntoMS(1, 39) }, { chat: "Setting all the worlds afire", delay: turnIntoMS(1, 41) }, { chat: "Energy, adrenaline", delay: turnIntoMS(1, 45) }, { chat: "It's no game,", delay: turnIntoMS(2, 0) }, { chat: "we're messin' 'round with", delay: turnIntoMS(2, 1) }, { chat: "Hard adrenaline", delay: turnIntoMS(2, 3) }, { chat: "Waste a wave of", delay: turnIntoMS(2, 6) }, { chat: "hungry feelings", delay: turnIntoMS(2, 8) }, { chat: "Just bring out the best in me", delay: turnIntoMS(2, 9) }, { chat: "Fight or flight", delay: turnIntoMS(2, 11) }, { chat: "And my mind turns crazy", delay: turnIntoMS(2, 13) }, { chat: "It's time to do or die", delay: turnIntoMS(2, 15) }, { chat: "Fear thunders in", delay: turnIntoMS(2, 18) }, { chat: "my heart and I, and I", delay: turnIntoMS(2, 20) }, { chat: "Energy, a heart explosion", delay: turnIntoMS(2, 24) }, { chat: "All I need, adrenaline", delay: turnIntoMS(2, 27) }, { chat: "Never stop to is in my mind", delay: turnIntoMS(2, 30) }, { chat: "Fire away, adrenaline", delay: turnIntoMS(2, 33) }, { chat: "Rollercoaster of emotion", delay: turnIntoMS(2, 36) }, { chat: "I just need adrenaline", delay: turnIntoMS(2, 39) }, { chat: "Setting all the worlds afire", delay: turnIntoMS(2, 42) }, { chat: "Energy, adrenaline", delay: turnIntoMS(2, 45) }, { chat: "Body feels like lava flowin'", delay: turnIntoMS(3, 14) }, { chat: "Hard adrenaline", delay: turnIntoMS(3, 17) }, { chat: "Rushin' through the", delay: turnIntoMS(3, 20) }, { chat: "pain and squeezing", delay: turnIntoMS(3, 22) }, { chat: "Power's runnin' in my veins", delay: turnIntoMS(3, 23) }, { chat: "Fight or flight", delay: turnIntoMS(3, 26) }, { chat: "And my mind turns crazy", delay: turnIntoMS(3, 27) }, { chat: "It's time to do or die", delay: turnIntoMS(3, 30) }, { chat: "Fear thunders in", delay: turnIntoMS(3, 32) }, { chat: "my heart and I, and I", delay: turnIntoMS(3, 34) }, { chat: "Energy, a heart explosion", delay: turnIntoMS(3, 38) }, { chat: "All I need, adrenaline", delay: turnIntoMS(3, 42) }, { chat: "Never stop to is in my mind", delay: turnIntoMS(3, 45) }, { chat: "Fire away, adrenaline", delay: turnIntoMS(3, 47) }, { chat: "Rollercoaster of emotion", delay: turnIntoMS(3, 53) }, { chat: "I just need adrenaline", delay: turnIntoMS(3, 55) }, { chat: "Setting all the worlds afire", delay: turnIntoMS(3, 58) }, { chat: "Energy, adrenaline", delay: turnIntoMS(4, 1) }],
        5: [{ chat: "Oh, where am I going now,", delay: turnIntoMS(0, 10) }, { chat: "just falling over trees?", delay: turnIntoMS(0, 11) }, { chat: "Now I'm just so far gone,", delay: turnIntoMS(0, 16) }, { chat: "this isn't what it seems", delay: turnIntoMS(0, 17) }, { chat: "Taking this so damn long,", delay: turnIntoMS(0, 21) }, { chat: "it's fading from believe", delay: turnIntoMS(0, 23) }, { chat: "I need to slow this down", delay: turnIntoMS(0, 27) }, { chat: "it's burning from beneath", delay: turnIntoMS(0, 28) }, { chat: "Come break this line", delay: turnIntoMS(0, 33) }, { chat: "Before tomorrow dies", delay: turnIntoMS(0, 35) }, { chat: "Holding on for", delay: turnIntoMS(0, 38) }, { chat: "what is worth my life", delay: turnIntoMS(0, 39) }, { chat: "I know it's time", delay: turnIntoMS(0, 43) }, { chat: "I'll make it all the way", delay: turnIntoMS(0, 46) }, { chat: "Find my way to", delay: turnIntoMS(0, 49) }, { chat: "giants in the sky", delay: turnIntoMS(0, 50) }, { chat: "Tonight it comes to life", delay: turnIntoMS(0, 53) }, { chat: "Tonight it comes to life", delay: turnIntoMS(1, 15) }, { chat: "Oh, where am I going now,", delay: turnIntoMS(1, 38) }, { chat: "just falling over trees?", delay: turnIntoMS(1, 40) }, { chat: "Now I'm just so far gone,", delay: turnIntoMS(1, 44) }, { chat: "this isn't what it seems", delay: turnIntoMS(1, 45) }, { chat: "Taking this so damn long,", delay: turnIntoMS(1, 49) }, { chat: "it's fading from believe", delay: turnIntoMS(1, 51) }, { chat: "I need to slow this down", delay: turnIntoMS(1, 55) }, { chat: "it's burning from beneath", delay: turnIntoMS(1, 56) }, { chat: "Come break this line", delay: turnIntoMS(2, 1) }, { chat: "Before tomorrow dies", delay: turnIntoMS(2, 4) }, { chat: "Holding on for", delay: turnIntoMS(2, 6) }, { chat: "what is worth my life", delay: turnIntoMS(2, 7) }, { chat: "I know it's time", delay: turnIntoMS(2, 12) }, { chat: "I'll make it all the way", delay: turnIntoMS(2, 15) }, { chat: "Find my way to", delay: turnIntoMS(2, 17) }, { chat: "giants in the sky", delay: turnIntoMS(2, 19) }, { chat: "Tonight it comes to life", delay: turnIntoMS(2, 22) }, { chat: "Tonight it comes to life", delay: turnIntoMS(2, 33) }, { chat: "Come break this line", delay: turnIntoMS(2, 56) }, { chat: "Before tomorrow dies", delay: turnIntoMS(2, 59) }, { chat: "Holding on for", delay: turnIntoMS(3, 2) }, { chat: "what is worth my life", delay: turnIntoMS(3, 3) }, { chat: "I know it's time", delay: turnIntoMS(3, 7) }, { chat: "I'll make it all the way", delay: turnIntoMS(3, 10) }, { chat: "Find my way to", delay: turnIntoMS(3, 13) }, { chat: "giants in the sky", delay: turnIntoMS(3, 14) }, { chat: "Tonight it comes to life", delay: turnIntoMS(3, 17) }],
        6: [{ chat: "Welcome to the wild", delay: turnIntoMS(0, 16) }, { chat: "no heroes and villains", delay: turnIntoMS(0, 17) }, { chat: "Welcome to the war", delay: turnIntoMS(0, 21) }, { chat: "we've only begun, so", delay: turnIntoMS(0, 23) }, { chat: "Pick up your weapon", delay: turnIntoMS(0, 26) }, { chat: "and face it", delay: turnIntoMS(0, 27) }, { chat: "There's blood on the crown;", delay: turnIntoMS(0, 29) }, { chat: "go and take it", delay: turnIntoMS(0, 30) }, { chat: "You get one shot to", delay: turnIntoMS(0, 32) }, { chat: "make it out alive, so", delay: turnIntoMS(0, 34) }, { chat: "Higher and higher you chase it", delay: turnIntoMS(0, 37) }, { chat: "It's deep in your bones;", delay: turnIntoMS(0, 40) }, { chat: "go and take it", delay: turnIntoMS(0, 41) }, { chat: "This is your moment,", delay: turnIntoMS(0, 43) }, { chat: "now is your time, so", delay: turnIntoMS(0, 45) }, { chat: "Prove yourself and", delay: turnIntoMS(0, 48) }, { chat: "RISE", delay: turnIntoMS(0, 50) }, { chat: "RISE!", delay: turnIntoMS(0, 51) }, { chat: "Make 'em remember you;", delay: turnIntoMS(0, 53) }, { chat: "RISE", delay: turnIntoMS(0, 56) }, { chat: "Push through hell and", delay: turnIntoMS(0, 59) }, { chat: "RISE", delay: turnIntoMS(1, 1) }, { chat: "RISE!", delay: turnIntoMS(1, 2) }, { chat: "They will remember you;", delay: turnIntoMS(1, 4) }, { chat: "RISE", delay: turnIntoMS(1, 6) }, { chat: "Welcome to the climb up,", delay: turnIntoMS(1, 10) }, { chat: "reach for the summit", delay: turnIntoMS(1, 12) }, { chat: "Visions pray that one false", delay: turnIntoMS(1, 15) }, { chat: "step lead the end, so", delay: turnIntoMS(1, 18) }, { chat: "Higher and higher you chase it", delay: turnIntoMS(1, 20) }, { chat: "It's deep in your blood;", delay: turnIntoMS(1, 23) }, { chat: "go and take it", delay: turnIntoMS(1, 24) }, { chat: "This is your moment,", delay: turnIntoMS(1, 26) }, { chat: "take to the skies, go", delay: turnIntoMS(1, 29) }, { chat: "Prove yourself and", delay: turnIntoMS(1, 32) }, { chat: "RISE", delay: turnIntoMS(1, 33) }, { chat: "RISE!", delay: turnIntoMS(1, 35) }, { chat: "Make 'em remember you;", delay: turnIntoMS(1, 37) }, { chat: "RISE", delay: turnIntoMS(1, 39) }, { chat: "Push through hell and", delay: turnIntoMS(1, 42) }, { chat: "RISE", delay: turnIntoMS(1, 44) }, { chat: "RISE!", delay: turnIntoMS(1, 46) }, { chat: "They will remember you;", delay: turnIntoMS(1, 48) }, { chat: "RISE", delay: turnIntoMS(1, 50) }, { chat: "And as you fight among", delay: turnIntoMS(2, 5) }, { chat: "the death beneath the dirt", delay: turnIntoMS(2, 6) }, { chat: "Well, do you know yet?", delay: turnIntoMS(2, 10) }, { chat: "Well, do you want it?", delay: turnIntoMS(2, 13) }, { chat: "And when the giants call to", delay: turnIntoMS(2, 15) }, { chat: "ask you what you're worth", delay: turnIntoMS(2, 17) }, { chat: "Do you know if?", delay: turnIntoMS(2, 21) }, { chat: "Win or die, you'll", delay: turnIntoMS(2, 24) }, { chat: "Prove yourself and", delay: turnIntoMS(2, 27) }, { chat: "RISE", delay: turnIntoMS(2, 29) }, { chat: "RISE!", delay: turnIntoMS(2, 30) }, { chat: "Make 'em remember you;", delay: turnIntoMS(2, 32) }, { chat: "RISE", delay: turnIntoMS(2, 35) }, { chat: "Push through hell and", delay: turnIntoMS(2, 38) }, { chat: "RISE", delay: turnIntoMS(2, 40) }, { chat: "RISE!", delay: turnIntoMS(2, 41) }, { chat: "They will remember you;", delay: turnIntoMS(2, 43) }, { chat: "RISE", delay: turnIntoMS(2, 45) }, { chat: "Prove yourself and", delay: turnIntoMS(2, 49) }, { chat: "RISE", delay: turnIntoMS(2, 51) }, { chat: "RISE!", delay: turnIntoMS(2, 52) }, { chat: "RISE!!", delay: turnIntoMS(2, 56) }, { chat: "RISE", delay: turnIntoMS(3, 1) }, { chat: "RISE!", delay: turnIntoMS(3, 4) }, { chat: "RISE!!", delay: turnIntoMS(3, 7) }, { chat: "RISE!", delay: turnIntoMS(3, 12) }, { chat: "RISE", delay: turnIntoMS(3, 4) }],
        7: [{ chat: "Get myself into the game", delay: 11300 }, { chat: "I'm a run it up anyway", delay: 13700 }, { chat: "I get with the violence", delay: 17e3 }, { chat: "I don't think you wanna try it", delay: 19500 }, { chat: "I'm too up", delay: 22200 }, { chat: "I feel invincible", delay: 23e3 }, { chat: "I don't know if", delay: 25900 }, { chat: "They get it though", delay: 26500 }, { chat: "I'm too up", delay: 28e3 }, { chat: "I feel invincible", delay: 28800 }, { chat: "Fuck what you said", delay: 31250 }, { chat: "I'm invincible", delay: 32e3 }, { chat: "Lookin for a break", delay: 34e3 }, { chat: "And now I think", delay: 35e3 }, { chat: "I finally caught one", delay: 35700 }, { chat: "We're talkin legendary status", delay: 37100 }, { chat: "When it's all done", delay: 38500 }, { chat: "I'm a star bitch", delay: 4e4 }, { chat: "If you ever saw one", delay: 41300 }, { chat: "Law and order over here", delay: 43e3 }, { chat: "And it's a tall one meet", delay: 44e3 }, { chat: "Me at the top", delay: 44900 }, { chat: "Its goin down", delay: 46500 }, { chat: "They tryna fit in my circle", delay: 47500 }, { chat: "I'm not around", delay: 49200 }, { chat: "I was down before", delay: 50400 }, { chat: "But not for the count", delay: 52e3 }, { chat: "Shit was real heavy", delay: 53200 }, { chat: "Now it's dollars not the pounds", delay: 54100 }, { chat: "Tell me what you smokin", delay: 56150 }, { chat: "If you think that I'm a joke", delay: 57e3 }, { chat: "Only delay I'm trippin is when", delay: 59e3 }, { chat: "I'm out on the road", delay: 60250 }, { chat: "Only droppin joints if", delay: 62e3 }, { chat: "That shit is fuckin dope", delay: 63e3 }, { chat: "Scary when you see me", delay: 64800 }, { chat: "Got them meming me like nope", delay: 65650 }, { chat: "Nope, Nope, Nope...", delay: 67250 }, { chat: "Hate to say it but", delay: 68750 }, { chat: "We're running out of delay", delay: 7e4 }, { chat: "I don't know bout you", delay: 71650 }, { chat: "But I'ma make the most of mine", delay: 72650 }, { chat: "Looking clean until a", delay: 74400 }, { chat: "Young'n in the dirt", delay: 75300 }, { chat: "Value through the roof", delay: 77e3 }, { chat: "Yeah yeah I know my worth", delay: 78e3 }, { chat: "Nato", delay: 79250 }, { chat: "Get myself into the game", delay: 79900 }, { chat: "I'm a run it up anyway", delay: 82250 }, { chat: "I get with the violence", delay: 85500 }, { chat: "I don't think you wanna try it", delay: 88e3 }, { chat: "I'm too up I feel invincible", delay: 90900 }, { chat: "I don't know if", delay: 94350 }, { chat: "They get it though", delay: 95100 }, { chat: "I'm too up I feel invincible", delay: 96750 }, { chat: "Fuck what you said", delay: 99850 }, { chat: "I'm invincible", delay: 100800 }, { chat: "If you wanna try to bring me", delay: 102500 }, { chat: "Down you gotta reach me", delay: 104e3 }, { chat: "I'm high up in the clouds", delay: 105500 }, { chat: "While you're just down there", delay: 106500 }, { chat: "In the seaweeds", delay: 107500 }, { chat: "I see these", delay: 108125 }, { chat: "Little rappers they all wanna", delay: 109e3 }, { chat: "Be me", delay: 109800 }, { chat: "But nobody wanna put the", delay: 110500 }, { chat: "Work in", delay: 111200 }, { chat: "Cause they think that", delay: 111800 }, { chat: "I got it easy but thats sleezy", delay: 112750 }, { chat: "My path to the top was hard", delay: 113850 }, { chat: "But nothing out there could", delay: 114900 }, { chat: "Make me stop every delay", delay: 115600 }, { chat: "I thought it went one way it", delay: 117e3 }, { chat: "Turned out that it did not", delay: 118e3 }, { chat: "Got so many obstacles", delay: 119300 }, { chat: "From my opps", delay: 120100 }, { chat: "So many praying", delay: 120850 }, { chat: "That i would drop", delay: 121750 }, { chat: "I had to go around the world", delay: 122500 }, { chat: "Just to get to the", delay: 123350 }, { chat: "End of my block", delay: 124e3 }, { chat: "I built my skin so tough", delay: 125e3 }, { chat: "Achieving all my desire", delay: 126600 }, { chat: "I could walk through hell", delay: 128e3 }, { chat: "Without getting burned", delay: 128850 }, { chat: "By the fire", delay: 130250 }, { chat: "Oh I admire", delay: 131e3 }, { chat: "Those that are deniers", delay: 132500 }, { chat: "Cause you messed around and", delay: 133800 }, { chat: "Turned me to a cold", delay: 134750 }, { chat: "Blooded fighter", delay: 135500 }, { chat: "I'm so up I feel Invincible", delay: 136700 }, { chat: "I hope my words", delay: 139800 }, { chat: "Feel like insults", delay: 140950 }, { chat: "I'm up right now", delay: 142250 }, { chat: "You stuck right now", delay: 143750 }, { chat: "Stay down there on the ground", delay: 145150 }, { chat: "Get myself into the game", delay: 148300 }, { chat: "I'm a run it up anyway", delay: 150850 }, { chat: "I get with the violence", delay: 154100 }, { chat: "I don't think you wanna try it", delay: 156800 }, { chat: "I'm too up I feel invincible", delay: 159500 }, { chat: "I don't know if", delay: 163e3 }, { chat: "They get it though", delay: 163750 }, { chat: "I'm too up I feel invincible", delay: 165150 }, { chat: "Fuck what you said", delay: 168250 }, { chat: "I'm invincible", delay: 169250 }, { chat: "Talk like I'm at the top now", delay: 171300 }, { chat: "If you hit me I cant fall down", delay: 173750 }, { chat: "Run up I'm not 2nd place and", delay: 177e3 }, { chat: "I tell 'em that I'm running", delay: 179500 }, { chat: "All my bases", delay: 180600 }, { chat: "I'm too up I feel invincible", delay: 182500 }, { chat: "I don't know if", delay: 185850 }, { chat: "They get it though", delay: 186650 }, { chat: "I'm too up I feel invincible", delay: 188e3 }, { chat: "Fuck what you said", delay: 191150 }, { chat: "I'm invincible", delay: 192250 }],
        8: [{ chat: "This ain't where the", delay: 9e3 }, { chat: "Legends come from", delay: 9750 }, { chat: "You're not what a", delay: 12250 }, { chat: "Hero looks like", delay: 13e3 }, { chat: "Pretty little flower won't you", delay: 15500 }, { chat: "Sit back down and go play nice", delay: 18e3 }, { chat: "Keep talking, keep laughing", delay: 21500 }, { chat: "One day you'll wish you hadn't", delay: 25e3 }, { chat: "All the people want Fire, Fire", delay: 28500 }, { chat: "Maybe it's delay they", delay: 31250 }, { chat: "Meet their dragon", delay: 33e3 }, { chat: "If you're gonna hold me down", delay: 35500 }, { chat: "And you're not gonna let me in", delay: 38750 }, { chat: "Into your castle walls", delay: 41500 }, { chat: "None of you can keep them", delay: 44300 }, { chat: "Cause if I gotta", delay: 46850 }, { chat: "Bu bu burn it all down", delay: 48e3 }, { chat: "Then we'll burn it all down", delay: 52e3 }, { chat: "My oh my,", delay: 55250 }, { chat: "Look at who ends up", delay: 57e3 }, { chat: "Bigger this delay", delay: 58500 }, { chat: "And if I gotta", delay: 6e4 }, { chat: "Bu bu break it all down", delay: 61250 }, { chat: "Then let's break it all down", delay: 65e3 }, { chat: "Bye bye bye-", delay: 68500 }, { chat: "Playing with fire", delay: 7e4 }, { chat: "And we burn it all down", delay: 71850 }, { chat: "This is where the", delay: 78500 }, { chat: "Bruises come from", delay: 79250 }, { chat: "This is when the", delay: 81800 }, { chat: "Game gets ugly", delay: 82500 }, { chat: "These blood, sweat,", delay: 84500 }, { chat: "Tears keep running", delay: 86e3 }, { chat: "Licking my plate'", delay: 87750 }, { chat: "Cause I'm so hungry", delay: 88750 }, { chat: "Keep talking, keep laughing", delay: 91111 }, { chat: "One day you'll see what happen", delay: 94500 }, { chat: "All the people want Fire, Fire", delay: 98e3 }, { chat: "It's about delay they", delay: 100900 }, { chat: "Meet their dragon", delay: 102100 }, { chat: "If you're gonna hold me down", delay: 105e3 }, { chat: "And you're not gonna let me in", delay: 108e3 }, { chat: "Into your castle walls", delay: 111e3 }, { chat: "None of you can keep them", delay: 114e3 }, { chat: "Cause if I gotta", delay: 116250 }, { chat: "Bu bu burn it all down", delay: 117750 }, { chat: "Then we'll burn it all down", delay: 121500 }, { chat: "My oh my,", delay: 125e3 }, { chat: "Look at who ends up", delay: 126500 }, { chat: "Bigger this delay", delay: 128e3 }, { chat: "And if I gotta", delay: 129500 }, { chat: "Bu bu break it all down", delay: 131e3 }, { chat: "Then let's break it all down", delay: 134850 }, { chat: "Bye bye bye-", delay: 138e3 }, { chat: "Playing with fire", delay: 139750 }, { chat: "And we burn it all down", delay: 141500 }, { chat: "It starts right now", delay: 144750 }, { chat: "Baby you're surrounded", delay: 148800 }, { chat: "Put your money where", delay: 151800 }, { chat: "Your mouth is", delay: 153e3 }, { chat: "Bury your doubts", delay: 155500 }, { chat: "Under the ground", delay: 158e3 }, { chat: "And they gonna watch you", delay: 162e3 }, { chat: "Step over the ashes", delay: 164e3 }, { chat: "Right now i'm taking my turn", delay: 166500 }, { chat: "With the matches", delay: 169e3 }, { chat: "Cause if I gotta", delay: 172750 }, { chat: "Bu bu burn it all down", delay: 174e3 }, { chat: "Then we'll burn it all down", delay: 177750 }, { chat: "My oh my,", delay: 181e3 }, { chat: "Look at who ends up", delay: 182800 }, { chat: "Bigger this delay", delay: 184500 }, { chat: "And if I gotta", delay: 186e3 }, { chat: "Bu bu break it all down", delay: 187e3 }, { chat: "Then let's break it all down", delay: 191e3 }, { chat: "Bye bye bye-", delay: 194500 }, { chat: "Playing with fire", delay: 196e3 }, { chat: "And we burn it all down", delay: 197750 }],
        9: [{ chat: "See your body", delay: 39750 }, { chat: "Into the moonlight", delay: 41300 }, { chat: "Even if I try to cancel", delay: 42850 }, { chat: "All the pictures", delay: 46e3 }, { chat: "Into the mind", delay: 47600 }, { chat: "There's a flashing in my eyes", delay: 48450 }, { chat: "Don't you see my condition", delay: 51250 }, { chat: "The fiction", delay: 54e3 }, { chat: "Is gonna run it again", delay: 55650 }, { chat: "Can't you see now illusions", delay: 57425 }, { chat: "Right into your mind", delay: 60400 }, { chat: "Deja vu", delay: 64200 }, { chat: "I've just been", delay: 65e3 }, { chat: "In this place before", delay: 65850 }, { chat: "Higher on the street", delay: 67e3 }, { chat: "And I know it's my time to go", delay: 68050 }, { chat: "Calling you", delay: 70300 }, { chat: "And the search is a mystery", delay: 71150 }, { chat: "Standing on my feet", delay: 73100 }, { chat: "It's so hard when", delay: 74150 }, { chat: "I try to be me", delay: 75300 }, { chat: "Uoooh!", delay: 77e3 }, { chat: "Deja vu", delay: 78e3 }, { chat: "I've just been", delay: 79e3 }, { chat: "In this time before", delay: 79850 }, { chat: "Higher on the beat", delay: 81e3 }, { chat: "And I know It's a place to go", delay: 82150 }, { chat: "Calling you", delay: 84500 }, { chat: "And the search is a mystery", delay: 85350 }, { chat: "Standing on my feet", delay: 87250 }, { chat: "It's so hard when", delay: 88500 }, { chat: "I try to be me", delay: 89450 }, { chat: "Yeah!", delay: 91e3 }, { chat: "See the future", delay: 105100 }, { chat: "Into the present", delay: 106750 }, { chat: "See my past lives", delay: 108250 }, { chat: "In the distance", delay: 11e4 }, { chat: "Try to guess now", delay: 111350 }, { chat: "What's going on", delay: 113e3 }, { chat: "And the band begins to play...", delay: 114e3 }, { chat: "Don't you see my condition", delay: 116750 }, { chat: "The fiction", delay: 119650 }, { chat: "Is gonna run it again", delay: 121e3 }, { chat: "Can't you see now illusions", delay: 123e3 }, { chat: "Right into your mind", delay: 125600 }, { chat: "Deja vu", delay: 129700 }, { chat: "I've just been", delay: 130500 }, { chat: "In this place before", delay: 131250 }, { chat: "Higher on the street", delay: 132500 }, { chat: "And I know it's my time to go", delay: 133600 }, { chat: "Calling you", delay: 135650 }, { chat: "And the search is a mystery", delay: 136800 }, { chat: "Standing on my feet", delay: 138600 }, { chat: "It's so hard when", delay: 14e4 }, { chat: "I try to be me", delay: 141e3 }, { chat: "Uoooh!", delay: 142350 }, { chat: "Deja vu", delay: 143500 }, { chat: "I've just been", delay: 144400 }, { chat: "In this time before", delay: 145150 }, { chat: "Higher on the beat", delay: 146500 }, { chat: "And I know it's a place to go", delay: 147500 }, { chat: "Calling you", delay: 149800 }, { chat: "And the search is a mystery", delay: 150750 }, { chat: "Standing on my feet", delay: 152750 }, { chat: "It's so hard when", delay: 153850 }, { chat: "I try to be me", delay: 154850 }, { chat: "Yeah!", delay: 156500 }, { chat: "See your body", delay: 170600 }, { chat: "Into the moonlight", delay: 172250 }, { chat: "Even if I try to cancel", delay: 173750 }, { chat: "All the pictures", delay: 177e3 }, { chat: "Into the mind", delay: 178500 }, { chat: "There's a flashing in my eyes", delay: 179300 }, { chat: "Don't you see my condition", delay: 182100 }, { chat: "The fiction", delay: 185e3 }, { chat: "Is gonna run it again", delay: 186500 }, { chat: "Can't you see now illusions", delay: 188350 }, { chat: "Right into your mind", delay: 191250 }, { chat: "Deja vu", delay: 195e3 }, { chat: "I've just been", delay: 196e3 }, { chat: "In this place before", delay: 196750 }, { chat: "Higher on the street", delay: 198e3 }, { chat: "And I know it's my time to go", delay: 199e3 }, { chat: "Calling you", delay: 201100 }, { chat: "And the search is a mystery", delay: 202250 }, { chat: "Standing on my feet", delay: 204e3 }, { chat: "It's so hard when", delay: 205300 }, { chat: "I try to be me", delay: 206200 }, { chat: "Uoooh!", delay: 208e3 }, { chat: "Deva vu", delay: 209e3 }, { chat: "I've just been", delay: 21e4 }, { chat: "In this time before", delay: 210650 }, { chat: "Higher on the beat", delay: 211950 }, { chat: "And I know It's a place to go", delay: 213e3 }, { chat: "Calling you", delay: 215300 }, { chat: "And the search is a mystery", delay: 216250 }, { chat: "Standing on my feet", delay: 218e3 }, { chat: "It's so hard when", delay: 219150 }, { chat: "I try to be me", delay: 220150 }, { chat: "Yeah!", delay: 222e3 }],
        10: [{ chat: "Left me alone in the darkness", delay: 14500 }, { chat: "Leave me okay", delay: 17e3 }, { chat: "Holding you show now", delay: 2e4 }, { chat: "You're heartless", delay: 21e3 }, { chat: "Left me alone in the darkness", delay: 36500 }, { chat: "Leave me okay", delay: 39250 }, { chat: "Left me alone in the darkness", delay: 42250 }, { chat: "Leave me okay", delay: 45e3 }, { chat: "Holding you show now", delay: 64500 }, { chat: "You're heartless", delay: 65250 }, { chat: "Left me alone in the darkness", delay: 67250 }, { chat: "Leave me okay", delay: 84e3 }, { chat: "Leave me okay", delay: 89500 }, { chat: "Left me alone in the darkness", delay: 103250 }, { chat: "Leave me okay", delay: 106250 }, { chat: "Holding you show now", delay: 109e3 }, { chat: "You're heartless", delay: 11e4 }, { chat: "BASSLINE GONNA MAKE MY SHOTS", delay: 113e3 }, { chat: "Holding you show now", delay: 131500 }, { chat: "You're heartless", delay: 132500 }, { chat: "Left me alone in the darkness", delay: 137e3 }, { chat: "Leave me okay", delay: 144e3 }, { chat: "Left me alone in the darkness", delay: 148e3 }, { chat: "Leave me okay", delay: 155e3 }],
        11: [{ chat: "Children used to run and play", delay: 15725 }, { chat: "Look at all this mess we made", delay: 18600 }, { chat: "Guess i never know", delay: 21500 }, { chat: "It went wrong", delay: 23e3 }, { chat: "Sometimes i feel like all", delay: 27500 }, { chat: "That's said", delay: 28500 }, { chat: "Goes viral then people forget", delay: 30500 }, { chat: "In this crazy world", delay: 33500 }, { chat: "I don't belong", delay: 34800 }, { chat: "I see fire burning", delay: 39e3 }, { chat: "But i close my eyes", delay: 41e3 }, { chat: "(I'd rather deny that)", delay: 43300 }, { chat: "Everything is falling", delay: 45e3 }, { chat: "Out of place", delay: 46700 }, { chat: "I see trees ripped", delay: 5e4 }, { chat: "From the ground but", delay: 52200 }, { chat: "Nobody makes a sound", delay: 54050 }, { chat: "I see fire burning", delay: 57e3 }, { chat: "But i'm fine", delay: 59e3 }, { chat: "Now i am nobody", delay: 61e3 }, { chat: "Now i am nobody", delay: 73e3 }, { chat: "The future feels so unsure", delay: 99500 }, { chat: "Didin't we deserve more", delay: 102600 }, { chat: "The burden that you left", delay: 105500 }, { chat: "Is too heavy for me", delay: 106900 }, { chat: "Do you ever feel like", delay: 111300 }, { chat: "The world will die out", delay: 113e3 }, { chat: "My anxiety's off", delay: 114400 }, { chat: "The roof i cry out", delay: 115800 }, { chat: "We have gone too far", delay: 117400 }, { chat: "Take me back right now", delay: 118800 }, { chat: "I see fire burning", delay: 123e3 }, { chat: "But i close my eyes", delay: 125e3 }, { chat: "(I'd rather deny that)", delay: 127300 }, { chat: "Everything is falling", delay: 129e3 }, { chat: "Out of place", delay: 131e3 }, { chat: "I see trees ripped", delay: 134e3 }, { chat: "From the ground but", delay: 135500 }, { chat: "Nobody makes a sound", delay: 138e3 }, { chat: "I see fire burning", delay: 141e3 }, { chat: "But i'm fine", delay: 143e3 }, { chat: "Now i am nobody", delay: 145e3 }, { chat: "Now i am nobody", delay: 169e3 }],
    };
    var syncChat = {
        index: -1,
        chatIndex: -1,
        type: -1,
        timer: 0
    };
    function doSpamChatStuff() {
        spamchat = !spamchat;
        if (spamchat == true) {
            let type = parseInt(document.getElementById("chatType").value);
            syncChat.index = 0;
            syncChat.chatIndex = type;
            syncChat.timer = 0;
            audios[type].currentTime = 0;
            audios[type].play();
        } else {
            syncChat.index = -1;
            syncChat.timer = 0;
            for (let i = 0; i < audios.length; i++) {
                audios[i].pause();
                audios[i].currentTime = 0;
            }
        }
    }
    var SHIFTHOLD = false;
    var keyPressed = new Array(100).fill(0);
    var stoppedBots = false;
    function keyDown(event) {
        var keyNum = event.which || event.keyCode || 0;
        keyPressed[keyNum] = 1;
        if (player && "chatbox" !== document.activeElement.id.toLowerCase() && "botchatbox" !== document.activeElement.id.toLowerCase()) {
            placer.macro();
        }
        if (player && "chatbox" !== document.activeElement.id.toLowerCase() && "botchatbox" !== document.activeElement.id.toLowerCase()) {
            if (keyNum == 219) {
                let botMode = document.getElementById("botMode");
                let currentIndex = botMode.selectedIndex;
                let newIndex = (currentIndex + 1) % botMode.options.length;
                botMode.selectedIndex = newIndex;
                textManager.showText(player.x, player.y, 35, 0.18, 1500, `bot module set to: ${botMode.options[botMode.selectedIndex].innerText}`, "#fff");
                document.getElementById("setBotModule").click();
            } else if (keyNum == 221) {
                let movementType = document.getElementById("movementType");
                let currentIndex = movementType.selectedIndex;
                let newIndex = (currentIndex + 1) % movementType.options.length;
                movementType.selectedIndex = newIndex;
                textManager.showText(player.x, player.y, 35, 0.18, 1500, `bot movement type set to: ${movementType.options[movementType.selectedIndex].innerText}`, "#fff");
                document.getElementById("updateBot").click();
            } else if (keyNum == 191) {
                freeCam.status = !freeCam.status;
                if (freeCam.status) {
                    freeCam.x = player.x;
                    freeCam.y = player.y;
                }
                textManager.showText(player.x, player.y, 35, 0.18, 1500, `freecam: ${freeCam.status}`, "#fff");
            } else if (keyNum == 220) {
                stoppedBots = !stoppedBots;
                if (stoppedBots) {
                    textManager.showText(player.x, player.y, 35, 0.18, 1500, `bots can't move`, "#fff");
                } else {
                    textManager.showText(player.x, player.y, 35, 0.18, 1500, `bots can move`, "#fff");
                }
                for (let i = 0; i < bots.length; i++) {
                    if (bots[i].socket && bots[i].socket.readyState == 1 && !bots[i].CLOSED) {
                        bots[i].socket.send(JSON.stringify({
                            type: "stop",
                            data: stoppedBots
                        }));
                    }
                }
            } else if (event.key == "C") {
                doSpamChatStuff();
            } else if (event.key == "=") {
                maxScreenWidth = config.maxScreenWidth;
                maxScreenHeight = config.maxScreenHeight;
                resize();
                updateCursorLocation();
            } else if (event.key == "z") {
                autoMills = !autoMills;
            } else if (event.keyCode == 16) {
                SHIFTHOLD = true;
            } else if (event.key == "Z") {
                keyPressed.forEach(e => {
                    e = 0;
                });
                gameObjectSprites = {};
                oneTickBowInsta = false;
                moveTicking = false;
                itemSprites = {};
                waitTicks = [];
                queueTick = [];
                tick = 0;
                player.primary.reload = 0;
                player.secondary.reload = -0.074;
                attackLoop.change(false);
                autoPrimary.change(false);
                autoSecondary.change(false);
                moveTicking = false;
                onlyEMP = false;
                rangedSoldier = false;
                onlySoldier = false;
                otSoldier = false;
                spikeSoldier = false;
                autoaim = false;
                attackState = 0;
                hitting = false;
            } else if (event.keyCode == 190 && player.team) {
                if (autoaim == false && enemies.closest) {
                    io.send("S", 1);
                } else if (document.getElementById("targetType").value == "bot") {
                    io.send("S", 1);
                }
            } else if (event.key == "t") {
                moveTicking = "normal";
            } else if (keyNum == 27) {
                if (scriptMenu.style.display == "block") {
                    scriptMenu.style.display = "none";
                    document.getElementById("topInfoHolder").style.display = "block";
                    storeButton.style.left = "270px";
                    allianceButton.style.left = "330px";
                    itemInfoHolder.style.left = "270px";
                } else {
                    scriptMenu.style.display = "block";
                    document.getElementById("topInfoHolder").style.display = "none";
                    storeButton.style.left = (scriptMenu.clientWidth + 30 + (tabDimensions[scriptTabIndex][2] ? 10 : 0)) + "px";
                    allianceButton.style.left = (scriptMenu.clientWidth + 90 + (tabDimensions[scriptTabIndex][2] ? 10 : 0)) + "px";
                    itemInfoHolder.style.left = (scriptMenu.clientWidth + 30 + (tabDimensions[scriptTabIndex][2] ? 10 : 0)) + "px";
                }
                hideAllWindows();
            } else if (keysActive()) {
                if (!keys[keyNum]) {
                    keys[keyNum] = 1;
                    if (keyNum == 69) {
                        sendAutoGather();
                    } else if (keyNum == 67) {
                        if (!mapMarker) mapMarker = {};
                        mapMarker.x = player.x;
                        mapMarker.y = player.y;
                    } else if (player.weapons[keyNum - 49] != undefined) {
                        selectToBuild(player.weapons[keyNum - 49], true);
                    } else if (player.items[keyNum - 49 - player.weapons.length] != undefined) {
                        selectToBuild(player.items[keyNum - 49 - player.weapons.length]);
                    } else if (keyNum == 82) {
                        sendMapPing();
                    } else if (moveKeys[keyNum]) {
                        sendMoveDir();
                    } else if (keyNum == 32) {
                        attackState = 1;
                    }
                }
            }
        }
    }
    window.addEventListener('keydown', UTILS.checkTrusted(keyDown));
    function keyUp(event) {
        if (player && player.alive) {
            var keyNum = event.which || event.keyCode || 0;
            keyPressed[keyNum] = 0;
            if (keyNum == 16) SHIFTHOLD = false;
            if (keyNum == 13) {
                toggleChat();
            } else if (document.activeElement.id.toLowerCase() == "chatbox") {
                filterCommands();
            } else if (event.key == "T" && "chatbox" !== document.activeElement.id.toLowerCase()) {
                oneTickBowInsta = !oneTickBowInsta;
            } else if (event.key == "t" && "chatbox" !== document.activeElement.id.toLowerCase()) {
                moveTicking = false;
            } else if (keysActive()) {
                if (keys[keyNum]) {
                    keys[keyNum] = 0;
                    if (moveKeys[keyNum]) {
                        sendMoveDir();
                    } else if (keyNum == 32) {
                        attackState = 0;
                    } else if (keyNum == 84) {
                        moveTicking = false;
                    }
                }
            }
        }
    }
    window.addEventListener('keyup', UTILS.checkTrusted(keyUp));
    var lastMoveDir = undefined;
    var oneticking = false;
    var isPushing = false;
    function getMoveDir() {
        var dx = 0;
        var dy = 0;
        if (controllingTouch.id != -1) {
            dx += controllingTouch.currentX - controllingTouch.startX;
            dy += controllingTouch.currentY - controllingTouch.startY;
        } else {
            for (var key in moveKeys) {
                var tmpDir = moveKeys[key];
                dx += !!keys[key] * tmpDir[0];
                dy += !!keys[key] * tmpDir[1];
            }
        }
        return (dx == 0 && dy == 0) ? undefined : UTILS.fixTo(Math.atan2(dy, dx), 2);
    }
    var trackerMoveDir = null;
    function smartMovement(preferedDir = "LMAOOOO") {
        if (oneticking) {
            if (trackerMoveDir != enemies.angle) {
                trackerMoveDir = enemies.angle;
                io.send("a", enemies.angle);
            }
        } else if (player.trap) {
            isPushing = false;
            if (!trackerMoveDir) io.send("a", null);
            trackerMoveDir = null;
        } else if (preferedDir != "LMAOOOO") {
            if (trackerMoveDir != preferedDir) {
                trackerMoveDir = preferedDir;
                io.send("a", preferedDir);
            }
        } else {
            if (trackerMoveDir != lastMoveDir && !freeCam.status) {
                trackerMoveDir = lastMoveDir;
                io.send("a", lastMoveDir);
            }
        }
    }
    function sendMoveDir() {
        if (document.activeElement.id.toLowerCase() == "chatbox") return;
        var newMoveDir = getMoveDir();
        if ((lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3)) {
            lastMoveDir = newMoveDir;
            for (let i = 0; i < bots.length; i++) {
                if (bots[i].socket && bots[i].socket.readyState == 1 && !bots[i].CLOSED) {
                    bots[i].socket.send(JSON.stringify({
                        type: "setMoveDir",
                        data: lastMoveDir
                    }));
                }
            }
        }
    }
    var toggles = {};
    window.toggles = toggles;
    function generateNewToggle(label, id, isChecked, style) {
        toggles[id] = function () {
            return document.getElementById(id).checked;
        };
        return `
        ${label} <input type="checkbox" style="cursor: pointer;${style ? " " + style : ""}" id="${id}" ${isChecked}>
        `;
    }
    function generateNewList(label, id, configs, selected = 0) {
        let content = `${label} <select id="${id}">`;
        for (let i = 0; i < configs.length; i++) {
            content += `<option value="${configs[i][0]}" ${selected == i ? "selected" : ""}>${configs[i][1]}</option>`;
        }
        content += `</select>`;
        return content;
    }
    function setConfig(elements, id) {
        for (let i = 0; i < elements.length; i++) {
            document.getElementById(elements[i][3]).style.display = id == elements[i][0] ? "inline-block" : "none";
        }
    }
    function addEventListen(id, configs) {
        let interval = setInterval(() => {
            if (document.getElementById(id) != null) {
                document.getElementById(id).addEventListener("change", function () {
                    setConfig(configs, document.getElementById(id).value);
                });
                clearInterval(interval);
            }
        }, 0);
    }
    function generateNewConfig(label, id, configs) {
        let content = `${label} <select id="${id}">`;
        for (let i = 0; i < configs.length; i++) {
            content += `<option value="${configs[i][0]}">${configs[i][1]}</option>`;
        }
        content += `</select>`;
        for (let i = 0; i < configs.length; i++) {
            content += generateNewToggle("", configs[i][3], configs[i][2], !i ? "display: inline-block;" : "display: none;");
        }
        addEventListen(id, configs);
        return content;
    }
    document.getElementById("promoImgHolder").style.display = "none";
    var menuTabs = -1;
    function generateNewTab(content, isOn) {
        menuTabs++;
        return `
        <div id="scriptMenuTab${menuTabs}" style="display: ${isOn ? "block" : "none"};">
        ${content}
        </div>
        `;
    }
    var scriptMenu = document.createElement("div");
    scriptMenu.id = "scriptMenu";
    scriptMenu.style = `
    position: absolute;
    top: 20px;
    left: 20px;
    background-color: rgb(0, 0, 0, 0.25);
    color: #fff;
    border-radius: 4px;
    width: 350px;
    height: 225px;
    max-height: 225px;
    z-index: 2;
    display: block;
    `;
    var scriptTabIndex = 0;
    /*<input id="botAmount" type="number" max="40" style="width: 50px;" value="4"> ${generateNewList("", "botAmountType1", [
        [0, "Add"],
        [1, "Disconnect"],
    ])} */
    scriptMenu.innerHTML = `
    <style>
    ::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 10px;
    }
    ::-webkit-scrollbar-thumb {
    background-color: rgba(0,0,0,.5);
    -webkit-box-shadow: 0 0 1px rgba(255,255,255,.5);
    }
    </style>
    <div id="prevTabM" style="position: absolute; top: 10px; right: 40px; cursor: pointer; text-align: center; width: 25px; height: 25px; background-color: rgb(0, 0, 0, .25); border-radius: 4px;">
    <span class="material-icons" style="color: #fff; font-size: 25px;">
    navigate_before
    </span>
    </div>
    <div id="nextTabM" style="position: absolute; top: 10px; right: 10px; cursor: pointer; text-align: center; width: 25px; height: 25px; background-color: rgb(0, 0, 0, .25); border-radius: 4px;">
    <span class="material-icons" style="color: #fff; font-size: 25px;">
    navigate_next
    </span>
    </div>

    <div id="scriptMenuHeader0" style="position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Home: </div>
    </div>
    <div id="scriptMenuHeader1" style="display: none; position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Combat: </div>
    </div>
    <div id="scriptMenuHeader2" style="display: none; position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Visual: </div>
    </div>
    <div id="scriptMenuHeader3" style="display: none; position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Defense: </div>
    </div>
    <div id="scriptMenuHeader4" style="display: none; position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Bots: </div>
    </div>
    <div id="scriptMenuHeader5" style="display: none; position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Misc: </div>
    </div>
    <div id="scriptMenuHeader6" style="display: none; position: absolute; pointer-events: none; top: 0px; left: 0px; height: 40px;">
    <div style="margin-top: 10px; margin-left: 10px; font-size: 20px;">Notes/Controls: </div>
    </div>

    <div style="position: absolute; top: 40px; text-align: left; margin-left: 10px;">
    ${generateNewTab(`
    <button id="toggleUIButton" style="cursor: pointer;">Toggle UI</button><br>
    <button id="autoplaceToggle" style="cursor: pointer;">Toggle placeEveryTick</button> <div id="autoplaceDisplay" style="display: inline-block;">| false</div><br>
    ${generateNewToggle("", "placeEveryTick", "", "display: none;")}<br>
    <div id="weaponXP">
    Pri XP: 0/3000<br>
    Sec XP: 0/3000
    </div>
    `, true)}
    ${generateNewTab(`
    ${generateNewToggle("autoSyncHit: ", "autohit", "checked")}<br>
    ${generateNewConfig("Config: ", "config1", [
        [0, "antiBull", "checked", "antibull"],
        [1, "autoOneTick", "checked", "autoOneTick"],
        [2, "autoPush", "checked", "autopush"],
        [3, "autoBullSpam", "", "autobullspam"],
        [4, "mapPingSync", "", "teamsync"],
        [5, "autoTankHit", "checked", "autoTankHit"],
        [6, "reverseSpikeTick", "checked", "reverseSpikeTick"]
    ])}<br>
    ${generateNewList("Insta On: ", "instaOnValue", [
        [1, "1"],
        [2, "2"],
        [3, "3"],
        [4, "4"],
        [5, "5"],
        [6, "6"],
        [7, "7"],
    ], 4)} ${generateNewToggle("", "instaOnToggle", "checked")}
    `)}
    ${generateNewTab(`
    ${generateNewConfig("Config: ", "config2", [
        [0, "showTexturePack", "checked", "texturepack"],
        [1, "showRealDir", "", "realdir"],
        [2, "buildingHealth", "checked", "buildingHealth"],
        [3, "treeFade", "checked", "maxPerformance"],
        [4, "infiniteRange", "checked", "infiniteRange"],
        [5, "swordTexture", "", "katanaTexture"]
    ])}
    `)}
    ${generateNewTab(`
    ${generateNewConfig("Config: ", "config3", [
        [0, "autoBreak", "checked", "autobreak"],
        [1, "autoReplace", "checked", "autoreplace"],
        [2, "autoEMP", "checked", "autoemp"],
        [3, "antiTrap", "checked", "antitrap"],
        [4, "autoReload", "checked", "autoreload"],
        [5, "autoBuy", "checked", "autobuy"],
        [6, "noDirAim", "checked", "mouseless"],
        [7, "sensitiveAnti", "checked", "antigocry"]
    ])}
    `)}
    ${generateNewTab(`
    <button id="openControlPanel" style="cursor: pointer;">Open Control Panel</button><br>
    ${generateNewList("", "botMode", [
        ["musket", "Musket Sync"],
        ["bowspam", "Bow Spam"],
        ["breaker", "Object Breaker (Owner)"],
        ["all breaker", "Object Breaker (All)"]
    ])} <button id="setBotModule" style="cursor: pointer;">Set Module</button><br>
    Breaker Range: <input id="breakerRange" type="number" style="width: 50px;" value="900"><br>
    Player Dist: <input id="playerDist" type="number" style="width: 50px;" value="150"><br>
    ${generateNewToggle("placeEveryTick (when in playerdist*2): ", "botTickPlace", "")}<br>
    ${generateNewToggle("isNormalServer: ", "isNormalServer", "")}<br>
    ${generateNewList("Target Mode: ", "targetType", [
        ["player", "Nearest to player"],
        ["bot", "Nearest to bot"]
    ])}<br>
    Bot Chat: <input id="botChatBox" type="text" style="width: 150px;"> <button id="sendTheBotChats" style="cursor: pointer;">Chat</button><br>
    ${generateNewList("Movement Module: ", "movementType", [
        ["normal", "Normal"],
        ["circle", "Circle"],
        ["invis", "Invis"],
        ["mouse", "Mouse"]
    ])} <button id="updateBot" style="cursor: pointer;">Update Bots</button><br>
    <p></p>
    `)}
    ${generateNewTab(`
    ${generateNewToggle("rubyFarm: ", "autogrind", "")}<br>
    ${generateNewToggle("autoGGChat: ", "killChat", "")}<br>
    ${generateNewToggle("autoUpgrade: ", "autoupgrade", "checked")}<br>
    ${generateNewList("7th Slot: ", "7thSlot", [
        [38, "Teleporter"],
        [33, "Turret"],
        [35, "Healing Pad"],
        [37, "Blocker"],
        [34, "Platform"]
    ])}<br><br>
    ${generateNewToggle("loopSongs: ", "loopsongs", "")}<br>
    ${generateNewList("Chat Type: ", "chatType", [
        [0, "Taking Over - LOL"],
        [1, "Don't Stand So Close - Initial D"],
        [2, "Warriors - Imagine Dragons"],
        [3, "The Top - Initial D"],
        [4, "Adrenaline - Ace"],
        [5, "Giants - VOE"],
        [6, "Rise - LOL"],
        [7, "Invincible - Crypt x Joey Nato"],
        [8, "Burn It All Down - LOL"],
        [9, "Deja Vu - Initial D"],
        [10, "Heartless - Domastic"],
        [11, "Nobody - CRVN"]
    ])} ${generateNewToggle("", "onlyMusic", "")}
    `)}
    ${generateNewTab(`
    If autopush is being dumb, hold "SHIFT" to override.<br>
    If the script gets stuck, press "Z" to debug.<br>
    If autobreak is being dumb, hold "SHIFT".<br><br>
    <strong>Bot Documentation:</strong><br>
    Use "[" key to quick switch modules.<br>
    Use "]" key to quick swtich movement modes.<br>
    Use "/" key to turn on/off freecam<br>
    Use "\\" key to toggle bot movement
    <p></p>
    `)}
    </div>
    `;
    document.body.appendChild(scriptMenu);
    var tabDimensions = [[187, 87], [165, 64], [185, 22], [158, 22], [280, 122, true], [287, 132], [220, 104, true]];
    for (let i = 0; i < tabDimensions.length; i++) {
        tabDimensions[i][0] += 30;
        tabDimensions[i][0] = Math.max(tabDimensions[i][0], 200);
        tabDimensions[i][1] += 50;
    }
    function changeTabs(amount) {
        scriptMenu.style.width = "350px";
        scriptMenu.style.height = "225px";
        scriptMenu.style.maxHeight = "225px";
        scriptTabIndex += amount;
        if (scriptTabIndex < 0) {
            scriptTabIndex = menuTabs;
        } else if (scriptTabIndex > menuTabs) {
            scriptTabIndex = 0;
        }
        for (let i = 0; i <= menuTabs; i++) {
            document.getElementById(`scriptMenuHeader${i}`).style.display = i == scriptTabIndex ? "block" : "none";
            document.getElementById(`scriptMenuTab${i}`).style.display = i == scriptTabIndex ? "block" : "none";
        }
        if (tabDimensions[scriptTabIndex][2]) {
            scriptMenu.style.overflowY = "scroll";
        } else {
            scriptMenu.style.overflowY = "hidden";
        }
        scriptMenu.style.width = tabDimensions[scriptTabIndex][0] + "px";
        scriptMenu.style.height = tabDimensions[scriptTabIndex][1] + "px";
        storeButton.style.left = (scriptMenu.clientWidth + 30 + (tabDimensions[scriptTabIndex][2] ? 10 : 0)) + "px";
        allianceButton.style.left = (scriptMenu.clientWidth + 90 + (tabDimensions[scriptTabIndex][2] ? 10 : 0)) + "px";
        itemInfoHolder.style.left = (scriptMenu.clientWidth + 30 + (tabDimensions[scriptTabIndex][2] ? 10 : 0)) + "px";
    }
    changeTabs(0);
    document.getElementById("sendTheBotChats").onclick = function () {
        let chatBox = document.getElementById("botChatBox");
        bots.forEach(e => {
            if (e.socket && e.socket.readyState == 1 && !e.CLOSED) {
                e.socket.send(JSON.stringify({
                    type: "ch",
                    chat: chatBox.value.slice(0, 30)
                }));
            }
        });
        chatBox.value = "";
        this.blur();
    }
    document.getElementById("prevTabM").onclick = function () {
        changeTabs(-1);
        this.blur();
    }
    document.getElementById("nextTabM").onclick = function () {
        changeTabs(1);
        this.blur();
    }
    var autogrind = document.getElementById("autogrind");
    autogrind.addEventListener("change", () => {
        if (autogrind.checked) {
            for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                placer.place(player.items[5] ? player.items[5] : player.items[3], i);
            }
        }
    });
    var commandsList = [];
    let checkboxs = scriptMenu.getElementsByTagName("input");
    for (let i = 0; i < checkboxs.length; i++) {
        if (checkboxs[i].type == "checkbox") {
            commandsList.push({
                id: checkboxs[i].id,
                type: "checkbox"
            });
            checkboxs[i].addEventListener("change", () => {
                checkboxs[i].blur();
            })
        } else if (checkboxs[i].type == "number") {
            commandsList.push({
                id: checkboxs[i].id,
                type: "number"
            });
        }
    }
    commandsList.push({
        id: "bowinsta",
        type: "chat"
    });
    commandsList.push({
        id: "crash",
        type: "chat"
    });
    chatBox.autocomplete = "off";
    var commands = document.createElement("div");
    commands.style = `
    display: none;
    position: absolute;
    color: #fff;
    top: 270px;
    right: 25px;
    padding: 6px;
    width: 353px;
    max-height: 250px;
    font-size: 14px;
    background-color: rgb(0, 0, 0);
    overflow-y: scroll;
    `;
    document.body.append(commands);
    var commandDescriptions = {
        "placeEveryTick": "automatically places buildings every tick",
        "autohit": "automatically bull hits enemies when needed",
        "autopush": "helps you with pushing enemies into spikes",
        "instaOnToggle": "auto instas when enemy reaches X shame",
        "bow insta": "does a ranged instakill",
        "crash": "disconnects you from the game",
        "killChat": "mocks the person you kill",
        "autogrind": "automatically places buildings and breaks them to farm weapon xp",
        "playerDist": "the distance to the player the bots are restricted to",
        "mouseless": "stops player from actively aims towards the mouse",
        "autobuy": "automatically buys hats/accs",
        "autoemp": "automatically equips/uses emp helmet when turrets are near",
        "antitrap": "automatically places buildings when trap so that enemies can't trap-spike you",
        "autoreplace": "automatically replace buildings when a building is killed/destroyed",
        "antogocry": "sensitive anti-insta protects you",
        "realdir": "renders the player's real direction",
        "maxPerformance": "trees fade as you go close to them",
        "infiniteRange": "renders object breaks from far away",
        "buildingHealth": "renders building's health",
        "autobreak": "automatically breaks traps when you're in them",
        "autoTankHit": "automatically breaks buildings depending on current condition",
        "katanaTexture": "replaces sword texture with katana",
        "teamsync": "range instas on map ping",
        "autoOneTick": "automatically does onetick/onetick instakills",
        "autobullspam": "automatically bull hits enemies when in range",
        "texturepack": "renders better hat/acc/weapons sprites",
        "autoreload": "auto reloads/cooldown weapons",
        "loopsongs": "auto loops songs when auto chatting",
        "onlyMusic": "when auto-chatting, only music is played"
    };
    function pushTextCommand(command, doDescription) {
        if (commandDescriptions[command.id] && !doDescription) {
            let splitText = chatBox.value.slice(1, chatBox.value.length).split("");
            let text = "";
            for (let i = 0; i < command.id.length; i++) {
                if (splitText.includes(command.id[i])) {
                    text += `<span>${command.id[i]}</span>`;
                } else {
                    text += `<span style="color: #0f0;">${command.id[i]}</span>`;
                }
            }
            return `
            .${text} - ${commandDescriptions[command.id]}
            `;
        } else {
            let splitText = chatBox.value.slice(1, chatBox.value.length).split("");
            let text = "";
            for (let i = 0; i < command.id.length; i++) {
                if (splitText.includes(command.id[i])) {
                    text += `<span>${command.id[i]}</span>`;
                } else {
                    text += `<span style="color: #0f0;">${command.id[i]}</span>`;
                }
            }
            return `
            .${text}
            `;
        }
    }
    function autoFillCommand(command, something) {
        if (command.type == "chat") {
            sendChat(`.${command.id}`);
            commands.style.display = "none";
            chatBox.value = "";
            chatBox.blur();
            if (spamchat == true) {
                audios[document.getElementById("chatType").value].play();
            }
        } else if (command.type == "checkbox") {
            if (something) {
                sendChat(`.${command.id} ${something}`);
                commands.style.display = "none";
                chatBox.value = "";
                chatBox.blur();
            } else {
                chatBox.value = `.${command.id}`;
                filterCommands();
                chatBox.focus();
            }
            if (spamchat == true) {
                audios[document.getElementById("chatType").value].play();
            }
        } else if (command.type == "number") {
            if (something) {
                chatBox.value = `.${command.id} ${something} `;
            } else {
                chatBox.value = `.${command.id}`;
            }
            filterCommands();
            if (spamchat == true) {
                audios[document.getElementById("chatType").value].play();
            }
            chatBox.focus();
        }
    }
    function filterCommands() {
        commands.innerHTML = "";
        if (chatBox.value[0] == ".") {
            if (chatBox.value.length == 1) {
                commands.style.display = "block";
                for (let i = 0; i < commandsList.length; i++) {
                    let command = commandsList[i];
                    commands.innerHTML += `
                    <div id="autoFill${command.id}" onmouseover="
                    this.style.color='#000';
                    this.style.backgroundColor='#fff';
                    " onmouseout="
                    this.style.color='#fff';
                    this.style.backgroundColor='#000';
                    " style="cursor: pointer;">
                    ${pushTextCommand(command)}
                    </div>
                    `;
                }
                for (let i = 0; i < commandsList.length; i++) {
                    let command = commandsList[i];
                    if (document.getElementById("autoFill" + command.id)) document.getElementById("autoFill" + command.id).onclick = function () {
                        autoFillCommand(command);
                    };
                }
            } else if (commandsList.filter(e => e.id.includes(chatBox.value.slice(1, chatBox.value.length))).length > 1) {
                commands.style.display = "block";
                for (let i = 0; i < commandsList.length; i++) {
                    let command = commandsList[i];
                    if (command.id.includes(chatBox.value.slice(1, chatBox.value.length))) {
                        commands.innerHTML += `
                        <div id="autoFill${command.id}" onmouseover="
                        this.style.color='#000';
                        this.style.backgroundColor='#fff';
                        " onmouseout="
                        this.style.color='#fff';
                        this.style.backgroundColor='#000';
                        " style="cursor: pointer;">
                        ${pushTextCommand(command)}
                        </div>
                        `;
                    }
                }
                for (let i = 0; i < commandsList.length; i++) {
                    let command = commandsList[i];
                    if (document.getElementById("autoFill" + command.id)) document.getElementById("autoFill" + command.id).onclick = function () {
                        autoFillCommand(command);
                    };
                }
            } else if (commandsList.find(e => e.id.includes(chatBox.value.slice(1, chatBox.value.length)))) {
                let command = commandsList.find(e => e.id.includes(chatBox.value.slice(1, chatBox.value.length)));
                if (command.type == "chat") {
                    commands.innerHTML += `
                    <div id="autoFill" onmouseover="
                    this.style.color='#000';
                    this.style.backgroundColor='#fff';
                    " onmouseout="
                    this.style.color='#fff';
                    this.style.backgroundColor='#000';
                    " style="cursor: pointer;">
                    ${pushTextCommand(command, true)}
                    </div>
                    `;
                    document.getElementById("autoFill").onclick = function () {
                        autoFillCommand(command);
                    }
                } else if (command.type == "checkbox") {
                    commands.innerHTML += `
                    <div id="autoFillTrue" onmouseover="
                    this.style.color='#000';
                    this.style.backgroundColor='#fff';
                    " onmouseout="
                    this.style.color='#fff';
                    this.style.backgroundColor='#000';
                    " style="cursor: pointer;">
                    ${pushTextCommand(command, true)} true
                    </div>
                    `;
                    commands.innerHTML += `
                    <div id="autoFillFalse" onmouseover="
                    this.style.color='#000';
                    this.style.backgroundColor='#fff';
                    " onmouseout="
                    this.style.color='#fff';
                    this.style.backgroundColor='#000';
                    " style="cursor: pointer;">
                    ${pushTextCommand(command, true)} false
                    </div>
                    `;
                    document.getElementById("autoFillTrue").onclick = function () {
                        autoFillCommand(command, "true");
                    }
                    document.getElementById("autoFillFalse").onclick = function () {
                        autoFillCommand(command, "false");
                    }
                } else {
                    commands.innerHTML += `
                    <div id="autoFillSet" onmouseover="
                    this.style.color='#000';
                    this.style.backgroundColor='#fff';
                    " onmouseout="
                    this.style.color='#fff';
                    this.style.backgroundColor='#000';
                    " style="cursor: pointer;">
                    ${pushTextCommand(command, true)} set
                    </div>
                    `;
                    document.getElementById("autoFillSet").onclick = function () {
                        autoFillCommand(command, "set");
                    }
                }
            } else {
                commands.style.display = "none";
            }
        } else {
            commands.style.display = "none";
        }
    }
    function getCurrentTime() {
        let now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        let amOrPm = hours >= 12 ? "PM" : "AM";
        let formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        let formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${formattedHours}:${formattedMinutes} ${amOrPm}`;
    }
    document.getElementById("autoplaceToggle").onclick = function () {
        document.getElementById("placeEveryTick").click();
        document.getElementById("autoplaceDisplay").innerHTML = `| ${toggles.placeEveryTick()}`;
        this.blur();
    }
    document.getElementById("topInfoHolder").style.left = "20px";
    document.getElementById("resDisplay").appendChild(document.getElementById("killCounter"));
    killCounter.style.bottom = location.hostname == "sandbox.moomoo.io" ? "20px" : "185px";
    if (location.hostname == "sandbox.moomoo.io") {
        foodDisplay.style.display = "none";
        woodDisplay.style.display = "none";
        stoneDisplay.style.display = "none";
    }
    killCounter.style.right = "20px";
    allianceButton.style.left = "307px";
    chatButton.style.right = "140px";
    chatButton.style.display = "none";
    document.getElementById("topInfoHolder").style.display = "none";
    storeButton.style.left = "247px";
    mapDisplay.style.backgroundImage = "url('https://i.imgur.com/fgFsQJp.png')";
    storeButton.removeAttribute("id");
    allianceButton.removeAttribute("id");
    itemInfoHolder.style.left = "247px";
    itemInfoHolder.style.top = "80px";
    var projects = [{
        link: "wss://delirious-clef-coconut.glitch.me",
        amount: 0
    }, {
        link: "wss://rattle-paste-spotted.glitch.me",
        amount: 0
    }, {
        link: "wss://strengthened-deltadromeus-special.glitch.me",
        amount: 0
    }, {
        link: "wss://spiral-meadow-gleaming.glitch.me",
        amount: 0
    }, {
        link: "wss://chivalrous-silent-coreopsis.glitch.me",
        amount: 0
    }, {
        link: "wss://rustic-fluorescent-soy.glitch.me",
        amount: 0
    }, {
        link: "wss://tortoiseshell-flaxen-sorrel.glitch.me",
        amount: 0
    }, {
        link: "wss://proud-grey-pipe.glitch.me",
        amount: 0
    }, {
        link: "wss://daily-ribbon-xenoposeidon.glitch.me",
        amount: 0
    }, {
        link: "wss://incongruous-sugar-stream.glitch.me",
        amount: 0
    }];
    //"wss://witty-concrete-shoulder.glitch.me", "wss://learned-special-party.glitch.me"
    var extraProcessData = [];
    var botSids = [];
    class Bot {
        constructor(project, amount, name) {
            this.tokens = [];
            this.amount = amount;
            this.project = project;
            this.name = name;
            this.initialize();
        }
        updatePlayers(data) {
            for (let i = 0; i < data.length; i++) {
                extraProcessData.push(data[i]);
            }
        }
        async initialize() {
            await this.getTokens();
            if (this.tokens.length === this.amount) {
                this.openWebSocket();
            } else {
                console.error("Failed to acquire all tokens.");
            }
        }
        getTokens() {
            const tokenPromises = [];
            for (let i = 0; i < this.amount; i++) {
                const tokenPromise = new Promise((resolve, reject) => {
                    window.grecaptcha.execute("6LfahtgjAAAAAF8SkpjyeYMcxMdxIaQeh-VoPATP", { action: "homepage" }).then((token) => {
                        this.tokens.push("re:" + token);
                        resolve();
                    }).catch(reject);
                });
                tokenPromises.push(tokenPromise);
            }
            return Promise.all(tokenPromises);
        }
        openWebSocket() {
            let tokenText = "";
            for (let i = 0; i < this.tokens.length; i++) {
                tokenText += `token=${encodeURIComponent(this.tokens[i])}`;
            }
            const websocketURL = `${this.project}?${tokenText}&ip=${websocket}&amount=${this.amount}`;
            this.socket = new WebSocket(websocketURL);
            this.socket.onopen = () => {
                this.socket.send(JSON.stringify({
                    type: "module",
                    data: document.getElementById("botMode").value || "bowspam"
                }));
                this.socket.send(JSON.stringify({
                    type: "update",
                    data: {
                        name: this.name,
                        botTickPlace: toggles.botTickPlace(),
                        playerDist: parseInt(document.getElementById("playerDist").value),
                        breakerRange: parseInt(document.getElementById("breakerRange").value),
                        targetType: document.getElementById("targetType").value,
                        movementType: document.getElementById("movementType").value,
                        isNormalServer: toggles.isNormalServer()
                    }
                }));
                console.log('connected');
            };
            this.socket.onmessage = (message) => {
                let data = JSON.parse(message.data);
                if (data.type == "packet") {
                    let msg = data.message;
                    if (msg.type == "H") {
                        let data = msg.data;
                        for (let i = 0; i < data.length;) {
                            objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? { sid: data[i + 7] } : null));
                            i += 8;
                        }
                    } else if (msg.type == "a") {
                        this.updatePlayers(msg.data);
                    } else if (msg.type == "D") {
                        let data = msg.data;
                        let tmpPlayer = findPlayerByID(data[0]);
                        if (!tmpPlayer) {
                            tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories);
                            players.push(tmpPlayer);
                        }
                        if (tmpPlayer.sid != player.sid) {
                            tmpPlayer.spawn(null);
                            tmpPlayer.visible = false;
                            tmpPlayer.x2 = undefined;
                            tmpPlayer.y2 = undefined;
                            tmpPlayer.setData(data);
                        }
                    } else if (msg.type == "6") {
                        let tmpPlayer = findPlayerBySID(msg.sid);
                        if (tmpPlayer && dist2(tmpPlayer, player) >= 1200) {
                            tmpPlayer.chatMessage = msg.message;
                            tmpPlayer.chatCountdown = config.chatCountdown;
                        }
                    } else if (msg.type == "Q") {
                        killObject(msg.sid);
                    } else if (msg.type == "R") {
                        killObjects(msg.sid);
                    }
                } else if (data.type == "botSid") {
                    if (!botSids.find(e => e == data.sid)) {
                        botSids.push(data.sid);
                    }
                }
            };
            this.socket.onclose = () => {
                this.CLOSED = true;
                let project = projects.find(e => e.link == this.project);
                project.amount = 0;
                updatePanel();
            };
        }
    }
    var BreakerRange = 900;
    var movementType = "normal";
    document.getElementById("updateBot").onclick = function () {
        let playerDist = parseInt(document.getElementById("playerDist").value || 0);
        let breakerRange = parseInt(document.getElementById("breakerRange").value || 0);
        BreakerRange = breakerRange;
        movementType = document.getElementById("movementType").value;
        for (let i = 0; i < bots.length; i++) {
            if (bots[i].socket && bots[i].socket.readyState == 1 && !bots[i].CLOSED) {
                bots[i].socket.send(JSON.stringify({
                    type: "update",
                    data: {
                        botTickPlace: toggles.botTickPlace(),
                        playerDist: playerDist,
                        breakerRange: breakerRange,
                        targetType: document.getElementById("targetType").value,
                        movementType: document.getElementById("movementType").value,
                        isNormalServer: toggles.isNormalServer()
                    }
                }));
            }
        }
        this.blur();
    }
    let botModule = "musket";
    document.getElementById("setBotModule").onclick = function () {
        botModule = document.getElementById("botMode").value || "musket";
        for (let i = 0; i < bots.length; i++) {
            if (bots[i].socket && bots[i].socket.readyState && !bots[i].CLOSED) {
                bots[i].socket.send(JSON.stringify({
                    type: "module",
                    data: document.getElementById("botMode").value || "bowspam"
                }));
            }
        }
        this.blur();
    }
    var botControlPanel = document.createElement("div");
    botControlPanel.style = `
    display: none;
    position: absolute;
    color: #fff;
    top: 50%;
    left: 50%;
    width: 425px;
    height: 550px;
    transform: translate(-50%, -50%);
    border-radius: 4px;
    background-color: rgb(0, 0, 0, .25);
    `;
    var appleImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAABCCAYAAADjVADoAAAAAXNSR0IArs4c6QAAA2pJREFUeF7tmrFy1DAQhle+QAUNNKQnDwANJUnrpCAzvAEPkuRB8gbMhCJxm6ODhnuAow8NaYCOOzHrWEGWJZ+1WusMs25u7k6WvJ/+f1eWrUCOmoASDncEBESjBAEhINpJQRQhihBFeAulWONfsMbR0dt9rVcnWsO+PY1KwVxr/bEoduaXl+/nHGuhySnCBI/BuQBCARfF7CAVyKRAHB4eXw8NvgtFn1XVh1OqOrYOIiR/E9CjJxqe7a3qr4+fruHH9wJ+3Sq4Wc6CMaN1rq4uDmKgZAWBQd9JfnWySfoGAAYfOvqhxCkkC4hNs24Huru3ulfA0Bn9tpwFFDIcxuggYnw/RAU+OKiMr593On/FWGQ0EGX55hRA1RaIPWJVsageeoYYrgY8mR1ECMCuUvACAPDTPW60hgUA4GeMTZafHsDP23Z/qAKlZmex5ZQVRB+E0gPABXK+7ibG569+19XCPtAKmBd8EGKrhemXDYQPQp8KfHZZaA1fHFVgO9cqHFZwx2cB4YPwEq0wQAXuBW2C4asQk1lZluVxy9zviiI2P3rbh6C4javqInlCkztw1UBVQoicL29028ZVCN9YDCDGUYO5WJ8qMPG6VSZVFUkgxlaDgWGXV0zACAJ/q6zEGrN4YleEnRu4LRGqKnYCRhD22iNFFWRF2EvnHBBCOcSGkaIKMojcagiBcC1CVQUJhJsbuMoltebalYW6pvjvQFDtQQLh3lpPSRFZQYy1kuSwBvZByRMkRQiIZsoEhIBou1eSZcNjyiAAaHeipGSJ2/Pr9era6GRK5XOrIPBu0LcpSy2HMee5t+mU0onjkRSBJ9r2MLfGMQFwtW2DoNkiCYRrj23A4FJDEghXFfg9p0W6O1d0NSSDqIO3Nm5zqsLdy6TmBmNRco4wHeTarrNzCrcaWBThqgK/j11OudXACKL7wHeM7Tv/c4603MBmjZBFzO8cQEIPiamLJ1/pTs4Rdqehh8ApMNyd6r/j8SiBXRFDlIFthj4PDasAe+GFwJYjfFJLeVEkvOrkBzCaItwgOIBQ9yFjlvGsOaJv4Jh3qe5nifCaYEzwdttsINo5BEAp9dr3anHtV8KrP1QA2ayReoG5zs+uiFyBxY4jIBpiAkJAtM0jihBFiCK8BUWsIdYQa4g1+labkiMaOn8A3/j/Uu8Jrj0AAAAASUVORK5CYII=";
    botControlPanel.innerHTML = `
    <style>
    ::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 10px;
    }
    ::-webkit-scrollbar-thumb {
    background-color: rgba(0,0,0,.5);
    -webkit-box-shadow: 0 0 1px rgba(255,255,255,.5);
    }
    </style>
    <div style="width: 100%; font-size: 30px; margin-top: 15px; text-align: center;">
    Bot Control Panel
    </div>
    <hr>
    <div id="closeControlPanel" style="position: absolute; top: 5px; right: 5px; cursor: pointer;">
    <span class="material-icons" style="color: #fff; font-size: 29.5px;">
    close
    </span>
    </div>
    <div id="botPanelContent" style="position: absolute; width: 100%; height: 480px; overflow-y: scroll;">
    </div>
    `;
    document.body.appendChild(botControlPanel);
    function updatePanel() {
        let element = document.getElementById("botPanelContent");
        element.innerHTML = "";
        for (let i = 0; i < projects.length; i++) {
            let proj = projects[i];
            element.innerHTML += `
            <div style="margin-left: 10px;">
            <h2 style="font-size: 20px;">Host: ${i + 1}</h2>
            Connected Sockets (you own): ${proj.amount}/4<br>
            <input id="botName${proj.link}" type="text" placeholder="Bot Name" maxlength="15" style="width: 100px;"> <input id="valueFor${proj.link}" type="number" style="width: 25px;" value="4" max="4" min="0"> <span>if name input is empty, it will use preselected names</span><br>
            <button id="spawn${proj.link}" style="cursor: pointer;" ${proj.amount == 4 ? "disabled" : ""}>Spawn</button> <button id="disconect${proj.link}" style="cursor: pointer;" ${proj.amount == 0 ? "disabled" : ""}>Disconnect</button>
            </div>
            `;
        }
        for (let i = 0; i < projects.length; i++) {
            let proj = projects[i];
            document.getElementById(`spawn${proj.link}`).onclick = async function () {
                let name = document.getElementById(`botName${proj.link}`).value;
                let amount = parseInt(document.getElementById(`valueFor${proj.link}`).value);
                if (proj.amount < 4) {
                    let bot = bots.find(e => e.project == proj.link && !e.CLOSED);
                    if (bot) {
                        if (bot.socket.readyState == 1) {
                            bot.amount = amount;
                            if (proj.amount + amount > 4) {
                                amount = 4 - proj.amount;
                                bot.amount = 4 - proj.amount;
                            }
                            if (bot.amount > 0) {
                                bot.tokens = [];
                                await bot.getTokens();
                                bot.socket.send(JSON.stringify({
                                    type: "add",
                                    amount: amount,
                                    ip: websocket,
                                    tokens: [...bot.tokens]
                                }));
                                proj.amount += amount;
                                updatePanel();
                            }
                        }
                    } else {
                        bots.push(new Bot(proj.link, amount, name));
                        proj.amount += amount;
                        updatePanel();
                    }
                }
                this.blur();
            }
            document.getElementById(`disconect${proj.link}`).onclick = function () {
                let amount = parseInt(document.getElementById(`valueFor${proj.link}`).value);
                if (proj.amount > 0) {
                    let bot = bots.find(e => e.project == proj.link && !e.CLOSED);
                    if (bot && bot.socket.readyState == 1) {
                        if (proj.amount - amount < 0) {
                            amount = proj.amount;
                        }
                        bot.socket.send(JSON.stringify({
                            type: "dc",
                            amount: amount
                        }));
                        proj.amount -= amount;
                        if (proj.amount <= 0) {
                            bot.close();
                        }
                        updatePanel();
                    }
                }
                this.blur();
            }
        }
    }
    document.getElementById("closeControlPanel").onclick = function () {
        botControlPanel.style.display = "none";
    }
    document.getElementById("openControlPanel").onclick = function () {
        botControlPanel.style.display = "block";
        updatePanel();
    }
    /*
    document.getElementById("executeBotStuff").onclick = function () {
        let value = document.getElementById("botAmount").value;
        if (!value) {
            document.getElementById("botAmount").value = 0;
        }
        let botAmount = parseInt(document.getElementById("botAmount").value);
        while (botAmount > 0) {
            if (document.getElementById("botAmountType1").value == 0) {
                let Project = projects.find(e => e.amount < 4);
                if (Project) {
                    let amount = 0;
                    if (botAmount >= 4) {
                        amount = 4;
                        botAmount -= 4;
                    } else {
                        amount = botAmount;
                        botAmount = 0;
                    }
                    Project.amount += amount;
                    bots.push(new Bot(Project.link, bots.length, amount));
                } else {
                    botAmount = 0;
                }
            } else {
                let botClass = bots.find(e => e.amount > 0 && !e.CLOSED);
                if (botClass) {
                    let Project = projects.find(e => e.link == botClass.project);
                    let amount = 0;
                    if (botAmount >= botClass.amount) {
                        amount = botClass.amount;
                        botAmount -= botClass.amount;
                    } else {
                        amount = botAmount;
                        botAmount -= amount;
                    }
                    Project.amount -= amount;
                    botClass.amount -= amount;
                    botClass.socket.send(JSON.stringify({
                        type: "dc",
                        amount: amount
                    }))
                } else {
                    botAmount = 0;
                }
            }
        }
        this.blur();
    }
    */
    var tick = 0;
    var queueTick = [];
    function setTickout(action, delay) {
        let tickDelay = tick + delay;
        if (typeof queueTick[tickDelay] !== "object") {
            queueTick[tickDelay] = [action];
        } else {
            queueTick[tickDelay].push(action);
        }
    }
    var needTick = 0;
    var oneticking = false
    var canAntiBull = false;
    var aimAtAngle = 0;
    var auorelad = false;
    var aeAngleFix = 3.14, aeAngle = aeAngleFix * Math.random();
    setInterval(() => {
        aeAngleFix *= -1;
        aeAngle = aeAngleFix * Math.random();
    }, 350);
    var antiBullHit = {
        canDo: false,
        checker: null
    };
    var attackLoop = {
        status: false,
        change: function (boolean) {
            if (boolean == true) {
                if (this.status == false) {
                    sendAutoGather();
                }
                io.send("d", 1, enemies.angle);
                this.status = true;
            } else {
                if (this.status == true) {
                    sendAutoGather();
                }
                this.status = false;
                io.send("d", 0, enemies.angle);
            }
        }
    };
    var lastTickTime = 0;
    function getLocationAfterKnock(obj, angle, knock) {
        let newLocation = {
            x: 0,
            y: 0
        };
        let tmpSpd = (0.3 * (obj.weightM || 1)) + (knock || 0);
        newLocation = {
            x: (obj.x2 || obj.x) + (Math.cos(angle) * tmpSpd) * (1000 / 9),
            y: (obj.y2 || obj.y) + (Math.sin(angle) * tmpSpd) * (1000 / 9),
        }
        return newLocation;
    }
    function canBullTick() {
        if (player.skinIndex === 45 || player.health - 5 <= 0) {
            return false;
        }
        if (player.shameCount > 0 && ((tick - player.bullTick) % 9 === 0 || needTick > 1)) {
            return true;
        }
        return false;
    }
    function setTrapData(tmpObj) {
        let allTraps = gameObjects.filter(e => e.trap);
        allTraps = allTraps.filter(e => e.owner.sid != tmpObj.sid && (tmpObj.sid == player.sid ? !isAlly(e.owner.sid) : true) && Math.hypot(e.y - tmpObj.y2, e.x - tmpObj.x2) <= 50);
        let nearestTrap = allTraps.sort((a, b) => Math.hypot(a.y - tmpObj.y2, a.x - tmpObj.x2) - Math.hypot(b.y - tmpObj.y2, b.x - tmpObj.x2))[0];
        if (nearestTrap) {
            tmpObj.trap = nearestTrap;
        } else {
            tmpObj.trap = null;
        }
    }
    function getAttackDir() {
        if (!player) {
            return 0;
        } else if (autoaim == true) {
            return enemies.angle;
        } else if (player.trap && toggles.autobreak() && !attackState) {
            return trapAngle;
        } else if (tankSpam == true) {
            return tankAim;
        } else if (toggles.autogrind() == true) {
            return Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        } else if (bowSpam == true && enemies.closest) {
            return enemies.angle;
        } else if (scriptStatus == "auto bull spam") {
            return enemies.angle || Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        } else if (scriptStatus == "auto tank spam") {
            return tankTargetAngle;
        } else if (!player.lockDir) {
            lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
        }
        return UTILS.fixTo(lastDir || 0, 2);
    }
    serverBrowser.addEventListener("change", UTILS.checkTrusted(function () {
        let parts = serverBrowser.value.split(":");
        vultrClient.switchServer(parts[0], parts[1]);
    }));
    function heal(d) {
        if (d > 100) return;
        let heal = player.items[0] == 0 ? 20 : player.items[0] == 1 ? 40 : 30;
        let amount = d / heal;
        for (let i = 0; i < amount; i++) {
            if (player.skinIndex != 45) {
                placer.place(player.items[0], getAttackDir());
            }
        }
    }
    var millX = 0;
    var millY = 0;
    document.getElementById("toggleUIButton").onclick = function () {
        if (gameUI.style.display == "none") {
            gameUI.style.display = "block";
        } else {
            gameUI.style.display = "none";
        }
        this.blur();
    }
    function checkItemLocation(x, y, s, sM, indx, ignoreWater, placer) {
        const cantPlace = closeObjects.find(tmp => tmp && tmp != placer && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
        if (cantPlace) {
            return false;
        }
        if (!ignoreWater && indx !== 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) {
            return false;
        }
        return true;
    }
    function canGetSpikeTicked() {
        let pi12 = Math.PI / 12;
        if (enemies.closest && dist2(enemies.closest, player) <= 250) {
            let toMe = Math.atan2(player.y2 - enemies.closest.y2, player.x2 - enemies.closest.x2);
            for (let i = 0; i < 12; i++) {
                let angle = pi12 * i;
                for (let t = 0; t < 2; t++) {
                    let multi = t % 2 == 0 ? 1 : -1;
                    let spikeX = enemies.closest.x2 + Math.cos(toMe + (angle * multi)) * 87;
                    let spikeY = enemies.closest.y2 + Math.sin(toMe + (angle * multi)) * 87;
                    if (dist2({ x: spikeX, y: spikeY }, player) <= 87) {
                        if (checkItemLocation(spikeX, spikeY, 52, null, null, false)) {
                            return true;
                        }
                    } else if (dist2({ x: spikeX, y: spikeY }, { x: player.velX, y: player.velY }) <= 87) {
                        if (checkItemLocation(spikeX, spikeY, 52, null, null, false)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    function biomeHats(acc = 11) {
        let id = 0;
        if (isPushing) acc = 19;
        if (player.y2 > 6850 && player.y2 < 7550) {
            id = 31;
        } else if (player.y2 < 2400) {
            id = 15;
        } else if (!player.skins[12]) {
            id = 6;
        } else {
            id = 12;
        }
        storeQueue.push({
            id: id,
            reason: "normal"
        });
        if (acc != "no acc") {
            storeQueue.push({
                id: acc,
                index: true,
                reason: "normal"
            });
        }
    }
    var buildingsHit = [];
    var isPushing = false;
    function sendAutoGather() {
        io.send("K", 1);
    }
    function autoSelect() {
        if (!toggles.autoreload()) return;
        if (player.primary.reload != 1 && [4, 5].includes(player.weapons[0])) {
            auorelad = true;
            if (player.weaponIndex != player.weapons[0]) {
                selectToBuild(player.weapons[0], 1);
            }
        } else if (player.secondary.reload != 1) {
            auorelad = true;
            if (player.weaponIndex != player.weapons[1]) {
                selectToBuild(player.weapons[1], 1);
            }
            if (player.weapons[1] == 15 && aeAngle != aimAtAngle) {
                aimAtAngle = aeAngle;
                io.send("D", aeAngle);
            }
        } else if (player.primary.reload != 1) {
            auorelad = true;
            if (player.weaponIndex != player.weapons[0]) {
                selectToBuild(player.weapons[0], 1);
            }
        } else if (auorelad) {
            auorelad = false;
            if (player.weapons[1] == 10 && (player.weapons[0] == 4 || player.weapons[0] == 5)) {
                if (player.weaponIndex != player.weapons[1]) {
                    selectToBuild(player.weapons[1], 1);
                }
            } else {
                if (player.weaponIndex != player.weapons[0]) {
                    selectToBuild(player.weapons[0], 1);
                }
            }
        }
    }
    function correctDamage(damage) {
        for (let i = 0; i < items.weapons.length; i++) {
            if (soldierRound(items.weapons[i].dmg * 1.1) == damage) {
                return damage;
            } else if (soldierRound(items.weapons[i].dmg) == damage) {
                return damage;
            } else if (soldierRound(items.weapons[i].dmg * 1.18) == damage) {
                return damage;
            } else if (soldierRound(items.weapons[i].dmg * 1.1 * 1.5) == damage) {
                return damage;
            } else if (soldierRound(items.weapons[i].dmg * 1.5) == damage) {
                return damage;
            } else if (soldierRound(items.weapons[i].dmg * 1.18 * 1.5) == damage) {
                return damage;
            }
        }
        if (soldierRound(35) == damage || soldierRound(20) == damage || soldierRound(45) == damage || soldierRound(30) == damage) {//if its spike damage
            return damage;
        }
        for (let i = 0; i < items.weapons.length; i++) {
            if (Math.abs(damage - soldierRound(items.weapons[i].dmg * 1.1)) <= 1) {
                return soldierRound(items.weapons[i].dmg * 1.1);
            } else if (Math.abs(damage - soldierRound(items.weapons[i].dmg)) <= 1) {
                return soldierRound(items.weapons[i].dmg);
            } else if (Math.abs(damage - soldierRound(items.weapons[i].dmg * 1.18)) <= 1) {
                return soldierRound(items.weapons[i].dmg * 1.18);
            } else if (Math.abs(damage - soldierRound(items.weapons[i].dmg * 1.1 * 1.5)) <= 1) {
                return soldierRound(items.weapons[i].dmg * 1.1 * 1.5);
            } else if (Math.abs(damage - soldierRound(items.weapons[i].dmg * 1.5)) <= 1) {
                return soldierRound(items.weapons[i].dmg * 1.5);
            } else if (Math.abs(damage - soldierRound(items.weapons[i].dmg * 1.18 * 1.5)) <= 1) {
                return soldierRound(items.weapons[i].dmg * 1.18 * 1.5);
            }
        }
        return damage;
    }
    function needAutoHit() {
        let enemy = enemies.closest;
        if (!enemy) return;
        if (!toggles.autohit()) return;
        let Do = false;
        if (player.tailIndex == 11) return;
        if (player.primary.reload != 1 || dist2(enemy, player) - 63 > items.weapons[player.weapons[0]].range) return;
        if (enemy.trap) {
            let items = closeObjects.filter(e => e.dmg && (e.owner.sid == player.sid || isAlly(e.owner.sid)));
            if (items.length) {
                let closest = items.sort((a, b) => dist2(a, enemy) - dist2(b, enemy))[0];
                if (closest) {
                    if (dist2(closest, enemy.trap) <= 85 + closest.scale) {
                        if (onBuild({ x: enemy.velX, y: enemy.velY, scale: 35 }, closest)) {
                            Do = "SyncHit";
                            insta.do("bullhit");
                        }
                    }
                    if (enemy.damageData.includes(closest.dmg) || enemy.damageData.includes(closest.dmg * .75)) {
                        if (enemy.health - (player.primary.dmg * 1.5) <= 0) {
                            Do = "SyncHit";
                            insta.do("bullhit");
                        }
                    }
                }
            }
        } else {
            let power = 0;
            if (items.weapons[player.weapons[0]].knock) {
                power += items.weapons[player.weapons[0]].knock;
            }
            if (player.secondary.reload == 1 && player.weapons[1]) {
                if (items.weapons[player.weapons[1]].knock) {
                    power += items.weapons[player.weapons[0]].knock;
                }
                if (items.weapons[player.weapons[1]].projectile) {
                    power += .3;
                }
                if (player.skins[53] && player.turret == 1) {
                    power += .3;
                }
            }
            let knockback = getLocationAfterKnock(enemy, enemies.angle, power);
            for (let i = 0; i < closeObjects.length; i++) {
                let _ = closeObjects[i];
                if ((_.dmg && (_.owner.sid == player.sid || isAlly(_.owner.sid))) || (_.type == 1 && _.y >= 12000)) {
                    let velDistance = dist2(_, { x: knockback.x, y: knockback.y });
                    let distance = dist2(_, enemies.closest);
                    let subDist = velDistance - distance;
                    for (let times = 1; times <= 5; times++) {
                        let div = (subDist / 5) * times;
                        if ((distance + div) <= 35 + _.scale) {
                            if (player.secondary.reload == 1 && player.weapons[1]) {
                                if (enemy.skinIndex == 6 && player.weapons[1] == 10 && dist2(enemy, player) - 63 <= items.weapons[player.weapons[1]].range) {
                                    Do = "SyncReverse";
                                    insta.do("reverse");
                                } else {
                                    if (player.weapons[1] == 11 || player.weapons[1] == 10) {
                                        Do = "SyncHit";
                                        insta.do("bullhit");
                                    } else {
                                        Do = "SyncInsta";
                                        insta.do("normal");
                                    }
                                }
                            } else {
                                Do = "SyncHit";
                                insta.do("bullhit");
                            }
                            break;
                        }
                    }
                    if (Do) {
                        break;
                    }
                }
                if ((_.dmg && (_.owner.sid == player.sid || isAlly(_.owner.sid))) || (_.type == 1 && _.y >= 12000)) {
                    let velDistance = dist2(_, { x: enemy.velX, y: enemy.velY });
                    let distance = dist2(_, enemy);
                    let subDist = velDistance - distance;
                    for (let times = 1; times <= 5; times++) {
                        let div = (subDist / 5) * times;
                        if ((distance + div) <= 35 + _.scale) {
                            Do = "SyncHit";
                            insta.do("bullhit");
                            break;
                        }
                    }
                    if (Do) {
                        break;
                    }
                }
            }
        }
    }
    var tankTargetAngle = 0;
    function findTarget(filterFunction) {
        tankTarget = closeObjects.sort((a, b) => dist2(a, player) - dist2(b, player)).find(filterFunction);
        return tankTarget !== undefined;
    }
    function findPitTrap(obj) {
        if (!obj.trap) return false;
        return closeObjects.some(e => e && e.dmg && (e.owner.sid == player.sid || isAlly(e.owner.sid)) && dist2(e, obj) <= 85 + e.scale);
    }
    function autoTankHit(enemy, LMAOO) {
        let weapon = items.weapons[10];
        if (LMAOO) {
            tankTarget = LMAOO;
            return true;
        }
        if (enemy && enemy.trap && !isPushing) {
            let nearSpike = closeObjects.some(e => e && e.dmg && (e.owner.sid == player.sid || isAlly(e.owner.sid)) && dist2(enemy.trap, e) <= 85 + e.scale);
            if (nearSpike) {
                tankTarget = null;
                return false;
            }
            tankTarget = closeObjects.filter(e => e && e.currentHealth && e.sid != enemy.trap.sid && !findPitTrap(e) && placer.replaceableDirection(e) && dist2(enemy.trap, e) <= 85 + e.scale && dist2(e, player) - e.scale <= weapon.range).sort((a, b) => dist2(a, player) - dist2(b, player))[0];
            if (tankTarget !== undefined) {
                return tankTarget !== undefined;
            }
        }
        return findTarget(e => e.dmg && dist2(e, player) - e.scale < weapon.range && e.owner.sid != player.sid && !isAlly(e.owner.sid));
    }
    var objectDeathAnimation = [];
    function getTotalInstaDmg(nobull, enemy) {
        let total = 0;
        if (player.primary.reload == 1) {
            total += player.primary.dmg * (nobull ? 1 : player.skins[7] ? 1.5 : 1);
            if (player.tailIndex == 1) total *= 0.2;
        }
        if (player.secondary.reload == 1) {
            total += player.secondary.dmg;
        }
        if (player.turret == 1 && enemy.skinIndex != 22 && player.skins[53]) {
            total += 25;
        }
        if (enemy.skinIndex == 6) {
            total *= .75;
        }
        if (enemy.health - total <= 0) {
            return 100;
        }
        return total;
    }
    function doAntiSpikeTick() {
        damageData.taken.push("antitick");
        if (player.health <= 35 && player.shameCount < 5) {
            heal(100 - player.health);
        }
        trapSoldier = true;
        if (onlyEMP == true) {
            onlyEMP = false;
        }
        storeEquip(6);
        setTickout(() => {
            trapSoldier = false;
        }, 3);
    }
    function connectSocket(token) {
        vultrClient.start(function (address, port, gameIndex) {
            var protocol = "wss";
            var wsAddress = protocol + "://" + address;
            websocket = address;
            if (token) wsAddress += "/?token=" + token;
            ioConnect(wsAddress);
        }, function (error) {
            console.log(error);
            console.error("Vultr error:", error);
            alert("Error:\n" + error);
        });
    }
    function soldierRound(e) {
        if (player.skinIndex == 6) {
            return e * .75;
        } else {
            return e;
        }
    }
    function findSource(damage) {
        for (let i = 0; i < enemies.near.length; i++) {
            let enemy = enemies.near[i];
            let primaryDmg = enemy.primary.dmg;
            let secondaryDmg = enemy.secondary.dmg;
            if (enemy.primary.reload == 0 && [soldierRound(primaryDmg), soldierRound(primaryDmg * 1.5)].includes(damage)) {
                return {
                    canEMP: enemy.turret > 0.7 ? true : false,
                    sid: enemy.sid,
                    potDamage: (enemy.secondary.reload > 0.7 ? secondaryDmg : 0) + (enemy.turret > 0.7 ? 25 : 0)
                }
            }
            if ((enemy.secondary.reload <= 0) && (damage == soldierRound(secondaryDmg) || [soldierRound(25), soldierRound(30), soldierRound(35), soldierRound(50)].includes(damage))) {
                return {
                    canEMP: false,
                    sid: enemy.sid,
                    potDamage: (enemy.primary.reload > 0.7 ? primaryDmg * 1.5 : 0) + (enemy.turret > 0.7 ? 25 : 0)
                }
            }
        }
        return "unknown";
    }
    var healingTick = -1;
    function addOtherDamage(sources) {
        let totalDamage = 0;
        for (let i = 0; i < enemies.near.length; i++) {
            let enemy = enemies.near[i];
            if (!sources.find(e => e.sid == enemy.sid)) {
                let primaryDamage = 0;
                let secondaryDamage = 0;
                if (enemy.primary.reload > 0.7) {
                    primaryDamage += enemy.primary.dmg * 1.5;
                }
                if (enemy.secondary.reload > 0.7) {
                    secondaryDamage += enemy.secondary.dmg;
                }
                if (enemy.turret > 0.7) {
                    primaryDamage += 25;
                    secondaryDamage += 25;
                }
                if (secondaryDamage > primaryDamage) {
                    totalDamage += secondaryDamage;
                } else {
                    totalDamage += primaryDamage;
                }
            }
        }
        return totalDamage;
    }
    var damageData = {
        taken: [],
        proj: [],
        lastAnti: 0
    };
    function autoHeal() {
        let spikes = closeObjects.find(e => e && e.dmg && e.owner.sid != player.sid && !isAlly(e.owner.sid) && dist2(e, player) <= 130);
        if (spikes) {
            doNextTick(() => {
                heal(100 - player.health);
            });
        } else {
            healingTick = 2;
        }
    }
    function findIfTouchSpike() {
        let total = 0;
        if (!player.trap) {
            for (let i = 0; i < enemies.near.length; i++) {
                let enemy = enemies.near[i];
                let knock = 0;
                knock += (items.weapons[enemy.primary.id].knock || 0);
                let bulletBased = [13, 15, 12, 9];
                knock += (items.weapons[enemy.secondary.id].knock || (bulletBased.includes(enemy.secondary.id) ? .3 : 0));
                knock += 0.3;
                let knockback = getLocationAfterKnock(player, Math.atan2(player.y2 - enemy.y2, player.x2 - enemy.x2), knock, true);
                for (let i = 0; i < closeObjects.length; i++) {
                    let _ = closeObjects[i];
                    if (_) {
                        if ((_.dmg && _.owner.sid != player.sid && !isAlly(_.owner.sid)) || (_.type == 1 && _.y >= 12000)) {
                            let velDistance = dist2(_, { x: knockback.x, y: knockback.y });
                            let distance = dist2(_, player);
                            let subDist = velDistance - distance;
                            for (let times = 1; times <= 7; times++) {
                                let div = (subDist / 7) * times;
                                if ((distance + div) <= 35 + _.scale) {
                                    total += _.dmg;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        return total;
    }
    function canSpikePlace(obj) {
        let spike = items.list[obj.spikeType.id];
        let distance = dist2(obj, player);
        if (distance - 70 <= spike.scale) {
            let angle = Math.atan2(player.y2 - obj.y2, player.x2 - obj.x2);
            for (let i = -(Math.PI / 3) + angle; i <= angle + Math.PI / 3; i += Math.PI / 12) {
                let tmp = {
                    x: obj.x2 + Math.cos(i) * (spike.scale + 35),
                    y: obj.y2 + Math.sin(i) * (spike.scale + 35),
                };
                if (checkItemLocation(tmp.x, tmp.y, spike.scale, false, undefined, false, player.trap)) {
                    return true;
                }
            }
        }
        return false;
    }
    function healing() {
        if (damageData.taken.length) {
            if (keyPressed[81]) {
                placer.place(player.items[0]);
            } else {
                let antiBullConditions = player.shameCount < 5 && player.primary.reload == 1 && canAntiBull == true && damageData.taken.find(e => e >= 52) && player.primary.dmg >= 35;
                if (enemies.near.length) {
                    let potDamage = 0;
                    let sources = [];
                    let canEMP = player.skins[22] ? true : false;
                    for (let i = 0; i < damageData.taken.length; i++) {
                        if (damageData.taken[i] != 3.75 && damageData.taken[i] != 5 && damageData.taken[i] == "antitick") {
                            let source = findSource(damageData.taken[i]);
                            if (source != "unknown") {
                                potDamage += source.potDamage;
                                if (source.canEMP == false) canEMP = false;
                            }
                            sources.push(source);
                        }
                    }
                    let instantHeal = false;
                    if (damageData.taken.find(e => e == "antitick")) {
                        canEMP = false;
                        instantHeal = true;
                    }
                    let otherSources = addOtherDamage(sources);
                    if (otherSources > 0) {
                        canEMP = false;
                        potDamage += otherSources;
                    }
                    let closeSpikes = closeObjects.filter(e => e && e.dmg && e.owner.sid != player.sid && !isAlly(e.owner.sid) && dist2(e, player) <= 55 + e.scale);
                    let spikeDamages = !player.trap ? findIfTouchSpike() : 0;
                    for (let i = 0; i < closeSpikes.length; i++) {
                        canEMP = false;
                        potDamage += closeSpikes[i].dmg;
                    }
                    if (spikeDamages > 0) {
                        canEMP = false;
                        potDamage += spikeDamages;
                    }
                    if (player.health - potDamage <= 0) {
                        if (antiBullConditions || autoaim || instantHeal) {
                            if (player.shameCount < 6) {
                                heal(100 - player.health);
                            } else {
                                autoHeal();
                            }
                        } else if (player.health - (potDamage - 25) > 0 && rangedSoldier == false && trapSoldier == false && spikeSoldier == false && otSoldier == false && onlySoldier == false && canEMP) {
                            onlyEMP = true;
                            storeEquip(22);
                            doNextTick(() => {
                                heal(100 - player.health);
                                onlyEMP = false;
                            });
                        } else if (player.health - (potDamage * .75) > 0 && player.skins[6]) {
                            onlySoldier = true;
                            storeEquip(6);
                            doNextTick(() => {
                                heal(100 - player.health);
                                onlySoldier = false;
                            });
                        } else {
                            if (player.shameCount < 6) {
                                heal(100 - player.health);
                                if (spikeDamages) {
                                    onlySoldier = true;
                                    storeEquip(6);
                                    doNextTick(() => {
                                        onlySoldier = false;
                                    });
                                }
                            } else {
                                autoHeal();
                            }
                        }
                    } else {
                        autoHeal();
                    }
                } else {
                    autoHeal();
                }
                if (antiBullConditions) {
                    insta.do("bullhit");
                }
            }
        }
    }
    function antiBowHealing(dir) {
        let total = 0;
        for (let i = 0; i < damageData.proj.length; i++) {
            total += damageData.proj[i];
        }
        if (total <= 133 && total >= 100) {
            placer.checkPlace(player.items[1], dir);
            rangedSoldier = true;
            storeEquip(6);
            placer.place(player.items[0]);
            let healer = setInterval(() => {
                if (total * .75 >= 100 && player.shameCount < 6 && player.isAlive) {
                    placer.place(player.items[0]);
                }
            }, 80);
            setTimeout(() => {
                clearInterval(healer);
                rangedSoldier = false;
            }, 480);
        }
    }
    function onBuild(e, t) {
        let deltaX = e.x - t.x;
        let deltaY = e.y - t.y;
        let targetScale = (t.getScale ? t.getScale() : t.scale);
        return (Math.sqrt(deltaX * deltaX + deltaY * deltaY) - (e.scale + targetScale) < 0);
    }
    var storeQueue = [];
    var listOfStorePower = {
        "turrets": 3,
        "bull tick": 4,
        "normal": 0,
        "defense": 1,
        "tankHit": 3
    }
    function skinTailManager() {
        storeQueue = storeQueue.sort((a, b) => listOfStorePower[b.reason] - listOfStorePower[a.reason]);
        storeQueue = storeQueue.sort((a, b) => {
            if (!a.index && b.index) {
                return -1;
            } else if (a.index && !b.index) {
                return 1;
            }
            return 0;
        });
        let bulltick = storeQueue.filter(e => e.reason == "bull tick");
        let turrets = storeQueue.filter(e => e.reason == "turrets");
        let tankHit = storeQueue.filter(e => e.reason == "tankHit");
        let antibull = storeQueue.filter(e => e.reason == "antibull");
        if (autoaim || oneticking) {
        } else {
            if (tankHit.length || antibull.length || bulltick.length || turrets.length) {
                let object = tankHit.length ? tankHit : bulltick.length ? bulltick : turrets.length ? turrets : antibull;
                for (let i = 0; i < object.length; i++) {
                    let e = object[i];
                    if (!e.index) {
                        if (player.skinIndex != e.id && player.skins[e.id]) {
                            storeEquip(e.id);
                            break;
                        }
                    } else {
                        if ((e.reason == "antibull" ? true : !enemies.near.length) && player.tailIndex != e.id && player.tails[e.id]) {
                            storeEquip(e.id, 1);
                            break;
                        }
                    }
                }
            } else {
                for (let i = 0; i < storeQueue.length; i++) {
                    let e = storeQueue[i];
                    if (e.index) {
                        if (antiBullHit.canDo && antiBullHit.canDo.overPre && player.skins[11] && player.tails[21]) {
                            e.id = 21;
                        } else if (e.id == 19) {
                            if (player.primary.reload + (config.serverUpdateSpeed / items.weapons[player.weapons[0]].speed) >= 1) {
                                if (player.primary.dmg < 20) {
                                    e.id = 11;
                                }
                            } else {
                                e.id = 11;
                            }
                        } else if (e.id == 11 && ["defense", "normal"].includes(e.reason)) {
                            if (player.primary.reload + (config.serverUpdateSpeed / items.weapons[player.weapons[0]].speed) >= 1) {
                                if (dist2(enemies.closest, player) - 63 <= items.weapons[player.weapons[0]].range) {
                                    e.id = 19;
                                }
                            }
                        }
                    }
                    if (e.reason == "defense" || e.reason == "normal") {
                        if (e.index) {
                            if (player.tailIndex != e.id && player.tails[e.id]) {
                                storeEquip(e.id, 1);
                                break;
                            } else if (!player.tails[e.id] && player.tailIndex != 0) {
                                storeEquip(0, 1);
                                break;
                            }
                        } else {
                            if (player.skinIndex != e.id && player.skins[e.id]) {
                                storeEquip(e.id);
                                break;
                            }
                        }
                    }
                }
            }
        }
        storeQueue = [];
    }
    function doPathFind(player, target) {
        const block = 30;
        class Node {
            constructor(x, y, gScore) {
                this.x = x;
                this.y = y;
                this.g = gScore;
                this.type = calculateNodeType(x, y);
            }
        }
        const centerX = player.x + (target[0] - player.x) / 2;
        const centerY = player.y + (target[1] - player.y) / 2;
        const nearBuilds = gameObjects.filter(obj => Math.hypot(obj.y - centerY, obj.x - centerX) < 500);
        function calculateNodeType(x, y) {
            return nearBuilds.some(obj => {
                const exactScale = (obj.name && obj.name.includes("spike") && player.sid != obj.owner.sid && !isAlly(obj.owner.sid)) ? (obj.scale + 50) : obj.scale;
                if (obj.name === "pit trap" && obj.owner && (player.sid === obj.owner.sid || isAlly(obj.owner.sid))) {
                    return false;
                }
                if (Math.hypot(obj.y - y, obj.x - x) < exactScale + block &&
                    Math.hypot(obj.y - target[1], obj.x - target[0]) > exactScale + block &&
                    Math.hypot(obj.y - player.y2, obj.x - player.x2) > exactScale + block) {
                    return true;
                }
                return false;
            }) ? "wall" : "space";
        }
        const myNode = new Node(Math.round(player.x2 / block) * block, Math.round(player.y2 / block) * block, 0);
        const targetNode = new Node(Math.round(target[0] / block) * block, Math.round(target[1] / block) * block, 0);
        const paths = [];
        const foundset = [];
        let currentTick = 0;
        const endTick = 100;
        let found = true;
        function positive(num) {
            return Math.abs(num);
        }
        while (!foundset.find(node => Math.hypot(node.y - targetNode.y, node.x - targetNode.x) < block)) {
            currentTick++;
            if (currentTick >= endTick) {
                found = false;
                break;
            }
            const bestNode = currentTick === 1 ? myNode : foundset.filter(node => node.type === "space").sort((a, b) => a.good - b.good)[0];
            for (let i = 0; i < 3; i++) {
                for (let o = 0; o < 3; o++) {
                    if (i === 1 && o === 1) {
                        continue;
                    }
                    if (bestNode == null || bestNode == undefined) return false;
                    const x = bestNode.x + block * (-1 + i);
                    const y = bestNode.y + block * (-1 + o);
                    const newNode = new Node(x, y, currentTick);
                    newNode.good = (positive(newNode.x - targetNode.x) + positive(newNode.y - targetNode.y) / block) - currentTick;
                    foundset.push(newNode);
                }
            }
            paths.push(bestNode);
        }
        return found ? paths : false;
    }
    function pickBetterValue(value1, value2) {
        if (value1 == undefined || value1 == null) {
            return value2;
        }
        return value1;
    }
    function canReverseSpikeTick() {
        if (!toggles.reverseSpikeTick()) return false;
        if (!toggles.autoreplace()) return false;
        if (player.primary.dmg <= 35) return false;
        if (isPushing) return false;
        let trap = enemies.closest.trap;
        let hammer = items.weapons[10];
        if (dist2(trap, player) - 50 <= hammer.range) {
            let angles = placer.getAngles(trap);
            if (angles.length) {
                let ang = null;
                let spike = items.list[player.items[2]];
                let spikeScale = spike.scale + (spike.placeOffset || 0);
                for (let i = 0; i < angles.length; i++) {
                    let angleData = angles[i];
                    if (angleData.spike) {
                        let tmp = placer.calculatePosition(angleData.angle, spikeScale);
                        if (dist2(tmp, enemies.closest) < 35 + spike.scale) {
                            ang = angleData.angle;
                            break;
                        }
                    }
                }
                if (ang != null) {
                    let dmg = player.secondary.dmg * 7.5;
                    if (player.skins[7] && autoaim == false && player.secondary.reload == 1 && player.primary.reload == 1 && player.tailIndex != 11) {
                        if (trap.currentHealth - dmg <= 0 && player.turret == 1 && player.skins[53]) {
                            placer.reverseSpikeTick = "turret";
                            return true;
                        } else if (trap.currentHealth - (dmg * 3.3) <= 0 && player.skins[40]) {
                            placer.reverseSpikeTick = "normal";
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
        return false;
    }
    function updatePlayers(data) {
        tick++;
        enemies.all = [];
        enemies.closest = null;
        enemies.near = [];
        enemies.angle = null;
        var tmpTime = Date.now();
        for (var i = 0; i < players.length; ++i) {
            if (document.getElementById("enemyradar" + players[i].sid)) {
                document.getElementById("enemyradar" + players[i].sid).style.display = "none";
            }
            players[i].forcePos = !players[i].visible;
            players[i].visible = false;
        }
        for (var i = 0; i < data.length + extraProcessData.length;) {
            let tmpData = data[i] || extraProcessData[i - data.length];
            let tmpObj = findPlayerBySID(tmpData);
            if (tmpObj && tmpObj.updatedTick !== tick) {
                tmpObj.updatedTick = tick;
                tmpObj.t1 = (tmpObj.t2 === undefined) ? tmpTime : tmpObj.t2;
                tmpObj.t2 = tmpTime;
                tmpObj.x1 = tmpObj.x;
                tmpObj.y1 = tmpObj.y;
                tmpObj.lastX = tmpObj.x2;
                tmpObj.lastY = tmpObj.y2;
                tmpObj.x2 = pickBetterValue(data[i + 1], extraProcessData[(i - data.length) + 1]);
                tmpObj.y2 = pickBetterValue(data[i + 2], extraProcessData[(i - data.length) + 2]);
                tmpObj.d1 = (tmpObj.d2 === undefined) ? (pickBetterValue(data[i + 3], extraProcessData[(i - data.length) + 3])) : tmpObj.d2;
                tmpObj.d2 = pickBetterValue(data[i + 3], extraProcessData[(i - data.length) + 3]);
                tmpObj.dt = 0;
                tmpObj.buildIndex = pickBetterValue(data[i + 4], extraProcessData[(i - data.length) + 4]);
                tmpObj.weaponIndex = pickBetterValue(data[i + 5], extraProcessData[(i - data.length) + 5]);
                tmpObj.weaponVariant = pickBetterValue(data[i + 6], extraProcessData[(i - data.length) + 6]);
                tmpObj.team = pickBetterValue(data[i + 7], extraProcessData[(i - data.length) + 7]);
                tmpObj.isLeader = pickBetterValue(data[i + 8], extraProcessData[(i - data.length) + 8]);
                tmpObj.skinIndex = pickBetterValue(data[i + 9], extraProcessData[(i - data.length) + 9]);
                tmpObj.tailIndex = pickBetterValue(data[i + 10], extraProcessData[(i - data.length) + 10]);
                tmpObj.iconIndex = pickBetterValue(data[i + 11], extraProcessData[(i - data.length) + 11]);
                tmpObj.zIndex = pickBetterValue(data[i + 12], extraProcessData[(i - data.length) + 12]);
                tmpObj.visible = true;
                if (data[i]) {
                    tmpObj.tracker = false;
                    setTrapData(tmpObj);
                    tmpObj.velX = tmpObj.x2 * 2 - tmpObj.lastX;
                    tmpObj.velY = tmpObj.y2 * 2 - tmpObj.lastY;
                    if (tmpObj.sid == player.sid) {
                        updateCursorLocation();
                        if (tmpObj.weaponIndex < 9) {
                            if (player.primary.xp < config.weaponVariants[tmpObj.weaponVariant].xp) {
                                player.primary.xp = config.weaponVariants[tmpObj.weaponVariant].xp;
                            }
                        } else {
                            if (player.secondary.xp < config.weaponVariants[tmpObj.weaponVariant].xp) {
                                player.secondary.xp = config.weaponVariants[tmpObj.weaponVariant].xp;
                            }
                        }
                        for (let i = 0; i < player.items.length; i++) {
                            player.itemsInfo[i] = items.list[player.items[i]];
                        }
                        for (let i = 0; i < breakMarker.length; i++) {
                            if (breakMarker[i] && dist2(breakMarker[i], player) <= 600) {
                                breakMarker.splice(i, 1);
                            }
                        }
                    } else if (!(tmpObj == player || tmpObj.team && tmpObj.team == player.team)) {
                        drawTracer(tmpObj);
                        enemies.all.push(tmpObj);//more than 63 because calulating the exact range is too risky for something like antiinsta
                        if (dist2(tmpObj, player) - 102 <= items.weapons[tmpObj.primary.id || 5].range || dist2({ x: tmpObj.velx, y: tmpObj.vely }, player) - 102 <= items.weapons[tmpObj.primary.id || 5].range) {
                            enemies.near.push(tmpObj);
                        }
                        if (tmpObj.weaponIndex < 9 && tmpObj.secondary.id != 13 && tmpObj.secondary.id != 10 && tmpObj.secondary.id != 14 && tmpObj.secondary.id != 15 && tmpObj.spikeType.id != 9) {
                            tmpObj.secondary.id = 15;//anti polearm bow -> polearm musket
                            tmpObj.secondary.reload = 1;
                            tmpObj.secondary.dmg = 50;
                        }
                    }
                    namesBySid[tmpObj.sid] = tmpObj.name;
                    let weapon = items.weapons[tmpObj.weaponIndex];
                    if (tmpObj.weaponIndex < 9) {
                        if (tmpObj.primary.id == tmpObj.weaponIndex) {
                            tmpObj.primary.variant = tmpObj.weaponVariant;
                            tmpObj.primary.dmg = weapon.dmg * window.variantMulti(tmpObj.weaponVariant);
                            if (tmpObj.buildIndex == -1) {
                                tmpObj.primary.reload = Math.min(tmpObj.primary.reload + config.serverUpdateSpeed / (weapon.speed * (tmpObj.primary.fastReload == true ? .78 : 1)), 1);
                                if (tmpObj.primary.fastReload == true && tmpObj.primary.reload == 1) {
                                    tmpObj.primary.fastReload = false;
                                }
                            }
                        } else {
                            tmpObj.primary.id = tmpObj.weaponIndex;
                            tmpObj.primary.xp = 0;
                            if (tmpObj.secondary.id != 10 && tmpObj.secondary.id != 14 && tmpObj.secondary.id != 11) {
                                tmpObj.secondary.id = 15;
                                tmpObj.secondary.dmg = 50;
                            }
                        }
                    } else {
                        if (tmpObj.weaponIndex != 9) {
                            tmpObj.bowInstaThreat = false;
                        }
                        if (tmpObj.secondary.id == tmpObj.weaponIndex) {
                            tmpObj.secondary.variant = tmpObj.weaponVariant;
                            if (tmpObj.weaponIndex == 10) {
                                tmpObj.secondary.dmg = weapon.dmg * window.variantMulti(tmpObj.weaponVariant);
                            } else tmpObj.secondary.dmg = weapon.dmg;
                            if (tmpObj.buildIndex == -1) {
                                tmpObj.secondary.reload = Math.min(tmpObj.secondary.reload + config.serverUpdateSpeed / (weapon.speed * (tmpObj.secondary.fastReload == true ? .78 : 1)), 1);
                                if (tmpObj.secondary.fastReload == true && tmpObj.secondary.reload == 1) {
                                    tmpObj.secondary.fastReload = false;
                                }
                            }
                        } else {
                            tmpObj.secondary.id = tmpObj.weaponIndex;
                            tmpObj.secondary.xp = 0;
                            if (!tmpObj.primary.id) {
                                tmpObj.primary.id = 5;
                                tmpObj.primary.variant = 3;
                                tmpObj.primary.reload = 1;
                                tmpObj.primary.dmg = 53;
                            }
                        }
                    }
                    tmpObj.turret = Math.min(tmpObj.turret + 0.0444, 1);
                } else {
                    tmpObj.tracker = true;
                }
            }
            i += 13;
        }
        extraProcessData = [];
        if (player.weapons[0] != null && player.primary.id != player.weapons[0]) {
            player.primary.id = player.weapons[0];
            player.primary.xp = 0;
        }
        if (player.weapons[1] != null && player.secondary.id != player.weapons[1]) {
            player.secondary.id = player.weapons[1];
            player.secondary.xp = 0;
        }
        if (enemies.all.length) {
            enemies.all = enemies.all.sort((a, b) => dist2(a, player) - dist2(b, player));
            enemies.closest = enemies.all[0];
        }
        if (enemies.closest) {
            enemies.angle = Math.atan2(enemies.closest.y2 - player.y2, enemies.closest.x2 - player.x2);
            enemies.lastDist = enemies.dist;
            enemies.dist = dist2(enemies.closest, player);
        } else {
            enemies.lastDist = 4000;
            enemies.dist = 4000;
            enemies.angle = 0;
        }
        if (waitTicks.length) {
            waitTicks.forEach(e => e());
            waitTicks = [];
        }
        if (queueTick[tick]) {
            queueTick[tick].forEach(e => e());
        }
        placer.macro();
        healing();
        if (healingTick > 0) {
            healingTick--;
            if (healingTick == 0 && player.health > 0) {
                heal(100 - player.health);
            }
        }
        if (Math.sqrt(Math.pow((millY - player.y), 2) + Math.pow((millX - player.x), 2)) > 99) {
            if (autoMills && (player.itemCounts[3] < (isSandbox ? 299 : 99) || !player.itemCounts[3])) {
                placer.checkPlace(player.items[3], lastMoveDir + Math.PI);
                placer.checkPlace(player.items[3], lastMoveDir - 1.20427718 + Math.PI);
                placer.checkPlace(player.items[3], lastMoveDir + 1.20427718 + Math.PI);
            } else if (!(player.itemCounts[3] < 99 || !player.itemCounts[3])) {
                autoMills = false;
            }
            millX = player.x;
            millY = player.y;
        }
        let scaledObjects = [];
        turrets = 0;
        closeObjects = [];
        for (let i = 0; i < gameObjects.length; i++) {
            let object = gameObjects[i];
            if (!object.active) {
                gameObjects.splice(i, 1);
            } else if (object) {
                let distance = Math.hypot(object.y - player.y2, object.x - player.x2);
                if ((object.dmg || object.trap) && object.owner.sid == player.sid) {
                    scaledObjects.push({
                        dmg: object.dmg,
                        trap: object.trap,
                        scale: object.scale,
                        ownerSID: object.owner.sid,
                        x: object.x,
                        y: object.y
                    });
                }
                if (distance <= 700) {
                    closeObjects.push(object);
                }
                if (object.name == "turret") {
                    if (object.shotted) {
                        object.shotted = 0;
                        object.reload = 0;
                    } else {
                        if (object.reload < 1) {
                            object.reload = Math.min(1, object.reload + 0.0504545455);
                            if (object.reload >= 0.95) {
                                object.reload = -0.0504545455;
                                if (player.sid != object.owner.sid && !isAlly(object.owner.sid) && distance <= 735 && toggles.autoemp()) {
                                    turrets++;
                                }
                            }
                        }
                    }
                }
            }
        }
        for (let i = 0; i < bots.length; i++) {
            if (bots[i] && bots[i].socket && bots[i].socket.readyState == 1 && !bots[i].CLOSED) {
                bots[i].socket.send(JSON.stringify({
                    type: "setOwnerData",
                    data: {
                        owner: freeCam.status && movementType != "normal" ? {
                            x: freeCam.x,
                            y: freeCam.y,
                            x2: freeCam.x,
                            y2: freeCam.y,
                            realLocation: {
                                x: player.x2,
                                y: player.y2
                            },
                            botSids: [...botSids],
                            scale: 35,
                            sid: player.sid
                        } : player,
                        enemy: enemies.closest,
                        allies: alliancePlayers,
                        gameObjects: scaledObjects
                    },
                }));
            }
        }
        if (!player.team && alliancePlayers.length) {
            alliancePlayers = [];
        }
        placer.autoplace();
        spikeSoldier = false;
        let preferedMovementDir = "LMAOOOO";
        let spikeMovement = false;
        if (!player.trap && enemies.all.length) {
            let knockback = getLocationAfterKnock(player, Math.atan2(player.y2 - enemies.closest.y2, player.x2 - enemies.closest.x2), items.weapons[enemies.closest.primary.id].knock, true);
            if (enemies.near.length && enemies.closest.primary.reload + (config.serverUpdateSpeed / items.weapons[enemies.closest.weaponIndex].speed) >= 1) {
                for (let i = 0; i < closeObjects.length; i++) {
                    let _ = closeObjects[i];
                    let distance = dist2(_, player);
                    if (_ && (_.dmg && _.owner.sid != player.sid && !isAlly(_.owner.sid)) || (_.type == 1 && _.y >= 12000)) {
                        let velDistance = dist2(_, { x: knockback.x, y: knockback.y });
                        let subDist = velDistance - distance;
                        for (let times = 1; times <= 5; times++) {
                            let div = (subDist / 5) * times;
                            if ((distance + div) <= 35 + _.scale) {
                                spikeSoldier = true;
                                break;
                            }
                        }
                        if (spikeSoldier) break;
                    }
                }
            }
            for (let i = 0; i < closeObjects.length; i++) {
                let _ = closeObjects[i];
                let distance = dist2(_, player);
                if (_ && (_.dmg && _.owner.sid != player.sid && !isAlly(_.owner.sid)) || (_.type == 1 && _.y >= 12000)) {
                    let velDistance = dist2(_, { x: player.velX, y: player.velY });
                    let subDist = velDistance - distance;
                    for (let times = 1; times <= 5; times++) {
                        let div = (subDist / 5) * times;
                        let d = (distance + div);
                        if (d <= 35 + _.scale + 12) {
                            preferedMovementDir = Math.atan2(player.y2 - _.y, player.x2 - _.x);
                            if (d <= 35 + _.scale) {
                                if (!(_.type == 1 && _.y >= 12000)) spikeMovement = _;
                                spikeSoldier = true;
                            }
                            break;
                        }
                    }
                    if (spikeSoldier) break;
                }
            }
        }
        if (spikeSoldier == true) {
            storeEquip(6);
        }
        if (toggles.antibull() && enemies.closest && !canGetSpikeTicked() && player.skins[11] && player.tails[21]) {
            antiBullHit.canDo = false;
            if (antiBullHit.checker && enemies.all.find(e => antiBullHit.checker.object == e.sid)) {
                antiBullHit.canDo = {
                    status: true,
                    overPre: antiBullHit.checker.overPre
                };
            }
            antiBullHit.checker = false;
            let enemy = enemies.closest;
            let weapon = items.weapons[enemy.primary.id];
            if (enemy.weaponIndex < 9 && enemy.weaponIndex != 7 && dist2(enemy, player) - 63 < weapon.range) {
                if (enemy.primary.reload + (config.serverUpdateSpeed / weapon.speed) * 2 >= 1 && enemy.primary.reload + (config.serverUpdateSpeed / weapon.speed) <= (enemy.primary.id == 5 ? 1.15 : 1.2)) {
                    antiBullHit.checker = {
                        object: enemy.sid,
                        overPre: !(enemy.primary.reload + (config.serverUpdateSpeed / weapon.speed) >= 1)
                    };
                }
            }
        } else {
            antiBullHit.canDo = false;
            antiBullHit.checker = false;
        }
        if (enemies.closest && (antiBullHit.canDo ? (!antiBullHit.canDo.overPre && player.skins[11] && player.tails[21]) : true) && insta.oneShot == true && hitting == false && enemies.dist - 63 < items.weapons[player.weapons[0]].range) {
            if (player.weapons[1] == 10) {
                if (enemies.dist < 130 && getTotalInstaDmg(false, enemies.closest) >= 100) {
                    insta.do("reverse");
                }
            } else if (!isBlocked(player, enemies.closest)) {
                if (getTotalInstaDmg(false, enemies.closest) >= 100 && (player.weapons[1] == 9 || player.weapons[1] == 12 || player.weapons[1] == 13)) {
                    insta.do("reverse");
                } else {
                    if (enemies.closest.skinIndex == 11) {
                        if (getTotalInstaDmg(false, enemies.closest) >= 100) {
                            insta.do("reverse");
                        }
                    } else if (getTotalInstaDmg(true, enemies.closest) >= 100) {
                        insta.do("nobull");
                    } else if (getTotalInstaDmg(false, enemies.closest) >= 100) {
                        insta.do("normal");
                    }
                }
            }
        }
        canAntiBull = false;
        if (toggles.autopush() && enemies.closest && enemies.near.length < 3 && !SHIFTHOLD && !spikeMovement) {
            let enemy = enemies.closest;
            if (enemy.trap && dist2(enemy, player) <= 300) {
                let items = closeObjects.filter(e => {
                    if (e.dmg) {
                        if ((e.owner.sid == player.sid || isAlly(e.owner.sid)) && dist2(e, enemy.trap) <= 75 + e.scale) {
                            return true;
                        } else {
                            return false
                        }
                    } else if (e.type == 1 && e.y >= 12000) {
                        if (dist2(e, enemy.trap) <= 75 + e.scale) {
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                });
                let push = function (tmp, closest) {
                    if (!gameObjects.find(e => e && !e.ignoreCollision && e.sid != closest.sid && dist2(tmp, e) <= e.scale - 9)) {
                        if (dist2(enemy, player) > 90) {
                            let path = doPathFind(player, [tmp.x, tmp.y]);
                            if (path && path.length > 1) {
                                isPushing = {
                                    first: tmp,
                                    last: closest
                                };
                                isPushing.path = path;
                                preferedMovementDir = Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x);
                            } else {
                                if (dist2(tmp, player) <= 75) {
                                    isPushing = {
                                        first: tmp,
                                        last: closest
                                    };
                                    preferedMovementDir = Math.atan2(tmp.y - player.y2, tmp.x - player.x2);
                                } else {
                                    if (isPushing) {
                                        isPushing = false;
                                        preferedMovementDir = null;
                                    }
                                }
                            }
                        } else {
                            isPushing = {
                                first: tmp,
                                last: closest
                            };
                            preferedMovementDir = Math.atan2(tmp.y - player.y2, tmp.x - player.x2);
                        }
                    } else {
                        if (isPushing) {
                            isPushing = false;
                            preferedMovementDir = null;
                        }
                    }
                };
                if (items.length) {
                    let closest = items.sort((a, b) => b.currentHealth - a.currentHealth).sort((a, b) => dist2(a, enemy) - dist2(b, enemy));
                    if (items.length == 1) {
                        closest = closest[0];
                    } else {
                        let spike1 = closest[0];
                        let spike2 = closest.filter(e => e.sid != spike1.sid).sort((a, b) => dist2(a, spike1) - dist2(b, spike1))[0];
                        let midPoint = UTILS.findMiddlePoint(spike1, spike2);
                        if (dist2(midPoint, spike1) <= 32 + spike1.scale && dist2(midPoint, spike2) <= 32 + spike2.scale) {
                            closest = {
                                x: midPoint.x,
                                y: midPoint.y
                            };
                        } else {
                            closest = closest[0];
                        }
                    }
                    if (closest) {
                        let angle = Math.atan2(enemy.y2 - closest.y, enemy.x2 - closest.x);
                        let addon = dist2(enemy, player) > 75 ? 60 : 50;
                        if (addon == 55 && UTILS.getAngleDist(enemies.angle, angle + Math.PI) > Math.PI / 1.5) {
                            addon = 70;
                        }
                        let distance = dist2(closest, enemy) + addon;
                        if (closest.dmg && distance <= 35 * 3 + closest.scale) {
                            distance = dist2(closest, enemy) + 60;
                        }
                        let tmp = {
                            x: closest.x + Math.cos(angle) * distance,
                            y: closest.y + Math.sin(angle) * distance
                        };
                        push(tmp, closest);
                    } else {
                        if (isPushing) {
                            isPushing = false;
                            preferedMovementDir = null;
                        }
                    }
                } else {
                    if (isPushing) {
                        isPushing = false;
                        preferedMovementDir = null;
                    }
                }
            } else {
                if (isPushing) {
                    isPushing = false;
                    preferedMovementDir = null;
                }
            }
        } else {
            if (isPushing) {
                isPushing = false;
            }
        }
        tankTarget = null;
        if (autoaim == true) {
            hitting = true;
        } else {
            let weapon = (player.weapons[1] == 10 ? 10 : player.weapons[0]);
            if (toggles.autobreak() && player.trap && !attackState) {
                scriptStatus = "autobreaking";
                let isWeaponTenOptimal = weapon === 10 && items.weapons[player.weapons[0]].speed <= 300 && player.primary.reload === 1;
                if (isWeaponTenOptimal && player.trap.currentHealth - player.primary.dmg <= 0) {
                    weapon = player.weapons[0];
                }
                let spikes = closeObjects.filter(e => e.dmg && e.owner.sid !== player.sid && !isAlly(e.owner.sid));
                let nearest = spikes.length > 0 ? spikes.reduce((a, b) => dist2(a, player) < dist2(b, player) ? a : b) : null;
                let isSpikeClose = false;
                let spikeDist = dist2(nearest, player) - (nearest ? nearest.scale : 0);
                let weaponRange = items.weapons[weapon].range + 5;
                if (nearest && weapon == 10 && !SHIFTHOLD && spikeDist <= weaponRange) {
                    if (spikeDist <= weaponRange - 5) {
                        isSpikeClose = true;
                    } else if (player.velX != player.x2 || player.velY != player.y2) {
                        isSpikeClose = true;
                    }
                }
                trapAngle = isSpikeClose ? Math.atan2(nearest.y - player.y2, nearest.x - player.x2) : Math.atan2(player.trap.y - player.y2, player.trap.x - player.x2);
                if (isWeaponTenOptimal && isSpikeClose && nearest.currentHealth - player.primary.dmg <= 0) {
                    weapon = player.weapons[0];
                }
                if (player.weaponIndex != weapon) selectToBuild(weapon, true);
                if ((weapon == 10 ? player.secondary.reload == 1 : player.primary.reload == 1)) {
                    storeQueue.push({
                        id: 40,
                        reason: "tankHit"
                    });
                    io.send("d", 1, trapAngle);
                    io.send("d", 0, trapAngle);
                    hitting = true;
                } else {
                    if (canBullTick() && player.skins[7]) {
                        needTick++;
                        storeQueue.push({
                            id: 22,
                            reason: "bull tick"
                        });
                    } else {
                        if (turrets) {
                            storeEquip(22);
                        } else if (enemies.closest) {
                            if (spikes.find(e => dist2(e, player) <= 150) || enemies.near.length) {
                                storeQueue.push({
                                    id: 6,
                                    reason: "defense"
                                });
                            } else {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            }
                        } else {
                            biomeHats("no acc");
                        }
                    }
                    hitting = false;
                }
                isPushing = false;
            } else {
                let autoHit = needAutoHit();
                if (weapon == 10 && enemies.closest && enemies.closest.trap && canReverseSpikeTick()) {
                    console.log(placer.reverseSpikeTick);
                    let trap = enemies.closest.trap;
                    if (player.weaponIndex != weapon) selectToBuild(10, true);
                    storeQueue.push({
                        id: placer.reverseSpikeTick == "turret" ? 53 : 40,
                        reason: placer.reverseSpikeTick == "turret" ? "defense" : "tankHit"
                    });
                    let angle = Math.atan2(trap.y - player.y2, trap.x - player.x2);
                    io.send("d", 1, angle);
                    io.send("d", 0, angle);
                    hitting = true;
                } else if (autoHit) {
                    hitting = true;
                } else if (tankSpam) {
                    let enemySpikes = closeObjects.filter(e => e.dmg && e.owner.sid != player.sid && !isAlly(e.owner.sid) && dist2(e, player) - e.scale <= items.weapons[player.weaponIndex].range);
                    if (enemySpikes.length == 1) {
                        scriptStatus = "tankspam2";
                        tankAim = Math.atan2(enemySpikes[0].y - player.y2, enemySpikes[0].x - player.x2);
                    } else {
                        scriptStatus = "tankspam";
                        tankAim = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
                    }
                    if (player.weaponIndex != weapon) selectToBuild(weapon, true);
                    if ((weapon == player.weapons[1] ? player.secondary.reload == 1 : player.primary.reload == 1)) {
                        storeQueue.push({
                            id: 40,
                            reason: "tankHit"
                        });
                        io.send("d", 1, tankAim);
                        io.send("d", 0, tankAim);
                        hitting = true;
                    } else {
                        if (canBullTick() && player.skins[7]) {
                            needTick++;
                            storeQueue.push({
                                id: 7,
                                reason: "bull tick"
                            });
                        } else {
                            if (turrets) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            } else if (enemies.near.length) {
                                storeQueue.push({
                                    id: 6,
                                    reason: "defense"
                                });
                            } else if (lastMoveDir == null) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            } else {
                                biomeHats();
                            }
                        }
                        hitting = false;
                    }
                    storeQueue.push({
                        id: 11,
                        index: true,
                        reason: "normal"
                    });
                } else if (toggles.autogrind()) {
                    storeQueue.push({
                        id: 40,
                        reason: "defense"
                    });
                    if ((player.weaponIndex > 9 ? player.secondary.reload == 1 : player.primary.reload == 1)) {
                        io.send("d", 1, Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2)));
                        io.send("d", 0, Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2)));
                        hitting = true;
                    } else {
                        hitting = false;
                    }
                } else if (bowSpam == true) {
                    scriptStatus = "bowSpam";
                    if (player.weaponIndex != player.weapons[1]) selectToBuild(player.weapons[1], true);
                    if (player.secondary.reload == 1) {
                        storeQueue.push({
                            id: canBullTick() && player.skins[7] ? 7 : 20,
                            reason: canBullTick() && player.skins[7] ? "bull tick" : "defense"
                        });
                        io.send("d", 1, enemies.angle);
                        io.send("d", 0, enemies.angle);
                        if ([15, 12, 13, 14].includes(player.weapons[1])) {
                            player.secondary.reload = -config.serverUpdateSpeed / items.weapons[player.weapons[1]].speed;
                        }
                        hitting = true;
                    } else {
                        if (canBullTick() && player.skins[7]) {
                            needTick++;
                            storeQueue.push({
                                id: 7,
                                reason: "bull tick"
                            });
                        } else {
                            if (turrets) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            } else if (enemies.near.length) {
                                storeQueue.push({
                                    id: 6,
                                    reason: "defense"
                                });
                            } else if (lastMoveDir == null) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            } else {
                                biomeHats();
                            }
                        }
                        hitting = false;
                    }
                    storeQueue.push({
                        id: 11,
                        index: true,
                        reason: "normal"
                    });
                } else if (moveTicking == "normal" && enemies.closest && Date.now() - lastTickTime >= 1000) {//} && player.primary.variant >= 2) {
                    let calDist = Math.abs(enemies.dist - 233);
                    if (calDist < 5 && player.tailIndex != 11) {
                        if (player.primary.reload == 1 && player.turret == 1 && enemies.closest.skinIndex != 6 && enemies.closest.skinIndex != 22 && !isBlocked(player, enemies.closest)) {
                            lastTickTime = Date.now();
                            insta.do("onetick");
                        } else {
                            preferedMovementDir = null;
                        }
                    } else {
                        if (player.weaponIndex < 9 && player.weapons[1] == 10) {
                            selectToBuild(player.weapons[1], true);
                        }
                        storeQueue.push({
                            id: calDist < 40 ? 40 : 6,
                            reason: "defense"
                        });
                        storeQueue.push({
                            id: calDist < 20 ? 19 : 11,
                            index: true,
                            reason: "defense"
                        });
                        preferedMovementDir = enemies.dist > 233 ? enemies.angle : enemies.angle + Math.PI;
                    }
                } else if (enemies.closest && toggles.autoOneTick() && Math.abs(enemies.dist - 233) <= 20 && player.weapons[0] == 5 && player.primary.variant >= 2 && player.primary.reload == 1 && player.turret == 1 && enemies.closest.skinIndex != 6 && enemies.closest.skinIndex != 22 && !isBlocked(player, enemies.closest, 35)) {
                    let calDist = Math.abs(enemies.dist - 233);
                    if (calDist < 5 && player.tailIndex != 11) {
                        lastTickTime = Date.now();
                        insta.do("onetick");
                    } else {
                        if (player.weaponIndex < 9 && player.weapons[1] == 10) {
                            selectToBuild(player.weapons[1], true);
                        }
                        storeQueue.push({
                            id: calDist < 40 ? 40 : 6,
                            reason: "defense"
                        });
                        storeQueue.push({
                            id: calDist < 20 ? 19 : 11,
                            index: true,
                            reason: "defense"
                        });
                        preferedMovementDir = enemies.dist > 233 ? enemies.angle : enemies.angle + Math.PI;
                    }
                } else if (enemies.closest && oneTickBowInsta == true) {
                    if (player.age < 9 || player.weapons[1] != 9) {
                        oneTickBowInsta = false;
                    } else {
                        if (enemies.dist > 680 && enemies.dist < 685) {
                            preferedMovementDir = null;
                            if (player.secondary.reload == 1 && player.turret == 1 && (player.items[5] == 18 ? true : !isBlocked(player, enemies.closest))) {
                                oneTickBowInsta = false;
                                if (player.items[5] == 18) {
                                    placer.place(player.items[5], enemies.angle);
                                }
                                insta.do("bow");
                            } else {
                                oneTickBowInsta = false;
                            }
                        } else {
                            if (enemies.dist > 640 && enemies.dist < 725) {
                                storeQueue.push({
                                    id: 40,
                                    reason: "defense"
                                });
                            } else {
                                storeQueue.push({
                                    id: 6,
                                    reason: "defense"
                                });
                            }
                            if (enemies.dist > 660 && enemies.dist < 705) {
                                storeQueue.push({
                                    id: 0,
                                    index: true,
                                    reason: "defense"
                                });
                            } else {
                                storeQueue.push({
                                    id: 11,
                                    index: true,
                                    reason: "defense"
                                });
                            }
                            preferedMovementDir = enemies.dist > 682 ? enemies.angle : enemies.angle + Math.PI;
                        }
                    }
                } else if (enemies.closest && antiBullHit.canDo && !antiBullHit.canDo.overPre && player.skins[11] && player.tails[21]) {
                    storeQueue.push({
                        id: 11,
                        reason: "antibull"
                    });
                    canAntiBull = true;
                } else if ((enemies.closest && toggles.autobullspam() && enemies.dist - 63 < items.weapons[player.weapons[0]].range && insta.oneShot == false && player.secondary.reload == 1) || attackState) {
                    scriptStatus = "auto bull spam";
                    let shameNum = parseInt(document.getElementById("instaOnValue").value);
                    if (toggles.instaOnToggle() && enemies.closest && enemies.closest.shameCount == shameNum && enemies.dist - 63 < items.weapons[player.weapons[0]].range && player.primary.reload == 1 && player.weapons[1] == 15 && player.secondary.reload == 1 && !isBlocked(player, enemies.closest)) {
                        insta.do("normal");
                    } else {
                        if (player.weaponIndex != player.weapons[0]) selectToBuild(player.weapons[0], true);
                        if (player.tailIndex != 11 && player.primary.reload == 1) {
                            if (enemies.closest && enemies.closest.skinIndex == 11) {
                                storeQueue.push({
                                    id: 6,
                                    reason: "defense"
                                });
                            } else {
                                storeQueue.push({
                                    id: 7,
                                    reason: "bull tick"
                                });
                            }
                            let angle = enemies.angle;
                            if (!enemies.closest) {
                                angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2))
                            }
                            io.send("d", 1, angle);
                            io.send("d", 0, angle);
                            hitting = true;
                        } else {
                            if (canBullTick() && player.skins[7]) {
                                needTick++;
                                storeQueue.push({
                                    id: 7,
                                    reason: "bull tick"
                                });
                            } else {
                                if (turrets) {
                                    storeQueue.push({
                                        id: 22,
                                        reason: "defense"
                                    });
                                } else if (enemies.near.length) {
                                    storeQueue.push({
                                        id: 6,
                                        reason: "defense"
                                    });
                                } else {
                                    biomeHats("no acc");
                                }
                            }
                            storeQueue.push({
                                id: 19,
                                index: true,
                                reason: "defense"
                            });
                            hitting = false;
                        }
                    }
                } else if (toggles.autoTankHit() && weapon == 10 && autoTankHit(enemies.closest, spikeMovement)) {
                    scriptStatus = "auto tank spam";
                    tankTargetAngle = Math.atan2(tankTarget.y - player.y2, tankTarget.x - player.x2);
                    if (player.weaponIndex != weapon) selectToBuild(weapon, true);
                    if (player.secondary.reload == 1) {
                        storeQueue.push({
                            id: 40,
                            reason: "tankHit"
                        });
                        io.send("d", 1, tankTargetAngle);
                        io.send("d", 0, tankTargetAngle);
                        hitting = true;
                    } else {
                        if (canBullTick() && player.skins[7]) {
                            needTick++;
                            storeEquip(7);
                            storeEquip(11, 1);
                        } else {
                            if (turrets) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                                storeQueue.push({
                                    id: 11,
                                    index: true,
                                    reason: "normal"
                                });
                            } else if (enemies.near.length) {
                                storeQueue.push({
                                    id: 6,
                                    reason: "defense"
                                });
                                storeQueue.push({
                                    id: 11,
                                    index: true,
                                    reason: "normal"
                                });
                            } else if (lastMoveDir == null) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                                storeQueue.push({
                                    id: 11,
                                    index: true,
                                    reason: "normal"
                                });
                            } else {
                                biomeHats();
                            }
                        }
                        hitting = false;
                    }
                } else {
                    let canGST = canGetSpikeTicked();
                    scriptStatus = "none";
                    hitting = false;
                    autoSelect();
                    if (canBullTick() && player.skins[7]) {
                        needTick++;
                        storeQueue.push({
                            id: 7,
                            reason: "bull tick"
                        });
                    } else {
                        if (turrets && player.skins[22]) {
                            storeQueue.push({
                                id: 22,
                                reason: "turrets"
                            });
                            storeQueue.push({
                                id: 11,
                                index: true,
                                reason: "turrets"
                            });
                        } else if (enemies.closest) {
                            if (enemies.near.length && (player.y2 < 6850 || player.y2 > 7550)) {
                                if (!canGST) {
                                    if (isPushing && dist(enemies.closest, player) >= 100) {
                                        biomeHats(19);
                                    } else if (dist(enemies.closest, player) >= 12 && lastMoveDir != null) {
                                        biomeHats(19);
                                    } else {
                                        storeQueue.push({
                                            id: 6,
                                            reason: "defense"
                                        });
                                        storeQueue.push({
                                            id: 19,
                                            index: true,
                                            reason: "defense"
                                        });
                                    }
                                } else {
                                    storeQueue.push({
                                        id: 6,
                                        reason: "defense"
                                    });
                                    storeQueue.push({
                                        id: 19,
                                        index: true,
                                        reason: "defense"
                                    });
                                }
                            } else if (lastMoveDir == null) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            } else {
                                biomeHats();
                            }
                        } else {
                            if (turrets && player.skins[22]) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "turrets"
                                });
                                storeQueue.push({
                                    id: 11,
                                    index: true,
                                    reason: "turrets"
                                });
                            } else if (lastMoveDir == null) {
                                storeQueue.push({
                                    id: 22,
                                    reason: "defense"
                                });
                            } else {
                                biomeHats();
                            }
                        }
                    }
                }
            }
        }
        smartMovement(preferedMovementDir);
        skinTailManager();
        document.getElementById("weaponXP").innerHTML = `
        Pri XP: ${player.primary.xp}/${(config.weaponVariants[player.primary.variant + 1] ? config.weaponVariants[player.primary.variant + 1].xp : "Infinity")}<br>
        Sec XP: ${player.secondary.xp}/${(config.weaponVariants[player.secondary.variant + 1] ? config.weaponVariants[player.secondary.variant + 1].xp : "Infinity")}<br>
        `;
        for (let i = 0; i < players.length; i++) {
            let player = players[i];
            if (!player.visible) {
                player.primary.reload = 1;
                player.secondary.reload = 1;
                player.turret = 1;
            }
            if (player.damageData && player.damageData.length) {
                player.damageData = [];
            }
        }
        let element = (id) => { return document.getElementById(id); };
        let baseID = "upgradeItem";
        if (toggles.autoupgrade()) {
            if (element(baseID + "17")) {
                io.send("H", 17);
            } else if (element(baseID + "31")) {
                io.send("H", 31);
            } else if (element(baseID + "23")) {
                io.send("H", 23);
            } else if (element(baseID + element("7thSlot").value)) {
                io.send("H", parseInt(element("7thSlot").value));
            }
        }
        damageData.taken = [];
    }
    var placer = new (class {
        constructor() {
            this.broken = [];
            this.objectToIgnore = undefined;
            this.markers = [];
            this.lastFound = 0;
            this.angles = [];
        }
        place(id, angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2)), active) {
            let item = items.list[id];
            if (item && (player.itemCounts[item.group.id] + 1 < (isSandbox ? (item.group.sandboxLimit + 1 || 100) : item.group.limit) || !player.itemCounts[item.group.id])) {
                selectToBuild(id);
                io.send("d", 1, angle);
                selectToBuild(autoSecondary.status == true ? player.weapons[1] : autoPrimary.status == true ? player.weapons[0] : player.weaponIndex, true);
                if (id != player.items[0]) {
                    let scale = 35 + item.scale + (item.placeOffset || 0);
                    let tmpX = player.x2 + Math.cos(angle) * scale;
                    let tmpY = player.y2 + Math.sin(angle) * scale;
                    this.addMarker({
                        x: tmpX,
                        y: tmpY,
                        scale: item.scale,
                        name: item.name,
                        angle: angle,
                        id: item.id,
                        active: active
                    });
                }
            }
        }
        checkItemLocation(x, y, scale, scaleMulti, index, ignoreWater, placer) {
            const cantPlace = gameObjects.find(tmp => (placer ? tmp.sid != placer.sid : true) && UTILS.getDistance(x, y, tmp.x, tmp.y) < scale + (tmp.blocker ? tmp.blocker : tmp.getScale(scaleMulti, tmp.isItem)));
            if (cantPlace) {
                return false;
            }
            if (!ignoreWater && index !== 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) {
                return false;
            }
            return true;
        }
        replaceableDirection(obj) {
            let item = items.list[player.items[2]];
            let scale = 35 + item.scale + (item.placeOffset || 0);
            let angle = Math.atan2(obj.y - player.y2, obj.x - player.x2);
            let tmpX = player.x2 + Math.cos(angle) * scale;
            let tmpY = player.y2 + Math.sin(angle) * scale;
            if (checkItemLocation(tmpX, tmpY, item.scale, .6, player.items[2], false, obj)) {
                return true;
            }
            return false;
        }
        addMarker({ x, y, name, id, angle, scale, active }) {
            if (angle == undefined || angle == null || isNaN(angle)) angle = 0;
            this.markers.push({
                x: x,
                y: y,
                id: id,
                angle: angle || 0,
                name: name,
                owner: {
                    sid: player.sid,
                },
                scale: scale,
                notActive: !!active
            });
            setTickout(() => {
                this.markers.shift();
            }, 1);
        }
        checkForMarkers(x, y, scale) {
            for (let i = 0; i < this.markers.length; i++) {
                let marker = this.markers[i];
                if (!marker.isActive && dist2({ x: x, y: y }, marker) < marker.scale + scale) {
                    return true;
                }
            }
            return false;
        }
        checkPlace(id, angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2))) {
            let item = items.list[id];
            if (item) {
                let scale = 35 + item.scale + (item.placeOffset || 0);
                let tmpX = player.x2 + Math.cos(angle) * scale;
                let tmpY = player.y2 + Math.sin(angle) * scale;
                if (checkItemLocation(tmpX, tmpY, item.scale, 0.6, id, false, this.objectToIgnore) && !this.checkForMarkers(tmpX, tmpY, item.scale)) {
                    this.place(id, angle);
                }
            }
        }
        checkPlace2(id, angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2))) {
            let item = items.list[id];
            if (item) {
                let scale = 35 + item.scale + (item.placeOffset || 0);
                let tmpX = player.x2 + Math.cos(angle) * scale;
                let tmpY = player.y2 + Math.sin(angle) * scale;
                if (!this.checkForMarkers(tmpX, tmpY, item.scale)) {
                    this.place(id, angle);
                }
            }
        }
        macro() {
            if ("chatbox" == document.activeElement.id.toLowerCase()) return;
            let angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
            if (keyPressed[70]) {
                if (player.items[4]) {
                    this.checkPlace(player.items[4], angle);
                }
            }
            if (keyPressed[72]) {
                if (player.items[5]) {
                    this.checkPlace(player.items[5], angle);
                }
            }
            if (keyPressed[86]) {
                this.checkPlace(player.items[2], angle);
            }
            if (keyPressed[78]) {
                this.checkPlace(player.items[3], angle);
            }
        }
        getRandomAdjustment() {
            let random = UTILS.randInt(-22.5, 22.5);
            return (random / 180) * Math.PI;
        }
        getAngles(obj, hai) {
            let randomAdjustment = 0;
            if (hai) {
                randomAdjustment = this.getRandomAdjustment();
            }
            let angles = [];
            let angle = Math.PI / 20;
            for (let i = 0; i <= 40; i++) {
                let ang = (angle * i) + randomAdjustment;
                let data;
                if (player.items[4] == 15) {
                    let item = items.list[15];
                    let scale = 35 + item.scale + (item.placeOffset || 0);
                    let tmp = this.calculatePosition(ang, scale);
                    if (checkItemLocation(tmp.x, tmp.y, item.scale, .6, 15, false, (obj || this.objectToIgnore))) {
                        if (!data) data = {};
                        data.trap = true;
                        data.angle = ang;
                    }
                }
                let item = items.list[player.items[2]];
                let scale = 35 + item.scale + (item.placeOffset || 0);
                let tmp = this.calculatePosition(ang, scale);
                if (checkItemLocation(tmp.x, tmp.y, item.scale, .6, 15, false, (obj || this.objectToIgnore))) {
                    if (!data) data = {};
                    data.spike = true;
                    data.angle = ang;
                }
                if (data) {
                    angles.push(data);
                }
            }
            return angles;
        }
        autoplace() {
            if (tick % 2 != 0) return;
            if (player.health <= 0) return;
            if (!toggles.placeEveryTick()) return;
            if (toggles.autogrind()) return;
            if (!enemies.closest) return;
            if (autoMills) return;
            let distance = dist2(enemies.closest, player);
            if (player.items[4] == 15 && distance <= 400) {
                let enemyTrap = enemies.closest.trap;
                let possibleAngles = this.getAngles(undefined, (tick % 4 == 0 ? true : false));
                if (enemyTrap) {
                    if (distance <= 200) {
                        let nearSpike = closeObjects.find(e => e && e.dmg && dist2(enemyTrap, e) <= 85 + e.scale && (e.owner.sid == player.sid || isAlly(e.owner.sid)));
                        if (!nearSpike) {
                            let spikeScale = player.itemsInfo[2].scale;
                            let ang = Math.PI / 18;
                            let adjust = Math.atan2(player.y2 - enemyTrap.y, player.x2 - enemyTrap.y);
                            let locations = [];
                            for (let i = 0; i <= 18; i++) {
                                let angle = (i * ang) + adjust - (Math.PI / 2);
                                let tmp = this.calculatePosition(angle, 50 + spikeScale, enemyTrap);
                                if (dist2(tmp, player) > 35 && this.checkItemLocation(tmp.x, tmp.y, spikeScale, .6, false, false, this.objectToIgnore)) {
                                    locations.push(tmp);
                                }
                            }
                            if (locations.length) {
                                locations = locations.sort((a, b) => dist2(a, player) - dist2(b, player));
                                for (let i = 0; i < 2; i++) {
                                    let e = locations[i];
                                    if (e) {
                                        let corrected = this.correctAngle(Math.atan2(e.y - player.y2, e.x - player.x2), 2);
                                        if (corrected != "not found") {
                                            this.place(player.items[2], corrected);
                                        }
                                    }
                                }
                            }
                        }
                        for (let i = 0; i < possibleAngles.length; i++) {
                            let angleData = possibleAngles[i];
                            if (angleData && angleData.trap) {
                                this.checkPlace2(player.items[4], angleData.angle);
                            }
                        }
                    } else {
                        for (let i = 0; i < possibleAngles.length; i++) {
                            let angleData = possibleAngles[i];
                            if (angleData && angleData.trap) {
                                this.checkPlace2(player.items[4], angleData.angle);
                            }
                        }
                    }
                } else {
                    let nearSpike = closeObjects.some(e => e && e.dmg && (e.owner.sid == player.sid || isAlly(e.owner.sid)) && dist2(enemies.closest, e) <= e.scale + 85);
                    for (let i = 0; i < possibleAngles.length; i++) {
                        let angleData = possibleAngles[i];
                        if (angleData) {
                            if (!nearSpike && angleData.spike && distance <= 200 && UTILS.getAngleDist(angleData.angle, enemies.angle) <= Math.PI / 2.5) {
                                this.checkPlace2(player.items[2], angleData.angle);
                            } else if (angleData.trap) {
                                this.checkPlace2(player.items[4], angleData.angle);
                            }
                        }
                    }
                }
            }
        }
        antitrap({ x, y }) {
            if (!enemies.closest) return;
            let possibleAngles = this.getAngles();
            if (enemies.dist <= 300) {
                let enemy = enemies.closest;
                if (enemy.trap && enemies.dist <= 200) {
                    for (let i = 0; i < possibleAngles.length; i++) {
                        let angleData = possibleAngles[i];
                        if (angleData && angleData.spike) {
                            this.checkPlace2(player.items[2], angleData.angle);
                        }
                    }
                } else {
                    for (let i = 0; i < possibleAngles.length; i++) {
                        let angleData = possibleAngles[i];
                        if (angleData && angleData.trap) {
                            this.checkPlace2(player.items[4], angleData.angle);
                        }
                    }
                }
            } else {
                for (let i = 0; i < possibleAngles.length; i++) {
                    let angleData = possibleAngles[i];
                    if (angleData && angleData.trap) {
                        this.checkPlace2(player.items[4], angleData.angle);
                    }
                }
            }
        }
        calculatePosition(angle, scale, obj) {
            return {
                x: (obj ? obj.x : player.x2) + Math.cos(angle) * scale,
                y: (obj ? obj.y : player.y2) + Math.sin(angle) * scale
            };
        }
        correctAngle(angle, index) {
            let item = items.list[player.items[index]];
            let scale = 35 + item.scale + (item.placeOffset || 0);
            let tmp = this.calculatePosition(angle, scale);
            if (this.checkItemLocation(tmp.x, tmp.y, item.scale, .6, false, false, this.objectToIgnore)) {
                return angle;
            }
            let Ang = Math.PI / 36;
            for (let i = 0; i <= 36; i++) {
                let ang = Ang * i;
                let tmp = this.calculatePosition(angle + ang, scale);
                if (this.checkItemLocation(tmp.x, tmp.y, item.scale, .6, false, false, this.objectToIgnore)) {
                    return angle + ang;
                }
                tmp = this.calculatePosition(angle - ang, scale);
                if (this.checkItemLocation(tmp.x, tmp.y, item.scale, .6, false, false, this.objectToIgnore)) {
                    return angle - ang;
                }
            }
            return "not found";
        }
        replace(obj) {
            if (!obj) return;
            this.objectToIgnore = obj;
            let distance = dist2(obj, player);
            if (distance > 300) {
                this.objectToIgnore = undefined;
                return;
            }
            if (toggles.autogrind()) {
                for (let i = 0; i < 4; i++) {
                    let angle = (Math.PI / 2) * i;
                    placer.place(player.items[5] ? player.items[5] : player.items[3], angle);
                }
            } else {
                if (toggles.autoreplace() && player.items[4] == 15) {
                    let possibleAngles = this.getAngles();
                    if (enemies.closest && enemies.dist <= 300) {
                        let angle = Math.atan2(obj.y - player.y2, obj.x - player.x2);
                        let spikeScale = player.itemsInfo[2].scale;
                        let enemyTrap = enemies.closest.trap;
                        let replaceWithSpike = false;
                        if (placer.reverseSpikeTick != undefined && placer.reverseSpikeTick != null) {
                            insta.do("bullhit");
                            replaceWithSpike = true;
                            placer.reverseSpikeTick = undefined;
                        }
                        if (enemyTrap && obj.sid == enemyTrap.sid) {
                            let tmp = {
                                x: player.x2 + Math.cos(angle) * 80,
                                y: player.y2 + Math.sin(angle) * 80
                            };
                            let fixedAngle = this.correctAngle(angle, (replaceWithSpike ? 2 : 4));
                            this.place(player.items[replaceWithSpike ? 2 : 4], angle);
                            if (fixedAngle != "not found") {
                                if (dist2(tmp, enemies.closest) <= 50) {
                                    this.place(player.items[replaceWithSpike ? 2 : 4], fixedAngle);
                                } else if (dist2(tmp, enemies.closest) <= 70 + spikeScale) {
                                    this.place(player.items[replaceWithSpike ? 2 : 4], fixedAngle);
                                }
                                for (let i = 0; i < possibleAngles.length; i++) {
                                    let angleData = possibleAngles[i];
                                    if (angleData && angleData.trap) {
                                        this.checkPlace2(player.items[4], angleData.angle);
                                    }
                                }
                            }
                        } else if (enemyTrap) {
                            let ang = Math.PI / 18;
                            let adjust = Math.atan2(player.y2 - enemyTrap.y, player.x2 - enemyTrap.y);
                            let locations = [];
                            for (let i = 0; i <= 18; i++) {
                                let angle = (i * ang) + adjust - (Math.PI / 2);
                                let tmp = this.calculatePosition(angle, 50 + spikeScale, enemyTrap);
                                if (dist2(tmp, player) > 35 && this.checkItemLocation(tmp.x, tmp.y, spikeScale, .6, false, false, obj)) {
                                    locations.push(tmp);
                                }
                            }
                            if (dist2(enemyTrap, obj) <= 85 + obj.scale) {
                                this.place(player.items[2], angle);
                            } else {
                                this.place(player.items[4], angle);
                            }
                            if (locations.length) {
                                locations = locations.sort((a, b) => dist2(a, player) - dist2(b, player));
                                for (let i = 0; i < 2; i++) {
                                    let e = locations[i];
                                    if (e) {
                                        let corrected = this.correctAngle(Math.atan2(e.y - player.y2, e.x - player.x2), 2);
                                        if (corrected != "not found") {
                                            this.place(player.items[2], corrected);
                                        }
                                    }
                                }
                            }
                            for (let i = 0; i < possibleAngles.length; i++) {
                                let angleData = possibleAngles[i];
                                if (angleData && angleData.trap) {
                                    this.checkPlace2(player.items[4], angleData.angle);
                                }
                            }
                        } else {
                            if (dist2(obj, enemies.closest) <= 200) {
                                this.place(player.items[2], angle);
                            } else {
                                this.place(player.items[4], angle);
                            }
                            for (let i = 0; i < possibleAngles.length; i++) {
                                let angleData = possibleAngles[i];
                                if (angleData) {
                                    if (angleData.spike && enemies.dist <= 200 && UTILS.getAngleDist(angleData.angle, enemies.angle) <= Math.PI / 2.5) {
                                        this.checkPlace2(player.items[2], angleData.angle);
                                    } else if (angleData.trap) {
                                        this.checkPlace2(player.items[4], angleData.angle);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            this.broken.push({
                x: obj.x,
                y: obj.x,
                scale: obj.scale
            });
            this.objectToIgnore = undefined;
        }
    })();
    function killObject(sid) {
        let index = closeObjects.find(e => e && e.sid == sid);
        if (index >= 0 && closeObjects[index]) {
            closeObjects.splice(index, 1);
        }
        for (let i = 0; i < gameObjects.length; i++) {
            let obj = gameObjects[i];
            if (obj && obj.sid == sid) {
                let canAntiSpike = true;
                if (obj.trap && dist2(obj, player) <= 50) {
                    canAntiSpike = false;
                    doAntiSpikeTick();
                }
                let spikeTicked = canGetSpikeTicked();
                if (!player.trap && spikeTicked && canAntiSpike && !autoaim) {
                    canAntiSpike = false;
                    doAntiSpikeTick();
                }
                placer.replace(obj);
                objectDeathAnimation.push({
                    x: obj.x,
                    y: obj.y,
                    dir: obj.dir,
                    name: obj.name,
                    owner: {
                        sid: obj.owner.sid,
                    },
                    sid: obj.sid,
                    scale: obj.scale,
                    id: obj.id
                });
                doInfiniteRange(obj);
                gameObjects.splice(i, 1);
            }
        }
        for (let i = 0; i < players.length; i++) {
            setTrapData(players[i]);
        }
    }
    function killObjects(sid) {
        if (player) {
            if (namesBySid[sid]) {
                namesBySid[sid] = null;
            }
            if (botSids.find(e => e == sid)) {
                let index = botSids.findIndex(e => e == sid);
                botSids.splice(index, 1);
            }
            objectManager.removeAllItems(sid);
        }
    }
    function ioConnect(wsAddress) {
        io.connect(wsAddress, function (error) {
            if (error) {
                disconnect(error);
            } else {
                sendToSocketServer("setUp", location.href, null, managerPasscode);
                pingSocket();
                setInterval(() => {
                    pingSocket();
                }, 2e3);
                bindEvents();
                loadIcons();
                loadingText.style.display = "none";
                menuCardHolder.style.display = "block";
                nameInput.value = getSavedVal("moo_name") || "";
                prepareUI();
                document.getElementById("ageText").style.position = "absolute";
                document.getElementById("ageBarContainer").style.position = "absolute";
                document.getElementById("actionBar").style.position = "absolute";
                for (let i = 19; i <= 38; i++) {
                    let element = document.createElement("div");
                    element.id = "itemCounts" + i;
                    element.style = `
                    position: absolute;
                    top: 0;
                    padding-left: 5px;
                    font-size: 2em;
                    color: #fff;`;
                    element.innerHTML = "0";
                    document.getElementById("actionBarItem" + i).style.position = "relative";
                    document.getElementById("actionBarItem" + i).appendChild(element);
                }
            }
        }, {
            "A": function (data) {
                alliances = data.teams;
                //document.title = JSON.stringify(alliances);
            },
            //"B": disconnect,
            "C": function (yourSID) {
                loadingText.style.display = "none";
                menuCardHolder.style.display = "block";
                mainMenu.style.display = "none";
                keys = {};
                playerSID = yourSID;
                attackState = 0;
                inGame = true;
                if (firstSetup) {
                    firstSetup = false;
                    sendToSocketServer("setUp", null, yourSID);
                    gameObjects.length = 0;
                }
            },
            "D": function (data, isYou) {
                var tmpPlayer = findPlayerByID(data[0]);
                if (!tmpPlayer) {
                    tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories);
                    players.push(tmpPlayer);
                }
                tmpPlayer.spawn(isYou ? moofoll : null);
                tmpPlayer.visible = false;
                tmpPlayer.x2 = undefined;
                tmpPlayer.y2 = undefined;
                tmpPlayer.setData(data);
                namesBySid[data[1]] = data[2];
                if (isYou) {
                    player = tmpPlayer;
                    camX = player.x;
                    camY = player.y;
                    updateItems();
                    updateStatusDisplay();
                    updateAge();
                    updateUpgrades(0);
                    gameUI.style.display = "block";
                    player.isAlive = true;
                }
            },
            "E": function (id) {
                for (var i = 0; i < players.length; i++) {
                    if (players[i].id == id) {
                        if (document.getElementById("enemyradar" + players[i].sid)) {
                            document.getElementById("enemyradar" + players[i].sid).remove();
                        }
                        players.splice(i, 1);
                        break;
                    }
                }
            },
            "a": updatePlayers,
            "G": function (data) {
                UTILS.removeAllChildren(leaderboardData);
                var tmpC = 1;
                for (var i = 0; i < data.length; i += 3) {
                    (function (i) {
                        namesBySid[data[i]] = data[i + 1] || "unknown";
                        UTILS.generateElement({
                            class: "leaderHolder",
                            parent: leaderboardData,
                            children: [
                                UTILS.generateElement({
                                    class: "leaderboardItem",
                                    style: "color:" + ((data[i] == playerSID) ? "#fff" : "rgba(255,255,255,0.6)"),
                                    text: tmpC + ". " + (data[i + 1] != "" ? data[i + 1] : "unknown")
                                }),
                                UTILS.generateElement({
                                    class: "leaderScore",
                                    text: UTILS.kFormat(data[i + 2]) || "0"
                                })
                            ]
                        });
                    })(i);
                    tmpC++;
                }
            },
            "H": function (data) {
                for (let i = 0; i < data.length;) {
                    let index = gameObjects.length;
                    objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? { sid: data[i + 7] } : null));
                    let id = data[i + 6];
                    if (items.list[id] && items.list[id].dmg && data[i + 7] != player.sid && !isAlly(data[i + 7])) {
                        let tmpobj = findPlayerBySID(data[i + 7]);
                        if (tmpobj && data[i] > tmpobj.spikeType.sid) {
                            tmpobj.spikeType.sid = data[i];
                            tmpobj.spikeType.id = id;
                        }
                    }
                    let x = data[i + 1]
                    let y = data[i + 2];
                    if (dist2({ x: x, y: y }, player) <= 800) {
                        closeObjects.push(gameObjects[index]);
                    }
                    if (data[i + 7] >= 0 && data[i + 7] != player.sid && !isAlly(data[i + 7])) {
                        let distance = Math.hypot(y - player.y2, x - player.x2);
                        if (id == 15 && distance <= 80) {
                            placer.antitrap({
                                sid: data[i],
                                x: data[i + 1],
                                y: data[i + 2],
                                ownerSID: data[i + 7],
                                id: data[i + 6]
                            });
                        }
                    }
                    i += 8;
                }
            },
            "I": function (data) {
                for (var i = 0; i < ais.length; ++i) {
                    ais[i].forcePos = !ais[i].visible;
                    ais[i].visible = false;
                }
                if (data) {
                    var tmpTime = Date.now();
                    for (var i = 0; i < data.length;) {
                        let tmpObj = findAIBySID(data[i]);
                        if (tmpObj) {
                            tmpObj.index = data[i + 1];
                            tmpObj.t1 = (tmpObj.t2 === undefined) ? tmpTime : tmpObj.t2;
                            tmpObj.t2 = tmpTime;
                            tmpObj.x1 = tmpObj.x;
                            tmpObj.y1 = tmpObj.y;
                            tmpObj.x2 = data[i + 2];
                            tmpObj.y2 = data[i + 3];
                            tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 4] : tmpObj.d2;
                            tmpObj.d2 = data[i + 4];
                            tmpObj.health = data[i + 5];
                            tmpObj.dt = 0;
                            tmpObj.visible = true;
                            if (tmpObj.hitted == true) {
                                tmpObj.weaponReload = 0;
                                tmpObj.hitted = false;
                            }
                            if (tmpObj.weaponReload != null) {
                                tmpObj.weaponReload = Math.min(1, tmpObj.weaponReload + 0.185);
                            }
                        } else {
                            tmpObj = aiManager.spawn(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                            tmpObj.x2 = tmpObj.x;
                            tmpObj.y2 = tmpObj.y;
                            tmpObj.d2 = tmpObj.dir;
                            tmpObj.health = data[i + 5];
                            if (!aiManager.aiTypes[data[i + 1]].name)
                                tmpObj.name = config.cowNames[data[i + 6]];
                            tmpObj.forcePos = true;
                            tmpObj.sid = data[i];
                            tmpObj.visible = true;
                        }
                        i += 7;
                    }
                }
            },
            "J": function (sid) {
                let tmpObj = findAIBySID(sid);
                if (tmpObj) {
                    tmpObj.startAnim();
                    let buildings = buildingsHit;
                    buildingsHit = [];
                    if (tmpObj.name == "MOOSTAFA") {
                        tmpObj.hitted = true;
                    }
                    doNextTick(() => {
                        for (let i = 0; i < buildings.length; i++) {
                            buildings[i].lastHitTime = Date.now();
                            buildings[i].currentHealth -= 232;
                        }
                    });
                }
            },
            "K": function (sid, didHit, index) {
                let tmpObj = findPlayerBySID(sid);
                if (tmpObj) {
                    tmpObj.startAnim(didHit, index);
                    if (index > 9) {
                        tmpObj.secondary.reload = 0;
                        if (tmpObj.skinIndex == 20) {
                            tmpObj.secondary.fastReload = true;
                        }
                    } else {
                        tmpObj.primary.reload = 0;
                        if (tmpObj.skinIndex == 20) {
                            tmpObj.primary.fastReload = false;
                        }
                    }
                    if (didHit) {
                        let buildings = buildingsHit;
                        buildingsHit = [];
                        doNextTick(() => {
                            let weapon = items.weapons[index];
                            let damage = weapon.projectile == null ? weapon.dmg : 0;
                            let variant = config.weaponVariants[tmpObj.weaponVariant].val;
                            let sDmg = weapon.sDmg || 1;
                            let totalDamage = damage * variant * sDmg * (tmpObj.skinIndex == 40 ? 3.3 : 1);
                            for (let i = 0; i < buildings.length; i++) {
                                let building = buildings[i];
                                if (building) {
                                    building.lastHitTime = Date.now();
                                    building.currentHealth -= totalDamage;
                                }
                            }
                        });
                    }
                }
            },
            "L": function (dir, sid) {
                let tmpObj = findObjectBySid(sid);
                if (tmpObj) {
                    if (tmpObj.currentHealth) {
                        buildingsHit.push(tmpObj);
                    }
                    tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
                    tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
                }
            },
            "M": function (sid, dir) {
                let tmpObj = findObjectBySid(sid);
                if (tmpObj) {
                    tmpObj.dir = dir;
                    tmpObj.shotted = 1;
                    if (enemies.closest && !toggles.autobullspam() && toggles.autohit() && player.primary.reload == 1 && dist2(enemies.closest, player) - 63 < items.weapons[player.weapons[0]].range) {
                        if (tmpObj.owner && (tmpObj.owner.sid == player.sid || isAlly(tmpObj.owner.sid)) && !isBlocked(tmpObj, enemies.closest)) {
                            let distance = Math.hypot(tmpObj.y - enemies.closest.y2, tmpObj.x - enemies.closest.x2);
                            let location = {
                                x: tmpObj.x + Math.cos(dir) * distance,
                                y: tmpObj.y + Math.sin(dir) * distance,
                            };
                            if (Math.hypot(location.y - enemies.closest.y2, location.x - enemies.closest.x2) <= 35 && ((player.primary.dmg * 1.5) + 25) >= 100) {
                                let speed = ((distance - 35) / 1.5) - config.serverUpdateSpeed;
                                setTimeout(() => {
                                    insta.do("bullhit");
                                }, speed - window.pingTime);
                            }
                        }
                    }
                    tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
                    tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
                }
            },
            "N": function (index, value, updateView) {
                if (player) {
                    player[index] = value;
                    if (updateView) updateStatusDisplay();
                }
            },
            "O": function (sid, value) {
                let tmpObj = findPlayerBySID(sid);
                if (tmpObj) {
                    let d = value - tmpObj.health;
                    if (d >= 0) {
                        d = correctDamage(d);
                        doNextTick(() => {
                            if (tmpObj) {
                                if (tmpObj.hitTime) {
                                    let e = tick - tmpObj.hitTime;
                                    tmpObj.hitTime = 0;
                                    if (e < 2) {
                                        let hatInfo = hats[tmpObj.skinIndex];
                                        if (value == 3 && tmpObj.tailindex == 13) {
                                            tmpObj.bullTick = tick - 1;
                                        } else if (value == 6 && tmpObj.tailIndex == 13 && tmpObj.skinIndex == 13) {
                                            tmpObj.bullTick = tick - 1;
                                        } else if (value == 1 && tmpObj.tailIndex == 17) {
                                            tmpObj.bullTick = tick - 1;
                                        } else if (hatInfo && tmpObj.tailIndex == 18 && value <= (tmpObj.primary.dmg * (hatInfo.dmgMultO || 1)) * .2) {
                                        } else if (hatInfo && tmpObj.skinIndex == 55 && value <= (tmpObj.primary.dmg * (hatInfo.dmgMultO || 1)) * .25) {
                                        } else {
                                            tmpObj.shameCount++;
                                            if (tmpObj.shameCount >= 8) {
                                                tmpObj.shameCount = 0;
                                            }
                                        }
                                    } else {
                                        tmpObj.shameCount = Math.max(0, tmpObj.shameCount - 2);
                                    }
                                }
                            }
                        });
                    } else {
                        doNextTick(() => {
                            let tmpObj = findPlayerBySID(sid);
                            tmpObj.hitTime = tick;
                            if (d == -2 && tmpObj.skinIndex == 7 && tmpObj.tailIndex == 13) {
                                tmpObj.bullTick = tick - 1;
                                if (tmpObj == player) {
                                    needTick = 0;
                                }
                            }
                        });
                        if (d == -5 || d == -3.75) {
                            tmpObj.bullTick = tick;
                            if (tmpObj == player) {
                                needTick = 0;
                            }
                        }
                        if (tmpObj == player) {
                            damageData.taken.push(correctDamage(Math.abs(d)));
                        } else if (!isAlly(tmpObj.sid)) {
                            if (tmpObj.damageData == null) tmpObj.damageData = [];
                            tmpObj.damageData.push(Math.abs(d));
                        }
                    }
                    if (value <= 0) {
                        deathAnimations.push({
                            dir: tmpObj.sid == player.sid ? Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2)) : tmpObj.dir,
                            dirPlus: tmpObj.dirPlus,
                            x: tmpObj.x,
                            y: tmpObj.y,
                            skinIndex: tmpObj.skinIndex,
                            tailIndex: tmpObj.tailIndex,
                            weaponIndex: tmpObj.weaponIndex,
                            buildIndex: -1,
                            skinColor: tmpObj.skinColor,
                            scale: 35,
                            weaponVariant: (tmpObj.weaponVariant || 0)
                        });
                        if (tmpObj.deaths == null) tmpObj.deaths = 0;
                        tmpObj.deaths++;
                        if (tmpObj.sid != player.sid && !isAlly(tmpObj.sid)) {
                            bots.forEach(e => {
                                if (e.socket && e.socket.readyState == 1 && !e.CLOSED) {
                                    e.socket.send(JSON.stringify({
                                        type: "ch",
                                        chat: `WHY DIE XDDD '${tmpObj.name}'`
                                    }));
                                }
                            });
                        }
                    }
                    tmpObj.health = value;
                }
            },
            "P": function () {
                isPushing = false;
                player.isAlive = false;
                inGame = false;
                gameUI.style.display = "none";
                hideAllWindows();
                lastDeath = {
                    x: player.x,
                    y: player.y
                };
                loadingText.style.display = "none";
                diedText.style.display = "block";
                diedText.style.fontSize = "0px";
                deathTextScale = 0;
                setTimeout(function () {
                    menuCardHolder.style.display = "block";
                    mainMenu.style.display = "block";
                    diedText.style.display = "none";
                }, config.deathFadeout);
            },
            "Q": killObject,
            "R": killObjects,
            "S": function (index, value) {
                if (player) {
                    player.itemCounts[index] = value;
                    if (index == 1) {
                        for (let ee = 19; ee < 22; ee++) document.getElementById("itemCounts" + ee.toString()).innerHTML = value;
                    } else if (index == 2) {
                        for (let ee = 22; ee < 26; ee++) document.getElementById("itemCounts" + ee.toString()).innerHTML = value;
                    } else if (index == 3) {
                        for (let ee = 26; ee < 29; ee++) document.getElementById("itemCounts" + ee.toString()).innerHTML = value;
                    } else if (index == 4) {
                        document.getElementById("itemCounts29").innerHTML = value;
                    } else if (index == 5) {
                        document.getElementById("itemCounts31").innerHTML = value;
                    } else if (index == 6) {
                        document.getElementById("itemCounts32").innerHTML = value;
                    } else if (index == 7) {
                        document.getElementById("itemCounts33").innerHTML = value;
                    } else if (index == 8) {
                        document.getElementById("itemCounts34").innerHTML = value;
                    } else if (index == 9) {
                        document.getElementById("itemCounts35").innerHTML = value;
                    } else if (index == 10) {
                        document.getElementById("itemCounts36").innerHTML = value;
                    } else if (index == 11) {
                        document.getElementById("itemCounts30").innerHTML = value;
                    } else if (index == 12) {
                        document.getElementById("itemCounts37").innerHTML = value;
                    } else if (index == 13) {
                        document.getElementById("itemCounts38").innerHTML = value;
                    }
                }
            },
            "T": updateAge,
            "U": updateUpgrades,
            "V": updateItems,
            "X": function (x, y, dir, range, speed, indx, layer, sid) {
                if (inWindow) {
                    projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer).sid = sid;
                }
                let bulletPos = {
                    x: x - Math.cos(dir) * 70,
                    y: y - Math.sin(dir) * 70
                };
                let object = null;
                let isTurret = false;
                for (let i = 0; i < players.length; i++) {
                    let _ = players[i];
                    if (_.visible) {
                        if (speed == 1.5 && (Math.hypot(_.y2 - y, _.x2 - x) <= 35 || Math.hypot(_.y - y, _.x - x) <= 35)) {
                            object = _;
                            isTurret = true;
                        } else if (_.secondary.id && items.weapons[_.secondary.id] && (items.weapons[_.secondary.id].projectile != null) && Math.hypot(_.y2 - bulletPos.y, _.x2 - bulletPos.x) <= 35) {
                            object = _;
                        }
                    }
                }
                if (object) {
                    if (isTurret) {
                        if (player.sid != object.sid && !isAlly(object.sid)) {
                            if (UTILS.getAngleDist(Math.atan2(player.y2 - object.y2, player.x2 - object.x2), dir) <= 0.36) {
                                damageData.proj.push(25);
                                antiBowHealing(Math.atan2(object.y2 - player.y2, object.x2 - player.x2));
                                setTimeout(() => {
                                    damageData.proj.shift();
                                }, 600);
                            }
                            if (dist2(object, player) < 290 && object.primary.id == 5 && object.primary.variant > 1 && object.primary.reload == 1) {
                                otSoldier = true;
                                storeEquip(6);
                                setTickout(() => {
                                    otSoldier = false;
                                }, 3);
                            }
                        }
                        object.turret = -0.0444;
                    } else {
                        if (object.skinIndex == 20) {
                            object.secondary.fastReload = true;
                        }
                        if (object.projectiles == null) object.projectiles = [];
                        let weaponID = speed == 1.6 ? 9 : speed == 2.5 ? 12 : speed == 2 ? 13 : 15;
                        if (object.sid != player.sid && !isAlly(object.sid) && UTILS.getAngleDist(Math.atan2(player.y2 - object.y2, player.x2 - object.x2), dir) <= 0.36) {
                            damageData.proj.push(items.weapons[weaponID].dmg || 50);
                            antiBowHealing(Math.atan2(object.y2 - player.y2, object.x2 - player.x2));
                            setTimeout(() => {
                                damageData.proj.shift();
                            }, 1e3);
                        }
                        object.secondary.reload = -config.serverUpdateSpeed / items.weapons[weaponID].speed;
                        object.secondary.id = weaponID;
                        object.secondary.dmg = items.weapons[weaponID].dmg;
                    }
                }
            },
            "Y": function (sid, range) {
                for (var i = 0; i < projectiles.length; ++i) {
                    if (projectiles[i].sid == sid) {
                        projectiles[i].range = range;
                        projectiles[i].active = false;
                        let dmg = projectiles[i].dmg;
                        let objects = buildingsHit;
                        buildingsHit = [];
                        doNextTick(() => {
                            for (let i = 0; i < objects.length; i++) {
                                if (objects[i].projDmg) {
                                    objects[i].currentHealth -= dmg;
                                    objects[i].lastHitTime = Date.now();
                                }
                            }
                        });
                    }
                }
            },
            "Z": function (countdown) {
                if (countdown < 0) return;
                var minutes = Math.floor(countdown / 60);
                var seconds = countdown % 60;
                seconds = ("0" + seconds).slice(-2);
                shutdownDisplay.innerText = "Server restarting in " + minutes + ":" + seconds;
                shutdownDisplay.hidden = false;
            },
            "g": function (data) {
                alliances.push(data);
                if (allianceMenu.style.display == "block") {
                    showAllianceMenu();
                }
            },
            "1": function (sid) {
                for (var i = alliances.length - 1; i >= 0; i--) {
                    if (alliances[i].sid == sid)
                        alliances.splice(i, 1);
                }
                if (allianceMenu.style.display == "block") {
                    showAllianceMenu();
                }
            },
            "2": function (sid, name) {
                allianceNotifications.push({
                    sid: sid,
                    name: name
                });
                updateNotifications();
            },
            "3": function (team, isOwner) {
                if (player) {
                    player.team = team;
                    player.isOwner = isOwner;
                    if (allianceMenu.style.display == "block") {
                        showAllianceMenu();
                    }
                }
            },
            "4": function (data) {
                alliancePlayers = data;
                let index = allianceNotifications.findIndex(e => alliancePlayers.includes(e.sid));
                if (index >= 0) {
                    allianceNotifications.splice(index, 1);
                    updateNotifications();
                }
                if (allianceMenu.style.display == "block")
                    showAllianceMenu();
            },
            "5": function (type, id, index) {
                if (index) {
                    if (!type) {
                        player.tails[id] = 1;
                    } else {
                        player.tailIndex = id;
                    }
                } else {
                    if (!type) {
                        player.skins[id] = 1;
                    }
                    //player.skinIndex = id;
                }
                if (storeMenu.style.display == "block" && currentStoreIndex !== -1) generateStoreList();
            },
            "6": function (sid, message) {
                var tmpPlayer = findPlayerBySID(sid);
                if (tmpPlayer) {
                    tmpPlayer.chatMessage = message;
                    tmpPlayer.chatCountdown = config.chatCountdown;
                    if (message == "/shrug" || message == ":shrug:") {
                        tmpPlayer.chatMessage = "¯\\_(ツ)_/¯";
                        tmpPlayer.chatCountdown = config.chatCountdown;
                    }
                    if (tmpPlayer == player && message.startsWith(".")) {
                        message = message.replaceAll(".", "");
                        let array = message.split(" ");
                        for (let i = 0; i < commandsList.length; i++) {
                            let command = commandsList[i];
                            if (command) {
                                if (command.id == array[0]) {
                                    if (command.id == "crash") {
                                        io.socket.close();
                                        chickenModSocket.close();
                                    } else if (command.id == "bowinsta") {
                                        if (player.secondary.reload == 1 && player.turret == 1 && player.weapons[1] == 9) {
                                            insta.do("bow");
                                        }
                                    } else if (document.getElementById(array[0])) {
                                        if (array[1] && (array[1] == "true" || array[1] == "false")) {
                                            document.getElementById(array[0]).checked = array[1] == "true" ? true : false;
                                            textManager.showText(player.x, player.y, 35, 0, 1500, `${array[0]} is set to ${array[1]}`, "#fff");
                                            document.getElementById("autoplaceDisplay").innerHTML = `| ${toggles.placeEveryTick()}`;
                                        } else if (command.type == "number" && array[1] && array[1] == "set") {
                                            if (array[2] >= parseInt(document.getElementById(array[0]).max)) {
                                                document.getElementById(array[0]).value = document.getElementById(array[0]).max;
                                            } else if (document.getElementById(array[0]).min && array[2] <= parseInt(document.getElementById(array[0]).min)) {
                                                document.getElementById(array[0]).value = document.getElementById(array[0]).min;
                                            } else {
                                                document.getElementById(array[0]).value = array[2];
                                            }
                                            textManager.showText(player.x, player.y, 35, 0, 1500, `${array[0]} is set to ${array[2]}`, "#fff");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "7": function (data) {
                minimapData = data;
            },
            "8": function (x, y, value, index) {
                if (index === -1) {
                    textManager.showText(x, y, 50, .18, 500, index, "#ee5551");
                } else {
                    textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), value >= 0 ? "#fff" : "#8ecc51");
                }
            },
            "9": function (x, y) {
                for (var i = 0; i < mapPings.length; ++i) {
                    if (!mapPings[i].active) {
                        tmpPing = mapPings[i];
                        break;
                    }
                }
                if (!tmpPing) {
                    tmpPing = new MapPing();
                    mapPings.push(tmpPing);
                }
                tmpPing.init(x, y);
                if (player.team && autoaim == false && player.secondary.reload == 1 && enemies.closest && toggles.teamsync()) {
                    let turretSpeed = Math.hypot(enemies.closest.y2 - player.y2, enemies.closest.x2 - player.x2) / 1.5;
                    let musketSpeed = (Math.hypot(enemies.closest.y2 - player.y2, enemies.closest.x2 - player.x2) - 35) / 3.6;
                    if (player.weapons[1] == 15) {
                        io.send("a", null);
                        autoaim = true;
                        hitting = true;
                        storeEquip(53);
                        selectToBuild(player.weapons[1], true);
                        autoPrimary.change(false);
                        autoSecondary.change(true);
                        setTimeout(() => {
                            attackLoop.change(true);
                        }, (turretSpeed - musketSpeed));
                        setTimeout(() => {
                            attackLoop.change(false);
                            autoaim = false;
                            hitting = false;
                            autoPrimary.change(false);
                            autoSecondary.change(false);
                        }, (turretSpeed - musketSpeed) + 150);
                    } else {
                        autoaim = true;
                        hitting = true;
                        storeEquip(53);
                        selectToBuild(player.weapons[1], true);
                        autoPrimary.change(false);
                        autoSecondary.change(true);
                        attackLoop.change(true);
                        setTickout(() => {
                            attackLoop.change(false);
                            autoaim = false;
                            hitting = false;
                            autoPrimary.change(false);
                            autoSecondary.change(false);
                        }, 2);
                    }
                }
            },
            "0": function () {
                let pingTime = Date.now() - lastPing;
                window.pingTime = pingTime;
                pingDisplay.innerText = `Ping: ${pingTime} | FPS: ${window.fps}`;
            }
        });
    }
    window.requestAnimFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();
    var fpsCount = 0;
    var fpsLast = 0;
    var fps = 0;
    var deathTextScale = 9999999;
    function isOnScreen(x, y, s) {
        return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && y - s <= maxScreenHeight)
    }
    var gameObjectSprites = {};
    function getResSprite(obj) {
        var biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
        var tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
        var tmpSprite = gameObjectSprites[tmpIndex + (obj.type == 0 ? obj.colorType : "")];
        if (!tmpSprite) {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
            var tmpContext = tmpCanvas.getContext('2d');
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(UTILS.randFloat(0, Math.PI));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth;
            if (obj.type == 0) {
                var tmpScale;
                for (var i = 0; i < 2; ++i) {
                    tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
                    renderStar(tmpContext, Math.random() < .25 ? 5 : 7, tmpScale, tmpScale * 0.7);
                    let color = biomeID ? `hsl(191, 20%, ${85 + Math.floor(Math.random() * 10)}%)` : `hsl(80, 45%, ${38 + Math.floor(Math.random() * 10)}%)`
                    tmpContext.fillStyle = !biomeID ? (!i ? Math.random() > .5 ? color : "#9ebf57" : "#b4db62") : (!i ? Math.random() > .5 ? color : "#e3f1f4" : "#fff");
                    tmpContext.fill();
                    if (!i) tmpContext.stroke();
                }
            } else if (obj.type == 1) {
                if (biomeID == 2) {
                    tmpContext.fillStyle = "#606060";
                    renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#89a54c";
                    renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                    tmpContext.fillStyle = "#a5c65b";
                    renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
                } else {
                    renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                    tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                    var tmpRange;
                    var berries = 4;
                    var rotVal = mathPI2 / berries;
                    for (var i = 0; i < berries; ++i) {
                        tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                        renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                            UTILS.randInt(10, 12), tmpContext);
                    }
                }
            } else if (obj.type == 2 || obj.type == 3) {
                tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
                renderStar(tmpContext, 3, obj.scale, obj.scale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
                renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                tmpContext.fill();
            }
            tmpSprite = tmpCanvas;
            gameObjectSprites[tmpIndex + (obj.type == 0 ? obj.colorType : "")] = tmpSprite;
        }
        return tmpSprite;
    }
    var tankTarget = null;
    var volanco = {
        land: null,
        lava: null,
        animationTime: 0,
        x: 13960,
        y: 13960
    };
    function drawRegularPolygon(context, sides, radius) {
        const lineWidth = context.lineWidth || 0;
        const halfRadius = radius / 2;
        context.beginPath();
        const angle = (Math.PI * 2) / sides;
        for (let side = 0; side < sides; side++) {
            const x = halfRadius + (halfRadius - lineWidth / 2) * Math.cos(angle * side);
            const y = halfRadius + (halfRadius - lineWidth / 2) * Math.sin(angle * side);
            context.lineTo(x, y);
        }
        context.closePath();
    }
    function drawVolancoImage() {
        const volcanoScale = config.volanoScale * 2;
        const canvasLand = document.createElement("canvas");
        canvasLand.width = volcanoScale;
        canvasLand.height = volcanoScale;
        const contextLand = canvasLand.getContext("2d");
        contextLand.strokeStyle = "#3e3e3e";
        contextLand.lineWidth = outlineWidth * 2;
        contextLand.fillStyle = "#7f7f7f";
        drawRegularPolygon(contextLand, 10, volcanoScale);
        contextLand.fill();
        contextLand.stroke();
        volanco.land = canvasLand;

        const innerVolcanoScale = config.innerVolcanoScale * 2;
        const canvasLava = document.createElement("canvas");
        canvasLava.width = innerVolcanoScale;
        canvasLava.height = innerVolcanoScale;
        const contextLava = canvasLava.getContext("2d");
        contextLava.strokeStyle = outlineColor;
        contextLava.lineWidth = outlineWidth * 1.6;
        contextLava.fillStyle = "#f54e16";
        contextLava.strokeStyle = "#f56f16";
        drawRegularPolygon(contextLava, 10, innerVolcanoScale);
        contextLava.fill();
        contextLava.stroke();
        volanco.lava = canvasLava;
    }
    drawVolancoImage();
    function drawTargetForObjects(mainContext, dir) {
        mainContext.rotate(-dir);
        mainContext.globalAlpha = 1;
        mainContext.drawImage(iconSprites["crosshair"], -25, -25, 50, 50);
    }
    function renderGameObjects(layer, xOffset, yOffset) {
        var tmpSprite, tmpX, tmpY;
        for (var i = 0; i < gameObjects.length; ++i) {
            tmpObj = gameObjects[i];
            if (tmpObj.active) {
                tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
                tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
                if (layer == 0) {
                    tmpObj.update(delta);
                }
                if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {
                    if (tmpObj.globalAlpha == null) tmpObj.globalAlpha = 1;
                    //if (tmpObj.globalAlpha2 == null) tmpObj.globalAlpha2 = 1;
                    let drawTarget = false;
                    if (tmpObj.isItem) {
                        if (bots.find(e => !e.CLOSED)) {
                            if (botModule == "all breaker" && dist2(tmpObj, player) <= BreakerRange) {
                                mainContext.globalAlpha = .25;
                                drawTarget = true;
                            } else if (botModule == "breaker" && tmpObj.name && (tmpObj.name.includes("trap") || tmpObj.name.includes("spike")) && tmpObj.owner.sid == player.sid && dist2(tmpObj, player) >= BreakerRange) {
                                mainContext.globalAlpha = .25;
                                drawTarget = true;
                            } else {
                                mainContext.globalAlpha = tmpObj.hideFromEnemy ? 0.6 : 1;
                            }
                        } else {
                            mainContext.globalAlpha = tmpObj.hideFromEnemy ? 0.6 : 1;
                        }
                    } else if (toggles.maxPerformance() && player && tmpObj.type == 0 && Math.hypot(tmpObj.y - player.y, tmpObj.x - player.x) <= tmpObj.scale + player.scale * 2) {
                        tmpObj.globalAlpha = Math.max(tmpObj.globalAlpha - (delta * 0.0025), 0.3);
                        //tmpObj.globalAlpha2 = Math.min(tmpObj.globalAlpha2 + (delta * 0.00125), 0.5);
                        mainContext.globalAlpha = tmpObj.globalAlpha;
                    } else {
                        tmpObj.globalAlpha = Math.min(tmpObj.globalAlpha + (delta * 0.0025), 1);
                        //tmpObj.globalAlpha2 = Math.max(tmpObj.globalAlpha2 - (delta * 0.00125), 0);
                        mainContext.globalAlpha = tmpObj.globalAlpha;
                    }
                    if (tmpObj.isItem) {
                        tmpSprite = getItemSprite(tmpObj);
                        mainContext.save();
                        mainContext.translate(tmpX, tmpY);
                        mainContext.rotate(tmpObj.dir);
                        mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));
                        if (tankTarget && tankTarget.sid == tmpObj.sid) {
                            let weapon = player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0];
                            let reload = weapon == 10 ? player.secondary.reload : player.primary.reload;
                            if (reload + config.serverUpdateSpeed / items.weapons[weapon].speed >= 1) {
                                mainContext.fillStyle = "#f00";
                                mainContext.globalAlpha = 0.2;
                                renderCircle(0, 0, tmpObj.scale, mainContext, true, false);
                            }
                        }
                        if (tmpObj.blocker) {
                            mainContext.strokeStyle = "#db6e6e";
                            mainContext.globalAlpha = 0.3;
                            mainContext.lineWidth = 6;
                            renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                        }
                        if (drawTarget) drawTargetForObjects(mainContext, tmpObj.dir);
                        mainContext.restore();
                    } else {
                        tmpSprite = getResSprite(tmpObj);
                        mainContext.save();
                        if (tmpObj.type == 4) {
                            mainContext.globalAlpha = 1;
                            volanco.animationTime += delta;
                            volanco.animationTime %= config.volcanoAnimationDuration;
                            let halfAnimationDuration = config.volcanoAnimationDuration / 2;
                            let scaleFactor = 1.7 + 0.3 * (Math.abs(halfAnimationDuration - volanco.animationTime) / halfAnimationDuration);
                            let innerVolcanoScale = config.innerVolcanoScale * scaleFactor;
                            mainContext.drawImage(
                                volanco.land,
                                tmpX - config.volanoScale,
                                tmpY - config.volanoScale,
                                config.volanoScale * 2,
                                config.volanoScale * 2
                            );
                            mainContext.drawImage(
                                volanco.lava,
                                tmpX - innerVolcanoScale,
                                tmpY - innerVolcanoScale,
                                innerVolcanoScale * 2,
                                innerVolcanoScale * 2
                            );
                        } else {
                            mainContext.fillStyle = "#000000";
                            renderCircle(tmpX, tmpY, tmpObj.scale * .6, mainContext, true, false);
                            mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
                        }
                        mainContext.restore();
                    }
                }
            }
        }
    }
    function renderProjectiles(layer, xOffset, yOffset) {
        for (var i = 0; i < projectiles.length; ++i) {
            tmpObj = projectiles[i];
            if (tmpObj.active && tmpObj.layer == layer) {
                tmpObj.update(delta);
                if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                    mainContext.save();
                    mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.rotate(tmpObj.dir);
                    renderProjectile(0, 0, tmpObj, mainContext, 1);
                    mainContext.restore();
                }
            }
        }
    }
    function renderPlayers(xOffset, yOffset, zIndex) {
        mainContext.globalAlpha = 1;
        for (var i = 0; i < players.length; ++i) {
            tmpObj = players[i];
            if (tmpObj.zIndex == zIndex) {
                tmpObj.animate(delta);
                if (tmpObj.visible) {
                    tmpObj.skinRot += (0.002 * delta);
                    tmpDir = ((tmpObj == player) ? (function () {
                        if (toggles.realdir()) {
                            return player.dir;
                        } else {
                            return Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
                        }
                    }()) : tmpObj.dir) + tmpObj.dirPlus;
                    mainContext.save();
                    mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                    mainContext.rotate(tmpDir);
                    if (tmpObj == player) {
                        if (player.trap) {
                            if (hitting == true) {
                                if (attackState) {
                                } else {
                                    renderPlayer(tmpObj, mainContext);
                                }
                            } else {
                                renderPlayer(tmpObj, mainContext);
                            }
                        } else {
                            if (hitting == true) {
                                if (tankSpam && scriptStatus == "tankspam2") {
                                } else {
                                    renderPlayer(tmpObj, mainContext);
                                }
                            } else {
                                renderPlayer(tmpObj, mainContext);
                            }
                        }
                    } else {
                        renderPlayer(tmpObj, mainContext);
                    }
                    if (tmpObj == player && bots.find(e => !e.CLOSED) && botModule.includes("breaker")) {
                        mainContext.strokeStyle = outlineColor;
                        renderCircle(0, 0, BreakerRange, mainContext, false, true);
                        mainContext.stroke();
                    }
                    mainContext.restore();
                }
            }
        }
    }
    var autoaim = false;
    var inWindow = true;
    var breakMarker = [];
    function doInfiniteRange(building) {
        if (breakMarker.length >= 10) {
            breakMarker = [];
        }
        if (dist2(building, player) >= 1800) {
            let isNear = breakMarker.find(e => dist2(e, building) <= 600);
            if (!isNear) {
                breakMarker.push({
                    x: building.x,
                    y: building.y
                });
            }
        }
    }
    var spamchat = false;
    var turrets = 0;
    var otSoldier = false;
    var onlySoldier = false;
    var onlyEMP = false;
    var spikeSoldier = false;
    var rangedSoldier = false;
    var autoMills = false;
    var trapAngle = 0;
    var tankSpam = false;
    var cursorLocation = {
        x: 0,
        y: 0
    };
    gameCanvas.addEventListener('mousemove', gameInput, false);
    var xOffset = 0;
    var yOffset = 0;
    var freeCam = {
        x: 0,
        y: 0,
        status: false
    };
    function updateCursorLocation() {
        let x1 = mouseX / window.innerWidth;
        let y1 = mouseY / window.innerHeight;
        let x2 = x1 * maxScreenWidth;
        let y2 = y1 * maxScreenHeight;
        let x3 = maxScreenWidth / 2;
        let y3 = maxScreenHeight / 2;
        let ang = Math.atan2(y2 - y3, x2 - x3);
        let dist = Math.hypot(y2 - y3, x2 - x3);
        cursorLocation = {
            x: (freeCam.status ? freeCam.x : player.x) + Math.cos(ang) * dist,
            y: (freeCam.status ? freeCam.y : player.y) + Math.sin(ang) * dist
        };
        for (let i = 0; i < bots.length; i++) {
            if (bots[i].socket && bots[i].socket.readyState == 1 && !bots[i].CLOSED) {
                bots[i].socket.send(JSON.stringify({
                    type: "setCursorLocation",
                    data: cursorLocation
                }));
            }
        }
    }
    function gameInput(e) {
        e.preventDefault();
        e.stopPropagation();
        mouseX = e.clientX;
        mouseY = e.clientY;
        updateCursorLocation();
    }
    gameCanvas.addEventListener('mousedown', function (event) {
        if (event.button == 0) {
            tankSpam = !tankSpam;
        } else if (event.button == 2) {
            bowSpam = !bowSpam;
        }
    }, false);
    window.onblur = function () {
        inWindow = false;
    };
    var aiSprites = {};
    function renderAI(obj, ctxt) {
        var tmpIndx = obj.index;
        var tmpSprite = aiSprites[tmpIndx];
        if (!tmpSprite) {
            var tmpImg = new Image();
            tmpImg.onload = function () {
                this.isLoaded = true;
                this.onload = null;
            };
            tmpImg.src = ".././img/animals/" + obj.src + ".png";
            tmpSprite = tmpImg;
            aiSprites[tmpIndx] = tmpSprite;
        }
        if (tmpSprite.isLoaded) {
            var tmpScale = obj.scale * 1.2 * (obj.spriteMlt || 1);
            ctxt.drawImage(tmpSprite, -tmpScale, -tmpScale, tmpScale * 2, tmpScale * 2);
        }
    }
    function resetMoveDir() {
        keys = {};
        io.send("e");
    }
    function keysActive() {
        return (allianceMenu.style.display != "block" && chatHolder.style.display != "block");
    }
    gameCanvas.addEventListener("wheel", function (event) {
        if (event.deltaY > 0) {
            maxScreenWidth *= 0.95;
            maxScreenHeight *= 0.95;
        } else {
            maxScreenWidth /= 0.95;
            maxScreenHeight /= 0.95;
        }
        resize();
        updateCursorLocation();
    });
    window.onfocus = function () {
        inWindow = true;
        if (player && player.alive) {
            resetMoveDir();
        }
    };
    Math.lerpAngle = function (value1, value2, amount) {
        var difference = Math.abs(value2 - value1);
        if (difference > Math.PI) {
            if (value1 > value2) {
                value2 += (Math.PI * 2);
            } else {
                value1 += (Math.PI * 2);
            }
        }
        var value = (value2 + ((value1 - value2) * amount));
        if (value >= 0 && value <= (Math.PI * 2)) return value;
        return (value % (Math.PI * 2));
    }
    function updateGame() {
        if (player) {
            if (!lastSent || now - lastSent >= (1000 / config.clientSendRate)) {
                lastSent = now;
                if (toggles.mouseless()) {
                    if (autoaim == true) {
                        io.send("D", enemies.angle);
                    }
                } else {
                    io.send("D", getAttackDir());
                }
            }
            if (spamchat == true && document.activeElement.id.toLowerCase() !== 'chatbox') {
                let chats = chatData[syncChat.chatIndex];
                if (chats[syncChat.index]) {
                    syncChat.timer += delta;
                    let chatInfo = chats[syncChat.index];
                    if (syncChat.timer >= chatInfo.delay) {
                        if (!toggles.onlyMusic()) {
                            if (chatInfo.trans) {
                                player.chatMessage = chatInfo.chat;
                                player.chatCountdown = 3000;
                            } else {
                                io.send("6", chatInfo.chat);
                            }
                        }
                        syncChat.index++;
                    }
                } else if (syncChat.chatIndex >= 0) {
                    spamchat = false;
                    audios[syncChat.chatIndex].currentTime = 0;
                    audios[syncChat.chatIndex].pause();
                    if (toggles.loopsongs()) {
                        let amount = parseInt(document.getElementById("chatType").value);
                        document.getElementById("chatType").value = (amount + 1 < audios.length ? amount + 1 : 0);
                        doSpamChatStuff();
                    }
                }
            }
        }
        if (deathTextScale < 120) {
            deathTextScale += 0.15 * delta;
            diedText.style.fontSize = Math.min(Math.round(deathTextScale), 120) + "px";
        }
        if (player) {
            var tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
            var tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
            var camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
            if (tmpDist > 0.05) {
                camX += camSpd * Math.cos(tmpDir);
                camY += camSpd * Math.sin(tmpDir);
            } else {
                camX = player.x;
                camY = player.y;
            }
        } else {
            camX = config.mapScale / 2;
            camY = config.mapScale / 2;
        }
        var lastTime = now - (1000 / config.serverUpdateRate);
        var tmpDiff;
        for (var i = 0; i < players.length + ais.length; ++i) {
            tmpObj = players[i] || ais[i - players.length];
            if (tmpObj && tmpObj.visible) {
                if (tmpObj.forcePos) {
                    tmpObj.x = tmpObj.x2;
                    tmpObj.y = tmpObj.y2;
                    tmpObj.dir = tmpObj.d2;
                } else {
                    var total = tmpObj.t2 - tmpObj.t1;
                    var fraction = lastTime - tmpObj.t1;
                    var ratio = (fraction / total);
                    var rate = 170;
                    tmpObj.dt += delta;
                    var tmpRate = Math.min(1.7, tmpObj.dt / rate);
                    var tmpDiff = (tmpObj.x2 - tmpObj.x1);
                    tmpObj.x = tmpObj.x1 + (tmpDiff * tmpRate);
                    tmpDiff = (tmpObj.y2 - tmpObj.y1);
                    tmpObj.y = tmpObj.y1 + (tmpDiff * tmpRate);
                    tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                }
            }
        }
        if (freeCam.status) {
            if (lastMoveDir != null && lastMoveDir != undefined) {
                let speed = 1.5 * delta;
                freeCam.x += Math.cos(lastMoveDir) * speed;
                freeCam.y += Math.sin(lastMoveDir) * speed;
            }
            camX = freeCam.x;
            camY = freeCam.y;
        }
        xOffset = camX - (maxScreenWidth / 2);
        yOffset = camY - (maxScreenHeight / 2);
        if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        } else if (config.snowBiomeTop - yOffset >= 0) {
            mainContext.fillStyle = "#fff";
            mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth, maxScreenHeight - (config.snowBiomeTop - yOffset));
        } else {
            mainContext.fillStyle = "#b6db66";
            mainContext.fillRect(0, 0, maxScreenWidth, (config.mapScale - config.snowBiomeTop - yOffset));
            mainContext.fillStyle = "#dbc666";
            mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth, maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
        }
        waterMult += waterPlus * config.waveSpeed * delta;
        if (waterMult >= config.waveMax) {
            waterMult = config.waveMax;
            waterPlus = -1;
        } else if (waterMult <= 1) {
            waterMult = waterPlus = 1;
        }
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "#dbc666";
        renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
        mainContext.fillStyle = "#91b2db";
        renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);

        mainContext.lineWidth = 4;
        mainContext.strokeStyle = "#000";
        mainContext.globalAlpha = 0.06;
        mainContext.beginPath();
        for (var x = -camX; x < maxScreenWidth; x += maxScreenHeight / 18) {
            if (x > 0) {
                mainContext.moveTo(x, 0);
                mainContext.lineTo(x, maxScreenHeight);
            }
        }
        for (var y = -camY; y < maxScreenHeight; y += maxScreenHeight / 18) {
            if (x > 0) {
                mainContext.moveTo(0, y);
                mainContext.lineTo(maxScreenWidth, y);
            }
        }
        mainContext.stroke();

        mainContext.globalAlpha = 1;
        mainContext.strokeStyle = outlineColor;
        renderGameObjects(-1, xOffset, yOffset);
        mainContext.globalAlpha = 1;
        mainContext.lineWidth = outlineWidth;
        renderProjectiles(0, xOffset, yOffset);
        renderPlayers(xOffset, yOffset, 0);
        mainContext.globalAlpha = 1;
        for (var i = 0; i < ais.length; ++i) {
            tmpObj = ais[i];
            if (tmpObj.active && tmpObj.visible) {
                tmpObj.animate(delta);
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - (Math.PI / 2));
                renderAI(tmpObj, mainContext);
                mainContext.restore();
            }
        }
        renderGameObjects(0, xOffset, yOffset);
        renderProjectiles(1, xOffset, yOffset);
        renderGameObjects(1, xOffset, yOffset);
        renderPlayers(xOffset, yOffset, 1);
        renderGameObjects(2, xOffset, yOffset);
        renderGameObjects(3, xOffset, yOffset);
        mainContext.fillStyle = "#000";
        mainContext.globalAlpha = 0.09;
        if (xOffset <= 0) {
            mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
        } if (config.mapScale - xOffset <= maxScreenWidth) {
            var tmpY = Math.max(0, -yOffset);
            mainContext.fillRect(config.mapScale - xOffset, tmpY, maxScreenWidth - (config.mapScale - xOffset), maxScreenHeight - tmpY);
        } if (yOffset <= 0) {
            mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
        } if (config.mapScale - yOffset <= maxScreenHeight) {
            var tmpX = Math.max(0, -xOffset);
            var tmpMin = 0;
            if (config.mapScale - xOffset <= maxScreenWidth)
                tmpMin = maxScreenWidth - (config.mapScale - xOffset);
            mainContext.fillRect(tmpX, config.mapScale - yOffset, (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
        }
        if (toggles.buildingHealth()) {
            mainContext.globalAlpha = 1;
            for (let i = 0; i < closeObjects.length; i++) {
                let tmpObj = closeObjects[i];
                if (tmpObj && tmpObj.currentHealth && tmpObj.currentHealth != tmpObj.health && Math.hypot(tmpObj.y - player.y, tmpObj.x - player.x) < 300 + tmpObj.scale) {
                    mainContext.fillStyle = darkOutlineColor;
                    mainContext.roundRect(tmpObj.x + tmpObj.xWiggle - xOffset - config.healthBarWidth / 2 - config.healthBarPad, tmpObj.y + tmpObj.yWiggle - yOffset - config.healthBarPad, config.healthBarWidth + config.healthBarPad * 2, 17, 8);
                    mainContext.fill();
                    mainContext.fillStyle = tmpObj.owner.sid == player.sid ? "#8ecc51" : isAlly(tmpObj.owner.sid) ? "#ffff00" : "#cc5151";
                    mainContext.roundRect(tmpObj.x + tmpObj.xWiggle - xOffset - config.healthBarWidth / 2, tmpObj.y + tmpObj.yWiggle - yOffset, config.healthBarWidth * (tmpObj.currentHealth / tmpObj.health), 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                }
            }
        }
        for (let i = 0; i < deathAnimations.length; i++) {
            let death = deathAnimations[i];
            if (death) {
                try {
                    if (death.globalIndex == null) death.globalIndex = 1;
                    death.globalIndex -= 0.0024 * delta;
                    mainContext.save();
                    mainContext.globalAlpha = Math.max(death.globalIndex, 0);
                    mainContext.translate(death.x - xOffset, death.y - yOffset);
                    mainContext.rotate(death.dir + death.dirPlus);
                    renderPlayer(death, mainContext);
                    mainContext.restore();
                    if (death.globalIndex <= 0) {
                        deathAnimations.splice(i, 1);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        }
        for (let i = 0; i < objectDeathAnimation.length; i++) {
            let death = objectDeathAnimation[i];
            if (death) {
                try {
                    let image = getItemSprite(death);
                    if (death.globalIndex == null) death.globalIndex = death.name == "pit trap" ? 0.6 : 1;
                    death.globalIndex -= 0.0024 * delta;
                    death.scale += (death.name == "pit trap" ? 0.024 : 0.02) * delta;
                    mainContext.save();
                    mainContext.globalAlpha = Math.max(death.globalIndex, 0);
                    mainContext.translate(death.x - xOffset, death.y - yOffset);
                    mainContext.rotate(death.dir);
                    mainContext.drawImage(image, -(image.width / 2), -(image.height / 2));
                    mainContext.restore();
                    if (death.globalIndex <= 0) {
                        objectDeathAnimation.splice(i, 1);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        }
        for (let i = 0; i < placer.markers.length; i++) {
            let marker = placer.markers[i];
            if (marker && !isNaN(marker.x) && !isNaN(marker.y)) {
                mainContext.save();
                mainContext.globalAlpha = marker.name == "pit trap" ? 0.18 : 0.3;
                mainContext.translate(marker.x - xOffset, marker.y - yOffset);
                mainContext.rotate(marker.angle);
                let image = getItemSprite(marker);
                mainContext.drawImage(image, -(image.width / 2), -(image.height / 2));
                mainContext.restore();
            }
        }
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
        if (isPushing) {
            mainContext.globalAlpha = 1;
            mainContext.lineWidth = 6;
            if (isPushing.path) {
                mainContext.beginPath();
                mainContext.strokeStyle = "#00ffff";
                mainContext.moveTo(player.x - xOffset, player.y - yOffset);
                for (let i = 0; i < isPushing.path.length; i++) {
                    let path = isPushing.path[i];
                    if (path) {
                        mainContext.lineTo(path.x - xOffset, path.y - yOffset);
                    }
                }
                mainContext.stroke();
                mainContext.beginPath();
                mainContext.strokeStyle = "#fff";
                mainContext.moveTo(isPushing.path[isPushing.path.length - 1].x - xOffset, isPushing.path[isPushing.path.length - 1].y - yOffset);
                mainContext.lineTo(isPushing.first.x - xOffset, isPushing.first.y - yOffset);
                mainContext.lineTo(isPushing.last.x - xOffset, isPushing.last.y - yOffset);
                mainContext.stroke();
            } else {
                mainContext.strokeStyle = "#fff";
                mainContext.beginPath();
                mainContext.moveTo(player.x - xOffset, player.y - yOffset);
                mainContext.lineTo(isPushing.first.x - xOffset, isPushing.first.y - yOffset);
                mainContext.lineTo(isPushing.last.x - xOffset, isPushing.last.y - yOffset);
                mainContext.stroke();
            }
        }
        mainContext.strokeStyle = darkOutlineColor;
        for (var i = 0; i < players.length + ais.length; ++i) {
            tmpObj = players[i] || ais[i - players.length];
            if (tmpObj.visible) {
                if (10 != tmpObj.skinIndex || (tmpObj == player) || (tmpObj.team && tmpObj.team == player.team)) {
                    var tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || "");
                    let isBotSid = tmpObj.isPlayer ? botSids.find(e => tmpObj.sid == e) : false;
                    if (tmpText != "" && !isBotSid) {
                        mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                        mainContext.fillStyle = "#fff";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                        mainContext.lineJoin = "round";
                        mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                        mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                        if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                            var tmpS = config.crownIconScale;
                            var tmpX = tmpObj.x - xOffset - (tmpS / 2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
                            mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                        }
                        if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                            var tmpS = config.crownIconScale;
                            var tmpX = tmpObj.x - xOffset - (tmpS / 2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
                            mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                        }
                        if ((oneTickBowInsta || insta.oneShot || moveTicking) && enemies.closest && tmpObj.sid == enemies.closest.sid && iconSprites["crosshair"].isLoaded) {
                            tmpS = 2 * config.playerScale - 10;
                            mainContext.drawImage(iconSprites["crosshair"], tmpObj.x - xOffset - tmpS / 2, tmpObj.y - yOffset - tmpS / 2, tmpS, tmpS);
                        }
                    } else if (isBotSid) {
                        tmpText = "";
                    }
                    if (tmpObj.isPlayer) {
                        mainContext.textAlign = "center";
                        mainContext.fillStyle = "#fff";
                        mainContext.lineJoin = "round";
                        mainContext.font = "20px Hammersmith One";
                        mainContext.strokeStyle = darkOutlineColor;
                        mainContext.lineWidth = 6;
                        mainContext.strokeText(tmpObj.sid == player.sid ? "" : tmpObj.sid, tmpObj.x - xOffset, tmpObj.y - yOffset);
                        mainContext.fillText(tmpObj.sid == player.sid ? "" : tmpObj.sid, tmpObj.x - xOffset, tmpObj.y - yOffset);
                        if (tmpObj != player && !isAlly(tmpObj.sid)) {
                            let text = tmpObj.primary.id + " " + tmpObj.secondary.id;
                            mainContext.textAlign = "center";
                            mainContext.fillStyle = "#fff";
                            mainContext.lineJoin = "round";
                            mainContext.font = "20px Hammersmith One";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.lineWidth = 6;
                            mainContext.strokeText(text, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + (30));
                            mainContext.fillText(text, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + (30));
                        } else if (tmpObj == player) {
                            let text = SHIFTHOLD;
                            mainContext.textAlign = "center";
                            mainContext.fillStyle = "#fff";
                            mainContext.lineJoin = "round";
                            mainContext.font = "20px Hammersmith One";
                            mainContext.strokeStyle = darkOutlineColor;
                            mainContext.lineWidth = 6;
                            mainContext.strokeText(text, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + (30));
                            mainContext.fillText(text, tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + (30));
                        }
                    }
                    if (tmpObj.isPlayer) {
                        mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                        mainContext.fillStyle = "#ff0000";
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = tmpObj.nameScale ? 11 : 8;
                        mainContext.lineJoin = "round";
                        mainContext.strokeText(tmpObj.shameCount, (tmpObj.iconIndex == 1 ? (tmpObj.x - xOffset - 30 + mainContext.measureText(tmpText).width / 2 + config.crownPad * 3.5 + 5) : (tmpObj.x - xOffset + mainContext.measureText(tmpText).width / 2 + config.crownPad)), tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                        mainContext.fillText(tmpObj.shameCount, (tmpObj.iconIndex == 1 ? (tmpObj.x - xOffset - 30 + mainContext.measureText(tmpText).width / 2 + config.crownPad * 3.5 + 5) : (tmpObj.x - xOffset + mainContext.measureText(tmpText).width / 2 + config.crownPad)), tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                        if (tmpObj.secondary.reload < 1) {
                            mainContext.fillStyle = darkOutlineColor;
                            mainContext.roundRect(tmpObj.x - xOffset + 2 - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13, 2 * 23.5 + 2 * config.healthBarPad, 17, 10);
                            mainContext.fill();
                            mainContext.fillStyle = "#a5974c";
                            mainContext.roundRect(tmpObj.x - xOffset + 2, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + config.healthBarPad, 2 * 23.5 * (tmpObj.secondary.reload), 16 - 2 * config.healthBarPad, 10);
                            mainContext.fill();
                        }
                        if (tmpObj.primary.reload < 1) {
                            mainContext.fillStyle = darkOutlineColor;
                            mainContext.roundRect(tmpObj.x - xOffset - 50 - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13, 2 * 23.5 + 2 * config.healthBarPad, 17, 10);
                            mainContext.fill();
                            mainContext.fillStyle = "#a5974c";
                            mainContext.roundRect(tmpObj.x - xOffset - 50, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + config.healthBarPad, 2 * 23.5 * (tmpObj.primary.reload), 16 - 2 * config.healthBarPad, 10);
                            mainContext.fill();
                        }
                    }
                    if (!tmpObj.isPlayer && tmpObj.name == "MOOSTAFA") {
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - 50 - config.healthBarPad, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13, 2 * 25.5 + 2 * config.healthBarPad, 17, 10);
                        mainContext.fill();
                        mainContext.fillStyle = "#a5974c";
                        mainContext.roundRect(tmpObj.x - xOffset - 50, tmpObj.y - yOffset + tmpObj.scale + config.nameY - 13 + config.healthBarPad, 2 * 25.5 * (tmpObj.weaponReload || 1), 16 - 2 * config.healthBarPad, 10);
                        mainContext.fill();
                    }
                    if (tmpObj.isPlayer && tmpObj.tracker && tmpObj.sid != player.sid && !botSids.find(e => tmpObj.sid == e) && !isAlly(tmpObj.sid) && dist2(player, tmpObj) >= 900) {
                        mainContext.save();
                        mainContext.lineWidth = 5.5;
                        mainContext.strokeStyle = "#fff";
                        mainContext.beginPath();
                        mainContext.moveTo(player.x - xOffset, player.y - yOffset);
                        mainContext.lineTo(tmpObj.x - xOffset, tmpObj.y - yOffset);
                        mainContext.stroke();
                        mainContext.restore();
                    }
                    if (tmpObj.health > 0) {
                        mainContext.fillStyle = darkOutlineColor;
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) + (config.healthBarPad * 2), 17, 8);
                        mainContext.fill();
                        mainContext.fillStyle = (tmpObj == player || (tmpObj.team && tmpObj.team == player.team)) ? "#8ecc51" : "#cc5151";
                        mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth)), 17 - config.healthBarPad * 2, 7);
                        mainContext.fill();
                    }
                }
            }
        }
        textManager.update(delta, mainContext, xOffset, yOffset);
        for (let i = 0; i < players.length; ++i) {
            let tmpObj = players[i];
            if (tmpObj && tmpObj.chatCountdown > 0) {
                tmpObj.chatCountdown -= delta;
                if (tmpObj.chatCountdown <= 0)
                    tmpObj.chatCountdown = 0;
                mainContext.font = "32px 'Hammersmith One', sans-serif";
                var tmpSize = mainContext.measureText(tmpObj.chatMessage);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                var tmpX = tmpObj.x - xOffset;
                var tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
                var tmpH = 47;
                var tmpW = tmpSize.width + 17;
                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.fillStyle = "#fff";
                mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
            }
        }
        renderMinimap(delta);
    }
    function doUpdate() {
        fpsCount++;
        if (Date.now() - fpsLast >= 1000) {
            fps = fpsCount;
            fpsCount = 0;
            fpsLast = Date.now();
        }
        window.fps = fps;
        now = Date.now();
        delta = now - lastUpdate;
        lastUpdate = now;
        updateGame();
        window.requestAnimFrame(doUpdate);
    }
    doUpdate();
}());
