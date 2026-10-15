const fs = require('fs');
const html = fs.readFileSync('fb_page_rendered.html', 'utf8');

console.log('--- Analyzing fb_page_rendered.html ---');

// Search for all photo IDs: fbid=
const allFbids = html.match(/fbid=(\d+)/g) || [];
console.log('Total fbid= occurrences:', allFbids.length);
const uniqueFbids = new Set(allFbids.map(f => f.replace('fbid=', '')));
console.log('Unique fbids:', uniqueFbids.size, Array.from(uniqueFbids));

// Search for all t39.30808-6 photos
const t39Photos = html.match(/https?:\/\/[^"'\s<>]*(?:t39\.30808-6)[^"'\s<>]*/g) || [];
console.log('t39 photos occurrences:', t39Photos.length);
const uniqueT39 = new Set(t39Photos.map(u => u.split('?')[0]));
console.log('Unique t39 photos:', uniqueT39.size);
Array.from(uniqueT39).forEach((u, i) => console.log(`t39 [${i}]:`, u));

// Search for JSON payloads that contain photo arrays or collage
const pcbMatches = html.match(/1625510771762126/g) || [];
console.log('Permalink ID 1625510771762126 occurrences:', pcbMatches.length);
