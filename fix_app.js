const fs = require('fs');
const path = require('path');

const file = path.join('/home/rocha/kryonix/kryonix-dev/repos/kryonix-installer/ui/src/App.jsx');
let content = fs.readFileSync(file, 'utf8');

// Change:
// <div className="wizard-page" ref={pageRef} style={{ display: 'contents' }}>
// To:
// <div className="wizard-page animate-fade-in" key={step.id} ref={pageRef}>

content = content.replace(
  /<div className="wizard-page" ref=\{pageRef\} style=\{\{ display: 'contents' \}\}>/g,
  '<div className="wizard-page animate-fade-in w-full h-full flex flex-col min-h-0" key={step.id} ref={pageRef}>'
);

fs.writeFileSync(file, content, 'utf8');
console.log("App.jsx fixed");
