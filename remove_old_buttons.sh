#!/bin/bash
awk '
/\{\/\* Support returning back to zero state search button \*\/\}/ {
  skip = 1
}
/\{\/\* Global Top Right Controls \*\/\}/ {
  skip = 0
}
{ if (!skip) print }
' src/App.tsx > tmp_app.tsx && mv tmp_app.tsx src/App.tsx
