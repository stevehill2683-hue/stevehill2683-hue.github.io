(() => {
    "use strict";

    const STYLE_ID = "passwordVisibilityStyles";
    const WRAPPER_CLASS = "password-visibility-wrapper";
    const BUTTON_CLASS = "password-visibility-button";

    const addStyles = () => {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");

        style.id = STYLE_ID;

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

        document.head.appendChild(style);
    };

    const updateButton = (
        input,
        button
    ) => {
        const passwordIsVisible =
            input.type === "text";

        button.textContent =
            passwordIsVisible
                ? "🙈"
                : "👁";

        button.setAttribute(
            "aria-label",
            passwordIsVisible
                ? "Hide password"
                : "Show password"
        );

        button.title =
            passwordIsVisible
                ? "Hide password"
                : "Show password";

        button.setAttribute(
            "aria-pressed",
            passwordIsVisible
                ? "true"
                : "false"
        );
    };

    const addVisibilityButton = (
        input
    ) => {
        if (
            !(input instanceof HTMLInputElement) ||
            input.dataset.passwordVisibilityReady ===
                "true"
        ) {
            return;
        }

        if (
            input.type !== "password"
        ) {
            return;
        }

        input.dataset.passwordVisibilityReady =
            "true";

        const wrapper =
            document.createElement("span");

        wrapper.className =
            WRAPPER_CLASS;

        input.parentNode.insertBefore(
            wrapper,
            input
        );

        wrapper.appendChild(input);

        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            BUTTON_CLASS;

        button.setAttribute(
            "data-password-toggle",
            "true"
        );

        updateButton(
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
                    input.type === "password"
                        ? "text"
                        : "password";

                updateButton(
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
                    // Some browsers do not preserve
                    // selection positions after a
                    // password field changes type.
                }
            }
        );

        wrapper.appendChild(button);
    };

    const scanForPasswordFields = (
        root = document
    ) => {
        if (
            root instanceof HTMLInputElement &&
            root.type === "password"
        ) {
            addVisibilityButton(root);
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

    const watchForNewPasswordFields =
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

    const start =
        () => {
            addStyles();
            scanForPasswordFields();
            watchForNewPasswordFields();
        };

    if (
        document.readyState === "loading"
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
