(() => {
    "use strict";

    /*
        STEVE & ANITA VISITOR LOG — BROWSER TEST FRAMEWORK

        This test file contains:
        - No real family access codes
        - No passwords
        - No Cloudflare secrets
        - No database connection

        It only tests the visitor screen, session behavior,
        page-history display, Steve exclusion, and idle logout.
    */

    const IDLE_WARNING_MS = 15 * 60 * 1000;
    const IDLE_LOGOUT_MS = 2 * 60 * 1000;

    const state = {
        memberName: null,
        isOwner: false,
        loggingEnabled: false,
        startedAt: null,
        pageNumber: 0,
        idleWarningTimer: null,
        idleLogoutTimer: null
    };

    const byId = (id) => document.getElementById(id);

    const elements = {
        accessForm: byId("accessTestForm"),
        accessCode: byId("accessTestCode"),
        accessMessage: byId("accessTestMessage"),

        demoMemberButton: byId("demoMemberButton"),
        demoSteveButton: byId("demoSteveButton"),
        steveTestLogging: byId("steveTestLogging"),

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

        if (/android|iphone|mobile/.test(userAgent) || width < 700) {
            return "Phone";
        }

        return "Computer";
    };

    const showMessage = (text, type = "normal") => {
        elements.accessMessage.textContent = text;
        elements.accessMessage.className = "test-message";

        if (type === "error") {
            elements.accessMessage.classList.add("is-error");
        }

        if (type === "success") {
            elements.accessMessage.classList.add("is-success");
        }
    };

    const clearIdleTimers = () => {
        window.clearTimeout(state.idleWarningTimer);
        window.clearTimeout(state.idleLogoutTimer);

        state.idleWarningTimer = null;
        state.idleLogoutTimer = null;
    };

    const closeIdleDialog = () => {
        if (elements.idleDialog.open) {
            elements.idleDialog.close();
        }
    };

    const recordPage = (pageName) => {
        if (!state.loggingEnabled) {
            elements.loggingStatus.textContent =
                "Logging is OFF for this visitor.";
            return;
        }

        state.pageNumber += 1;

        const item = document.createElement("li");

        item.textContent =
            `${state.pageNumber}. ${pageName} — ` +
            formatDateTime(new Date());

        elements.pageHistory.appendChild(item);

        elements.loggingStatus.textContent =
            "Logging is ON. Test page activity is being displayed locally.";
    };

    const endSession = (reason) => {
        if (!state.memberName) {
            return;
        }

        clearIdleTimers();
        closeIdleDialog();

        const endedMember = state.memberName;

        state.memberName = null;
        state.isOwner = false;
        state.loggingEnabled = false;
        state.startedAt = null;
        state.pageNumber = 0;

        elements.activeSessionPanel.hidden = true;
        elements.signedOutPanel.hidden = false;

        showMessage(
            `${endedMember}'s test visit ended. Reason: ${reason}.`,
            "success"
        );

        elements.accessCode.value = "";
        elements.accessCode.focus();
    };

    const showIdleWarning = () => {
        if (!state.memberName) {
            return;
        }

        if (typeof elements.idleDialog.showModal === "function") {
            elements.idleDialog.showModal();
        } else {
            elements.idleDialog.setAttribute("open", "");
        }

        state.idleLogoutTimer = window.setTimeout(() => {
            endSession("Idle timeout");
        }, IDLE_LOGOUT_MS);
    };

    const scheduleIdleWarning = () => {
        if (!state.memberName) {
            return;
        }

        clearIdleTimers();

        state.idleWarningTimer = window.setTimeout(() => {
            showIdleWarning();
        }, IDLE_WARNING_MS);
    };

    const continueSession = () => {
        if (!state.memberName) {
            return;
        }

        clearIdleTimers();
        closeIdleDialog();
        scheduleIdleWarning();

        showMessage(
            `${state.memberName}'s visit is continuing.`,
            "success"
        );
    };

    const beginSession = ({
        memberName,
        isOwner,
        loggingEnabled
    }) => {
        clearIdleTimers();
        closeIdleDialog();

        state.memberName = memberName;
        state.isOwner = isOwner;
        state.loggingEnabled = loggingEnabled;
        state.startedAt = new Date();
        state.pageNumber = 0;

        elements.pageHistory.replaceChildren();

        elements.memberName.textContent = memberName;
        elements.deviceType.textContent = detectDeviceType();
        elements.visitStarted.textContent =
            formatDateTime(state.startedAt);

        elements.signedOutPanel.hidden = true;
        elements.activeSessionPanel.hidden = false;

        if (loggingEnabled) {
            elements.loggingStatus.textContent =
                "Logging is ON for this test visit.";

            recordPage("Access Test Page");
        } else {
            elements.loggingStatus.textContent =
                "Logging is OFF for Steve.";
        }

        scheduleIdleWarning();

        showMessage(
            `${memberName}'s local test visit started.`,
            "success"
        );
    };

    elements.accessForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const enteredCode = elements.accessCode.value.trim();

        if (!/^\d{6}$/.test(enteredCode)) {
            showMessage(
                "Enter exactly six digits.",
                "error"
            );

            return;
        }

        /*
            No code is sent or stored during this browser-only test.
            Cloudflare verification will be connected in a later stage.
        */

        elements.accessCode.value = "";

        showMessage(
            "Secure Cloudflare code verification is not connected yet. " +
            "No code was sent, accepted, or stored.",
            "error"
        );
    });

    elements.demoMemberButton.addEventListener("click", () => {
        beginSession({
            memberName: "Test Family Member",
            isOwner: false,
            loggingEnabled: true
        });
    });

    elements.demoSteveButton.addEventListener("click", () => {
        beginSession({
            memberName: "Steve",
            isOwner: true,
            loggingEnabled: elements.steveTestLogging.checked
        });
    });

    elements.simulatePageButton.addEventListener("click", () => {
        const nextNumber = state.pageNumber + 1;

        recordPage(`Simulated Family Page ${nextNumber}`);
        scheduleIdleWarning();
    });

    elements.testIdleButton.addEventListener("click", () => {
        clearIdleTimers();
        showIdleWarning();
    });

    elements.logoutButton.addEventListener("click", () => {
        endSession("Manual logout");
    });

    elements.continueSessionButton.addEventListener("click", () => {
        continueSession();
    });

    elements.idleLogoutButton.addEventListener("click", () => {
        endSession("Visitor selected logout");
    });

    const activityEvents = [
        "pointerdown",
        "keydown",
        "touchstart"
    ];

    activityEvents.forEach((eventName) => {
        document.addEventListener(
            eventName,
            () => {
                if (
                    state.memberName &&
                    !elements.idleDialog.open
                ) {
                    scheduleIdleWarning();
                }
            },
            { passive: true }
        );
    });

    showMessage(
        "Browser test ready. No Cloudflare connection is active."
    );
})();
