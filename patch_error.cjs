const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the fetch in generateNode (around line 970)
content = content.replace(
  /\}\)\.then\(r => \{ if\(!r\.ok\) throw new Error\("Image error"\); return r\.json\(\); \}\)/,
  `}).then(async r => { if (!r.ok) { const err = await r.json(); throw new Error(err.error || "Image error"); } return r.json(); })`
);

// Fix the fetch in handleAutoCluster or whatever Lens tool (around line 1211)
content = content.replace(
  /if \(!res\.ok\) throw new Error\("Image generation failed"\);\n\s+const data = await res\.json\(\);/,
  `if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Image generation failed"); }\n      const data = await res.json();`
);

fs.writeFileSync('src/App.tsx', content);
