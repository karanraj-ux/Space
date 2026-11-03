import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import os from "os";

dotenv.config();

// Use disk storage to handle massive files without crashing memory
const upload = multer({ dest: os.tmpdir() });

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: "50mb" }));

  const getAiInstance = (req: express.Request) => {
    const userApiKey = req.headers['x-api-key'] as string;
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API key required. Please set one in Settings.");
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });
  };

  // Helper to generate vector embeddings using Gemini
  const generateEmbeddings = async (ai: GoogleGenAI, texts: string[]): Promise<number[][]> => {
    if (!texts || texts.length === 0) return [];
    const contents = texts.map(t => ({ parts: [{ text: (t || " ").slice(0, 8000) }] }));
    const batchSize = 20;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);
      let resp;
      try {
        resp = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: batch,
        });
      } catch (err1) {
        console.warn("gemini-embedding-2-preview failed, falling back to text-embedding-004:", err1);
        try {
          resp = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: batch,
          });
        } catch (err2) {
          console.error("Embedding model fallback also failed:", err2);
        }
      }

      if (resp && resp.embeddings) {
        for (const emb of resp.embeddings) {
          allEmbeddings.push(emb.values || []);
        }
      }
    }
    return allEmbeddings;
  };

  // Vector Embedding endpoint for client-side search queries
  app.post("/api/embed", async (req, res) => {
    try {
      const { texts } = req.body;
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({ error: "texts array is required" });
      }
      const ai = getAiInstance(req);
      const embeddings = await generateEmbeddings(ai, texts);
      res.json({ embeddings });
    } catch (error: any) {
      console.error("Error in /api/embed:", error);
      res.status(500).json({ error: error.message || "Failed to generate embeddings." });
    }
  });

  // Chunk and vectorize plain text / pasted knowledge blocks
  app.post("/api/chunk-text", async (req, res) => {
    try {
      const { text, sourceName } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "text is required" });
      }
      const ai = getAiInstance(req);
      
      const paragraphs = text.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
      const chunkTexts: { heading: string, text: string }[] = [];
      
      if (paragraphs.length <= 1 && text.length < 800) {
        chunkTexts.push({ heading: sourceName || "Text Note", text: text.trim() });
      } else {
        let currentHeading = sourceName || "Knowledge Section";
        let curChunk = "";
        for (const p of paragraphs) {
          if (p.startsWith("#")) {
            if (curChunk.trim()) {
              chunkTexts.push({ heading: currentHeading, text: curChunk.trim() });
              curChunk = "";
            }
            currentHeading = p.replace(/^#+\s*/, '').trim() || currentHeading;
          }
          curChunk += (curChunk ? "\n\n" : "") + p;
          if (curChunk.length > 1000) {
            chunkTexts.push({ heading: currentHeading, text: curChunk.trim() });
            curChunk = "";
          }
        }
        if (curChunk.trim()) {
          chunkTexts.push({ heading: currentHeading, text: curChunk.trim() });
        }
      }

      const textsToEmbed = chunkTexts.map(c => `${c.heading}: ${c.text}`);
      const embeddings = await generateEmbeddings(ai, textsToEmbed);
      
      const chunks = chunkTexts.map((c, idx) => ({
        id: `chunk-${Date.now()}-${idx}`,
        sourceName: sourceName || "Text Note",
        heading: c.heading,
        text: c.text,
        embedding: embeddings[idx] || []
      }));

      res.json({ chunks });
    } catch (error: any) {
      console.error("Error in /api/chunk-text:", error);
      res.status(500).json({ error: error.message || "Failed to chunk text." });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const ai = getAiInstance(req);
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname || "document";
      
      // 1. Upload directly to Gemini File Storage for multimodal grounding
      const uploadResult = await ai.files.upload({
        file: req.file.path,
        config: {
          mimeType: mimeType,
        }
      });

      // Cleanup temp file on disk
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.warn("Temp file cleanup warning:", cleanupErr);
      }

      // 2. Extract semantic chunks if it's a document (PDF, doc, text, json, csv, etc.)
      let semanticChunks: Array<{ heading: string, text: string }> = [];
      let docSummary = "";
      
      const isDocument = mimeType.includes("pdf") || 
                         mimeType.includes("text") || 
                         mimeType.includes("document") || 
                         mimeType.includes("csv") ||
                         mimeType.includes("json") ||
                         originalName.toLowerCase().endsWith(".pdf") ||
                         originalName.toLowerCase().endsWith(".txt") ||
                         originalName.toLowerCase().endsWith(".md");

      if (isDocument) {
        try {
          const extractionResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    fileData: {
                      fileUri: uploadResult.uri,
                      mimeType: uploadResult.mimeType || mimeType
                    }
                  },
                  {
                    text: `You are an expert Document Ingestion & Knowledge Indexing Engine.
Analyze this document thoroughly and extract its complete factual content into distinct, coherent semantic chunks for vector storage.
Rules:
1. Divide the document into 4 to 15 semantic chunks based on sections, topics, tables, or criteria.
2. Preserve exact names, numbers, institutions, rankings, percentages, candidate details, and data points in the chunk text.
3. Provide a clear 'heading' for each chunk representing its topic or section.
4. Also provide a concise 2-sentence 'summary' of the entire document.

Return STRICTLY valid JSON with no markdown formatting:
{
  "summary": "Concise 2-sentence summary",
  "chunks": [
    {
      "heading": "Section Heading",
      "text": "Detailed content of this section..."
    }
  ]
}`
                  }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              temperature: 0.1
            }
          });

          let rawExtract = extractionResponse.text || "{}";
          rawExtract = rawExtract.replace(/```(json)?/gi, '').trim();
          const parsed = JSON.parse(rawExtract);
          docSummary = parsed.summary || "";
          if (Array.isArray(parsed.chunks) && parsed.chunks.length > 0) {
            semanticChunks = parsed.chunks;
          }
        } catch (extractErr) {
          console.warn("Document semantic chunk extraction had non-fatal error:", extractErr);
        }
      }

      // 3. Generate vector embeddings for extracted chunks
      let finalChunks: any[] = [];
      if (semanticChunks.length > 0) {
        try {
          const textsToEmbed = semanticChunks.map(c => `${c.heading}: ${c.text}`);
          const embeddings = await generateEmbeddings(ai, textsToEmbed);
          finalChunks = semanticChunks.map((c, idx) => ({
            id: `chunk-${Date.now()}-${idx}`,
            sourceName: originalName,
            heading: c.heading || `Section ${idx + 1}`,
            text: c.text,
            embedding: embeddings[idx] || []
          }));
        } catch (embedErr) {
          console.warn("Chunk vector embedding had non-fatal error:", embedErr);
          finalChunks = semanticChunks.map((c, idx) => ({
            id: `chunk-${Date.now()}-${idx}`,
            sourceName: originalName,
            heading: c.heading || `Section ${idx + 1}`,
            text: c.text,
            embedding: []
          }));
        }
      }

      res.json({
        name: uploadResult.name,
        uri: uploadResult.uri,
        mimeType: uploadResult.mimeType || mimeType,
        summary: docSummary,
        chunks: finalChunks
      });
    } catch (error: any) {
      console.error("Error in upload:", error);
      res.status(500).json({ error: "Failed to process file: " + (error?.message || String(error)) });
    }
  });

  app.post("/api/fracture-file", async (req, res) => {
    try {
      const { fileUri, mimeType } = req.body;
      const ai = getAiInstance(req);
      
      const textResponse = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // use a stronger model for structuring
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: fileUri,
                  mimeType: mimeType,
                }
              },
              {
                text: "Analyze this file deeply. Break it down into a central thesis (main) and several distinct sub-components, chapters, or key logical arguments (children). Return a structured ontology."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              main: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  text: { type: Type.STRING },
                  prompts: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ["title", "text", "prompts"],
              },
              children: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    text: { type: Type.STRING },
                    prompts: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["title", "text", "prompts"],
                }
              }
            },
            required: ["main", "children"],
          },
        },
      });

      let rawText = textResponse.text || "{}";
      rawText = rawText.replace(/```(json)?/gi, '').trim();
      const responseData = JSON.parse(rawText);
      
      res.json(responseData);
    } catch (error: any) {
      console.error("Error in fracture-file:", error);
      res.status(500).json({ error: "Failed to fracture file." });
    }
  });

  app.post("/api/ingest-uri", async (req, res) => {
    try {
      const { fileUri, mimeType } = req.body;
      const ai = getAiInstance(req);
      
      const textResponse = await ai.models.generateContent({
        model: "imagen-3.0-generate-002",
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: fileUri,
                  mimeType: mimeType,
                }
              },
              {
                text: "Analyze this file. Provide a concise 'title' for it, a short 'text' summary (2-3 sentences), and 3 'prompts' for possible analytical lenses or follow-up questions."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              text: { type: Type.STRING },
              prompts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["title", "text", "prompts"],
          },
        },
      });

      let rawText = textResponse.text || "{}";
      rawText = rawText.replace(/```(json)?/gi, '').trim();
      const responseData = JSON.parse(rawText);
      
      res.json(responseData);
    } catch (error: any) {
      console.error("Error in ingest-uri:", error);
      res.status(500).json({ error: "Failed to process file." });
    }
  });

  app.post("/api/graphrag-map", async (req, res) => {
    try {
      const { text, uri, mimeType, mapLevel } = req.body;
      const providerModel = req.headers['x-provider-text'] as string || 'gemini|gemini-3.1-pro-preview';
      const [provider, modelIdTemp] = providerModel.split('|');
      let modelId = modelIdTemp === "gemini-3.1-pro" ? "gemini-3.1-pro-preview" : modelIdTemp;

      let responseText = "";
      
      let entityCount = "5 to 7";
      if (mapLevel === 'broad') entityCount = "3 to 4";
      if (mapLevel === 'detailed') entityCount = "10 to 15";

      const systemInstruction = `You are an expert GraphRAG mapping system.
Analyze the provided document and extract the ${entityCount} most critical entities (people, concepts, locations, organizations) and their relationships.
Output EXACTLY valid JSON with the following structure:
{
  "entities": [
    { "id": "entity_1", "label": "Short Name", "type": "concept|person|organization", "description": "1 sentence description" }
  ],
  "relationships": [
    { "source": "entity_1", "target": "entity_2", "label": "description of connection" }
  ]
}
Do not include markdown blocks, just raw JSON.`;

      if (provider === 'gemini') {
        const ai = getAiInstance(req);
        const contents = [];
        if (uri) {
          contents.push({ fileData: { fileUri: uri, mimeType: mimeType || 'application/pdf' } });
        }
        if (text) {
          contents.push(text);
        }
        
        const response = await ai.models.generateContent({
          model: modelId,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        responseText = response.text || "{}";
      } else {
        // Fallback for non-Gemini - assuming text is provided
        throw new Error("GraphRAG auto-mapping currently requires Gemini File API for large documents.");
      }

      let rawText = responseText.replace(/```(json)?/gi, '').trim();
      const responseData = JSON.parse(rawText);
      res.json(responseData);
    } catch (error: any) {
      console.error("Error in graphrag-map:", error);
      res.status(500).json({ error: "Failed to perform GraphRAG mapping." });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, context, customModel, customPersona, capability, role } = req.body;
      const providerModel = req.headers['x-provider-text'] as string || 'gemini|gemini-3.1-flash-lite';
      const [provider, modelIdTemp] = providerModel.split('|');
      let modelId = modelIdTemp === "gemini-3.1-pro" ? "gemini-3.1-pro-preview" : modelIdTemp;
      let activeModelId = customModel || modelId;
      if (activeModelId === "gemini-3.1-pro") activeModelId = "gemini-3.1-pro-preview";
      if (activeModelId === "gemini-3.1-flash-lite-image" || activeModelId === "gemini-3.1-flash-image") activeModelId = "imagen-3.0-generate-002";
      
      // --- SEMANTIC COERCION (Auto-Formatting) ---
      let formatCoercion = "";
      const lowerPrompt = prompt.toLowerCase();
      let mapReduceConstraint = "Extract all key facts, data, arguments, and insights relevant to the following prompt";
      
      if (lowerPrompt.includes("json") || lowerPrompt.includes("array") || lowerPrompt.includes("object")) {
        formatCoercion = "SEMANTIC COERCION TRIGGERED: The user is requesting structured JSON or array data. You MUST output your 'text' field strictly as a cleanly formatted JSON block or Array. Strip all conversational filler.";
        mapReduceConstraint = "Extract structured JSON/Array data matching the following prompt";
      } else if (lowerPrompt.includes("metrics") || lowerPrompt.includes("extract key") || lowerPrompt.includes("statistics") || lowerPrompt.includes("data")) {
        formatCoercion = "SEMANTIC COERCION TRIGGERED: The user is requesting hard metrics or data. You MUST extract and output the data strictly as a Markdown table or bulleted list of raw statistics. Do not include introductory/outro conversational filler.";
        mapReduceConstraint = "Extract hard metrics, statistics, and numeric data relevant to the following prompt";
      } else if (lowerPrompt.includes("table") || lowerPrompt.includes("csv")) {
        formatCoercion = "SEMANTIC COERCION TRIGGERED: The user is requesting tabular data. You MUST output a strict Markdown Table containing the extracted data.";
        mapReduceConstraint = "Extract tabular data relevant to the following prompt";
      }
      // -------------------------------------------

      let systemInstruction = "You are a dynamic spatial-knowledge-engine generator. You receive past conversation or factual knowledge in the \"Source Context\". CRITICAL INSTRUCTION ON TONE: Do NOT inherit or mimic the tone, writing style, or persona of the Source Context. You must answer the new Task organically, adapting your tone entirely to match the user\"s new Task (e.g., if the context is a medical paper, but the new Task is a simple \"yes/no\" question, answer casually and briefly). If the Task is \"Synthesize concepts from X nodes\", deeply analyze the connections and contradictions across all provided Source Context nodes. If you use facts, claims, or data from the Source Context, you MUST cite your source immediately after the claim using the format `[Source](#node_id)` where `node_id` is the ID of the node provided in the context (e.g. 'The market grew by 20% [2023 Report](#node-1234)'). Generate AI content in a specific JSON format containing: \"text\" (AI-generated text. Use markdown if necessary. CRITICAL: Wrap 2 to 4 key concepts or interesting terms in your text as markdown links using the exact format `[Search Term](Search Term)`, so users can click them to branch off!), and \"prompts\" (an array of 3 string items containing suggested follow-up queries or Lenses). RETURN ONLY VALID JSON.";
      
      if (role === 'stress_test') {
        systemInstruction += "\n\n[EPISTEMIC ROLE: ADVERSARIAL STRESS-TEST & DEVIL'S ADVOCATE]\nYou are a rigorous Devil's Advocate and Stress-Tester. Point out hidden assumptions, fatal edge cases, economic/technical liabilities, and logical contradictions in the thesis. Be direct, incisive, and cite any contradictory source facts.";
      } else if (role === 'decision') {
        systemInstruction += "\n\n[EPISTEMIC ROLE: AUDIT-PROOF DECISION VERDICT]\nYou are an Executive Decision Engine. Synthesize the competing hypotheses, grounding evidence, and stress-tests from the Source Context. Provide a clear Verdict, an explicit Confidence Rating (e.g. 85%), addressed trade-offs, and decisive recommendations.";
      } else if (role === 'evidence') {
        systemInstruction += "\n\n[EPISTEMIC ROLE: GROUND TRUTH EVIDENCE]\nYou are an Evidence Extraction Specialist. Extract verifiable facts, statistics, benchmark data, and direct quotes from the context without speculative fluff.";
      }

      if (formatCoercion) {
        systemInstruction += "\n\n" + formatCoercion;
        console.log(`[SEMANTIC COERCION] Intercepted prompt and applied format constraint.`);
      }

      if (customPersona) {
        systemInstruction += "\n\nUSER CUSTOM PERSONA/RULES:\n" + customPersona;
      }
      
      let contextText = context?.text ? `Source Context:\n${context.text}\n\n` : '';
      const fullPrompt = `${contextText}Task: ${prompt}`;

      let responseData;

      if (provider === 'gemini') {
        const ai = getAiInstance(req);
        const parts: any[] = [];
        if (context?.fileData) {
          const files = Array.isArray(context.fileData) ? context.fileData : [context.fileData];
          
          if (files.length > 1) {
            console.log(`[MAP-REDUCE ENGINE] Triggered for ${files.length} documents.`);
            const mapPromises = files.map(async (file: any, index: number) => {
              const fileParts: any[] = [];
              let usedVector = false;
              
              if (file.chunks && file.chunks.length > 0) {
                try {
                  const promptRes = await ai.models.embedContent({ model: 'gemini-embedding-2', contents: prompt });
                  if (promptRes.embeddings && promptRes.embeddings.length > 0) {
                    const promptEmbedding = promptRes.embeddings[0].values;
                    const scoredChunks = file.chunks.map((chunk: any) => {
                      let dot = 0, normA = 0, normB = 0;
                      for (let i = 0; i < promptEmbedding.length; i++) {
                        dot += promptEmbedding[i] * chunk.embedding[i];
                        normA += promptEmbedding[i] * promptEmbedding[i];
                        normB += chunk.embedding[i] * chunk.embedding[i];
                      }
                      return { text: chunk.text, similarity: dot / (Math.sqrt(normA) * Math.sqrt(normB)) };
                    });
                    scoredChunks.sort((a, b) => b.similarity - a.similarity);
                    const topChunks = scoredChunks.slice(0, 5);
                    let combinedChunks = `[Extracted Relevant Context from ${file.name || 'Document'}]:\n\n`;
                    topChunks.forEach((c, idx) => combinedChunks += `--- Excerpt ${idx + 1} ---\n${c.text}\n\n`);
                    fileParts.push({ text: combinedChunks });
                    usedVector = true;
                  }
                } catch (e) {
                  console.error("Vector search in map phase failed:", e);
                }
              }
              
              if (!usedVector) {
                if (file.fileUri || file.uri) {
                  fileParts.push({ fileData: { fileUri: file.fileUri || file.uri, mimeType: file.mimeType } });
                } else if (file.data) {
                  fileParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
                }
              }
              
              fileParts.push({ text: `Task: ${mapReduceConstraint}: "${prompt}". Be highly detailed. If no relevant info exists, reply strictly with "NO_RELEVANT_DATA".` });
              
              try {
                const res = await ai.models.generateContent({
                  model: "imagen-3.0-generate-002",
                  contents: [{ role: "user", parts: fileParts }]
                });
                return `[Map-Reduce Extraction | Document: ${file.name || 'Unknown'}]\n${res.text || 'NO_RELEVANT_DATA'}\n`;
              } catch (e) {
                console.error("Map phase failed for file:", e);
                return `[Map-Reduce Extraction | Document: ${file.name || 'Unknown'}]\nFailed to process document.\n`;
              }
            });
            
            const mapResults = await Promise.all(mapPromises);
            const validResults = mapResults.filter(res => !res.includes('NO_RELEVANT_DATA'));
            const reducedContext = validResults.length > 0 ? validResults.join('\n---\n') : "No relevant data found in any attached documents.";
            
            parts.push({ text: `[MAP-REDUCE SYNTHESIS DATA]\nThe following are detailed extracted insights from ${files.length} parallel document analyses:\n\n${reducedContext}\n\n[END MAP-REDUCE DATA]` });
            
          } else {
            // Single file processing (uses vector search if chunks exist, otherwise full)
            for (const file of files) {
              if (file.chunks && file.chunks.length > 0) {
                try {
                  const promptRes = await ai.models.embedContent({ model: 'gemini-embedding-2', contents: prompt });
                  if (promptRes.embeddings && promptRes.embeddings.length > 0) {
                    const promptEmbedding = promptRes.embeddings[0].values;
                    
                    const scoredChunks = file.chunks.map((chunk: any) => {
                      let dot = 0, normA = 0, normB = 0;
                      for (let i = 0; i < promptEmbedding.length; i++) {
                        dot += promptEmbedding[i] * chunk.embedding[i];
                        normA += promptEmbedding[i] * promptEmbedding[i];
                        normB += chunk.embedding[i] * chunk.embedding[i];
                      }
                      return { text: chunk.text, similarity: dot / (Math.sqrt(normA) * Math.sqrt(normB)) };
                    });
                    
                    scoredChunks.sort((a, b) => b.similarity - a.similarity);
                    const topChunks = scoredChunks.slice(0, 5);
                    
                    let combinedChunks = `[Extracted Relevant Context from ${file.name || 'Document'}]:\n\n`;
                    topChunks.forEach((c, idx) => {
                      combinedChunks += `--- Excerpt ${idx + 1} ---\n${c.text}\n\n`;
                    });
                    parts.push({ text: combinedChunks });
                    
                    console.log(`Vector Search: Selected top ${topChunks.length} chunks from ${file.name}`);
                    continue; 
                  }
                } catch (e) {
                  console.error("Vector search failed, falling back to full file ingest:", e);
                }
              }
              
              if (file.fileUri || file.uri) {
                const uri = file.fileUri || file.uri;
                parts.push({ fileData: { fileUri: uri, mimeType: file.mimeType } });
              }
              else if (file.data) {
                parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
              }
            }
          }
        }
        if (contextText) parts.push({ text: contextText });
        parts.push({ text: `Task: ${prompt}` });

        const callGemini = async (targetModel: string) => {
          let reqConfig: any = {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: { text: { type: Type.STRING }, prompts: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ["text", "prompts"],
            },
          };
          
          if (capability === 'search') {
            reqConfig.tools = [{ googleSearch: {} }];
          }

          return await ai.models.generateContent({
            model: targetModel,
            contents: [{ role: "user", parts }],
            config: reqConfig,
          });
        };

        let textResponse;
        let actualModelUsed = activeModelId || "imagen-3.0-generate-002";
        try {
          textResponse = await callGemini(actualModelUsed);
        } catch (error: any) {
          console.error("Gemini model call failed:", error.message || error);
          
          const isBYOK = !!req.headers['x-api-key'];
          
          if (!isBYOK && (error.status === 'NOT_FOUND' || error.status === 403 || error.status === 404 || (error.message && error.message.includes('not found')))) {
            actualModelUsed = "gemini-3.1-flash";
            console.log(`System Key: Falling back to ${actualModelUsed}...`);
            try {
              textResponse = await callGemini(actualModelUsed);
            } catch (fallbackError: any) {
               throw new Error(`System fallback to ${actualModelUsed} failed.`);
            }
          } else if (isBYOK) {
             throw new Error(`Your API key was rejected for model ${actualModelUsed}. Please select a different model in Settings. (${error.message})`);
          } else {
            throw error;
          }
        }

        let rawText = textResponse.text || "{}";
        rawText = rawText.replace(/```(json)?/gi, '').trim();
        responseData = JSON.parse(rawText);
        responseData._modelUsed = actualModelUsed; // explicitly pass back the model used

      } else if (provider === 'openai' || provider === 'groq') {
        const apiKey = req.headers[`x-${provider}-key`] as string;
        if (!apiKey) throw new Error(`${provider.toUpperCase()} API key required.`);
        const baseURL = provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined;
        const openai = new OpenAI({ apiKey, baseURL });
        
        const response = await openai.chat.completions.create({
          model: modelId,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: fullPrompt }
          ]
        });
        const rawText = response.choices[0].message.content || "{}";
        responseData = JSON.parse(rawText);

      } else if (provider === 'anthropic') {
        const apiKey = req.headers['x-anthropic-key'] as string;
        if (!apiKey) throw new Error(`Anthropic API key required.`);
        const anthropic = new Anthropic({ apiKey });
        
        const response = await anthropic.messages.create({
          model: modelId,
          max_tokens: 4000,
          system: systemInstruction + " RETURN ONLY VALID JSON OBJECT.",
          messages: [{ role: "user", content: fullPrompt }]
        });
        let rawText = response.content[0].type === 'text' ? response.content[0].text : "{}";
        rawText = rawText.replace(/```(json)?/gi, '').trim();
        responseData = JSON.parse(rawText);
      } else {
        throw new Error("Unknown provider selected.");
      }

      res.json(responseData);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate text content." });
    }
  });

  app.post("/api/compress", async (req, res) => {
    try {
      const { text, customModel } = req.body;
      const providerModel = req.headers['x-provider-text'] as string || 'gemini|gemini-3.1-flash-lite';
      const [provider, modelIdTemp] = providerModel.split('|');
      let modelId = modelIdTemp === "gemini-3.1-pro" ? "gemini-3.1-pro-preview" : modelIdTemp;
      let activeModelId = customModel || modelId;
      if (activeModelId === "gemini-3.1-pro") activeModelId = "gemini-3.1-pro-preview";
      if (activeModelId === "gemini-3.1-flash-lite-image" || activeModelId === "gemini-3.1-flash-image") activeModelId = "imagen-3.0-generate-002";

      if (provider === 'gemini') {
        const ai = getAiInstance(req);
        const systemInstruction = "You are a background Memory Compressor Agent. Your job is to take a long chain of historical context and compress it into a highly dense, factual summary. Retain all key entities, decisions, facts, and critical data points. Remove conversational filler. Output ONLY the compressed memory block.";
        
        const result = await ai.models.generateContent({
          model: activeModelId,
          contents: [{ role: "user", parts: [{ text: `COMPRESS THIS HISTORY:\n\n${text}` }] }],
          config: { systemInstruction }
        });
        
        res.json({ summary: result.text });
      } else {
         res.json({ summary: "Compression not supported for this provider yet." });
      }
    } catch (error: any) {
       console.error("Compression failed:", error);
       res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cluster", async (req, res) => {
    try {
      const { nodes } = req.body;
      const ai = getAiInstance(req);
      
      const prompt = `You are a specialized AI Librarian spatial clustering engine. Analyze the following canvas nodes (which contain prompts and content). Your job is to group them logically based on semantic relationships, topics, or workflows. 
      
Then, assign physical 2D coordinates (x, y) to each node to cluster them physically on an infinite canvas. 
- Keep related nodes close together (e.g., within 300-400px of each other).
- Keep distinct groups spaced apart by at least 1000px to avoid visual clutter.
- Do not stack nodes exactly on top of each other; give them some padding.
      
Nodes:
${JSON.stringify(nodes.map((n: any) => ({ id: n.id, content: n.content.substring(0, 500) })), null, 2)}

Return a JSON object where keys are node IDs and values are { x, y } coordinates. Example: {"node-1": {"x": 0, "y": 0}, "node-2": {"x": 400, "y": 0}}`;

      const result = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            additionalProperties: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            }
          }
        }
      });
      
      const raw = result.text || "{}";
      const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (error: any) {
      console.error("Clustering failed:", error);
      res.status(500).json({ error: "Failed to cluster nodes" });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, customModel } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const providerModel = req.headers['x-provider-image'] as string || 'gemini|imagen-3.0-generate-002';
      const [provider, modelIdTemp] = providerModel.split('|');
      let modelId = modelIdTemp === "gemini-3.1-pro" ? "gemini-3.1-pro-preview" : modelIdTemp;
      let activeModelId = customModel || modelId;
      if (activeModelId === "gemini-3.1-pro") activeModelId = "gemini-3.1-pro-preview";
      if (activeModelId === "gemini-3.1-flash-lite-image" || activeModelId === "gemini-3.1-flash-image") activeModelId = "imagen-3.0-generate-002";
      const enhancedPrompt = `A highly detailed, professional, conceptual diagram, mood board, or literal interpretation representing: ${prompt.substring(0, 500)}. No text. Masterpiece.`;

      if (provider === 'gemini') {
        const ai = getAiInstance(req);
        const callGeminiImage = async (targetModel: string) => {
          return await ai.models.generateContent({
            model: targetModel,
            contents: enhancedPrompt,
            config: { 
              imageConfig: { aspectRatio: '1:1', imageSize: '1K' }
            }
          });
        };

        let response;
        let actualModelUsed = activeModelId || "imagen-3.0-generate-002";
        try {
          response = await callGeminiImage(actualModelUsed);
        } catch (error: any) {
          console.error("Gemini image call failed:", error.message || error);
          const isBYOK = !!req.headers['x-api-key'];
          if (!isBYOK && (error.status === 'NOT_FOUND' || error.status === 403 || error.status === 404 || (error.message && error.message.includes('not found')))) {
            actualModelUsed = 'imagen-3.0-generate-002';
            console.log(`System Key: Falling back to ${actualModelUsed}...`);
            try {
              response = await callGeminiImage(actualModelUsed);
            } catch (fallbackError: any) {
               throw new Error(`System fallback to ${actualModelUsed} failed.`);
            }
          } else if (isBYOK) {
            if (error.status === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('Quota'))) {
               throw new Error(`Your API key hit a rate limit or does not have a billing account for ${actualModelUsed}. Please enable billing in Google AI Studio or select a different image model in Settings. (${error.status})`);
            }
            throw new Error(`Your API key was rejected for model ${actualModelUsed}. Please select a different image model in Settings. (${error.message})`);
          } else {
            if (error.status === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('Quota'))) {
                throw new Error(`The system free tier quota is exhausted for ${actualModelUsed}. Please enter your own API key in Settings (Requires a paid tier / billing enabled key for image generation).`);
            }
            throw error;
          }
        }
        
        let base64EncodeString = null;
        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              base64EncodeString = part.inlineData.data;
              break;
            }
          }
        }
        
        if (base64EncodeString) res.json({ imageUrl: `data:image/jpeg;base64,${base64EncodeString}`, _modelUsed: actualModelUsed });
        else res.status(500).json({ error: "No image generated" });
      } else if (provider === 'openai') {
        const apiKey = req.headers['x-openai-key'] as string;
        if (!apiKey) throw new Error("OpenAI API key required.");
        const openai = new OpenAI({ apiKey });
        const response = await openai.images.generate({
          model: modelId || "dall-e-3",
          prompt: enhancedPrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        });
        const base64EncodeString = response.data[0].b64_json;
        if (base64EncodeString) res.json({ imageUrl: `data:image/jpeg;base64,${base64EncodeString}` });
        else res.status(500).json({ error: "No image generated" });
      } else {
        throw new Error("Unknown provider selected for image generation.");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
