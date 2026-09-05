(() => {
    "use strict";

    const API_BASE =
        "https://steve-anita-family-access.stevehill2683.workers.dev";
    const SESSION_STORAGE_KEY = "steve-anita-family-session";
    let unifiedGalleryActive = false;

    function removeSeparatePublishedSection() {
        if (!unifiedGalleryActive) return;
        document.getElementById("publishedPhotoSection")?.remove();
    }

    window.addEventListener(
        "published-photos-added",
        removeSeparatePublishedSection
    );

    function getSession() {
        try {
            const value = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (!value) return null;
            const session = JSON.parse(value);
            if (!session || !session.sessionToken) return null;
            return session;
        } catch {
            return null;
        }
    }

    function currentPagePath() {
        const parts = (window.location.pathname || "")
            .split("/")
            .filter(Boolean);
        return parts.length ? parts[parts.length - 1] : "";
    }

    async function post(path, body) {
        const response = await fetch(`${API_BASE}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store"
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            throw new Error("The managed-photo service returned an unreadable response.");
        }

        if (!response.ok) {
            throw new Error(data?.message || "Managed photos could not be loaded.");
        }

        return data;
    }

    function addStyles() {
        if (document.getElementById("managedGalleryStyles")) return;

        const style = document.createElement("style");
        style.id = "managedGalleryStyles";
        style.textContent = `
            .managed-gallery-status {
                margin: 0.75rem 0;
                font-weight: 700;
                color: #185f20;
            }
            .managed-gallery-status.is-error { color: #8b0000; }
            .manage-image-button,
            .managed-photo-actions button {
                border: 2px solid #4b2a12;
                border-radius: 8px;
                padding: 0.55rem 0.75rem;
                font: inherit;
                font-weight: 700;
                cursor: pointer;
            }
            .manage-image-button {
                margin-top: 0.65rem;
                color: #fff;
                background: #51270f;
            }
            .managed-photo-fields {
                display: grid;
                gap: 0.7rem;
                margin-top: 0.8rem;
                padding: 0.8rem;
                border: 2px solid #8b6845;
                border-radius: 10px;
                background: #fffaf0;
                text-align: left;
            }
            .managed-photo-fields[hidden] { display: none !important; }
            .managed-photo-status {
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem 0.8rem;
                font-size: 0.88rem;
                font-weight: 700;
            }
            .managed-photo-fields label {
                display: grid;
                gap: 0.3rem;
                font-weight: 700;
            }
            .managed-photo-fields input {
                width: 100%;
                box-sizing: border-box;
                padding: 0.5rem;
                border: 1px solid #8b6845;
                border-radius: 7px;
                font: inherit;
            }
            .managed-photo-fields small { font-weight: 400; }
            .managed-photo-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .managed-photo-actions button {
                background: #f4e5cb;
                color: #321b0b;
            }
            .managed-photo-actions button:disabled {
                cursor: not-allowed;
                opacity: 0.55;
            }
            .managed-photo-unavailable {
                display: grid;
                min-height: 180px;
                place-items: center;
                box-sizing: border-box;
                margin: 0;
                padding: 1rem;
                border: 2px dashed #8b6845;
                border-radius: 10px;
                background: #f3eadb;
                color: #51270f;
                font-weight: 800;
                text-align: center;
            }
            .managed-photo-unavailable[hidden] { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    function createStatus(grid) {
        let status = document.getElementById("managedGalleryStatus");
        if (status) return status;

        status = document.createElement("p");
        status.id = "managedGalleryStatus";
        status.className = "managed-gallery-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        grid.parentNode.insertBefore(status, grid);
        return status;
    }

    function showStatus(status, message, isError = false) {
        status.textContent = message;
        status.className = isError
            ? "managed-gallery-status is-error"
            : "managed-gallery-status";
    }

    function createButton(label, handler, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", handler);
        return button;
    }

    function normalizeManagedUrl(url) {
        return String(url || "")
            .replace(/%26amp%3B/gi, "%26")
            .replace(/%26%2339%3B/gi, "%27");
    }

    function createCard(photo, ownerMode, activeCount, context) {
        const card = document.createElement("div");
        card.className = "photo-card managed-photo-card";
        card.dataset.search = [
            photo.caption,
            photo.originalFilename,
            photo.familyMember
        ].filter(Boolean).join(" ");

        const unavailable = document.createElement("p");
        unavailable.className = "managed-photo-unavailable";
        unavailable.textContent = photo.imageStatus === "deleted"
            ? "Deleted image — open the controls below to restore it or remove it permanently."
            : "This image file could not be loaded.";
        unavailable.hidden = photo.imageStatus !== "deleted";

        const caption = document.createElement("p");
        caption.textContent = photo.caption || "Family photo.";

        if (photo.imageStatus === "deleted") {
            card.append(unavailable, caption);
        } else {
            const image = document.createElement("img");
            image.className = "zoom-photo";
            image.src = normalizeManagedUrl(
                photo.thumbnailUrl || photo.imageUrl || ""
            );
            if (photo.imageUrl) {
                image.dataset.full = normalizeManagedUrl(photo.imageUrl);
            }
            image.alt = photo.caption || photo.originalFilename || "Family photo";
            image.tabIndex = 0;
            image.loading = "lazy";
            image.decoding = "async";
            image.addEventListener("error", () => {
                image.hidden = true;
                unavailable.hidden = false;
            });
            card.append(image, unavailable, caption);
        }

        if (!ownerMode) return card;

        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "manage-image-button";
        manageButton.textContent = photo.imageStatus === "deleted"
            ? "Manage Deleted Image"
            : "Manage Image";

        const fields = document.createElement("div");
        fields.className = "managed-photo-fields";
        fields.hidden = true;

        const statusRow = document.createElement("div");
        statusRow.className = "managed-photo-status";
        const imageStatus = document.createElement("span");
        imageStatus.textContent = `Image: ${photo.imageStatus}`;
        const placementStatus = document.createElement("span");
        placementStatus.textContent = `${context.pageLabel}: ${photo.placementStatus}`;
        statusRow.append(imageStatus, placementStatus);

        const captionLabel = document.createElement("label");
        captionLabel.textContent = "Visible caption";
        const captionInput = document.createElement("input");
        captionInput.type = "text";
        captionInput.maxLength = 300;
        captionInput.value = photo.caption || "";
        captionLabel.appendChild(captionInput);

        const orderLabel = document.createElement("label");
        orderLabel.textContent = `Saved order position (1–${activeCount})`;
        const orderInput = document.createElement("input");
        orderInput.type = "number";
        orderInput.min = "1";
        orderInput.max = String(activeCount);
        orderInput.step = "1";
        orderInput.value = String(photo.sortOrder || "");
        orderInput.disabled =
            photo.imageStatus !== "active" ||
            photo.placementStatus !== "active";
        const orderHelp = document.createElement("small");
        orderHelp.textContent = "Enter a new position, then select Change Order.";
        orderLabel.append(orderInput, orderHelp);

        const actions = document.createElement("div");
        actions.className = "managed-photo-actions";
        actions.appendChild(createButton("Save Caption", () => {
            void context.runAction("edit_caption", photo, {
                caption: captionInput.value
            });
        }));
        actions.appendChild(createButton("Change Order", () => {
            void context.runAction("move", photo, {
                sortOrder: Number(orderInput.value)
            });
        }, orderInput.disabled));

        if (photo.placementStatus === "active") {
            actions.appendChild(createButton(`Remove from ${context.pageLabel}`, () => {
                void context.runAction("remove_placement", photo);
            }));
        } else {
            actions.appendChild(createButton(`Restore to ${context.pageLabel}`, () => {
                void context.runAction("restore_placement", photo);
            }, photo.imageStatus !== "active"));
        }

        if (photo.imageStatus === "active") {
            actions.appendChild(createButton("Delete Image", () => {
                void context.runAction("delete_image", photo);
            }));
        } else {
            actions.appendChild(createButton("Restore Image", () => {
                void context.runAction("restore_image", photo);
            }));
            actions.appendChild(createButton("Permanently Remove Deleted Image", () => {
                void context.runAction("purge_image", photo);
            }));
        }

        fields.append(statusRow, captionLabel, orderLabel, actions);
        manageButton.addEventListener("click", () => {
            fields.hidden = !fields.hidden;
            manageButton.textContent = fields.hidden
                ? photo.imageStatus === "deleted"
                    ? "Manage Deleted Image"
                    : "Manage Image"
                : "Close Image Controls";
        });
        card.append(manageButton, fields);
        return card;
    }

    async function initialize() {
        const session = getSession();
        if (!session) return;

        const pagePath = currentPagePath();
        const standardGrid = document.querySelector(
            pagePath === "craig.html"
                ? "main .gallery"
                : "main .photo-grid:not(.published-photo-grid)"
        );
        const israelTargets = pagePath === "israel.html"
            ? Array.from(document.querySelectorAll("main .israel-topic")).map((topic) => {
                const grid = topic.querySelector(".gallery");
                const label = topic.querySelector("h2")?.textContent?.trim() || "";
                return grid && label ? { grid, label } : null;
            }).filter(Boolean)
            : [];
        const statusGrid = standardGrid || israelTargets[0]?.grid;
        if (!pagePath || !statusGrid) return;

        addStyles();
        const status = createStatus(statusGrid);
        const ownerMode = session.isOwner === true;
        const pageLabel = pagePath === "israel.html"
            ? "Israel"
            : document.querySelector("main h1")?.textContent?.trim() ||
              pagePath.replace(/\.html$/i, "");

        const context = {
            pageLabel,
            runAction: null
        };

        const render = (photos) => {
            const activeCount = photos.filter((photo) =>
                photo.imageStatus === "active" &&
                photo.placementStatus === "active"
            ).length;

            const renderablePhotos = photos.filter((photo) =>
                photo.imageStatus === "active" &&
                photo.placementStatus === "active"
            );

            if (israelTargets.length > 0) {
                const normalizeLabel = (value) => String(value || "")
                    .replace(/\u2019/g, "'")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
                const targetByLabel = new Map(israelTargets.map((target) => [
                    normalizeLabel(target.label),
                    target
                ]));
                const unmatched = renderablePhotos.filter((photo) =>
                    !targetByLabel.has(normalizeLabel(photo.familyMember))
                );
                if (unmatched.length > 0) {
                    throw new Error("One or more Israel photos have no matching subsection.");
                }

                israelTargets.forEach((target) => target.grid.replaceChildren());
                renderablePhotos.forEach((photo) => {
                    const target = targetByLabel.get(
                        normalizeLabel(photo.familyMember)
                    );
                    target.grid.appendChild(
                        createCard(photo, ownerMode, activeCount, context)
                    );
                });
                israelTargets.forEach((target) => {
                    target.grid.dataset.managedGalleryLoaded = "true";
                });
                return;
            }

            standardGrid.replaceChildren();
            renderablePhotos.forEach((photo) => {
                standardGrid.appendChild(
                    createCard(photo, ownerMode, activeCount, context)
                );
            });
            standardGrid.dataset.managedGalleryLoaded = "true";
        };

        const refresh = async () => {
            const result = ownerMode
                ? await post("/managed-photo-action", {
                    sessionToken: session.sessionToken,
                    pagePath,
                    action: "list"
                })
                : await post("/managed-photos", {
                    sessionToken: session.sessionToken,
                    pagePath
                });

            const photos = Array.isArray(result.photos) ? result.photos : [];
            if (photos.length === 0) {
                throw new Error("No managed photos are available for this page.");
            }
            render(photos);
            unifiedGalleryActive = true;
            removeSeparatePublishedSection();
            showStatus(
                status,
                ownerMode
                    ? `Owner image controls are active for ${photos.length} photos.`
                    : ""
            );
        };

        context.runAction = async (action, photo, extra = {}) => {
            const confirmations = {
                remove_placement:
                    `Remove this image from ${pageLabel} while keeping it available elsewhere?`,
                delete_image:
                    "Delete this image from every managed placement? It can be restored by the owner.",
                purge_image:
                    "Permanently remove this deleted image and all of its placements? This cannot be undone."
            };

            if (confirmations[action] && !window.confirm(confirmations[action])) {
                return;
            }

            showStatus(status, "Saving the image change...");
            try {
                await post("/managed-photo-action", {
                    sessionToken: session.sessionToken,
                    pagePath,
                    action,
                    imageKey: photo.imageKey,
                    ...extra
                });
                await refresh();
                showStatus(status, "Image change saved.");
            } catch (error) {
                showStatus(status, error.message || "The image change failed.", true);
            }
        };

        try {
            await refresh();
        } catch (error) {
            status.remove();
            console.warn(
                "Managed gallery unavailable; the original page gallery remains visible.",
                error
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            void initialize();
        });
    } else {
        void initialize();
    }
})();
