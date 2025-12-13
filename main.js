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

    for (let i = 0; i < data.length; i++) {
        const el = document.createElement('div');
        el.className = 'element';

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
        obj.position.set(
            Math.random() * 4000 - 2000,
            Math.random() * 4000 - 2000,
            Math.random() * 4000 - 2000
        );
        scene.add(obj);
        objects.push(obj);

        const t = new THREE.Object3D();
        t.position.x = (i % 20) * 140 - 1330;
        t.position.y = -(Math.floor(i / 20)) * 180 + 990;
        targets.table.push(t);
    }

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

    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        obj.position.setFromCylindricalCoords(900, i * 0.175, -i * 8 + 450);
        vector.copy(obj.position).multiplyScalar(2);
        obj.lookAt(vector);
        targets.helix.push(obj);
    }

    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        obj.position.x = (i % 5) * 400 - 800;
        obj.position.y = -(Math.floor(i / 5) % 4) * 400 + 800;
        obj.position.z = Math.floor(i / 20) * 1000 - 2000;
        targets.grid.push(obj);
    }

    const spacing = 180;
    const height = 200;
    let index = 0;
    let layer = 0;

    while (index < objects.length) {
        for (let row = 0; row <= layer && index < objects.length; row++) {
            for (let col = 0; col <= layer - row && index < objects.length; col++) {
                const obj = new THREE.Object3D();
                obj.position.x = (col - (layer - row) / 2) * spacing;
                obj.position.z = (row - layer / 2) * spacing;
                obj.position.y = layer * height;
                targets.tetrahedron.push(obj);
                index++;
            }
        }
        layer++;
    }

    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);

    document.getElementById('table').onclick = () => transform(targets.table);
    document.getElementById('sphere').onclick = () => transform(targets.sphere);
    document.getElementById('helix').onclick = () => transform(targets.helix);
    document.getElementById('grid').onclick = () => transform(targets.grid);
    document.getElementById('tetrahedron').onclick = () => transform(targets.tetrahedron);

    transform(targets.table);
    window.onresize = onResize;
}

function transform(targetsArr, duration = 2000) {
    TWEEN.removeAll();
    for (let i = 0; i < objects.length; i++) {
        new TWEEN.Tween(objects[i].position)
            .to(targetsArr[i].position, duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }
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
