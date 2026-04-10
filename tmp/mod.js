const fs = require('fs');

function refactorFile(path, importStatement, isHomeScreen) {
  let content = fs.readFileSync(path, 'utf8');

  // Add the import statement near the components imports
  if (!content.includes('import AnimeCard from')) {
    content = content.replace(
      /import AppFooter from "..\/components\/AppFooter";/g,
      `import AppFooter from "../components/AppFooter";\n${importStatement}`
    );
  }

  // Remove the old AnimeCard definition.
  if (isHomeScreen) {
    content = content.replace(
      /\/\/ ─── WEB HOVER STYLE INJECTION.*?(\/\/ ─── ONGOING CARD)/s,
      '$1'
    );
  } else if (path.includes('GenreScreen')) {
    content = content.replace(
      /\/\/ ─── WEB HOVER STYLE INJECTION.*?(\/\/ ─── GENRE SCREEN)/s,
      '$1'
    );
  } else if (path.includes('AlphabetScreen')) {
    content = content.replace(
      /\/\/ ─── WEB HOVER STYLE INJECTION.*?(\/\/ ─── ALPHABET SCREEN)/s,
      '$1'
    );
  }
  
  fs.writeFileSync(path, content, 'utf8');
}

// 1. Refactor HomeScreen
refactorFile('d:/Desktop/Animexis/animexisv1/src/screens/HomeScreen.js', 'import AnimeCard from "../components/AnimeCard";\n', true);

// 2. Refactor GenreScreen
refactorFile('d:/Desktop/Animexis/animexisv1/src/screens/GenreScreen.js', 'import AnimeCard from "../components/AnimeCard";\n', false);

// 3. Refactor AlphabetScreen
refactorFile('d:/Desktop/Animexis/animexisv1/src/screens/AlphabetScreen.js', 'import AnimeCard from "../components/AnimeCard";\n', false);

console.log("Refactoring complete");
