#!/bin/bash
awk '
/const \[showBillingModal\]/ {
  print $0
  print "  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);"
  print "  const [customNodeConfig, setCustomNodeConfig] = useState({"
  print "    prompt: '"'"''"'"',"
  print "    customModel: '"'"''"'"',"
  print "    persona: '"'"''"'"',"
  print "    isolateContext: false"
  print "  });"
  next
}
{ print }
' src/App.tsx > tmp_app.tsx && mv tmp_app.tsx src/App.tsx
