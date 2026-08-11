/**
 * Blue/Red power lanes and pulse-wave animation (UPS feed + building feed).
 * Extracted from main.js to keep power-path logic in one focused module.
 */
export function initBlueRedPowerSystem({
  THREE,
  roomPower,
  buildPolyline,
  cylinderBetween,
  industrialSocketByKey,
  racks,
  PDU_LOCAL_X,
  pduLocalZ,
  pduTopY,
  CPT_Y,
  distX,
  bypassY,
  powerCableZ,
  cptXMax,
  cptZA,
  cptZB,
  trunkX,
  trunkZ,
  mcbX,
  mcbY,
  getElapsedTime,
}) {
  const BLUE_TRUNK_OFF = new THREE.Vector3(-2.2, 0, 1.6);
  const RED_TRUNK_OFF = new THREE.Vector3(2.2, 0, -1.6);

  const matBlueXray = new THREE.MeshBasicMaterial({
    color: 0x4da3ff,
    transparent: true,
    opacity: 0.715,
    depthTest: false,
    depthWrite: false,
  });
  const bluePowerCableGroup = new THREE.Group();
  bluePowerCableGroup.name = "PowerCableDistToPdu1";
  const bluePowerPathPoints = [];
  const blueToCorner = [];
  const blueArms = [];
  const blueSpurPaths = [];
  const distFeedOrigin = new THREE.Vector3(distX, bypassY, powerCableZ);
  const uCorner = new THREE.Vector3(cptXMax, CPT_Y, cptZA);

  function pdu1FeedGeom(rackName) {
    const sockInfo = industrialSocketByKey.get(`${rackName}|PDU1`);
    const rack = racks.find((r) => r.group.name === rackName)?.group;
    if (!sockInfo || !rack) return null;
    const rotY = rack.rotation.y;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const junction = new THREE.Vector3(sockInfo.x, CPT_Y, sockInfo.z);
    const sockFace = new THREE.Vector3(sockInfo.x, sockInfo.y, sockInfo.z);
    const pduTop = new THREE.Vector3(
      rack.position.x + PDU_LOCAL_X * cos - pduLocalZ * sin,
      pduTopY + 0.4,
      rack.position.z + PDU_LOCAL_X * sin + pduLocalZ * cos
    );
    return { junction, sockFace, pduTop };
  }

  function pushUniquePoint(arr, p) {
    const last = arr[arr.length - 1];
    const c = p.clone().add(BLUE_TRUNK_OFF);
    if (!last || last.distanceTo(c) > 0.5) {
      arr.push(c);
      bluePowerPathPoints.push(c.clone());
    }
  }

  pushUniquePoint(blueToCorner, distFeedOrigin);
  pushUniquePoint(blueToCorner, new THREE.Vector3(trunkX, bypassY, trunkZ));
  pushUniquePoint(blueToCorner, new THREE.Vector3(trunkX, CPT_Y, trunkZ));
  pushUniquePoint(blueToCorner, new THREE.Vector3(cptXMax, CPT_Y, trunkZ));
  pushUniquePoint(blueToCorner, uCorner);

  function buildBlueArm(rackNames, leadPts) {
    const arm = { legs: [], spurs: [] };
    let leg = [];
    (leadPts || []).forEach((p) => pushUniquePoint(leg, p));
    rackNames.forEach((rackName) => {
      const g = pdu1FeedGeom(rackName);
      if (!g) return;
      pushUniquePoint(leg, g.junction);
      arm.legs.push(leg);
      const jOff = leg[leg.length - 1];
      const spur = [jOff.clone(), g.sockFace.clone(), g.pduTop.clone()];
      arm.spurs.push(spur);
      blueSpurPaths.push(spur);
      spur.forEach((p) => bluePowerPathPoints.push(p.clone()));
      leg = [jOff.clone()];
    });
    blueArms.push(arm);
    return arm;
  }

  buildBlueArm(["Rack1", "Rack2", "Rack3"], [uCorner]);
  buildBlueArm(["Rack4", "Rack5", "Rack6"], [uCorner, new THREE.Vector3(cptXMax, CPT_Y, cptZB)]);

  function addBlueXrayPolyline(points) {
    buildPolyline(points).segs.forEach(({ a, b }) => {
      const seg = cylinderBetween(a, b, 1.265, matBlueXray);
      if (seg) bluePowerCableGroup.add(seg);
    });
  }
  addBlueXrayPolyline(blueToCorner);
  blueArms.forEach((arm) => {
    const spine = [];
    arm.legs.forEach((leg, i) => {
      leg.forEach((p, j) => {
        if (i > 0 && j === 0) return;
        const last = spine[spine.length - 1];
        if (!last || last.distanceTo(p) > 0.5) spine.push(p);
      });
    });
    addBlueXrayPolyline(spine);
    arm.spurs.forEach((spur) => addBlueXrayPolyline(spur));
  });
  bluePowerCableGroup.visible = false;
  bluePowerCableGroup.renderOrder = 20;
  bluePowerCableGroup.frustumCulled = false;
  roomPower.add(bluePowerCableGroup);

  const matBluePulse = new THREE.MeshBasicMaterial({
    color: 0xb8d9ff,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const bluePulseGroup = new THREE.Group();
  bluePulseGroup.name = "PowerPulsesDistToPdu1";
  bluePulseGroup.visible = false;
  roomPower.add(bluePulseGroup);

  function makeBluePulseMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(2.585, 16, 12), matBluePulse));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.705, 1.705, 8.25, 12), matBluePulse));
    g.visible = false;
    g.renderOrder = 21;
    g.frustumCulled = false;
    g.userData.busy = false;
    bluePulseGroup.add(g);
    return g;
  }
  const bluePulsePool = Array.from({ length: 10 }, makeBluePulseMesh);
  const BLUE_PULSE_SPEED = 165;
  const BLUE_WAVE_RESTART_MS = 450;
  const activeBluePulses = [];
  let blueArrivedCount = 0;
  let blueWaveRestartAt = 0;

  function releaseBluePulse(mesh) {
    mesh.visible = false;
    mesh.userData.busy = false;
  }

  function acquireBluePulse() {
    const mesh = bluePulsePool.find((m) => !m.userData.busy) || makeBluePulseMesh();
    mesh.userData.busy = true;
    mesh.visible = true;
    return mesh;
  }

  function clearBluePulses() {
    activeBluePulses.length = 0;
    bluePulsePool.forEach(releaseBluePulse);
    blueArrivedCount = 0;
    blueWaveRestartAt = 0;
  }

  function spawnBluePulse(points, onArrive) {
    if (!points || points.length < 2) {
      onArrive?.();
      return;
    }
    const path = buildPolyline(points);
    if (path.total < 1e-3) {
      onArrive?.();
      return;
    }
    const mesh = acquireBluePulse();
    mesh.position.copy(points[0]);
    activeBluePulses.push({ mesh, path, traveled: 0, onArrive });
  }

  function onBluePduArrived() {
    blueArrivedCount += 1;
    if (blueArrivedCount >= blueSpurPaths.length) {
      blueWaveRestartAt = performance.now() + BLUE_WAVE_RESTART_MS;
    }
  }

  function onBlueReachedArmJunction(arm, index) {
    spawnBluePulse(arm.spurs[index], onBluePduArrived);
    if (index + 1 < arm.legs.length) {
      spawnBluePulse(arm.legs[index + 1], () => onBlueReachedArmJunction(arm, index + 1));
    }
  }

  function onBlueReachedUCorner() {
    blueArms.forEach((arm) => {
      if (!arm.legs.length) return;
      spawnBluePulse(arm.legs[0], () => onBlueReachedArmJunction(arm, 0));
    });
  }

  function startBlueFeedWave() {
    clearBluePulses();
    if (blueToCorner.length < 2 || !blueArms.length) return;
    spawnBluePulse(blueToCorner, onBlueReachedUCorner);
  }

  function updateBluePulses(dt) {
    if (blueWaveRestartAt && performance.now() >= blueWaveRestartAt) {
      startBlueFeedWave();
      return;
    }
    for (let i = activeBluePulses.length - 1; i >= 0; i--) {
      const pulse = activeBluePulses[i];
      pulse.traveled += BLUE_PULSE_SPEED * dt;
      if (pulse.traveled >= pulse.path.total) {
        const cb = pulse.onArrive;
        releaseBluePulse(pulse.mesh);
        activeBluePulses.splice(i, 1);
        cb?.();
        continue;
      }
      const t = pulse.traveled / pulse.path.total;
      const p = pulse.path.getPointAt(t);
      pulse.mesh.position.copy(p);
      const p2 = pulse.path.getPointAt(Math.min(1, t + 0.02));
      const dir = new THREE.Vector3().subVectors(p2, p);
      if (dir.lengthSq() > 1e-6) {
        pulse.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      }
    }
    matBluePulse.opacity = 0.88 + 0.12 * Math.sin(getElapsedTime() * 3.2);
  }

  const matRedXray = new THREE.MeshBasicMaterial({
    color: 0xff5c5c,
    transparent: true,
    opacity: 0.715,
    depthTest: false,
    depthWrite: false,
  });
  const redPowerCableGroup = new THREE.Group();
  redPowerCableGroup.name = "PowerCableMcbToPdu2";
  const redPowerPathPoints = [];
  const redToCorner = [];
  const redArms = [];
  const redSpurPaths = [];
  const mcbFeedOrigin = new THREE.Vector3(mcbX, mcbY, powerCableZ);

  function pdu2FeedGeom(rackName) {
    const sockInfo = industrialSocketByKey.get(`${rackName}|PDU2`);
    const rack = racks.find((r) => r.group.name === rackName)?.group;
    if (!sockInfo || !rack) return null;
    const rotY = rack.rotation.y;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const localX = -PDU_LOCAL_X;
    const junction = new THREE.Vector3(sockInfo.x, CPT_Y, sockInfo.z);
    const sockFace = new THREE.Vector3(sockInfo.x, sockInfo.y, sockInfo.z);
    const pduTop = new THREE.Vector3(
      rack.position.x + localX * cos - pduLocalZ * sin,
      pduTopY + 0.4,
      rack.position.z + localX * sin + pduLocalZ * cos
    );
    return { junction, sockFace, pduTop };
  }

  function pushRedPoint(arr, p) {
    const last = arr[arr.length - 1];
    const c = p.clone().add(RED_TRUNK_OFF);
    if (!last || last.distanceTo(c) > 0.5) {
      arr.push(c);
      redPowerPathPoints.push(c.clone());
    }
  }

  pushRedPoint(redToCorner, mcbFeedOrigin);
  pushRedPoint(redToCorner, new THREE.Vector3(trunkX, mcbY, trunkZ));
  pushRedPoint(redToCorner, new THREE.Vector3(trunkX, CPT_Y, trunkZ));
  pushRedPoint(redToCorner, new THREE.Vector3(cptXMax, CPT_Y, trunkZ));
  pushRedPoint(redToCorner, uCorner);

  function buildRedArm(rackNames, leadPts) {
    const arm = { legs: [], spurs: [] };
    let leg = [];
    (leadPts || []).forEach((p) => pushRedPoint(leg, p));
    rackNames.forEach((rackName) => {
      const g = pdu2FeedGeom(rackName);
      if (!g) return;
      pushRedPoint(leg, g.junction);
      arm.legs.push(leg);
      const jOff = leg[leg.length - 1];
      const spur = [jOff.clone(), g.sockFace.clone(), g.pduTop.clone()];
      arm.spurs.push(spur);
      redSpurPaths.push(spur);
      spur.forEach((p) => redPowerPathPoints.push(p.clone()));
      leg = [jOff.clone()];
    });
    redArms.push(arm);
    return arm;
  }

  buildRedArm(["Rack1", "Rack2", "Rack3"], [uCorner]);
  buildRedArm(["Rack4", "Rack5", "Rack6"], [uCorner, new THREE.Vector3(cptXMax, CPT_Y, cptZB)]);

  function addRedXrayPolyline(points) {
    buildPolyline(points).segs.forEach(({ a, b }) => {
      const seg = cylinderBetween(a, b, 1.265, matRedXray);
      if (seg) redPowerCableGroup.add(seg);
    });
  }
  addRedXrayPolyline(redToCorner);
  redArms.forEach((arm) => {
    const spine = [];
    arm.legs.forEach((leg, i) => {
      leg.forEach((p, j) => {
        if (i > 0 && j === 0) return;
        const last = spine[spine.length - 1];
        if (!last || last.distanceTo(p) > 0.5) spine.push(p);
      });
    });
    addRedXrayPolyline(spine);
    arm.spurs.forEach((spur) => addRedXrayPolyline(spur));
  });
  redPowerCableGroup.visible = false;
  redPowerCableGroup.renderOrder = 20;
  redPowerCableGroup.frustumCulled = false;
  roomPower.add(redPowerCableGroup);

  const matRedPulse = new THREE.MeshBasicMaterial({
    color: 0xffb0b0,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const redPulseGroup = new THREE.Group();
  redPulseGroup.name = "PowerPulsesMcbToPdu2";
  redPulseGroup.visible = false;
  roomPower.add(redPulseGroup);

  function makeRedPulseMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(2.585, 16, 12), matRedPulse));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.705, 1.705, 8.25, 12), matRedPulse));
    g.visible = false;
    g.renderOrder = 21;
    g.frustumCulled = false;
    g.userData.busy = false;
    redPulseGroup.add(g);
    return g;
  }
  const redPulsePool = Array.from({ length: 10 }, makeRedPulseMesh);
  const RED_PULSE_SPEED = 165;
  const RED_WAVE_RESTART_MS = 450;
  const activeRedPulses = [];
  let redArrivedCount = 0;
  let redWaveRestartAt = 0;

  function releaseRedPulse(mesh) {
    mesh.visible = false;
    mesh.userData.busy = false;
  }

  function acquireRedPulse() {
    const mesh = redPulsePool.find((m) => !m.userData.busy) || makeRedPulseMesh();
    mesh.userData.busy = true;
    mesh.visible = true;
    return mesh;
  }

  function clearRedPulses() {
    activeRedPulses.length = 0;
    redPulsePool.forEach(releaseRedPulse);
    redArrivedCount = 0;
    redWaveRestartAt = 0;
  }

  function spawnRedPulse(points, onArrive) {
    if (!points || points.length < 2) {
      onArrive?.();
      return;
    }
    const path = buildPolyline(points);
    if (path.total < 1e-3) {
      onArrive?.();
      return;
    }
    const mesh = acquireRedPulse();
    mesh.position.copy(points[0]);
    activeRedPulses.push({ mesh, path, traveled: 0, onArrive });
  }

  function onRedPduArrived() {
    redArrivedCount += 1;
    if (redArrivedCount >= redSpurPaths.length) {
      redWaveRestartAt = performance.now() + RED_WAVE_RESTART_MS;
    }
  }

  function onRedReachedArmJunction(arm, index) {
    spawnRedPulse(arm.spurs[index], onRedPduArrived);
    if (index + 1 < arm.legs.length) {
      spawnRedPulse(arm.legs[index + 1], () => onRedReachedArmJunction(arm, index + 1));
    }
  }

  function onRedReachedUCorner() {
    redArms.forEach((arm) => {
      if (!arm.legs.length) return;
      spawnRedPulse(arm.legs[0], () => onRedReachedArmJunction(arm, 0));
    });
  }

  function startRedFeedWave() {
    clearRedPulses();
    if (redToCorner.length < 2 || !redArms.length) return;
    spawnRedPulse(redToCorner, onRedReachedUCorner);
  }

  function updateRedPulses(dt) {
    if (redWaveRestartAt && performance.now() >= redWaveRestartAt) {
      startRedFeedWave();
      return;
    }
    for (let i = activeRedPulses.length - 1; i >= 0; i--) {
      const pulse = activeRedPulses[i];
      pulse.traveled += RED_PULSE_SPEED * dt;
      if (pulse.traveled >= pulse.path.total) {
        const cb = pulse.onArrive;
        releaseRedPulse(pulse.mesh);
        activeRedPulses.splice(i, 1);
        cb?.();
        continue;
      }
      const t = pulse.traveled / pulse.path.total;
      const p = pulse.path.getPointAt(t);
      pulse.mesh.position.copy(p);
      const p2 = pulse.path.getPointAt(Math.min(1, t + 0.02));
      const dir = new THREE.Vector3().subVectors(p2, p);
      if (dir.lengthSq() > 1e-6) {
        pulse.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      }
    }
    matRedPulse.opacity = 0.88 + 0.12 * Math.sin(getElapsedTime() * 3.2);
  }

  return {
    matBlueXray,
    matRedXray,
    updateBluePulses,
    updateRedPulses,
    startBlueFeedWave,
    startRedFeedWave,
    clearBluePulses,
    clearRedPulses,
    highlightGroups: [bluePowerCableGroup, bluePulseGroup, redPowerCableGroup, redPulseGroup],
  };
}
