#!/bin/bash
awk '
/<span className="font-bold">NODE \{versionText\}<\/span>/ {
  print $0
  print "          {node.settings && ("
  print "            <span className=\"text-[10px] bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded ml-1 border border-yellow-400 font-bold tracking-tighter\" title=\"Custom Settings Active\">CST</span>"
  print "          )}"
  next
}
{ print }
' src/components/NodeCard.tsx > tmp_card.tsx && mv tmp_card.tsx src/components/NodeCard.tsx
