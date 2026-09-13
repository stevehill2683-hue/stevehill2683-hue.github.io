import sidebarData from "./sidebarData.js?v=20260913-1";

// The working Table of Contents owns every Israel section destination.
async function loadIsraelLinks() {
    const response = await fetch("israel.html", { cache: "no-cache" });
    if (!response.ok) throw new Error("Could not load the Israel Table of Contents");
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const links = new Map();
    page.querySelectorAll("#toc .israel-toc-grid a[href^='#']").forEach(link => {
        const hash = link.getAttribute("href");
        if (page.getElementById(hash.slice(1))) {
            links.set(link.textContent.trim(), "israel.html" + hash);
        }
    });
    if (!links.size) throw new Error("The Israel Table of Contents has no section links");
    return links;
}

function buildSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    Object.keys(sidebarData).forEach(async category => {
        // TOP-LEVEL CATEGORY (PURPLE)
        const topItem = document.createElement("a");
        topItem.textContent = category;

        const topLevelLinks = {
            "3131": "general.html",
            "2406": "2406.html",
            "1040": "1040.html",
            "Military": "military.html",
            "Family": "family.html",
            "Israel": "israel.html#toc"
        };

        topItem.href = topLevelLinks[category] || "#";
        topItem.classList.add("sidebar-item-top");
        sidebar.appendChild(topItem);

        // SUB-CATEGORIES
        let subs = sidebarData[category];
        let israelLinks;
        if (category === "Israel") {
            try {
                israelLinks = await loadIsraelLinks();
                // Retain the sidebar's display order; new TOC entries appear at the end.
                subs = [...subs.filter(sub => israelLinks.has(sub)),
                    ...[...israelLinks.keys()].filter(sub => !subs.includes(sub))];
            } catch (error) {
                // The Israel heading still opens the working Table of Contents.
                console.error(error);
                return;
            }
        }

        subs.forEach(sub => {
            const subItem = document.createElement("a");
            subItem.textContent = sub;
            subItem.href = "#";

       if (category === "Family") {
    subItem.classList.add("sidebar-item-family");
    const familyLinks = {
        "Steve": "steve.html",
        "Anita": "anita.html",
        "Scott": "scott.html",
        "Tony": "tony.html",
        "Becky": "becky.html",
        "Craig": "craig.html",
        "Brian": "brian.html",
        "Mom & Dad": "mom-dad.html"
    };

    subItem.href = familyLinks[sub] || "#";

} else if (category === "Israel") {
    subItem.classList.add("sidebar-item-israel");
    subItem.href = israelLinks.get(sub);
}

sidebar.appendChild(subItem);
        });
    });
}

document.addEventListener("DOMContentLoaded", buildSidebar);

