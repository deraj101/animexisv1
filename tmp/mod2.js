const fs = require('fs');

let path = 'd:/Desktop/Animexis/animexisv1/src/screens/AlphabetScreen.js';
let content = fs.readFileSync(path, 'utf8');

// The AnimeCard in AlphabetScreen starts at // ─── ANIME CARD and ends at // ─── ALPHABET SCREEN
content = content.replace(
  /\/\/ ─── ANIME CARD.*?(\/\/ ─── ALPHABET SCREEN)/s,
  '$1'
);

fs.writeFileSync(path, content, 'utf8');

console.log("AlphabetScreen fixed");
