const fs = require('fs');
const path = require('path');

const srcDir = path.join('/home/rocha/kryonix/kryonix-dev/repos/kryonix-installer/ui/src');
const pagesDir = path.join(srcDir, 'pages');

const filesToFix = [
  'Disks.jsx', 'HostSelection.jsx', 'Localization.jsx', 'MachineProfile.jsx',
  'Network.jsx', 'RemoteAccess.jsx', 'Source.jsx', 'Summary.jsx',
  'SystemFeatures.jsx', 'Timezone.jsx', 'UserFeatures.jsx', 'Users.jsx'
];

for (const file of filesToFix) {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match the title blocks:
  // Usually looks like:
  // <div>
  //   <h2 className="text-2xl font-bold text-white">Perfil da Máquina</h2>
  //   <p className="text-gray-400 mt-2">Escolha...</p>
  // </div>
  // Or:
  // <div>
  //   <h2 className="page-title">...</h2>
  //   <p className="page-subtitle">...</p>
  // </div>
  
  // Actually, some might be <h2 ...> without a wrapper div if it's the first element.
  // It's safer to use regex to remove <div className="mb-X"> <h2>...</h2> <p>...</p> </div>
  // Let's just remove <h2> and <p> that look like titles.
  // We can just log what matches we find to avoid breaking things, or write a careful regex.
  
  // A pattern that matches a div block containing exactly an h2 (or h1/h3) and a p, usually at the beginning of wizard-content.
  content = content.replace(/<div[^>]*>\s*<h[123][^>]*>.*?<\/h[123]>\s*<p[^>]*>.*?<\/p>\s*<\/div>/is, '');
  
  // Fix MachineProfile scroll specifically:
  if (file === 'MachineProfile.jsx') {
    // Make sure wizard-content is h-full overflow-y-auto
    content = content.replace(/className="wizard-content\s+space-y-6"/, 'className="wizard-content space-y-6 h-full overflow-y-auto min-h-0 pb-4 pr-2"');
  }

  // Write back
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log("Titles removed and Profile scroll fixed.");
