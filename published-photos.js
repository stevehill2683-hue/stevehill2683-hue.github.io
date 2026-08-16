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

    function getOrCreatePublishedSection() {
        let section =
            document.getElementById(
                "publishedPhotoSection"
            );

        if (section) {
            return section;
        }

        const main =
            document.querySelector(
                "main"
            );

        if (!main) {
            return null;
        }

        section =
            document.createElement(
                "section"
            );

        section.id =
            "publishedPhotoSection";

        section.setAttribute(
            "aria-labelledby",
            "publishedPhotoHeading"
        );

        const heading =
            document.createElement(
                "h2"
            );

        heading.id =
            "publishedPhotoHeading";

        heading.textContent =
            "Newly Added Photos";

        const grid =
            document.createElement(
                "div"
            );

        grid.className =
            "photo-grid published-photo-grid";

        grid.id =
            "publishedPhotoGrid";

        section.appendChild(
            heading
        );

        section.appendChild(
            grid
        );

        main.appendChild(
            section
        );

        return section;
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
            photo.thumbnailUrl ||
            photo.imageUrl ||
            "";

        if (photo.imageUrl) {
            image.dataset.full =
                photo.imageUrl;
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

    function displayPhotos(photos) {
        if (
            !Array.isArray(photos) ||
            photos.length === 0
        ) {
            return;
        }

        const section =
            getOrCreatePublishedSection();

        if (!section) {
            return;
        }

        const grid =
            section.querySelector(
                "#publishedPhotoGrid"
            );

        if (!grid) {
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
                    submissionId &&
                    grid.querySelector(
                        `[data-submission-id="${CSS.escape(
                            submissionId
                        )}"]`
                    )
                ) {
                    return;
                }

                grid.appendChild(
                    createPhotoCard(
                        photo
                    )
                );

                addedCount += 1;
            }
        );

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