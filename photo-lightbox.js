(function () {
    "use strict";

    const helpText =
        "Click or tap a photo first. At normal size, use the left and right " +
        "arrow keys to change photos. Use + to zoom in and - to zoom out. " +
        "When zoomed, use all four arrow keys to move around the photo and " +
        "press 0 to reset. On a phone, swipe left or right. Press Escape or " +
        "tap the enlarged photo area to close.";

    const controlsMarkup = `
        <strong>Photo controls</strong>
        Normal: <kbd>←</kbd> <kbd>→</kbd> previous or next<br>
        Zoom: <kbd>+</kbd> in &nbsp; <kbd>−</kbd> out<br>
        Zoomed: <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> move<br>
        <kbd>0</kbd> reset &nbsp; <kbd>Esc</kbd> close
    `;

    function initializePhotoLightbox() {
        const zoomPhotos = Array.from(
            document.querySelectorAll(".zoom-photo")
        );

        if (zoomPhotos.length === 0) {
            return;
        }

        let lightbox = document.getElementById("photoLightbox");

        if (!lightbox) {
            lightbox = document.createElement("div");
            lightbox.id = "photoLightbox";
            lightbox.className = "photo-lightbox";
            document.body.appendChild(lightbox);
        }

        if (lightbox.dataset.sharedLightboxReady === "true") {
            return;
        }

        lightbox.dataset.sharedLightboxReady = "true";
        lightbox.setAttribute("role", "dialog");
        lightbox.setAttribute("aria-modal", "true");
        lightbox.setAttribute("aria-hidden", "true");
        lightbox.setAttribute(
            "aria-label",
            "Expanded photograph viewer"
        );
        lightbox.setAttribute("tabindex", "-1");

        let lightboxImg = document.getElementById("photoLightboxImg");

        if (!lightboxImg) {
            lightboxImg = document.createElement("img");
            lightboxImg.id = "photoLightboxImg";
            lightbox.appendChild(lightboxImg);
        }

        lightboxImg.removeAttribute("src");
        lightboxImg.alt = "Expanded photo";

        let controls = lightbox.querySelector(".photo-lightbox-controls");

        if (!controls) {
            controls = document.createElement("aside");
            controls.className = "photo-lightbox-controls";
            controls.setAttribute("aria-label", "Photo viewer controls");
            controls.innerHTML = controlsMarkup;
            lightbox.appendChild(controls);
        }

        const helpElements = Array.from(
            document.querySelectorAll(".photo-navigation-help")
        );

        if (helpElements.length > 0) {
            helpElements.forEach(help => {
                help.textContent = helpText;
            });
        } else {
            const firstGallery = zoomPhotos[0].closest(
                ".gallery, .photo-grid"
            );

            if (firstGallery && firstGallery.parentNode) {
                const help = document.createElement("p");
                help.className = "photo-navigation-help";
                help.textContent = helpText;
                firstGallery.parentNode.insertBefore(help, firstGallery);
            }
        }

        let activePhotos = zoomPhotos;
        let currentPhotoIndex = 0;
        let zoomLevel = 1;
        let panX = 0;
        let panY = 0;
        let previouslyFocusedPhoto = null;

        const minimumZoom = 1;
        const maximumZoom = 4;
        const zoomStep = 0.25;
        const panStep = 60;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;

        function getGalleryPhotos(photo) {
            const gallery = photo.closest(".gallery, .photo-grid");
            const galleryPhotos = gallery
                ? Array.from(gallery.querySelectorAll(".zoom-photo"))
                : zoomPhotos;

            const visiblePhotos = galleryPhotos.filter(galleryPhoto => {
                const card = galleryPhoto.closest(".photo-card");
                const topic = galleryPhoto.closest(".israel-topic");

                return !card?.classList.contains("search-hidden") &&
                       !topic?.classList.contains("search-hidden");
            });

            return visiblePhotos.length > 0
                ? visiblePhotos
                : galleryPhotos;
        }

        function preloadNearbyPhotos() {
            if (activePhotos.length < 2) {
                return;
            }

            const previousIndex =
                (currentPhotoIndex - 1 + activePhotos.length) %
                activePhotos.length;

            const nextIndex =
                (currentPhotoIndex + 1) % activePhotos.length;

            const previousPhoto = new Image();
            previousPhoto.src = activePhotos[previousIndex].src;

            const nextPhoto = new Image();
            nextPhoto.src = activePhotos[nextIndex].src;
        }

        function clampPan() {
            const maximumPanX = Math.max(
                0,
                (lightboxImg.clientWidth * zoomLevel -
                    lightbox.clientWidth) / 2
            );

            const maximumPanY = Math.max(
                0,
                (lightboxImg.clientHeight * zoomLevel -
                    lightbox.clientHeight) / 2
            );

            panX = Math.max(-maximumPanX, Math.min(maximumPanX, panX));
            panY = Math.max(-maximumPanY, Math.min(maximumPanY, panY));
        }

        function applyZoom() {
            clampPan();

            lightboxImg.style.transform =
                `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
        }

        function resetZoom() {
            zoomLevel = minimumZoom;
            panX = 0;
            panY = 0;
            applyZoom();
        }

        function changeZoom(amount) {
            zoomLevel = Math.min(
                maximumZoom,
                Math.max(minimumZoom, zoomLevel + amount)
            );

            if (zoomLevel === minimumZoom) {
                panX = 0;
                panY = 0;
            }

            applyZoom();
        }

        function panPhoto(horizontalAmount, verticalAmount) {
            if (zoomLevel <= minimumZoom) {
                return;
            }

            panX += horizontalAmount;
            panY += verticalAmount;
            applyZoom();
        }

        function showPhoto(index) {
            currentPhotoIndex =
                (index + activePhotos.length) % activePhotos.length;

            const selectedPhoto = activePhotos[currentPhotoIndex];

            lightboxImg.src = selectedPhoto.currentSrc || selectedPhoto.src;
            lightboxImg.alt = selectedPhoto.alt || "Expanded photo";
            resetZoom();
            preloadNearbyPhotos();
        }

        function openLightbox(photo) {
            activePhotos = getGalleryPhotos(photo);
            currentPhotoIndex = activePhotos.indexOf(photo);

            if (currentPhotoIndex < 0) {
                activePhotos = zoomPhotos;
                currentPhotoIndex = zoomPhotos.indexOf(photo);
            }

            previouslyFocusedPhoto = photo;
            showPhoto(currentPhotoIndex);
            lightbox.classList.add("active");
            lightbox.setAttribute("aria-hidden", "false");
            document.body.classList.add("lightbox-open");
            lightbox.focus({ preventScroll: true });
        }

        function closeLightbox() {
            lightbox.classList.remove("active");
            lightbox.setAttribute("aria-hidden", "true");
            document.body.classList.remove("lightbox-open");
            lightboxImg.removeAttribute("src");
            lightboxImg.alt = "Expanded photo";
            resetZoom();

            previouslyFocusedPhoto?.focus({ preventScroll: true });
        }

        function showPreviousPhoto() {
            showPhoto(currentPhotoIndex - 1);
        }

        function showNextPhoto() {
            showPhoto(currentPhotoIndex + 1);
        }

        zoomPhotos.forEach(photo => {
            photo.addEventListener("click", () => {
                openLightbox(photo);
            });

            photo.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openLightbox(photo);
                }
            });
        });

        lightboxImg.addEventListener("load", applyZoom);

        lightbox.addEventListener("touchstart", event => {
            const touch = event.changedTouches[0];

            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchMoved = false;
        }, { passive: true });

        lightbox.addEventListener("touchmove", event => {
            if (zoomLevel > minimumZoom) {
                return;
            }

            const touch = event.changedTouches[0];
            const horizontalMovement = touch.clientX - touchStartX;
            const verticalMovement = touch.clientY - touchStartY;

            if (Math.abs(horizontalMovement) >
                Math.abs(verticalMovement)) {
                event.preventDefault();
            }
        }, { passive: false });

        lightbox.addEventListener("touchend", event => {
            if (zoomLevel > minimumZoom) {
                return;
            }

            const touch = event.changedTouches[0];
            const horizontalDistance = touch.clientX - touchStartX;
            const verticalDistance = touch.clientY - touchStartY;

            const isHorizontalSwipe =
                Math.abs(horizontalDistance) >= 50 &&
                Math.abs(horizontalDistance) > Math.abs(verticalDistance);

            if (!isHorizontalSwipe) {
                return;
            }

            touchMoved = true;

            if (horizontalDistance < 0) {
                showNextPhoto();
            } else {
                showPreviousPhoto();
            }

            setTimeout(() => {
                touchMoved = false;
            }, 400);
        }, { passive: true });

        lightbox.addEventListener("click", () => {
            if (touchMoved) {
                return;
            }

            closeLightbox();
        });

        document.addEventListener("keydown", event => {
            if (!lightbox.classList.contains("active")) {
                return;
            }

            const photoIsZoomed = zoomLevel > minimumZoom;

            if (event.key === "ArrowLeft") {
                event.preventDefault();

                if (photoIsZoomed) {
                    panPhoto(panStep, 0);
                } else {
                    showPreviousPhoto();
                }
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();

                if (photoIsZoomed) {
                    panPhoto(-panStep, 0);
                } else {
                    showNextPhoto();
                }
            }

            if (event.key === "ArrowUp" && photoIsZoomed) {
                event.preventDefault();
                panPhoto(0, panStep);
            }

            if (event.key === "ArrowDown" && photoIsZoomed) {
                event.preventDefault();
                panPhoto(0, -panStep);
            }

            if (event.key === "+" || event.key === "=") {
                event.preventDefault();
                changeZoom(zoomStep);
            }

            if (event.key === "-" || event.key === "_") {
                event.preventDefault();
                changeZoom(-zoomStep);
            }

            if (event.key === "0") {
                event.preventDefault();
                resetZoom();
            }

            if (event.key === "Escape") {
                closeLightbox();
            }
        });

        window.addEventListener("resize", () => {
            if (lightbox.classList.contains("active")) {
                applyZoom();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializePhotoLightbox
        );
    } else {
        initializePhotoLightbox();
    }
})();
