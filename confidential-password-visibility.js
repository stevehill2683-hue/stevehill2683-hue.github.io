(() => {
    "use strict";

    const API_BASE =
        "https://steve-anita-family-access-test.stevehill2683.workers.dev";

    const SESSION_STORAGE_KEY =
        "steve-anita-owner-session-test";

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
