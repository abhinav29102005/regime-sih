const fs = require('fs');

let content = fs.readFileSync('components/RainfallMap.tsx', 'utf8');

// Remove the TileLayer to hide OpenStreetMap boundaries and other countries
content = content.replace(
  /<TileLayer\s+url="https:\/\/{s}\.tile\.openstreetmap\.org\/{z}\/{x}\/{y}\.png"\s+className="dark-tiles"\s+attribution='&copy; <a href="https:\/\/www\.openstreetmap\.org\/copyright">OpenStreetMap<\/a>'\s+\/>/g,
  `{/* TileLayer removed to strictly show correct Indian GeoJSON boundaries and hide other countries */}`
);

fs.writeFileSync('components/RainfallMap.tsx', content);

console.log("Map updated!");
