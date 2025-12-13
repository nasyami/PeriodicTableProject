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

// --- 1. GOOGLE AUTH & INIT ---
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

// --- 2. 3D SCENE SETUP ---
function init3D(data) {
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000;

    scene = new THREE.Scene();

    // Create CSS3D Objects (The Cards)
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

    // --- TARGETS: TABLE ---
    for (let i = 0; i < objects.length; i++) {
        const t = new THREE.Object3D();
        t.position.x = (i % 20) * 140 - 1330;
        t.position.y = -(Math.floor(i / 20)) * 180 + 990;
        targets.table.push(t);
    }

    // --- TARGETS: SPHERE ---
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

    // --- TARGETS: HELIX ---
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

    // --- TARGETS: GRID ---
    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        obj.position.x = (i % 5) * 400 - 800;
        obj.position.y = -(Math.floor(i / 5) % 5) * 400 + 800;
        obj.position.z = (Math.floor(i / 25)) * 1000 - 2000;
        targets.grid.push(obj);
    }

    // --- TARGETS: TETRAHEDRON (FIXED PYRAMID) ---
    let index = 0;
    // Loop through layers (1 to 8)
    for (let i = 1; i <= 8; i++) {
        // Loop through rows in this layer
        for (let j = 0; j < i; j++) {
            // Loop through items in this row
            for (let k = 0; k <= j; k++) {
                if (index >= objects.length) break;

                const obj = new THREE.Object3D();
                
                // Centering Logic
                const spacing = 160;
                // x: Center the row
                obj.position.x = (k - j * 0.5) * spacing;
                // z: Center the layer depth
                obj.position.z = (j - (i - 1) * 0.5) * spacing;
                // y: Stack from top down
                obj.position.y = -(i * 140) + 800;

                // Make them look slightly outward for 3D effect
                vector.copy(obj.position).multiplyScalar(2);
                obj.lookAt(vector);

                targets.tetrahedron.push(obj);
                index++;
            }
        }
    }

    // --- RENDERER ---
    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    // --- CONTROLS ---
    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);

    // --- BUTTONS ---
    const buttonTable = document.getElementById('table');
    const buttonSphere = document.getElementById('sphere');
    const buttonHelix = document.getElementById('helix');
    const buttonGrid = document.getElementById('grid');
    const buttonTetra = document.getElementById('tetrahedron');

    buttonTable.addEventListener('click', () => transform(targets.table, 2000));
    buttonSphere.addEventListener('click', () => transform(targets.sphere, 2000));
    buttonHelix.addEventListener('click', () => transform(targets.helix, 2000));
    buttonGrid.addEventListener('click', () => transform(targets.grid, 2000));
    buttonTetra.addEventListener('click', () => transform(targets.tetrahedron, 2000));

    transform(targets.table, 2000);
    window.addEventListener('resize', onResize);
}

// --- 3. ANIMATION & TRANSFORM ---
function transform(targetsArr, duration) {
    TWEEN.removeAll();

    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        const target = targetsArr[i];

        // Animate Position
        new TWEEN.Tween(object.position)
            .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();

        // Animate Rotation (CRITICAL FIX)
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