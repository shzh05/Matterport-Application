import { setupSdk } from '@matterport/sdk';

// Access environment variables
const sdkKey = import.meta.env.VITE_SDK_KEY;
const modelSid = import.meta.env.VITE_MODEL_SID;


// Sweep IDs for locations
const locations = [
  { name: 'Desk', sid: 'QAn4IfoTZPI'},
  { name: 'Door', sid: 'CPrDRW9wDuB'},
  { name: 'Map', sid: 'pqieon5NcCW'},
];


// Function to set up location dropdown
const setupTagDropdown = () => {
  const tagSelect = document.getElementById('tagSelect');

  tagSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = "";      
  placeholder.text = "-- Select a Location --";
  placeholder.disabled = true; 
  placeholder.selected = true;  
  tagSelect.appendChild(placeholder);
  
  locations.forEach(loc => {
    const tagOpt = document.createElement('option');
    tagOpt.value = loc.sid;
    tagOpt.text = loc.name;
    tagSelect.appendChild(tagOpt);
  });
};


// Set up the SDK promise to connect when the iframe is ready
const sdkReady = new Promise(async (resolve, reject) => {
  const showcase = document.getElementById('showcase');
  showcase.src = `/bundle/showcase.html?m=${modelSid}&applicationKey=${sdkKey}&play=1&qs=1`;
  const showcaseWindow = showcase.contentWindow;

  showcase.addEventListener('load', async () => {
    try {
      const mpSdk = await showcaseWindow.MP_SDK.connect(showcaseWindow);
      console.log('SDK connected');
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
  setupTagDropdown();
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
      // console.log('Currently at sweep', currentSweep.sid);
      // console.log('Current position', currentSweep.position);
      // console.log('On floor', currentSweep.floorInfo.sequence);
      current = currentSweep.sid;
    }
  });

  await mpSdk.Sweep.current.waitUntil((currentSweep) => currentSweep.id !== '');

  // Handle tag selection and navigation
  document.getElementById('tagSelect').addEventListener('change', async (event) => {
    const tagSelect = document.getElementById('tagSelect');
    tagSelect.disabled = true; // Disable dropdown to prevent multiple selections
    
    const selectedTagId = event.target.value;
    console.log('Selected tag ID:', selectedTagId);

    mpSdk.Tag.data.subscribe({
      onAdded(index, item, collection) {
        // console.log('Tag added', index, item, collection);
        if (index !== selectedTagId) {
          mpSdk.Tag.editOpacity(index, 0.3);
        } else {
          mpSdk.Tag.editOpacity(index, 1);
        }
      }
    });

    await mpSdk.Tag.data.waitUntil((collection) => {
      return Object.values(collection).some(tag => tag.id === selectedTagId);
    });
    await mpSdk.Mattertag.navigateToTag(selectedTagId, mpSdk.Mattertag.Transition.FLY);
    console.log('Current Sweep', current);
    tagSelect.disabled = false; // Re-enable dropdown after navigation
    });

  // const curr_tag = "pqieon5NcCW";

  // // Get all tag information
  // mpSdk.Tag.data.subscribe({
  //   onAdded(index, item, collection) {
  //     console.log('Tag added', index, item, collection);
  //     if (index !== curr_tag) {
  //       mpSdk.Tag.editOpacity(index, 0.3);
  //     }
  //   }
  // });

  // await mpSdk.Tag.data.waitUntil((collection) => {
  //   return Object.values(collection).some(tag => tag.id === curr_tag);
  // });
  // await mpSdk.Mattertag.navigateToTag(curr_tag, mpSdk.Mattertag.Transition.FLY);

  // // Change tag color and opacity to highlight it as a point of interest
  // const highlightColour = { r: 1, g: 0.84, b: 0 }; // Gold
  // const originalColour = { r: 1, g: 1, b: 1 }; // White

  // await mpSdk.Tag.editColor('pqieon5NcCW', highlightColour);
  // await mpSdk.Tag.editOpacity('pqieon5NcCW', 1);
};

main().catch(err => console.error('Error:', err));