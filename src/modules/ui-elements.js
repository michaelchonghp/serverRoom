/**
 * First modular cut: centralize DOM lookups for controls/chips/legends.
 * Keeping selectors in one place makes future UI refactors lower-risk.
 */
export function getUiElements(doc = document) {
  const ctrlMenu = doc.getElementById("ctrl-menu");
  const controlsPanel = doc.getElementById("controls-panel");
  const btnControlsToggle = doc.getElementById("btn-controls-toggle");
  const floorMenu = doc.getElementById("floor-menu");
  const floorPanel = doc.getElementById("floor-panel");
  const btnFloorToggle = doc.getElementById("btn-floor-toggle");
  const floorToggleAction = doc.getElementById("floor-toggle-action");
  const btnFront = doc.getElementById("btn-front");
  const btnRear = doc.getElementById("btn-rear");
  const btnShowPower = doc.getElementById("btn-show-power");
  const btnShowCore = doc.getElementById("btn-show-core");
  const btnShowCoreDist = doc.getElementById("btn-show-core-dist");
  const btnShowAccess = doc.getElementById("btn-show-access");
  const coreInfoChipEl = doc.getElementById("core-info-chip");
  const distInfoChipEl = doc.getElementById("dist-info-chip");
  const btnCoreInfo = doc.getElementById("btn-core-info");
  const btnDistInfo = doc.getElementById("btn-dist-info");
  const accessRoleFiltersEl = doc.getElementById("access-role-filters");
  const btnAccessLan = doc.getElementById("btn-access-lan");
  const btnAccessWifi = doc.getElementById("btn-access-wifi");
  const btnAccessSq = doc.getElementById("btn-access-sq");
  const powerLegend = doc.getElementById("power-legend");
  const distLegend = doc.getElementById("dist-legend");
  const rackButtons = Array.from(doc.querySelectorAll(".rack-btn[data-rack]"));
  const floorButtons = Array.from(doc.querySelectorAll(".floor-opt[data-floor]"));
  const ctrl25OnlyRows = Array.from(doc.querySelectorAll(".ctrl-25-only"));
  const doorControlsEl = doc.querySelector(".door-controls");

  return {
    ctrlMenu,
    controlsPanel,
    btnControlsToggle,
    floorMenu,
    floorPanel,
    btnFloorToggle,
    floorToggleAction,
    btnFront,
    btnRear,
    btnShowPower,
    btnShowCore,
    btnShowCoreDist,
    btnShowAccess,
    coreInfoChipEl,
    distInfoChipEl,
    btnCoreInfo,
    btnDistInfo,
    accessRoleFiltersEl,
    btnAccessLan,
    btnAccessWifi,
    btnAccessSq,
    accessRoleButtons: {
      LAN: btnAccessLan,
      WIFI: btnAccessWifi,
      SECURITY: btnAccessSq,
    },
    powerLegend,
    distLegend,
    rackButtons,
    floorButtons,
    ctrl25OnlyRows,
    doorControlsEl,
  };
}
