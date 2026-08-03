(() => {
    "use strict";

    const API_BASE =
        "https://steve-anita-family-access-test.stevehill2683.workers.dev";

    const SESSION_STORAGE_KEY =
        "steve-anita-visitor-log-test-session";

    const ACTIVITY_UPDATE_INTERVAL_MS = 60 * 1000;

    const state = {
        memberName: null,
        isOwner: false,
        loggingEnabled: false,
        visitId: null,
        sessionToken: null,
        startedAt: null,
        pageNumber: 0,
        idleWarningSeconds: 900,
        idleLogoutSeconds: 1020,
        idleWarningTimer: null,
        idleLogoutTimer: null,
        lastActivitySentAt: 0,
        requestInProgress: false
    };

    const byId = (id) => document.getElementById(id);

    const elements = {
        accessForm: byId("accessTestForm"),
        accessCode: byId("accessTestCode"),
        accessMessage: byId("accessTestMessage"),
        submitButton: document.querySelector(
            "#accessTestForm button[type='submit']"
        ),

        demoMemberButton: byId("demoMemberButton"),
        demoSteveButton: byId("demoSteveButton"),
        steveTestLogging: byId("steveTestLogging"),
        demoControls: document.querySelector(".demo-controls"),

        signedOutPanel: byId("signedOutPanel"),
        activeSessionPanel: byId("activeSessionPanel"),

        memberName: byId("activeMemberName"),
        deviceType: byId("activeDeviceType"),
        visitStarted: byId("visitStarted"),

        loggingStatus: byId("loggingStatus"),
        pageHistory: byId("pageHistory"),

        simulatePageButton: byId("simulatePageButton"),
        testIdleButton: byId("testIdleButton"),
        logoutButton: byId("logoutButton"),

        idleDialog: byId("idleDialog"),
        continueSessionButton: byId("continueSessionButton"),
        idleLogoutButton: byId("idleLogoutButton")
    };

    const formatDateTime = (date) => {
        return new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "medium"
        }).format(date);
    };

    const detectDeviceType = () => {
        const width = window.innerWidth;
        const userAgent = navigator.userAgent.toLowerCase();

        if (/ipad|tablet/.test(userAgent)) {
            return "Tablet";
        }

        if (
            /android|iphone|mobile/.test(userAgent) ||
            width < 700
        ) {
            return "Phone";
        }

        return "Computer";
    };

    const detectBrowserFamily = () => {
        const userAgent = navigator.userAgent;

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
        elements.accessMessage.textContent = text;
        elements.accessMessage.className =
            "test-message";

        if (type === "error") {
            elements.accessMessage.classList.add(
                "is-error"
            );
        }

        if (type === "success") {
            elements.accessMessage.classList.add(
                "is-success"
            );
        }
    };

    const setRequestInProgress = (
        inProgress
    ) => {
        state.requestInProgress = inProgress;

        if (elements.submitButton) {
            elements.submitButton.disabled =
                inProgress;

            elements.submitButton.textContent =
                inProgress
                    ? "Checking..."
                    : "Test Secure Login";
        }
    };

    const apiRequest = async (
        endpoint,
        body,
        options = {}
    ) => {
        const response = await fetch(
            `${API_BASE}${endpoint}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(body),

                cache: "no-store",

                keepalive:
                    options.keepalive === true
            }
        );

        let data = null;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "Cloudflare returned an unreadable response."
            );
        }

        if (!response.ok) {
            const error = new Error(
                data.message ||
                    "The request was not accepted."
            );

            error.code =
                data.code ||
                "REQUEST_FAILED";

            error.status = response.status;

            throw error;
        }

        return data;
    };

    const clearIdleTimers = () => {
        window.clearTimeout(
            state.idleWarningTimer
        );

        window.clearTimeout(
            state.idleLogoutTimer
        );

        state.idleWarningTimer = null;
        state.idleLogoutTimer = null;
    };

    const closeIdleDialog = () => {
        if (elements.idleDialog.open) {
            elements.idleDialog.close();
        }
    };

    const saveSession = () => {
        if (!state.sessionToken) {
            sessionStorage.removeItem(
                SESSION_STORAGE_KEY
            );

            return;
        }

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
    };

    const clearStoredSession = () => {
        sessionStorage.removeItem(
            SESSION_STORAGE_KEY
        );
    };

    const appendPageHistory = (
        pageName,
        pagePath,
        enteredAt
    ) => {
        state.pageNumber += 1;

        const item =
            document.createElement("li");

        const enteredDate = enteredAt
            ? new Date(
                `${enteredAt.replace(
                    " ",
                    "T"
                )}Z`
            )
            : new Date();

        item.textContent =
            `${pageName} ` +
            `(${pagePath}) — ` +
            formatDateTime(enteredDate);

        elements.pageHistory.appendChild(
            item
        );
    };

    const updateSessionDisplay = () => {
        elements.memberName.textContent =
            state.memberName ||
            "Not signed in";

        elements.deviceType.textContent =
            detectDeviceType();

        elements.visitStarted.textContent =
            state.startedAt
                ? formatDateTime(
                    state.startedAt
                )
                : "Not started";

        if (state.loggingEnabled) {
            elements.loggingStatus.textContent =
                "Logging is ON. Page activity " +
                "is being sent to the separate " +
                "Cloudflare test database.";
        } else {
            elements.loggingStatus.textContent =
                "Logging is OFF for Steve.";
        }
    };

    const resetLocalState = () => {
        clearIdleTimers();
        closeIdleDialog();
        clearStoredSession();

        state.memberName = null;
        state.isOwner = false;
        state.loggingEnabled = false;
        state.visitId = null;
        state.sessionToken = null;
        state.startedAt = null;
        state.pageNumber = 0;
        state.lastActivitySentAt = 0;

        elements.pageHistory
            .replaceChildren();

        elements.activeSessionPanel.hidden =
            true;

        elements.signedOutPanel.hidden =
            false;

        elements.accessCode.value = "";
    };

    const showIdleWarning = () => {
        if (!state.sessionToken) {
            return;
        }

        if (
            typeof elements.idleDialog
                .showModal === "function"
        ) {
            elements.idleDialog.showModal();
        } else {
            elements.idleDialog.setAttribute(
                "open",
                ""
            );
        }

        const warningWindowSeconds =
            Math.max(
                1,

                state.idleLogoutSeconds -
                    state.idleWarningSeconds
            );

        state.idleLogoutTimer =
            window.setTimeout(() => {
                void logoutSession(
                    "idle_timeout"
                );
            }, warningWindowSeconds * 1000);
    };

    const scheduleIdleWarning = () => {
        if (!state.sessionToken) {
            return;
        }

        clearIdleTimers();

        state.idleWarningTimer =
            window.setTimeout(() => {
                showIdleWarning();
            }, state.idleWarningSeconds * 1000);
    };

    const sendActivity = async ({
        force = false
    } = {}) => {
        if (!state.sessionToken) {
            return false;
        }

        const now = Date.now();

        if (
            !force &&
            now -
                state.lastActivitySentAt <
                ACTIVITY_UPDATE_INTERVAL_MS
        ) {
            return true;
        }

        state.lastActivitySentAt = now;

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
            if (
                error.code ===
                    "IDLE_TIMEOUT" ||
                error.code ===
                    "SESSION_ENDED" ||
                error.code ===
                    "SESSION_EXPIRED"
            ) {
                resetLocalState();
            }

            showMessage(
                error.message,
                "error"
            );

            return false;
        }
    };

    const recordPage = async (
        pageName,
        pagePath
    ) => {
        if (!state.sessionToken) {
            return;
        }

        if (!state.loggingEnabled) {
            elements.loggingStatus.textContent =
                "Logging is OFF for Steve.";

            return;
        }

        try {
            const result =
                await apiRequest(
                    "/page",
                    {
                        sessionToken:
                            state.sessionToken,

                        action:
                            "enter",

                        pageName,

                        pagePath
                    }
                );

            appendPageHistory(
                result.pageName ||
                    pageName,

                result.pagePath ||
                    pagePath,

                result.enteredAt
            );

            elements.loggingStatus.textContent =
                "Logging is ON. The page was " +
                "recorded in the separate " +
                "Cloudflare test database.";
        } catch (error) {
            showMessage(
                error.message,
                "error"
            );
        }
    };

   const beginSession = async (
        result,
        restoredStartedAt = null,
        shouldRecordPage = true
    ) => {
        
        clearIdleTimers();
        closeIdleDialog();

        state.memberName =
            result.displayName;

        state.isOwner =
            result.isOwner === true;

        state.loggingEnabled =
            result.loggingEnabled === true;

        state.visitId =
            result.visitId ?? null;

        state.sessionToken =
            result.sessionToken ||
            state.sessionToken;

        state.startedAt =
            restoredStartedAt
                ? new Date(
                    restoredStartedAt
                )
                : new Date();

        state.pageNumber = 0;

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

        elements.pageHistory
            .replaceChildren();

        elements.signedOutPanel.hidden =
            true;

        elements.activeSessionPanel.hidden =
            false;

        updateSessionDisplay();
        saveSession();
        scheduleIdleWarning();

        showMessage(
            `${state.memberName}'s ` +
                "Cloudflare test visit is active.",

            "success"
        );

    if (shouldRecordPage) {
    await recordPage(
        "Visitor Log Test",
        "/access-test.html"
    );
}      
    };

    const continueSession = async () => {
        if (!state.sessionToken) {
            return;
        }

        clearIdleTimers();
        closeIdleDialog();

        const continued =
            await sendActivity({
                force: true
            });

        if (
            !continued ||
            !state.sessionToken
        ) {
            return;
        }

        scheduleIdleWarning();

        showMessage(
            `${state.memberName}'s ` +
                "visit is continuing.",

            "success"
        );
    };

    const logoutSession = async (
        reason
    ) => {
        if (!state.sessionToken) {
            resetLocalState();
            return;
        }

        const endedMember =
            state.memberName;

        const token =
            state.sessionToken;

        clearIdleTimers();
        closeIdleDialog();

        try {
            await apiRequest(
                "/logout",
                {
                    sessionToken:
                        token,

                    reason
                }
            );
        } catch (error) {
            if (
                error.code !==
                    "SESSION_ENDED" &&
                error.code !==
                    "IDLE_TIMEOUT"
            ) {
                showMessage(
                    "Logout warning: " +
                        error.message,

                    "error"
                );
            }
        } finally {
            resetLocalState();

            showMessage(
                `${
                    endedMember ||
                    "The visitor"
                }'s test visit ended. ` +
                    `Reason: ${reason}.`,

                "success"
            );

            elements.accessCode.focus();
        }
    };

    const restoreSession = async () => {
        const storedValue =
            sessionStorage.getItem(
                SESSION_STORAGE_KEY
            );

        if (!storedValue) {
            return false;
        }

        let storedSession;

        try {
            storedSession =
                JSON.parse(storedValue);
        } catch {
            clearStoredSession();
            return false;
        }

        if (
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
                {
                    ...result,

                    sessionToken:
                        storedSession
                            .sessionToken
                },

                storedSession.startedAt,
                false
            );

            return true;
        } catch (error) {
            resetLocalState();

            showMessage(
                "Previous test session ended: " +
                    error.message,

                "error"
            );

            return false;
        }
    };

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
                    elements.accessCode
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

                    return;
                }

                setRequestInProgress(
                    true
                );

                showMessage(
                    "Checking the code with Cloudflare..."
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
                                    elements
                                        .steveTestLogging
                                        .checked ===
                                    true
                            }
                        );

                    elements.accessCode
                        .value = "";

                    await beginSession(
                        result
                    );
                } catch (error) {
                    showMessage(
                        error.message,
                        "error"
                    );

                    elements.accessCode
                        .select();
                } finally {
                    setRequestInProgress(
                        false
                    );
                }
            }
        );

    elements.demoMemberButton
        .addEventListener(
            "click",

            () => {
                showMessage(
                    "Use the assigned six-digit " +
                        "Test Family Member code above."
                );

                elements.accessCode.focus();
            }
        );

    elements.demoSteveButton
        .addEventListener(
            "click",

            () => {
                showMessage(
                    "Use Steve's assigned " +
                        "six-digit owner code above. " +
                        "Test Logging follows the " +
                        "checkbox setting."
                );

                elements.accessCode.focus();
            }
        );

    elements.simulatePageButton
        .addEventListener(
            "click",

            async () => {
                const nextNumber =
                    state.pageNumber + 1;

                await recordPage(
                    `Simulated Family Page ` +
                        `${nextNumber}`,

                    `/simulated-family-page-` +
                        `${nextNumber}.html`
                );

                scheduleIdleWarning();
            }
        );

    elements.testIdleButton
        .addEventListener(
            "click",

            () => {
                clearIdleTimers();
                showIdleWarning();
            }
        );

    elements.logoutButton
        .addEventListener(
            "click",

            () => {
                void logoutSession(
                    "manual_logout"
                );
            }
        );

    elements.continueSessionButton
        .addEventListener(
            "click",

            () => {
                void continueSession();
            }
        );

    elements.idleLogoutButton
        .addEventListener(
            "click",

            () => {
                void logoutSession(
                    "manual_logout"
                );
            }
        );

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
                        state.sessionToken &&
                        !elements
                            .idleDialog
                            .open
                    ) {
                        scheduleIdleWarning();

                        void sendActivity();
                    }
                },

                {
                    passive: true
                }
            );
        }
    );

    if (elements.demoControls) {
        const heading =
            elements.demoControls
                .querySelector("h3");

        const paragraph =
            elements.demoControls
                .querySelector("p");

        if (heading) {
            heading.textContent =
                "Owner Test Option";
        }

        if (paragraph) {
            paragraph.textContent =
                "Steve may turn on Test Logging " +
                "before entering his six-digit " +
                "owner code.";
        }
    }

    showMessage(
        "Connecting to the Cloudflare test service..."
    );

    void restoreSession().then(
        (restored) => {
            if (!restored) {
                showMessage(
                    "Cloudflare test ready. " +
                        "Enter a six-digit access code."
                );

                elements.accessCode.focus();
            }
        }
    );
})();
