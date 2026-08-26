import sidebarData from "./sidebarData.js";

function buildSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    Object.keys(sidebarData).forEach(category => {
        // TOP-LEVEL CATEGORY (PURPLE)
        const topItem = document.createElement("a");
        topItem.textContent = category;
        topItem.href = "#";
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
            } else if (category === "Israel") {
                subItem.classList.add("sidebar-item-israel");
            }

            sidebar.appendChild(subItem);
        });
    });
}

document.addEventListener("DOMContentLoaded", buildSidebar);
