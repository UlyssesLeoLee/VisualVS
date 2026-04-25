const fs = require('fs');
const content = fs.readFileSync('src/webview/lib/orb.js', 'utf8');
// Find what classes/functions are exported as the Orb global 
const start = content.indexOf('root["Orb"]');
console.log('UMD export pattern found at:', start);
// Check if Orb has a nested Orb class
const orbClassMatch = content.match(/class Orb\b/g);
console.log('class Orb occurrences:', orbClassMatch ? orbClassMatch.length : 0);
// check if there's exports.Orb = 
const exportOrb = content.match(/exports\.Orb\s*=/g);
console.log('exports.Orb assignments:', exportOrb ? exportOrb.slice(0, 5) : 'none');
// Sample around "class Orb" 
const classOrbIdx = content.indexOf('class Orb');
if (classOrbIdx > 0) {
    console.log('\nContext around "class Orb":');
    console.log(content.substring(classOrbIdx - 20, classOrbIdx + 200));
}
