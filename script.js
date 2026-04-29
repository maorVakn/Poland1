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

const shareButton = document.getElementById("share-site-button");
const shareToast = document.getElementById("share-toast");

if (shareButton) {
  const siteUrl = "https://maorvakn.github.io/Poland1/";
  const shareText = 'משלחת לפולין 2026 בית ספר ש"י עגנון';
  const shareMessage = () => `${shareText}: ${siteUrl}`;
  let toastTimeoutId = null;

  const showToast = (message) => {
    if (!shareToast) {
      return;
    }

    shareToast.textContent = message;
    shareToast.hidden = false;

    window.clearTimeout(toastTimeoutId);
    toastTimeoutId = window.setTimeout(() => {
      shareToast.hidden = true;
    }, 2200);
  };

  shareButton.addEventListener("click", async () => {
    const message = shareMessage();
    const shareData = {
      title: "המשלחת לפולין 2026",
      text: shareText,
      url: siteUrl
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      showToast("הקישור הועתק");
      return;
    } catch (_error) {
      try {
        window.location.href = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(message)}`;
        showToast("נפתחה אפשרות שיתוף");
      } catch (__error) {
        showToast("לא הצלחנו לשתף כרגע");
      }
    }
  });
}

const mapElement = document.getElementById("expedition-map");
const locationListElement = document.getElementById("location-list");

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
      <div class="location-gallery">${gallery}</div>
    `;

    article.querySelector(".location-card-button")?.addEventListener("click", () => {
      setActiveLocation(place.id, { center: true, scroll: false });
      mapElement.scrollIntoView({ behavior: "smooth", block: "start" });
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

  fetch("locations.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load locations.json");
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
            <code>description</code> ו-<code>images</code>.
          </p>
        </article>
      `;
      map.setView([52.0, 19.0], 6);
    });
}
