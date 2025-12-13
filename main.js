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
            if (response.error !== undefined) {
                throw response;
            }
            await fetchData(response.access_token);
        },
    });

    document.getElementById('google-signin-btn').addEventListener('click', () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

initApp();

async function fetchData(accessToken) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A2:F`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const result = await response.json();

        if (result.values && result.values.length > 0) {
            document.getElementById('login-overlay').style.display = 'none';
            init3D(result.values);
            animate();
        } else {
            alert("Connected to Sheet, but it looks empty!");
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        alert("Error fetching data. Check console.");
    }
}

function init3D(data) {
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000;

    scene = new THREE.Scene();

    for (let i = 0; i < data.length; i++) {
        const item = data[i];

        const element = document.createElement('div');
        element.className = 'element';

        let netWorthVal = 0;
        if (item[5]) {
            netWorthVal = parseFloat(item[5].replace(/[^0-9.-]+/g, ""));
        }

        if (netWorthVal > 200000) {
            element.style.backgroundColor = 'rgba(0,127,0,0.7)';
        } else if (netWorthVal > 100000) {
            element.style.backgroundColor = 'rgba(255,165,0,0.7)';
        } else {
            element.style.backgroundColor = 'rgba(200,0,0,0.7)';
        }

        const img = document.createElement('img');
        img.src = item[1];
        element.appendChild(img);

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = item[0];
        element.appendChild(name);

        const details = document.createElement('div');
        details.className = 'details';
        details.textContent = item[3];
        element.appendChild(details);

        const objectCSS = new CSS3DObject(element);
        objectCSS.position.x = Math.random() * 4000 - 2000;
        objectCSS.position.y = Math.random() * 4000 - 2000;
        objectCSS.position.z = Math.random() * 4000 - 2000;
        scene.add(objectCSS);
        objects.push(objectCSS);

        const objectTable = new THREE.Object3D();
        const col = i % 20;
        const row = Math.floor(i / 20);
        objectTable.position.x = (col * 140) - 1330;
        objectTable.position.y = -(row * 180) + 990;
        targets.table.push(objectTable);
    }

    const vector = new THREE.Vector3();

    for (let i = 0, l = objects.length; i < l; i++) {
        const phi = Math.acos(-1 + (2 * i) / l);
        const theta = Math.sqrt(l * Math.PI) * phi;
        const object = new THREE.Object3D();
        object.position.setFromSphericalCoords(800, phi, theta);
        vector.copy(object.position).multiplyScalar(2);
        object.lookAt(vector);
        targets.sphere.push(object);
    }

    for (let i = 0, l = objects.length; i < l; i++) {
        const theta = i * 0.175 + Math.PI + (i % 2) * Math.PI;
        const y = -(i * 8) + 450;
        const object = new THREE.Object3D();
        object.position.setFromCylindricalCoords(900, theta, y);
        vector.x = object.position.x * 2;
        vector.y = object.position.y;
        vector.z = object.position.z * 2;
        object.lookAt(vector);
        targets.helix.push(object);
    }

    for (let i = 0; i < objects.length; i++) {
        const object = new THREE.Object3D();
        object.position.x = ((i % 5) * 400) - 800;
        object.position.y = (-(Math.floor(i / 5) % 4) * 400) + 800;
        object.position.z = (Math.floor(i / 20)) * 1000 - 2000;
        targets.grid.push(object);
    }

    const scale = 900;

    const apex = new THREE.Vector3(0, scale, 0);
    const baseA = new THREE.Vector3(-scale, -scale, scale);
    const baseB = new THREE.Vector3(scale, -scale, scale);
    const baseC = new THREE.Vector3(0, -scale, -scale);

    const faces = [
        [apex, baseA, baseB],
        [apex, baseB, baseC],
        [apex, baseC, baseA],
        [baseA, baseB, baseC]
    ];

    for (let i = 0; i < objects.length; i++) {
        const object = new THREE.Object3D();

        const face = faces[i % 4];
        const A = face[0], B = face[1], C = face[2];

        const r1 = Math.random();
        const r2 = Math.random();
        const s = Math.sqrt(r1);

        object.position.copy(
            A.clone().multiplyScalar(1 - s)
                .add(B.clone().multiplyScalar(s * (1 - r2)))
                .add(C.clone().multiplyScalar(s * r2))
        );

        vector.copy(object.position).multiplyScalar(2);
        object.lookAt(vector);

        targets.tetrahedron.push(object);
    }

    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);

    document.getElementById('table').addEventListener('click', () => transform(targets.table, 2000));
    document.getElementById('sphere').addEventListener('click', () => transform(targets.sphere, 2000));
    document.getElementById('helix').addEventListener('click', () => transform(targets.helix, 2000));
    document.getElementById('grid').addEventListener('click', () => transform(targets.grid, 2000));
    document.getElementById('tetrahedron').addEventListener('click', () => transform(targets.tetrahedron, 2000));

    transform(targets.table, 2000);

    window.addEventListener('resize', onWindowResize);
}

function transform(targetsArr, duration) {
    TWEEN.removeAll();

    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        const target = targetsArr[i];

        new TWEEN.Tween(object.position)
            .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();

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

function onWindowResize() {
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
