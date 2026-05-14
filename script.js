document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const target = targetId ? document.querySelector(targetId) : null;

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const externalLinkNotice = document.getElementById("external-link-notice");

document.querySelectorAll('[data-delayed-external-link="true"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    const href = link.getAttribute("href");
    if (externalLinkNotice instanceof HTMLElement) {
      externalLinkNotice.hidden = false;
    }

    window.setTimeout(() => {
      if (externalLinkNotice instanceof HTMLElement) {
        externalLinkNotice.hidden = true;
      }

      if (href) {
        window.location.href = href;
      }
    }, 4000);
  });
});

const mapElement = document.getElementById("expedition-map");
const locationListElement = document.getElementById("location-list");
const videoModal = document.getElementById("video-modal");
const videoModalClose = document.getElementById("video-modal-close");
const locationVideoPlayer = document.getElementById("location-video-player");
const videoModalTitle = document.getElementById("video-modal-title");

const closeVideoModal = () => {
  if (!videoModal || !locationVideoPlayer) {
    return;
  }

  locationVideoPlayer.pause();
  locationVideoPlayer.removeAttribute("src");
  locationVideoPlayer.load();
  videoModal.hidden = true;
};

const openVideoModal = (videoSrc, title) => {
  if (!videoModal || !locationVideoPlayer || !videoModalTitle) {
    return;
  }

  videoModalTitle.textContent = title || "סרטון";
  locationVideoPlayer.src = videoSrc;
  videoModal.hidden = false;
  locationVideoPlayer.load();
  locationVideoPlayer.play().catch(() => {});
};

videoModalClose?.addEventListener("click", closeVideoModal);
videoModal?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.hasAttribute("data-close-video-modal")) {
    closeVideoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && videoModal && !videoModal.hidden) {
    closeVideoModal();
  }
});

if (mapElement && locationListElement && window.L) {
  const map = L.map(mapElement, {
    zoomControl: false,
    scrollWheelZoom: false
  });

  L.control.zoom({ position: "bottomleft" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  const markers = new Map();
  const cards = new Map();
  let activeId = null;
  const previewVideoObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const previewVideo = entry.target;
        if (!(previewVideo instanceof HTMLVideoElement)) {
          return;
        }

        const source = previewVideo.querySelector("source");
        if (source && !source.src) {
          const deferredSrc = source.getAttribute("data-src");
          if (deferredSrc) {
            source.src = deferredSrc;
            previewVideo.load();
          }
        }

        observer.unobserve(previewVideo);
      });
    },
    {
      rootMargin: "240px 0px"
    }
  );

  const setActiveLocation = (id, options = {}) => {
    activeId = id;

    markers.forEach((marker, markerId) => {
      const element = marker.getElement();
      if (!element) {
        return;
      }

      element.classList.toggle("is-active", markerId === id);
    });

    cards.forEach((card, cardId) => {
      card.classList.toggle("is-active", cardId === id);
    });

    const marker = markers.get(id);
    if (marker && options.center !== false) {
      map.flyTo(marker.getLatLng(), options.zoom ?? 12, {
        animate: true,
        duration: 0.7
      });
    }

    const card = cards.get(id);
    if (card && options.scroll) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const renderLocationCard = (place) => {
    const article = document.createElement("article");
    article.className = "location-card";
    article.id = `place-${place.id}`;
    article.dataset.locationId = place.id;

    const videos = (place.videos || [])
      .filter((videoUrl) => typeof videoUrl === "string" && videoUrl.trim().length > 0)
      .slice(0, 2)
      .map(
        (videoUrl, index) => `
          <button
            class="location-video-trigger"
            type="button"
            data-video-src="${videoUrl}"
            data-video-title="${place.title} - סרטון ${index + 1}"
            aria-label="פתח סרטון של ${place.title}"
          >
            <video class="location-video-preview" muted playsinline preload="metadata">
              <source data-src="${videoUrl}" type="video/mp4">
            </video>
            <span class="location-video-play" aria-hidden="true">
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.68L9.54 5.98A1 1 0 0 0 8 6.82Z" fill="currentColor"></path>
                </svg>
              </span>
            </span>
          </button>
        `
      )
      .join("");

    const gallery = (place.images || [])
      .slice(0, 5)
      .map(
        (imageUrl, index) => `
          <img
            src="${imageUrl}"
            alt="${place.title} - תמונה ${index + 1}"
            loading="lazy"
            decoding="async"
          >
        `
      )
      .join("");

    article.innerHTML = `
      <div class="location-card-header">
        <h3>${place.title}</h3>
        <button class="location-card-button" type="button">למיקום במפה</button>
      </div>
      <p>${place.description}</p>
      <div class="location-gallery">${videos}${gallery}</div>
    `;

    article.querySelector(".location-card-button")?.addEventListener("click", () => {
      setActiveLocation(place.id, { center: true, scroll: false });
      mapElement.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    article.querySelectorAll(".location-video-trigger").forEach((trigger) => {
      const previewVideo = trigger.querySelector("video");
      if (previewVideo) {
        const buildPreview = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = previewVideo.videoWidth;
            canvas.height = previewVideo.videoHeight;

            const context = canvas.getContext("2d");
            if (!context || !canvas.width || !canvas.height) {
              return;
            }

            context.drawImage(previewVideo, 0, 0, canvas.width, canvas.height);
            const previewUrl = canvas.toDataURL("image/jpeg", 0.82);
            trigger.style.setProperty("--video-preview", `url("${previewUrl}")`);
          } catch (_error) {
            // Keep the default overlay if the browser blocks frame extraction.
          }
        };

        previewVideo.addEventListener(
          "loadedmetadata",
          () => {
            if (previewVideo.duration && Number.isFinite(previewVideo.duration)) {
              previewVideo.currentTime = Math.min(0.45, Math.max(previewVideo.duration / 18, 0.08));
            }
          },
          { once: true }
        );

        previewVideo.addEventListener("seeked", () => {
          buildPreview();
          previewVideo.pause();
        });

        previewVideoObserver.observe(previewVideo);
      }

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const videoSrc = target.getAttribute("data-video-src");
        const videoTitle = target.getAttribute("data-video-title");
        if (!videoSrc) {
          return;
        }

        openVideoModal(videoSrc, videoTitle || place.title);
      });
    });

    article.addEventListener("click", () => {
      setActiveLocation(place.id, { center: true, scroll: false });
    });

    article.addEventListener("mouseenter", () => {
      setActiveLocation(place.id, { center: true, scroll: false, zoom: 12 });
    });

    cards.set(place.id, article);
    locationListElement.appendChild(article);
  };

  fetch("data/locations.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load data/locations.json");
      }
      return response.json();
    })
    .then((places) => {
      if (!Array.isArray(places) || places.length === 0) {
        throw new Error("No locations found");
      }

      const bounds = [];

      places.forEach((place) => {
        const [lat, lng] = place.coordinates || [];
        if (typeof lat !== "number" || typeof lng !== "number") {
          return;
        }

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            html: '<div class="map-pin"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map);

        marker.on("click", () => {
          setActiveLocation(place.id, { center: true, scroll: true, zoom: 12 });
        });

        marker.on("mouseover", () => {
          setActiveLocation(place.id, { center: true, scroll: false, zoom: 12 });
        });

        marker.bindTooltip(place.title, {
          direction: "top",
          offset: [0, -10]
        });

        markers.set(place.id, marker);
        bounds.push([lat, lng]);
        renderLocationCard(place);
      });

      if (bounds.length) {
        map.fitBounds(bounds, {
          padding: [28, 28]
        });
      } else {
        map.setView([52.0, 19.0], 6);
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (!visible) {
            return;
          }

          const id = visible.target.getAttribute("data-location-id");
          if (id && id !== activeId) {
            setActiveLocation(id, { center: true, scroll: false, zoom: 12 });
          }
        },
        {
          rootMargin: "-35% 0px -35% 0px",
          threshold: [0.25, 0.5, 0.75]
        }
      );

      cards.forEach((card) => observer.observe(card));

      const firstPlace = places.find((place) => markers.has(place.id));
      if (firstPlace) {
        setActiveLocation(firstPlace.id, { center: true, scroll: false, zoom: 7 });
      }
    })
    .catch(() => {
      locationListElement.innerHTML = `
        <article class="location-card is-active">
          <div class="location-card-header">
            <h3>לא נטענו מיקומים</h3>
          </div>
          <p>
            בדוק שקובץ <code>locations.json</code> קיים, ושהוא מכיל מערך של מקומות
            עם <code>id</code>, <code>title</code>, <code>coordinates</code>,
            <code>description</code>, <code>images</code> ואופציונלית
            <code>videos</code>.
          </p>
        </article>
      `;
      map.setView([52.0, 19.0], 6);
    });
}
