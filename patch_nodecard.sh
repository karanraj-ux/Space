#!/bin/bash
awk '
/\{\/\* Standard Hardcoded Lenses \*\/\}/ {
  print "            {/* Collapsible Action Menu */}"
  print "            <div className=\"relative group mt-2 z-10\">"
  print "              <button"
  print "                className=\"w-full flex items-center justify-between bg-white border border-black p-2 text-left shadow-[2px_2px_0px_rgba(0,0,0,0.2)] hover:shadow-[2px_2px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer\""
  print "              >"
  print "                <span className=\"flex items-center\"><Menu size={12} className=\"mr-2\"/> Actions</span>"
  print "                <ChevronRight size={12} className=\"group-hover:rotate-90 transition-transform\"/>"
  print "              </button>"
  print "              "
  print "              <div className=\"absolute top-full left-0 w-full bg-white border border-black mt-1 shadow-[4px_4px_0px_rgba(0,0,0,0.2)] hidden group-hover:flex flex-col\">"
  print "                {["
  print "                  { id: \"extract\", icon: <Search size={14} className=\"mr-2\" />, label: \"Extract Data\", prompt: \"Extract key data points, statistics, and entities.\" },"
  print "                  { id: \"critique\", icon: <Scale size={14} className=\"mr-2\" />, label: \"Critique\", prompt: \"Act as a critical reviewer. Find flaws and weaknesses.\" },"
  print "                  { id: \"brainstorm\", icon: <Lightbulb size={14} className=\"mr-2\" />, label: \"Brainstorm\", prompt: \"Brainstorm out-of-the-box expansions or adjacent ideas.\" },"
  print "                  { id: \"summarize\", icon: <FileText size={14} className=\"mr-2\" />, label: \"Summarize\", prompt: \"Provide a concise, high-level summary.\" }"
  print "                ].map((lens) => ("
  print "                  <button"
  print "                    key={lens.id}"
  print "                    onClick={(e) => {"
  print "                      e.stopPropagation();"
  print "                      onExpand(lens.prompt, node.id);"
  print "                    }}"
  print "                    className=\"w-full flex items-center bg-white hover:bg-gray-100 p-2 text-left transition-colors text-[10px] font-bold uppercase tracking-wider cursor-pointer border-b border-gray-200 last:border-b-0\""
  print "                  >"
  print "                    {lens.icon}"
  print "                    {lens.label}"
  print "                  </button>"
  print "                ))}"
  print "                {/* Custom Ask Lens */}"
  print "                <form "
  print "                  onSubmit={(e) => {"
  print "                    e.preventDefault();"
  print "                    e.stopPropagation();"
  print "                    const target = e.target as HTMLFormElement;"
  print "                    const input = target.elements.namedItem(\"customPrompt\") as HTMLInputElement;"
  print "                    if (input.value.trim()) {"
  print "                      onExpand(input.value.trim(), node.id);"
  print "                      input.value = \"\";"
  print "                    }"
  print "                  }}"
  print "                  className=\"w-full flex items-center bg-gray-50 border-t border-black text-left\""
  print "                >"
  print "                  <div className=\"pl-2\">"
  print "                    <Sparkles size={12} />"
  print "                  </div>"
  print "                  <input "
  print "                    name=\"customPrompt\""
  print "                    onClick={(e) => e.stopPropagation()}"
  print "                    placeholder=\"Ask Custom...\" "
  print "                    className=\"w-full p-2 text-[10px] font-bold uppercase tracking-wider outline-none bg-transparent\""
  print "                  />"
  print "                </form>"
  print "              </div>"
  print "            </div>"
  
  skip = 1
}
/\{\/\* Custom Ask Lens \*\/\}/ {
  skip2 = 1
}
/<\/motion.div>/ && skip {
  if (skip2) { skip = 0; skip2 = 0; }
}
{ if (!skip) print }
' src/components/NodeCard.tsx > tmp_card.tsx && mv tmp_card.tsx src/components/NodeCard.tsx
