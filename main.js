import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const CLIENT_ID = window.startConfig.clientId;
const SPREADSHEET_ID = window.startConfig.spreadsheetId;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [], tetrahedron: [] };
let tokenClient;

function initApp() {
    if (!window.google) {
        setTimeout(initApp, 100);
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
            if (response.error) throw response;
            await fetchData(response.access_token);
        }
    });

    document.getElementById('google-signin-btn').onclick = () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };
}

initApp();

async function fetchData(token) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A2:F`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    document.getElementById('login-overlay').style.display = 'none';
    init3D(data.values);
    animate();
}

function init3D(data) {
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000;

    scene = new THREE.Scene();

    // 1. Create all CSS3DObjects
    for (let i = 0; i < data.length; i++) {
        const el = document.createElement('div');
        el.className = 'element';
        el.style.backgroundColor = 'rgba(0,127,127,' + (Math.random() * 0.5 + 0.25) + ')';

        const img = document.createElement('img');
        img.src = data[i][1]; 
        el.appendChild(img);

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = data[i][0];
        el.appendChild(name);

        const det = document.createElement('div');
        det.className = 'details';
        det.textContent = data[i][3];
        el.appendChild(det);

        const obj = new CSS3DObject(el);
        obj.position.x = Math.random() * 4000 - 2000;
        obj.position.y = Math.random() * 4000 - 2000;
        obj.position.z = Math.random() * 4000 - 2000;
        scene.add(obj);
        objects.push(obj);
    }

    // 2. Define TABLE targets
    for (let i = 0; i < objects.length; i++) {
        const t = new THREE.Object3D();
        // Simple grid layout for table view
        t.position.x = (i % 20) * 140 - 1330;
        t.position.y = -(Math.floor(i / 20)) * 180 + 990;
        targets.table.push(t);
    }

    // 3. Define SPHERE targets
    const vector = new THREE.Vector3();
    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        const phi = Math.acos(-1 + (2 * i) / objects.length);
        const theta = Math.sqrt(objects.length * Math.PI) * phi;
        obj.position.setFromSphericalCoords(800, phi, theta);
        vector.copy(obj.position).multiplyScalar(2);
        obj.lookAt(vector);
        targets.sphere.push(obj);
    }

    // 4. Define HELIX targets
    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        const theta = i * 0.175 + Math.PI;
        const y = -(i * 8) + 450;
        obj.position.setFromCylindricalCoords(900, theta, y);
        vector.x = obj.position.x * 2;
        vector.y = obj.position.y;
        vector.z = obj.position.z * 2;
        obj.lookAt(vector);
        targets.helix.push(obj);
    }

    // 5. Define GRID targets
    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        obj.position.x = (i % 5) * 400 - 800;
        obj.position.y = -(Math.floor(i / 5) % 5) * 400 + 800;
        obj.position.z = (Math.floor(i / 25)) * 1000 - 2000;
        targets.grid.push(obj);
    }

    // 6. Define TETRAHEDRON targets (FIXED)
    let index = 0;
    let layer = 0;
    // Build a pyramid shape
    while (index < objects.length) {
        for (let row = 0; row <= layer && index < objects.length; row++) {
            for (let col = 0; col <= layer - row && index < objects.length; col++) {
                const obj = new THREE.Object3D();
                
                // Position logic for pyramid layers
                obj.position.x = (col - (layer - row) / 2) * 160;
                obj.position.z = (row - layer / 2) * 160;
                obj.position.y = layer * 140 - 400; // Stack upwards
                
                // IMPORTANT: Make elements face center/outwards so it looks 3D
                vector.copy(obj.position).multiplyScalar(2);
                obj.lookAt(vector);
                
                targets.tetrahedron.push(obj);
                index++;
            }
        }
        layer++;
    }

    // Renderer & Controls
    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);

    // Button Listeners
    document.getElementById('table').onclick = () => transform(targets.table, 2000);
    document.getElementById('sphere').onclick = () => transform(targets.sphere, 2000);
    document.getElementById('helix').onclick = () => transform(targets.helix, 2000);
    document.getElementById('grid').onclick = () => transform(targets.grid, 2000);
    document.getElementById('tetrahedron').onclick = () => transform(targets.tetrahedron, 2000);

    // Initial transform
    transform(targets.table, 2000);
    window.addEventListener('resize', onResize);
}

// FIXED TRANSFORM FUNCTION (Includes Rotation)
function transform(targetsArr, duration) {
    TWEEN.removeAll();

    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        const target = targetsArr[i];

        // Position Tween
        new TWEEN.Tween(object.position)
            .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();

        // Rotation Tween (Fixes the visual bug)
        new TWEEN.Tween(object.rotation)
            .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }

    new TWEEN.Tween(this)
        .to({}, duration * 2)
        .onUpdate(render)
        .start();
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
}

function render() {
    renderer.render(scene, camera);
}