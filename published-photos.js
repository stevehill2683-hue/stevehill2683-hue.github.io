(() => {
    "use strict";

    const API_BASE =
        "https://steve-anita-family-access.stevehill2683.workers.dev";

    const SESSION_STORAGE_KEY =
        "steve-anita-family-session";

    function getStoredSession() {
        try {
            const raw =
                sessionStorage.getItem(
                    SESSION_STORAGE_KEY
                );

            if (!raw) {
                return null;
            }

            const session =
                JSON.parse(raw);

            if (
                !session ||
                typeof session.sessionToken !==
                    "string" ||
                !session.sessionToken
            ) {
                return null;
            }

            return session;
        } catch {
            return null;
        }
    }

    function getCurrentPagePath() {
        const pathname =
            window.location.pathname ||
            "";

        const parts =
            pathname
                .split("/")
                .filter(Boolean);

        return parts.length
            ? parts[parts.length - 1]
            : "";
    }

    async function requestPublishedPhotos(
        sessionToken,
        pagePath
    ) {
        const response =
            await fetch(
                `${API_BASE}/published-photos`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            sessionToken,
                            pagePath
                        }),

                    cache: "no-store"
                }
            );

        let data = null;

        try {
            data =
                await response.json();
        } catch {
            throw new Error(
                "The published-photo service returned an unreadable response."
            );
        }

        if (!response.ok) {
            throw new Error(
                data?.message ||
                "Published photos could not be loaded."
            );
        }

        return data;
    }

    function normalizePublishedPhotoUrl(url) {
        return String(url || "")
            .replace(/%26amp%3B/gi, "%26")
            .replace(/%26%2339%3B/gi, "%27");
    }

    function createPhotoCard(photo) {
        const card =
            document.createElement(
                "div"
            );

        card.className =
            "photo-card published-photo-card";

        card.dataset.submissionId =
            photo.submissionId || "";

        const image =
            document.createElement(
                "img"
            );

        image.className =
            "zoom-photo";

        image.src =
            normalizePublishedPhotoUrl(
                photo.thumbnailUrl ||
                photo.imageUrl ||
                ""
            );

        if (photo.imageUrl) {
            image.dataset.full =
                normalizePublishedPhotoUrl(
                    photo.imageUrl
                );
        }

        image.alt =
            photo.altText ||
            photo.caption ||
            "Family photo";

        image.tabIndex = 0;

        image.loading =
            "lazy";

        image.decoding =
            "async";

        card.appendChild(
            image
        );

        const caption =
            document.createElement(
                "p"
            );

        caption.textContent =
            photo.caption ||
            "Family photo.";

        card.appendChild(
            caption
        );

        return card;
    }

    /*
     * Find the correct gallery for a published photo.
     *
     * Israel photos are placed inside the exact Israel
     * section chosen when the photo was submitted.
     *
     * Example:
     * title-1 = General
     * title-2 = Southern Stairs
     * title-3 = Temple Mount
     * etc.
     */
    function getIsraelGallery(photo) {
        const sectionId =
            String(
                photo.israelSection ||
                photo.israel_section ||
                ""
            ).trim();

        if (!sectionId) {
            console.warn(
                "Published Israel photo has no Israel section:",
                photo
            );

            return null;
        }

        const topicSection =
            document.getElementById(
                sectionId
            );

        if (!topicSection) {
            console.warn(
                "Israel section was not found:",
                sectionId
            );

            return null;
        }

        /*
         * Most Israel sections already contain a .gallery.
         * General currently may not, so create one INSIDE
         * the selected section rather than at page bottom.
         */
        let gallery =
            topicSection.querySelector(
                ":scope > .gallery"
            );

        if (!gallery) {
            gallery =
                document.createElement(
                    "section"
                );

            gallery.className =
                "gallery";

            const backButton =
                topicSection.querySelector(
                    ".back-to-toc-button"
                );

            if (backButton) {
                topicSection.insertBefore(
                    gallery,
                    backButton
                );
            } else {
                topicSection.appendChild(
                    gallery
                );
            }
        }

        return gallery;
    }

    /*
     * For ordinary pages, use the gallery that already
     * exists on that page. No separate "Newly Added Photos"
     * section is created.
     */
    function getStandardGallery() {
        return (
            document.querySelector(
                "main .gallery"
            ) ||
            document.querySelector(
                ".photo-grid"
            )
        );
    }

    function getTargetGallery(photo) {
        const pagePath =
            getCurrentPagePath()
                .toLowerCase();

        if (
            pagePath ===
            "israel.html"
        ) {
            return getIsraelGallery(
                photo
            );
        }

        return getStandardGallery();
    }

    function photoAlreadyDisplayed(
        submissionId
    ) {
        if (!submissionId) {
            return false;
        }

        return Boolean(
            document.querySelector(
                `[data-submission-id="${CSS.escape(
                    submissionId
                )}"]`
            )
        );
    }

    function displayPhotos(photos) {
        if (
            !Array.isArray(photos) ||
            photos.length === 0
        ) {
            return;
        }

        let addedCount = 0;

        photos.forEach(
            (photo) => {
                const submissionId =
                    String(
                        photo.submissionId ||
                        ""
                    );

                if (
                    photoAlreadyDisplayed(
                        submissionId
                    )
                ) {
                    return;
                }

                const gallery =
                    getTargetGallery(
                        photo
                    );

                if (!gallery) {
                    console.warn(
                        "No matching gallery was found for published photo:",
                        photo
                    );

                    return;
                }

                gallery.appendChild(
                    createPhotoCard(
                        photo
                    )
                );

                addedCount += 1;
            }
        );

        /*
         * Preserve the existing event so the lightbox /
         * zoom system can recognize newly inserted photos.
         */
        if (addedCount > 0) {
            window.dispatchEvent(
                new CustomEvent(
                    "published-photos-added",
                    {
                        detail: {
                            count:
                                addedCount
                        }
                    }
                )
            );
        }
    }

    async function loadPublishedPhotos() {
        const session =
            getStoredSession();

        if (!session) {
            return;
        }

        const pagePath =
            getCurrentPagePath();

        if (!pagePath) {
            return;
        }

        try {
            const data =
                await requestPublishedPhotos(
                    session.sessionToken,
                    pagePath
                );

            displayPhotos(
                data.photos
            );
        } catch (error) {
            console.error(
                "Published photo loading error:",
                error
            );
        }
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            loadPublishedPhotos,
            {
                once: true
            }
        );
    } else {
        loadPublishedPhotos();
    }
})();
