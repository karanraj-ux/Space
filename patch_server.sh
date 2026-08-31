#!/bin/bash
awk '
/const \{ prompt, context \} = req.body;/ {
  print "      const { prompt, context, customModel, customPersona } = req.body;"
  next
}
/const \[provider, modelId\] = providerModel.split/ {
  print $0
  print "      let activeModelId = customModel || modelId;"
  next
}
/const systemInstruction = / {
  print "      let systemInstruction = \"You are a dynamic spatial-knowledge-engine generator. You receive past conversation or factual knowledge in the \\\"Source Context\\\". CRITICAL INSTRUCTION ON TONE: Do NOT inherit or mimic the tone, writing style, or persona of the Source Context. You must answer the new Task organically, adapting your tone entirely to match the user\\\"s new Task (e.g., if the context is a medical paper, but the new Task is a simple \\\"yes/no\\\" question, answer casually and briefly). If the Task is \\\"Synthesize concepts from X nodes\\\", deeply analyze the connections and contradictions across all provided Source Context nodes. Generate AI content in a specific JSON format containing: \\\"text\\\" (AI-generated text. Use markdown if necessary. CRITICAL: Wrap 2 to 4 key concepts or interesting terms in your text as markdown links using the exact format `[Search Term](Search Term)`, so users can click them to branch off!), and \\\"prompts\\\" (an array of 3 string items containing suggested follow-up queries or Lenses). RETURN ONLY VALID JSON.\";"
  print "      if (customPersona) {"
  print "        systemInstruction += \"\\n\\nUSER CUSTOM PERSONA/RULES:\\n\" + customPersona;"
  print "      }"
  next
}
/let actualModelUsed = modelId/ {
  print "        let actualModelUsed = activeModelId || \"gemini-3.1-flash-lite\";"
  next
}
{ print }
' server.ts > tmp_server.ts && mv tmp_server.ts server.ts
