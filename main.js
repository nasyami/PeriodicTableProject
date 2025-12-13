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
        },
    });

    document.getElementById('google-signin-btn').onclick = () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };
}
initApp();

async function fetchData(accessToken) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A2:F`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const result = await response.json();
    document.getElementById('login-overlay').style.display = 'none';
    init3D(result.values);
    animate();
}

function init3D(data) {
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000;

    scene = new THREE.Scene();

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const element = document.createElement('div');
        element.className = 'element';

        let netWorth = item[5] ? parseFloat(item[5].replace(/[^0-9.-]+/g, "")) : 0;
        element.style.backgroundColor =
            netWorth > 200000 ? 'rgba(0,127,0,0.7)' :
            netWorth > 100000 ? 'rgba(255,165,0,0.7)' :
            'rgba(200,0,0,0.7)';

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
        objectCSS.position.set(
            Math.random() * 4000 - 2000,
            Math.random() * 4000 - 2000,
            Math.random() * 4000 - 2000
        );
        scene.add(objectCSS);
        objects.push(objectCSS);

        const objectTable = new THREE.Object3D();
        objectTable.position.x = (i % 20) * 140 - 1330;
        objectTable.position.y = -(Math.floor(i / 20)) * 180 + 990;
        targets.table.push(objectTable);
    }

    const vector = new THREE.Vector3();

    for (let i = 0; i < objects.length; i++) {
        const phi = Math.acos(-1 + (2 * i) / objects.length);
        const theta = Math.sqrt(objects.length * Math.PI) * phi;
        const obj = new THREE.Object3D();
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

    const scale = 900;
    const v = [
        new THREE.Vector3(1,1,1).normalize().multiplyScalar(scale),
        new THREE.Vector3(1,-1,-1).normalize().multiplyScalar(scale),
        new THREE.Vector3(-1,1,-1).normalize().multiplyScalar(scale),
        new THREE.Vector3(-1,-1,1).normalize().multiplyScalar(scale)
    ];

    const faces = [
        [v[0],v[1],v[2]],[v[0],v[1],v[3]],[v[0],v[2],v[3]],[v[1],v[2],v[3]]
    ];

    for (let i = 0; i < objects.length; i++) {
        const obj = new THREE.Object3D();
        const f = faces[i % 4];
        const r1 = Math.random(), r2 = Math.random();
        const s = Math.sqrt(r1);
        obj.position.copy(
            f[0].clone().multiplyScalar(1-s)
            .add(f[1].clone().multiplyScalar(s*(1-r2)))
            .add(f[2].clone().multiplyScalar(s*r2))
        );
        vector.copy(obj.position).multiplyScalar(2);
        obj.lookAt(vector);
        targets.tetrahedron.push(obj);
    }

    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);

    document.getElementById('table').onclick = () => transform(targets.table, 2000);
    document.getElementById('sphere').onclick = () => transform(targets.sphere, 2000);
    document.getElementById('helix').onclick = () => transform(targets.helix, 2000);
    document.getElementById('grid').onclick = () => transform(targets.grid, 2000);
    document.getElementById('tetrahedron').onclick = () => transform(targets.tetrahedron, 2000);

    transform(targets.table, 2000);
    window.onresize = onWindowResize;
}

function transform(targets, duration) {
    TWEEN.removeAll();
    for (let i = 0; i < objects.length; i++) {
        new TWEEN.Tween(objects[i].position)
            .to(targets[i].position, duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
        new TWEEN.Tween(objects[i].rotation)
            .to(targets[i].rotation, duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }
    new TWEEN.Tween(this).to({}, duration * 2).onUpdate(render).start();
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
