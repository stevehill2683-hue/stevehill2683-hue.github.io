(() => {
    "use strict";

    const API_BASE =
        "https://steve-anita-family-access.stevehill2683.workers.dev";

    const SESSION_STORAGE_KEY =
        "steve-anita-owner-session";

    const WARNING_SECONDS =
        5 * 60;

    const STYLE_ID =
        "passwordVisibilityStyles";

    const WRAPPER_CLASS =
        "password-visibility-wrapper";

    const BUTTON_CLASS =
        "password-visibility-button";

    const state = {
        countdownTimer: null,
        requestInProgress: false,
        warningPatched: false
    };

    const byId = (id) =>
        document.getElementById(id);

    const readStoredSession = () => {
        const raw =
            sessionStorage.getItem(
                SESSION_STORAGE_KEY
            );

        if (!raw) {
            return null;
        }

        try {
            const stored =
                JSON.parse(raw);

            if (
                !stored ||
                typeof stored.token !==
                    "string" ||
                !stored.token ||
                !Number.isFinite(
                    Number(
                        stored.expiresAt
                    )
                )
            ) {
                return null;
            }

            return {
                token:
                    stored.token,

                displayName:
                    stored.displayName ||
                    "Steve",

                expiresAt:
                    Number(
                        stored.expiresAt
                    )
            };
        } catch {
            return null;
        }
    };

    const saveStoredSession = (
        data,
        fallbackDisplayName
    ) => {
        sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
                token:
                    data.ownerSessionToken,

                displayName:
                    data.displayName ||
                    fallbackDisplayName ||
                    "Steve",

                expiresAt:
                    Number(
                        data.expiresAt
                    )
            })
        );
    };

    const formatRemaining = (
        remainingSeconds
    ) => {
        const safeSeconds =
            Math.max(
                0,
                Math.floor(
                    remainingSeconds
                )
            );

        const minutes =
            Math.floor(
                safeSeconds / 60
            );

        const seconds =
            safeSeconds % 60;

        return (
            `${minutes}:` +
            `${String(seconds).padStart(
                2,
                "0"
            )}`
        );
    };

    const setWarningMessage = (
        text,
        type = "normal"
    ) => {
        const message =
            byId(
                "ownerSecurityWarningMessage"
            );

        if (!message) {
            return;
        }

        message.textContent =
            text;

        message.className =
            "owner-security-addon-message";

        if (type === "error") {
            message.classList.add(
                "is-error"
            );
        }

        if (type === "success") {
            message.classList.add(
                "is-success"
            );
        }
    };

    const hideWarning = () => {
        const warning =
            byId(
                "ownerSecurityWarning"
            );

        if (warning) {
            warning.hidden = true;
        }

        window.clearInterval(
            state.countdownTimer
        );

        state.countdownTimer =
            null;
    };

    const updateWarningCountdown =
        () => {
            const countdown =
                byId(
                    "ownerSecurityCountdown"
                );

            if (!countdown) {
                return;
            }

            const stored =
                readStoredSession();

            if (!stored) {
                countdown.textContent =
                    "The owner session has ended.";

                return;
            }

            const remainingSeconds =
                stored.expiresAt -
                Math.floor(
                    Date.now() / 1000
                );

            countdown.textContent =
                remainingSeconds > 0
                    ? (
                        "Automatic sign-out in " +
                        `${formatRemaining(
                            remainingSeconds
                        )}.`
                    )
                    : (
                        "The owner session has ended."
                    );
        };

    const showWarning = () => {
        const warning =
            byId(
                "ownerSecurityWarning"
            );

        if (!warning) {
            return;
        }

        warning.hidden = false;

        setWarningMessage("");

        updateWarningCountdown();

        window.clearInterval(
            state.countdownTimer
        );

        state.countdownTimer =
            window.setInterval(
                updateWarningCountdown,
                1000
            );

        const continueButton =
            byId(
                "continueOwnerSessionButton"
            );

        if (continueButton) {
            window.setTimeout(
                () => {
                    continueButton.focus();
                },
                50
            );
        }
    };

    const renewOwnerSession =
        async (button) => {
            if (
                state.requestInProgress
            ) {
                return;
            }

            const stored =
                readStoredSession();

            if (!stored) {
                setWarningMessage(
                    "The owner session has ended. Sign in again.",
                    "error"
                );

                window.setTimeout(
                    () => {
                        window.location.reload();
                    },
                    900
                );

                return;
            }

            const nowSeconds =
                Math.floor(
                    Date.now() / 1000
                );

            if (
                stored.expiresAt <=
                nowSeconds
            ) {
                sessionStorage.removeItem(
                    SESSION_STORAGE_KEY
                );

                setWarningMessage(
                    "The owner session has expired. Sign in again.",
                    "error"
                );

                window.setTimeout(
                    () => {
                        window.location.reload();
                    },
                    900
                );

                return;
            }

            state.requestInProgress =
                true;

            button.disabled =
                true;

            button.textContent =
                "Continuing...";

            setWarningMessage(
                "Renewing the secure owner session..."
            );

            try {
                const response =
                    await fetch(
                        `${API_BASE}/owner-session-renew`,
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${stored.token}`
                            },

                            body:
                                JSON.stringify({}),

                            cache:
                                "no-store"
                        }
                    );

                let data;

                try {
                    data =
                        await response.json();
                } catch {
                    throw new Error(
                        "Cloudflare returned an unreadable response."
                    );
                }

                if (!response.ok) {
                    const error =
                        new Error(
                            data.message ||
                            "The owner session could not be renewed."
                        );

                    error.code =
                        data.code ||
                        "RENEW_FAILED";

                    throw error;
                }

                saveStoredSession(
                    data,
                    stored.displayName
                );

                setWarningMessage(
                    "Secure session continued for another hour.",
                    "success"
                );

                button.textContent =
                    "Session Continued";

                window.setTimeout(
                    () => {
                        hideWarning();

                        window.location.reload();
                    },
                    650
                );
            } catch (error) {
                if (
                    error.code ===
                        "OWNER_SESSION_EXPIRED" ||
                    error.code ===
                        "OWNER_SESSION_INVALID" ||
                    error.code ===
                        "OWNER_SESSION_REVOKED" ||
                    error.code ===
                        "OWNER_SESSION_REQUIRED"
                ) {
                    sessionStorage.removeItem(
                        SESSION_STORAGE_KEY
                    );
                }

                setWarningMessage(
                    error.message,
                    "error"
                );

                button.disabled =
                    false;

                button.textContent =
                    "Continue Secure Session";
            } finally {
                state.requestInProgress =
                    false;
            }
        };

    const patchWarningDialog =
        () => {
            const warning =
                byId(
                    "ownerSecurityWarning"
                );

            if (!warning) {
                return false;
            }

            const card =
                warning.querySelector(
                    ".owner-security-warning-card"
                );

            if (!card) {
                return false;
            }

            const heading =
                byId(
                    "ownerSecurityWarningTitle"
                );

            if (heading) {
                heading.textContent =
                    "Owner Session Expiring Soon";
            }

            const explanation =
                Array.from(
                    card.querySelectorAll(
                        ":scope > p"
                    )
                ).find(
                    (paragraph) =>
                        paragraph.id !==
                            "ownerSecurityCountdown" &&
                        paragraph.id !==
                            "ownerSecurityWarningMessage"
                );

            if (explanation) {
                explanation.textContent =
                    "Your secure owner session is still active. Continue it now for another hour without entering the password again.";
            }

            const oldPassword =
                byId(
                    "ownerSecurityReauthPassword"
                );

            if (oldPassword) {
                const passwordLabel =
                    oldPassword.closest(
                        "label"
                    );

                if (passwordLabel) {
                    passwordLabel.hidden =
                        true;
                }
            }

            const actions =
                card.querySelector(
                    ".owner-security-addon-actions"
                );

            if (!actions) {
                return false;
            }

            const oldContinueButton =
                Array.from(
                    actions.querySelectorAll(
                        "button"
                    )
                ).find(
                    (button) =>
                        !button.classList.contains(
                            "danger"
                        )
                );

            if (oldContinueButton) {
                const continueButton =
                    oldContinueButton.cloneNode(
                        true
                    );

                continueButton.id =
                    "continueOwnerSessionButton";

                continueButton.type =
                    "button";

                continueButton.textContent =
                    "Continue Secure Session";

                oldContinueButton.replaceWith(
                    continueButton
                );

                continueButton.addEventListener(
                    "click",
                    () => {
                        void renewOwnerSession(
                            continueButton
                        );
                    }
                );
            }

            state.warningPatched =
                true;

            return true;
        };

    const monitorOwnerSession =
        () => {
            if (
                !state.warningPatched
            ) {
                patchWarningDialog();
            }

            const stored =
                readStoredSession();

            if (!stored) {
                return;
            }

            const remainingSeconds =
                stored.expiresAt -
                Math.floor(
                    Date.now() / 1000
                );

            if (
                remainingSeconds > 0 &&
                remainingSeconds <=
                    WARNING_SECONDS
            ) {
                showWarning();
            }
        };

    const addStyles = () => {
        if (byId(STYLE_ID)) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            STYLE_ID;

        style.textContent = `
            .${WRAPPER_CLASS} {
                position: relative;
                display: block;
                width: 100%;
            }

            .${WRAPPER_CLASS} > input {
                width: 100%;
                padding-right: 54px !important;
                box-sizing: border-box;
            }

            .${BUTTON_CLASS} {
                position: absolute;
                top: 50%;
                right: 7px;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 36px;
                padding: 0;
                border: 1px solid #6f5a47;
                border-radius: 7px;
                background: #fffaf1;
                color: #2d1b0e;
                font-size: 1.1rem;
                line-height: 1;
                cursor: pointer;
                z-index: 2;
            }

            .${BUTTON_CLASS}:hover {
                background: #f2e5d2;
            }

            .${BUTTON_CLASS}:focus-visible {
                outline: 3px solid #2f6fad;
                outline-offset: 2px;
            }
        `;

        document.head.appendChild(
            style
        );
    };

    const updatePasswordButton = (
        input,
        button
    ) => {
        const visible =
            input.type === "text";

        button.textContent =
            visible
                ? "🙈"
                : "👁";

        button.setAttribute(
            "aria-label",
            visible
                ? "Hide password"
                : "Show password"
        );

        button.title =
            visible
                ? "Hide password"
                : "Show password";

        button.setAttribute(
            "aria-pressed",
            visible
                ? "true"
                : "false"
        );
    };

    const addVisibilityButton = (
        input
    ) => {
        if (
            !(
                input instanceof
                HTMLInputElement
            ) ||
            input.dataset
                .passwordVisibilityReady ===
                "true" ||
            input.type !==
                "password" ||
            input.id ===
                "ownerSecurityReauthPassword"
        ) {
            return;
        }

        input.dataset
            .passwordVisibilityReady =
            "true";

        const wrapper =
            document.createElement(
                "span"
            );

        wrapper.className =
            WRAPPER_CLASS;

        input.parentNode.insertBefore(
            wrapper,
            input
        );

        wrapper.appendChild(
            input
        );

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            BUTTON_CLASS;

        button.setAttribute(
            "data-password-toggle",
            "true"
        );

        updatePasswordButton(
            input,
            button
        );

        button.addEventListener(
            "click",
            () => {
                const selectionStart =
                    input.selectionStart;

                const selectionEnd =
                    input.selectionEnd;

                input.type =
                    input.type ===
                        "password"
                        ? "text"
                        : "password";

                updatePasswordButton(
                    input,
                    button
                );

                input.focus();

                try {
                    input.setSelectionRange(
                        selectionStart,
                        selectionEnd
                    );
                } catch {
                    // Some browsers do not
                    // preserve selection after
                    // the field type changes.
                }
            }
        );

        wrapper.appendChild(
            button
        );
    };

    const scanForPasswordFields = (
        root = document
    ) => {
        if (
            root instanceof
                HTMLInputElement &&
            root.type ===
                "password"
        ) {
            addVisibilityButton(
                root
            );
        }

        if (
            typeof root.querySelectorAll !==
            "function"
        ) {
            return;
        }

        root
            .querySelectorAll(
                'input[type="password"]'
            )
            .forEach(
                addVisibilityButton
            );
    };

    const watchForNewElements =
        () => {
            const observer =
                new MutationObserver(
                    (mutations) => {
                        mutations.forEach(
                            (mutation) => {
                                mutation.addedNodes
                                    .forEach(
                                        (node) => {
                                            if (
                                                node.nodeType ===
                                                Node.ELEMENT_NODE
                                            ) {
                                                scanForPasswordFields(
                                                    node
                                                );

                                                if (
                                                    !state.warningPatched
                                                ) {
                                                    patchWarningDialog();
                                                }
                                            }
                                        }
                                    );
                            }
                        );
                    }
                );

            observer.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );
        };

    const start = () => {
        addStyles();

        patchWarningDialog();

        scanForPasswordFields();

        watchForNewElements();

        monitorOwnerSession();

        window.setInterval(
            monitorOwnerSession,
            1000
        );

        window.addEventListener(
            "focus",
            monitorOwnerSession
        );

        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    !document.hidden
                ) {
                    monitorOwnerSession();
                }
            }
        );
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );
    } else {
        start();
    }
})();


(() => {
    "use strict";

    const STYLE_ID =
        "confidentialTabbedOrganizationStyles";

    const ROOT_ID =
        "confidentialTabbedOrganization";

    const byId = (id) =>
        document.getElementById(id);

    const makeButton = (
        label,
        targetId,
        groupClass
    ) => {
        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            `confidential-tab-button ${groupClass}`;

        button.textContent = label;

        button.setAttribute(
            "role",
            "tab"
        );

        button.setAttribute(
            "aria-controls",
            targetId
        );

        button.setAttribute(
            "aria-selected",
            "false"
        );

        return button;
    };

    const addStyles = () => {
        if (byId(STYLE_ID)) {
            return;
        }

        const style =
            document.createElement("style");

        style.id = STYLE_ID;

        style.textContent = `
            .confidential-tab-shell {
                margin-bottom: 22px;
            }

            .confidential-primary-tabs,
            .confidential-owner-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin: 0 0 16px;
                padding: 12px;
                background: #eee5d9;
                border: 1px solid #d3c3ad;
                border-radius: 12px;
            }

            .confidential-owner-tabs {
                margin-top: 4px;
                background: #f8f3eb;
            }

            .confidential-tab-button {
                min-height: 42px;
                padding: 9px 15px;
                border: 1px solid #2c180b;
                border-radius: 8px;
                background: #655849;
                color: #fffaf1;
                font: inherit;
                font-weight: 700;
                cursor: pointer;
            }

            .confidential-tab-button:hover,
            .confidential-tab-button:focus-visible {
                background: #7b6d5c;
            }

            .confidential-tab-button[
                aria-selected="true"
            ] {
                background: #432611;
                box-shadow:
                    inset 0 -3px 0 #d7b85a;
            }

            .confidential-tab-panel[hidden] {
                display: none !important;
            }

            .confidential-tab-panel
            > .content-card:first-child,
            .confidential-tab-panel
            > .owner-summary-grid:first-child {
                margin-top: 0;
            }

            .confidential-tab-status {
                margin: -4px 0 16px;
            }

            .confidential-tab-status
            .owner-message {
                margin-top: 0;
            }

            .confidential-documents-intro {
                margin-bottom: 22px;
            }

            .confidential-documents-intro h2,
            .confidential-subtab-heading h2 {
                margin-top: 0;
            }

            @media (max-width: 650px) {
                .confidential-primary-tabs,
                .confidential-owner-tabs {
                    display: grid;
                    grid-template-columns: 1fr;
                }

                .confidential-tab-button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    };

    const buildHeadingCard = (
        title,
        text
    ) => {
        const card =
            document.createElement("section");

        card.className =
            "content-card confidential-subtab-heading";

        const heading =
            document.createElement("h2");

        heading.textContent = title;

        const paragraph =
            document.createElement("p");

        paragraph.textContent = text;

        card.append(
            heading,
            paragraph
        );

        return card;
    };

    const prepareMemberPanels = (
        dashboard,
        currentMembersPanel,
        memberManagementPanel,
        statusHost
    ) => {
        const summaryGrids =
            Array.from(
                dashboard.querySelectorAll(
                    ":scope > .owner-summary-grid"
                )
            );

        const memberSummary =
            summaryGrids[0] || null;

        if (memberSummary) {
            currentMembersPanel.appendChild(
                memberSummary
            );
        }

        const originalMembersCard =
            dashboard.querySelector(
                ".owner-members-card"
            );

        if (!originalMembersCard) {
            return;
        }

        const subsections =
            Array.from(
                originalMembersCard
                    .querySelectorAll(
                        ":scope > .owner-subsection"
                    )
            );

        const addMemberSection =
            subsections[0] || null;

        const currentMembersSection =
            subsections[1] || null;

        const message =
            byId("ownerMembersMessage");

        if (message) {
            statusHost.appendChild(
                message
            );
        }

        const currentCard =
            buildHeadingCard(
                "Current Members",
                "View the current family access list and select a member when management changes are needed."
            );

        if (currentMembersSection) {
            const innerHeading =
                currentMembersSection
                    .querySelector("h3");

            if (innerHeading) {
                innerHeading.textContent =
                    "Family Access Members";
            }

            currentCard.appendChild(
                currentMembersSection
            );
        }

        currentMembersPanel.appendChild(
            currentCard
        );

        const managementCard =
            buildHeadingCard(
                "Member Management",
                "Add a family member here. Select Manage beside an existing member to rename them, change their code, or adjust access and logging."
            );

        if (addMemberSection) {
            managementCard.appendChild(
                addMemberSection
            );
        }

        memberManagementPanel.appendChild(
            managementCard
        );

        const editor =
            byId("ownerMemberEditor");

        if (editor) {
            memberManagementPanel
                .appendChild(editor);
        }

        originalMembersCard.remove();

        currentMembersPanel
            .addEventListener(
                "click",
                (event) => {
                    const manageButton =
                        event.target.closest(
                            ".owner-member-button"
                        );

                    if (manageButton) {
                        const managementTab =
                            document.querySelector(
                                '[data-confidential-subtab="management"]'
                            );

                        if (managementTab) {
                            managementTab.click();
                        }
                    }
                },
                true
            );
    };

    const prepareVisitPanel = (
        dashboard,
        visitorLogsPanel
    ) => {
        const summaryGrids =
            Array.from(
                dashboard.querySelectorAll(
                    ":scope > .owner-summary-grid"
                )
            );

        const visitSummary =
            summaryGrids[0] || null;

        if (visitSummary) {
            visitorLogsPanel.appendChild(
                visitSummary
            );
        }

        const visitsCard =
            dashboard.querySelector(
                ".owner-visits-card"
            );

        if (visitsCard) {
            visitorLogsPanel.appendChild(
                visitsCard
            );
        }

        const detailPanel =
            byId(
                "ownerVisitDetailPanel"
            );

        if (detailPanel) {
            visitorLogsPanel.appendChild(
                detailPanel
            );
        }
    };

    const prepareOwnerControls = (
        dashboard,
        ownerControlsPanel
    ) => {
        const toolbar =
            dashboard.querySelector(
                ".owner-toolbar-card"
            );

        if (toolbar) {
            ownerControlsPanel.appendChild(
                toolbar
            );
        }
    };

    const prepareDocuments = (
        dashboard,
        documentsPanel
    ) => {
        const intro =
            document.createElement(
                "section"
            );

        intro.className =
            "content-card confidential-documents-intro";

        const heading =
            document.createElement("h2");

        heading.textContent =
            "Confidential Documents";

        const paragraph =
            document.createElement("p");

        paragraph.textContent =
            "This area is reserved for protected family documents and memories. Files will be added here only after protected file delivery is completed.";

        intro.append(
            heading,
            paragraph
        );

        documentsPanel.appendChild(
            intro
        );

        const privateNote =
            dashboard.querySelector(
                ".owner-private-content-note"
            );

        if (privateNote) {
            documentsPanel.appendChild(
                privateNote
            );
        }
    };

    const placeSecurityCard = (
        securityPanel
    ) => {
        const securityCard =
            byId(
                "ownerSecurityAddonCard"
            );

        if (
            securityCard &&
            securityCard.parentElement !==
                securityPanel
        ) {
            securityPanel.appendChild(
                securityCard
            );
        }
    };

    const start = () => {
        const dashboard =
            byId(
                "ownerDashboardPanel"
            );

        if (
            !dashboard ||
            byId(ROOT_ID)
        ) {
            return;
        }

        addStyles();

        const root =
            document.createElement("div");

        root.id = ROOT_ID;

        root.className =
            "confidential-tab-shell";

        const primaryTabs =
            document.createElement("div");

        primaryTabs.className =
            "confidential-primary-tabs";

        primaryTabs.setAttribute(
            "role",
            "tablist"
        );

        primaryTabs.setAttribute(
            "aria-label",
            "Confidential sections"
        );

        const documentsPanel =
            document.createElement(
                "section"
            );

        documentsPanel.id =
            "confidentialDocumentsPanel";

        documentsPanel.className =
            "confidential-tab-panel";

        documentsPanel.setAttribute(
            "role",
            "tabpanel"
        );

        const ownerArea =
            document.createElement(
                "section"
            );

        ownerArea.id =
            "confidentialOwnerDashboardArea";

        ownerArea.className =
            "confidential-tab-panel";

        ownerArea.setAttribute(
            "role",
            "tabpanel"
        );

        const documentsTab =
            makeButton(
                "Documents",
                documentsPanel.id,
                "confidential-primary-tab"
            );

        documentsTab.dataset
            .confidentialPrimaryTab =
            "documents";

        const ownerDashboardTab =
            makeButton(
                "Owner Dashboard",
                ownerArea.id,
                "confidential-primary-tab"
            );

        ownerDashboardTab.dataset
            .confidentialPrimaryTab =
            "dashboard";

        primaryTabs.append(
            documentsTab,
            ownerDashboardTab
        );

        const ownerTabs =
            document.createElement("div");

        ownerTabs.className =
            "confidential-owner-tabs";

        ownerTabs.setAttribute(
            "role",
            "tablist"
        );

        ownerTabs.setAttribute(
            "aria-label",
            "Confidential Owner Dashboard sections"
        );

        const currentMembersPanel =
            document.createElement(
                "section"
            );

        currentMembersPanel.id =
            "confidentialCurrentMembersPanel";

        currentMembersPanel.className =
            "confidential-tab-panel";

        currentMembersPanel.setAttribute(
            "role",
            "tabpanel"
        );

        const memberManagementPanel =
            document.createElement(
                "section"
            );

        memberManagementPanel.id =
            "confidentialMemberManagementPanel";

        memberManagementPanel.className =
            "confidential-tab-panel";

        memberManagementPanel.setAttribute(
            "role",
            "tabpanel"
        );

        const visitorLogsPanel =
            document.createElement(
                "section"
            );

        visitorLogsPanel.id =
            "confidentialVisitorLogsPanel";

        visitorLogsPanel.className =
            "confidential-tab-panel";

        visitorLogsPanel.setAttribute(
            "role",
            "tabpanel"
        );

        const securityPanel =
            document.createElement(
                "section"
            );

        securityPanel.id =
            "confidentialSecuritySessionPanel";

        securityPanel.className =
            "confidential-tab-panel";

        securityPanel.setAttribute(
            "role",
            "tabpanel"
        );

        const ownerControlsPanel =
            document.createElement(
                "section"
            );

        ownerControlsPanel.id =
            "confidentialOwnerControlsPanel";

        ownerControlsPanel.className =
            "confidential-tab-panel";

        ownerControlsPanel.setAttribute(
            "role",
            "tabpanel"
        );

        const subtabDefinitions = [
            [
                "members",
                "Current Members",
                currentMembersPanel
            ],
            [
                "management",
                "Member Management",
                memberManagementPanel
            ],
            [
                "logs",
                "Visitor Logs",
                visitorLogsPanel
            ],
            [
                "security",
                "Security & Session",
                securityPanel
            ],
            [
                "controls",
                "Owner Controls",
                ownerControlsPanel
            ]
        ];

        const subtabButtons =
            new Map();

        subtabDefinitions.forEach(
            (
                [
                    key,
                    label,
                    panel
                ]
            ) => {
                const button =
                    makeButton(
                        label,
                        panel.id,
                        "confidential-owner-tab"
                    );

                button.dataset
                    .confidentialSubtab =
                    key;

                subtabButtons.set(
                    key,
                    button
                );

                ownerTabs.appendChild(
                    button
                );
            }
        );

        const statusHost =
            document.createElement(
                "div"
            );

        statusHost.className =
            "confidential-tab-status";

        ownerArea.append(
            ownerTabs,
            statusHost,
            currentMembersPanel,
            memberManagementPanel,
            visitorLogsPanel,
            securityPanel,
            ownerControlsPanel
        );

        root.append(
            primaryTabs,
            documentsPanel,
            ownerArea
        );

        dashboard.prepend(root);

        prepareOwnerControls(
            dashboard,
            ownerControlsPanel
        );

        prepareMemberPanels(
            dashboard,
            currentMembersPanel,
            memberManagementPanel,
            statusHost
        );

        prepareVisitPanel(
            dashboard,
            visitorLogsPanel
        );

        prepareDocuments(
            dashboard,
            documentsPanel
        );

        placeSecurityCard(
            securityPanel
        );

        const showPrimary = (
            name
        ) => {
            const showDocuments =
                name === "documents";

            documentsPanel.hidden =
                !showDocuments;

            ownerArea.hidden =
                showDocuments;

            documentsTab.setAttribute(
                "aria-selected",
                showDocuments
                    ? "true"
                    : "false"
            );

            ownerDashboardTab
                .setAttribute(
                    "aria-selected",
                    showDocuments
                        ? "false"
                        : "true"
                );
        };

        const showSubtab = (
            name
        ) => {
            subtabDefinitions.forEach(
                (
                    [
                        key,
                        ,
                        panel
                    ]
                ) => {
                    const active =
                        key === name;

                    panel.hidden =
                        !active;

                    const button =
                        subtabButtons.get(
                            key
                        );

                    button.setAttribute(
                        "aria-selected",
                        active
                            ? "true"
                            : "false"
                    );
                }
            );

            if (
                name === "security"
            ) {
                placeSecurityCard(
                    securityPanel
                );
            }
        };

        documentsTab
            .addEventListener(
                "click",
                () =>
                    showPrimary(
                        "documents"
                    )
            );

        ownerDashboardTab
            .addEventListener(
                "click",
                () =>
                    showPrimary(
                        "dashboard"
                    )
            );

        subtabButtons.forEach(
            (
                button,
                key
            ) => {
                button.addEventListener(
                    "click",
                    () =>
                        showSubtab(
                            key
                        )
                );
            }
        );

        const observer =
            new MutationObserver(
                () => {
                    placeSecurityCard(
                        securityPanel
                    );
                }
            );

        observer.observe(
            dashboard,
            {
                childList: true,
                subtree: true
            }
        );

        showPrimary(
            "dashboard"
        );

        showSubtab(
            "members"
        );
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );
    } else {
        start();
    }
})();
