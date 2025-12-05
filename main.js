import * as THREE from 'three';
// FIXED IMPORT: Removed '.min' to prevent 404/CORS error
import  TWEEN  from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// Configuration from index.html
const CLIENT_ID = window.startConfig.clientId;
const SPREADSHEET_ID = window.startConfig.spreadsheetId;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };
let tokenClient;

// --- 1. INITIALIZE & AUTH ---

function initApp() {
    // Check if Google Library is loaded
    if (!window.google) {
        setTimeout(initApp, 100);
        return;
    }

    // Initialize Token Client (Implicit Grant Flow)
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
            if (response.error !== undefined) {
                throw (response);
            }
            // Success: Use token to fetch data
            await fetchData(response.access_token);
        },
    });

    // Attach click listener to the button
    document.getElementById('google-signin-btn').addEventListener('click', () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

// Start waiting for Google Lib
initApp();


// --- 2. FETCH DATA ---

async function fetchData(accessToken) {
    // Range A2:F assumes headers are in row 1. Adjust if needed.
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A2:F`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const result = await response.json();
        
        if (result.values && result.values.length > 0) {
            // Hide Login
            document.getElementById('login-overlay').style.display = 'none';
            // Start 3D World
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


// --- 3. THREE.JS LOGIC ---

function init3D(data) {
    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 3000;

    scene = new THREE.Scene();

    // --- CREATE OBJECTS (TILES) ---
    for ( let i = 0; i < data.length; i ++ ) {
        const item = data[i]; 
        // Data Map: [0]Name, [1]Photo, [2]Age, [3]Country, [4]Interest, [5]Net Worth

        const element = document.createElement( 'div' );
        element.className = 'element';
        
        // COLOR CODING [cite: 16]
        // Parse "$251,260.80" -> 251260.80
        let netWorthVal = 0;
        if(item[5]) {
            netWorthVal = parseFloat(item[5].replace(/[^0-9.-]+/g,""));
        }

        if (netWorthVal > 200000) {
            element.style.backgroundColor = 'rgba(0,127,0,0.7)'; // Green
        } else if (netWorthVal > 100000) {
            element.style.backgroundColor = 'rgba(255,165,0,0.7)'; // Orange
        } else {
            element.style.backgroundColor = 'rgba(200,0,0,0.7)'; // Red
        }

        // PHOTO
        const img = document.createElement('img');
        img.src = item[1]; 
        element.appendChild(img);

        // NAME
        const name = document.createElement( 'div' );
        name.className = 'name';
        name.textContent = item[0];
        element.appendChild( name );

        // DETAILS
        const details = document.createElement( 'div' );
        details.className = 'details';
        details.textContent = item[3]; // Country
        element.appendChild( details );

        // CSS OBJECT
        const objectCSS = new CSS3DObject( element );
        objectCSS.position.x = Math.random() * 4000 - 2000;
        objectCSS.position.y = Math.random() * 4000 - 2000;
        objectCSS.position.z = Math.random() * 4000 - 2000;
        scene.add( objectCSS );
        objects.push( objectCSS );

        // --- LAYOUT 1: TABLE (20x10) [cite: 19] ---
        const objectTable = new THREE.Object3D();
        const col = i % 20;
        const row = Math.floor( i / 20 );

        objectTable.position.x = ( col * 140 ) - 1330;
        objectTable.position.y = - ( row * 180 ) + 990;
        targets.table.push( objectTable );
    }

    // --- LAYOUT 2: SPHERE ---
    const vector = new THREE.Vector3();
    for ( let i = 0, l = objects.length; i < l; i ++ ) {
        const phi = Math.acos( - 1 + ( 2 * i ) / l );
        const theta = Math.sqrt( l * Math.PI ) * phi;
        const object = new THREE.Object3D();
        object.position.setFromSphericalCoords( 800, phi, theta );
        vector.copy( object.position ).multiplyScalar( 2 );
        object.lookAt( vector );
        targets.sphere.push( object );
    }

    // --- LAYOUT 3: DOUBLE HELIX [cite: 23] ---
    for ( let i = 0, l = objects.length; i < l; i ++ ) {
        // Double helix: offset every second item by PI (180 deg)
        const theta = i * 0.175 + Math.PI + (i % 2) * Math.PI; 
        const y = - ( i * 8 ) + 450;
        
        const object = new THREE.Object3D();
        object.position.setFromCylindricalCoords( 900, theta, y );
        
        vector.x = object.position.x * 2;
        vector.y = object.position.y;
        vector.z = object.position.z * 2;
        object.lookAt( vector );
        targets.helix.push( object );
    }

    // --- LAYOUT 4: GRID (5x4x10) [cite: 24] ---
    for ( let i = 0; i < objects.length; i ++ ) {
        const object = new THREE.Object3D();
        // 5 items wide
        object.position.x = ( ( i % 5 ) * 400 ) - 800;
        // 4 items high
        object.position.y = ( - ( Math.floor( i / 5 ) % 4 ) * 400 ) + 800;
        // 10 items deep
        object.position.z = ( Math.floor( i / 20 ) ) * 1000 - 2000;
        targets.grid.push( object );
    }

    // --- RENDERER & CONTROLS ---
    renderer = new CSS3DRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.getElementById( 'container' ).appendChild( renderer.domElement );

    controls = new TrackballControls( camera, renderer.domElement );
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener( 'change', render );

    // BUTTONS
    const buttonTable = document.getElementById( 'table' );
    buttonTable.addEventListener( 'click', function () { transform( targets.table, 2000 ); } );

    const buttonSphere = document.getElementById( 'sphere' );
    buttonSphere.addEventListener( 'click', function () { transform( targets.sphere, 2000 ); } );

    const buttonHelix = document.getElementById( 'helix' );
    buttonHelix.addEventListener( 'click', function () { transform( targets.helix, 2000 ); } );

    const buttonGrid = document.getElementById( 'grid' );
    buttonGrid.addEventListener( 'click', function () { transform( targets.grid, 2000 ); } );

    // Start with Table view
    transform( targets.table, 2000 );

    window.addEventListener( 'resize', onWindowResize );
}

function transform( targets, duration ) {
    TWEEN.removeAll();
    for ( let i = 0; i < objects.length; i ++ ) {
        const object = objects[ i ];
        const target = targets[ i ];
        new TWEEN.Tween( object.position )
            .to( { x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();
        new TWEEN.Tween( object.rotation )
            .to( { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();
    }
    new TWEEN.Tween( this )
        .to( {}, duration * 2 )
        .onUpdate( render )
        .start();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();
}

function animate() {
    requestAnimationFrame( animate );
    TWEEN.update();
    controls.update();
}

function render() {
    renderer.render( scene, camera );
}