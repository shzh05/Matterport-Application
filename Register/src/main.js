import { setupSdk } from '@matterport/sdk';

// Access environment variables
const sdkKey = import.meta.env.VITE_SDK_KEY;
const modelSid = import.meta.env.VITE_MODEL_SID;


// Sweep IDs for locations
const locations = [
  { name: 'Workbar', sid: 'rthke46ueqhdhkg5p2m06prhb'},
  { name: 'Cafe', sid: '4w7c8xwg55xt5zp3e34246syd'},
  { name: 'Study', sid: 'siipsb0ktsq8hu91xf5aza1kb'},
  { name: 'Office', sid: '10sad2qsagd94wfnf0hdw2ebd'},
  { name: 'Meeting Room', sid: 'dpy73wp5g6tsesp3rbf3x4uub'},
  { name: 'Classroom', sid: 'k2qdxf5p25w44gs3arf6f9a3a'}
];


// Function to set up location dropdown
const setupLocationDropdown = () => {
  const startSelect = document.getElementById('startSelect');
  const endSelect = document.getElementById('endSelect');
  
  locations.forEach(loc => {
    const startOpt = document.createElement('option');
    startOpt.value = loc.sid;
    startOpt.text = loc.name;
    startSelect.appendChild(startOpt);
    
    const endOpt = document.createElement('option');
    endOpt.value = loc.sid;
    endOpt.text = loc.name;
    endSelect.appendChild(endOpt);
  });

  endSelect.selectedIndex = 1;
};


// Set up the SDK promise to connect when the iframe is ready
const sdkReady = new Promise((resolve, reject) => {
  const showcase = document.getElementById('showcase');
  showcase.src = `/bundle/showcase.html?m=${modelSid}&applicationKey=${sdkKey}`;
  const showcaseWindow = showcase.contentWindow;

  showcase.addEventListener('load', async () => {
    try {
      const mpSdk = await showcaseWindow.MP_SDK.connect(showcaseWindow);
      console.log('✅ SDK connected');
      resolve(mpSdk);
    } catch (error) {
      reject(error);
    }
  });
});


// Create custom path line component
class PathLineComponent {
  inputs = {
    start: null,
    end: null
  };

  constructor(params) {
    this.color = { r: 1, g: 0, b: 0 };
    this.line = null;
  }
  
  onInit() {
    const THREE = this.context.three;
    const { start, end } = this.inputs;

    // Create line geometry
    const points = [
      new THREE.Vector3(start.x, start.y-0.7, start.z),
      new THREE.Vector3(end.x, end.y-0.7, end.z)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(this.color.r, this.color.g, this.color.b) 
    });
    
    this.line = new THREE.Line(geometry, material);
    
    // Assign to objectRoot to add to scene
    this.outputs.objectRoot = this.line;
    
    console.log('Line component initialized');
  }
  
  onDestroy() {
    if (this.line) {
      this.line.geometry.dispose();
      this.line.material.dispose();
    }
  }
}


const main = async () => {
  // Connect to SDK and wait for app to be in PLAYING phase
  const mpSdk = await sdkReady;
  await mpSdk.App.state.waitUntil(state => state.phase === mpSdk.App.Phase.PLAYING);
  mpSdk.Camera.rotate(35, 0);

  // Initialize dropdowns
  setupLocationDropdown();
  const controls = document.getElementById('controls');
  controls.classList.add('visible'); // Trigger fade-in by adding class

  // Register components
  await mpSdk.Scene.register('path-line', () => new PathLineComponent());
  
  console.log('Visual components registered');

  // Get current sweep data
  let current;
  
  mpSdk.Sweep.current.subscribe(function (currentSweep) {
    if (currentSweep.sid === '') {
      console.log('Not currently stationed at a sweep position');
    } else {
      console.log('Currently at sweep', currentSweep.sid);
      console.log('Current position', currentSweep.position);
      console.log('On floor', currentSweep.floorInfo.sequence);
      current = currentSweep.sid;
    }
  });

  await mpSdk.Sweep.current.waitUntil((currentSweep) => currentSweep.id !== '');

  // Get all tag information
  mpSdk.Tag.data.subscribe({
    onAdded(index, item, collection) {
      // console.log('Tag added', index, item, collection);
      if (index !== 'pqieon5NcCW') {
        mpSdk.Tag.editOpacity(index, 0.3);
      }
    }
  });

  await mpSdk.Tag.data.waitUntil((collection) => {
    return Object.values(collection).some(tag => tag.id === 'QAn4IfoTZPI');
  });
  await mpSdk.Mattertag.navigateToTag('QAn4IfoTZPI', mpSdk.Mattertag.Transition.FLY);
  await mpSdk.Tag.editOpacity('QAn4IfoTZPI', 1);

  // // Change tag color and opacity to highlight it as a point of interest
  // const highlightColour = { r: 1, g: 0.84, b: 0 }; // Gold
  // const originalColour = { r: 1, g: 1, b: 1 }; // White

  // await mpSdk.Tag.editColor('pqieon5NcCW', highlightColour);
  // await mpSdk.Tag.editOpacity('pqieon5NcCW', 1);

  // Create graph from scan points
  const sweepGraph = await mpSdk.Sweep.createGraph();
  console.log("Pathfinding graph ready", sweepGraph);

  // Modify edge weights
  for (const { src, dst, weight } of sweepGraph.edges) {
    sweepGraph.setEdge({ src, dst, weight: weight ** 2 });
  }

  let currentLine = null;

  // Onclick listener for pathfinding button
  document.getElementById('generatePath').onclick = async () => {
    const startSid = document.getElementById('startSelect').value;
    const endSid = document.getElementById('endSelect').value;

    if (!startSid || !endSid) {
      alert('Please select both start and end locations');
      return;
    }

    if (startSid === endSid) {
      alert('Please select different start and end locations');
      return;
    }

    // Get start and end sweep positions
    const startSweep = sweepGraph.vertex(startSid);
    const endSweep = sweepGraph.vertex(endSid);
    console.log(sweepGraph);
    if (!startSweep || !endSweep) {
      console.error('Start or end sweep not found');
      return;
    }

    // Move camera to start position
    const rotation = { x: 30, y: -45 };
    // const transition = mpSdk.Camera.Transition.INSTANT;
    const transitionTime = 1000; // in milliseconds

    mpSdk.Sweep.moveTo(startSid, {
      rotation: rotation,
      transitionTime: transitionTime,
    })
    .then(function(startSid){
      // Move successful.
      console.log('Arrived at sweep ' + startSid);
    })
    .catch(function(error){
      // Error with moveTo command
    });

    // Start standard pathfinding
    const aStarRunner = mpSdk.Graph.createAStarRunner(sweepGraph, startSweep, endSweep);
    const path = aStarRunner.exec().path;
    console.log('Path ', path);

    // Create scene object to visualize path
    if (currentLine) {
      currentLine.stop();
      currentLine = null;
    }
    const [sceneObject] = await mpSdk.Scene.createObjects(1);
    currentLine = sceneObject;
    const node = sceneObject.addNode();

    for (let i = 0; i < path.length-1; i++) {
      const start = path[i].data.position;
      const end = path[i+1].data.position;

      // Add line component to connect this vertex to the next
      node.addComponent('path-line', { 
        start: start,
        end: end
      });
    }

    // Start the scene to make everything visible
    node.start();
    sceneObject.start();
  };
};

main().catch(err => console.error('Error:', err));