import sidebarData from "./sidebarData.js";

function buildSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    Object.keys(sidebarData).forEach(category => {
        // TOP-LEVEL CATEGORY (PURPLE)
        const topItem = document.createElement("a");
        topItem.textContent = category;

        const topLevelLinks = {
            "3131": "general.html",
            "2406": "2406.html",
            "1040": "1040.html"
        };

        topItem.href = topLevelLinks[category] || "#";
        topItem.classList.add("sidebar-item-top");
        sidebar.appendChild(topItem);

        // SUB-CATEGORIES
        const subs = sidebarData[category];

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

    const israelLinks = {
        "General": "israel.html#title-1",
        "Southern Stairs": "israel.html#title-2",
        "Temple Mount": "israel.html#title-3",
        "Masada": "israel.html#title-4",
        "Sea Of Galilee": "israel.html#title-5",
        "Temple Institute": "israel.html#title-6",
        "Ramparts Walk Citadel": "israel.html#title-7",
        "David & Goliath": "israel.html#title-11",
        "Jordan Baptism": "israel.html#title-12",
        "Garden Tomb": "israel.html#title-16",
        "Model City": "israel.html#title-17",
        "City of David": "israel.html#title-21",
        "Bar Mitzvah": "israel.html#title-26",
        "Rosh HaNikira Grottoes": "israel.html#title-28",
        "Temple Mount Hezekiah": "israel.html#title-8",
        "Megiddo": "israel.html#title-9",
        "Golden Gate": "israel.html#title-10",
        "Caesarea": "israel.html#title-13",
        "Garden of Gethsemane": "israel.html#title-14",
        "Mount of Beatitudes": "israel.html#title-18",
        "Mount of Olives": "israel.html#title-22",
        "Burnt House": "israel.html#title-23",
        "Robinson's Arch": "israel.html#title-24",
        "Tel‑Aviv": "israel.html#title-29",
        "Misc Pictures": "israel.html#title-30",
        "Nahariya Mission": "israel.html#title-25",
        "Jerusalem Shopping": "israel.html#title-15",
        "Western Wall & Rabbi's Tunnel": "israel.html#title-19",
        "Capernaum": "israel.html#title-20"
    };

    subItem.href = israelLinks[sub] || "#";
}

sidebar.appendChild(subItem);
        });
    });
}

document.addEventListener("DOMContentLoaded", buildSidebar);
