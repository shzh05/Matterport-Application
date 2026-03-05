import { setupSdk } from '@matterport/sdk';

// Access environment variables
const sdkKey = import.meta.env.VITE_SDK_KEY;
const modelSid = import.meta.env.VITE_MODEL_SID;

const main = async () => {
  // const mpSdk = await setupSdk(sdkKey, {
  //   space: modelSid
  // });
  // await mpSdk.App.state.waitUntil(state => state.phase === mpSdk.App.Phase.PLAYING);
  // mpSdk.Camera.rotate(35, 0);
  // let mpSdk;

  // const showcase = document.getElementById('showcase');
  // const showcaseWindow = showcase.contentWindow;
  // showcase.addEventListener('load', async function() {
  //   try {
  //     mpSdk = await showcaseWindow.MP_SDK.connect(showcaseWindow);
  //   }
  //   catch(e) {
  //     console.error(e);
  //     return;
  // }

  // console.log('Hello Bundle SDK', mpSdk);
  // });

  // Connect to Matterport SDK
  const sdkReady = new Promise((resolve, reject) => {
    const showcase = document.getElementById('showcase');
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

  const mpSdk = await sdkReady;
  await mpSdk.App.state.waitUntil(state => state.phase === mpSdk.App.Phase.PLAYING);
  mpSdk.Camera.rotate(35, 0);

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

  // Create graph from scan points
  const sweepGraph = await mpSdk.Sweep.createGraph();
  console.log("Pathfinding graph ready");

  // Get start and end sweep positions
  const startSweep = sweepGraph.vertex(current);
  const endSweep = sweepGraph.vertex('10sad2qsagd94wfnf0hdw2ebd'); 
  
  if (!startSweep || !endSweep) {
    console.error('Start or end sweep not found');
    return;
  }

  // Modify edge weights
  for (const { src, dst, weight } of sweepGraph.edges) {
    sweepGraph.setEdge({ src, dst, weight: weight ** 2 });
  }

  // Start standard pathfinding
  const aStarRunner = mpSdk.Graph.createAStarRunner(sweepGraph, startSweep, endSweep);
  const path = aStarRunner.exec().path;

  aStarRunner.subscribe({
  onChanged(runner) {
    console.log('sweep graph has changed');
  }
});

  console.log('Path ', path);

  // Create scene object to visualize path
  const [sceneObject] = await mpSdk.Scene.createObjects(1);
  const node = sceneObject.addNode();
  console.log('Scene object created', sceneObject, node);

  // Collect positions for line to connect the path
  const positions = [];

  for (let i = 0; i < path.length; i++) {
    const vertex = path[i];
    const pos = vertex.data.position;
    positions.push(pos.x, pos.y, pos.z);
  }

  console.log('Positions ', positions);

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
      //console.log('Initializing line component with start', this.inputs);

      // Create line geometry
      const points = [
        new THREE.Vector3(start.x, start.y-5, start.z),
        new THREE.Vector3(end.x, end.y, end.z)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: new THREE.Color(this.color.r, this.color.g, this.color.b) 
      });
      
      this.line = new THREE.Line(geometry, material);
      
      // IMPORTANT: Assign to objectRoot to add to scene
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
  
  // Register components
  await mpSdk.Scene.register('path-line', () => new PathLineComponent());
  
  console.log('✅ Visual components registered');

  for (let i = 0; i < path.length-1; i++) {
    const start = path[i].data.position;
    const end = path[i+1].data.position;
    console.log(node.addComponent);
    // Add line component to connect this vertex to the next
    node.addComponent('path-line', { 
      start: start,
      end: end
     });
  }

  
  // 6. Start the scene to make everything visible
  node.start();
  sceneObject.start();

  sweepGraph.dispose();
};

main().catch(err => console.error('Error:', err));