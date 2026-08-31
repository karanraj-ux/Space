#!/bin/bash
awk '
/const generateNode = async/ {
  print "  const generateNode = async (prompt: string, x: number, y: number, incomingEdges?: EdgeConnection[], isRegenerationOf?: string, shouldRipple?: boolean, nodeSettings?: { customModel?: string, persona?: string, isolateContext?: boolean }) => {"
  next
}
/incomingEdges$/ {
  print "        incomingEdges,"
  print "        settings: nodeSettings"
  next
}
/let contextData = undefined;/ {
  print $0
  print "      const currentSettings = nodeSettings || (isRegenerationOf ? nodes.find(n => n.id === isRegenerationOf)?.settings : undefined);"
  next
}
/if \(combinedText\) \{/ {
  print "        if (currentSettings?.isolateContext) {"
  print "          combinedText = \"\"; // Isolate context: strip all incoming text"
  print "        }"
  print $0
  next
}
/body: JSON\.stringify\(\{ prompt, context: contextData \}\),/ {
  print "        body: JSON.stringify({ prompt, context: contextData, customModel: currentSettings?.customModel, customPersona: currentSettings?.persona }),"
  next
}
{ print }
' src/App.tsx > tmp_app.tsx && mv tmp_app.tsx src/App.tsx
