const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const uploadData = await uploadRes\.json\(\);/,
  `if (!uploadRes.ok) throw new Error("Upload failed. Server responded with status: " + uploadRes.status);\n      const uploadData = await uploadRes.json();`
);

content = content.replace(
  /const data = await res\.json\(\);\s+if \(data\.error\) throw new Error\(data\.error\);\s+let insertIndex = 0;/,
  `if (!res.ok) throw new Error("Generation failed. Server responded with status: " + res.status);\n      const data = await res.json();\n      if (data.error) throw new Error(data.error);\n\n      let insertIndex = 0;`
);

content = content.replace(
  /const layoutData = await res\.json\(\);/,
  `if (!res.ok) throw new Error("Clustering failed.");\n      const layoutData = await res.json();`
);

content = content.replace(
  /const compData = await compRes\.json\(\);/,
  `if (!compRes.ok) return;\n            const compData = await compRes.json();`
);

content = content.replace(
  /\}\)\.then\(r => r\.json\(\)\)\.then\(imgData => \{/,
  `}).then(r => { if(!r.ok) throw new Error("Image error"); return r.json(); }).then(imgData => {`
);

content = content.replace(
  /const data = await res\.json\(\);\s+if \(data\.error\) throw new Error\(data\.error\);\s+setNodes\(prev => prev\.map\(n => n\.id === newNodeId/g,
  `if (!res.ok) throw new Error("Image generation failed");\n      const data = await res.json();\n      if (data.error) throw new Error(data.error);\n\n      setNodes(prev => prev.map(n => n.id === newNodeId`
);

fs.writeFileSync('src/App.tsx', content);
