(() => {
    "use strict";

    const API_BASE =
        "https://steve-anita-family-access.stevehill2683.workers.dev";

    const SESSION_STORAGE_KEY =
        "steve-anita-family-session";

    const ACTIVITY_UPDATE_INTERVAL_MS =
        60 * 1000;

    const state = {
        memberName: null,
        isOwner: false,
        loggingEnabled: false,
        visitId: null,
        sessionToken: null,
        startedAt: null,
        idleWarningSeconds: 900,
        idleLogoutSeconds: 1020,
        idleWarningTimer: null,
        idleLogoutTimer: null,
        idleCountdownTimer: null,
        lastActivitySentAt: 0,
        requestInProgress: false
    };

    const byId = (id) =>
        document.getElementById(id);

    const elements = {
        accessPanel:
            byId("menuAccessPanel"),

        accessForm:
            byId("menuAccessForm"),

        accessCode:
            byId("menuAccessCode"),

        accessMessage:
            byId("menuAccessMessage"),

        accessControls:
            byId("menuAccessControls"),

        mainNavigation:
            byId("mainNavigation"),

        musicPlayer:
            byId("siteMusicPlayer"),

        forgotCodeButton:
            byId("menuForgotCodeButton"),

        forgotCodeHelp:
            byId("menuForgotCodeHelp"),

        submitButton:
            document.querySelector(
                "#menuAccessForm button[type='submit']"
            )
    };

    const detectDeviceType = () => {
        const width =
            window.innerWidth;

        const userAgent =
            navigator.userAgent.toLowerCase();

        if (
            /ipad|tablet/.test(
                userAgent
            )
        ) {
            return "Tablet";
        }

        if (
            /android|iphone|mobile/.test(
                userAgent
            ) ||
            width < 700
        ) {
            return "Phone";
        }

        return "Computer";
    };

    const detectBrowserFamily = () => {
        const userAgent =
            navigator.userAgent;

        if (/Edg\//.test(userAgent)) {
            return "Edge";
        }

        if (/OPR\//.test(userAgent)) {
            return "Opera";
        }

        if (/Firefox\//.test(userAgent)) {
            return "Firefox";
        }

        if (/Chrome\//.test(userAgent)) {
            return "Chrome";
        }

        if (/Safari\//.test(userAgent)) {
            return "Safari";
        }

        return "Other";
    };

    const getClientTimezone = () => {
        try {
            return (
                Intl.DateTimeFormat()
                    .resolvedOptions()
                    .timeZone ||
                "Unknown"
            );
        } catch {
            return "Unknown";
        }
    };

    const showMessage = (
        text,
        type = "normal"
    ) => {
        if (!elements.accessMessage) {
            return;
        }

        elements.accessMessage.textContent =
            text;

        elements.accessMessage.className =
            "menu-access-message";

        if (type === "error") {
            elements.accessMessage
                .classList.add(
                    "is-error"
                );
        }
    };

    const setRequestInProgress = (
        inProgress
    ) => {
        state.requestInProgress =
            inProgress;

        if (
            !elements.submitButton
        ) {
            return;
        }

        elements.submitButton.disabled =
            inProgress;

        elements.submitButton.textContent =
            inProgress
                ? "Checking..."
                : "Open Menu";
    };

    const apiRequest = async (
        endpoint,
        body,
        options = {}
    ) => {
        const response =
            await fetch(
                `${API_BASE}${endpoint}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body),

                    cache: "no-store",

                    keepalive:
                        options.keepalive ===
                        true
                }
            );

        let data = null;

        try {
            data =
                await response.json();
        } catch {
            throw new Error(
                "The security service returned an unreadable response."
            );
        }

        if (!response.ok) {
            const error =
                new Error(
                    data.message ||
                    "The request was not accepted."
                );

            error.code =
                data.code ||
                "REQUEST_FAILED";

            error.status =
                response.status;

            throw error;
        }

        return data;
    };

    const saveSession = () => {
        if (
            !state.sessionToken
        ) {
            try {
                sessionStorage.removeItem(
                    SESSION_STORAGE_KEY
                );
            } catch {
                /* Browser storage unavailable. */
            }

            return;
        }

        try {
            sessionStorage.setItem(
                SESSION_STORAGE_KEY,

                JSON.stringify({
                    memberName:
                        state.memberName,

                    isOwner:
                        state.isOwner,

                    loggingEnabled:
                        state.loggingEnabled,

                    visitId:
                        state.visitId,

                    sessionToken:
                        state.sessionToken,

                    startedAt:
                        state.startedAt
                            ? state.startedAt
                                .toISOString()
                            : null,

                    idleWarningSeconds:
                        state.idleWarningSeconds,

                    idleLogoutSeconds:
                        state.idleLogoutSeconds
                })
            );
        } catch {
            /* Browser storage unavailable. */
        }
    };

    const clearStoredSession = () => {
        try {
            sessionStorage.removeItem(
                SESSION_STORAGE_KEY
            );
        } catch {
            /* Browser storage unavailable. */
        }
    };

    const clearIdleTimers = () => {
        window.clearTimeout(
            state.idleWarningTimer
        );

        window.clearTimeout(
            state.idleLogoutTimer
        );

        window.clearInterval(
            state.idleCountdownTimer
        );

        state.idleWarningTimer =
            null;

        state.idleLogoutTimer =
            null;

        state.idleCountdownTimer =
            null;
    };

    const removeIdleDialog = () => {
        const existingDialog =
            byId(
                "familyAccessIdleDialog"
            );

        if (existingDialog) {
            existingDialog.remove();
        }
    };

    const resetLocalState = () => {
        clearIdleTimers();
        removeIdleDialog();
        clearStoredSession();

        state.memberName =
            null;

        state.isOwner =
            false;

        state.loggingEnabled =
            false;

        state.visitId =
            null;

        state.sessionToken =
            null;

        state.startedAt =
            null;

        state.lastActivitySentAt =
            0;

        if (
            elements.mainNavigation
        ) {
            elements.mainNavigation.hidden =
                true;
        }

        if (
            elements.musicPlayer
        ) {
            elements.musicPlayer.hidden =
                true;

            const audioPlayer =
                byId("siteMusic");

            if (audioPlayer) {
                audioPlayer.pause();
            }
        }

        if (
            elements.accessPanel
        ) {
            elements.accessPanel.hidden =
                false;
        }

        if (
            elements.accessControls
        ) {
            elements.accessControls.hidden =
                false;
        }

        if (
            elements.accessCode
        ) {
            elements.accessCode.value =
                "";
        }
    };

    const openMenu = () => {
        if (
            elements.mainNavigation
        ) {
            elements.mainNavigation
                .classList.remove(
                    "menu-is-opening"
                );

            elements.mainNavigation.hidden =
                false;

            void elements
                .mainNavigation
                .offsetWidth;

            elements.mainNavigation
                .classList.add(
                    "menu-is-opening"
                );
        }

        if (
            elements.accessPanel
        ) {
            elements.accessPanel.hidden =
                true;
        }

        if (
            elements.musicPlayer
        ) {
            elements.musicPlayer.hidden =
                false;
        }
    };

    const getCurrentPageName = () => {
        const heading =
            document.querySelector(
                "main h1, h1"
            );

        if (
            heading &&
            heading.textContent.trim()
        ) {
            return heading
                .textContent
                .trim();
        }

        return (
            document.title ||
            "Steve & Anita"
        );
    };

    const getCurrentPagePath = () => {
        return (
            window.location.pathname ||
            "/"
        );
    };

    const sendActivity = async ({
        force = false
    } = {}) => {
        if (
            !state.sessionToken
        ) {
            return false;
        }

        const now =
            Date.now();

        if (
            !force &&
            now -
                state.lastActivitySentAt <
                ACTIVITY_UPDATE_INTERVAL_MS
        ) {
            return true;
        }

        state.lastActivitySentAt =
            now;

        try {
            await apiRequest(
                "/activity",
                {
                    sessionToken:
                        state.sessionToken
                }
            );

            return true;
        } catch (error) {
            const sessionEnded =
                error.code ===
                    "IDLE_TIMEOUT" ||
                error.code ===
                    "SESSION_ENDED" ||
                error.code ===
                    "SESSION_EXPIRED" ||
                error.code ===
                    "SESSION_INVALID" ||
                error.code ===
                    "SESSION_REVOKED";

            if (sessionEnded) {
                resetLocalState();

                showMessage(
                    error.message ||
                    "Your session ended. Please sign in again.",
                    "error"
                );

                if (
                    !elements.accessForm
                ) {
                    window.location.href =
                        "index.html";
                }

                return false;
            }

            return false;
        }
    };

    const recordCurrentPage =
        async () => {
            if (
                !state.sessionToken
            ) {
                return;
            }

            try {
                await apiRequest(
                    "/page",
                    {
                        sessionToken:
                            state.sessionToken,

                        action:
                            "enter",

                        pageName:
                            getCurrentPageName(),

                        pagePath:
                            getCurrentPagePath()
                    }
                );
            } catch (error) {
                const sessionEnded =
                    error.code ===
                        "IDLE_TIMEOUT" ||
                    error.code ===
                        "SESSION_ENDED" ||
                    error.code ===
                        "SESSION_EXPIRED" ||
                    error.code ===
                        "SESSION_INVALID" ||
                    error.code ===
                        "SESSION_REVOKED";

                if (sessionEnded) {
                    resetLocalState();

                    if (
                        !elements.accessForm
                    ) {
                        window.location.href =
                            "index.html";
                    }
                }
            }
        };

    const leaveCurrentPage = () => {
        if (
            !state.sessionToken
        ) {
            return;
        }

        void apiRequest(
            "/page",
            {
                sessionToken:
                    state.sessionToken,

                action:
                    "leave",

                pageName:
                    getCurrentPageName(),

                pagePath:
                    getCurrentPagePath()
            },
            {
                keepalive: true
            }
        ).catch(() => {
            /* Navigation must not be delayed. */
        });
    };

    const logoutSession = async (
        reason = "manual_logout"
    ) => {
        if (
            !state.sessionToken
        ) {
            resetLocalState();

            if (
                !elements.accessForm
            ) {
                window.location.href =
                    "index.html";
            }

            return;
        }

        const token =
            state.sessionToken;

        clearIdleTimers();
        removeIdleDialog();

        try {
            await apiRequest(
                "/logout",
                {
                    sessionToken:
                        token,

                    reason
                }
            );
        } catch {
            /*
                Local sign-out still completes if
                the network request cannot finish.
            */
        }

        resetLocalState();

        if (
            elements.accessForm
        ) {
            showMessage(
                "Signed out. Enter your six-digit access code."
            );

            if (
                elements.accessCode
            ) {
                elements.accessCode.focus();
            }
        } else {
            window.location.href =
                "index.html";
        }
    };

    const continueSession =
        async () => {
            clearIdleTimers();
            removeIdleDialog();

            const continued =
                await sendActivity({
                    force: true
                });

            if (
                continued &&
                state.sessionToken
            ) {
                scheduleIdleWarning();
            }
        };

    const showIdleWarning = () => {
        if (
            !state.sessionToken
        ) {
            return;
        }

        removeIdleDialog();

        const warningWindowSeconds =
            Math.max(
                1,

                state.idleLogoutSeconds -
                    state.idleWarningSeconds
            );

        const logoutAt =
            Date.now() +
            warningWindowSeconds *
                1000;

        const dialog =
            document.createElement(
                "dialog"
            );

        dialog.id =
            "familyAccessIdleDialog";

        dialog.setAttribute(
            "aria-labelledby",
            "familyAccessIdleTitle"
        );

        dialog.innerHTML = `
            <div style="
                max-width: 420px;
                padding: 12px;
                font-family: Arial, Helvetica, sans-serif;
                text-align: center;
            ">
                <h2
                    id="familyAccessIdleTitle"
                    style="margin-top: 0;"
                >
                    Are you still there?
                </h2>

                <p>
                    Your family website session
                    will automatically end unless
                    you continue.
                </p>

                <p
                    id="familyAccessIdleCountdown"
                    style="
                        margin: 18px 0;
                        font-size: 1.35rem;
                        font-weight: 700;
                    "
                    aria-live="polite"
                >
                    Automatic logout in 2:00
                </p>

                <div style="
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                    flex-wrap: wrap;
                ">
                    <button
                        type="button"
                        id="familyAccessContinueButton"
                    >
                        Continue Secure Session
                    </button>

                    <button
                        type="button"
                        id="familyAccessSignOutButton"
                    >
                        Sign Out Now
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(
            dialog
        );

        const continueButton =
            byId(
                "familyAccessContinueButton"
            );

        const signOutButton =
            byId(
                "familyAccessSignOutButton"
            );

        const countdown =
            byId(
                "familyAccessIdleCountdown"
            );

        const updateCountdown = () => {
            if (!countdown) {
                return;
            }

            const remainingSeconds =
                Math.max(
                    0,

                    Math.ceil(
                        (
                            logoutAt -
                            Date.now()
                        ) / 1000
                    )
                );

            const minutes =
                Math.floor(
                    remainingSeconds / 60
                );

            const seconds =
                remainingSeconds % 60;

            countdown.textContent =
                "Automatic logout in " +
                `${minutes}:` +
                String(seconds)
                    .padStart(
                        2,
                        "0"
                    );
        };

        updateCountdown();

        state.idleCountdownTimer =
            window.setInterval(
                updateCountdown,
                1000
            );

        if (continueButton) {
            continueButton
                .addEventListener(
                    "click",
                    () => {
                        void continueSession();
                    }
                );
        }

        if (signOutButton) {
            signOutButton
                .addEventListener(
                    "click",
                    () => {
                        void logoutSession(
                            "manual_logout"
                        );
                    }
                );
        }

        if (
            typeof dialog.showModal ===
            "function"
        ) {
            dialog.showModal();
        } else {
            dialog.setAttribute(
                "open",
                ""
            );
        }

        state.idleLogoutTimer =
            window.setTimeout(
                () => {
                    void logoutSession(
                        "idle_timeout"
                    );
                },

                warningWindowSeconds *
                    1000
            );
    };

    function scheduleIdleWarning() {
        if (
            !state.sessionToken
        ) {
            return;
        }

        clearIdleTimers();

        state.idleWarningTimer =
            window.setTimeout(
                () => {
                    showIdleWarning();
                },

                state.idleWarningSeconds *
                    1000
            );
    }

    const beginSession = async (
        result,
        sessionToken,
        restoredStartedAt = null
    ) => {
        clearIdleTimers();
        removeIdleDialog();

        state.memberName =
            result.displayName ||
            state.memberName;

        state.isOwner =
            result.isOwner === true;

        state.loggingEnabled =
            result.loggingEnabled ===
            true;

        state.visitId =
            result.visitId ??
            null;

        state.sessionToken =
            sessionToken ||
            result.sessionToken ||
            state.sessionToken;

        state.startedAt =
            restoredStartedAt
                ? new Date(
                    restoredStartedAt
                )
                : new Date();

        state.idleWarningSeconds =
            Number(
                result.idleWarningSeconds ||
                900
            );

        state.idleLogoutSeconds =
            Number(
                result.idleLogoutSeconds ||
                1020
            );

        state.lastActivitySentAt =
            Date.now();

        saveSession();
        openMenu();
        scheduleIdleWarning();

        await recordCurrentPage();
    };

    const restoreSession = async () => {
        let storedValue = null;

        try {
            storedValue =
                sessionStorage.getItem(
                    SESSION_STORAGE_KEY
                );
        } catch {
            return false;
        }

        if (!storedValue) {
            return false;
        }

        let storedSession = null;

        try {
            storedSession =
                JSON.parse(
                    storedValue
                );
        } catch {
            clearStoredSession();
            return false;
        }

        if (
            !storedSession ||
            !storedSession.sessionToken
        ) {
            clearStoredSession();
            return false;
        }

        state.sessionToken =
            storedSession.sessionToken;

        try {
            const result =
                await apiRequest(
                    "/session",
                    {
                        sessionToken:
                            storedSession
                                .sessionToken
                    }
                );

            await beginSession(
                result,
                storedSession.sessionToken,
                storedSession.startedAt
            );

            return true;
        } catch {
            resetLocalState();

            return false;
        }
    };

    if (
        elements.forgotCodeButton &&
        elements.forgotCodeHelp
    ) {
        elements.forgotCodeButton
            .addEventListener(
                "click",
                () => {
                    const willShowHelp =
                        elements
                            .forgotCodeHelp
                            .hidden;

                    elements
                        .forgotCodeHelp
                        .hidden =
                        !willShowHelp;

                    elements
                        .forgotCodeButton
                        .setAttribute(
                            "aria-expanded",
                            String(
                                willShowHelp
                            )
                        );
                }
            );
    }

    if (
        elements.accessForm &&
        elements.accessCode
    ) {
        elements.accessForm
            .addEventListener(
                "submit",
                async (event) => {
                    event.preventDefault();

                    if (
                        state.requestInProgress
                    ) {
                        return;
                    }

                    const enteredCode =
                        elements
                            .accessCode
                            .value
                            .trim();

                    if (
                        !/^\d{6}$/.test(
                            enteredCode
                        )
                    ) {
                        showMessage(
                            "Enter exactly six digits.",
                            "error"
                        );

                        elements
                            .accessCode
                            .focus();

                        return;
                    }

                    setRequestInProgress(
                        true
                    );

                    showMessage(
                        "Checking your access code..."
                    );

                    try {
                        const result =
                            await apiRequest(
                                "/login",
                                {
                                    code:
                                        enteredCode,

                                    deviceType:
                                        detectDeviceType(),

                                    browserFamily:
                                        detectBrowserFamily(),

                                    clientTimezone:
                                        getClientTimezone(),

                                    testLogging:
                                        false
                                }
                            );

                        elements
                            .accessCode
                            .value =
                            "";

                        await beginSession(
                            result,
                            result.sessionToken
                        );
                    } catch (error) {
                        showMessage(
                            error.message ||
                            "Access code not recognized.",
                            "error"
                        );

                        elements
                            .accessCode
                            .select();
                    } finally {
                        setRequestInProgress(
                            false
                        );
                    }
                }
            );
    }

    const activityEvents = [
        "pointerdown",
        "keydown",
        "touchstart"
    ];

    activityEvents.forEach(
        (eventName) => {
            document.addEventListener(
                eventName,

                () => {
                    if (
                        !state.sessionToken
                    ) {
                        return;
                    }

                    const idleDialog =
                        byId(
                            "familyAccessIdleDialog"
                        );

                    if (
                        idleDialog &&
                        idleDialog.open
                    ) {
                        return;
                    }

                    scheduleIdleWarning();

                    void sendActivity();
                },

                {
                    passive: true
                }
            );
        }
    );

    window.addEventListener(
        "pagehide",
        () => {
            leaveCurrentPage();
        }
    );

    window.SteveAnitaFamilyAccess = {
        signOut: () => {
            void logoutSession(
                "manual_logout"
            );
        }
    };

    void restoreSession().then(
        (restored) => {
            if (restored) {
                return;
            }

            if (
                elements.accessForm
            ) {
                showMessage(
                    "Enter your six-digit family access code."
                );

                if (
                    elements.accessCode
                ) {
                    elements
                        .accessCode
                        .focus();
                }
            }
        }
    );
})();
