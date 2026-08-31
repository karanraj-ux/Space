#!/bin/bash
awk '
/const \[searchQuery, setSearchQuery\]/ {
  print $0
  print "  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);"
  print "  const [customNodeConfig, setCustomNodeConfig] = useState({"
  print "    prompt: \"\","
  print "    customModel: \"\","
  print "    persona: \"\","
  print "    isolateContext: false"
  print "  });"
  next
}
{ print }
' src/App.tsx > tmp_app2.tsx && mv tmp_app2.tsx src/App.tsx
