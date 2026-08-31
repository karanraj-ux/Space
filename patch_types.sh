#!/bin/bash
awk '
/type\?: '"'"'source'"'"' | '"'"'lens'"'"' | '"'"'default'"'"';/ {
  print $0
  print "  settings?: {"
  print "    customModel?: string;"
  print "    persona?: string;"
  print "    isolateContext?: boolean;"
  print "  };"
  next
}
{ print }
' src/types.ts > tmp_types.ts && mv tmp_types.ts src/types.ts
